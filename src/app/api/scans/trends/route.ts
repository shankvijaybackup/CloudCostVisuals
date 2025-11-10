import { prisma } from "@/lib/db";
import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(() => console.warn("⚠️ Redis cache not connected"));

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const providers = url.searchParams.getAll("provider"); // multi-select
    const region = url.searchParams.get("region");
    const service = url.searchParams.get("service");
    const months = Number(url.searchParams.get("months") || 6);

    const cacheKey = `trends:${providers.join(",")}:${region || "all"}:${service || "all"}:${months}`;
    const cached = await redis.get(cacheKey);
    if (cached) return new Response(cached, { headers: { "Content-Type": "application/json" } });

    const where: any = {};
    if (providers.length) where.provider = { in: providers };
    if (region) where.region = region;
    if (service) where.service = service;
    where.scannedAt = { gte: new Date(new Date().setMonth(new Date().getMonth() - months)) };

    const monthlyTrends = await prisma.$queryRawUnsafe(`
      SELECT provider,
             DATE_TRUNC('month', scanned_at) AS month,
             SUM(cost_this_month) AS total_cost
      FROM cloud_scan
      WHERE scanned_at >= NOW() - INTERVAL '${months} month'
        ${providers.length ? `AND provider IN (${providers.map((p) => `'${p}'`).join(",")})` : ""}
        ${region ? `AND region = '${region}'` : ""}
        ${service ? `AND service = '${service}'` : ""}
      GROUP BY provider, month
      ORDER BY month;
    `);

    // Calculate month-over-month percentage change
    const result = (monthlyTrends as any[]).map((r: any, i: number, arr: any[]) => {
      const prev = arr[i - 1]?.total_cost || r.total_cost;
      const change = ((r.total_cost - prev) / prev) * 100;
      return { ...r, percent_change: change.toFixed(2) };
    });

    const json = JSON.stringify({ trends: result });
    await redis.setEx(cacheKey, 3600, json); // cache for 1 hour
    return new Response(json, { headers: { "Content-Type": "application/json" }, status: 200 });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
