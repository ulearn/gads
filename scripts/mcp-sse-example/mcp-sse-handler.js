/**
 * ULearn MCP SSE Handler
 * Path: /home/hub/public_html/gads/scripts/mcp-sse/mcp-sse-handler.js
 * 
 * Handles MCP Server-Sent Events for Claude Desktop Custom Connector
 * Based on @modelcontextprotocol/sdk
 */

const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { GoogleAdsApi } = require('google-ads-api');

// MCP Components (will be loaded dynamically)
let McpServer = null;
let SSEServerTransport = null;
let StreamableHTTPServerTransport = null;
let isInitializeRequest = null;

// Server instances
let mcpServer = null;
let sseTransport = null;
const transports = {};

// Database config
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Google Ads client
const googleAdsClient = new GoogleAdsApi({
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  developer_token: process.env.GAdsAPI
});

// Initialize MCP components
function initializeMCP() {
  try {
    const { McpServer: McpServerClass } = require('@modelcontextprotocol/sdk/server/mcp.js');
    const { SSEServerTransport: SSETransport } = require('@modelcontextprotocol/sdk/server/sse.js');
    const { StreamableHTTPServerTransport: StreamableTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const { isInitializeRequest: isInitRequest } = require('@modelcontextprotocol/sdk/types.js');
    
    McpServer = McpServerClass;
    SSEServerTransport = SSETransport;
    StreamableHTTPServerTransport = StreamableTransport;
    isInitializeRequest = isInitRequest;
    
    // Create MCP server
    mcpServer = new McpServer({
      name: 'ulearn-gads-mcp-sse',
      version: '1.0.0'
    });
    
    // Register tools
    registerULearnTools();
    
    console.log('✅ MCP SSE Server initialized');
    return true;
  } catch (error) {
    console.error('❌ MCP SDK not available:', error.message);
    return false;
  }
}

// Register ULearn Google Ads tools
function registerULearnTools() {
  // Tool 1: Test Google Ads Connection
  mcpServer.tool(
    'test_gads_connection',
    { 
      account_id: { 
        type: 'string', 
        description: 'Google Ads account ID',
        default: process.env.GADS_LIVE_ID || '1051706978'
      }
    },
    async ({ account_id = process.env.GADS_LIVE_ID || '1051706978' }) => {
      try {
        const customer = googleAdsClient.Customer({
          customer_id: account_id,
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
          login_customer_id: process.env.GADS_LIVE_MCC_ID
        });

        const query = `SELECT customer.id, customer.descriptive_name, customer.test_account FROM customer LIMIT 1`;
        const results = await customer.query(query);

        return {
          content: [{
            type: 'text',
            text: `# ✅ Google Ads Connection Test\n\n## Connection Successful\n- **Account ID:** ${account_id}\n- **Account Name:** ${results[0]?.customer?.descriptive_name || 'ULearn English School'}\n- **Test Account:** ${results[0]?.customer?.test_account ? 'Yes' : 'No'}\n- **MCC ID:** ${process.env.GADS_LIVE_MCC_ID}\n\n## Ready for AI Analysis\nYour ULearn Google Ads account is connected and ready!`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `# ❌ Google Ads Connection Failed\n\n**Error:** ${error.message}\n\n## Troubleshooting:\n1. Check refresh token validity\n2. Verify MCC account access\n3. Confirm account permissions`
          }]
        };
      }
    }
  );

  // Tool 2: Get Campaign Performance
  mcpServer.tool(
    'get_campaign_performance',
    {
      days: { 
        type: 'number', 
        description: 'Days to analyze', 
        default: 30, 
        minimum: 1, 
        maximum: 365 
      },
      account_id: { 
        type: 'string', 
        description: 'Google Ads account ID',
        default: process.env.GADS_LIVE_ID 
      }
    },
    async ({ days = 30, account_id = process.env.GADS_LIVE_ID }) => {
      try {
        const customer = googleAdsClient.Customer({
          customer_id: account_id,
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
          login_customer_id: process.env.GADS_LIVE_MCC_ID
        });

        const query = `
          SELECT 
            campaign.name,
            campaign.advertising_channel_type,
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
          LIMIT 10
        `;

        const results = await customer.query(query);
        
        // Aggregate totals
        const totals = results.reduce((acc, row) => {
          const m = row.metrics;
          acc.impressions += parseInt(m.impressions) || 0;
          acc.clicks += parseInt(m.clicks) || 0;
          acc.cost += (parseInt(m.cost_micros) || 0) / 1000000;
          acc.conversions += parseFloat(m.conversions) || 0;
          return acc;
        }, { impressions: 0, clicks: 0, cost: 0, conversions: 0 });

        // Format campaign list
        const campaignList = results.slice(0, 5).map((row, index) => {
          const c = row.campaign;
          const m = row.metrics;
          const cost = (parseInt(m.cost_micros) || 0) / 1000000;
          
          return `${index + 1}. **${c.name}**\n   - Cost: €${cost.toFixed(2)}\n   - Clicks: ${parseInt(m.clicks) || 0}\n   - Impressions: ${(parseInt(m.impressions) || 0).toLocaleString()}\n   - Conversions: ${parseFloat(m.conversions || 0).toFixed(1)}`;
        }).join('\n\n');

        return {
          content: [{
            type: 'text',
            text: `# 📊 Campaign Performance (${days} days)\n\n## Overall Performance\n- **Total Spend:** €${totals.cost.toFixed(2)}\n- **Total Clicks:** ${totals.clicks.toLocaleString()}\n- **Total Impressions:** ${totals.impressions.toLocaleString()}\n- **Total Conversions:** ${totals.conversions.toFixed(1)}\n- **Overall CTR:** ${totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : 0}%\n\n## Top 5 Campaigns\n\n${campaignList}\n\n*Ready for optimization analysis!*`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `# ❌ Campaign Performance Failed\n\n**Error:** ${error.message}`
          }]
        };
      }
    }
  );

  // Tool 3: Analyze Pipeline Attribution
  mcpServer.tool(
    'analyze_pipeline_attribution',
    {
      days: { 
        type: 'number', 
        description: 'Days to analyze', 
        default: 30, 
        minimum: 1, 
        maximum: 180 
      }
    },
    async ({ days = 30 }) => {
      try {
        const connection = await mysql.createConnection(dbConfig);

        const query = `
          SELECT 
            h.gclid,
            h.email,
            h.country,
            h.createdate,
            d.dealname,
            d.dealstage,
            d.amount,
            c.country_name,
            c.territory
          FROM hub_contacts h
          LEFT JOIN hub_deals d ON h.hs_object_id = d.hubspot_owner_id  
          LEFT JOIN countries c ON h.country = c.country_code
          WHERE h.gclid IS NOT NULL 
            AND h.gclid != ''
            AND h.createdate >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
          ORDER BY h.createdate DESC
          LIMIT 50
        `;

        const [results] = await connection.execute(query);
        await connection.end();

        if (results.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `# 📊 Pipeline Attribution (${days} days)\n\n## No GCLID Data Found\nNo contacts with Google Ads attribution found in the last ${days} days.`
            }]
          };
        }

        // Territory analysis
        const territoryStats = results.reduce((acc, row) => {
          const territory = row.territory || 'Unknown';
          if (!acc[territory]) {
            acc[territory] = { contacts: 0, deals: 0, revenue: 0 };
          }
          acc[territory].contacts++;
          if (row.dealname) {
            acc[territory].deals++;
            acc[territory].revenue += parseFloat(row.amount || 0);
          }
          return acc;
        }, {});

        const territoryBreakdown = Object.entries(territoryStats)
          .sort(([,a], [,b]) => b.contacts - a.contacts)
          .map(([territory, stats]) => {
            const conversionRate = stats.contacts > 0 ? ((stats.deals / stats.contacts) * 100).toFixed(1) : '0';
            return `- **${territory}:** ${stats.contacts} contacts, ${stats.deals} deals (${conversionRate}% conversion), €${stats.revenue.toFixed(0)} revenue`;
          }).join('\n');

        return {
          content: [{
            type: 'text',
            text: `# 📊 Google Ads Pipeline Attribution (${days} days)\n\n## Attribution Overview\n- **Total Attributed Contacts:** ${results.length}\n- **Contacts with Deals:** ${results.filter(r => r.dealname).length}\n- **Attribution Rate:** ${results.length > 0 ? ((results.filter(r => r.dealname).length / results.length) * 100).toFixed(1) : 0}%\n\n## Territory Performance\n${territoryBreakdown}\n\n## 🎯 Key Insights\n- **Total Pipeline Value:** €${Object.values(territoryStats).reduce((sum, stats) => sum + stats.revenue, 0).toFixed(0)}\n- **Total Countries:** ${Object.keys(territoryStats).length}\n\n*This shows how Google Ads clicks convert through your HubSpot pipeline!*`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `# ❌ Pipeline Attribution Failed\n\n**Error:** ${error.message}`
          }]
        };
      }
    }
  );
}

// Initialize on load
const mcpInitialized = initializeMCP();

// Handler functions for Express routes

async function handleRequest(req, res) {
  if (!mcpInitialized) {
    return res.status(503).json({
      error: 'MCP SDK not available',
      message: 'Install with: npm install @modelcontextprotocol/sdk'
    });
  }

  if (req.method === 'POST') {
    // Handle regular POST request
    const sessionId = req.headers['mcp-session-id'] || crypto.randomUUID();
    
    try {
      const isInit = isInitializeRequest(req.body);
      
      if (!transports[sessionId] || isInit) {
        console.log(`Creating new transport for session ${sessionId}`);
        
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => sessionId,
          onsessioninitialized: (sid) => {
            transports[sid] = transport;
            console.log(`Transport initialized: ${sid}`);
          }
        });
        
        await mcpServer.connect(transport);
        res.setHeader('Mcp-Session-Id', sessionId);
        
        await transport.handleRequest(req, res, req.body);
        return;
      }
      
      if (transports[sessionId]) {
        await transports[sessionId].handleRequest(req, res, req.body);
        return;
      }
      
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid session' },
        id: null
      });
    } catch (error) {
      console.error('MCP request error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  } else if (req.method === 'GET') {
    // Handle SSE stream request
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !transports[sessionId]) {
      return res.status(400).send('Invalid or missing session ID');
    }
    
    await transports[sessionId].handleRequest(req, res);
  } else if (req.method === 'DELETE') {
    // Handle session termination
    const sessionId = req.headers['mcp-session-id'];
    if (sessionId && transports[sessionId]) {
      await transports[sessionId].handleRequest(req, res);
      delete transports[sessionId];
    } else {
      res.status(400).send('Invalid or missing session ID');
    }
  } else {
    res.status(405).send('Method not allowed');
  }
}

async function handleSSE(req, res) {
  if (!mcpInitialized) {
    return res.status(503).send('MCP SDK not available');
  }

  sseTransport = new SSEServerTransport('/gads/mcp-sse/messages', res);
  await mcpServer.connect(sseTransport);
}

async function handleMessages(req, res) {
  if (!mcpInitialized || !sseTransport) {
    return res.status(503).json({ error: 'SSE transport not available' });
  }

  await sseTransport.handlePostMessage(req, res);
}

module.exports = {
  handleRequest,
  handleSSE,
  handleMessages
};