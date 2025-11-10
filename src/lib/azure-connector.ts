// Azure connector for asset inventory and cost data
// Uses Azure SDK to fetch virtual machines, storage accounts, and cost data

import { ComputeManagementClient } from '@azure/arm-compute';
import { StorageManagementClient } from '@azure/arm-storage';
import { CostManagementClient } from '@azure/arm-costmanagement';
import { ResourceManagementClient } from '@azure/arm-resources';
import { DefaultAzureCredential, ClientSecretCredential } from '@azure/identity';
import { CloudAsset } from '@/types';

interface AzureCredentials {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  subscriptionId: string;
}

export class AzureConnector {
  private credentials: ClientSecretCredential;
  private subscriptionId: string;

  constructor(credentials: AzureCredentials) {
    this.credentials = new ClientSecretCredential(
      credentials.tenantId,
      credentials.clientId,
      credentials.clientSecret
    );
    this.subscriptionId = credentials.subscriptionId;
  }

  async scanAssets(): Promise<CloudAsset[]> {
    const assets: CloudAsset[] = [];
    
    try {
      // Initialize Azure clients
      const computeClient = new ComputeManagementClient(this.credentials, this.subscriptionId);
      const storageClient = new StorageManagementClient(this.credentials, this.subscriptionId);
      const resourceClient = new ResourceManagementClient(this.credentials, this.subscriptionId);

      // Fetch Virtual Machines
      const vms = await this.fetchVirtualMachines(computeClient);
      assets.push(...vms);

      // Fetch Storage Accounts
      const storageAccounts = await this.fetchStorageAccounts(storageClient);
      assets.push(...storageAccounts);

      // Add connections between related resources
      this.addConnections(assets);

      return assets;
    } catch (error) {
      console.error('Azure asset scan failed:', error);
      throw new Error(`Azure scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCostData(): Promise<any> {
    try {
      const costClient = new CostManagementClient(this.credentials);
      
      // Query cost data for the current month
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const scope = `/subscriptions/${this.subscriptionId}`;
      
      const costQuery = {
        type: 'ActualCost' as const,
        timeframe: 'MonthToDate' as const,
        dataset: {
          granularity: 'Daily' as const,
          aggregation: {
            totalCost: {
              name: 'Cost',
              function: 'Sum' as const
            }
          },
          grouping: [
            {
              type: 'Dimension' as const,
              name: 'ResourceType'
            }
          ]
        }
      };

      const result = await (costClient as any).queryUsage(scope, costQuery);
      
      return this.processCostData(result);
    } catch (error) {
      console.error('Azure cost data fetch failed:', error);
      throw new Error(`Azure cost query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async fetchVirtualMachines(computeClient: ComputeManagementClient): Promise<CloudAsset[]> {
    const vms: CloudAsset[] = [];
    
    try {
      const vmList = computeClient.virtualMachines.listAll();
      
      for await (const vm of vmList) {
        if (vm.id && vm.name && vm.location) {
          const resourceGroup = vm.id.split('/')[4];
          
          // Get VM status and size
          const instanceView = await computeClient.virtualMachines.instanceView(resourceGroup, vm.name);
          const status = instanceView.statuses?.find(s => s.code?.startsWith('PowerState/'))?.displayStatus || 'unknown';
          const vmSize = vm.hardwareProfile?.vmSize || 'unknown';
          
          // Get tags
          const tags = Object.entries(vm.tags || {}).map(([key, value]) => `${key}:${value}`);

          vms.push({
            id: vm.id,
            provider: 'Azure',
            assetName: vm.name,
            service: 'Virtual Machine',
            region: this.mapAzureRegion(vm.location),
            criticality: this.determineCriticality(tags),
            tags,
            owner: this.extractOwnerFromTags(vm.tags),
            notes: `Size: ${vmSize}, Status: ${status}`,
            resourceId: vm.id,
            assetType: vmSize,
            status: this.mapAzureStatus(status),
            lastUpdated: new Date().toISOString(),
            usageMetrics: {
              size: vmSize,
              status: status,
              resourceGroup: resourceGroup
            },
            connectedAssets: []
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch Azure VMs:', error);
    }
    
    return vms;
  }

  private async fetchStorageAccounts(storageClient: StorageManagementClient): Promise<CloudAsset[]> {
    const storageAccounts: CloudAsset[] = [];
    
    try {
      const storageList = storageClient.storageAccounts.list();
      
      for await (const storage of storageList) {
        if (storage.id && storage.name && storage.location) {
          const resourceGroup = storage.id.split('/')[4];
          
          // Get tags
          const tags = Object.entries(storage.tags || {}).map(([key, value]) => `${key}:${value}`);

          storageAccounts.push({
            id: storage.id,
            provider: 'Azure',
            assetName: storage.name,
            service: 'Storage Account',
            region: this.mapAzureRegion(storage.location),
            criticality: this.determineCriticality(tags),
            tags,
            owner: this.extractOwnerFromTags(storage.tags),
            notes: `SKU: ${storage.sku?.name || 'Standard'}, Tier: ${storage.accessTier || 'Hot'}`,
            resourceId: storage.id,
            assetType: storage.sku?.name || 'Standard',
            status: 'running',
            lastUpdated: new Date().toISOString(),
            usageMetrics: {
              sku: storage.sku?.name,
              accessTier: storage.accessTier,
              resourceGroup: resourceGroup
            },
            connectedAssets: []
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch Azure Storage Accounts:', error);
    }
    
    return storageAccounts;
  }

  private addConnections(assets: CloudAsset[]): void {
    // Simple connection logic: connect VMs to storage accounts in the same resource group
    const vms = assets.filter(a => a.service === 'Virtual Machine');
    const storageAccounts = assets.filter(a => a.service === 'Storage Account');
    
    vms.forEach(vm => {
      const vmResourceGroup = vm.usageMetrics?.resourceGroup as string;
      const compatibleStorage = storageAccounts.filter(sa => 
        sa.usageMetrics?.resourceGroup === vmResourceGroup
      );
      
      vm.connectedAssets = compatibleStorage.map(sa => sa.id);
    });
  }

  private processCostData(result: any): any {
    // Process Azure cost data into our expected format
    const costByService: Record<string, number> = {};
    const costByRegion: Record<string, number> = {};
    let totalCost = 0;

    if (result.rows) {
      for (const row of result.rows) {
        const serviceType = row[0] as string;
        const cost = parseFloat(row[1] as string) || 0;
        const region = row[2] as string || 'unknown';
        
        costByService[serviceType] = (costByService[serviceType] || 0) + cost;
        costByRegion[region] = (costByRegion[region] || 0) + cost;
        totalCost += cost;
      }
    }

    return {
      totalCost,
      costByProvider: { Azure: totalCost },
      costByService,
      costByRegion,
      monthlyTrend: [
        { month: new Date().toISOString().slice(0, 7), cost: totalCost }
      ]
    };
  }

  private mapAzureRegion(azureRegion: string): string {
    const regionMap: Record<string, string> = {
      'eastus': 'East US',
      'westus': 'West US',
      'centralus': 'Central US',
      'eastus2': 'East US 2',
      'westus2': 'West US 2',
      'westeurope': 'West Europe',
      'northeurope': 'North Europe',
      'southeastasia': 'Southeast Asia',
      'eastasia': 'East Asia'
    };
    return regionMap[azureRegion.toLowerCase()] || azureRegion;
  }

  private mapAzureStatus(status: string): 'running' | 'stopped' | 'terminated' | 'unknown' {
    if (status.includes('running')) return 'running';
    if (status.includes('stopped') || status.includes('deallocated')) return 'stopped';
    if (status.includes('terminated')) return 'terminated';
    return 'unknown';
  }

  private determineCriticality(tags: string[]): 'Low' | 'Medium' | 'High' {
    const tagString = tags.join(' ').toLowerCase();
    if (tagString.includes('production') || tagString.includes('critical')) return 'High';
    if (tagString.includes('staging') || tagString.includes('testing')) return 'Medium';
    return 'Low';
  }

  private extractOwnerFromTags(tags: { [key: string]: string } | undefined): string {
    if (!tags) return '';
    
    // Look for common owner tag patterns
    for (const [key, value] of Object.entries(tags)) {
      if (key.toLowerCase().includes('owner') || key.toLowerCase().includes('team')) {
        return value;
      }
    }
    
    return '';
  }
}
