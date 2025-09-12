/**
 * ENHANCED: Pipeline Predicted ROAS Analysis with Attribution Fix
 * /scripts/analytics/roas-predicted.js
 * 
 * ATTRIBUTION ENHANCEMENTS:
 * - Enhanced attribution logic handles {campaign} tracking template issue
 * - Uses custom 'google_ads_campaign' field for correct attribution
 * - Multi-layered attribution matching consistent with other enhanced files
 * - Comprehensive attribution quality reporting
 * 
 * Provides forward-looking ROAS prediction based on deal creation and adjusted amounts.
 * Formula: [Sum of Adjusted Amounts from Deals Created] ÷ [Cash Spent on Ads]
 * 
 * PIPELINE PREDICTION METHOD:
 * - Campaign Spend: FROM gads_campaign_metrics (cost_eur) during timeframe
 * - Attribution: VIA enhanced Google Ads attribution (handles {campaign} issue)
 * - Revenue Prediction: FROM hub_deals.adjusted_amount WHERE createdate in timeframe
 * - Pipeline Breakdown: Group by dealstage with stage labels and probabilities
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

/**
 * Enhanced attribution logic for campaign matching
 */
function buildEnhancedCampaignAttributionJoin(campaignAlias = 'c') {
  return `
    (
      hc.hs_analytics_source = 'PAID_SEARCH' 
      AND (
        -- Standard attribution: Match by campaign ID when not broken
        (
          hc.hs_analytics_source_data_1 != '{campaign}'
          AND hc.hs_analytics_source_data_1 IS NOT NULL
          AND hc.hs_analytics_source_data_1 != ''
          AND hc.hs_analytics_source_data_1 = ${campaignAlias}.google_campaign_id
        )
        OR
        -- Enhanced attribution: Match by campaign name when tracking template broken
        (
          hc.hs_analytics_source_data_1 = '{campaign}'
          AND hc.google_ads_campaign IS NOT NULL
          AND hc.google_ads_campaign != ''
          AND hc.google_ads_campaign = ${campaignAlias}.campaign_name
        )
        OR
        -- Fallback attribution: Match by campaign name when available
        (
          hc.google_ads_campaign IS NOT NULL
          AND hc.google_ads_campaign != ''
          AND hc.google_ads_campaign = ${campaignAlias}.campaign_name
          AND (
            hc.hs_analytics_source_data_1 IS NULL
            OR hc.hs_analytics_source_data_1 = ''
            OR hc.hs_analytics_source_data_1 = '{campaign}'
          )
        )
      )
      AND (
        hc.hubspot_owner_id != 10017927 
        OR hc.hubspot_owner_id IS NULL 
        OR hc.hubspot_owner_id = ''
      )
      AND hc.territory != 'Unsupported Territory'
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
 * ENHANCED: Get Pipeline Predicted ROAS Report with Attribution Fix
 * @param {Function} getDbConnection - Database connection function
 * @param {Object} options - Query options
 * @returns {Object} Pipeline prediction analysis with stage breakdown and attribution enhancement
 */
async function getPipelinePredictedROAS(getDbConnection, options = {}) {
  try {
    console.log('🔮 Starting Enhanced Attribution Pipeline Predicted ROAS Analysis...');
    
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
      console.log(`📊 Analysis mode: Enhanced Attribution Pipeline Predicted (Deal Create Date)`);
      
      // Load stage mapping for labels and probabilities
      const stageMapping = loadStageMapping();
      
      // ENHANCED: First get attribution quality metrics
      const [attributionQuality] = await connection.execute(`
        SELECT 
          COUNT(CASE 
            WHEN hc.hs_analytics_source_data_1 != '{campaign}' 
            AND hc.hs_analytics_source_data_1 IS NOT NULL 
            AND hc.hs_analytics_source_data_1 != '' 
            THEN 1 
          END) as standard_attribution,
          COUNT(CASE 
            WHEN hc.hs_analytics_source_data_1 = '{campaign}' 
            AND hc.google_ads_campaign IS NOT NULL 
            AND hc.google_ads_campaign != '' 
            THEN 1 
          END) as enhanced_attribution,
          COUNT(CASE 
            WHEN hc.hs_analytics_source_data_1 = '{campaign}' 
            THEN 1 
          END) as broken_template_count,
          COUNT(*) as total_contacts
        FROM hub_contacts hc
        WHERE hc.hs_analytics_source = 'PAID_SEARCH'
          AND (
            hc.hubspot_owner_id != 10017927 
            OR hc.hubspot_owner_id IS NULL 
            OR hc.hubspot_owner_id = ''
          )
          AND hc.territory != 'Unsupported Territory'
          AND DATE(hc.createdate) >= ? AND DATE(hc.createdate) <= ?
      `, [startDateStr, endDateStr]);
      
      const attrQuality = attributionQuality[0] || {};
      console.log(`🔧 Attribution Quality:`, {
        standard: attrQuality.standard_attribution,
        enhanced: attrQuality.enhanced_attribution,
        broken: attrQuality.broken_template_count,
        total: attrQuality.total_contacts
      });
      
      // ENHANCED: Main pipeline prediction query with enhanced attribution
      const [results] = await connection.execute(`
        SELECT 
          c.google_campaign_id,
          c.campaign_name,
          c.status,
          c.campaign_type_name,
          
          -- SPEND: Subquery to prevent multiplication from JOINs
          (SELECT COALESCE(SUM(m2.cost_eur), 0) 
           FROM gads_campaign_metrics m2 
           WHERE m2.google_campaign_id = c.google_campaign_id 
           AND m2.date >= ? AND m2.date <= ?) as total_spend,
          
          -- ENHANCED ATTRIBUTION: Count contacts attributed to this campaign
          COUNT(DISTINCT hc.hubspot_id) as total_contacts,
          
          -- Attribution quality breakdown per campaign
          COUNT(DISTINCT CASE 
            WHEN hc.hs_analytics_source_data_1 != '{campaign}' 
            AND hc.hs_analytics_source_data_1 IS NOT NULL 
            AND hc.hs_analytics_source_data_1 != '' 
            THEN hc.hubspot_id 
          END) as standard_contacts,
          COUNT(DISTINCT CASE 
            WHEN hc.hs_analytics_source_data_1 = '{campaign}' 
            AND hc.google_ads_campaign IS NOT NULL 
            AND hc.google_ads_campaign != '' 
            THEN hc.hubspot_id 
          END) as enhanced_contacts,
          
          -- PIPELINE BREAKDOWN: Group by deal stage
          hd.dealstage,
          COUNT(DISTINCT hd.hubspot_deal_id) as stage_deal_count,
          
          -- ADJUSTED AMOUNT: Sum of adjusted amounts for this stage
          COALESCE(SUM(DISTINCT CASE 
            WHEN hd.adjusted_amount IS NOT NULL AND hd.adjusted_amount > 0
            THEN CAST(hd.adjusted_amount as DECIMAL(15,2)) 
            ELSE 0 
          END), 0) as stage_adjusted_amount
          
        FROM gads_campaigns c
        
        -- ENHANCED: Join contacts using enhanced attribution logic
        LEFT JOIN hub_contacts hc ON (
          ${buildEnhancedCampaignAttributionJoin('c')}
        )
        
        -- Join deals from contacts (filtered by CREATE date for Pipeline analysis)
        LEFT JOIN hub_contact_deal_associations a ON hc.hubspot_id = a.contact_hubspot_id
        LEFT JOIN hub_deals hd ON a.deal_hubspot_id = hd.hubspot_deal_id 
          AND hd.pipeline = 'default'
          AND DATE(hd.createdate) >= ? AND DATE(hd.createdate) <= ?
        
        WHERE ${statusFilter}
        
        GROUP BY c.google_campaign_id, c.campaign_name, c.status, c.campaign_type_name, hd.dealstage
        HAVING total_spend > 0 OR total_contacts > 0  -- Only campaigns with activity
        ORDER BY total_spend DESC, stage_adjusted_amount DESC
      `, [startDateStr, endDateStr, startDateStr, endDateStr]);
      
      console.log(`📊 Found ${results.length} enhanced attribution campaign-stage combinations`);
      
      // Process results to create campaign summaries and pipeline breakdown
      const campaignMap = new Map();
      const pipelineStages = new Map();
      
      results.forEach(row => {
        const campaignId = row.google_campaign_id;
        const stage = row.dealstage;
        
        // Initialize campaign if not exists
        if (!campaignMap.has(campaignId)) {
          campaignMap.set(campaignId, {
            google_campaign_id: campaignId,
            campaign_name: row.campaign_name || 'Unknown Campaign',
            status: parseInt(row.status),
            campaign_type_name: row.campaign_type_name || 'Unknown',
            total_spend: parseFloat(row.total_spend) || 0,
            total_contacts: parseInt(row.total_contacts) || 0,
            total_deals: 0,
            total_adjusted_amount: 0,
            stages: new Map(),
            // Enhanced attribution breakdown per campaign
            attribution_breakdown: {
              standard_contacts: parseInt(row.standard_contacts) || 0,
              enhanced_contacts: parseInt(row.enhanced_contacts) || 0,
              enhancement_active: (parseInt(row.enhanced_contacts) || 0) > 0
            }
          });
        }
        
        const campaign = campaignMap.get(campaignId);
        
        // Update campaign totals (avoid double counting)
        campaign.total_contacts = Math.max(campaign.total_contacts, parseInt(row.total_contacts) || 0);
        campaign.attribution_breakdown.standard_contacts = Math.max(
          campaign.attribution_breakdown.standard_contacts, 
          parseInt(row.standard_contacts) || 0
        );
        campaign.attribution_breakdown.enhanced_contacts = Math.max(
          campaign.attribution_breakdown.enhanced_contacts, 
          parseInt(row.enhanced_contacts) || 0
        );
        
        // Add stage data if stage exists
        if (stage && row.stage_deal_count > 0) {
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
          
          campaign.stages.set(stage, stageData);
          campaign.total_deals += stageData.deal_count;
          campaign.total_adjusted_amount += stageData.adjusted_amount;
          
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
        }
      });
      
      // Convert to arrays and calculate ROAS
      const campaigns = Array.from(campaignMap.values()).map(campaign => {
        // Convert stages map to sorted array
        campaign.stages = Array.from(campaign.stages.values())
          .sort((a, b) => a.displayOrder - b.displayOrder);
        
        // Calculate predicted ROAS
        campaign.predicted_roas = campaign.total_spend > 0 ? 
          parseFloat((campaign.total_adjusted_amount / campaign.total_spend).toFixed(4)) : 0;
        
        // Calculate contact rate
        campaign.contact_rate = campaign.total_spend > 0 ? 
          parseFloat(((campaign.total_contacts / campaign.total_spend) * 100).toFixed(2)) : 0;
        
        // Calculate attribution enhancement coverage for this campaign
        const totalAttributed = campaign.attribution_breakdown.standard_contacts + campaign.attribution_breakdown.enhanced_contacts;
        campaign.attribution_breakdown.total_attributed = totalAttributed;
        campaign.attribution_breakdown.enhancement_percentage = totalAttributed > 0 ? 
          ((campaign.attribution_breakdown.enhanced_contacts / totalAttributed) * 100).toFixed(1) : '0';
        
        return campaign;
      });
      
      // Sort campaigns by predicted ROAS
      campaigns.sort((a, b) => b.predicted_roas - a.predicted_roas);
      
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
      const enhancedCampaigns = campaigns.filter(c => c.attribution_breakdown.enhancement_active).length;
      
      console.log(`📈 Enhanced Attribution Pipeline Prediction Distribution:`);
      console.log(`   🟢 Excellent (≥3.0): ${excellentCampaigns} campaigns`);
      console.log(`   🔵 Good (2.0-2.99): ${goodCampaigns} campaigns`);
      console.log(`   🟡 Average (1.0-1.99): ${averageCampaigns} campaigns`);
      console.log(`   🔴 Poor (0.1-0.99): ${poorCampaigns} campaigns`);
      console.log(`   ⚫ Zero Prediction: ${zeroCampaigns} campaigns`);
      console.log(`   🔧 Attribution Enhanced: ${enhancedCampaigns} campaigns`);
      
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
          zero: zeroCampaigns,
          enhanced_campaigns: enhancedCampaigns
        },
        // Enhanced attribution metadata
        attribution_enhancement: {
          status: 'ACTIVE',
          features: [
            'Campaign tracking template fix',
            'Custom Google Ads Campaign field integration',
            'Multi-layered campaign matching',
            'Pipeline prediction enhancement'
          ],
          quality_metrics: {
            standard_attribution: parseInt(attrQuality.standard_attribution) || 0,
            enhanced_attribution: parseInt(attrQuality.enhanced_attribution) || 0,
            broken_template_count: parseInt(attrQuality.broken_template_count) || 0,
            total_contacts: parseInt(attrQuality.total_contacts) || 0,
            enhancement_coverage: attrQuality.broken_template_count > 0 ? 
              ((attrQuality.enhanced_attribution / attrQuality.broken_template_count) * 100).toFixed(1) + '%' : '100%'
          },
          campaigns_with_enhancement: enhancedCampaigns
        },
        metadata: {
          status_filter: status,
          period: periodDescription,
          start_date: startDateStr,
          end_date: endDateStr,
          analysis_description: 'Enhanced Attribution Pipeline Predicted (Deal Create Date)',
          attribution_method: 'enhanced_multi_layered_campaign_matching',
          data_sources: {
            spend: 'gads_campaign_metrics.cost_eur (filtered by date)',
            attribution: 'Enhanced Google Ads attribution with {campaign} fix',
            deals: 'hub_deals (filtered by createdate)',
            prediction: 'hub_deals.adjusted_amount (all active stages) - Enhanced Attribution'
          },
          enhancement_notes: [
            'Includes contacts with broken {campaign} tracking template',
            'Uses custom google_ads_campaign field for attribution recovery',
            'Multi-layered campaign matching logic applied',
            'Attribution quality metrics included per campaign'
          ]
        },
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Enhanced Attribution Pipeline Predicted ROAS Analysis Complete:`);
      console.log(`   🔮 Predicted ROAS: ${portfolio.predicted_roas.toFixed(2)}:1`);
      console.log(`   📊 Total Spend: €${portfolio.total_spend.toLocaleString()}`);
      console.log(`   💎 Predicted Revenue: €${portfolio.total_adjusted_amount.toLocaleString()}`);
      console.log(`   🎯 Active Campaigns: ${campaigns.length}`);
      console.log(`   📈 Pipeline Stages: ${overallPipeline.length}`);
      console.log(`   🔧 Attribution Enhanced: ${enhancedCampaigns} campaigns with fixes applied`);
      
      return result;
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Enhanced Attribution Pipeline Predicted ROAS Analysis failed:', error.message);
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
  // Export enhanced attribution functions for consistency
  buildEnhancedCampaignAttributionJoin
};