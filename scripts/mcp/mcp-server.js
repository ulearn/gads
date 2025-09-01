/**
 * MCP Server Business Logic Module
 * Path: /home/hub/public_html/gads/scripts/mcp/mcp-server.js
 * 
 * Handles all MCP protocol business logic
 * Follows ULearn architecture: business logic in scripts, routing in index.js
 */

/**
 * Handle MCP health check
 */
function handleHealth(req, res) {
  res.json({
    service: "ULearn Google Ads MCP Server",
    version: "1.0.0",
    transport: "HTTP+JSON",
    status: "running",
    authentication: "Bearer token required",
    endpoints: {
      health: "/gads/mcp/health",
      capabilities: "/gads/mcp/capabilities", 
      tools_list: "/gads/mcp/tools/list",
      tools_call: "/gads/mcp/tools/call"
    }
  });
}

/**
 * Handle MCP capabilities request
 */
function handleCapabilities(req, res) {
  res.json({
    capabilities: {
      tools: {}
    },
    serverInfo: {
      name: "ulearn-google-ads-mcp",
      version: "1.0.0"
    }
  });
}

/**
 * Handle MCP tools list request
 */
function handleToolsList(req, res) {
  res.json({
    tools: [
      {
        name: "get_campaign_performance",
        description: "Get Google Ads campaign performance data with metrics like clicks, impressions, cost, conversions",
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
              description: "Specific campaign ID (optional, defaults to all campaigns)"
            }
          }
        }
      },
      {
        name: "get_hubspot_pipeline",
        description: "Get HubSpot pipeline data showing MQL to SQL conversion rates and deal stages",
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
        name: "get_conversion_analysis", 
        description: "Analyze the complete conversion funnel from Google Ads clicks to HubSpot closed deals",
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
        description: "Get Google Ads audience performance and targeting insights",
        inputSchema: {
          type: "object",
          properties: {
            campaign_id: {
              type: "string",
              description: "Campaign ID to analyze (optional)"
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
        name: "get_territory_analysis",
        description: "Analyze performance by geographical territories (EU, Non-EU Visa on Arrival, etc.)",
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
      }
    ]
  });
}

/**
 * Handle MCP tools call request
 */
async function handleToolsCall(req, res, clients) {
  try {
    const { name, arguments: args } = req.body;
    
    console.log(`🔧 MCP Tool called: ${name}`, args);
    
    let result;
    switch (name) {
      case 'get_campaign_performance':
        result = await getCampaignPerformance(args || {}, clients);
        break;
        
      case 'get_hubspot_pipeline':
        result = await getHubSpotPipeline(args || {}, clients);
        break;
        
      case 'get_conversion_analysis':
        result = await getConversionAnalysis(args || {}, clients);
        break;
        
      case 'get_audience_insights':
        result = await getAudienceInsights(args || {}, clients);
        break;
        
      case 'get_territory_analysis':
        result = await getTerritoryAnalysis(args || {}, clients);
        break;
        
      default:
        return res.status(400).json({
          error: `Unknown tool: ${name}`
        });
    }
    
    return res.json({
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    });
    
  } catch (error) {
    console.error('❌ MCP Tool error:', error);
    res.status(500).json({
      error: error.message,
      tool: req.body.name
    });
  }
}

//=============================================================================//
//   TOOL IMPLEMENTATIONS - BUSINESS LOGIC
//=============================================================================//

/**
 * Get Google Ads campaign performance using existing pipeline data
 */
async function getCampaignPerformance(args, clients) {
  try {
    const { days = 30, campaign_id } = args;
    const { getDbConnection } = clients;
    
    console.log(`📊 Getting campaign performance for ${days} days, campaign: ${campaign_id || 'all'}`);
    
    // Use your existing pipeline server to get proven data
    const pipelineServer = require('../analytics/pipeline-server');
    const result = await pipelineServer.getFastPipelineData(getDbConnection, { 
      days, 
      campaign: campaign_id || 'all' 
    });
    
    if (!result.success) {
      throw new Error(`Pipeline data failed: ${result.error}`);
    }
    
    const { mqlStages, summary } = result;
    
    return {
      success: true,
      period: `${days} days`,
      campaign_id: campaign_id || 'all_campaigns',
      metrics: {
        impressions: parseInt(mqlStages.impressions?.count) || 0,
        clicks: parseInt(mqlStages.clicks?.count) || 0,
        cost: parseFloat(summary.totalCost) || 0,
        ctr: parseFloat(mqlStages.clicks?.ctr) || 0,
        avg_cpc: parseFloat(summary.avgCPC) || 0,
        conversions: parseInt(mqlStages.ctaComplete?.count) || 0,
        conversion_rate: parseFloat(mqlStages.ctaComplete?.conversionRate) || 0,
        cost_per_conversion: mqlStages.ctaComplete?.count > 0 ? 
          (parseFloat(summary.totalCost) || 0) / parseInt(mqlStages.ctaComplete.count) : 0,
        active_campaigns: parseInt(summary.activeCampaigns) || 0
      },
      analysis: {
        performance_rating: getCampaignPerformanceRating(mqlStages, summary),
        recommendations: getCampaignRecommendations(mqlStages, summary)
      }
    };
    
  } catch (error) {
    console.error('❌ Campaign performance error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get HubSpot pipeline analysis
 */
async function getHubSpotPipeline(args, clients) {
  try {
    const { days = 30 } = args;
    const { getDbConnection } = clients;
    
    console.log(`📈 Getting HubSpot pipeline for ${days} days`);
    
    const connection = await getDbConnection();
    
    try {
      // Get SQL pipeline stages from your hub_deals table
      const sqlQuery = `
        SELECT 
          dealstage,
          COUNT(*) as deal_count,
          AVG(amount) as avg_deal_value,
          SUM(amount) as total_value
        FROM hub_deals 
        WHERE createdate >= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND amount > 0
        GROUP BY dealstage
        ORDER BY 
          CASE dealstage
            WHEN 'SQL (Inbox)' THEN 1
            WHEN 'Engaging' THEN 2  
            WHEN 'Responsive' THEN 3
            WHEN 'Advising' THEN 4
            WHEN 'Negotiation' THEN 5
            WHEN 'Contract' THEN 6
            WHEN 'Won' THEN 7
            ELSE 8
          END
      `;
      
      const [sqlResults] = await connection.execute(sqlQuery, [days]);
      
      // Get total MQLs (contacts created in period)
      const mqlQuery = `
        SELECT COUNT(*) as total_mqls
        FROM hub_contacts 
        WHERE createdate >= DATE_SUB(NOW(), INTERVAL ? DAY)
      `;
      
      const [mqlResults] = await connection.execute(mqlQuery, [days]);
      
      const totalMQLs = mqlResults[0]?.total_mqls || 0;
      const totalSQLs = sqlResults.reduce((sum, stage) => sum + stage.deal_count, 0);
      
      return {
        success: true,
        period: `${days} days`,
        mql_to_sql_conversion: {
          total_mqls: totalMQLs,
          total_sqls: totalSQLs,
          conversion_rate: totalMQLs > 0 ? ((totalSQLs / totalMQLs) * 100).toFixed(2) + '%' : '0%'
        },
        sql_pipeline_stages: sqlResults.map(stage => ({
          stage: stage.dealstage,
          deal_count: stage.deal_count,
          avg_deal_value: Math.round(stage.avg_deal_value || 0),
          total_value: Math.round(stage.total_value || 0)
        })),
        pipeline_health: {
          total_pipeline_value: Math.round(sqlResults.reduce((sum, stage) => sum + (stage.total_value || 0), 0)),
          avg_deal_size: Math.round(sqlResults.reduce((sum, stage) => sum + (stage.avg_deal_value || 0), 0) / Math.max(sqlResults.length, 1)),
          stages_with_deals: sqlResults.length
        }
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ HubSpot pipeline error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Analyze complete conversion funnel
 */
async function getConversionAnalysis(args, clients) {
  try {
    const { days = 30 } = args;
    
    console.log(`🔍 Getting conversion analysis for ${days} days`);
    
    // Get both campaign and pipeline data
    const [campaignData, pipelineData] = await Promise.all([
      getCampaignPerformance({ days }, clients),
      getHubSpotPipeline({ days }, clients)
    ]);
    
    if (!campaignData.success || !pipelineData.success) {
      throw new Error('Failed to get conversion data');
    }
    
    const metrics = campaignData.metrics;
    const pipeline = pipelineData;
    
    // Calculate funnel conversion rates
    const impressions = metrics.impressions;
    const clicks = metrics.clicks; 
    const conversions = metrics.conversions; // CTAs/Lead forms
    const sqls = pipeline.mql_to_sql_conversion.total_sqls;
    const wonDeals = pipeline.sql_pipeline_stages.find(s => s.stage === 'Won')?.deal_count || 0;
    
    return {
      success: true,
      period: `${days} days`,
      funnel_analysis: {
        impressions: impressions,
        clicks: clicks,
        conversions: conversions, // MQLs
        sqls: sqls,
        won_deals: wonDeals
      },
      conversion_rates: {
        impression_to_click: impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : '0%',
        click_to_conversion: clicks > 0 ? `${((conversions / clicks) * 100).toFixed(2)}%` : '0%', 
        mql_to_sql: pipeline.mql_to_sql_conversion.conversion_rate,
        sql_to_won: sqls > 0 ? `${((wonDeals / sqls) * 100).toFixed(2)}%` : '0%',
        click_to_won: clicks > 0 ? `${((wonDeals / clicks) * 100).toFixed(4)}%` : '0%'
      },
      financial_analysis: {
        total_ad_spend: metrics.cost,
        cost_per_click: metrics.avg_cpc,
        cost_per_conversion: metrics.cost_per_conversion,
        cost_per_sql: sqls > 0 ? Math.round(metrics.cost / sqls) : 0,
        cost_per_won_deal: wonDeals > 0 ? Math.round(metrics.cost / wonDeals) : 0,
        total_pipeline_value: pipeline.pipeline_health.total_pipeline_value,
        roi_estimate: pipeline.pipeline_health.total_pipeline_value > 0 && metrics.cost > 0 ? 
          `${(((pipeline.pipeline_health.total_pipeline_value - metrics.cost) / metrics.cost) * 100).toFixed(0)}%` : 'N/A'
      }
    };
    
  } catch (error) {
    console.error('❌ Conversion analysis error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get audience insights 
 */
async function getAudienceInsights(args, clients) {
  try {
    const { campaign_id, days = 30 } = args;
    const { getDbConnection } = clients;
    
    console.log(`🎯 Getting audience insights for ${days} days`);
    
    const connection = await getDbConnection();
    
    try {
      // Get top performing countries from your contact data
      const countryQuery = `
        SELECT 
          country,
          COUNT(*) as contacts,
          COUNT(CASE WHEN lifecyclestage IN ('marketingqualifiedlead', 'salesqualifiedlead', 'opportunity') THEN 1 END) as qualified_leads
        FROM hub_contacts 
        WHERE createdate >= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND country IS NOT NULL
          AND country != ''
        GROUP BY country
        ORDER BY qualified_leads DESC, contacts DESC
        LIMIT 10
      `;
      
      const [countryResults] = await connection.execute(countryQuery, [days]);
      
      return {
        success: true,
        period: `${days} days`,
        audience_insights: {
          top_countries: countryResults.map(row => ({
            country: row.country,
            total_contacts: row.contacts,
            qualified_leads: row.qualified_leads,
            qualification_rate: row.contacts > 0 ? `${((row.qualified_leads / row.contacts) * 100).toFixed(1)}%` : '0%'
          })),
          targeting_recommendations: getTargetingRecommendations(countryResults)
        }
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Audience insights error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get territory analysis using your existing territory logic
 */
async function getTerritoryAnalysis(args, clients) {
  try {
    const { days = 30 } = args;
    const { getDbConnection } = clients;
    
    console.log(`🌍 Getting territory analysis for ${days} days`);
    
    // Use your existing hubspot-data module for territory analysis
    const hubspotData = require('../analytics/hubspot-data');
    const result = await hubspotData.getTerritoryAnalysis(getDbConnection, days);
    
    if (!result.success) {
      throw new Error(`Territory analysis failed: ${result.error}`);
    }
    
    return {
      success: true,
      period: `${days} days`,
      ...result,
      analysis: {
        ...result.analysis,
        recommendations: getTerritoryRecommendations(result)
      }
    };
    
  } catch (error) {
    console.error('❌ Territory analysis error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

//=============================================================================//
//   HELPER FUNCTIONS
//=============================================================================//

/**
 * Get campaign performance rating
 */
function getCampaignPerformanceRating(mqlStages, summary) {
  const ctr = parseFloat(mqlStages.clicks?.ctr) || 0;
  const conversionRate = parseFloat(mqlStages.ctaComplete?.conversionRate) || 0;
  
  if (ctr >= 3 && conversionRate >= 10) return "Excellent";
  if (ctr >= 2 && conversionRate >= 5) return "Good"; 
  if (ctr >= 1 && conversionRate >= 2) return "Average";
  return "Needs Improvement";
}

/**
 * Get campaign recommendations
 */
function getCampaignRecommendations(mqlStages, summary) {
  const recommendations = [];
  const ctr = parseFloat(mqlStages.clicks?.ctr) || 0;
  const conversionRate = parseFloat(mqlStages.ctaComplete?.conversionRate) || 0;
  const avgCPC = parseFloat(summary.avgCPC) || 0;
  
  if (ctr < 2) recommendations.push("Improve ad copy and targeting to increase CTR");
  if (conversionRate < 5) recommendations.push("Optimize landing pages and forms to improve conversion rate");
  if (avgCPC > 2) recommendations.push("Review bid strategies and keyword targeting to reduce CPC");
  
  return recommendations.length > 0 ? recommendations : ["Campaign performance is within acceptable ranges"];
}

/**
 * Get targeting recommendations based on audience data
 */
function getTargetingRecommendations(countryData) {
  const recommendations = [];
  
  if (countryData.length === 0) {
    return ["No sufficient data for targeting recommendations"];
  }
  
  const topCountry = countryData[0];
  const avgQualificationRate = countryData.reduce((sum, c) => sum + (c.qualified_leads / c.contacts), 0) / countryData.length;
  
  recommendations.push(`Focus budget on ${topCountry.country} - your top performing market`);
  
  const highPerformers = countryData.filter(c => (c.qualified_leads / c.contacts) > avgQualificationRate);
  if (highPerformers.length > 1) {
    recommendations.push(`Consider expanding in high-conversion markets: ${highPerformers.slice(1, 4).map(c => c.country).join(', ')}`);
  }
  
  const lowPerformers = countryData.filter(c => (c.qualified_leads / c.contacts) < avgQualificationRate * 0.5);
  if (lowPerformers.length > 0) {
    recommendations.push(`Review targeting and messaging for underperforming markets: ${lowPerformers.map(c => c.country).join(', ')}`);
  }
  
  return recommendations;
}

/**
 * Get territory recommendations
 */
function getTerritoryRecommendations(territoryData) {
  const recommendations = [];
  
  if (territoryData.territories && territoryData.territories.length > 0) {
    const bestTerritory = territoryData.territories[0];
    recommendations.push(`${bestTerritory.territory} shows strongest performance - consider increasing budget allocation`);
    
    const unsupported = territoryData.territories.find(t => t.territory === 'Unsupported Territory');
    if (unsupported && unsupported.percentage > 20) {
      recommendations.push(`High unsupported territory percentage (${unsupported.percentage}%) - review geo-targeting settings`);
    }
  }
  
  return recommendations;
}

module.exports = {
  handleHealth,
  handleCapabilities,
  handleToolsList,
  handleToolsCall
};