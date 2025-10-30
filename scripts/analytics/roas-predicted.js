/**
 * ENHANCED: Pipeline Predicted ROAS Analysis with Simplified Attribution
 * /scripts/analytics/roas-predicted.js
 *
 * UPDATED: Now uses google_ads_campaign as PRIMARY attribution field
 * - google_ads_campaign: Standardized campaign names (96% of contacts)
 * - hs_analytics_source_data_1: Fallback for unmapped legacy contacts
 * - Simplified attribution logic prioritizing clean campaign names
 * - Matches roas-revenue.js attribution method
 *
 * Provides forward-looking ROAS prediction based on deal creation and adjusted amounts.
 * Formula: [Sum of Adjusted Amounts from Deals Created] ÷ [Cash Spent on Ads]
 *
 * PIPELINE PREDICTION METHOD:
 * - Campaign Spend: FROM gads_campaign_metrics (cost_eur) during timeframe
 * - Attribution: VIA simplified Google Ads attribution (google_ads_campaign primary)
 * - Revenue Prediction: FROM hub_deals.adjusted_amount WHERE createdate in timeframe
 * - Pipeline Breakdown: Group by dealstage with stage labels and probabilities
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

/**
 * Enhanced Google Ads attribution logic - SIMPLIFIED
 * UPDATED: Now uses google_ads_campaign as primary attribution field
 */
function buildEnhancedAttributionQuery() {
  return `
    (
      -- PRIMARY: PAID_SEARCH contacts with google_ads_campaign populated
      (
        hc.hs_analytics_source = 'PAID_SEARCH'
        AND hc.google_ads_campaign IS NOT NULL
        AND hc.google_ads_campaign != ''
      )

      OR

      -- FALLBACK: PAID_SEARCH contacts without google_ads_campaign (legacy/unmapped)
      (
        hc.hs_analytics_source = 'PAID_SEARCH'
        AND (hc.google_ads_campaign IS NULL OR hc.google_ads_campaign = '')
        AND hc.hs_analytics_source_data_1 IS NOT NULL
        AND hc.hs_analytics_source_data_1 != ''
        AND hc.hs_analytics_source_data_1 != '{campaign}'
      )

      OR

      -- FIX: GOOGLE BUSINESS - Reclassify gb sources with GCLID
      (
        hc.hs_analytics_source = 'Other Campaigns'
        AND hc.hs_analytics_source_data_1 = 'gb'
        AND hc.gclid IS NOT NULL
        AND hc.gclid != ''
      )
    )
  `;
}

// Load stage mapping from JSON file (same as pipeline-server.js)
function loadStageMapping() {
  try {
    const stageMappingFile = path.join(__dirname, 'stage-map.json');

    if (!fs.existsSync(stageMappingFile)) {
      console.warn('⚠️ Stage mapping file not found, using fallback mapping');
      // Fallback mapping if file is missing
      return {
        'appointmentscheduled': { label: 'INBOX', displayOrder: 1, probability: 0.1 },
        '113151423': { label: 'SEQUENCED', displayOrder: 2, probability: 0.1 },
        'qualifiedtobuy': { label: 'ENGAGING', displayOrder: 3, probability: 0.25 },
        '767120827': { label: 'RESPONSIVE', displayOrder: 4, probability: 0.5 },
        'presentationscheduled': { label: 'ADVISING', displayOrder: 5, probability: 0.6 },
        'decisionmakerboughtin': { label: 'CONSIDERATION & NEGOTIATION', displayOrder: 6, probability: 0.75 },
        '114331579': { label: 'MAYBE / FUTURE', displayOrder: 7, probability: 0.1 },
        '111070952': { label: 'TRIAL', displayOrder: 8, probability: 0.8 },
        'contractsent': { label: 'CONTRACT', displayOrder: 9, probability: 0.9 },
        'closedwon': { label: 'WON', displayOrder: 10, probability: 1.0 },
        'closedlost': { label: 'LOST', displayOrder: 11, probability: 0.0 }
      };
    }

    const stageData = JSON.parse(fs.readFileSync(stageMappingFile, 'utf8'));
    console.log(`✅ Successfully loaded stage mapping from stage-map.json`);
    return stageData.stageMapping || stageData;

  } catch (error) {
    console.error('⚠️ Error loading stage mapping:', error.message);
    // Return fallback mapping
    return {
      'appointmentscheduled': { label: 'INBOX', displayOrder: 1, probability: 0.1 },
      '113151423': { label: 'SEQUENCED', displayOrder: 2, probability: 0.1 },
      'qualifiedtobuy': { label: 'ENGAGING', displayOrder: 3, probability: 0.25 },
      '767120827': { label: 'RESPONSIVE', displayOrder: 4, probability: 0.5 },
      'presentationscheduled': { label: 'ADVISING', displayOrder: 5, probability: 0.6 },
      'decisionmakerboughtin': { label: 'CONSIDERATION & NEGOTIATION', displayOrder: 6, probability: 0.75 },
      '114331579': { label: 'MAYBE / FUTURE', displayOrder: 7, probability: 0.1 },
      '111070952': { label: 'TRIAL', displayOrder: 8, probability: 0.8 },
      'contractsent': { label: 'CONTRACT', displayOrder: 9, probability: 0.9 },
      'closedwon': { label: 'WON', displayOrder: 10, probability: 1.0 },
      'closedlost': { label: 'LOST', displayOrder: 11, probability: 0.0 }
    };
  }
}

/**
 * ENHANCED: Get Pipeline Predicted ROAS Report with Simplified Attribution
 * @param {Function} getDbConnection - Database connection function
 * @param {Object} options - Query options
 * @returns {Object} Pipeline prediction analysis with stage breakdown and simplified attribution
 */
async function getPipelinePredictedROAS(getDbConnection, options = {}) {
  try {
    console.log('🔮 Starting Simplified Attribution Pipeline Predicted ROAS Analysis...');

    const {
      status = 'active',           // 'active', 'paused', 'all'
      days = 30,                   // Number of days (if no custom dates)
      startDate = null,            // Custom start date (YYYY-MM-DD)
      endDate = null               // Custom end date (YYYY-MM-DD)
    } = options;

    const connection = await getDbConnection();

    try {
      // Calculate date range
      let startDateStr, endDateStr, periodDescription;

      if (startDate && endDate) {
        startDateStr = startDate;
        endDateStr = endDate;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        periodDescription = `${startDate} to ${endDate} (${daysDiff} days)`;
      } else {
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (days - 1));
        startDate.setHours(0, 0, 0, 0);

        startDateStr = startDate.toISOString().slice(0, 10);
        endDateStr = endDate.toISOString().slice(0, 10);
        periodDescription = `Last ${days} days (${startDateStr} to ${endDateStr})`;
      }

      console.log(`📅 Analysis period: ${periodDescription}`);

      // Build status filter
      let statusFilter;
      switch(status.toLowerCase()) {
        case 'active':
          statusFilter = 'c.status = 2';
          break;
        case 'paused':
          statusFilter = 'c.status = 3';
          break;
        case 'all':
          statusFilter = 'c.status IN (2, 3)';
          break;
        default:
          statusFilter = 'c.status = 2';
      }

      console.log(`🎯 Campaign status filter: ${statusFilter}`);
      console.log(`📊 Analysis mode: Simplified Attribution Pipeline Predicted (Deal Create Date)`);

      // Load stage mapping for labels and probabilities
      const stageMapping = loadStageMapping();

      // STEP 1: Get all campaigns with spend data
      console.log('📋 Step 1: Fetching campaigns with spend data...');
      const [campaignRows] = await connection.execute(`
        SELECT
          c.google_campaign_id,
          c.campaign_name,
          c.status,
          c.campaign_type_name,
          COALESCE(SUM(m.cost_eur), 0) as total_spend
        FROM gads_campaigns c
        LEFT JOIN gads_campaign_metrics m ON c.google_campaign_id = m.google_campaign_id
          AND m.date >= ? AND m.date <= ?
        WHERE ${statusFilter}
        GROUP BY c.google_campaign_id, c.campaign_name, c.status, c.campaign_type_name
        HAVING total_spend > 0
        ORDER BY total_spend DESC
      `, [startDateStr, endDateStr]);

      console.log(`✅ Found ${campaignRows.length} campaigns with spend`);

      // STEP 2: For each campaign, get contacts, deals, and pipeline breakdown
      console.log('📊 Step 2: Fetching pipeline data for each campaign...');

      const campaigns = [];
      const pipelineStages = new Map();

      for (const campaign of campaignRows) {
        const campaignName = campaign.campaign_name;
        const campaignId = campaign.google_campaign_id;

        // Query pipeline data for this campaign
        const [pipelineRows] = await connection.execute(`
          SELECT
            hd.dealstage,
            COUNT(DISTINCT hd.hubspot_deal_id) as stage_deal_count,
            COALESCE(SUM(DISTINCT CAST(hd.adjusted_amount as DECIMAL(15,2))), 0) as stage_adjusted_amount,
            COUNT(DISTINCT hc.hubspot_id) as contact_count
          FROM hub_contacts hc
          LEFT JOIN hub_contact_deal_associations a ON hc.hubspot_id = a.contact_hubspot_id
          LEFT JOIN hub_deals hd ON a.deal_hubspot_id = hd.hubspot_deal_id
            AND hd.pipeline = 'default'
            AND DATE(hd.createdate) >= ? AND DATE(hd.createdate) <= ?
          WHERE ${buildEnhancedAttributionQuery()}
            AND (
              -- PRIMARY: Match by standardized google_ads_campaign name
              hc.google_ads_campaign = ?
              OR
              -- FALLBACK: Match by legacy campaign name in source_data_1
              hc.hs_analytics_source_data_1 = ?
            )
            AND (
              hc.hubspot_owner_id != 10017927
              OR hc.hubspot_owner_id IS NULL
              OR hc.hubspot_owner_id = ''
            )
            AND hc.territory != 'Unsupported Territory'
          GROUP BY hd.dealstage
        `, [startDateStr, endDateStr, campaignName, campaignId]);

        // Get total contact count for this campaign
        const [contactRows] = await connection.execute(`
          SELECT COUNT(DISTINCT hc.hubspot_id) as total_contacts
          FROM hub_contacts hc
          WHERE ${buildEnhancedAttributionQuery()}
            AND (
              -- PRIMARY: Match by standardized google_ads_campaign name
              hc.google_ads_campaign = ?
              OR
              -- FALLBACK: Match by legacy campaign name in source_data_1
              hc.hs_analytics_source_data_1 = ?
            )
            AND (
              hc.hubspot_owner_id != 10017927
              OR hc.hubspot_owner_id IS NULL
              OR hc.hubspot_owner_id = ''
            )
            AND hc.territory != 'Unsupported Territory'
        `, [campaignName, campaignId]);

        const totalContacts = contactRows[0]?.total_contacts || 0;

        // Process pipeline stages for this campaign
        const campaignStages = new Map();
        let totalDeals = 0;
        let totalAdjustedAmount = 0;

        pipelineRows.forEach(row => {
          const stage = row.dealstage;
          if (!stage) return;

          const stageLabel = stageMapping[stage]?.label || stage;
          const stageProbability = stageMapping[stage]?.probability || 0;
          const stageOrder = stageMapping[stage]?.displayOrder || 999;

          const stageData = {
            stage: stage,
            label: stageLabel,
            probability: stageProbability,
            displayOrder: stageOrder,
            deal_count: parseInt(row.stage_deal_count) || 0,
            adjusted_amount: parseFloat(row.stage_adjusted_amount) || 0
          };

          campaignStages.set(stage, stageData);
          totalDeals += stageData.deal_count;
          totalAdjustedAmount += stageData.adjusted_amount;

          // Track overall pipeline stages
          if (!pipelineStages.has(stage)) {
            pipelineStages.set(stage, {
              stage: stage,
              label: stageLabel,
              probability: stageProbability,
              displayOrder: stageOrder,
              total_deals: 0,
              total_adjusted_amount: 0
            });
          }

          const pipelineStage = pipelineStages.get(stage);
          pipelineStage.total_deals += stageData.deal_count;
          pipelineStage.total_adjusted_amount += stageData.adjusted_amount;
        });

        // Convert stages map to sorted array
        const stages = Array.from(campaignStages.values())
          .sort((a, b) => a.displayOrder - b.displayOrder);

        // Calculate metrics
        const predictedROAS = campaign.total_spend > 0 ?
          parseFloat((totalAdjustedAmount / campaign.total_spend).toFixed(4)) : 0;

        const contactRate = campaign.total_spend > 0 ?
          parseFloat(((totalContacts / campaign.total_spend) * 100).toFixed(2)) : 0;

        campaigns.push({
          google_campaign_id: campaignId,
          campaign_name: campaignName,
          status: parseInt(campaign.status),
          campaign_type_name: campaign.campaign_type_name || 'Unknown',
          total_spend: parseFloat(campaign.total_spend) || 0,
          total_contacts: totalContacts,
          total_deals: totalDeals,
          total_adjusted_amount: totalAdjustedAmount,
          predicted_roas: predictedROAS,
          contact_rate: contactRate,
          stages: stages
        });
      }

      // Sort campaigns by predicted ROAS
      campaigns.sort((a, b) => b.predicted_roas - a.predicted_roas);

      console.log(`📊 Processed ${campaigns.length} campaigns with pipeline data`);

      // Create overall pipeline breakdown
      const overallPipeline = Array.from(pipelineStages.values())
        .sort((a, b) => a.displayOrder - b.displayOrder);

      // Calculate portfolio totals
      const portfolio = {
        total_campaigns: campaigns.length,
        total_spend: campaigns.reduce((sum, c) => sum + c.total_spend, 0),
        total_contacts: campaigns.reduce((sum, c) => sum + c.total_contacts, 0),
        total_deals: campaigns.reduce((sum, c) => sum + c.total_deals, 0),
        total_adjusted_amount: campaigns.reduce((sum, c) => sum + c.total_adjusted_amount, 0)
      };

      // Calculate portfolio predicted ROAS
      portfolio.predicted_roas = portfolio.total_spend > 0 ?
        portfolio.total_adjusted_amount / portfolio.total_spend : 0;

      // Calculate portfolio metrics
      portfolio.overall_contact_rate = portfolio.total_spend > 0 ?
        (portfolio.total_contacts / portfolio.total_spend) * 100 : 0;

      // Performance distribution
      const excellentCampaigns = campaigns.filter(c => c.predicted_roas >= 3.0).length;
      const goodCampaigns = campaigns.filter(c => c.predicted_roas >= 2.0 && c.predicted_roas < 3.0).length;
      const averageCampaigns = campaigns.filter(c => c.predicted_roas >= 1.0 && c.predicted_roas < 2.0).length;
      const poorCampaigns = campaigns.filter(c => c.predicted_roas > 0 && c.predicted_roas < 1.0).length;
      const zeroCampaigns = campaigns.filter(c => c.predicted_roas === 0).length;

      console.log(`📈 Simplified Attribution Pipeline Prediction Distribution:`);
      console.log(`   🟢 Excellent (≥3.0): ${excellentCampaigns} campaigns`);
      console.log(`   🔵 Good (2.0-2.99): ${goodCampaigns} campaigns`);
      console.log(`   🟡 Average (1.0-1.99): ${averageCampaigns} campaigns`);
      console.log(`   🔴 Poor (0.1-0.99): ${poorCampaigns} campaigns`);
      console.log(`   ⚫ Zero Prediction: ${zeroCampaigns} campaigns`);

      const result = {
        success: true,
        campaigns: campaigns,
        pipeline_stages: overallPipeline,
        summary: portfolio,
        performance_distribution: {
          excellent: excellentCampaigns,
          good: goodCampaigns,
          average: averageCampaigns,
          poor: poorCampaigns,
          zero: zeroCampaigns
        },
        // Simplified attribution metadata
        attribution_enhancement: {
          status: 'ACTIVE - SIMPLIFIED',
          method: 'google_ads_campaign primary with fallback',
          features: [
            'google_ads_campaign field as PRIMARY attribution source',
            'hs_analytics_source_data_1 as FALLBACK for legacy contacts',
            'Simplified direct campaign matching logic',
            'Consistent with roas-revenue.js attribution method'
          ],
          improvement: 'Matches 96% of contacts via google_ads_campaign field'
        },
        metadata: {
          status_filter: status,
          period: periodDescription,
          start_date: startDateStr,
          end_date: endDateStr,
          analysis_description: 'Simplified Attribution Pipeline Predicted (Deal Create Date)',
          attribution_method: 'simplified_google_ads_campaign_primary',
          data_sources: {
            spend: 'gads_campaign_metrics.cost_eur (filtered by date)',
            attribution: 'Simplified Google Ads attribution via google_ads_campaign field',
            deals: 'hub_deals (filtered by createdate)',
            prediction: 'hub_deals.adjusted_amount (all active stages)'
          },
          enhancement_notes: [
            'Uses google_ads_campaign as primary attribution field',
            'Falls back to hs_analytics_source_data_1 for unmapped contacts',
            'Simplified query logic for better performance',
            'Consistent with revenue ROAS attribution method'
          ]
        },
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Simplified Attribution Pipeline Predicted ROAS Analysis Complete:`);
      console.log(`   🔮 Predicted ROAS: ${portfolio.predicted_roas.toFixed(2)}:1`);
      console.log(`   📊 Total Spend: €${portfolio.total_spend.toLocaleString()}`);
      console.log(`   💎 Predicted Revenue: €${portfolio.total_adjusted_amount.toLocaleString()}`);
      console.log(`   🎯 Active Campaigns: ${campaigns.length}`);
      console.log(`   📈 Pipeline Stages: ${overallPipeline.length}`);

      return result;

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('❌ Simplified Attribution Pipeline Predicted ROAS Analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      campaigns: [],
      pipeline_stages: [],
      summary: {
        total_campaigns: 0,
        total_spend: 0,
        total_adjusted_amount: 0,
        predicted_roas: 0
      },
      attribution_enhancement: {
        status: 'ERROR',
        error: error.message
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getPipelinePredictedROAS,
  // Export simplified attribution function for consistency
  buildEnhancedAttributionQuery
};
