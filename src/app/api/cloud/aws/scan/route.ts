import { NextRequest, NextResponse } from 'next/server';
import { AWSConnector } from '@/lib/aws-connector';
import { CloudAsset, CostSummary } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessKeyId, secretAccessKey, region } = body;

    if (!accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { error: 'Missing required AWS credentials' },
        { status: 400 }
      );
    }

    const connector = new AWSConnector({
      accessKeyId,
      secretAccessKey,
      region
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
    console.error('AWS scan error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to scan AWS resources',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
