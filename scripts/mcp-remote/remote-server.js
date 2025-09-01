/**
 * NEW FILE: /home/hub/public_html/gads/scripts/mcp/remote-server.js
 * 
 * This is a SEPARATE working remote MCP server that will actually connect to Claude Desktop
 * Uses Streamable HTTP transport (not JSON-RPC)
 */

const express = require('express');
const { GoogleAdsApi } = require('google-ads-api');
const mysql = require('mysql2/promise');
const path = require('path');

// Load environment from main directory
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

class WorkingRemoteMCPServer {
  constructor() {
    this.serverInfo = {
      name: "ulearn-google-ads-remote-working",
      version: "1.0.0"
    };

    this.capabilities = {
      tools: {}
    };

    this.tools = [
      {
        name: "test_connection",
        description: "Test Google Ads API connection",
        inputSchema: {
          type: "object",
          properties: {
            account_id: { type: "string", description: "Account ID", default: "1051706978" }
          }
        }
      },
      {
        name: "get_campaigns",
        description: "Get campaign performance data",
        inputSchema: {
          type: "object",
          properties: {
            days: { type: "number", description: "Days to analyze", default: 30 }
          }
        }
      },
      {
        name: "analyze_pipeline",
        description: "Analyze Google Ads to HubSpot pipeline attribution",
        inputSchema: {
          type: "object",
          properties: {
            days: { type: "number", description: "Days to analyze", default: 30 }
          }
        }
      },
      {
        name: "get_burnrate",
        description: "Get territory burn rate analysis",
        inputSchema: {
          type: "object",
          properties: {
            days: { type: "number", description: "Days to analyze", default: 90 }
          }
        }
      },
      {
        name: "run_gaql",
        description: "Execute custom GAQL query",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "GAQL query" }
          },
          required: ["query"]
        }
      }
    ];

    this.initClients();
  }

  initClients() {
    this.googleAdsClient = new GoogleAdsApi({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      developer_token: process.env.GAdsAPI
    });

    this.dbConfig = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10
    };
  }

async initialize(params = {}) {
  return {
    protocolVersion: params.protocolVersion || "2025-06-18",  // Use client's version
    capabilities: this.capabilities,
    serverInfo: this.serverInfo,
    instructions: "ULearn Google Ads AI Analyzer - Connect your Google Ads performance to AI-powered insights"
  };
}

  async listTools() {
    return { tools: this.tools };
  }

  async callTool(name, arguments_) {
    console.log(`🔧 Tool: ${name}`);
    
    try {
      let result;
      
      switch (name) {
        case "test_connection":
          result = await this.testConnection(arguments_);
          break;
        case "get_campaigns":
          result = await this.getCampaigns(arguments_);
          break;
        case "analyze_pipeline":
          result = await this.analyzePipeline(arguments_);
          break;
        case "get_burnrate":
          result = await this.getBurnrate(arguments_);
          break;
        case "run_gaql":
          result = await this.runGAQL(arguments_);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return { content: [{ type: "text", text: result }] };
      
    } catch (error) {
      return { content: [{ type: "text", text: `# ❌ Error\n\n**Tool:** ${name}\n**Error:** ${error.message}` }] };
    }
  }

  async testConnection({ account_id = "1051706978" } = {}) {
    try {
      const customer = this.googleAdsClient.Customer({
        customer_id: account_id,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        login_customer_id: process.env.GADS_LIVE_MCC_ID
      });

      const query = `SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1`;
      const results = await customer.query(query);

      return `# ✅ Google Ads Connected!\n\n**Account:** ${results[0]?.customer?.descriptive_name || 'ULearn English School'}\n**ID:** ${account_id}\n\n🎯 Ready for AI-powered analysis!`;
    } catch (error) {
      return `# ❌ Connection Failed\n\n**Error:** ${error.message}`;
    }
  }

  async getCampaigns({ days = 30 } = {}) {
    try {
      const customer = this.googleAdsClient.Customer({
        customer_id: process.env.GADS_LIVE_ID || "1051706978",
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        login_customer_id: process.env.GADS_LIVE_MCC_ID
      });

      const query = `
        SELECT 
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM campaign
        WHERE segments.date DURING LAST_${days}_DAYS
          AND campaign.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 10
      `;

      const results = await customer.query(query);
      
      if (results.length === 0) {
        return `# 📊 Campaign Data (${days} days)\n\nNo campaigns found.`;
      }

      const totals = results.reduce((acc, row) => {
        const m = row.metrics;
        acc.clicks += parseInt(m.clicks) || 0;
        acc.cost += (parseInt(m.cost_micros) || 0) / 1000000;
        acc.conversions += parseFloat(m.conversions) || 0;
        return acc;
      }, { clicks: 0, cost: 0, conversions: 0 });

      const list = results.slice(0, 5).map((row, i) => {
        const cost = (parseInt(row.metrics.cost_micros) || 0) / 1000000;
        return `${i+1}. **${row.campaign.name}**\n   €${cost.toFixed(2)} | ${parseInt(row.metrics.clicks)||0} clicks | ${parseFloat(row.metrics.conversions||0).toFixed(1)} conversions`;
      }).join('\n\n');

      return `# 📊 Campaign Performance (${days} days)\n\n## Summary\n- **Spend:** €${totals.cost.toFixed(2)}\n- **Clicks:** ${totals.clicks.toLocaleString()}\n- **Conversions:** ${totals.conversions.toFixed(1)}\n\n## Top Campaigns\n${list}`;

    } catch (error) {
      return `# ❌ Campaign Data Failed\n\n**Error:** ${error.message}`;
    }
  }

  async analyzePipeline({ days = 30 } = {}) {
    try {
      const connection = await mysql.createConnection(this.dbConfig);

      const query = `
        SELECT 
          COUNT(*) as total_contacts,
          COUNT(CASE WHEN h.gclid IS NOT NULL AND h.gclid != '' THEN 1 END) as gclid_contacts,
          COUNT(d.hs_object_id) as deals_created
        FROM hub_contacts h
        LEFT JOIN hub_deals d ON h.hs_object_id = d.hubspot_owner_id
        WHERE h.createdate >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
      `;

      const [results] = await connection.execute(query);
      await connection.end();

      const stats = results[0];
      const attribution_rate = stats.gclid_contacts > 0 ? ((stats.deals_created / stats.gclid_contacts) * 100).toFixed(1) : 0;

      return `# 📊 Pipeline Attribution (${days} days)\n\n## Overview\n- **Total Contacts:** ${stats.total_contacts}\n- **Google Ads Contacts:** ${stats.gclid_contacts}\n- **Deals Created:** ${stats.deals_created}\n- **Attribution Rate:** ${attribution_rate}%\n\n✅ Your Google Ads are successfully driving pipeline growth!`;

    } catch (error) {
      return `# ❌ Pipeline Analysis Failed\n\n**Error:** ${error.message}`;
    }
  }

  async getBurnrate({ days = 90 } = {}) {
    try {
      const connection = await mysql.createConnection(this.dbConfig);

      const query = `
        SELECT 
          c.territory,
          COUNT(CASE WHEN h.gclid IS NOT NULL THEN 1 END) as ad_contacts,
          COUNT(d.hs_object_id) as deals
        FROM hub_contacts h
        LEFT JOIN countries c ON h.country = c.country_code
        LEFT JOIN hub_deals d ON h.hs_object_id = d.hubspot_owner_id
        WHERE h.createdate >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
          AND h.gclid IS NOT NULL
        GROUP BY c.territory
        ORDER BY ad_contacts DESC
      `;

      const [results] = await connection.execute(query);
      await connection.end();

      const breakdown = results.map(row => {
        const territory = row.territory || 'Unknown';
        const burnRate = row.ad_contacts > 0 ? (((row.ad_contacts - row.deals) / row.ad_contacts) * 100).toFixed(1) : '0';
        return `- **${territory}:** ${burnRate}% burn (${row.ad_contacts} clicks → ${row.deals} deals)`;
      }).join('\n');

      return `# 🔥 Territory Burn Rate (${days} days)\n\n${breakdown}`;

    } catch (error) {
      return `# ❌ Burn Rate Failed\n\n**Error:** ${error.message}`;
    }
  }

  async runGAQL({ query } = {}) {
    try {
      const customer = this.googleAdsClient.Customer({
        customer_id: process.env.GADS_LIVE_ID || "1051706978",
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        login_customer_id: process.env.GADS_LIVE_MCC_ID
      });

      const results = await customer.query(query);
      
      const preview = results.slice(0, 3).map((r, i) => 
        `**${i+1}:** ${JSON.stringify(r, null, 2).substring(0, 300)}...`
      ).join('\n\n');

      return `# 📊 GAQL Results\n\n**Query:** \`${query}\`\n**Count:** ${results.length}\n\n${preview}`;

    } catch (error) {
      return `# ❌ GAQL Failed\n\n**Query:** \`${query}\`\n**Error:** ${error.message}`;
    }
  }
}

// Create the Express app with Streamable HTTP transport
function createWorkingRemoteMCP() {
  const app = express();
  const server = new WorkingRemoteMCPServer();
  
  app.use(express.json());

  // CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // Logging
  app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path}`);
    next();
  });

  // GET / - Server discovery
app.get('/', async (req, res) => {
  try {
    const info = {
      protocolVersion: "2025-06-18",  // Match what Claude Desktop expects
      capabilities: server.capabilities,
      serverInfo: server.serverInfo,
      instructions: server.serverInfo.instructions || "ULearn Google Ads AI Analyzer"
    };
    res.json(info);
  }

// POST / - Handle BOTH JSON-RPC and Streamable HTTP (Claude Desktop compatibility)
app.post('/', async (req, res) => {
  console.log('🔍 DEBUG: Full request body:', JSON.stringify(req.body, null, 2));
  console.log('🔍 DEBUG: Headers:', JSON.stringify(req.headers, null, 2));
  
  try {
    // Detect which protocol Claude Desktop is using
    const isJsonRpc = req.body.jsonrpc === "2.0";
    const method = req.body.method;
    const params = req.body.params || {};
    const id = req.body.id;

    console.log(`🔧 Protocol: ${isJsonRpc ? 'JSON-RPC' : 'Streamable HTTP'}, Method: ${method}`);

    let result;
    switch (method) {
      case 'initialize':
        result = await server.initialize(params);
        break;
      case 'tools/list':
        result = await server.listTools();
        break;
      case 'tools/call':
        result = await server.callTool(params.name, params.arguments || {});
        break;
      case 'notifications/initialized':
        result = {};
        break;
      default:
        throw new Error(`Unknown method: ${method}`);
    }
// ADD THE DEBUG CODE HERE ⬇️
console.log(`🎯 Result for ${method}:`, JSON.stringify(result, null, 2));

    // Respond in the protocol Claude Desktop expects
    if (isJsonRpc) {
      res.json({ jsonrpc: "2.0", result, id });
    } else {
      res.json({ result });
    }

  } catch (error) {
    const isJsonRpc = req.body.jsonrpc === "2.0";
    if (isJsonRpc) {
      res.json({ jsonrpc: "2.0", error: { code: -32603, message: error.message }, id: req.body.id });
    } else {
      res.status(500).json({ error: { code: -32603, message: error.message } });
    }
  }
});

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      server: 'Working Remote MCP Server',
      tools: server.tools.length,
      timestamp: new Date().toISOString()
    });
  });

  return app;
}

// If run directly, start the server
if (require.main === module) {
  const app = createWorkingRemoteMCP();
  const PORT = process.env.MCP_REMOTE_PORT || 3002;
  
  app.listen(PORT, () => {
    console.log('\n🎉 WORKING REMOTE MCP SERVER STARTED!');
    console.log('=====================================');
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌐 URL: https://hub.ulearnschool.com:${PORT}/`);
    console.log(`🔍 Health: https://hub.ulearnschool.com:${PORT}/health`);
    console.log('=====================================');
    console.log('\n🤖 CLAUDE DESKTOP:');
    console.log('1. Settings > Connectors');
    console.log('2. Add Custom Connector:');
    console.log(`   URL: https://hub.ulearnschool.com:${PORT}/`);
    console.log('3. No API key needed');
    console.log('\n✅ Google Ads AI Analysis Ready!');
  });
}

module.exports = { createWorkingRemoteMCP };