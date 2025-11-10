import { NextRequest, NextResponse } from 'next/server';
import { GCPConnector } from '@/lib/gcp-connector';
import { CloudAsset, CostSummary } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, keyFilename, credentials } = body;

    if (!projectId || (!keyFilename && !credentials)) {
      return NextResponse.json(
        { error: 'Missing required GCP credentials (projectId and either keyFilename or credentials JSON)' },
        { status: 400 }
      );
    }

    const connector = new GCPConnector({
      projectId,
      keyFilename,
      credentials: credentials ? JSON.parse(credentials) : undefined
    });

    // Fetch assets and cost data concurrently
    const [assets, costData] = await Promise.all([
      connector.scanAssets(),
      connector.getCostData()
    ]);

    // Transform cost data to our CostSummary format
    const costSummary: CostSummary = {
      totalCost: costData.totalCost,
      costByProvider: costData.costByProvider,
      costByService: costData.costByService,
      costByRegion: costData.costByRegion,
      monthlyTrend: costData.monthlyTrend
    };

    return NextResponse.json({
      success: true,
      assets,
      costSummary
    });

  } catch (error) {
    console.error('GCP scan error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to scan GCP resources',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
