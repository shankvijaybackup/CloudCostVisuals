# Multi-Cloud Asset Tracker - Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Cloud provider accounts (AWS, Azure, GCP)
- Read-only permissions for each cloud provider

### Installation

1. **Install dependencies**
```bash
npm install
```

2. **Set up environment variables**
```bash
# Copy the template
cp env-template.txt .env.local

# Edit with your credentials
nano .env.local
```

3. **Start the development server**
```bash
npm run dev
```

4. **Open your browser**
Navigate to `http://localhost:3000`

## 🔐 Cloud Provider Setup

### AWS Setup

1. **Create IAM User**
   - Go to AWS Management Console → IAM → Users → Create user
   - Select "Attach policies directly"
   - Add these policies:
     - `ReadOnlyAccess`
     - `AWSBillingReadOnlyAccess`

2. **Create Access Keys**
   - Go to IAM → Users → [Your User] → Security credentials
   - Click "Create access key"
   - Choose "Application running outside AWS"
   - Save the Access Key ID and Secret Access Key

3. **Add to .env.local**
```
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
```

### Azure Setup

1. **Create App Registration**
   - Go to Azure Portal → Azure Active Directory → App registrations → New registration
   - Give it a name (e.g., "Cloud Asset Tracker")
   - Select "Accounts in this organizational directory only"

2. **Add Client Secret**
   - Go to Certificates & secrets → New client secret
   - Save the secret value immediately (it won't be shown again)

3. **Set API Permissions**
   - Go to API permissions → Add a permission → Microsoft Graph → Application permissions
   - Add these permissions:
     - `User.Read.All` (for directory access)
     - `Directory.Read.All` (for resource access)

4. **Get Subscription and Tenant IDs**
   - Go to Subscriptions → Copy your Subscription ID
   - Go to Azure Active Directory → Overview → Copy your Tenant ID

5. **Add to .env.local**
```
AZURE_CLIENT_ID=00000000-0000-0000-0000-000000000000
AZURE_CLIENT_SECRET=your_client_secret_here
AZURE_TENANT_ID=00000000-0000-0000-0000-000000000000
AZURE_SUBSCRIPTION_ID=00000000-0000-0000-0000-000000000000
```

### Google Cloud Platform (GCP) Setup

1. **Create Service Account**
   - Go to GCP Console → IAM & Admin → Service Accounts → Create Service Account
   - Give it a name (e.g., "cloud-asset-tracker")
   - Grant these roles:
     - `Viewer` (for resource access)
     - `Billing Account Viewer` (for cost data)

2. **Create Service Account Key**
   - Go to the service account → Keys → Add Key → Create new key
   - Choose JSON format and download the file
   - Save it as `gcp-key.json` in your project root

3. **Get Project ID**
   - Go to Project Dashboard → Copy your Project ID

4. **Add to .env.local**
```
GCP_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=./gcp-key.json
```

## 🎯 Using the Application

### Scanning Cloud Resources

1. **Individual Cloud Scans**
   - Click "Scan AWS", "Scan Azure", or "Scan GCP"
   - Enter your credentials in the modal
   - Wait for the scan to complete

2. **Multi-Cloud Scan**
   - Click "Scan All Clouds"
   - Enter credentials for each provider when prompted
   - View unified results across all providers

3. **Demo Data**
   - Click "Load Demo Data" to see sample data without connecting to real clouds

### Features

- **Cost Dashboard**: View costs by provider, service, and region
- **Network Topology**: Interactive visualization of asset relationships
- **Provider Filtering**: Toggle visibility of different cloud providers
- **Asset Management**: Add, edit, and delete manual assets
- **CSV Export**: Download asset data for external analysis

## 🔧 Advanced Configuration

### Environment Variables

All available environment variables are documented in `env-template.txt`.

### Database Persistence (Optional)

To persist scan results, add a database connection:

```bash
# PostgreSQL (recommended)
DATABASE_URL=postgresql://username:password@localhost:5432/cloud_asset_tracker

# Or SQLite for development
DATABASE_URL=file:./dev.db
```

### Caching (Optional)

Add Redis for improved performance:

```bash
REDIS_URL=redis://localhost:6379
```

## 🛠️ Development

### Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main application component
│   └── api/
│       └── cloud/
│           ├── aws/scan/     # AWS scan endpoint
│           ├── azure/scan/   # Azure scan endpoint
│           └── gcp/scan/     # GCP scan endpoint
├── lib/
│   ├── aws-connector.ts      # AWS SDK integration
│   ├── azure-connector.ts    # Azure SDK integration
│   ├── gcp-connector.ts      # GCP SDK integration
│   └── mock-data.ts          # Demo data
└── types/
    └── index.ts              # TypeScript definitions
```

### Adding New Cloud Providers

1. Create a new connector in `src/lib/[provider]-connector.ts`
2. Create API route in `src/app/api/cloud/[provider]/scan/route.ts`
3. Update the main page to support the new provider
4. Add provider-specific credentials to the modal

### Customizing Asset Discovery

Each connector can be customized to fetch additional resources:

- **AWS**: Add RDS, Lambda, ECS, etc.
- **Azure**: Add App Service, SQL Database, etc.
- **GCP**: Add Cloud SQL, Cloud Run, etc.

## 🔍 Troubleshooting

### Common Issues

1. **AWS Access Denied**
   - Verify IAM permissions include `ReadOnlyAccess` and `AWSBillingReadOnlyAccess`
   - Check that access keys are correct and not expired

2. **Azure Authentication Failed**
   - Ensure the app registration has the correct API permissions
   - Verify tenant and subscription IDs are correct
   - Check that the client secret hasn't expired

3. **GCP Permission Denied**
   - Verify service account has `Viewer` and `Billing Account Viewer` roles
   - Check that the JSON key file is valid and accessible
   - Ensure the project ID is correct

4. **Cost Data Missing**
   - Some providers may take 24-48 hours to show cost data
   - Verify billing permissions are correctly configured

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=true
```

## 📚 API Reference

### Scan Endpoints

#### AWS
```
POST /api/cloud/aws/scan
Body: {
  accessKeyId: string,
  secretAccessKey: string,
  region: string
}
```

#### Azure
```
POST /api/cloud/azure/scan
Body: {
  clientId: string,
  clientSecret: string,
  tenantId: string,
  subscriptionId: string
}
```

#### GCP
```
POST /api/cloud/gcp/scan
Body: {
  projectId: string,
  keyFilename?: string,
  credentials?: string
}
```

### Response Format

```json
{
  "success": true,
  "assets": [...],
  "costSummary": {
    "totalCost": 123.45,
    "costByProvider": {...},
    "costByService": {...},
    "costByRegion": {...}
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the cloud provider setup guides
3. Check the browser console for error messages
4. Create an issue in the repository with details about your setup

---

**Happy Cloud Tracking!** 🎉
