// AWS connector for asset inventory and cost data
// Uses AWS SDK v3 to fetch EC2 instances, S3 buckets, and cost data

import { EC2Client, DescribeInstancesCommand, DescribeTagsCommand } from '@aws-sdk/client-ec2';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import { ResourceGroupsTaggingAPIClient, GetResourcesCommand } from '@aws-sdk/client-resource-groups-tagging-api';
import { CloudAsset } from '@/types';

interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

export class AWSConnector {
  private ec2Client: EC2Client;
  private s3Client: S3Client;
  private costExplorerClient: CostExplorerClient;
  private taggingClient: ResourceGroupsTaggingAPIClient;
  private region: string;

  constructor(credentials: AWSCredentials) {
    this.region = credentials.region || 'us-east-1';
    
    const clientConfig = {
      region: this.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      }
    };

    this.ec2Client = new EC2Client(clientConfig);
    this.s3Client = new S3Client(clientConfig);
    this.costExplorerClient = new CostExplorerClient({ ...clientConfig, region: 'us-east-1' }); // Cost Explorer is us-east-1 only
    this.taggingClient = new ResourceGroupsTaggingAPIClient(clientConfig);
  }

  async scanAssets(): Promise<CloudAsset[]> {
    const assets: CloudAsset[] = [];
    
    try {
      // Fetch EC2 instances
      const instances = await this.fetchEC2Instances();
      assets.push(...instances);

      // Fetch S3 buckets
      const buckets = await this.fetchS3Buckets();
      assets.push(...buckets);

      // Add connections between related resources
      this.addConnections(assets);

      return assets;
    } catch (error) {
      console.error('AWS asset scan failed:', error);
      throw new Error(`AWS scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCostData(): Promise<any> {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const command = new GetCostAndUsageCommand({
        TimePeriod: {
          Start: firstDayOfMonth.toISOString().split('T')[0],
          End: now.toISOString().split('T')[0],
        },
        Granularity: 'MONTHLY',
        Metrics: ['BlendedCost'],
        GroupBy: [
          { Type: 'DIMENSION', Key: 'SERVICE' },
          { Type: 'DIMENSION', Key: 'REGION' }
        ]
      });

      const result = await this.costExplorerClient.send(command);
      
      return this.processCostData(result);
    } catch (error) {
      console.error('AWS cost data fetch failed:', error);
      throw new Error(`AWS cost query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async fetchEC2Instances(): Promise<CloudAsset[]> {
    const instances: CloudAsset[] = [];
    
    try {
      const command = new DescribeInstancesCommand({});
      const response = await this.ec2Client.send(command);
      
      for (const reservation of response.Reservations || []) {
        for (const instance of reservation.Instances || []) {
          if (!instance.InstanceId) continue;
          
          // Get tags for this instance
          const tags = await this.getInstanceTags(instance.InstanceId);
          
          // Extract information
          const instanceType = instance.InstanceType || 'unknown';
          const state = instance.State?.Name || 'unknown';
          const launchTime = instance.LaunchTime;
          
          instances.push({
            id: instance.InstanceId,
            provider: 'AWS',
            assetName: this.extractNameFromTags(tags) || instance.InstanceId,
            service: 'EC2',
            region: this.region,
            criticality: this.determineCriticality(tags),
            tags: tags.map(tag => `${tag.Key}:${tag.Value}`),
            owner: this.extractOwnerFromTags(tags),
            notes: `Type: ${instanceType}, State: ${state}`,
            resourceId: instance.InstanceId,
            assetType: instanceType,
            status: this.mapAWSStatus(state),
            lastUpdated: new Date().toISOString(),
            usageMetrics: {
              instanceType,
              state,
              launchTime: launchTime?.toISOString(),
              privateIpAddress: instance.PrivateIpAddress,
              publicIpAddress: instance.PublicIpAddress
            },
            connectedAssets: []
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch AWS EC2 instances:', error);
    }
    
    return instances;
  }

  private async fetchS3Buckets(): Promise<CloudAsset[]> {
    const buckets: CloudAsset[] = [];
    
    try {
      const command = new ListBucketsCommand({});
      const response = await this.s3Client.send(command);
      
      for (const bucket of response.Buckets || []) {
        if (!bucket.Name) continue;
        
        // Get bucket location (this requires additional calls, simplified for demo)
        const tags = await this.getBucketTags(bucket.Name);
        
        buckets.push({
          id: bucket.Name,
          provider: 'AWS',
          assetName: bucket.Name,
          service: 'S3',
          region: this.region, // Simplified - would need additional calls to get actual region
          criticality: this.determineCriticality(tags),
          tags: tags.map(tag => `${tag.Key}:${tag.Value}`),
          owner: this.extractOwnerFromTags(tags),
          notes: `Created: ${bucket.CreationDate?.toISOString()}`,
          resourceId: bucket.Name,
          assetType: 'Bucket',
          status: 'running',
          lastUpdated: new Date().toISOString(),
          usageMetrics: {
            creationDate: bucket.CreationDate?.toISOString()
          },
          connectedAssets: []
        });
      }
    } catch (error) {
      console.error('Failed to fetch AWS S3 buckets:', error);
    }
    
    return buckets;
  }

  private async getInstanceTags(instanceId: string): Promise<Array<{ Key: string; Value: string }>> {
    try {
      const command = new DescribeTagsCommand({
        Filters: [
          { Name: 'resource-id', Values: [instanceId] }
        ]
      });
      
      const response = await this.ec2Client.send(command);
      return (response.Tags || []).map(tag => ({
        Key: tag.Key || '',
        Value: tag.Value || ''
      }));
    } catch (error) {
      console.error(`Failed to get tags for instance ${instanceId}:`, error);
      return [];
    }
  }

  private async getBucketTags(bucketName: string): Promise<Array<{ Key: string; Value: string }>> {
    try {
      const command = new GetResourcesCommand({
        ResourceTypeFilters: ['s3'],
        TagFilters: [
          { Key: 'Name', Values: [bucketName] }
        ]
      });
      
      const response = await this.taggingClient.send(command);
      return (response.ResourceTagMappingList?.[0]?.Tags || []).map(tag => ({
        Key: tag.Key || '',
        Value: tag.Value || ''
      }));
    } catch (error) {
      console.error(`Failed to get tags for bucket ${bucketName}:`, error);
      return [];
    }
  }

  private addConnections(assets: CloudAsset[]): void {
    // Simple connection logic: connect EC2 instances to S3 buckets
    const instances = assets.filter(a => a.service === 'EC2');
    const buckets = assets.filter(a => a.service === 'S3');
    
    instances.forEach(instance => {
      // Connect to buckets that might be used by this instance
      // In a real implementation, this would be based on actual usage patterns
      const compatibleBuckets = buckets.slice(0, 2); // Simplified logic
      instance.connectedAssets = compatibleBuckets.map(bucket => bucket.id);
    });
  }

  private processCostData(result: any): any {
    const costByService: Record<string, number> = {};
    const costByRegion: Record<string, number> = {};
    let totalCost = 0;

    if (result.ResultsByTime?.[0]?.Groups) {
      for (const group of result.ResultsByTime[0].Groups) {
        const keys = group.Keys || [];
        const amount = parseFloat(group.Metrics?.BlendedCost?.Amount || '0') || 0;
        
        // Extract service and region from keys
        const service = keys[0] || 'unknown';
        const region = keys[1] || 'unknown';
        
        costByService[service] = (costByService[service] || 0) + amount;
        costByRegion[region] = (costByRegion[region] || 0) + amount;
        totalCost += amount;
      }
    }

    return {
      totalCost,
      costByProvider: { AWS: totalCost },
      costByService,
      costByRegion,
      monthlyTrend: [
        { month: new Date().toISOString().slice(0, 7), cost: totalCost }
      ]
    };
  }

  private mapAWSStatus(state: string): 'running' | 'stopped' | 'terminated' | 'unknown' {
    switch (state.toLowerCase()) {
      case 'running':
        return 'running';
      case 'stopped':
        return 'stopped';
      case 'terminated':
      case 'shutting-down':
        return 'terminated';
      default:
        return 'unknown';
    }
  }

  private determineCriticality(tags: Array<{ Key: string; Value: string }>): 'Low' | 'Medium' | 'High' {
    const tagString = tags.map(tag => `${tag.Key}:${tag.Value}`).join(' ').toLowerCase();
    if (tagString.includes('production') || tagString.includes('critical')) return 'High';
    if (tagString.includes('staging') || tagString.includes('testing')) return 'Medium';
    return 'Low';
  }

  private extractNameFromTags(tags: Array<{ Key: string; Value: string }>): string | null {
    const nameTag = tags.find(tag => tag.Key.toLowerCase() === 'name');
    return nameTag?.Value || null;
  }

  private extractOwnerFromTags(tags: Array<{ Key: string; Value: string }>): string {
    for (const tag of tags) {
      if (tag.Key.toLowerCase().includes('owner') || tag.Key.toLowerCase().includes('team')) {
        return tag.Value;
      }
    }
    return '';
  }
}
