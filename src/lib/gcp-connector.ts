// Google Cloud Platform connector for asset inventory and cost data
// Uses Google Cloud SDK to fetch compute instances, storage buckets, and billing data

import compute from '@google-cloud/compute';
import { Storage } from '@google-cloud/storage';
import resourceManager from '@google-cloud/resource-manager';
import { v1 as Billing } from '@google-cloud/billing';
import { CloudAsset } from '@/types';

interface GCPCredentials {
  projectId: string;
  keyFilename?: string;
  credentials?: {
    client_email: string;
    private_key: string;
  };
}

export class GCPConnector {
  private compute: any; // compute.InstancesClient
  private storage: Storage;
  private resourceManager: any; // resourceManager.ProjectsClient
  private billing: Billing.CloudBillingClient;
  private projectId: string;

  constructor(credentials: GCPCredentials) {
    this.projectId = credentials.projectId;
    
    const clientConfig = credentials.keyFilename 
      ? { keyFilename: credentials.keyFilename }
      : { credentials: credentials.credentials };

    this.compute = new compute.InstancesClient(clientConfig);
    this.storage = new Storage(clientConfig);
    this.resourceManager = new resourceManager.ProjectsClient(clientConfig);
    this.billing = new Billing.CloudBillingClient(clientConfig);
  }

  async scanAssets(): Promise<CloudAsset[]> {
    const assets: CloudAsset[] = [];
    
    try {
      // Fetch Compute Engine instances
      const instances = await this.fetchComputeInstances();
      assets.push(...instances);

      // Fetch Cloud Storage buckets
      const buckets = await this.fetchStorageBuckets();
      assets.push(...buckets);

      // Add connections between related resources
      this.addConnections(assets);

      return assets;
    } catch (error) {
      console.error('GCP asset scan failed:', error);
      throw new Error(`GCP scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCostData(): Promise<any> {
    try {
      // Get billing account for the project
      const [projectBillingInfo] = await this.billing.getProjectBillingInfo({ 
        name: `projects/${this.projectId}` 
      });

      if (!projectBillingInfo.billingAccountName) {
        throw new Error('No billing account associated with this project');
      }

      // Query cost data
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const request = {
        name: projectBillingInfo.billingAccountName,
        filter: `
          start_date >= "${firstDayOfMonth.toISOString().split('T')[0]}"
          AND end_date <= "${now.toISOString().split('T')[0]}"
        `,
        aggregation: {
          groupByFields: [
            { key: 'service.description' },
            { key: 'resource.location' }
          ]
        }
      };

      const [response] = await (this.billing as any).queryCostStream(request);
      
      return this.processCostData(response);
    } catch (error) {
      console.error('GCP cost data fetch failed:', error);
      throw new Error(`GCP cost query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async fetchComputeInstances(): Promise<CloudAsset[]> {
    const instances: CloudAsset[] = [];
    
    try {
      // Get all zones in the project
      const [zones] = await this.compute.aggregatedList({
        project: this.projectId
      });

      for (const [zone, zoneInstances] of Object.entries(zones.itemsMap || {})) {
        const zoneData = zoneInstances as any;
        if (!zoneData.instances) continue;
        
        for (const instance of zoneData.instances) {
          if (!instance.id || !instance.name) continue;
          
          // Get machine type
          const machineType = instance.machineType?.split('/').pop() || 'unknown';
          
          // Get status
          const status = instance.status || 'unknown';
          
          // Get labels as tags
          const labels = instance.labels || {};
          const tags = Object.entries(labels).map(([key, value]) => `${key}:${value || ''}`);
          
          instances.push({
            id: `projects/${this.projectId}/zones/${zone}/instances/${instance.name}`,
            provider: 'GCP',
            assetName: instance.name,
            service: 'Compute Engine',
            region: this.mapGCPRegion(zone),
            criticality: this.determineCriticality(tags),
            tags,
            owner: this.extractOwnerFromLabels(labels),
            notes: `Machine Type: ${machineType}, Zone: ${zone}`,
            resourceId: instance.id.toString(),
            assetType: machineType,
            status: this.mapGCPStatus(status),
            lastUpdated: new Date().toISOString(),
            usageMetrics: {
              machineType,
              zone: zone,
              creationTimestamp: instance.creationTimestamp
            },
            connectedAssets: []
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch GCP Compute Instances:', error);
    }
    
    return instances;
  }

  private async fetchStorageBuckets(): Promise<CloudAsset[]> {
    const buckets: CloudAsset[] = [];
    
    try {
      const [bucketList] = await this.storage.getBuckets();
      
      for (const bucket of bucketList) {
        if (!bucket.name || !bucket.metadata) continue;
        
        const metadata = bucket.metadata;
        const labels = metadata.labels || {};
        const tags = Object.entries(labels).map(([key, value]) => `${key}:${value || ''}`);
        
        // Get storage class
        const storageClass = metadata.storageClass || 'STANDARD';
        
        // Get location
        const location = metadata.location || 'unknown';
        
        buckets.push({
          id: `projects/${this.projectId}/buckets/${bucket.name}`,
          provider: 'GCP',
          assetName: bucket.name,
          service: 'Cloud Storage',
          region: this.mapGCPLocation(location),
          criticality: this.determineCriticality(tags),
          tags,
          owner: this.extractOwnerFromLabels(labels as { [key: string]: string }),
          notes: `Storage Class: ${storageClass}, Location: ${location}`,
          resourceId: bucket.name,
          assetType: storageClass,
          status: 'running',
          lastUpdated: new Date().toISOString(),
          usageMetrics: {
            storageClass,
            location,
            timeCreated: metadata.timeCreated
          },
          connectedAssets: []
        });
      }
    } catch (error) {
      console.error('Failed to fetch GCP Storage Buckets:', error);
    }
    
    return buckets;
  }

  private addConnections(assets: CloudAsset[]): void {
    // Simple connection logic: connect compute instances to storage buckets
    const instances = assets.filter(a => a.service === 'Compute Engine');
    const buckets = assets.filter(a => a.service === 'Cloud Storage');
    
    instances.forEach(instance => {
      // Connect to buckets in the same region
      const instanceRegion = instance.region;
      const compatibleBuckets = buckets.filter(bucket => 
        bucket.region === instanceRegion
      );
      
      instance.connectedAssets = compatibleBuckets.map(bucket => bucket.id);
    });
  }

  private processCostData(response: any): any {
    const costByService: Record<string, number> = {};
    const costByRegion: Record<string, number> = {};
    let totalCost = 0;

    if (response.results) {
      for (const result of response.results) {
        const service = result.service?.description || 'unknown';
        const region = result.resource?.location || 'unknown';
        const cost = parseFloat(result.cost?.amount || '0') || 0;
        
        costByService[service] = (costByService[service] || 0) + cost;
        costByRegion[region] = (costByRegion[region] || 0) + cost;
        totalCost += cost;
      }
    }

    return {
      totalCost,
      costByProvider: { GCP: totalCost },
      costByService,
      costByRegion,
      monthlyTrend: [
        { month: new Date().toISOString().slice(0, 7), cost: totalCost }
      ]
    };
  }

  private mapGCPRegion(zone: string): string {
    // Extract region from zone name (e.g., 'us-central1-a' -> 'us-central1')
    const parts = zone.split('-');
    if (parts.length >= 3) {
      return parts.slice(0, -1).join('-');
    }
    return zone;
  }

  private mapGCPLocation(location: string): string {
    const locationMap: Record<string, string> = {
      'US': 'United States',
      'US-CENTRAL1': 'Central US',
      'US-EAST1': 'East US',
      'US-WEST1': 'West US',
      'US-WEST2': 'West US 2',
      'EUROPE': 'Europe',
      'EUROPE-WEST1': 'West Europe',
      'EUROPE-WEST2': 'West Europe 2',
      'ASIA': 'Asia',
      'ASIA-EAST1': 'East Asia',
      'ASIA-SOUTHEAST1': 'Southeast Asia'
    };
    return locationMap[location.toUpperCase()] || location;
  }

  private mapGCPStatus(status: string): 'running' | 'stopped' | 'terminated' | 'unknown' {
    switch (status.toUpperCase()) {
      case 'RUNNING':
        return 'running';
      case 'STOPPED':
      case 'TERMINATED':
        return 'stopped';
      case 'SUSPENDED':
        return 'terminated';
      default:
        return 'unknown';
    }
  }

  private determineCriticality(tags: string[]): 'Low' | 'Medium' | 'High' {
    const tagString = tags.join(' ').toLowerCase();
    if (tagString.includes('production') || tagString.includes('critical')) return 'High';
    if (tagString.includes('staging') || tagString.includes('testing')) return 'Medium';
    return 'Low';
  }

  private extractOwnerFromLabels(labels: { [key: string]: string }): string {
    // Look for common owner label patterns
    for (const [key, value] of Object.entries(labels)) {
      if (key.toLowerCase().includes('owner') || key.toLowerCase().includes('team')) {
        return value;
      }
    }
    
    return '';
  }
}
