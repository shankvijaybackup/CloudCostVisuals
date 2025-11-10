// Demo script to test AWS connector with mock data
// This would be used for testing without real AWS credentials

import { CloudAsset, CostSummary } from '@/types';

export const mockAWSAssets: CloudAsset[] = [
  {
    id: 'aws-ec2-i-1234567890abcdef0',
    provider: 'AWS',
    assetName: 'web-server-prod-01',
    service: 'EC2',
    region: 'us-east-1',
    criticality: 'High',
    tags: ['production', 'web', 'critical'],
    owner: 'devops-team',
    notes: 'Auto-detected via AWS API',
    resourceId: 'i-1234567890abcdef0',
    assetType: 't3.medium',
    status: 'running',
    costThisMonth: 45.67,
    lastUpdated: new Date().toISOString(),
    usageMetrics: {},
    connectedAssets: [],
  },
  {
    id: 'aws-ec2-i-0987654321fedcba0',
    provider: 'AWS',
    assetName: 'database-server-prod',
    service: 'EC2',
    region: 'us-east-1',
    criticality: 'High',
    tags: ['production', 'database', 'critical'],
    owner: 'database-team',
    notes: 'Auto-detected via AWS API',
    resourceId: 'i-0987654321fedcba0',
    assetType: 'r5.large',
    status: 'running',
    costThisMonth: 125.89,
    lastUpdated: new Date().toISOString(),
    usageMetrics: {},
    connectedAssets: [],
  },
  {
    id: 'aws-ec2-i-abcdef1234567890',
    provider: 'AWS',
    assetName: 'staging-app-server',
    service: 'EC2',
    region: 'us-west-2',
    criticality: 'Medium',
    tags: ['staging', 'application'],
    owner: 'dev-team',
    notes: 'Auto-detected via AWS API',
    resourceId: 'i-abcdef1234567890',
    assetType: 't3.micro',
    status: 'stopped',
    costThisMonth: 12.34,
    lastUpdated: new Date().toISOString(),
    usageMetrics: {},
    connectedAssets: [],
  },
];

export const mockCostSummary = {
  totalCost: 183.90,
  costByProvider: { AWS: 183.90 },
  costByService: {
    'Amazon EC2': 183.90,
    'Amazon RDS': 0,
    'Amazon S3': 0,
  },
  costByRegion: {
    'us-east-1': 171.56,
    'us-west-2': 12.34,
  },
  monthlyTrend: [
    { month: '2024-10', cost: 165.23 },
    { month: '2024-11', cost: 183.90 },
  ],
};

export function loadMockData() {
  // This function can be called from the UI to load demo data
  return {
    assets: mockAWSAssets,
    costSummary: mockCostSummary,
  };
}
