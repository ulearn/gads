const { GoogleAdsApi } = require('google-ads-api');
const path = require('path');

// Ensure environment variables are loaded
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/** ---------- Small util for timestamped logs ---------- */
const log = (...args) => console.log(new Date().toISOString(), ...args);

// Initialize Google Ads client
const googleAdsClient = new GoogleAdsApi({
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  developer_token: process.env.GAdsAPI
});

/**
 * Get comprehensive Google Ads account overview
 */
async function getAccountOverview({ 
  account_id = process.env.GADS_LIVE_ID, 
  include_campaigns = true, 
  date_range_days = 30 
}) {
  log('🏢 Google Ads Account Overview called:', { account_id, include_campaigns, date_range_days });
  
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

    log('✅ Google Ads Account Overview completed successfully');
    
    return {
      success: true,
      data: {
        account: accountInfo,
        summary,
        campaigns: campaignData,
        date_range: `${date_range_days} days`
      },
      report: reportText
    };

  } catch (error) {
    log('❌ Google Ads Account Overview failed:', error.message);
    return {
      success: false,
      error: error.message,
      report: `❌ **Error getting Google Ads account overview:**\n\n${error.message}\n\nPlease check your Google Ads API credentials and account access.`
    };
  }
}

/**
 * Analyze campaign settings and bidding strategies
 */
async function getCampaignAnalysis({ 
  account_id = process.env.GADS_LIVE_ID, 
  campaign_id = '', 
  include_targeting = true, 
  include_bidding = true 
}) {
  log('🎯 Campaign Settings Analysis called:', { account_id, campaign_id, include_targeting, include_bidding });
  
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
      success: true,
      data: { campaigns },
      report: reportSections.join('\n')
    };

  } catch (error) {
    log('❌ Campaign analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      report: `❌ **Error getting campaign analysis:**\n\n${error.message}\n\nPlease check your Google Ads API credentials and account access.`
    };
  }
}

module.exports = {
  getAccountOverview,
  getCampaignAnalysis,
  googleAdsClient // Export client for future extensions
};