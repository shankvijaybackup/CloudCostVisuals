// GCP connector for fetching all assets and cost data
import { CloudBillingClient } from "@google-cloud/billing";
import { AssetServiceClient } from "@google-cloud/asset";
import { saveScanResults } from "./save";

export async function fetchGCPAssetsAndCosts() {
  const projectId = process.env.GCP_PROJECT_ID;
  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!projectId) {
    throw new Error("GCP project ID not configured");
  }

  const clientConfig = keyFilename ? { keyFilename } : {};

  try {
    const billing = new CloudBillingClient(clientConfig);
    const assetClient = new AssetServiceClient(clientConfig);

    // Fetch all assets using Asset Inventory
    const assetsResponse = await assetClient.listAssets({
      parent: `projects/${projectId}`,
      contentType: "RESOURCE",
    });

    const assets = assetsResponse[0];

    const assetList = assets.map((a: any) => {
      const resourceData = a.resource?.data || {};
      const labels = (resourceData as any).labels || {};
      
      return {
        id: a.name,
        service: a.assetType?.split('.')?.pop() || "unknown",
        resourceType: a.assetType || "unknown",
        region: (resourceData as any).location?.split('/')?.pop() || "global",
        tags: Object.entries(labels).map(([key, value]) => `${key}:${value}`),
        provider: "GCP"
      };
    });

    // Get billing account for cost queries
    const billingInfoResponse = await billing.getProjectBillingInfo({ 
      name: `projects/${projectId}` 
    });

    const billingInfo = billingInfoResponse[0];

    if (!billingInfo.billingAccountName) {
      throw new Error("No billing account associated with this project");
    }

    // Query cost data for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = now.toISOString().split('T')[0];

    const costQuery = {
      name: billingInfo.billingAccountName,
      filter: `start_date >= "${startOfMonth}" AND end_date <= "${endOfMonth}"`,
      aggregation: {
        groupByFields: [
          { key: "service.description" },
          { key: "resource.location" }
        ]
      }
    };

    const [costResponse] = await (billing as any).queryCostStream(costQuery);

    // Process cost data
    let totalCost = 0;
    const costByService: Record<string, number> = {};
    const costByRegion: Record<string, number> = {};
    const assetCountByService: Record<string, number> = {};

    const results = costResponse.results || [];
    for (const result of results) {
      const service = result.service?.description || "unknown";
      const region = result.resource?.location || "unknown";
      const cost = parseFloat(result.cost?.amount || "0") || 0;
      
      totalCost += cost;
      costByService[service] = (costByService[service] || 0) + cost;
      costByRegion[region] = (costByRegion[region] || 0) + cost;
    }

    // Count assets per service for cost distribution
    assetList.forEach(asset => {
      assetCountByService[asset.service] = (assetCountByService[asset.service] || 0) + 1;
    });

    // Assign cost per asset based on service cost divided by asset count
    const assetsWithCost = assetList.map(asset => ({
      ...asset,
      costThisMonth: costByService[asset.service] ? costByService[asset.service] / assetCountByService[asset.service] : 0,
    }));

    // Save scan results to database
    await saveScanResults("GCP", assetsWithCost, "manual");

    return {
      provider: "GCP",
      assets: assetsWithCost,
      totalCost,
      costByService,
      costByRegion,
      lastScan: new Date().toISOString()
    };

  } catch (error) {
    console.error("GCP fetch error:", error);
    throw new Error(`GCP fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
