"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function CostTrendChart() {
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    providers: ["AWS", "Azure", "GCP"],
    region: "",
    service: "",
    months: 6,
  });

  const fetchTrends = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    filters.providers.forEach((p) => params.append("provider", p));
    if (filters.region) params.set("region", filters.region);
    if (filters.service) params.set("service", filters.service);
    params.set("months", String(filters.months));

    const res = await fetch(`/api/scans/trends?${params.toString()}`);
    const data = await res.json();

    setTrendData(
      data.trends.map((t: any) => ({
        month: new Date(t.month).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        provider: t.provider,
        total_cost: Number(t.total_cost),
        percent_change: parseFloat(t.percent_change),
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchTrends();
  }, [filters]);

  const toggleProvider = (p: string) => {
    setFilters((prev) => ({
      ...prev,
      providers: prev.providers.includes(p)
        ? prev.providers.filter((x) => x !== p)
        : [...prev.providers, p],
    }));
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Cost Trends (with Time Range & Provider Multi-Select)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          {["AWS", "Azure", "GCP"].map((p) => (
            <button
              key={p}
              onClick={() => toggleProvider(p)}
              className={`px-3 py-1 rounded text-sm ${
                filters.providers.includes(p)
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 text-gray-700"
              }`}
            >
              {p}
            </button>
          ))}

          <select
            className="border rounded px-2 py-1 text-sm"
            value={filters.months}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, months: Number(e.target.value) }))
            }
          >
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
        </div>

        <div className="h-80">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading trends...</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value, name) =>
                  name === "percent_change"
                    ? `${value}%`
                    : `$${Number(value).toFixed(2)}`
                } />
                <Legend />
                <Line type="monotone" dataKey="total_cost" stroke="#3b82f6" name="Total Cost ($)" />
                <Line type="monotone" dataKey="percent_change" stroke="#ef4444" name="% Change" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
