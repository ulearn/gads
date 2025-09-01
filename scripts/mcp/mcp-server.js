/**
 * MCP Specification Compliant Server - Version 2.1
 * FIXED: Proper capabilities declaration for Claude.ai integration
 * Updated: September 1, 2025
 */

const express = require('express');
const { GoogleAdsApi } = require('google-ads-api');

require('dotenv').config();

class MCPCompliantServer {
  constructor() {
    this.serverInfo = {
      name: "ULearn Google Ads API Server",
      version: "2.1.0"
    };

    // FIXED: Proper MCP capabilities declaration
    this.capabilities = {
      tools: {
        listChanged: false  // Indicates if tool list can change
      },
      resources: {},
      prompts: {}
    };

    this.tools = [
      {
        name: "get_live_campaigns",
        description: "Get live Google Ads campaign data directly from Google Ads API",
        inputSchema: {
          type: "object",
          properties: {
            account_id: {
              type: "string",
              description: "Google Ads account ID",
              default: "5411183629"
            }
          },
          required: []
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
              description: "Number of days to analyze",
              default: 30,
              minimum: 1,
              maximum: 365
            }
          },
          required: []
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
          },
          required: []
        }
      }
    ];

    this.googleAdsClient = new GoogleAdsApi({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      developer_token: process.env.GAdsAPI
    });
  }

  // MCP Protocol: Initialize - FIXED: Proper capabilities response
  async initialize() {
    return {
      protocolVersion: "2025-06-18",
      capabilities: this.capabilities,
      serverInfo: this.serverInfo
    };
  }

  // MCP Protocol: List Tools
  async listTools() {
    return {
      tools: this.tools
    };
  }

  // MCP Protocol: Call Tool
  async callTool(name, arguments_) {
    console.log(`🔧 MCP Tool called: ${name}`, arguments_);
    
    try {
      switch (name) {
        case "get_live_campaigns":
          return await this.getLiveCampaigns(arguments_);
        case "get_campaign_metrics":
          return await this.getCampaignMetrics(arguments_);
        case "test_connection":
          return await this.testConnection(arguments_);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      console.error(`❌ Tool ${name} failed:`, error.message);
      throw {
        code: -32000,
        message: `Tool execution failed: ${error.message}`,
        data: { tool: name, arguments: arguments_ }
      };
    }
  }

  async testConnection({ account_id = "5411183629" } = {}) {
    console.log(`🧪 Testing Google Ads connection for account: ${account_id}`);
    
    try {
      const customer = this.googleAdsClient.Customer({
        customer_id: account_id,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        login_customer_id: process.env.GADS_TEST_MCC_ID
      });

      const query = `SELECT customer.id, customer.descriptive_name, customer.test_account FROM customer`;
      const results = await customer.query(query);

      const result = {
        content: [{
          type: "text",
          text: `# 🎯 Google Ads API Connection Test

## ✅ Connection Successful
- **Account ID:** ${account_id}
- **Account Name:** ${results[0]?.customer?.descriptive_name || 'Unknown'}
- **Test Account:** ${results[0]?.customer?.test_account ? 'Yes' : 'No'}
- **MCC ID:** ${process.env.GADS_TEST_MCC_ID}

## 🚀 Ready for Analysis
Your ULearn Google Ads account is connected and ready for AI-powered analysis!`
        }]
      };

      console.log(`✅ Connection test successful for ${account_id}`);
      return result;

    } catch (error) {
      console.error(`❌ Connection test failed:`, error.message);
      return {
        content: [{
          type: "text",
          text: `# ❌ Google Ads API Connection Failed

**Error:** ${error.message}

## 🔧 Troubleshooting Steps:
1. Check refresh token validity
2. Verify MCC account access  
3. Confirm account ID permissions
4. Review developer token status`
        }]
      };
    }
  }

  async getLiveCampaigns({ account_id = "5411183629" } = {}) {
    console.log(`📊 Fetching live campaigns for account: ${account_id}`);
    
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
          campaign.advertising_channel_type,
          campaign.campaign_budget
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        ORDER BY campaign.name
      `;

      const results = await customer.query(query);

      const campaignList = results.map((row, index) => {
        const c = row.campaign;
        return `${index + 1}. **${c.name}**
   - ID: \`${c.id}\`
   - Status: ${c.status}
   - Type: ${c.advertising_channel_type}
   - Budget: ${c.campaign_budget || 'Not specified'}`;
      }).join('\n\n');

      const result = {
        content: [{
          type: "text",
          text: `# 🎯 Live Google Ads Campaigns

## Account: ${account_id}
## Total Active Campaigns: ${results.length}

${campaignList}

---
*Ready for detailed campaign analysis and optimization recommendations!*`
        }]
      };

      console.log(`✅ Retrieved ${results.length} campaigns successfully`);
      return result;

    } catch (error) {
      console.error(`❌ Failed to get campaigns:`, error.message);
      throw new Error(`Failed to get campaigns: ${error.message}`);
    }
  }

  async getCampaignMetrics({ account_id = "5411183629", days = 30 } = {}) {
    console.log(`📈 Fetching campaign metrics for account: ${account_id}, days: ${days}`);
    
    try {
      const customer = this.googleAdsClient.Customer({
        customer_id: account_id,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        login_customer_id: process.env.GADS_TEST_MCC_ID
      });

      const query = `
        SELECT 
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc
        FROM campaign
        WHERE segments.date DURING LAST_${days}_DAYS
          AND campaign.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
      `;

      const results = await customer.query(query);
      
      // Calculate totals
      const totals = results.reduce((acc, row) => {
        const m = row.metrics;
        acc.impressions += parseInt(m.impressions) || 0;
        acc.clicks += parseInt(m.clicks) || 0;
        acc.cost += (parseInt(m.cost_micros) || 0) / 1000000;
        acc.conversions += parseFloat(m.conversions) || 0;
        return acc;
      }, { impressions: 0, clicks: 0, cost: 0, conversions: 0 });

      // Top campaigns by spend
      const topCampaigns = results.slice(0, 5).map((row, index) => {
        const c = row.campaign;
        const m = row.metrics;
        const cost = (parseInt(m.cost_micros) || 0) / 1000000;
        
        return `${index + 1}. **${c.name}**
   - Cost: €${cost.toFixed(2)}
   - Clicks: ${parseInt(m.clicks) || 0}
   - Impressions: ${parseInt(m.impressions) || 0}
   - CTR: ${parseFloat(m.ctr || 0).toFixed(2)}%
   - Conversions: ${parseFloat(m.conversions || 0).toFixed(1)}`;
      }).join('\n\n');

      const result = {
        content: [{
          type: "text",
          text: `# 📊 Campaign Performance Metrics (${days} days)

## 📈 Overall Summary
- **Total Impressions:** ${totals.impressions.toLocaleString()}
- **Total Clicks:** ${totals.clicks.toLocaleString()}  
- **Total Spend:** €${totals.cost.toFixed(2)}
- **Total Conversions:** ${totals.conversions.toFixed(1)}
- **Overall CTR:** ${totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : 0}%
- **Average CPC:** €${totals.clicks > 0 ? (totals.cost / totals.clicks).toFixed(2) : 0}

## 🎯 Top 5 Campaigns by Spend

${topCampaigns}

---
*Ready for detailed performance analysis and optimization strategies!*`
        }]
      };

      console.log(`✅ Retrieved metrics for ${results.length} campaigns`);
      return result;

    } catch (error) {
      console.error(`❌ Failed to get metrics:`, error.message);
      throw new Error(`Failed to get metrics: ${error.message}`);
    }
  }
}

/**
 * Create MCP-compliant Express server - Version 2.1
 */
function createMCPServer() {
  const app = express();
  const mcp = new MCPCompliantServer();
  
  app.use(express.json());

  // Enhanced CORS for remote MCP access
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Request logging for debugging
  app.use((req, res, next) => {
    console.log(`🌐 MCP Request: ${req.method} ${req.path}`, req.body ? JSON.stringify(req.body) : '');
    next();
  });

  // MCP Root - Server Discovery (GET)
  app.get('/', async (req, res) => {
    try {
      const result = await mcp.initialize();
      console.log('📡 MCP Discovery request - returning capabilities');
      res.json(result);
    } catch (error) {
      console.error('❌ MCP Discovery failed:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

// MCP JSON-RPC Endpoint (POST)
  app.post('/', async (req, res) => {
    const { method, params, id } = req.body;
    console.log(`🔧 MCP JSON-RPC: ${method}`, params);

    try {
      let result;
      
      switch (method) {
        case 'initialize':
          result = await mcp.initialize();
          break;
        case 'tools/list':
          result = await mcp.listTools();
          break;
        case 'tools/call':
          result = await mcp.callTool(params.name, params.arguments);
          break;
        case 'notifications/initialized':
          // ADDED: Handle Claude.ai initialization notification
          console.log('✅ MCP Client initialization complete');
          result = {};  // Just acknowledge with empty response
          break;
        default:
          console.warn(`⚠️ Unknown MCP method: ${method}`);
          return res.json({
            jsonrpc: "2.0",
            error: { code: -32601, message: `Unknown method: ${method}` },
            id
          });
      }

      res.json({ jsonrpc: "2.0", result, id });
    } catch (error) {
      console.error(`❌ MCP method ${method} failed:`, error.message);
      res.json({
        jsonrpc: "2.0",
        error: { code: -32603, message: error.message },
        id
      });
    }
  });

  // Enhanced health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      server: 'MCP Compliant v2.1',
      tools: mcp.tools.length,
      protocol_version: '2024-11-05',
      tools_list: mcp.tools.map(t => t.name),
      capabilities: mcp.capabilities,
      timestamp: new Date().toISOString()
    });
  });

  console.log('🚀 MCP Server v2.1 created successfully');
  return app;
}

module.exports = { createMCPServer };