import { prisma } from "@/lib/db";

export async function saveScanResults(provider: string, assets: any[], scanType = "manual") {
  try {
    await prisma.cloudScan.createMany({
      data: assets.map(a => ({
        provider,
        region: a.region || "unknown",
        service: a.service,
        resourceId: a.id || a.resourceId,
        costThisMonth: a.costThisMonth || 0,
        tags: a.tags || [],
        connections: a.connections || [],
        scanType,
        scannedAt: new Date(),
      })),
      skipDuplicates: true,
    });
    console.log(`[${scanType}] Saved ${assets.length} ${provider} assets to database`);
  } catch (error) {
    console.error(`Error saving ${provider} scan results:`, error);
    throw error;
  }
}
