// AWS connector for fetching all assets and cost data
import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import { ResourceGroupsTaggingAPIClient, GetResourcesCommand } from "@aws-sdk/client-resource-groups-tagging-api";
import { saveScanResults } from "./save";

export async function fetchAWSAssetsAndCosts() {
  const region = process.env.AWS_REGION || "us-east-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS credentials not configured");
  }

  const clientConfig = {
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    }
  };

  const taggingClient = new ResourceGroupsTaggingAPIClient(clientConfig);
  const costClient = new CostExplorerClient({ ...clientConfig, region: 'us-east-1' }); // Cost Explorer is us-east-1 only

  try {
    // Fetch all tagged resources
    const tagRes = await taggingClient.send(new GetResourcesCommand({
      ResourceTypeFilters: [
        "ec2:instance",
        "s3:bucket",
        "rds:db",
        "lambda:function",
        "ecs:cluster",
        "ecs:service",
        "eks:cluster",
        "elasticloadbalancing:loadbalancer",
        "cloudfront:distribution",
        "route53:hostedzone"
      ]
    }));

    const assets = tagRes.ResourceTagMappingList?.map((r) => {
      const arnParts = r.ResourceARN?.split(":") || [];
      return {
        id: r.ResourceARN,
        service: arnParts[2] || "unknown",
        region: arnParts[3] || "unknown",
        resourceId: arnParts[5] || arnParts[6] || "unknown",
        tags: r.Tags?.map((t) => `${t.Key}:${t.Value}`) || [],
        provider: "AWS"
      };
    }) || [];

    // Fetch cost data for current month
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const costRes = await costClient.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: "MONTHLY",
        Metrics: ["BlendedCost"],
        GroupBy: [
          { Type: "DIMENSION", Key: "SERVICE" },
          { Type: "DIMENSION", Key: "REGION" }
        ]
      })
    );

    const totalCost = parseFloat(costRes.ResultsByTime?.[0]?.Total?.BlendedCost?.Amount || "0");
    
    // Process cost breakdown by service and region
    const costByService: Record<string, number> = {};
    const costByRegion: Record<string, number> = {};
    const assetCountByService: Record<string, number> = {};

    costRes.ResultsByTime?.[0]?.Groups?.forEach(group => {
      const service = group.Keys?.[0] || "unknown";
      const region = group.Keys?.[1] || "unknown";
      const amount = parseFloat(group.Metrics?.BlendedCost?.Amount || "0");
      
      costByService[service] = (costByService[service] || 0) + amount;
      costByRegion[region] = (costByRegion[region] || 0) + amount;
    });

    // Count assets per service for cost distribution
    assets.forEach(asset => {
      assetCountByService[asset.service] = (assetCountByService[asset.service] || 0) + 1;
    });

    // Assign cost per asset based on service cost divided by asset count
    const assetsWithCost = assets.map(asset => ({
      ...asset,
      costThisMonth: costByService[asset.service] ? costByService[asset.service] / assetCountByService[asset.service] : 0,
    }));

    // Save scan results to database
    await saveScanResults("AWS", assetsWithCost, "manual");

    return { 
      provider: "AWS", 
      assets: assetsWithCost, 
      totalCost,
      costByService,
      costByRegion,
      lastScan: new Date().toISOString()
    };

  } catch (error) {
    console.error("AWS fetch error:", error);
    throw new Error(`AWS fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
