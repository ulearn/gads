/**
 * REFACTORED: MCP MySQL Analysis Module
 * Uses existing proven analytics modules instead of duplicating query logic
 * Path: /home/hub/public_html/gads/scripts/mcp/mcp-mysql-refactored.js
 */

const path = require('path');

// Import existing proven analytics modules
const hubspotData = require('../analytics/hubspot-data');
const pipelineServer = require('../analytics/pipeline-server');
const budgetModule = require('../analytics/budget');
const burnRateModule = require('../analytics/burn-rate-timeseries');

// Import the database connection helper
const mysql = require('mysql2/promise');

/** ---------- Small util for timestamped logs ---------- */
const log = (...args) => console.log(new Date().toISOString(), ...args);

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

/**
 * Get database connection
 */
async function getDbConnection() {
  return await mysql.createConnection(dbConfig);
}

/**
 * Get comprehensive dashboard summary using proven analytics logic
 */
async function getDashboardSummary({ days = 30, mode = 'pipeline' }) {
  log('📊 Dashboard Summary called:', { days, mode });
  
  try {
    // Use proven hubspot-data.js logic
    const summaryResult = await hubspotData.getDashboardSummary(getDbConnection, days, mode);
    
    if (!summaryResult.success) {
      throw new Error(`Dashboard summary failed: ${summaryResult.error}`);
    }
    
    const { summary } = summaryResult;
    
    // Format as MCP-friendly report
    const reportText = `# 📊 Google Ads Dashboard Summary (${mode.toUpperCase()} Mode - ${days} days)

## 🎯 Key Performance Metrics
- **Google Ads Clicks:** ${(summary.gad_clicks || 0).toLocaleString()}
- **Google Ads CTAs:** ${(summary.gad_ctas || 0).toLocaleString()}
- **MQLs Created:** ${(summary.totalContacts || 0).toLocaleString()}
- **MQLs Failed (Burn Rate):** ${(summary.failed_validation || 0).toLocaleString()} (${summary.burn_rate || 0}%)
- **SQLs Passed:** ${(summary.contactsWithDeals || 0).toLocaleString()} (${summary.conversionRate || 0}% conversion)

## 💰 Revenue Metrics
- **Total Deals:** ${(summary.totalDeals || 0).toLocaleString()}
- **Deals Won:** ${(summary.wonDeals || 0).toLocaleString()}
- **Deals Lost:** ${(summary.lostDeals || 0).toLocaleString()}
- **Total Revenue:** €${(summary.totalRevenue || 0).toLocaleString()}
- **Average Deal Value:** €${(summary.avgDealValue || 0).toFixed(2)}

## 🔍 Analysis Details
- **Analysis Mode:** ${mode} (${summaryResult.dealLogic || 'Standard logic'})
- **Date Range:** ${summaryResult.dateRange || `Last ${days} days`}
- **Active Campaigns:** ${summary.uniqueCampaigns || 0}

*Generated: ${new Date().toISOString()}*`;

    log('✅ Dashboard summary completed successfully');
    
    return {
      success: true,
      data: {
        summary: summary,
        analysis_mode: mode,
        date_range: `${days} days`,
        dashboard_url: 'https://hub.ulearnschool.com/gads/dashboard'
      },
      report: reportText
    };
    
  } catch (error) {
    log('❌ Dashboard summary failed:', error.message);
    return {
      success: false,
      error: error.message,
      report: `❌ **Error getting dashboard summary:**\n\n${error.message}\n\nPlease check your analytics modules and database connection.`
    };
  }
}

/**
 * Get pipeline analysis using proven pipeline-server logic
 */
async function getPipelineAnalysis({ days = 30, campaign = 'all' }) {
  log('📈 Pipeline Analysis called:', { days, campaign });
  
  try {
    // Use proven pipeline-server.js logic
    const pipelineResult = await pipelineServer.getFastPipelineData(getDbConnection, { days, campaign });
    
    if (!pipelineResult.success) {
      throw new Error(`Pipeline analysis failed: ${pipelineResult.error}`);
    }
    
    const { mqlStages, summary, stages } = pipelineResult;
    
    // Format as MCP-friendly report
    const reportText = `# 📈 Pipeline Analysis (Last ${days} days)

## 🚀 Google Ads Performance (MQL Stages)
${Object.entries(mqlStages || {}).map(([stage, data]) => `
### ${stage.charAt(0).toUpperCase() + stage.slice(1)}
- **Count:** ${(data.count || 0).toLocaleString()}
- **Percentage:** ${(data.percentage || 0)}%
- **Conversion Rate:** ${(data.conversionRate || 0)}%
${data.cost ? `- **Total Cost:** €${parseFloat(data.cost).toLocaleString()}` : ''}
${data.ctr ? `- **CTR:** ${data.ctr}%` : ''}
`).join('')}

## 🎯 SQL Pipeline Stages
${stages ? stages.map(stage => `
### ${stage.stage}
- **Deal Count:** ${stage.count}
- **Success Rate:** ${(stage.successRate || 0)}%
- **Stage Probability:** ${(stage.stageProb || 0)}%
- **Revenue:** €${(stage.revenue || 0).toLocaleString()}
`).join('') : 'Pipeline stages data not available'}

## 📊 Summary Statistics
- **Total Cost:** €${(summary.totalCost || 0).toLocaleString()}
- **Active Campaigns:** ${summary.activeCampaigns || 0}
- **Average CPC:** €${(summary.avgCPC || 0).toFixed(2)}
- **Campaign Filter:** ${campaign === 'all' ? 'All Campaigns' : campaign}

*Generated: ${new Date().toISOString()}*`;

    log('✅ Pipeline analysis completed successfully');
    
    return {
      success: true,
      data: {
        mql_stages: mqlStages,
        sql_stages: stages,
        summary: summary,
        date_range: `${days} days`,
        campaign_filter: campaign
      },
      report: reportText
    };
    
  } catch (error) {
    log('❌ Pipeline analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      report: `❌ **Error getting pipeline analysis:**\n\n${error.message}\n\nPlease check your pipeline-server module and database connection.`
    };
  }
}

/**
 * Get burn rate analysis using proven burn-rate-timeseries logic
 */
async function getBurnRateAnalysis({ days = 30, granularity = 'auto' }) {
  log('🔥 Burn Rate Analysis called:', { days, granularity });
  
  try {
    // Use proven burn-rate-timeseries.js logic
    const burnResult = await burnRateModule.getBurnRateTimeseries(getDbConnection, { days, granularity });
    
    if (!burnResult.success) {
      throw new Error(`Burn rate analysis failed: ${burnResult.error}`);
    }
    
    const { data, summary, nationalityBreakdown } = burnResult;
    
    // Format as MCP-friendly report
    const reportText = `# 🔥 Burn Rate Analysis (Last ${days} days)

## 📊 Overall Performance
- **Total Contacts:** ${(summary.totalContacts || 0).toLocaleString()}
- **Supported Contacts:** ${(summary.totalSupported || 0).toLocaleString()}
- **Burned Contacts:** ${(summary.totalUnsupported || 0).toLocaleString()}
- **Overall Burn Rate:** ${(summary.overallBurnRate || 0).toFixed(2)}%
- **Average Daily Burn Rate:** ${(summary.avgDailyBurnRate || 0).toFixed(2)}%
- **Trend:** ${summary.trend?.direction || 'stable'} (${summary.trend?.change || 0}% change)

## 📅 Recent Burn Rate Data (${summary.granularity || granularity})
${data ? data.slice(-10).map(day => `
### ${day.date}
- **Total Contacts:** ${day.totalContacts}
- **Burned:** ${day.unsupportedContacts} (${day.burnRatePercentage}%)
- **Supported:** ${day.supportedContacts} (${day.supportedRatePercentage}%)
`).join('') : 'No timeseries data available'}

## 🌍 Nationality Breakdown of Burned Contacts
${nationalityBreakdown?.nationalities ? nationalityBreakdown.nationalities.slice(0, 10).map(nat => `
### ${nat.nationality}
- **Burned Contacts:** ${nat.burnedContacts} (${nat.percentage}%)
- **Estimated Waste:** €${nat.estimatedWaste}
`).join('') : 'Nationality data not available'}

## 💰 Financial Impact
- **Total Estimated Waste:** €${(nationalityBreakdown?.totalEstimatedWaste || 0).toLocaleString()}
- **Based on €25/contact average acquisition cost**

*Generated: ${new Date().toISOString()}*`;

    log('✅ Burn rate analysis completed successfully');
    
    return {
      success: true,
      data: {
        overall: summary,
        daily_trend: data,
        nationality_breakdown: nationalityBreakdown,
        date_range: `${days} days`,
        granularity: granularity
      },
      report: reportText
    };
    
  } catch (error) {
    log('❌ Burn rate analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      report: `❌ **Error getting burn rate analysis:**\n\n${error.message}\n\nPlease check your burn-rate-timeseries module and database connection.`
    };
  }
}

/**
 * Get campaign performance using proven analytics logic
 */
async function getCampaignPerformance({ days = 30, mode = 'pipeline' }) {
  log('🎯 Campaign Performance called:', { days, mode });
  
  try {
    // Use proven hubspot-data.js campaign logic
    const campaignResult = await hubspotData.getCampaignPerformance(getDbConnection, days, mode);
    
    if (!campaignResult.success) {
      throw new Error(`Campaign performance failed: ${campaignResult.error}`);
    }
    
    const { campaigns } = campaignResult;
    
    // Format as MCP-friendly report
    const reportText = `# 🎯 Campaign Performance Analysis (${mode.toUpperCase()} Mode - ${days} days)

## 🏆 Top Performing Campaigns
${campaigns ? campaigns.slice(0, 10).map((campaign, index) => `
### ${index + 1}. ${campaign.campaignName || 'Unknown Campaign'}
- **Campaign ID:** ${campaign.campaignId || 'N/A'}
- **Ad Group:** ${campaign.adGroup || 'Not Specified'}
- **Contacts:** ${campaign.contacts} → **Deals:** ${campaign.totalDeals}
- **Won Deals:** ${campaign.wonDeals} | **Revenue:** €${(campaign.revenue || 0).toLocaleString()}
- **Conversion Rate:** ${campaign.conversionRate}%
`).join('') : 'No campaign data available'}

## 📈 Campaign Summary
- **Total Campaigns:** ${campaigns?.length || 0}
- **Analysis Mode:** ${mode} (${campaignResult.analysisMode || 'Standard'})
- **Date Range:** ${campaignResult.dateRange || `Last ${days} days`}
- **Top Revenue:** €${campaigns?.[0]?.revenue ? parseFloat(campaigns[0].revenue).toLocaleString() : 0}

*Generated: ${new Date().toISOString()}*`;

    log('✅ Campaign performance completed successfully');
    
    return {
      success: true,
      data: {
        campaigns: campaigns,
        analysis_mode: mode,
        date_range: `${days} days`,
        total_campaigns: campaigns?.length || 0
      },
      report: reportText
    };
    
  } catch (error) {
    log('❌ Campaign performance failed:', error.message);
    return {
      success: false,
      error: error.message,
      report: `❌ **Error getting campaign performance:**\n\n${error.message}\n\nPlease check your hubspot-data module and database connection.`
    };
  }
}

/**
 * Get territory analysis using proven analytics logic
 */
async function getTerritoryAnalysis({ days = 30, mode = 'pipeline' }) {
  log('🌍 Territory Analysis called:', { days, mode });
  
  try {
    // Use proven hubspot-data.js territory logic
    const territoryResult = await hubspotData.getTerritoryAnalysis(getDbConnection, days, mode);
    
    if (!territoryResult.success) {
      throw new Error(`Territory analysis failed: ${territoryResult.error}`);
    }
    
    const { territories } = territoryResult;
    
    // Format as MCP-friendly report
    const reportText = `# 🌍 Territory Performance Analysis (${mode.toUpperCase()} Mode - ${days} days)

## 🎯 Territory Breakdown
${territories ? territories.map((territory, index) => `
### ${territory.name}
- **Contacts:** ${territory.contacts}
- **Deals Created:** ${territory.dealsCreated}
- **Conversion Rate:** ${territory.conversionRate}%
- **Status:** ${territory.isUnsupported ? '🔥 BURN TERRITORY (Unsupported)' : '✅ Supported Territory'}
${territory.isUnsupported ? '- **Action:** Review targeting to exclude this territory' : ''}
`).join('') : 'No territory data available'}

## 📊 Territory Summary
- **Total Territories:** ${territories?.length || 0}
- **Supported Territories:** ${territories?.filter(t => !t.isUnsupported).length || 0}
- **Unsupported Territories:** ${territories?.filter(t => t.isUnsupported).length || 0}
- **Analysis Mode:** ${mode}

*Generated: ${new Date().toISOString()}*`;

    log('✅ Territory analysis completed successfully');
    
    return {
      success: true,
      data: {
        territories: territories,
        analysis_mode: mode,
        date_range: `${days} days`,
        supported_count: territories?.filter(t => !t.isUnsupported).length || 0,
        unsupported_count: territories?.filter(t => t.isUnsupported).length || 0
      },
      report: reportText
    };
    
  } catch (error) {
    log('❌ Territory analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      report: `❌ **Error getting territory analysis:**\n\n${error.message}\n\nPlease check your hubspot-data module and database connection.`
    };
  }
}

/**
 * Get comprehensive budget analysis using proven budget module
 * Note: This requires Google Ads client connection - placeholder for now
 */
async function getBudgetAnalysis({ days = 30 }) {
  log('💰 Budget Analysis called:', { days });
  
  try {
    // This would use budgetModule.getBudgetPerformanceAnalysis
    // but requires Google Ads client setup, so return basic structure for now
    
    const reportText = `# 💰 Budget Analysis (Last ${days} days)

## 📊 Budget Performance
⚠️ **Budget analysis requires Google Ads API client connection**
- This feature will be available once Google Ads API client is integrated with MCP
- Will provide ROI analysis, budget utilization, and optimization recommendations

## 🔍 Available Data Sources
- Dashboard Summary: Use getDashboardSummary for cost and revenue metrics
- Pipeline Analysis: Use getPipelineAnalysis for Google Ads cost data
- Campaign Performance: Use getCampaignPerformance for campaign-level ROI

*Generated: ${new Date().toISOString()}*`;

    return {
      success: true,
      data: {
        status: 'requires_google_ads_client',
        message: 'Budget analysis requires Google Ads API client integration',
        available_alternatives: ['getDashboardSummary', 'getPipelineAnalysis', 'getCampaignPerformance']
      },
      report: reportText
    };
    
  } catch (error) {
    log('❌ Budget analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      report: `❌ **Error getting budget analysis:**\n\n${error.message}`
    };
  }
}

module.exports = {
  // Main analytics functions using proven modules
  getDashboardSummary,
  getPipelineAnalysis, 
  getBurnRateAnalysis,
  getCampaignPerformance,
  getTerritoryAnalysis,
  getBudgetAnalysis,
  
  // Utility
  getDbConnection
};