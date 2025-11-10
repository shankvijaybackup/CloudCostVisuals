// Cloud scanning scheduler using node-cron
import cron from "node-cron";
import { fetchAWSAssetsAndCosts } from "./connectors/aws";
import { fetchAzureAssetsAndCosts } from "./connectors/azure";
import { fetchGCPAssetsAndCosts } from "./connectors/gcp";

// Interface for scan results
interface ScanResult {
  provider: string;
  assets: any[];
  totalCost: number;
  costByService: Record<string, number>;
  costByRegion: Record<string, number>;
  lastScan: string;
}

// Comprehensive scan function
async function scanAllClouds(label: string): Promise<ScanResult[]> {
  console.log(`[${label}] Multi-cloud scan started at ${new Date().toISOString()}`);
  
  try {
    const results = await Promise.allSettled([
      fetchAWSAssetsAndCosts(),
      fetchAzureAssetsAndCosts(),
      fetchGCPAssetsAndCosts(),
    ]);

    const successfulScans: ScanResult[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      const providers = ['AWS', 'Azure', 'GCP'];
      if (result.status === 'fulfilled') {
        successfulScans.push(result.value);
        console.log(`[${label}] ${providers[index]} scan completed: ${result.value.assets.length} assets, $${result.value.totalCost.toFixed(2)}`);
      } else {
        const error = result.reason instanceof Error ? result.reason.message : 'Unknown error';
        errors.push(`${providers[index]}: ${error}`);
        console.error(`[${label}] ${providers[index]} scan failed:`, error);
      }
    });

    // Log summary
    const totalAssets = successfulScans.reduce((sum, scan) => sum + scan.assets.length, 0);
    const totalCost = successfulScans.reduce((sum, scan) => sum + scan.totalCost, 0);
    
    console.log(`[${label}] Scan complete - Total: ${totalAssets} assets, $${totalCost.toFixed(2)} across ${successfulScans.length} providers`);
    
    if (errors.length > 0) {
      console.error(`[${label}] Errors encountered:`, errors);
    }

    // Here you could store results in a database, send notifications, etc.
    // For example:
    // await storeScanResults(successfulScans, label);
    // await sendCostAlerts(totalCost, previousCost);

    return successfulScans;

  } catch (error) {
    console.error(`[${label}] Critical error in scanAllClouds:`, error);
    throw error;
  }
}

// Individual provider scan functions
async function scanAWS(label: string = "manual") {
  console.log(`[${label}] AWS scan started`);
  try {
    const result = await fetchAWSAssetsAndCosts();
    console.log(`[${label}] AWS scan completed: ${result.assets.length} assets, $${result.totalCost.toFixed(2)}`);
    return result;
  } catch (error) {
    console.error(`[${label}] AWS scan failed:`, error);
    throw error;
  }
}

async function scanAzure(label: string = "manual") {
  console.log(`[${label}] Azure scan started`);
  try {
    const result = await fetchAzureAssetsAndCosts();
    console.log(`[${label}] Azure scan completed: ${result.assets.length} assets, $${result.totalCost.toFixed(2)}`);
    return result;
  } catch (error) {
    console.error(`[${label}] Azure scan failed:`, error);
    throw error;
  }
}

async function scanGCP(label: string = "manual") {
  console.log(`[${label}] GCP scan started`);
  try {
    const result = await fetchGCPAssetsAndCosts();
    console.log(`[${label}] GCP scan completed: ${result.assets.length} assets, $${result.totalCost.toFixed(2)}`);
    return result;
  } catch (error) {
    console.error(`[${label}] GCP scan failed:`, error);
    throw error;
  }
}

// Scheduled tasks
console.log("🕐 Initializing cloud scan scheduler...");

// Daily scan at 2 AM UTC
cron.schedule("0 2 * * *", async () => {
  console.log("📅 [daily] Scheduled scan triggered");
  try {
    await scanAllClouds("daily");
  } catch (error) {
    console.error("❌ [daily] Scheduled scan failed:", error);
  }
}, {
  scheduled: true,
  timezone: "UTC"
});

// Weekly scan on Sundays at 3 AM UTC
cron.schedule("0 3 * * 0", async () => {
  console.log("📅 [weekly] Scheduled scan triggered");
  try {
    await scanAllClouds("weekly");
  } catch (error) {
    console.error("❌ [weekly] Scheduled scan failed:", error);
  }
}, {
  scheduled: true,
  timezone: "UTC"
});

// Hourly lightweight scan (for critical environments)
cron.schedule("0 * * * *", async () => {
  console.log("📅 [hourly] Lightweight scan triggered");
  try {
    // Only scan critical resources or check for changes
    // This is a placeholder for more efficient scanning
    console.log("📊 [hourly] Checking for resource changes...");
  } catch (error) {
    console.error("❌ [hourly] Lightweight scan failed:", error);
  }
}, {
  scheduled: true,
  timezone: "UTC"
});

// Export functions for manual triggering
export {
  scanAllClouds,
  scanAWS,
  scanAzure,
  scanGCP
};

// Utility functions for cost monitoring
export async function getCostTrend(days: number = 30) {
  // This would typically query a database for historical cost data
  // For now, it's a placeholder
  console.log(`📈 Getting cost trend for last ${days} days`);
  return {
    trend: "stable",
    changePercent: 0,
    data: []
  };
}

export async function sendCostAlerts(currentCost: number, previousCost: number) {
  const changePercent = ((currentCost - previousCost) / previousCost) * 100;
  
  if (Math.abs(changePercent) > 20) {
    console.log(`🚨 Cost alert: ${changePercent > 0 ? 'Increase' : 'Decrease'} of ${Math.abs(changePercent).toFixed(1)}% detected`);
    
    // Here you would send notifications via email, Slack, etc.
    // await sendNotification({
    //   type: 'cost_alert',
    //   message: `Cloud costs changed by ${changePercent.toFixed(1)}%`,
    //   severity: changePercent > 20 ? 'high' : 'medium'
    // });
  }
}

console.log("✅ Cloud scan scheduler initialized successfully");
console.log("📅 Scheduled scans:");
console.log("   - Daily: 2:00 AM UTC");
console.log("   - Weekly: Sunday 3:00 AM UTC");
console.log("   - Hourly: Every hour (lightweight)");
