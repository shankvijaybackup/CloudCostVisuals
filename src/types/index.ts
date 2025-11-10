export interface CloudAsset {
  id: string;
  provider: 'AWS' | 'Azure' | 'GCP' | 'Manual';
  assetName: string;
  service: string;
  region: string;
  criticality: 'Low' | 'Medium' | 'High';
  tags: string[];
  owner?: string;
  notes?: string;
  lastUpdated: string;
  
  // Enhanced fields for auto-detected assets
  costThisMonth?: number;
  costLastMonth?: number;
  usageMetrics?: Record<string, any>;
  connectedAssets?: string[];  // IDs of other related assets
  resourceId?: string;  // Native cloud provider resource ID
  assetType?: string;  // More specific type (e.g., 't3.micro', 'Standard_B2s')
  status?: 'running' | 'stopped' | 'terminated' | 'unknown';
}

export interface NewAsset {
  provider: string;
  assetName: string;
  service: string;
  region: string;
  criticality: string;
  tags: string;
}

export interface CostSummary {
  totalCost: number;
  costByProvider: Record<string, number>;
  costByService: Record<string, number>;
  costByRegion: Record<string, number>;
  monthlyTrend: Array<{ month: string; cost: number }>;
}
