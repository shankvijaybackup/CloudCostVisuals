// Azure connector for fetching all assets and cost data
import { DefaultAzureCredential, ClientSecretCredential } from "@azure/identity";
import { CostManagementClient } from "@azure/arm-costmanagement";
import { ResourceGraphClient } from "@azure/arm-resourcegraph";
import { saveScanResults } from "./save";

export async function fetchAzureAssetsAndCosts() {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID;
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;

  if (!clientId || !clientSecret || !tenantId || !subscriptionId) {
    throw new Error("Azure credentials not configured");
  }

  try {
    // Use client secret credential for service principal authentication
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const costClient = new CostManagementClient(credential);
    const resourceClient = new ResourceGraphClient(credential);

    // Fetch all resources using Resource Graph
    const query = {
      query: `Resources | project name, type, location, tags, id | order by name`,
      subscriptions: [subscriptionId],
    };

    const resources = await resourceClient.resources(query);
    
    const assets = resources.data.map((r: any) => ({
      id: r.id,
      service: r.type.split('/')[0] || "unknown",
      resourceType: r.type,
      region: r.location || "unknown",
      tags: Object.entries(r.tags || {}).map(([key, value]) => `${key}:${value}`),
      provider: "Azure"
    }));

    // Fetch cost data for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = now.toISOString();

    const costs = await (costClient as any).queryUsage({
      scope: `/subscriptions/${subscriptionId}`,
      timeFrame: "MonthToDate",
      type: "ActualCost",
      dataset: {
        granularity: "Daily",
        aggregation: {
          totalCost: {
            name: "Cost",
            function: "Sum"
          }
        },
        grouping: [
          {
            type: "Dimension", 
            name: "ResourceType"
          },
          {
            type: "Dimension", 
            name: "ResourceLocation"
          }
        ]
      }
    });

    // Process cost data
    let totalCost = 0;
    const costByService: Record<string, number> = {};
    const costByRegion: Record<string, number> = {};
    const assetCountByService: Record<string, number> = {};

    if (costs.rows) {
      for (const row of costs.rows) {
        const serviceType = row[0] as string;
        const region = row[1] as string || "unknown";
        const cost = parseFloat(row[2] as string) || 0;
        
        totalCost += cost;
        costByService[serviceType] = (costByService[serviceType] || 0) + cost;
        costByRegion[region] = (costByRegion[region] || 0) + cost;
      }
    }

    // Count assets per service for cost distribution
    assets.forEach((asset: any) => {
      assetCountByService[asset.service] = (assetCountByService[asset.service] || 0) + 1;
    });

    // Assign cost per asset based on service cost divided by asset count
    const assetsWithCost = assets.map((asset: any) => ({
      ...asset,
      costThisMonth: costByService[asset.resourceType] ? costByService[asset.resourceType] / assetCountByService[asset.service] : 0,
    }));

    // Save scan results to database
    await saveScanResults("Azure", assetsWithCost, "manual");

    return {
      provider: "Azure",
      assets: assetsWithCost,
      totalCost,
      costByService,
      costByRegion,
      lastScan: new Date().toISOString()
    };

  } catch (error) {
    console.error("Azure fetch error:", error);
    throw new Error(`Azure fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
