const { GoogleAdsApi, ResourceNames, enums, toMicros } = require('google-ads-api');
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
 * Get Google Ads account-level settings and information only
 */
async function getAccountOverview({ 
  account_id = process.env.GADS_LIVE_ID
}) {
  log('🏢 Google Ads Account Settings called:', { account_id });
  
  try {
    const customer = googleAdsClient.Customer({
      customer_id: account_id,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      login_customer_id: process.env.GADS_LIVE_MCC_ID
    });

    log('🔍 Querying Google Ads API for account settings:', account_id);

    // Get comprehensive account information
    const accountQuery = `
      SELECT 
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone,
        customer.test_account,
        customer.auto_tagging_enabled,
        customer.conversion_tracking_setting.conversion_tracking_id,
        customer.optimization_score,
        customer.pay_per_conversion_eligibility_failure_reasons,
        customer.remarketing_setting.google_global_site_tag,
        customer.tracking_url_template,
        customer.final_url_suffix,
        customer.manager,
        customer.resource_name
      FROM customer 
      LIMIT 1
    `;

    const accountResults = await customer.query(accountQuery);
    const accountInfo = accountResults[0]?.customer || {};

    // Get conversion goals/actions
    let conversionActions = [];
    try {
      // Start with basic fields first, then add complex ones
      const conversionQuery = `
        SELECT 
          conversion_action.id,
          conversion_action.name,
          conversion_action.status,
          conversion_action.type,
          conversion_action.category,
          conversion_action.primary_for_goal,
          conversion_action.counting_type
        FROM conversion_action
        WHERE conversion_action.status = 'ENABLED'
      `;
      
      log('🔍 Testing conversion actions query...');
      const conversionResults = await customer.query(conversionQuery);
      conversionActions = conversionResults.map(row => row.conversion_action);
      log('🔍 Found', conversionActions.length, 'conversion actions');
      
      // Try to get value settings separately if basic query works
      if (conversionActions.length > 0) {
        try {
          const valueQuery = `
            SELECT 
              conversion_action.id,
              conversion_action.name,
              conversion_action.value_settings.default_value,
              conversion_action.value_settings.default_currency_code
            FROM conversion_action
            WHERE conversion_action.status = 'ENABLED'
          `;
          
          log('🔍 Testing conversion value settings query...');
          const valueResults = await customer.query(valueQuery);
          log('🔍 Found value settings for', valueResults.length, 'conversion actions');
          
          // Merge value settings into main results
          const valueMap = new Map(valueResults.map(row => [
            row.conversion_action.id, 
            row.conversion_action.value_settings
          ]));
          
          conversionActions.forEach(action => {
            const valueSettings = valueMap.get(action.id);
            if (valueSettings) {
              action.value_settings = valueSettings;
            }
          });
        } catch (valueError) {
          log('⚠️ Could not fetch conversion value settings:', valueError.message, valueError.stack);
        }
      }
    } catch (error) {
      log('⚠️ Could not fetch conversion actions:', error.message, error.stack);
      log('⚠️ Full error object:', JSON.stringify(error, null, 2));
    }

    const reportText = `# 🏢 Google Ads Account Settings

## 📋 Account Information
- **Account Name:** ${accountInfo.descriptive_name}
- **Account ID:** ${accountInfo.id}
- **Currency:** ${accountInfo.currency_code}
- **Timezone:** ${accountInfo.time_zone}
- **Test Account:** ${accountInfo.test_account ? 'Yes' : 'No'}
- **Manager Account:** ${accountInfo.manager ? 'Yes' : 'No'}

## 🎯 Tracking & Conversion Settings
- **Auto-tagging:** ${accountInfo.auto_tagging_enabled ? 'Enabled' : 'Disabled'}
- **Conversion Tracking ID:** ${accountInfo.conversion_tracking_setting?.conversion_tracking_id || 'N/A'}
- **Global Site Tag:** ${accountInfo.remarketing_setting?.google_global_site_tag || 'N/A'}
- **Tracking URL Template:** ${accountInfo.tracking_url_template || 'N/A'}
- **Final URL Suffix:** ${accountInfo.final_url_suffix || 'N/A'}

## 🔄 Conversion Actions (${conversionActions.length})
${conversionActions.map(action => `
### ${action.name}
- **Type:** ${action.type} | **Category:** ${action.category}
- **Status:** ${action.status} | **Primary Goal:** ${action.primary_for_goal ? 'Yes' : 'No'}
- **Default Value:** ${action.value_settings?.default_value || 'Dynamic'} ${action.value_settings?.default_currency_code || ''}
- **Counting:** ${action.counting_type}
`).join('')}

## 📊 Account Health
- **Optimization Score:** ${accountInfo.optimization_score || 'N/A'}
- **Pay Per Conversion Eligible:** ${accountInfo.pay_per_conversion_eligibility_failure_reasons?.length === 0 ? 'Yes' : 'No'}

*Generated: ${new Date().toISOString()}*`;

    log('✅ Google Ads Account Settings completed successfully');
    
    return {
      success: true,
      data: {
        account: accountInfo,
        conversion_actions: conversionActions
      },
      report: reportText
    };

  } catch (error) {
    log('❌ Google Ads Account Settings failed:', error.message);
    return {
      success: false,
      error: error.message,
      report: `❌ **Error getting Google Ads account settings:**\n\n${error.message}\n\nPlease check your Google Ads API credentials and account access.`
    };
  }
}

/**
 * Comprehensive campaign analysis including ad groups, keywords, and ads
 */
async function getCampaignAnalysis({ 
  account_id = process.env.GADS_LIVE_ID, 
  campaign_id = '', 
  date_range_days = 30,
  include_ad_groups = true, 
  include_keywords = true,
  include_ads = true 
}) {
  log('🎯 Comprehensive Campaign Analysis called:', { account_id, campaign_id, date_range_days, include_ad_groups, include_keywords, include_ads });
  
  try {
    const customer = googleAdsClient.Customer({
      customer_id: account_id,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      login_customer_id: process.env.GADS_LIVE_MCC_ID
    });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - date_range_days);
    const endDate = new Date();
    const dateFilter = `segments.date BETWEEN '${startDate.toISOString().split('T')[0]}' AND '${endDate.toISOString().split('T')[0]}'`;

    // SPLIT INTO TWO QUERIES - Google Ads API limitation
    
    // Query 1: Campaign settings (no date filter, no metrics)
    let campaignSettingsQuery = `
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

    // Query 2: Campaign performance metrics (with date filter)  
    let campaignMetricsQuery = `
      SELECT 
        campaign.id,
        campaign.name,
        metrics.clicks,
        metrics.impressions,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE campaign.status IN ('ENABLED', 'PAUSED') AND ${dateFilter}
    `;

    if (campaign_id) {
      campaignSettingsQuery += ` AND campaign.id = '${campaign_id}'`;
      campaignMetricsQuery += ` AND campaign.id = '${campaign_id}'`;
    }

    log('🔍 Querying campaign settings...');
    const campaignSettingsResults = await customer.query(campaignSettingsQuery);
    
    log('🔍 Querying campaign metrics...');
    const campaignMetricsResults = await customer.query(campaignMetricsQuery);
    
    // Process campaign settings first
    const campaignMap = new Map();
    campaignSettingsResults.forEach(row => {
      const campaignId = row.campaign.id;
      campaignMap.set(campaignId, {
        id: campaignId,
        name: row.campaign.name,
        status: row.campaign.status,
        type: row.campaign.advertising_channel_type,
        bidding: {
          strategy_type: row.campaign.bidding_strategy_type,
          enhanced_cpc: row.campaign.manual_cpc?.enhanced_cpc_enabled,
          target_cpa: row.campaign.target_cpa?.target_cpa_micros ? (row.campaign.target_cpa.target_cpa_micros / 1000000) : null,
          target_roas: row.campaign.target_roas?.target_roas || row.campaign.maximize_conversion_value?.target_roas,
          target_spend: row.campaign.target_spend?.target_spend_micros ? (row.campaign.target_spend.target_spend_micros / 1000000) : null,
          max_conv_target_cpa: row.campaign.maximize_conversions?.target_cpa_micros ? (row.campaign.maximize_conversions.target_cpa_micros / 1000000) : null
        },
        metrics: {
          clicks: 0,
          impressions: 0,
          cost: 0,
          conversions: 0,
          conversion_value: 0,
          ctr: 0,
          avg_cpc: 0
        },
        ad_groups: [],
        keywords: [],
        ads: []
      });
    });

    // Then merge in performance metrics
    campaignMetricsResults.forEach(row => {
      const campaignId = row.campaign.id;
      const campaign = campaignMap.get(campaignId);
      if (campaign) {
        campaign.metrics.clicks += row.metrics.clicks || 0;
        campaign.metrics.impressions += row.metrics.impressions || 0;
        campaign.metrics.cost += (row.metrics.cost_micros || 0) / 1000000;
        campaign.metrics.conversions += row.metrics.conversions || 0;
        campaign.metrics.conversion_value += row.metrics.conversions_value || 0;
        campaign.metrics.ctr = row.metrics.ctr || 0;
        campaign.metrics.avg_cpc = (row.metrics.average_cpc || 0) / 1000000;
      }
    });

    let campaigns = Array.from(campaignMap.values());
    log('🔍 Processed', campaigns.length, 'campaigns');

    // Get ad groups for each campaign
    if (include_ad_groups && campaigns.length > 0) {
      const campaignIds = campaigns.map(c => c.id);
      const adGroupQuery = `
        SELECT 
          ad_group.id,
          ad_group.name,
          ad_group.status,
          ad_group.campaign,
          ad_group.type,
          ad_group.cpc_bid_micros,
          ad_group.cpm_bid_micros,
          ad_group.target_cpa_micros,
          ad_group.target_cpm_micros,
          metrics.clicks,
          metrics.impressions,
          metrics.cost_micros,
          metrics.conversions
        FROM ad_group
        WHERE ad_group.campaign IN (${campaignIds.map(id => `'customers/${account_id}/campaigns/${id}'`).join(',')})
        AND ad_group.status = 'ENABLED'
        AND ${dateFilter}
      `;

      try {
        const adGroupResults = await customer.query(adGroupQuery);
        log('🔍 Found', adGroupResults.length, 'ad group records');

        // Process ad groups
        adGroupResults.forEach(row => {
          const campaignId = row.ad_group.campaign.split('/').pop();
          const campaign = campaignMap.get(campaignId);
          
          if (campaign) {
            let adGroup = campaign.ad_groups.find(ag => ag.id === row.ad_group.id);
            if (!adGroup) {
              adGroup = {
                id: row.ad_group.id,
                name: row.ad_group.name,
                status: row.ad_group.status,
                type: row.ad_group.type,
                cpc_bid: row.ad_group.cpc_bid_micros ? (row.ad_group.cpc_bid_micros / 1000000) : null,
                cpm_bid: row.ad_group.cpm_bid_micros ? (row.ad_group.cpm_bid_micros / 1000000) : null,
                target_cpa: row.ad_group.target_cpa_micros ? (row.ad_group.target_cpa_micros / 1000000) : null,
                target_cpm: row.ad_group.target_cpm_micros ? (row.ad_group.target_cpm_micros / 1000000) : null,
                metrics: {
                  clicks: 0,
                  impressions: 0,
                  cost: 0,
                  conversions: 0
                }
              };
              campaign.ad_groups.push(adGroup);
            }
            
            adGroup.metrics.clicks += row.metrics.clicks || 0;
            adGroup.metrics.impressions += row.metrics.impressions || 0;
            adGroup.metrics.cost += (row.metrics.cost_micros || 0) / 1000000;
            adGroup.metrics.conversions += row.metrics.conversions || 0;
          }
        });
      } catch (error) {
        log('⚠️ Could not fetch ad groups:', error.message);
      }
    }

    // Get keywords
    if (include_keywords && campaigns.length > 0) {
      const campaignIds = campaigns.map(c => c.id);
      const keywordQuery = `
        SELECT 
          ad_group_criterion.criterion_id,
          ad_group_criterion.ad_group,
          ad_group_criterion.status,
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group_criterion.cpc_bid_micros,
          metrics.clicks,
          metrics.impressions,
          metrics.cost_micros,
          metrics.conversions
        FROM keyword_view
        WHERE campaign.resource_name IN (${campaignIds.map(id => `'customers/${account_id}/campaigns/${id}'`).join(',')})
        AND ad_group_criterion.status = 'ENABLED'
        AND ${dateFilter}
        LIMIT 200
      `;

      try {
        const keywordResults = await customer.query(keywordQuery);
        log('🔍 Found', keywordResults.length, 'keyword records');

        keywordResults.forEach(row => {
          const campaignId = row.ad_group_criterion.ad_group.split('/').slice(-3, -2)[0];
          const campaign = campaignMap.get(campaignId);
          
          if (campaign) {
            campaign.keywords.push({
              id: row.ad_group_criterion.criterion_id,
              text: row.ad_group_criterion.keyword?.text || 'N/A',
              match_type: row.ad_group_criterion.keyword?.match_type || 'N/A',
              status: row.ad_group_criterion.status,
              cpc_bid: row.ad_group_criterion.cpc_bid_micros ? (row.ad_group_criterion.cpc_bid_micros / 1000000) : null,
              metrics: {
                clicks: row.metrics.clicks || 0,
                impressions: row.metrics.impressions || 0,
                cost: (row.metrics.cost_micros || 0) / 1000000,
                conversions: row.metrics.conversions || 0
              }
            });
          }
        });
      } catch (error) {
        log('⚠️ Could not fetch keywords:', error.message, error.stack);
        log('⚠️ Full keywords error object:', JSON.stringify(error, null, 2));
      }
    }

    // Get ads (simplified)
    if (include_ads && campaigns.length > 0) {
      const campaignIds = campaigns.map(c => c.id);
      const adQuery = `
        SELECT 
          ad_group_ad.ad.id,
          ad_group_ad.ad.name,
          ad_group_ad.status,
          ad_group_ad.ad_group,
          ad_group_ad.ad.type,
          ad_group_ad.ad.responsive_search_ad.headlines,
          ad_group_ad.ad.responsive_search_ad.descriptions,
          metrics.clicks,
          metrics.impressions,
          metrics.cost_micros,
          metrics.conversions
        FROM ad_group_ad
        WHERE campaign.resource_name IN (${campaignIds.map(id => `'customers/${account_id}/campaigns/${id}'`).join(',')})
        AND ad_group_ad.status = 'ENABLED'
        AND ${dateFilter}
        LIMIT 100
      `;

      try {
        const adResults = await customer.query(adQuery);
        log('🔍 Found', adResults.length, 'ad records');

        adResults.forEach(row => {
          const campaignId = row.ad_group_ad.ad_group.split('/').slice(-3, -2)[0];
          const campaign = campaignMap.get(campaignId);
          
          if (campaign) {
            campaign.ads.push({
              id: row.ad_group_ad.ad.id,
              name: row.ad_group_ad.ad.name || 'Unnamed Ad',
              status: row.ad_group_ad.status,
              type: row.ad_group_ad.ad.type,
              headlines: row.ad_group_ad.ad.responsive_search_ad?.headlines?.length || 0,
              descriptions: row.ad_group_ad.ad.responsive_search_ad?.descriptions?.length || 0,
              metrics: {
                clicks: row.metrics.clicks || 0,
                impressions: row.metrics.impressions || 0,
                cost: (row.metrics.cost_micros || 0) / 1000000,
                conversions: row.metrics.conversions || 0
              }
            });
          }
        });
      } catch (error) {
        log('⚠️ Could not fetch ads:', error.message, error.stack);
        log('⚠️ Full ads error object:', JSON.stringify(error, null, 2));
      }
    }

    // Format comprehensive report
    const reportSections = [];
    
    reportSections.push(`# 🎯 Comprehensive Campaign Analysis`);
    reportSections.push(`**Account:** ${account_id} | **Campaigns:** ${campaigns.length} | **Date Range:** ${date_range_days} days\n`);
    
    campaigns.forEach(campaign => {
      reportSections.push(`## 📊 ${campaign.name} (${campaign.id})`);
      reportSections.push(`**Status:** ${campaign.status} | **Type:** ${campaign.type}`);
      
      // Performance metrics
      reportSections.push(`### 📈 Performance (${date_range_days} days)`);
      reportSections.push(`- **Clicks:** ${campaign.metrics.clicks} | **Impressions:** ${campaign.metrics.impressions}`);
      reportSections.push(`- **Cost:** €${campaign.metrics.cost.toFixed(2)} | **Conversions:** ${campaign.metrics.conversions}`);
      reportSections.push(`- **CTR:** ${(campaign.metrics.ctr * 100).toFixed(2)}% | **Avg CPC:** €${campaign.metrics.avg_cpc.toFixed(2)}`);

      // Campaign settings  
      reportSections.push(`### ⚙️ Campaign Settings`);
      reportSections.push(`- **Languages:** All languages (API v21)`);
      reportSections.push(`- **Geo Targeting:** Available in campaign criteria (API v21)`);

      // Bidding
      reportSections.push(`### 🎯 Bidding Strategy`);
      reportSections.push(`- **Strategy:** ${campaign.bidding.strategy_type}`);
      if (campaign.bidding.target_cpa) reportSections.push(`- **Target CPA:** €${campaign.bidding.target_cpa.toFixed(2)}`);
      if (campaign.bidding.target_roas) reportSections.push(`- **Target ROAS:** ${(campaign.bidding.target_roas * 100).toFixed(1)}%`);

      // Ad Groups
      if (include_ad_groups && campaign.ad_groups.length > 0) {
        reportSections.push(`### 📁 Ad Groups (${campaign.ad_groups.length})`);
        campaign.ad_groups.slice(0, 5).forEach(ag => {
          reportSections.push(`- **${ag.name}:** ${ag.metrics.clicks} clicks, €${ag.metrics.cost.toFixed(2)} cost`);
        });
        if (campaign.ad_groups.length > 5) {
          reportSections.push(`- ... and ${campaign.ad_groups.length - 5} more`);
        }
      }

      // Keywords
      if (include_keywords && campaign.keywords.length > 0) {
        reportSections.push(`### 🔑 Top Keywords (${campaign.keywords.length} total)`);
        campaign.keywords
          .sort((a, b) => b.metrics.clicks - a.metrics.clicks)
          .slice(0, 5)
          .forEach(kw => {
            reportSections.push(`- **"${kw.text}"** (${kw.match_type}): ${kw.metrics.clicks} clicks, €${kw.metrics.cost.toFixed(2)}`);
          });
      }

      // Ads
      if (include_ads && campaign.ads.length > 0) {
        reportSections.push(`### 📝 Ads (${campaign.ads.length})`);
        campaign.ads.slice(0, 3).forEach(ad => {
          reportSections.push(`- **${ad.name}** (${ad.type}): ${ad.metrics.clicks} clicks, ${ad.headlines}H/${ad.descriptions}D`);
        });
      }

      reportSections.push('\n---\n');
    });

    reportSections.push(`*Generated: ${new Date().toISOString()}*`);

    log('✅ Comprehensive campaign analysis completed successfully');
    
    return {
      success: true,
      data: { 
        campaigns,
        summary: {
          total_campaigns: campaigns.length,
          total_ad_groups: campaigns.reduce((sum, c) => sum + c.ad_groups.length, 0),
          total_keywords: campaigns.reduce((sum, c) => sum + c.keywords.length, 0),
          total_ads: campaigns.reduce((sum, c) => sum + c.ads.length, 0)
        }
      },
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

/**
 * Get audience segments, demographics, and targeting insights
 */
async function getAudienceAnalysis({ 
  account_id = process.env.GADS_LIVE_ID,
  include_segments = true,
  include_demographics = true, 
  include_insights = true
}) {
  log('👥 Audience Analysis called:', { account_id, include_segments, include_demographics, include_insights });
  
  try {
    const customer = googleAdsClient.Customer({
      customer_id: account_id,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      login_customer_id: process.env.GADS_LIVE_MCC_ID
    });

    log('🔍 Querying audience data...');

    let audiences = [];
    let demographics = [];
    let customSegments = [];

    // Get audience segments
    if (include_segments) {
      try {
        const audienceQuery = `
          SELECT 
            user_list.id,
            user_list.name,
            user_list.description,
            user_list.membership_status,
            user_list.membership_life_span,
            user_list.size_for_display,
            user_list.size_for_search,
            user_list.type,
            user_list.closing_reason,
            user_list.access_reason
          FROM user_list
          WHERE user_list.type != 'UNKNOWN'
        `;
        
        const audienceResults = await customer.query(audienceQuery);
        audiences = audienceResults.map(row => row.user_list);
        log('🔍 Found', audiences.length, 'audience lists');
      } catch (error) {
        log('⚠️ Could not fetch audiences:', error.message);
      }
    }

    // Get custom segments
    if (include_segments) {
      try {
        const segmentQuery = `
          SELECT 
            custom_audience.id,
            custom_audience.name,
            custom_audience.description,
            custom_audience.status,
            custom_audience.type
          FROM custom_audience
          WHERE custom_audience.status != 'UNKNOWN'
        `;
        
        const segmentResults = await customer.query(segmentQuery);
        customSegments = segmentResults.map(row => row.custom_audience);
        log('🔍 Found', customSegments.length, 'custom segments');
      } catch (error) {
        log('⚠️ Could not fetch custom segments:', error.message);
      }
    }

    // Get demographic insights from campaign targeting criteria
    if (include_demographics) {
      try {
        const demographicQuery = `
          SELECT 
            campaign_criterion.campaign,
            campaign_criterion.criterion_id,
            campaign_criterion.status,
            campaign_criterion.age_range.type,
            campaign_criterion.gender.type,
            campaign_criterion.parental_status.type,
            campaign_criterion.income_range.type
          FROM campaign_criterion
          WHERE campaign_criterion.type IN ('AGE_RANGE', 'GENDER', 'PARENTAL_STATUS', 'INCOME_RANGE')
          AND campaign_criterion.status = 'ENABLED'
        `;
        
        const demographicResults = await customer.query(demographicQuery);
        demographics = demographicResults.map(row => row.campaign_criterion);
        log('🔍 Found', demographics.length, 'demographic targeting criteria');
      } catch (error) {
        log('⚠️ Could not fetch demographic data:', error.message);
      }
    }

    const reportText = `# 👥 Google Ads Audience Manager

## 🎯 Audience Lists (${audiences.length})
${audiences.map(audience => `
### ${audience.name} (${audience.id})
- **Type:** ${audience.type}
- **Status:** ${audience.membership_status}
- **Life Span:** ${audience.membership_life_span} days
- **Display Size:** ${audience.size_for_display || 'N/A'}
- **Search Size:** ${audience.size_for_search || 'N/A'}
- **Description:** ${audience.description || 'N/A'}
`).join('')}

## 🔧 Custom Segments (${customSegments.length})
${customSegments.map(segment => `
### ${segment.name} (${segment.id})
- **Type:** ${segment.type}
- **Status:** ${segment.status}
- **Description:** ${segment.description || 'N/A'}
`).join('')}

## 📊 Active Demographic Targeting
${include_demographics ? `
### Age Range Targeting
${demographics.filter(d => d.age_range).map(d => `- ${d.age_range.type}`).join('\n')}

### Gender Targeting  
${demographics.filter(d => d.gender).map(d => `- ${d.gender.type}`).join('\n')}

### Parental Status Targeting
${demographics.filter(d => d.parental_status).map(d => `- ${d.parental_status.type}`).join('\n')}

### Income Range Targeting
${demographics.filter(d => d.income_range).map(d => `- ${d.income_range.type}`).join('\n')}
` : 'Demographic data not requested'}

## 💡 Insights
- **Total Audience Lists:** ${audiences.length}
- **Custom Segments:** ${customSegments.length}
- **Active Demographic Criteria:** ${demographics.length}
- **Student-focused Lists:** ${audiences.filter(a => a.name.toLowerCase().includes('student')).length}

*Generated: ${new Date().toISOString()}*`;

    log('✅ Audience Analysis completed successfully');
    
    return {
      success: true,
      data: {
        audiences,
        custom_segments: customSegments,
        demographics
      },
      report: reportText
    };

  } catch (error) {
    log('❌ Audience Analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      report: `❌ **Error getting audience data:**\n\n${error.message}\n\nPlease check your Google Ads API credentials and account access.`
    };
  }
}

/**
 * Create a new Google Ads campaign based on an existing successful campaign
 */
// Import create and update functionality from separate file
const { createCampaignFromTemplate, updateCampaignBudget, updateCampaignStatus } = require('./mcp-api-create');

module.exports = {
  getAccountOverview,
  getCampaignAnalysis,
  getAudienceAnalysis,
  createCampaignFromTemplate,
  updateCampaignBudget,
  updateCampaignStatus,
  googleAdsClient // Export client for future extensions
};