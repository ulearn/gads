const express = require('express');
const router = express.Router();
const { GoogleAdsApi } = require('google-ads-api');
const mysql = require('mysql2/promise');
const path = require('path');

// Ensure environment variables are loaded
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/** ---------- Small util for timestamped logs ---------- */
const log = (...args) => console.log(new Date().toISOString(), ...args);

// Initialize Google Ads client
console.log('🔍 MCP Environment Variables Check:');
console.log('  CLIENT_ID:', process.env.CLIENT_ID ? 'Present (' + process.env.CLIENT_ID.substring(0, 20) + '...)' : 'Missing');
console.log('  CLIENT_SECRET:', process.env.CLIENT_SECRET ? 'Present' : 'Missing');
console.log('  GAdsAPI:', process.env.GAdsAPI ? 'Present' : 'Missing');
console.log('  GOOGLE_REFRESH_TOKEN:', process.env.GOOGLE_REFRESH_TOKEN ? 'Present' : 'Missing');

const googleAdsClient = new GoogleAdsApi({
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  developer_token: process.env.GAdsAPI
});

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
};

/** ---------- MCP SDK Components ---------- */
let McpServer = null;
let SSEServerTransport = null;
let mcpServer = null;
let sseTransport = null;

// Try to load MCP SDK
async function initializeMCP() {
  try {
    log('🔄 Loading MCP server module...');
    const serverModule = await import('@modelcontextprotocol/sdk/server/index.js');
    log('🔄 Loading MCP SSE module...');
    const sseModule = await import('@modelcontextprotocol/sdk/server/sse.js');
    
    const { Server: McpServerClass } = serverModule;
    const { SSEServerTransport: SSETransport } = sseModule;
    
    McpServer = McpServerClass;
    SSEServerTransport = SSETransport;
    
    // Create MCP server with correct constructor parameters
    mcpServer = new McpServer({
      name: 'ulearn-mcp-server',
      version: '1.0.5'
    }, {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    });
    
    log('🔧 MCP Server created successfully');
    log('🔄 Registering Google Ads tools...');
    
    // Register tools/list handler
    mcpServer.setRequestHandler('tools/list', async () => {
      log('🔧 tools/list handler called');
      return {
        tools: [
          {
            name: 'echo',
            description: 'Simple echo tool that returns whatever message you send to it',
            inputSchema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'The message to echo back'
                }
              },
              required: ['message']
            }
          },
          {
            name: 'google_ads_account_overview',
            description: 'Get comprehensive Google Ads account overview with campaign performance data',
            inputSchema: {
              type: 'object',
              properties: {
                account_id: {
                  type: 'string',
                  description: 'Google Ads account ID (default: live account)'
                },
                include_campaigns: {
                  type: 'boolean',
                  description: 'Include detailed campaign information',
                  default: true
                },
                date_range_days: {
                  type: 'number',
                  description: 'Number of days for performance metrics',
                  default: 30
                }
              }
            }
          },
          {
            name: 'google_ads_campaign_analysis',
            description: 'Analyze campaign settings, bidding strategies, targeting, and optimization configurations',
            inputSchema: {
              type: 'object',
              properties: {
                account_id: {
                  type: 'string',
                  description: 'Google Ads account ID (default: live account)'
                },
                campaign_id: {
                  type: 'string',
                  description: 'Specific campaign ID to analyze (optional - analyzes all if not provided)'
                },
                include_targeting: {
                  type: 'boolean',
                  description: 'Include detailed targeting settings analysis',
                  default: true
                },
                include_bidding: {
                  type: 'boolean',
                  description: 'Include detailed bidding strategy analysis',
                  default: true
                }
              }
            }
          }
        ]
      };
    });

    // Register tools/call handler  
    mcpServer.setRequestHandler('tools/call', async (request) => {
      log('🔧 🎯 NEW TOOLS/CALL HANDLER CALLED!');
      log('🔧 tools/call handler called with request:', JSON.stringify(request, null, 2));
      
      if (!request || !request.params) {
        throw new Error('Invalid request: missing params');
      }
      
      const { name, arguments: args } = request.params;
      
      // Handle echo tool
      if (name === 'echo') {
        const message = args?.message || 'No message provided';
        log('📢 Echo tool called with message:', message);
        
        return {
          content: [
            {
              type: 'text',
              text: `Echo: ${message}`
            }
          ]
        };
      }
      
      // Handle Google Ads Account Overview tool
      if (name === 'google_ads_account_overview') {
        const { account_id = process.env.GADS_LIVE_ID, include_campaigns = true, date_range_days = 30 } = args || {};
        log('🏢 Google Ads Account Overview tool called:', { account_id, include_campaigns, date_range_days });
        
        try {
          const customer = googleAdsClient.Customer({
            customer_id: account_id,
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
            login_customer_id: process.env.GADS_LIVE_MCC_ID
          });

          // Get account basic info
          const accountQuery = `
            SELECT 
              customer.id,
              customer.descriptive_name,
              customer.currency_code,
              customer.time_zone,
              customer.test_account,
              customer.auto_tagging_enabled,
              customer.conversion_tracking_setting.conversion_tracking_id,
              customer.optimization_score
            FROM customer 
            LIMIT 1
          `;

          const accountResults = await customer.query(accountQuery);
          const accountInfo = accountResults[0]?.customer || {};

          let campaignData = [];
          let summary = {};

          if (include_campaigns) {
            // Get campaign overview with performance metrics
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - date_range_days);
            const endDate = new Date();
            
            const campaignQuery = `
              SELECT 
                campaign.id,
                campaign.name,
                campaign.status,
                campaign.advertising_channel_type,
                campaign.bidding_strategy_type,
                metrics.clicks,
                metrics.impressions,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.ctr,
                metrics.average_cpc
              FROM campaign 
              WHERE segments.date BETWEEN '${startDate.toISOString().split('T')[0]}' AND '${endDate.toISOString().split('T')[0]}'
            `;

            const campaignResults = await customer.query(campaignQuery);
            
            // Process campaign data
            const campaignMap = new Map();
            campaignResults.forEach(row => {
              const campaignId = row.campaign.id;
              if (!campaignMap.has(campaignId)) {
                campaignMap.set(campaignId, {
                  id: campaignId,
                  name: row.campaign.name,
                  status: row.campaign.status,
                  type: row.campaign.advertising_channel_type,
                  budget: row.campaign.campaign_budget,
                  bidding_strategy: row.campaign.bidding_strategy_type,
                  optimization_score: row.campaign.optimization_score,
                  metrics: {
                    clicks: 0,
                    impressions: 0,
                    cost: 0,
                    conversions: 0,
                    conversion_value: 0,
                    ctr: 0,
                    avg_cpc: 0
                  }
                });
              }
              
              const campaign = campaignMap.get(campaignId);
              campaign.metrics.clicks += row.metrics.clicks || 0;
              campaign.metrics.impressions += row.metrics.impressions || 0;
              campaign.metrics.cost += (row.metrics.cost_micros || 0) / 1000000;
              campaign.metrics.conversions += row.metrics.conversions || 0;
              campaign.metrics.conversion_value += row.metrics.conversions_value || 0;
              campaign.metrics.ctr = row.metrics.ctr || 0;
              campaign.metrics.avg_cpc = (row.metrics.average_cpc || 0) / 1000000;
            });

            campaignData = Array.from(campaignMap.values());

            // Calculate account summary
            summary = {
              total_campaigns: campaignData.length,
              active_campaigns: campaignData.filter(c => c.status === 'ENABLED').length,
              total_clicks: campaignData.reduce((sum, c) => sum + c.metrics.clicks, 0),
              total_impressions: campaignData.reduce((sum, c) => sum + c.metrics.impressions, 0),
              total_cost: campaignData.reduce((sum, c) => sum + c.metrics.cost, 0),
              total_conversions: campaignData.reduce((sum, c) => sum + c.metrics.conversions, 0),
              total_conversion_value: campaignData.reduce((sum, c) => sum + c.metrics.conversion_value, 0)
            };
          }

          // Format response
          const response = {
            account: {
              id: accountInfo.id,
              name: accountInfo.descriptive_name,
              currency: accountInfo.currency_code,
              timezone: accountInfo.time_zone,
              is_test_account: accountInfo.test_account,
              auto_tagging: accountInfo.auto_tagging_enabled,
              conversion_tracking_id: accountInfo.conversion_tracking_setting?.conversion_tracking_id,
              optimization_score: accountInfo.optimization_score
            },
            summary,
            campaigns: campaignData,
            date_range: `${date_range_days} days`,
            generated_at: new Date().toISOString()
          };

          const reportText = `# 📊 Google Ads Account Overview

## 🏢 Account Information
- **Account:** ${accountInfo.descriptive_name} (${accountInfo.id})
- **Currency:** ${accountInfo.currency_code}
- **Timezone:** ${accountInfo.time_zone}
- **Test Account:** ${accountInfo.test_account ? 'Yes' : 'No'}
- **Auto-tagging:** ${accountInfo.auto_tagging_enabled ? 'Enabled' : 'Disabled'}
- **Optimization Score:** ${accountInfo.optimization_score || 'N/A'}

${include_campaigns ? `## 📈 Performance Summary (Last ${date_range_days} days)
- **Total Campaigns:** ${summary.total_campaigns} (${summary.active_campaigns} active)
- **Total Clicks:** ${summary.total_clicks.toLocaleString()}
- **Total Impressions:** ${summary.total_impressions.toLocaleString()}
- **Total Cost:** €${summary.total_cost.toFixed(2)}
- **Total Conversions:** ${summary.total_conversions}
- **Total Conversion Value:** €${summary.total_conversion_value.toFixed(2)}

## 🎯 Campaign Breakdown
${campaignData.map(campaign => `
### ${campaign.name}
- **Status:** ${campaign.status}
- **Type:** ${campaign.type}
- **Optimization Score:** ${campaign.optimization_score || 'N/A'}
- **Clicks:** ${campaign.metrics.clicks} | **Impressions:** ${campaign.metrics.impressions}
- **Cost:** €${campaign.metrics.cost.toFixed(2)} | **Conversions:** ${campaign.metrics.conversions}
- **CTR:** ${(campaign.metrics.ctr * 100).toFixed(2)}% | **Avg CPC:** €${campaign.metrics.avg_cpc.toFixed(2)}
`).join('')}` : ''}

*Generated: ${new Date().toISOString()}*`;

          log('✅ Account overview completed successfully');
          
          return {
            content: [{
              type: 'text',
              text: reportText
            }]
          };

        } catch (error) {
          log('❌ Account overview failed:', error.message);
          return {
            content: [{
              type: 'text', 
              text: `❌ **Error getting account overview:**\n\n${error.message}\n\nPlease check your Google Ads API credentials and account access.`
            }]
          };
        }
      }
      
      // Handle Google Ads Campaign Analysis tool
      if (name === 'google_ads_campaign_analysis') {
        const { account_id = process.env.GADS_LIVE_ID, campaign_id = '', include_targeting = true, include_bidding = true } = args || {};
        log('🎯 Campaign Settings Analysis tool called:', { account_id, campaign_id, include_targeting, include_bidding });
        
        try {
          const customer = googleAdsClient.Customer({
            customer_id: account_id,
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
            login_customer_id: process.env.GADS_LIVE_MCC_ID
          });

          // Build simplified campaign query focusing on bidding strategies
          let campaignQuery = `
            SELECT 
              campaign.id,
              campaign.name,
              campaign.status,
              campaign.advertising_channel_type,
              campaign.bidding_strategy_type,
              campaign.target_cpa.target_cpa_micros,
              campaign.target_roas.target_roas,
              campaign.target_spend.target_spend_micros,
              campaign.maximize_conversions.target_cpa_micros,
              campaign.maximize_conversion_value.target_roas,
              campaign.manual_cpc.enhanced_cpc_enabled
            FROM campaign
            WHERE campaign.status IN ('ENABLED', 'PAUSED')
          `;

          if (campaign_id) {
            campaignQuery += ` AND campaign.id = '${campaign_id}'`;
          }

          log('🔍 Querying campaign settings...');
          const campaignResults = await customer.query(campaignQuery);
          
          let campaigns = [];
          for (const row of campaignResults) {
            const campaign = row.campaign;
            
            const campaignData = {
              id: campaign.id,
              name: campaign.name,
              status: campaign.status,
              type: campaign.advertising_channel_type,
              bidding: {
                strategy_type: campaign.bidding_strategy_type,
                enhanced_cpc: campaign.manual_cpc?.enhanced_cpc_enabled,
                target_cpa: campaign.target_cpa?.target_cpa_micros ? (campaign.target_cpa.target_cpa_micros / 1000000) : null,
                target_roas: campaign.target_roas?.target_roas || campaign.maximize_conversion_value?.target_roas,
                target_spend: campaign.target_spend?.target_spend_micros ? (campaign.target_spend.target_spend_micros / 1000000) : null,
                max_conv_target_cpa: campaign.maximize_conversions?.target_cpa_micros ? (campaign.maximize_conversions.target_cpa_micros / 1000000) : null
              }
            };

            campaigns.push(campaignData);
          }

          // Format the response
          const reportSections = [];
          
          reportSections.push(`# 🎯 Campaign Bidding Strategies\n`);
          reportSections.push(`**Account:** ${account_id} | **Active Campaigns:** ${campaigns.length}\n`);
          
          campaigns.forEach(campaign => {
            reportSections.push(`## 📊 ${campaign.name} (${campaign.id})`);
            reportSections.push(`**Status:** ${campaign.status} | **Type:** ${campaign.type}\n`);

            // Bidding Strategy (Focus)
            reportSections.push(`### 🎯 Bidding Strategy`);
            reportSections.push(`- **Strategy Type:** ${campaign.bidding.strategy_type}`);
            
            if (campaign.bidding.enhanced_cpc !== undefined) {
              reportSections.push(`- **Enhanced CPC:** ${campaign.bidding.enhanced_cpc ? 'Enabled' : 'Disabled'}`);
            }
            if (campaign.bidding.target_cpa) {
              reportSections.push(`- **Target CPA:** €${campaign.bidding.target_cpa.toFixed(2)}`);
            }
            if (campaign.bidding.target_roas) {
              reportSections.push(`- **Target ROAS:** ${(campaign.bidding.target_roas * 100).toFixed(1)}%`);
            }
            if (campaign.bidding.target_spend) {
              reportSections.push(`- **Target Spend:** €${campaign.bidding.target_spend.toFixed(2)}`);
            }
            if (campaign.bidding.max_conv_target_cpa) {
              reportSections.push(`- **Max Conv Target CPA:** €${campaign.bidding.max_conv_target_cpa.toFixed(2)}`);
            }
            
            reportSections.push('\n---\n');
          });

          reportSections.push(`*Generated: ${new Date().toISOString()}*`);

          log('✅ Campaign analysis completed successfully');
          
          return {
            content: [{
              type: 'text',
              text: reportSections.join('\n')
            }]
          };

        } catch (error) {
          log('❌ Campaign analysis failed:', error.message);
          return {
            content: [{
              type: 'text',
              text: `❌ **Error getting campaign analysis:**\n\n${error.message}\n\nPlease check your Google Ads API credentials and account access.`
            }]
          };
        }
      }
      
      // Return error for unknown tools
      throw new Error(`Unknown tool: ${name}`);
    });
    
    log('✅ MCP SDK initialized with Google Ads tools');
    return true;
  } catch (error) {
    log('❌ MCP SDK not available:', error.message);
    return false;
  }
}

// Initialize MCP - start as true for basic functionality, async load will enhance it
let mcpInitialized = true;

// Start async initialization in background
console.log('🔄 Starting MCP SDK initialization...');
initializeMCP().then(success => {
  if (success) {
    console.log('✅ MCP SDK initialized with Google Ads tools');
  } else {
    console.log('❌ MCP SDK initialization returned false');
  }
}).catch(error => {
  console.log('❌ MCP SDK initialization failed:', error.message);
  console.log('❌ Error stack:', error.stack);
});

/** ---------- CORS middleware for Claude Desktop ---------- */
router.use((req, res, next) => {
  // Log ALL requests to the MCP router
  log(`🌐 MCP Router request: ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    log(`🌐 MCP Router body preview: ${JSON.stringify(req.body).substring(0, 200)}...`);
  }
  
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, mcp-protocol-version, Authorization',
    'Access-Control-Max-Age': '3600'
  });
  next();
});

/** ---------- Hardening: allow HEAD/OPTIONS on root ---------- */
router.head('/', (_req, res) => {
  res.set('Content-Type', 'application/json; charset=utf-8');
  // Don't send a body on HEAD; keep headers compatible
  res.status(200).end();
});

router.options('/', (_req, res) => {
  res.set({
    'Allow': 'GET,POST,HEAD,OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.status(200).end();
});

/** ---------- Root Endpoint - Handle both SSE (GET) and JSON-RPC (POST) ---------- */
router.get('/', async (req, res) => {
  if (!mcpInitialized) {
    return res.status(503).json({
      error: 'MCP SDK not available',
      message: 'Install with: npm install @modelcontextprotocol/sdk'
    });
  }
  
  log('📡 SSE connection request', { ua: req.headers['user-agent'] });
  
  try {
    // Create SSE transport
    sseTransport = new SSEServerTransport('/gads/mcp/messages', res);
    
    // Add transport-level logging
    const originalSend = sseTransport.send?.bind(sseTransport);
    if (originalSend) {
      sseTransport.send = (message) => {
        log('🚀 SSE sending message:', JSON.stringify(message, null, 2));
        return originalSend(message);
      };
    }
    
    // Connect MCP server to SSE transport
    await mcpServer.connect(sseTransport);
    
    log('✅ SSE transport connected');
  } catch (error) {
    log('❌ SSE connection failed:', error.message);
    res.status(500).json({ error: 'SSE connection failed', details: error.message });
  }
});

/** ---------- Root Endpoint - Handle JSON-RPC POST requests ---------- */
router.post('/', async (req, res) => {
  log('🔍 ROOT POST REQUEST - Claude Desktop sent JSON-RPC to root endpoint');
  log('🔍 Root POST body:', JSON.stringify(req.body, null, 2));
  
  if (!mcpInitialized) {
    return res.status(503).json({
      error: 'MCP SDK not available',
      message: 'Connect to SSE endpoint first'
    });
  }

  // Handle the same way as /messages endpoint
  if (req.body?.method === 'notifications/initialized') {
    log('🔔 NOTIFICATIONS/INITIALIZED at ROOT - returning 202');
    res.status(202).json({
      jsonrpc: '2.0',
      id: req.body.id || null
    });
    return;
  }

  // For tools/call, always handle directly (bypass SSE transport issues)  
  if (req.body?.method === 'tools/call') {
    log('🔧 🎯 TOOLS/CALL - handling directly at root (bypass SSE)');
    log('🔧 🚨 Tool call params:', JSON.stringify(req.body.params, null, 2));
    
    // Handle echo tool
    if (req.body.params?.name === 'echo') {
      log('📢 Echo tool called at root endpoint');
      
      const message = req.body.params?.arguments?.message || 'No message provided';
      
      const response = {
        jsonrpc: '2.0',
        id: req.body.id || 0,
        result: {
          content: [
            {
              type: 'text',
              text: `Echo: ${message}`
            }
          ]
        }
      };
      
      log('📤 Sending echo response:', JSON.stringify(response, null, 2));
      return res.status(200).json(response);
    }
    
    // Handle Google Ads Account Overview tool directly  
    if (req.body.params?.name === 'google_ads_account_overview') {
      log('🏢 Google Ads Account Overview tool called at root endpoint');
      
      const { account_id = process.env.GADS_LIVE_ID, include_campaigns = true, date_range_days = 30 } = req.body.params.arguments || {};
      
      try {
        const customer = googleAdsClient.Customer({
          customer_id: account_id,
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
          login_customer_id: process.env.GADS_LIVE_MCC_ID
        });

        log('🔍 Querying Google Ads API for account:', account_id);

        // Get account basic info
        const accountQuery = `
          SELECT 
            customer.id,
            customer.descriptive_name,
            customer.currency_code,
            customer.time_zone,
            customer.test_account,
            customer.auto_tagging_enabled,
            customer.conversion_tracking_setting.conversion_tracking_id,
            customer.optimization_score
          FROM customer 
          LIMIT 1
        `;

        const accountResults = await customer.query(accountQuery);
        const accountInfo = accountResults[0]?.customer || {};

        let campaignData = [];
        let summary = {};

        if (include_campaigns) {
          // Get campaign overview with performance metrics
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - date_range_days);
          const endDate = new Date();
          
          const campaignQuery = `
            SELECT 
              campaign.id,
              campaign.name,
              campaign.status,
              campaign.advertising_channel_type,
              campaign.bidding_strategy_type,
              metrics.clicks,
              metrics.impressions,
              metrics.cost_micros,
              metrics.conversions,
              metrics.conversions_value,
              metrics.ctr,
              metrics.average_cpc
            FROM campaign 
            WHERE segments.date BETWEEN '${startDate.toISOString().split('T')[0]}' AND '${endDate.toISOString().split('T')[0]}'
          `;

          log('🔍 Querying campaign data for date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);

          const campaignResults = await customer.query(campaignQuery);
          
          // Process campaign data
          const campaignMap = new Map();
          campaignResults.forEach(row => {
            const campaignId = row.campaign.id;
            if (!campaignMap.has(campaignId)) {
              campaignMap.set(campaignId, {
                id: campaignId,
                name: row.campaign.name,
                status: row.campaign.status,
                type: row.campaign.advertising_channel_type,
                budget: row.campaign.campaign_budget,
                bidding_strategy: row.campaign.bidding_strategy_type,
                optimization_score: row.campaign.optimization_score,
                metrics: {
                  clicks: 0,
                  impressions: 0,
                  cost: 0,
                  conversions: 0,
                  conversion_value: 0,
                  ctr: 0,
                  avg_cpc: 0
                }
              });
            }
            
            const campaign = campaignMap.get(campaignId);
            campaign.metrics.clicks += row.metrics.clicks || 0;
            campaign.metrics.impressions += row.metrics.impressions || 0;
            campaign.metrics.cost += (row.metrics.cost_micros || 0) / 1000000;
            campaign.metrics.conversions += row.metrics.conversions || 0;
            campaign.metrics.conversion_value += row.metrics.conversions_value || 0;
            campaign.metrics.ctr = row.metrics.ctr || 0;
            campaign.metrics.avg_cpc = (row.metrics.average_cpc || 0) / 1000000;
          });

          campaignData = Array.from(campaignMap.values());
          log('🔍 Processed', campaignData.length, 'campaigns');

          // Calculate account summary
          summary = {
            total_campaigns: campaignData.length,
            active_campaigns: campaignData.filter(c => c.status === 'ENABLED').length,
            total_clicks: campaignData.reduce((sum, c) => sum + c.metrics.clicks, 0),
            total_impressions: campaignData.reduce((sum, c) => sum + c.metrics.impressions, 0),
            total_cost: campaignData.reduce((sum, c) => sum + c.metrics.cost, 0),
            total_conversions: campaignData.reduce((sum, c) => sum + c.metrics.conversions, 0),
            total_conversion_value: campaignData.reduce((sum, c) => sum + c.metrics.conversion_value, 0)
          };
        }

        const reportText = `# 📊 Google Ads Account Overview

## 🏢 Account Information
- **Account:** ${accountInfo.descriptive_name} (${accountInfo.id})
- **Currency:** ${accountInfo.currency_code}
- **Timezone:** ${accountInfo.time_zone}
- **Test Account:** ${accountInfo.test_account ? 'Yes' : 'No'}
- **Auto-tagging:** ${accountInfo.auto_tagging_enabled ? 'Enabled' : 'Disabled'}
- **Optimization Score:** ${accountInfo.optimization_score || 'N/A'}

${include_campaigns ? `## 📈 Performance Summary (Last ${date_range_days} days)
- **Total Campaigns:** ${summary.total_campaigns} (${summary.active_campaigns} active)
- **Total Clicks:** ${summary.total_clicks.toLocaleString()}
- **Total Impressions:** ${summary.total_impressions.toLocaleString()}
- **Total Cost:** €${summary.total_cost.toFixed(2)}
- **Total Conversions:** ${summary.total_conversions}
- **Total Conversion Value:** €${summary.total_conversion_value.toFixed(2)}

## 🎯 Campaign Breakdown
${campaignData.map(campaign => `
### ${campaign.name}
- **Status:** ${campaign.status}
- **Type:** ${campaign.type}
- **Optimization Score:** ${campaign.optimization_score || 'N/A'}
- **Clicks:** ${campaign.metrics.clicks} | **Impressions:** ${campaign.metrics.impressions}
- **Cost:** €${campaign.metrics.cost.toFixed(2)} | **Conversions:** ${campaign.metrics.conversions}
- **CTR:** ${(campaign.metrics.ctr * 100).toFixed(2)}% | **Avg CPC:** €${campaign.metrics.avg_cpc.toFixed(2)}
`).join('')}` : ''}

*Generated: ${new Date().toISOString()}*`;

        const toolResponse = {
          jsonrpc: '2.0',
          id: req.body.id || 0,
          result: {
            content: [{
              type: 'text',
              text: reportText
            }]
          }
        };

        log('✅ Google Ads Account Overview completed successfully');
        log('📤 Sending tool response with', campaignData.length, 'campaigns');
        
        return res.status(200).json(toolResponse);

      } catch (error) {
        log('❌ Google Ads Account Overview failed:', error.message);
        log('❌ Error details:', error);
        
        const errorResponse = {
          jsonrpc: '2.0',
          id: req.body.id || 0,
          result: {
            content: [{
              type: 'text',
              text: `❌ **Error getting Google Ads account overview:**\n\n${error.message}\n\nPlease check your Google Ads API credentials and account access.`
            }]
          }
        };
        
        return res.status(200).json(errorResponse);
      }
    }
    
    // Return error for unknown tools
    return res.status(400).json({
      jsonrpc: '2.0',
      id: req.body.id || 0,
      error: {
        code: -32601,
        message: `Tool not found: ${req.body.params?.name}`
      }
    });
  }

  // For other requests, handle properly even without existing transport
  if (!sseTransport) {
    log('⚠️ No SSE transport for root POST - handling initialize directly');
    
    // Handle various MCP requests directly without SSE transport
    if (req.body?.method === 'initialize') {
      log('🔧 Handling initialize at root without SSE transport');
      
      // Send a proper MCP initialize response
      const initResponse = {
        jsonrpc: '2.0',
        id: req.body.id || 0,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: {
            tools: { listChanged: true },
            resources: {},
            prompts: {}
          },
          serverInfo: {
            name: 'ulearn-mcp-server',
            version: '1.0.5'
          }
        }
      };
      
      log('📤 Sending initialize response:', JSON.stringify(initResponse, null, 2));
      return res.status(200).json(initResponse);
    }
    
    if (req.body?.method === 'tools/list') {
      log('🔧 Handling tools/list at root - CRITICAL DISCOVERY!');
      
      const toolsResponse = {
        jsonrpc: '2.0',
        id: req.body.id || 0,
        result: {
          tools: [
            {
              name: 'echo',
              description: 'Simple echo tool that returns whatever message you send to it',
              inputSchema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    description: 'The message to echo back'
                  }
                },
                required: ['message']
              }
            },
            {
              name: 'google_ads_account_overview',
              description: 'Get comprehensive Google Ads account overview with campaign performance data',
              inputSchema: {
                type: 'object',
                properties: {
                  account_id: {
                    type: 'string',
                    description: 'Google Ads account ID (default: live account)'
                  },
                  include_campaigns: {
                    type: 'boolean',
                    description: 'Include detailed campaign information',
                    default: true
                  },
                  date_range_days: {
                    type: 'number',
                    description: 'Number of days for performance metrics',
                    default: 30
                  }
                }
              }
            },
            {
              name: 'google_ads_campaign_analysis',
              description: 'Analyze campaign settings, bidding strategies, targeting, and optimization configurations',
              inputSchema: {
                type: 'object',
                properties: {
                  account_id: {
                    type: 'string',
                    description: 'Google Ads account ID (default: live account)'
                  },
                  campaign_id: {
                    type: 'string',
                    description: 'Specific campaign ID to analyze (optional - analyzes all if not provided)'
                  },
                  include_targeting: {
                    type: 'boolean',
                    description: 'Include detailed targeting settings analysis',
                    default: true
                  },
                  include_bidding: {
                    type: 'boolean',
                    description: 'Include detailed bidding strategy analysis',
                    default: true
                  }
                }
              }
            }
          ]
        }
      };
      
      log('📤 Sending tools/list response:', JSON.stringify(toolsResponse, null, 2));
      return res.status(200).json(toolsResponse);
    }
    
    if (req.body?.method === 'prompts/list') {
      log('🔧 Handling prompts/list at root');
      
      const promptsResponse = {
        jsonrpc: '2.0',
        id: req.body.id || 0,
        result: {
          prompts: []
        }
      };
      
      log('📤 Sending prompts/list response:', JSON.stringify(promptsResponse, null, 2));
      return res.status(200).json(promptsResponse);
    }
    
    if (req.body?.method === 'resources/list') {
      log('🔧 Handling resources/list at root');
      
      const resourcesResponse = {
        jsonrpc: '2.0',
        id: req.body.id || 0,
        result: {
          resources: []
        }
      };
      
      log('📤 Sending resources/list response:', JSON.stringify(resourcesResponse, null, 2));
      return res.status(200).json(resourcesResponse);
    }
    
    if (req.body?.method === 'tools/call') {
      log('🔧 🚨 TOOLS/CALL request at ROOT endpoint!');
      log('🔧 🚨 Tool call params:', JSON.stringify(req.body.params, null, 2));
      
      // Handle echo tool
      if (req.body.params?.name === 'echo') {
        log('📢 Echo tool called at root endpoint');
        
        const message = req.body.params?.arguments?.message || 'No message provided';
        
        const response = {
          jsonrpc: '2.0',
          id: req.body.id || 0,
          result: {
            content: [
              {
                type: 'text',
                text: `Echo: ${message}`
              }
            ]
          }
        };
        
        log('📤 Sending echo response:', JSON.stringify(response, null, 2));
        return res.status(200).json(response);
      }
      
      // Handle Google Ads tools directly
      if (req.body.params?.name === 'google_ads_account_overview') {
        log('🏢 Google Ads Account Overview tool called at root endpoint');
        
        const { account_id = process.env.GADS_LIVE_ID, include_campaigns = true, date_range_days = 30 } = req.body.params.arguments || {};
        
        try {
          const customer = googleAdsClient.Customer({
            customer_id: account_id,
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
            login_customer_id: process.env.GADS_LIVE_MCC_ID
          });

          log('🔍 Querying Google Ads API for account:', account_id);

          // Get account basic info
          const accountQuery = `
            SELECT 
              customer.id,
              customer.descriptive_name,
              customer.currency_code,
              customer.time_zone,
              customer.test_account,
              customer.auto_tagging_enabled,
              customer.conversion_tracking_setting.conversion_tracking_id,
              customer.optimization_score
            FROM customer 
            LIMIT 1
          `;

          const accountResults = await customer.query(accountQuery);
          const accountInfo = accountResults[0]?.customer || {};

          let campaignData = [];
          let summary = {};

          if (include_campaigns) {
            // Get campaign overview with performance metrics
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - date_range_days);
            const endDate = new Date();
            
            const campaignQuery = `
              SELECT 
                campaign.id,
                campaign.name,
                campaign.status,
                campaign.advertising_channel_type,
                campaign.bidding_strategy_type,
                metrics.clicks,
                metrics.impressions,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversions_value,
                metrics.ctr,
                metrics.average_cpc
              FROM campaign 
              WHERE segments.date BETWEEN '${startDate.toISOString().split('T')[0]}' AND '${endDate.toISOString().split('T')[0]}'
            `;

            log('🔍 Querying campaign data for date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);

            const campaignResults = await customer.query(campaignQuery);
            
            // Process campaign data
            const campaignMap = new Map();
            campaignResults.forEach(row => {
              const campaignId = row.campaign.id;
              if (!campaignMap.has(campaignId)) {
                campaignMap.set(campaignId, {
                  id: campaignId,
                  name: row.campaign.name,
                  status: row.campaign.status,
                  type: row.campaign.advertising_channel_type,
                  budget: row.campaign.campaign_budget,
                  bidding_strategy: row.campaign.bidding_strategy_type,
                  optimization_score: row.campaign.optimization_score,
                  metrics: {
                    clicks: 0,
                    impressions: 0,
                    cost: 0,
                    conversions: 0,
                    conversion_value: 0,
                    ctr: 0,
                    avg_cpc: 0
                  }
                });
              }
              
              const campaign = campaignMap.get(campaignId);
              campaign.metrics.clicks += row.metrics.clicks || 0;
              campaign.metrics.impressions += row.metrics.impressions || 0;
              campaign.metrics.cost += (row.metrics.cost_micros || 0) / 1000000;
              campaign.metrics.conversions += row.metrics.conversions || 0;
              campaign.metrics.conversion_value += row.metrics.conversions_value || 0;
              campaign.metrics.ctr = row.metrics.ctr || 0;
              campaign.metrics.avg_cpc = (row.metrics.average_cpc || 0) / 1000000;
            });

            campaignData = Array.from(campaignMap.values());
            log('🔍 Processed', campaignData.length, 'campaigns');

            // Calculate account summary
            summary = {
              total_campaigns: campaignData.length,
              active_campaigns: campaignData.filter(c => c.status === 'ENABLED').length,
              total_clicks: campaignData.reduce((sum, c) => sum + c.metrics.clicks, 0),
              total_impressions: campaignData.reduce((sum, c) => sum + c.metrics.impressions, 0),
              total_cost: campaignData.reduce((sum, c) => sum + c.metrics.cost, 0),
              total_conversions: campaignData.reduce((sum, c) => sum + c.metrics.conversions, 0),
              total_conversion_value: campaignData.reduce((sum, c) => sum + c.metrics.conversion_value, 0)
            };
          }

          const reportText = `# 📊 Google Ads Account Overview

## 🏢 Account Information
- **Account:** ${accountInfo.descriptive_name} (${accountInfo.id})
- **Currency:** ${accountInfo.currency_code}
- **Timezone:** ${accountInfo.time_zone}
- **Test Account:** ${accountInfo.test_account ? 'Yes' : 'No'}
- **Auto-tagging:** ${accountInfo.auto_tagging_enabled ? 'Enabled' : 'Disabled'}
- **Optimization Score:** ${accountInfo.optimization_score || 'N/A'}

${include_campaigns ? `## 📈 Performance Summary (Last ${date_range_days} days)
- **Total Campaigns:** ${summary.total_campaigns} (${summary.active_campaigns} active)
- **Total Clicks:** ${summary.total_clicks.toLocaleString()}
- **Total Impressions:** ${summary.total_impressions.toLocaleString()}
- **Total Cost:** €${summary.total_cost.toFixed(2)}
- **Total Conversions:** ${summary.total_conversions}
- **Total Conversion Value:** €${summary.total_conversion_value.toFixed(2)}

## 🎯 Campaign Breakdown
${campaignData.map(campaign => `
### ${campaign.name}
- **Status:** ${campaign.status}
- **Type:** ${campaign.type}
- **Optimization Score:** ${campaign.optimization_score || 'N/A'}
- **Clicks:** ${campaign.metrics.clicks} | **Impressions:** ${campaign.metrics.impressions}
- **Cost:** €${campaign.metrics.cost.toFixed(2)} | **Conversions:** ${campaign.metrics.conversions}
- **CTR:** ${(campaign.metrics.ctr * 100).toFixed(2)}% | **Avg CPC:** €${campaign.metrics.avg_cpc.toFixed(2)}
`).join('')}` : ''}

*Generated: ${new Date().toISOString()}*`;

          const toolResponse = {
            jsonrpc: '2.0',
            id: req.body.id || 0,
            result: {
              content: [{
                type: 'text',
                text: reportText
              }]
            }
          };

          log('✅ Google Ads Account Overview completed successfully');
          log('📤 Sending tool response with', campaignData.length, 'campaigns');
          
          return res.status(200).json(toolResponse);

        } catch (error) {
          log('❌ Google Ads Account Overview failed:', error.message);
          log('❌ Error details:', error);
          
          const errorResponse = {
            jsonrpc: '2.0',
            id: req.body.id || 0,
            result: {
              content: [{
                type: 'text',
                text: `❌ **Error getting Google Ads account overview:**\n\n${error.message}\n\nPlease check your Google Ads API credentials and account access.`
              }]
            }
          };
          
          return res.status(200).json(errorResponse);
        }
      }

      if (req.body.params?.name === 'google_ads_campaign_analysis') {
        log('🎯 Google Ads Campaign Analysis tool called at root endpoint');
        
        // This tool is complex and should be handled by the MCP SDK
        // For now, redirect to SSE transport
        return res.status(503).json({
          jsonrpc: '2.0',
          id: req.body.id || 0,
          error: {
            code: -32603,
            message: 'Campaign analysis tool should be handled via SSE transport. Please ensure SSE connection is established.'
          }
        });
      }
      
      // For other tools, return error
      return res.status(400).json({
        jsonrpc: '2.0',
        id: req.body.id || 0,
        error: {
          code: -32601,
          message: `Tool not found: ${req.body.params?.name}`
        }
      });
    }
    
    // For other methods when no SSE transport, return error
    return res.status(503).json({
      error: 'No active SSE connection',
      message: 'Establish SSE connection first via GET /'
    });
  }

  // If we have SSE transport, use it for other methods
  try {
    // Add response logging for root POST too
    const originalJSON = res.json?.bind(res);
    if (originalJSON) {
      res.json = (obj) => {
        log('📤 ROOT POST Response (json):', JSON.stringify(obj, null, 2));
        if (req.body?.method === 'initialize') {
          log('🚨 ROOT INITIALIZE RESPONSE - Critical!');
        }
        return originalJSON(obj);
      };
    }
    
    // Handle through existing SSE transport
    log('🔄 Delegating to SSE transport handlePostMessage');
    log('🔄 Request method:', req.body?.method);
    log('🔄 Request params:', req.body?.params?.name);
    
    await sseTransport.handlePostMessage(req, res);
    log('✅ Root POST message handled successfully via SSE transport');
  } catch (error) {
    log('❌ Root POST handling failed:', error.message);
    res.status(500).json({
      error: 'Message handling failed',
      details: error.message
    });
  }
});

/** ---------- Health check ---------- */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** ---------- Simple HTTP echo (manual poke) ---------- */
router.all('/echo', (req, res) => {
  res.json({
    success: true,
    method: req.method,
    received: req.method === 'GET' ? (req.query || {}) : (req.body || {}),
    timestamp: new Date().toISOString(),
  });
});

/** ---------- Debug: Manual tools list ---------- */
router.get('/debug-tools', async (req, res) => {
  if (!mcpInitialized) {
    return res.status(503).json({ error: 'MCP not initialized' });
  }
  
  try {
    // Try to get tools directly from the server
    const tools = mcpServer._tools || mcpServer.tools || {};
    log('🔍 Debug - Available tools:', Object.keys(tools));
    
    // Try to manually call the tools/list method
    const toolsListResponse = await mcpServer.handleRequest({
      method: 'tools/list',
      params: {},
      jsonrpc: '2.0',
      id: 'debug-1'
    });
    
    log('🔍 Debug - tools/list response:', JSON.stringify(toolsListResponse, null, 2));
    
    res.json({
      toolsKeys: Object.keys(tools),
      toolsListResponse,
      mcpServerStatus: 'initialized',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log('🔍 Debug error:', error.message);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

/** ---------- Messages Endpoint (POST /messages) ---------- */
router.post('/messages', async (req, res) => {
  // Log ALL incoming raw requests before any processing
  log('🔍 RAW MESSAGE ENDPOINT HIT');
  log('🔍 Headers:', JSON.stringify(req.headers, null, 2));
  log('🔍 Raw body:', JSON.stringify(req.body, null, 2));
  if (!mcpInitialized || !sseTransport) {
    return res.status(503).json({
      error: 'SSE transport not available',
      message: 'Connect to SSE endpoint first'
    });
  }

  log('📨 Message received for SSE transport');
  log('📨 Request body:', JSON.stringify(req.body, null, 2));
  log('📨 Request method detected:', req.body?.method);
  
  // Log specific MCP method types
  if (req.body?.method === 'tools/list') {
    log('🔧 TOOLS/LIST request detected!');
  } else if (req.body?.method === 'tools/call') {
    log('🔧 🚨 TOOLS/CALL request detected in /messages endpoint!');
    log('🔧 🚨 Tool call params:', JSON.stringify(req.body.params, null, 2));
  } else if (req.body?.method === 'initialize') {
    log('🔧 INITIALIZE request detected');
    // Log the full initialize params
    log('🔧 Initialize params:', JSON.stringify(req.body.params, null, 2));
  } else if (req.body?.method === 'notifications/initialized') {
    log('🔔 NOTIFICATIONS/INITIALIZED request detected - CRITICAL FOR ENABLING!');
  } else {
    log('🔧 OTHER METHOD in /messages:', req.body?.method);
  }
  
  // Special handling for notifications/initialized - must return 202!
  if (req.body?.method === 'notifications/initialized') {
    log('🔔 Handling notifications/initialized with 202 status');
    res.status(202).json({
      jsonrpc: '2.0',
      id: req.body.id || null
    });
    return;
  }
  
  try {
    // Capture response before sending
    const originalSend = res.send?.bind(res);
    const originalJSON = res.json?.bind(res);
    
    if (originalSend) {
      res.send = (body) => {
        log('📤 HTTP Response (send):', body);
        return originalSend(body);
      };
    }
    
    if (originalJSON) {
      res.json = (obj) => {
        log('📤 HTTP Response (json):', JSON.stringify(obj, null, 2));
        if (req.body?.method === 'initialize') {
          log('🚨 INITIALIZE RESPONSE - This might be the key!');
        }
        return originalJSON(obj);
      };
    }
    
    // Handle the POST message through SSE transport
    await sseTransport.handlePostMessage(req, res);
    log('✅ Message handled successfully');
  } catch (error) {
    log('❌ Message handling failed:', error.message);
    log('❌ Error details:', error);
    res.status(500).json({ 
      error: 'Message handling failed', 
      details: error.message 
    });
  }
});

/** ---------- Extra: help for wrong paths ---------- */
router.all('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    hint: 'Use / (GET/POST), /health, or /echo',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
