import { NextRequest, NextResponse } from 'next/server';
import { AzureConnector } from '@/lib/azure-connector';
import { CloudAsset, CostSummary } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, clientSecret, tenantId, subscriptionId } = body;

    if (!clientId || !clientSecret || !tenantId || !subscriptionId) {
      return NextResponse.json(
        { error: 'Missing required Azure credentials' },
        { status: 400 }
      );
    }

    const connector = new AzureConnector({
      clientId,
      clientSecret,
      tenantId,
      subscriptionId
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
    console.error('Azure scan error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to scan Azure resources',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
