# Cloud Asset Tracker

A comprehensive multi-cloud asset management and cost visualization platform with database persistence, real-time trend analysis, and advanced filtering capabilities. Built with Next.js, TypeScript, Prisma, and PostgreSQL.

## Features

### Core Functionality
- **Multi-cloud Support**: Track assets across AWS, Azure, and GCP
- **Database Persistence**: PostgreSQL with Prisma ORM for reliable data storage
- **Auto-Discovery**: Automatically scan cloud providers for asset inventory and cost data
- **Manual Asset Entry**: Simple form-based asset creation
- **Advanced Cost Visualization**: Interactive trend charts with multi-provider filtering
- **Real-time Cost Data**: Pull cost information from cloud provider APIs
- **CSV Export**: Export asset inventory and cost data to CSV format
- **Asset Management**: Add, view, edit, and delete cloud assets
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Built with shadcn/ui components and TailwindCSS

### Advanced Features
- **Cost Trend Analysis**: Historical cost trends with month-over-month percentage changes
- **Multi-provider Filtering**: Toggle between AWS, Azure, GCP in visualizations
- **Time Range Selection**: View costs for 3, 6, or 12-month periods
- **Performance Caching**: Redis caching for fast trend data loading
- **Interactive Dashboards**: Bar charts, pie charts, and line charts for cost analysis
- **Network Topology**: Visual asset relationship mapping with ReactFlow
- **Asset Status Tracking**: Monitor running/stopped/terminated resources
- **Provider-specific Styling**: Visual distinction between cloud providers
- **Secure Credential Management**: Modal-based credential input
- **Scheduled Scanning**: Automated daily/weekly cloud asset scans

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- PostgreSQL database (local or cloud)
- Redis (optional, for caching)
- Cloud provider credentials (for auto-scanning feature)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/shankvijaybackup/CloudCostVisuals.git
cd cloud-asset-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env-template.txt .env.local
# Edit .env.local with your database URL and cloud credentials
```

4. Set up the database:
```bash
# Update DATABASE_URL in .env.local with your PostgreSQL connection string
npx prisma migrate dev --name init_cloud_scan
npx prisma generate
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

### Database Setup & Scanning

1. **Database Configuration**: Set up PostgreSQL and run migrations
2. **Cloud Scanning**: Use "Scan All Clouds" for comprehensive multi-provider discovery
3. **Scheduled Scans**: Automatic daily/weekly scans persist data to database

### Cost Trend Analysis

The advanced trend visualization provides:

- **Multi-Provider Filtering**: Toggle AWS/Azure/GCP with button clicks
- **Time Range Selection**: Choose 3, 6, or 12-month historical views
- **Dual Metrics**: View both total costs and month-over-month percentage changes
- **Performance Caching**: Redis caching ensures fast loading of trend data

### Manual Asset Entry

1. Fill in the asset form with provider information, asset details, and tags
2. Click "Add Asset" to add it to your inventory
3. View all assets in the enhanced table below

### Cost Visualization

After scanning, view interactive charts showing:
- Cost breakdown by service (Bar chart)
- Cost distribution by region (Pie chart)
- Historical cost trends with filtering (Line chart)

### Data Management

- **View Assets**: All assets appear in the enhanced table with status indicators
- **Delete Assets**: Use the delete button to remove unwanted assets
- **Export Data**: Click "Export CSV" to download your complete asset inventory
- **Network Topology**: Visualize asset relationships with the interactive topology view

## Technology Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **TailwindCSS** - Utility-first CSS framework
- **shadcn/ui** - Modern component library
- **Recharts** - Chart visualization library
- **ReactFlow** - Interactive network diagrams

### Backend & Database
- **Next.js API Routes** - Serverless API endpoints
- **Prisma ORM** - Database toolkit for TypeScript
- **PostgreSQL** - Primary database for asset storage
- **Redis** - Caching layer for performance

### Cloud Integrations
- **AWS SDK** - EC2, Cost Explorer, Resource Groups
- **Azure SDK** - Compute, Cost Management, Resource Graph
- **Google Cloud SDK** - Compute Engine, Asset Inventory, Billing

### Infrastructure
- **Node.js 18+** - Runtime environment
- **npm** - Package management
- **Git** - Version control

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │────│  API Routes     │────│   Prisma ORM    │
│   (Frontend)    │    │  (/api/*)       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ReactFlow     │    │ Cloud Connectors │    │   PostgreSQL    │
│  (Topology)     │    │  (AWS/Azure/GCP) │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Recharts      │    │   Scheduler      │    │     Redis       │
│ (Trend Charts)  │    │ (Cron Jobs)      │    │   Cache         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

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
