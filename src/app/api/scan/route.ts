// Unified API endpoint for scanning all cloud providers
import { NextRequest, NextResponse } from 'next/server';
import { fetchAWSAssetsAndCosts } from "@/lib/connectors/aws";
import { fetchAzureAssetsAndCosts } from "@/lib/connectors/azure";
import { fetchGCPAssetsAndCosts } from "@/lib/connectors/gcp";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { providers = ['aws', 'azure', 'gcp'] } = body;

    console.log(`Starting scan for providers: ${providers.join(', ')}`);

    // Build array of promises for requested providers
    const scanPromises: Promise<any>[] = [];
    
    if (providers.includes('aws')) {
      scanPromises.push(fetchAWSAssetsAndCosts());
    }
    if (providers.includes('azure')) {
      scanPromises.push(fetchAzureAssetsAndCosts());
    }
    if (providers.includes('gcp')) {
      scanPromises.push(fetchGCPAssetsAndCosts());
    }

    // Execute all scans in parallel
    const results = await Promise.allSettled(scanPromises);

    // Process results
    const successfulScans: any[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulScans.push(result.value);
        console.log(`${providers[index]} scan completed successfully`);
      } else {
        const provider = providers[index];
        const error = result.reason instanceof Error ? result.reason.message : 'Unknown error';
        errors.push(`${provider}: ${error}`);
        console.error(`${provider} scan failed:`, error);
      }
    });

    // Combine all assets and costs
    const allAssets = successfulScans.flatMap(scan => scan.assets);
    const totalCost = successfulScans.reduce((sum, scan) => sum + (scan.totalCost || 0), 0);
    
    // Combine cost breakdowns
    const costByProvider: Record<string, number> = {};
    const costByService: Record<string, number> = {};
    const costByRegion: Record<string, number> = {};

    successfulScans.forEach(scan => {
      costByProvider[scan.provider] = scan.totalCost || 0;
      
      // Merge service costs
      if (scan.costByService) {
        Object.entries(scan.costByService).forEach(([service, cost]) => {
          costByService[service] = (costByService[service] || 0) + (cost as number);
        });
      }
      
      // Merge region costs
      if (scan.costByRegion) {
        Object.entries(scan.costByRegion).forEach(([region, cost]) => {
          costByRegion[region] = (costByRegion[region] || 0) + (cost as number);
        });
      }
    });

    const response = {
      success: errors.length === 0,
      providers: successfulScans.map(scan => scan.provider),
      assets: allAssets,
      costSummary: {
        totalCost,
        costByProvider,
        costByService,
        costByRegion,
        monthlyTrend: [
          { month: new Date().toISOString().slice(0, 7), cost: totalCost }
        ]
      },
      lastScan: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Unified scan error:", error);
    return NextResponse.json(
      { 
        error: "Failed to scan cloud providers",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// GET method for individual provider scans
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json(
        { error: "Provider parameter required" },
        { status: 400 }
      );
    }

    let result;
    switch (provider.toLowerCase()) {
      case 'aws':
        result = await fetchAWSAssetsAndCosts();
        break;
      case 'azure':
        result = await fetchAzureAssetsAndCosts();
        break;
      case 'gcp':
        result = await fetchGCPAssetsAndCosts();
        break;
      default:
        return NextResponse.json(
          { error: "Invalid provider. Use: aws, azure, or gcp" },
          { status: 400 }
        );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("Provider scan error:", error);
    return NextResponse.json(
      { 
        error: "Failed to scan provider",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
