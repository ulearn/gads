/**
 * Complete MCP Server with Root Endpoint - Version 12
 * /home/hub/public_html/gads/scripts/mcp/mcp-server.js
 * 
 * FIXED: Added root endpoint for Claude Desktop connection
 * FOCUS: Live Google Ads API integration
 */

const express = require('express');
const { GoogleAdsApi, enums } = require('google-ads-api');

// Load environment variables
require('dotenv').config();

/**
 * MCP Server Implementation - Live Google Ads API
 */
class MCPServer {
  constructor() {
    this.tools = [
      {
        name: "get_live_campaigns",
        description: "Get live Google Ads campaign data directly from Google Ads API",
        inputSchema: {
          type: "object",
          properties: {
            account_id: {
              type: "string",
              description: "Google Ads account ID (default: test account)",
              default: "5411183629"
            }
          }
        }
      },
      {
        name: "get_campaign_metrics",
        description: "Get campaign performance metrics from Google Ads API",
        inputSchema: {
          type: "object",
          properties: {
            account_id: {
              type: "string", 
              description: "Google Ads account ID",
              default: "5411183629"
            },
            days: {
              type: "number",
              description: "Number of days to analyze (default: 30)",
              default: 30
            }
          }
        }
      },
      {
        name: "get_keyword_data",
        description: "Get keyword performance data from Google Ads API",
        inputSchema: {
          type: "object",
          properties: {
            account_id: {
              type: "string",
              description: "Google Ads account ID", 
              default: "5411183629"
            },
            campaign_id: {
              type: "string",
              description: "Specific campaign ID to analyze"
            }
          }
        }
      },
      {
        name: "get_audience_data",
        description: "Get audience targeting and performance from Google Ads API",
        inputSchema: {
          type: "object",
          properties: {
            account_id: {
              type: "string",
              description: "Google Ads account ID",
              default: "5411183629"
            }
          }
        }
      },
      {
        name: "test_connection",
        description: "Test Google Ads API connection and account access",
        inputSchema: {
          type: "object",
          properties: {
            account_id: {
              type: "string",
              description: "Google Ads account ID to test",
              default: "5411183629"
            }
          }
        }
      }
    ];

    // Initialize Google Ads API client
    this.googleAdsClient = new GoogleAdsApi({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      developer_token: process.env.GAdsAPI
    });
  }

  async listTools() {
    return {
      tools: this.tools
    };
  }

  async callTool(name, arguments_) {
    try {
      switch (name) {
        case "get_live_campaigns":
          return await this.getLiveCampaigns(arguments_);
        case "get_campaign_metrics":
          return await this.getCampaignMetrics(arguments_);
        case "get_keyword_data":
          return await this.getKeywordData(arguments_);
        case "get_audience_data":
          return await this.getAudienceData(arguments_);
        case "test_connection":
          return await this.testConnection(arguments_);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error executing ${name}: ${error.message}`
        }]
      };
    }
  }

  async testConnection({ account_id = "5411183629" }) {
    try {
      const customer = this.googleAdsClient.Customer({
        customer_id: account_id,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        login_customer_id: process.env.GADS_TEST_MCC_ID
      });

      const query = `
        SELECT customer.id, customer.descriptive_name, customer.test_account
        FROM customer
      `;

      const results = await customer.query(query);

      return {
        content: [{
          type: "text",
          text: `# Google Ads API Connection Test

## Account Details
- **Account ID:** ${account_id}
- **Status:** Connected successfully
- **Account Name:** ${results[0]?.customer?.descriptive_name || 'Unknown'}
- **Test Account:** ${results[0]?.customer?.test_account ? 'Yes' : 'No'}
- **MCC ID:** ${process.env.GADS_TEST_MCC_ID}

## Connection Status
✅ **Google Ads API:** Connected
✅ **Authentication:** Valid refresh token
✅ **MCC Access:** Working

Ready for live Google Ads analysis!
`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `# Google Ads API Connection Test

## Error
❌ **Connection Failed:** ${error.message}

## Troubleshooting
- Check refresh token validity
- Verify MCC account access
- Confirm account ID permissions
- Review developer token status
`
        }]
      };
    }
  }

  async getLiveCampaigns({ account_id = "5411183629" }) {
    try {
      const customer = this.googleAdsClient.Customer({
        customer_id: account_id,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        login_customer_id: process.env.GADS_TEST_MCC_ID
      });

      const query = `
        SELECT 
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.campaign_budget,
          campaign.advertising_channel_type
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        ORDER BY campaign.name
      `;

      const results = await customer.query(query);

      return {
        content: [{
          type: "text",
          text: `# Live Google Ads Campaigns

## Account: ${account_id}
## Total Campaigns: ${results.length}

${results.map(row => {
  const campaign = row.campaign;
  return `
**${campaign.name}**
- ID: ${campaign.id}
- Status: ${campaign.status}
- Type: ${campaign.advertising_channel_type}
- Budget: ${campaign.campaign_budget}
`;
}).join('')}
`
        }]
      };

    } catch (error) {
      throw new Error(`Failed to get live campaigns: ${error.message}`);
    }
  }

  async getCampaignMetrics({ account_id = "5411183629", days = 30 }) {
    try {
      const customer = this.googleAdsClient.Customer({
        customer_id: account_id,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        login_customer_id: process.env.GADS_TEST_MCC_ID
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const dateRange = startDate.toISOString().split('T')[0];

      const query = `
        SELECT 
          campaign.id,
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions
        FROM campaign
        WHERE segments.date DURING LAST_${days}_DAYS
          AND campaign.status != 'REMOVED'
      `;

      const results = await customer.query(query);

      // Calculate totals
      const totals = results.reduce((acc, row) => {
        const metrics = row.metrics;
        acc.impressions += parseInt(metrics.impressions) || 0;
        acc.clicks += parseInt(metrics.clicks) || 0;
        acc.cost += (parseInt(metrics.cost_micros) || 0) / 1000000;
        acc.conversions += parseFloat(metrics.conversions) || 0;
        return acc;
      }, { impressions: 0, clicks: 0, cost: 0, conversions: 0 });

      return {
        content: [{
          type: "text",
          text: `# Live Google Ads Campaign Metrics (${days} days)

## Summary Totals
- **Total Impressions:** ${totals.impressions.toLocaleString()}
- **Total Clicks:** ${totals.clicks.toLocaleString()}
- **Total Cost:** €${totals.cost.toFixed(2)}
- **Total Conversions:** ${totals.conversions.toFixed(1)}
- **Overall CTR:** ${totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : 0}%
- **Average CPC:** €${totals.clicks > 0 ? (totals.cost / totals.clicks).toFixed(2) : 0}

## Campaign Breakdown
${results.slice(0, 10).map(row => {
  const campaign = row.campaign;
  const metrics = row.metrics;
  const cost = (parseInt(metrics.cost_micros) || 0) / 1000000;
  
  return `
**${campaign.name}**
- Impressions: ${parseInt(metrics.impressions) || 0}
- Clicks: ${parseInt(metrics.clicks) || 0}
- Cost: €${cost.toFixed(2)}
- CTR: ${parseFloat(metrics.ctr || 0).toFixed(2)}%
- CPC: €${parseFloat(metrics.average_cpc || 0).toFixed(2)}
- Conversions: ${parseFloat(metrics.conversions || 0).toFixed(1)}
`;
}).join('')}
`
        }]
      };

    } catch (error) {
      throw new Error(`Failed to get campaign metrics: ${error.message}`);
    }
  }

  async getKeywordData({ account_id = "5411183629", campaign_id = null }) {
    return {
      content: [{
        type: "text",
        text: `# Live Keyword Data

## Note
This tool will connect to Google Ads API to fetch real keyword performance data.

**Account:** ${account_id}
**Campaign:** ${campaign_id || 'All campaigns'}

Live keyword analysis requires implementing Google Ads keyword queries.
`
      }]
    };
  }

  async getAudienceData({ account_id = "5411183629" }) {
    return {
      content: [{
        type: "text",
        text: `# Live Audience Data

## Note  
This tool will connect to Google Ads API to fetch real audience targeting and performance data.

**Account:** ${account_id}

Live audience analysis requires implementing Google Ads audience queries.
`
      }]
    };
  }
}

/**
 * Create Express sub-app for MCP endpoints
 * FIXED: Added root endpoint for Claude Desktop connection
 */
function createMCPServer() {
  const app = express();
  const mcpServer = new MCPServer();

  app.use(express.json());

  // CORS headers for Claude Desktop
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // ROOT MCP ENDPOINT - REQUIRED FOR CLAUDE DESKTOP CONNECTION
  app.get('/', (req, res) => {
    res.json({
      protocol: 'MCP',
      version: '1.0',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false
      },
      server_info: {
        name: 'ULearn Google Ads API Server',
        version: '1.0.0'
      },
      tools: mcpServer.tools.map(tool => ({
        name: tool.name,
        description: tool.description
      })),
      timestamp: new Date().toISOString()
    });
  });

  // MCP Protocol endpoints
  app.post('/list_tools', async (req, res) => {
    try {
      const result = await mcpServer.listTools();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/call_tool', async (req, res) => {
    try {
      const { name, arguments: args } = req.body;
      const result = await mcpServer.callTool(name, args || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      protocol: 'MCP',
      tools: mcpServer.tools.length,
      tools_list: mcpServer.tools.map(t => t.name),
      api_focus: 'Live Google Ads API',
      timestamp: new Date().toISOString()
    });
  });

  return app;
}

module.exports = { createMCPServer, MCPServer };