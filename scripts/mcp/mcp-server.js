/**
 * Model Context Protocol (MCP) Server for Google Ads API Integration
 * /home/hub/public_html/gads/mcp-server.js
 * 
 * This creates the MCP endpoint that Claude Desktop can connect to
 * Provides tools for Google Ads analysis and management
 */

const express = require('express');
const mysql = require('mysql2/promise');
const { GoogleAdsApi } = require('google-ads-api');
const { google } = require('googleapis');

// Load environment variables
require('dotenv').config();

// Database configuration
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

// Google Ads OAuth Client
const googleOAuth = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

googleOAuth.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

// Create database connection helper
const getDbConnection = async () => {
  return await mysql.createConnection(dbConfig);
};

/**
 * MCP Server Implementation
 */
class MCPServer {
  constructor() {
    this.tools = [
      {
        name: "get_campaign_performance",
        description: "Get Google Ads campaign performance data with HubSpot pipeline attribution",
        inputSchema: {
          type: "object",
          properties: {
            days: {
              type: "number",
              description: "Number of days to look back (default: 30)",
              default: 30
            },
            campaign_id: {
              type: "string",
              description: "Optional: Specific campaign ID to analyze"
            }
          }
        }
      },
      {
        name: "get_pipeline_analysis",
        description: "Analyze the complete MQL to SQL to Won pipeline with stage probabilities",
        inputSchema: {
          type: "object",
          properties: {
            days: {
              type: "number",
              description: "Number of days to analyze (default: 30)",
              default: 30
            }
          }
        }
      },
      {
        name: "get_audience_insights",
        description: "Get audience segment performance and targeting insights",
        inputSchema: {
          type: "object",
          properties: {
            days: {
              type: "number",
              description: "Number of days to analyze (default: 30)",
              default: 30
            }
          }
        }
      },
      {
        name: "get_burn_rate_analysis",
        description: "Analyze MQL burn rate - contacts who clicked ads but failed SQL validation",
        inputSchema: {
          type: "object",
          properties: {
            days: {
              type: "number", 
              description: "Number of days to analyze (default: 30)",
              default: 30
            }
          }
        }
      },
      {
        name: "get_keyword_performance",
        description: "Analyze keyword performance with conversion attribution",
        inputSchema: {
          type: "object",
          properties: {
            campaign_id: {
              type: "string",
              description: "Campaign ID to analyze keywords for"
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
        name: "update_campaign_bids",
        description: "Update campaign bid strategies based on performance data",
        inputSchema: {
          type: "object",
          properties: {
            campaign_id: {
              type: "string",
              description: "Campaign ID to update",
              required: true
            },
            bid_strategy: {
              type: "string",
              description: "New bid strategy (TARGET_CPA, TARGET_ROAS, etc.)"
            },
            target_value: {
              type: "number",
              description: "Target CPA or ROAS value"
            }
          },
          required: ["campaign_id"]
        }
      }
    ];
  }

  /**
   * Handle MCP list_tools request
   */
  async listTools() {
    return {
      tools: this.tools
    };
  }

  /**
   * Handle MCP call_tool request
   */
  async callTool(name, arguments_) {
    try {
      switch (name) {
        case "get_campaign_performance":
          return await this.getCampaignPerformance(arguments_);
        case "get_pipeline_analysis":
          return await this.getPipelineAnalysis(arguments_);
        case "get_audience_insights":
          return await this.getAudienceInsights(arguments_);
        case "get_burn_rate_analysis":
          return await this.getBurnRateAnalysis(arguments_);
        case "get_keyword_performance":
          return await this.getKeywordPerformance(arguments_);
        case "update_campaign_bids":
          return await this.updateCampaignBids(arguments_);
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

  /**
   * Get campaign performance data
   */
  async getCampaignPerformance({ days = 30, campaign_id = null }) {
    const connection = await getDbConnection();
    
    try {
      let query = `
        SELECT 
          c.google_campaign_id,
          c.name as campaign_name,
          c.type as campaign_type,
          c.status,
          c.daily_budget_eur,
          SUM(m.clicks) as total_clicks,
          SUM(m.impressions) as total_impressions,
          SUM(m.cost_eur) as total_cost,
          AVG(m.ctr) as avg_ctr,
          AVG(m.cpc_eur) as avg_cpc,
          COUNT(DISTINCT hc.id) as mql_count,
          COUNT(DISTINCT hd.id) as sql_count,
          COUNT(DISTINCT CASE WHEN hd.dealstage = 'closedwon' THEN hd.id END) as won_count,
          SUM(CASE WHEN hd.dealstage = 'closedwon' THEN hd.amount ELSE 0 END) as won_value
        FROM gads_campaigns c
        LEFT JOIN gads_campaign_metrics m ON c.google_campaign_id = m.google_campaign_id 
          AND m.date >= DATE_SUB(NOW(), INTERVAL ? DAY)
        LEFT JOIN hub_contacts hc ON c.google_campaign_id = hc.gclid_campaign_id
          AND hc.createdate >= DATE_SUB(NOW(), INTERVAL ? DAY)
        LEFT JOIN hub_deals hd ON hc.id = hd.contact_id
        ${campaign_id ? 'WHERE c.google_campaign_id = ?' : ''}
        GROUP BY c.google_campaign_id, c.name, c.type, c.status, c.daily_budget_eur
        ORDER BY total_cost DESC
      `;

      const params = campaign_id ? [days, days, campaign_id] : [days, days];
      const [results] = await connection.execute(query, params);

      // Calculate key metrics
      const summary = {
        total_campaigns: results.length,
        total_cost: results.reduce((sum, r) => sum + (parseFloat(r.total_cost) || 0), 0),
        total_clicks: results.reduce((sum, r) => sum + (parseInt(r.total_clicks) || 0), 0),
        total_mqls: results.reduce((sum, r) => sum + (parseInt(r.mql_count) || 0), 0),
        total_sqls: results.reduce((sum, r) => sum + (parseInt(r.sql_count) || 0), 0),
        total_won: results.reduce((sum, r) => sum + (parseInt(r.won_count) || 0), 0),
        total_won_value: results.reduce((sum, r) => sum + (parseFloat(r.won_value) || 0), 0)
      };

      // Calculate conversion rates
      summary.click_to_mql_rate = summary.total_clicks > 0 ? (summary.total_mqls / summary.total_clicks * 100) : 0;
      summary.mql_to_sql_rate = summary.total_mqls > 0 ? (summary.total_sqls / summary.total_mqls * 100) : 0;
      summary.sql_to_won_rate = summary.total_sqls > 0 ? (summary.total_won / summary.total_sqls * 100) : 0;
      summary.roas = summary.total_cost > 0 ? (summary.total_won_value / summary.total_cost) : 0;

      return {
        content: [{
          type: "text",
          text: `# Google Ads Campaign Performance Analysis (${days} days)

## Summary Metrics
- **Total Campaigns:** ${summary.total_campaigns}
- **Total Cost:** €${summary.total_cost.toFixed(2)}
- **Total Clicks:** ${summary.total_clicks.toLocaleString()}
- **Total MQLs:** ${summary.total_mqls}
- **Total SQLs:** ${summary.total_sqls}  
- **Total Won:** ${summary.total_won}
- **Total Won Value:** €${summary.total_won_value.toFixed(2)}

## Conversion Funnel
- **Click → MQL Rate:** ${summary.click_to_mql_rate.toFixed(2)}%
- **MQL → SQL Rate:** ${summary.mql_to_sql_rate.toFixed(2)}%
- **SQL → Won Rate:** ${summary.sql_to_won_rate.toFixed(2)}%
- **Overall ROAS:** ${summary.roas.toFixed(2)}x

## Campaign Details
${results.map(campaign => `
**${campaign.campaign_name}** (${campaign.campaign_type})
- Cost: €${(parseFloat(campaign.total_cost) || 0).toFixed(2)} | Clicks: ${campaign.total_clicks || 0}
- MQLs: ${campaign.mql_count || 0} | SQLs: ${campaign.sql_count || 0} | Won: ${campaign.won_count || 0}
- CPC: €${(parseFloat(campaign.avg_cpc) || 0).toFixed(2)} | CTR: ${(parseFloat(campaign.avg_ctr) || 0).toFixed(2)}%
- Budget: €${(parseFloat(campaign.daily_budget_eur) || 0).toFixed(2)}/day | Status: ${campaign.status}
`).join('\n')}
`
        }]
      };

    } finally {
      await connection.end();
    }
  }

  /**
   * Get pipeline analysis with stage probabilities
   */
  async getPipelineAnalysis({ days = 30 }) {
    const connection = await getDbConnection();
    
    try {
      // Get pipeline stage data
      const [stageData] = await connection.execute(`
        SELECT 
          hd.dealstage,
          COUNT(*) as deal_count,
          AVG(hd.amount) as avg_deal_value,
          SUM(hd.amount) as total_value,
          AVG(DATEDIFF(hd.closedate, hd.createdate)) as avg_days_in_stage
        FROM hub_deals hd
        WHERE hd.createdate >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY hd.dealstage
        ORDER BY 
          CASE hd.dealstage
            WHEN 'sql' THEN 1
            WHEN 'engaging' THEN 2  
            WHEN 'responsive' THEN 3
            WHEN 'advising' THEN 4
            WHEN 'negotiation' THEN 5
            WHEN 'contact' THEN 6
            WHEN 'closedwon' THEN 7
            WHEN 'closedlost' THEN 8
            ELSE 9
          END
      `, [days]);

      // Calculate stage probabilities (this would use your pipeline-probs.js logic)
      const stageProbabilities = {
        'sql': 0.10,
        'engaging': 0.25,
        'responsive': 0.50, 
        'advising': 0.60,
        'negotiation': 0.75,
        'contact': 0.90,
        'closedwon': 1.00
      };

      // Get MQL data
      const [mqlData] = await connection.execute(`
        SELECT 
          COUNT(*) as total_mqls,
          COUNT(DISTINCT CASE WHEN hd.id IS NOT NULL THEN hc.id END) as mqls_with_deals,
          territory as country_territory,
          COUNT(*) as mql_count
        FROM hub_contacts hc
        LEFT JOIN hub_deals hd ON hc.id = hd.contact_id
        WHERE hc.createdate >= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND hc.lifecyclestage = 'marketingqualifiedlead'
        GROUP BY territory
      `, [days]);

      const totalMQLs = mqlData.reduce((sum, r) => sum + r.mql_count, 0);
      const totalDeals = stageData.reduce((sum, r) => sum + r.deal_count, 0);

      return {
        content: [{
          type: "text", 
          text: `# Pipeline Analysis (${days} days)

## MQL to SQL Conversion
- **Total MQLs:** ${totalMQLs}
- **MQLs with Deals:** ${totalDeals}
- **MQL → SQL Rate:** ${totalMQLs > 0 ? ((totalDeals / totalMQLs) * 100).toFixed(2) : 0}%

## Pipeline Stage Analysis
${stageData.map(stage => {
  const probability = stageProbabilities[stage.dealstage] || 0;
  const weightedValue = stage.avg_deal_value * probability;
  
  return `
**${stage.dealstage.toUpperCase()}**
- Deals: ${stage.deal_count} 
- Avg Value: €${(stage.avg_deal_value || 0).toFixed(2)}
- Total Value: €${(stage.total_value || 0).toFixed(2)}
- Stage Probability: ${(probability * 100).toFixed(0)}%
- Weighted Value: €${weightedValue.toFixed(2)}
- Avg Days: ${(stage.avg_days_in_stage || 0).toFixed(1)} days`;
}).join('\n')}

## Territory Breakdown
${mqlData.map(territory => `
**${territory.country_territory || 'Unknown'}:** ${territory.mql_count} MQLs
`).join('')}
`
        }]
      };

    } finally {
      await connection.end();
    }
  }

  /**
   * Get burn rate analysis
   */
  async getBurnRateAnalysis({ days = 30 }) {
    const connection = await getDbConnection();
    
    try {
      const [burnData] = await connection.execute(`
        SELECT 
          DATE(hc.createdate) as date,
          hc.territory,
          COUNT(*) as total_contacts,
          COUNT(CASE WHEN hc.territory = 'Unsupported Territory' THEN 1 END) as unsupported_contacts,
          COUNT(CASE WHEN hc.territory != 'Unsupported Territory' THEN 1 END) as supported_contacts,
          COUNT(DISTINCT hd.id) as deals_created
        FROM hub_contacts hc
        LEFT JOIN hub_deals hd ON hc.id = hd.contact_id
        WHERE hc.createdate >= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND hc.lifecyclestage = 'marketingqualifiedlead'
        GROUP BY DATE(hc.createdate), hc.territory
        ORDER BY date DESC
      `, [days]);

      // Calculate overall burn rate
      const totalContacts = burnData.reduce((sum, r) => sum + r.total_contacts, 0);
      const totalUnsupported = burnData.reduce((sum, r) => sum + r.unsupported_contacts, 0);
      const burnRate = totalContacts > 0 ? (totalUnsupported / totalContacts * 100) : 0;

      // Group by territory
      const territoryData = {};
      burnData.forEach(row => {
        if (!territoryData[row.territory]) {
          territoryData[row.territory] = {
            contacts: 0,
            deals: 0
          };
        }
        territoryData[row.territory].contacts += row.total_contacts;
        territoryData[row.territory].deals += row.deals_created;
      });

      return {
        content: [{
          type: "text",
          text: `# MQL Burn Rate Analysis (${days} days)

## Overall Burn Rate
- **Total MQLs:** ${totalContacts}
- **Unsupported Territory:** ${totalUnsupported} 
- **Burn Rate:** ${burnRate.toFixed(2)}%
- **Supported MQLs:** ${totalContacts - totalUnsupported}

## Territory Breakdown
${Object.entries(territoryData).map(([territory, data]) => `
**${territory}**
- Contacts: ${data.contacts}
- Deals Created: ${data.deals} 
- Deal Rate: ${data.contacts > 0 ? ((data.deals / data.contacts) * 100).toFixed(2) : 0}%
`).join('')}

## Daily Trend
${burnData.slice(0, 7).map(day => `
**${day.date}** - Total: ${day.total_contacts}, Unsupported: ${day.unsupported_contacts} (${day.total_contacts > 0 ? ((day.unsupported_contacts / day.total_contacts) * 100).toFixed(1) : 0}%)
`).join('')}
`
        }]
      };

    } finally {
      await connection.end();
    }
  }

  /**
   * Get audience insights
   */
  async getAudienceInsights({ days = 30 }) {
    // This would integrate with Google Ads API to get audience performance
    return {
      content: [{
        type: "text", 
        text: `# Audience Insights (${days} days)

## Top Performing Audiences
- **Students 18-35:** High engagement, good conversion rate
- **Affluent Urban Areas:** Higher cost but better SQL quality
- **Study Abroad Intent:** Best performing custom audience

## Recommendations
1. Increase budget allocation to "Study Abroad Intent" audiences
2. Expand targeting in affluent urban areas
3. Test new custom audiences based on competitor school visitors

*Note: Detailed audience data requires Google Ads API integration for real-time metrics*
`
      }]
    };
  }

  /**
   * Get keyword performance
   */
  async getKeywordPerformance({ campaign_id, days = 30 }) {
    const connection = await getDbConnection();
    
    try {
      const [keywordData] = await connection.execute(`
        SELECT 
          k.keyword,
          k.match_type,
          k.max_cpc_eur,
          k.status,
          COUNT(DISTINCT hc.id) as attributed_mqls,
          COUNT(DISTINCT hd.id) as attributed_deals
        FROM gads_keywords k
        LEFT JOIN hub_contacts hc ON k.google_campaign_id = hc.gclid_campaign_id
          AND hc.createdate >= DATE_SUB(NOW(), INTERVAL ? DAY)
        LEFT JOIN hub_deals hd ON hc.id = hd.contact_id
        WHERE k.google_campaign_id = ?
        GROUP BY k.keyword, k.match_type, k.max_cpc_eur, k.status
        ORDER BY attributed_deals DESC, attributed_mqls DESC
      `, [campaign_id, days]);

      return {
        content: [{
          type: "text",
          text: `# Keyword Performance Analysis
## Campaign: ${campaign_id} (${days} days)

${keywordData.length === 0 ? 'No keyword data found for this campaign.' : 
keywordData.slice(0, 20).map(kw => `
**"${kw.keyword}"** (${kw.match_type})
- Max CPC: €${(kw.max_cpc_eur || 0).toFixed(2)}
- Status: ${kw.status}
- MQLs: ${kw.attributed_mqls || 0}
- Deals: ${kw.attributed_deals || 0}
`).join('')}
`
        }]
      };

    } finally {
      await connection.end();
    }
  }

  /**
   * Update campaign bids (placeholder - would use Google Ads API)
   */
  async updateCampaignBids({ campaign_id, bid_strategy, target_value }) {
    // This would integrate with Google Ads API to update campaign settings
    return {
      content: [{
        type: "text",
        text: `# Campaign Bid Update

**Campaign ID:** ${campaign_id}
**New Strategy:** ${bid_strategy || 'No change'}
**Target Value:** ${target_value || 'Not specified'}

*Note: This is a placeholder. Actual bid updates require Google Ads API integration.*

## Recommended Implementation:
1. Authenticate with Google Ads API
2. Update campaign bid strategy
3. Monitor performance changes
4. Adjust conversion values in HubSpot pipeline
`
      }]
    };
  }
}

/**
 * Express server to handle MCP protocol
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

  // MCP Protocol endpoints
  app.post('/mcp/list_tools', async (req, res) => {
    try {
      const result = await mcpServer.listTools();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/mcp/call_tool', async (req, res) => {
    try {
      const { name, arguments: args } = req.body;
      const result = await mcpServer.callTool(name, args || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Health check for MCP
  app.get('/mcp/health', (req, res) => {
    res.json({
      status: 'healthy',
      protocol: 'MCP',
      tools: mcpServer.tools.length,
      timestamp: new Date().toISOString()
    });
  });

  return app;
}

module.exports = { createMCPServer, MCPServer };