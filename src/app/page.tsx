"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import ReactFlow, { MiniMap, Controls, Background, Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { CloudAsset, NewAsset, CostSummary } from '@/types';
import CostTrendChart from '@/components/CostTrendChart';

export default function CloudAssetTracker() {
  const [assets, setAssets] = useState<CloudAsset[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'AWS' | 'Azure' | 'GCP' | null>(null);
  const [error, setError] = useState('');
  const [showTopology, setShowTopology] = useState(false);
  const [providerFilters, setProviderFilters] = useState({
    AWS: true,
    Azure: true,
    GCP: true,
    Manual: true
  });
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [credentials, setCredentials] = useState({
    // AWS
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1',
    // Azure
    clientId: '',
    clientSecret: '',
    tenantId: '',
    subscriptionId: '',
    // GCP
    projectId: '',
    keyFilename: '',
    credentialsJson: '',
  });
  const [newAsset, setNewAsset] = useState<NewAsset>({
    provider: '',
    assetName: '',
    service: '',
    region: '',
    criticality: '',
    tags: '',
  });

  // Load assets from localStorage on component mount
  useEffect(() => {
    const savedAssets = localStorage.getItem('cloudAssets');
    if (savedAssets) {
      setAssets(JSON.parse(savedAssets));
    }
  }, []);

  // Save assets to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('cloudAssets', JSON.stringify(assets));
  }, [assets]);

  const handleAddAsset = () => {
    if (!newAsset.provider || !newAsset.assetName) return;
    const updatedAssets = [...assets, { 
      id: `manual-${Date.now()}`, 
      provider: 'Manual' as const,
      assetName: newAsset.assetName,
      service: newAsset.service,
      region: newAsset.region,
      criticality: newAsset.criticality as 'Low' | 'Medium' | 'High',
      tags: newAsset.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      lastUpdated: new Date().toISOString(),
      costThisMonth: 0, // Default cost for manual assets
      usageMetrics: {},
      connectedAssets: [],
    }];
    setAssets(updatedAssets);
    setNewAsset({ provider: '', assetName: '', service: '', region: '', criticality: '', tags: '' });
  };

  const handleDeleteAsset = (id: string) => {
    const updatedAssets = assets.filter(asset => asset.id !== id);
    setAssets(updatedAssets);
  };

  const handleInputChange = (key: keyof NewAsset, value: string) => {
    setNewAsset({ ...newAsset, [key]: value });
  };

  const handleExportCSV = () => {
    const csv = [
      ['ID', 'Provider', 'Asset Name', 'Service', 'Region', 'Criticality', 'Tags', 'Cost This Month', 'Status', 'Connections'],
      ...assets.map(a => [
        a.id, 
        a.provider, 
        a.assetName, 
        a.service, 
        a.region, 
        a.criticality, 
        a.tags.join(';'), 
        a.costThisMonth ? a.costThisMonth.toString() : '',
        a.status || '',
        a.connectedAssets ? a.connectedAssets.join(';') : ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cloud_assets.csv';
    a.click();
  };

  const handleScanCloud = (provider: 'AWS' | 'Azure' | 'GCP') => {
    setSelectedProvider(provider);
    setShowCredentialsModal(true);
  };

  const executeCloudScan = async () => {
    if (!selectedProvider) return;
    
    setIsScanning(true);
    setShowCredentialsModal(false);
    
    try {
      let endpoint = '';
      let requestBody = {};

      switch (selectedProvider) {
        case 'AWS':
          endpoint = '/api/cloud/aws/scan';
          requestBody = {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            region: credentials.region
          };
          break;
        case 'Azure':
          endpoint = '/api/cloud/azure/scan';
          requestBody = {
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            tenantId: credentials.tenantId,
            subscriptionId: credentials.subscriptionId
          };
          break;
        case 'GCP':
          endpoint = '/api/cloud/gcp/scan';
          requestBody = {
            projectId: credentials.projectId,
            keyFilename: credentials.keyFilename,
            credentials: credentials.credentialsJson
          };
          break;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.assets || !Array.isArray(data.assets)) {
        throw new Error('Invalid response format from cloud scan API');
      }

      // Add cost data to assets
      const assetsWithCost = data.assets.map((asset: CloudAsset) => ({
        ...asset,
        costThisMonth: asset.costThisMonth || 0,
        connectedAssets: asset.connectedAssets || []
      }));

      setAssets(prevAssets => [...prevAssets, ...assetsWithCost]);
      
      // Update cost summary if available
      if (data.costSummary) {
        setCostSummary(data.costSummary);
      }

    } catch (error) {
      console.error('Cloud scan error:', error);
      setError(`Failed to scan ${selectedProvider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Fallback to mock data
      const fallbackAssets = [
        {
          id: `${selectedProvider.toLowerCase()}-mock-1`,
          provider: selectedProvider,
          assetName: `${selectedProvider.toLowerCase()}-web-server-prod`,
          service: selectedProvider === 'AWS' ? 'EC2' : selectedProvider === 'Azure' ? 'Virtual Machine' : 'Compute Engine',
          region: selectedProvider === 'AWS' ? 'us-east-1' : selectedProvider === 'Azure' ? 'eastus' : 'us-central1',
          criticality: 'High' as const,
          tags: ['production', 'web', 'critical'],
          owner: 'devops-team',
          notes: 'Fallback mock data - API connection failed',
          resourceId: `${selectedProvider.toLowerCase()}-mock-1234567890`,
          assetType: selectedProvider === 'AWS' ? 't3.medium' : selectedProvider === 'Azure' ? 'Standard_B2s' : 'e2-medium',
          status: 'running' as const,
          costThisMonth: selectedProvider === 'AWS' ? 54.12 : selectedProvider === 'Azure' ? 61.32 : 42.90,
          lastUpdated: new Date().toISOString(),
          usageMetrics: {},
          connectedAssets: [],
        },
        {
          id: `${selectedProvider.toLowerCase()}-mock-2`,
          provider: selectedProvider,
          assetName: `${selectedProvider.toLowerCase()}-storage-bucket`,
          service: selectedProvider === 'AWS' ? 'S3' : selectedProvider === 'Azure' ? 'Storage Account' : 'Cloud Storage',
          region: selectedProvider === 'AWS' ? 'us-east-1' : selectedProvider === 'Azure' ? 'westeurope' : 'asia-southeast1',
          criticality: 'Medium' as const,
          tags: ['storage', 'backup'],
          owner: 'devops-team',
          notes: 'Fallback mock data - API connection failed',
          resourceId: `${selectedProvider.toLowerCase()}-bucket-mock-logs`,
          assetType: selectedProvider === 'AWS' ? 'Standard' : selectedProvider === 'Azure' ? 'Standard_LRS' : 'Standard Storage',
          status: 'running' as const,
          costThisMonth: selectedProvider === 'AWS' ? 23.45 : selectedProvider === 'Azure' ? 15.78 : 10.10,
          lastUpdated: new Date().toISOString(),
          usageMetrics: {},
          connectedAssets: [],
        }
      ];
      
      setAssets(prevAssets => [...prevAssets, ...fallbackAssets]);
      
      alert(`Could not connect to ${selectedProvider} API. Displaying fallback mock data for demonstration.`);
    } finally {
      setIsScanning(false);
      setSelectedProvider(null);
    }
  };

  const loadDemoData = () => {
    const demoAssets = [
      {
        id: 'demo-aws-1',
        provider: 'AWS' as const,
        assetName: 'web-server-prod-01',
        service: 'EC2',
        region: 'us-east-1',
        criticality: 'High' as const,
        tags: ['production', 'web', 'critical'],
        owner: 'devops-team',
        notes: 'Demo data for showcase',
        resourceId: 'i-demo1234567890',
        assetType: 't3.medium',
        status: 'running' as const,
        costThisMonth: 54.12,
        lastUpdated: new Date().toISOString(),
        usageMetrics: {},
        connectedAssets: ['demo-aws-2', 'demo-aws-3'],
      },
      {
        id: 'demo-aws-2',
        provider: 'AWS' as const,
        assetName: 'storage-bucket-logs',
        service: 'S3',
        region: 'us-east-1',
        criticality: 'Medium' as const,
        tags: ['storage', 'backup'],
        owner: 'devops-team',
        notes: 'Demo data for showcase',
        resourceId: 'bucket-demo-logs',
        assetType: 'Standard',
        status: 'running' as const,
        costThisMonth: 23.45,
        lastUpdated: new Date().toISOString(),
        usageMetrics: {},
        connectedAssets: [],
      },
      {
        id: 'demo-aws-3',
        provider: 'AWS' as const,
        assetName: 'database-prod-main',
        service: 'RDS',
        region: 'us-west-2',
        criticality: 'High' as const,
        tags: ['database', 'production'],
        owner: 'database-team',
        notes: 'Demo data for showcase',
        resourceId: 'db-demo-instance-1',
        assetType: 'db.t3.medium',
        status: 'running' as const,
        costThisMonth: 78.90,
        lastUpdated: new Date().toISOString(),
        usageMetrics: {},
        connectedAssets: ['demo-aws-2'],
      },
      {
        id: 'demo-azure-1',
        provider: 'Azure' as const,
        assetName: 'vm-web-prod-01',
        service: 'Virtual Machine',
        region: 'eastus',
        criticality: 'High' as const,
        tags: ['production', 'web'],
        owner: 'devops-team',
        notes: 'Demo data for showcase',
        resourceId: '/subscriptions/demo/resourceGroups/web/providers/Microsoft.Compute/virtualMachines/web-prod-01',
        assetType: 'Standard_B2s',
        status: 'running' as const,
        costThisMonth: 61.32,
        lastUpdated: new Date().toISOString(),
        usageMetrics: {},
        connectedAssets: ['demo-azure-2'],
      },
      {
        id: 'demo-azure-2',
        provider: 'Azure' as const,
        assetName: 'storage-account-backup',
        service: 'Storage Account',
        region: 'westeurope',
        criticality: 'Medium' as const,
        tags: ['storage', 'backup'],
        owner: 'devops-team',
        notes: 'Demo data for showcase',
        resourceId: '/subscriptions/demo/resourceGroups/storage/providers/Microsoft.Storage/storageAccounts/backup',
        assetType: 'Standard_LRS',
        status: 'running' as const,
        costThisMonth: 15.78,
        lastUpdated: new Date().toISOString(),
        usageMetrics: {},
        connectedAssets: [],
      },
      {
        id: 'demo-gcp-1',
        provider: 'GCP' as const,
        assetName: 'compute-engine-prod',
        service: 'Compute Engine',
        region: 'us-central1',
        criticality: 'High' as const,
        tags: ['production', 'compute'],
        owner: 'devops-team',
        notes: 'Demo data for showcase',
        resourceId: 'projects/demo/zones/us-central1-a/instances/compute-prod-01',
        assetType: 'e2-medium',
        status: 'running' as const,
        costThisMonth: 42.90,
        lastUpdated: new Date().toISOString(),
        usageMetrics: {},
        connectedAssets: ['demo-gcp-2'],
      },
      {
        id: 'demo-gcp-2',
        provider: 'GCP' as const,
        assetName: 'cloud-storage-bucket',
        service: 'Cloud Storage',
        region: 'asia-southeast1',
        criticality: 'Medium' as const,
        tags: ['storage', 'backup'],
        owner: 'devops-team',
        notes: 'Demo data for showcase',
        resourceId: 'projects/demo/buckets/backup-storage',
        assetType: 'Standard Storage',
        status: 'running' as const,
        costThisMonth: 10.10,
        lastUpdated: new Date().toISOString(),
        usageMetrics: {},
        connectedAssets: [],
      },
    ];
    
    const demoCostSummary = {
      totalCost: 286.67,
      costByProvider: { 
        AWS: 156.47,
        Azure: 77.10,
        GCP: 53.00
      },
      costByService: {
        'EC2': 54.12,
        'S3': 23.45,
        'RDS': 78.90,
        'Virtual Machine': 61.32,
        'Storage Account': 15.78,
        'Compute Engine': 42.90,
        'Cloud Storage': 10.10,
      },
      costByRegion: {
        'us-east-1': 77.57,
        'us-west-2': 78.90,
        'eastus': 61.32,
        'westeurope': 15.78,
        'us-central1': 42.90,
        'asia-southeast1': 10.10,
      },
      monthlyTrend: [
        { month: '2024-10', cost: 265.23 },
        { month: '2024-11', cost: 286.67 },
      ],
    };
    
    setAssets(prevAssets => [...prevAssets, ...demoAssets]);
    setCostSummary(demoCostSummary);
  };

  const generateTopologyNodes = (): Node[] => {
    // Filter assets based on provider filters
    const filteredAssets = assets.filter(asset => providerFilters[asset.provider]);
    
    // Group filtered assets by provider
    const assetsByProvider = filteredAssets.reduce((groups, asset) => {
      if (!groups[asset.provider]) {
        groups[asset.provider] = [];
      }
      groups[asset.provider].push(asset);
      return groups;
    }, {} as Record<string, CloudAsset[]>);

    // Provider group positions with spacing
    const providerPositions = {
      AWS: { x: 50, y: 50 },
      Azure: { x: 450, y: 50 },
      GCP: { x: 850, y: 50 },
      Manual: { x: 1250, y: 50 }
    };

    const nodes: Node[] = [];
    
    // Add provider label nodes
    Object.entries(assetsByProvider).forEach(([provider, providerAssets]) => {
      const position = providerPositions[provider as keyof typeof providerPositions] || { x: 0, y: 0 };
      
      // Add provider cluster label
      nodes.push({
        id: `label-${provider}`,
        position: { x: position.x + 75, y: position.y - 30 },
        data: { 
          label: (
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
              {provider}
              <div style={{ fontSize: '10px', color: '#666', fontWeight: 'normal' }}>
                {providerAssets.length} assets
              </div>
            </div>
          )
        },
        style: { 
          background: 'transparent',
          border: 'none',
          width: 150,
          height: 40,
        },
        draggable: false,
      });

      // Add asset nodes within provider cluster
      providerAssets.forEach((asset, index) => {
        const providerColors = {
          AWS: { bg: '#fef3c7', border: '#f59e0b' },
          Azure: { bg: '#dbeafe', border: '#3b82f6' },
          GCP: { bg: '#d1fae5', border: '#10b981' },
          Manual: { bg: '#f3f4f6', border: '#6b7280' }
        };
        
        const colors = providerColors[asset.provider] || providerColors.Manual;
        
        nodes.push({
          id: asset.id,
          position: { 
            x: position.x + (index % 2) * 180, 
            y: position.y + Math.floor(index / 2) * 120 + 20
          },
          data: { 
            label: (
              <div style={{ textAlign: 'center', fontSize: '12px' }}>
                <div style={{ fontWeight: 'bold', color: colors.border }}>
                  {asset.service}
                </div>
                <div style={{ fontSize: '10px', color: '#666' }}>
                  {asset.assetName}
                </div>
                <div style={{ fontSize: '9px', color: '#888' }}>
                  {asset.region}
                </div>
                <div style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>
                  ${asset.costThisMonth?.toFixed(2) || '0.00'}
                </div>
              </div>
            )
          },
          style: { 
            background: colors.bg,
            border: `2px solid ${colors.border}`,
            borderRadius: 8,
            padding: 8,
            width: 160,
            height: 90,
          }
        });
      });
    });

    return nodes;
  };

  const generateTopologyEdges = (): Edge[] => {
    // Filter assets based on provider filters
    const filteredAssets = assets.filter(asset => providerFilters[asset.provider]);
    
    return filteredAssets.flatMap(asset =>
      asset.connectedAssets?.map(targetId => {
        // Only include edge if target asset is also visible
        const targetAsset = assets.find(a => a.id === targetId);
        if (!targetAsset || !providerFilters[targetAsset.provider]) {
          return null as any;
        }
        
        return {
          id: `${asset.id}-${targetId}`,
          source: asset.id,
          target: targetId,
          animated: true,
          style: { stroke: '#3b82f6', strokeWidth: 2 },
          markerEnd: { type: 'arrowclosed' as const, color: '#3b82f6' }
        };
      }).filter((edge): edge is Edge => edge !== null) || []
    );
  };

  const handleScanAllClouds = async () => {
    setIsScanning(true);
    setError('');
    setLastScan(new Date().toISOString());
    
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providers: ['aws', 'azure', 'gcp']
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        console.warn('Some providers failed:', data.errors);
        setError(`Partial success: ${data.errors?.join(', ') || 'Some providers failed'}`);
      }

      // Transform assets to our CloudAsset format
      const cloudAssets = data.assets.map((asset: any) => ({
        id: asset.id,
        provider: asset.provider,
        assetName: asset.service + '-' + (asset.resourceId || asset.id.split('/').pop()),
        service: asset.service,
        region: asset.region,
        criticality: 'Medium' as const, // Default criticality
        tags: asset.tags || [],
        owner: 'system',
        notes: `Auto-discovered via ${asset.provider} scan`,
        resourceId: asset.resourceId || asset.id,
        assetType: asset.resourceType || asset.service,
        status: 'running' as const,
        costThisMonth: 0, // Cost is handled at summary level
        lastUpdated: new Date().toISOString(),
        usageMetrics: {
          discoveredAt: data.lastScan,
          source: 'api-scan'
        },
        connectedAssets: []
      }));

      setAssets(prevAssets => [...prevAssets, ...cloudAssets]);
      setCostSummary(data.costSummary);

    } catch (error) {
      console.error('Multi-cloud scan error:', error);
      setError(`Failed to scan clouds: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Fallback to demo data
      loadDemoData();
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Cloud Asset Tracker</h1>

      {/* Cloud Scanning Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Cloud Scanning</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">Automatically fetch cloud resources and their monthly costs via provider APIs.</p>
          <div className="flex gap-3 flex-wrap mb-4">
            <Button 
              onClick={handleScanAllClouds} 
              disabled={isScanning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isScanning ? 'Scanning All Clouds...' : 'Scan All Clouds'}
            </Button>
            <p className="text-gray-500 text-xs mt-1">
              Last scan: {lastScan ? new Date(lastScan).toLocaleString() : "Never"}
            </p>
            <Button 
              onClick={() => handleScanCloud('AWS')} 
              disabled={isScanning}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isScanning ? 'Scanning...' : 'Scan AWS'}
            </Button>
            <Button 
              onClick={() => handleScanCloud('Azure')} 
              disabled={isScanning}
              variant="outline"
            >
              {isScanning ? 'Scanning...' : 'Scan Azure'}
            </Button>
            <Button 
              onClick={() => handleScanCloud('GCP')} 
              disabled={isScanning}
              variant="outline"
            >
              {isScanning ? 'Scanning...' : 'Scan GCP'}
            </Button>
            <Button 
              onClick={loadDemoData} 
              disabled={isScanning}
              variant="secondary"
            >
              Load Demo Data
            </Button>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <p className="text-gray-700 text-sm">Total Assets: {assets.length}</p>
            {costSummary && (
              <p className="text-gray-700 text-sm font-medium">
                Total Cost: ${costSummary.totalCost.toFixed(2)}
              </p>
            )}
            {assets.length > 0 && (
              <Button 
                onClick={() => setShowTopology(!showTopology)} 
                variant="outline"
                size="sm"
              >
                {showTopology ? 'Hide Topology' : 'Show Topology'}
              </Button>
            )}
          </div>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </CardContent>
      </Card>

      {/* Cost Summary Dashboard */}
      {costSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Cost by Service</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={Object.entries(costSummary.costByService).map(([service, cost]) => ({ service, cost: parseFloat(cost.toFixed(2)) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="service" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`$${value}`, 'Cost']} />
                  <Bar dataKey="cost" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost by Region</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={Object.entries(costSummary.costByRegion).map(([region, cost]) => ({ name: region, value: parseFloat(cost.toFixed(2)) }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {Object.entries(costSummary.costByRegion).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042'][index % 4]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`$${value}`, 'Cost']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cost Trend Chart */}
      <CostTrendChart />

      {/* Network Topology Visualization */}
      {showTopology && assets.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Network Topology (Grouped by Provider)</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Provider Filter Controls */}
            <div className="mb-4 flex items-center gap-4">
              <span className="text-sm font-medium">Filter by Provider:</span>
              <div className="flex gap-2">
                {Object.entries(providerFilters).map(([provider, isEnabled]) => (
                  <Button
                    key={provider}
                    onClick={() => setProviderFilters(prev => ({
                      ...prev,
                      [provider]: !prev[provider as keyof typeof prev]
                    }))}
                    variant={isEnabled ? "default" : "outline"}
                    size="sm"
                    className={`${
                      provider === 'AWS' ? 'bg-amber-500 hover:bg-amber-600 border-amber-500' :
                      provider === 'Azure' ? 'bg-blue-500 hover:bg-blue-600 border-blue-500' :
                      provider === 'GCP' ? 'bg-green-500 hover:bg-green-600 border-green-500' :
                      'bg-gray-500 hover:bg-gray-600 border-gray-500'
                    } ${isEnabled ? 'text-white' : 'text-gray-700'}`}
                  >
                    {provider}
                  </Button>
                ))}
              </div>
              <span className="text-xs text-gray-500">
                {Object.values(providerFilters).filter(Boolean).length} of {Object.keys(providerFilters).length} providers visible
              </span>
            </div>
            
            <div style={{ width: '100%', height: 600, border: '1px solid #ddd', borderRadius: '8px' }}>
              <ReactFlow 
                nodes={generateTopologyNodes()} 
                edges={generateTopologyEdges()} 
                fitView
                attributionPosition="bottom-left"
              >
                <MiniMap 
                  nodeColor={(node) => {
                    const providerColors = {
                      AWS: '#f59e0b',
                      Azure: '#3b82f6', 
                      GCP: '#10b981',
                      Manual: '#6b7280'
                    };
                    const asset = assets.find(a => a.id === node.id);
                    return providerColors[asset?.provider || 'Manual'];
                  }}
                  position="top-right"
                />
                <Controls />
                <Background gap={16} color="#e5e7eb" />
              </ReactFlow>
            </div>
            <div className="mt-4 flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-amber-100 border-2 border-amber-500 rounded"></div>
                <span>AWS</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 border-2 border-blue-500 rounded"></div>
                <span>Azure</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border-2 border-green-500 rounded"></div>
                <span>GCP</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-100 border-2 border-gray-500 rounded"></div>
                <span>Manual</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Asset Entry */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add New Asset (Manual)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Select onValueChange={(val) => handleInputChange('provider', val)} value={newAsset.provider}>
            <SelectTrigger>
              <SelectValue placeholder="Select Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AWS">AWS</SelectItem>
              <SelectItem value="Azure">Azure</SelectItem>
              <SelectItem value="GCP">GCP</SelectItem>
            </SelectContent>
          </Select>

          <Input placeholder="Asset Name" value={newAsset.assetName} onChange={(e) => handleInputChange('assetName', e.target.value)} />
          <Input placeholder="Service" value={newAsset.service} onChange={(e) => handleInputChange('service', e.target.value)} />
          <Input placeholder="Region" value={newAsset.region} onChange={(e) => handleInputChange('region', e.target.value)} />

          <Select onValueChange={(val) => handleInputChange('criticality', val)} value={newAsset.criticality}>
            <SelectTrigger>
              <SelectValue placeholder="Criticality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
            </SelectContent>
          </Select>

          <Input placeholder="Tags (comma-separated)" value={newAsset.tags} onChange={(e) => handleInputChange('tags', e.target.value)} />

          <div className="col-span-2 md:col-span-3 flex justify-end mt-2">
            <Button onClick={handleAddAsset}>Add Asset</Button>
          </div>
        </CardContent>
      </Card>

      {/* Assets Table */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-semibold">Tracked Assets ({assets.length})</h2>
        <Button variant="outline" onClick={handleExportCSV}>Export CSV</Button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              {['Provider', 'Asset Name', 'Service', 'Region', 'Criticality', 'Tags', 'Cost/Month', 'Status', 'Connections', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map(asset => (
              <tr key={asset.id} className="border-t">
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    asset.provider === 'AWS' ? 'bg-orange-100 text-orange-800' :
                    asset.provider === 'Azure' ? 'bg-blue-100 text-blue-800' :
                    asset.provider === 'GCP' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {asset.provider}
                  </span>
                </td>
                <td className="px-4 py-2">{asset.assetName}</td>
                <td className="px-4 py-2">{asset.service}</td>
                <td className="px-4 py-2">{asset.region}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    asset.criticality === 'High' ? 'bg-red-100 text-red-800' :
                    asset.criticality === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {asset.criticality}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {asset.tags.slice(0, 2).map((tag, index) => (
                      <span key={index} className="px-1 py-0.5 bg-gray-100 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                    {asset.tags.length > 2 && (
                      <span className="px-1 py-0.5 bg-gray-100 rounded text-xs">
                        +{asset.tags.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">
                  {asset.costThisMonth ? `$${asset.costThisMonth.toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-2">
                  {asset.status && (
                    <span className={`px-2 py-1 rounded text-xs ${
                      asset.status === 'running' ? 'bg-green-100 text-green-800' :
                      asset.status === 'stopped' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {asset.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {asset.connectedAssets && asset.connectedAssets.length > 0 ? (
                    <div className="text-xs">
                      {asset.connectedAssets.slice(0, 2).map(connId => {
                        const connAsset = assets.find(a => a.id === connId);
                        return connAsset ? (
                          <div key={connId} className="text-blue-600">
                            {connAsset.provider}: {connAsset.service}
                          </div>
                        ) : null;
                      })}
                      {asset.connectedAssets.length > 2 && (
                        <div className="text-gray-500">+{asset.connectedAssets.length - 2} more</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => handleDeleteAsset(asset.id)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {assets.length === 0 && (
              <tr><td colSpan={10} className="text-center p-4 text-gray-500">No assets added yet. Scan your cloud or add assets manually.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Credentials Modal */}
      {showCredentialsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Enter {selectedProvider} Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedProvider === 'AWS' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Access Key ID</label>
                    <Input
                      type="password"
                      value={credentials.accessKeyId}
                      onChange={(e) => setCredentials({...credentials, accessKeyId: e.target.value})}
                      placeholder="Enter AWS Access Key ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Secret Access Key</label>
                    <Input
                      type="password"
                      value={credentials.secretAccessKey}
                      onChange={(e) => setCredentials({...credentials, secretAccessKey: e.target.value})}
                      placeholder="Enter AWS Secret Access Key"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Region</label>
                    <Input
                      value={credentials.region}
                      onChange={(e) => setCredentials({...credentials, region: e.target.value})}
                      placeholder="us-east-1"
                    />
                  </div>
                </>
              )}
              
              {selectedProvider === 'Azure' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Client ID</label>
                    <Input
                      type="password"
                      value={credentials.clientId}
                      onChange={(e) => setCredentials({...credentials, clientId: e.target.value})}
                      placeholder="Enter Azure Application Client ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Client Secret</label>
                    <Input
                      type="password"
                      value={credentials.clientSecret}
                      onChange={(e) => setCredentials({...credentials, clientSecret: e.target.value})}
                      placeholder="Enter Azure Client Secret"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Tenant ID</label>
                    <Input
                      value={credentials.tenantId}
                      onChange={(e) => setCredentials({...credentials, tenantId: e.target.value})}
                      placeholder="Enter Azure Tenant ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Subscription ID</label>
                    <Input
                      value={credentials.subscriptionId}
                      onChange={(e) => setCredentials({...credentials, subscriptionId: e.target.value})}
                      placeholder="Enter Azure Subscription ID"
                    />
                  </div>
                </>
              )}
              
              {selectedProvider === 'GCP' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Project ID</label>
                    <Input
                      value={credentials.projectId}
                      onChange={(e) => setCredentials({...credentials, projectId: e.target.value})}
                      placeholder="Enter GCP Project ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Service Account Key (JSON)</label>
                    <textarea
                      className="w-full p-2 border rounded-md text-sm font-mono"
                      rows={6}
                      value={credentials.credentialsJson}
                      onChange={(e) => setCredentials({...credentials, credentialsJson: e.target.value})}
                      placeholder='{"type": "service_account", "project_id": "..."}'
                    />
                  </div>
                  <div className="text-xs text-gray-600">
                    <p>Or provide key file path:</p>
                    <Input
                      value={credentials.keyFilename}
                      onChange={(e) => setCredentials({...credentials, keyFilename: e.target.value})}
                      placeholder="./gcp-key.json"
                    />
                  </div>
                </>
              )}
              
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCredentialsModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={executeCloudScan}
                  disabled={
                    (selectedProvider === 'AWS' && (!credentials.accessKeyId || !credentials.secretAccessKey)) ||
                    (selectedProvider === 'Azure' && (!credentials.clientId || !credentials.clientSecret || !credentials.tenantId || !credentials.subscriptionId)) ||
                    (selectedProvider === 'GCP' && (!credentials.projectId))
                  }
                >
                  Scan {selectedProvider}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
