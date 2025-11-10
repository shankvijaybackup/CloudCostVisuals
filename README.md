# Cloud Asset Tracker

A comprehensive cloud asset management tool that supports both manual input and auto-detection of assets across AWS, Azure, and GCP. Built with Next.js, TypeScript, and TailwindCSS.

## Features

### Core Functionality
- **Multi-cloud Support**: Track assets across AWS, Azure, and GCP
- **Auto-Discovery**: Automatically scan cloud providers for asset inventory
- **Manual Asset Entry**: Simple form-based asset creation
- **Cost Visualization**: Interactive charts showing costs by service and region
- **Data Persistence**: Local storage for saving asset data
- **CSV Export**: Export asset inventory and cost data to CSV format
- **Asset Management**: Add, view, and delete cloud assets
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Built with shadcn/ui components

### Enhanced Features
- **Real-time Cost Data**: Pull cost information from cloud provider APIs
- **Asset Status Tracking**: Monitor running/stopped/terminated resources
- **Provider-specific Styling**: Visual distinction between cloud providers
- **Secure Credential Management**: Modal-based credential input
- **Interactive Dashboards**: Bar charts and pie charts for cost analysis

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Cloud provider credentials (for auto-scanning feature)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cloud-asset-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

### Auto-Scanning Cloud Assets

1. **AWS Scanning**: Click "Scan AWS" and provide your Access Key ID and Secret Access Key
2. **Azure Scanning**: Click "Scan Azure" (placeholder - requires implementation)
3. **GCP Scanning**: Click "Scan GCP" (placeholder - requires implementation)

### Manual Asset Entry

1. Fill in the asset form with provider information, asset details, and tags
2. Click "Add Asset" to add it to your inventory
3. View all assets in the enhanced table below

### Cost Visualization

After scanning, view interactive charts showing:
- Cost breakdown by service (Bar chart)
- Cost distribution by region (Pie chart)

### Data Management

- **View Assets**: All assets appear in the enhanced table with status indicators
- **Delete Assets**: Use the delete button to remove unwanted assets
- **Export Data**: Click "Export CSV" to download your complete asset inventory

## AWS Setup for Auto-Scanning

To use the AWS auto-scanning feature:

1. Create an IAM user with the following permissions:
   - `ec2:DescribeInstances`
   - `ce:GetCostAndUsage`
   - `resource-groups:SearchResources`

2. Generate Access Key ID and Secret Access Key
3. Ensure Cost Explorer API is enabled in your AWS account
4. Use the credentials in the scanning modal

## Data Model

Each cloud asset contains:

### Core Fields
- **Provider**: AWS, Azure, GCP, or Manual
- **Asset Name**: Name of the cloud resource
- **Service**: Cloud service type (e.g., EC2, Storage, Compute)
- **Region**: Cloud region/location
- **Criticality**: Low, Medium, or High
- **Tags**: Array of tags for categorization

### Enhanced Fields (Auto-detected)
- **Cost This Month**: Current month's cost for the asset
- **Resource ID**: Native cloud provider resource identifier
- **Asset Type**: Specific instance type or SKU
- **Status**: running, stopped, or terminated
- **Last Updated**: Timestamp of last data refresh

## Technology Stack

- **Frontend**: Next.js 16 with TypeScript
- **Styling**: TailwindCSS
- **UI Components**: shadcn/ui
- **Charts**: Recharts
- **Cloud SDKs**: 
  - AWS SDK v3 (@aws-sdk/client-ec2, @aws-sdk/client-cost-explorer)
  - Azure SDK (planned)
  - Google Cloud SDK (planned)
- **Data Storage**: Browser localStorage
- **Export**: CSV generation and download

## Architecture

### Frontend Components
- **Main Dashboard**: Cloud scanning buttons and cost visualizations
- **Asset Table**: Enhanced table with status indicators and cost data
- **Credentials Modal**: Secure credential input for cloud providers
- **Manual Entry Form**: Form for adding assets manually

### Backend API Structure
```
/api/cloud/
  ├── aws/scan/     # AWS asset and cost scanning
  ├── azure/scan/   # Azure scanning (placeholder)
  └── gcp/scan/     # GCP scanning (placeholder)
```

### Cloud Connectors
- **AWS Connector**: EC2 instance discovery and Cost Explorer integration
- **Azure Connector**: Planned integration with Azure Resource Manager
- **GCP Connector**: Planned integration with Cloud Asset Inventory

## Future Enhancements

### Planned Features
- **Azure & GCP Integration**: Complete implementation of all cloud providers
- **Asset Relationships**: Visualize connected assets and dependencies
- **Historical Cost Data**: Track cost trends over time
- **Advanced Filtering**: Filter by cost thresholds, tags, and status
- **User Authentication**: Multi-user support with role-based access
- **Scheduled Scanning**: Automatic periodic asset discovery
- **Alerting**: Cost and usage anomaly detection
- **Export Formats**: JSON export and scheduled reports
- **Dark Mode**: UI theme for security teams

### Advanced Visualizations
- **Network Topology**: Visualize asset connections
- **Cost Trends**: Time-series cost analysis
- **Resource Utilization**: Performance metrics integration
- **Geographic Distribution**: Map-based asset visualization

## Security Considerations

- Credentials are only used for API calls and never stored
- Read-only permissions recommended for cloud access
- Local storage for asset data (consider database for production)
- HTTPS recommended for credential transmission

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
