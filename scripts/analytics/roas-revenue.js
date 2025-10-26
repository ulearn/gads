/**
 * ENHANCED: Campaign Revenue Report with Attribution Fixes
 * /scripts/analytics/roas-revenue.js
 *
 * UPDATED: Now uses google_ads_campaign as PRIMARY attribution field
 * - google_ads_campaign: Standardized campaign names (96% of contacts)
 * - hs_analytics_source_data_1: Fallback for unmapped legacy contacts
 * - Simplified attribution logic prioritizing clean campaign names
 */

const mysql = require('mysql2/promise');

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

/**
 * Get the effective campaign name for attribution
 * UPDATED: Prioritizes google_ads_campaign as primary source
 */
function getCampaignAttributionLogic() {
  return `
    CASE
      -- PRIMARY: Use google_ads_campaign field (standardized names)
      WHEN hc.google_ads_campaign IS NOT NULL AND hc.google_ads_campaign != ''
      THEN hc.google_ads_campaign

      -- FALLBACK: Use source_data_1 for unmapped legacy contacts
      WHEN hc.hs_analytics_source = 'PAID_SEARCH'
           AND hc.hs_analytics_source_data_1 IS NOT NULL
           AND hc.hs_analytics_source_data_1 != ''
           AND hc.hs_analytics_source_data_1 != '{campaign}'
      THEN hc.hs_analytics_source_data_1

      -- For gb sources, derive from GCLID
      WHEN hc.hs_analytics_source = 'Other Campaigns'
           AND hc.hs_analytics_source_data_1 = 'gb'
           AND hc.gclid IS NOT NULL
      THEN CONCAT('gb-gclid-', SUBSTRING(hc.gclid, 1, 8))

      -- Default to "Campaign Unknown" for unidentifiable data
      ELSE 'Campaign Unknown'
    END
  `;
}

/**
 * Get True ROAS Campaign Attribution Report - ENHANCED VERSION
 */
async function getTrueROASCampaigns(getDbConnection, options = {}) {
  try {
    console.log('📊 Starting Enhanced Campaign Revenue Report (Attribution Fixes Applied)...');
    
    const {
      status = 'active',
      days = 30,
      startDate = null,
      endDate = null
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
        case 'active': statusFilter = 'c.status = 2'; break;
        case 'paused': statusFilter = 'c.status = 3'; break;
        case 'all': statusFilter = 'c.status IN (2, 3)'; break;
        default: statusFilter = 'c.status = 2';
      }
      
      // STEP 1: Get total portfolio revenue using enhanced attribution
      console.log(`🔍 Getting total portfolio revenue with attribution fixes...`);
      
      const [totalRevenueResult] = await connection.execute(`
        SELECT
          COUNT(DISTINCT hd.hubspot_deal_id) as total_won_deals,
          COALESCE(SUM(hd.amount), 0) as total_revenue,
          COUNT(DISTINCT hc.hubspot_id) as total_attributed_contacts
        FROM hub_deals hd
        JOIN hub_contact_deal_associations a ON hd.hubspot_deal_id = a.deal_hubspot_id
        JOIN hub_contacts hc ON a.contact_hubspot_id = hc.hubspot_id
        WHERE hd.dealstage = 'closedwon'
          AND DATE(hd.closedate) >= ? AND DATE(hd.closedate) <= ?
          AND hd.pipeline = 'default'
          AND ${buildEnhancedAttributionQuery()}
          AND (
            hc.hubspot_owner_id != 10017927
            OR hc.hubspot_owner_id IS NULL
            OR hc.hubspot_owner_id = ''
          )
          AND hc.territory != 'Unsupported Territory'
      `, [startDateStr, endDateStr]);
      
      const totalPortfolioRevenue = parseFloat(totalRevenueResult[0].total_revenue) || 0;
      const totalAttributedContacts = parseInt(totalRevenueResult[0].total_attributed_contacts) || 0;
      
      console.log(`💰 Enhanced attribution results:`);
      console.log(`   📊 Total Portfolio Revenue: €${totalPortfolioRevenue.toLocaleString()}`);
      console.log(`   👥 Total Attributed Contacts: ${totalAttributedContacts.toLocaleString()}`);
      
      // STEP 2: Get attribution quality breakdown
      const [attributionBreakdown] = await connection.execute(`
        SELECT
          'Standard PAID_SEARCH' as attribution_type,
          COUNT(DISTINCT hc.hubspot_id) as contact_count,
          COUNT(DISTINCT CASE
            WHEN hd.hubspot_deal_id IS NOT NULL
              AND hd.pipeline = 'default'
              AND DATE(hd.closedate) >= ? AND DATE(hd.closedate) <= ?
            THEN hd.hubspot_deal_id
          END) as deal_count,
          COALESCE(SUM(CASE
            WHEN hd.dealstage = 'closedwon'
              AND hd.pipeline = 'default'
              AND DATE(hd.closedate) >= ? AND DATE(hd.closedate) <= ?
            THEN hd.amount
            ELSE 0
          END), 0) as revenue
        FROM hub_contacts hc
        LEFT JOIN hub_contact_deal_associations a ON hc.hubspot_id = a.contact_hubspot_id
        LEFT JOIN hub_deals hd ON a.deal_hubspot_id = hd.hubspot_deal_id
        WHERE hc.hs_analytics_source = 'PAID_SEARCH'
          AND hc.hs_analytics_source_data_1 != '{campaign}'
          AND hc.hs_analytics_source_data_1 IS NOT NULL
          AND hc.hs_analytics_source_data_1 != ''
          AND (hc.hubspot_owner_id != 10017927 OR hc.hubspot_owner_id IS NULL OR hc.hubspot_owner_id = '')
          AND hc.territory != 'Unsupported Territory'

        UNION ALL

        SELECT
          'Fixed Template (Custom Field)' as attribution_type,
          COUNT(DISTINCT hc.hubspot_id) as contact_count,
          COUNT(DISTINCT CASE
            WHEN hd.hubspot_deal_id IS NOT NULL
              AND hd.pipeline = 'default'
              AND DATE(hd.closedate) >= ? AND DATE(hd.closedate) <= ?
            THEN hd.hubspot_deal_id
          END) as deal_count,
          COALESCE(SUM(CASE
            WHEN hd.dealstage = 'closedwon'
              AND hd.pipeline = 'default'
              AND DATE(hd.closedate) >= ? AND DATE(hd.closedate) <= ?
            THEN hd.amount
            ELSE 0
          END), 0) as revenue
        FROM hub_contacts hc
        LEFT JOIN hub_contact_deal_associations a ON hc.hubspot_id = a.contact_hubspot_id
        LEFT JOIN hub_deals hd ON a.deal_hubspot_id = hd.hubspot_deal_id
        WHERE hc.hs_analytics_source = 'PAID_SEARCH'
          AND (hc.hs_analytics_source_data_1 = '{campaign}' OR hc.hs_analytics_source_data_1 IS NULL OR hc.hs_analytics_source_data_1 = '')
          AND hc.google_ads_campaign IS NOT NULL
          AND hc.google_ads_campaign != ''
          AND (hc.hubspot_owner_id != 10017927 OR hc.hubspot_owner_id IS NULL OR hc.hubspot_owner_id = '')
          AND hc.territory != 'Unsupported Territory'

        UNION ALL

        SELECT
          'Fixed Google Business (gb)' as attribution_type,
          COUNT(DISTINCT hc.hubspot_id) as contact_count,
          COUNT(DISTINCT CASE
            WHEN hd.hubspot_deal_id IS NOT NULL
              AND hd.pipeline = 'default'
              AND DATE(hd.closedate) >= ? AND DATE(hd.closedate) <= ?
            THEN hd.hubspot_deal_id
          END) as deal_count,
          COALESCE(SUM(CASE
            WHEN hd.dealstage = 'closedwon'
              AND hd.pipeline = 'default'
              AND DATE(hd.closedate) >= ? AND DATE(hd.closedate) <= ?
            THEN hd.amount
            ELSE 0
          END), 0) as revenue
        FROM hub_contacts hc
        LEFT JOIN hub_contact_deal_associations a ON hc.hubspot_id = a.contact_hubspot_id
        LEFT JOIN hub_deals hd ON a.deal_hubspot_id = hd.hubspot_deal_id
        WHERE hc.hs_analytics_source = 'Other Campaigns'
          AND hc.hs_analytics_source_data_1 = 'gb'
          AND hc.gclid IS NOT NULL
          AND hc.gclid != ''
          AND (hc.hubspot_owner_id != 10017927 OR hc.hubspot_owner_id IS NULL OR hc.hubspot_owner_id = '')
          AND hc.territory != 'Unsupported Territory'
      `, [startDateStr, endDateStr, startDateStr, endDateStr, startDateStr, endDateStr, startDateStr, endDateStr, startDateStr, endDateStr, startDateStr, endDateStr]);
      
      console.log(`🔧 Attribution fixes breakdown:`);
      attributionBreakdown.forEach(row => {
        console.log(`   ${row.attribution_type}: ${row.contact_count} contacts, €${parseFloat(row.revenue).toLocaleString()}`);
      });
      
      // STEP 3: Get campaign spend data
      const [campaignSpendResults] = await connection.execute(`
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
      
      console.log(`📊 Found ${campaignSpendResults.length} campaigns with spend`);
      
      // STEP 4: Get enhanced attribution data per campaign
      const campaignAttributionMap = new Map();
      
      for (const campaign of campaignSpendResults) {
        // Enhanced campaign attribution query - with burn count
        const [attributionResults] = await connection.execute(`
          SELECT
            COUNT(DISTINCT hc.hubspot_id) as attributed_contacts,
            COUNT(DISTINCT CASE
              WHEN hd.hubspot_deal_id IS NOT NULL
                AND hd.pipeline = 'default'
                AND DATE(hd.closedate) >= ? AND DATE(hd.closedate) <= ?
              THEN hd.hubspot_deal_id
            END) as total_deals,
            COUNT(DISTINCT CASE
              WHEN hd.dealstage = 'closedwon'
                AND hd.pipeline = 'default'
                AND DATE(hd.closedate) >= ? AND DATE(hd.closedate) <= ?
              THEN hd.hubspot_deal_id
            END) as won_deals,
            COALESCE(SUM(CASE
              WHEN hd.dealstage = 'closedwon'
                AND hd.amount IS NOT NULL
                AND hd.pipeline = 'default'
                AND DATE(hd.closedate) >= ? AND DATE(hd.closedate) <= ?
              THEN CAST(hd.amount as DECIMAL(15,2))
              ELSE 0
            END), 0) as campaign_revenue
          FROM hub_contacts hc
          LEFT JOIN hub_contact_deal_associations a ON hc.hubspot_id = a.contact_hubspot_id
          LEFT JOIN hub_deals hd ON a.deal_hubspot_id = hd.hubspot_deal_id
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
        `, [
          startDateStr, endDateStr,
          startDateStr, endDateStr,
          startDateStr, endDateStr,
          campaign.campaign_name,
          campaign.campaign_name
        ]);

        // Get burned contacts for this campaign
        const [burnResults] = await connection.execute(`
          SELECT
            COUNT(DISTINCT hc.hubspot_id) as burned_contacts
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
            AND hc.territory = 'Unsupported Territory'
        `, [
          campaign.campaign_name,
          campaign.campaign_name
        ]);
        
        campaignAttributionMap.set(campaign.google_campaign_id, {
          attributed_contacts: parseInt(attributionResults[0].attributed_contacts) || 0,
          total_deals: parseInt(attributionResults[0].total_deals) || 0,
          won_deals: parseInt(attributionResults[0].won_deals) || 0,
          campaign_revenue: parseFloat(attributionResults[0].campaign_revenue) || 0,
          burned_contacts: parseInt(burnResults[0].burned_contacts) || 0
        });
      }
      
      // STEP 5: Process campaigns with enhanced metrics
      const campaigns = campaignSpendResults.map(campaign => {
        const spend = parseFloat(campaign.total_spend) || 0;
        const attribution = campaignAttributionMap.get(campaign.google_campaign_id) || {
          attributed_contacts: 0,
          total_deals: 0,
          won_deals: 0,
          campaign_revenue: 0,
          burned_contacts: 0
        };

        const totalContacts = attribution.attributed_contacts + attribution.burned_contacts;
        const burnRate = totalContacts > 0 ? parseFloat(((attribution.burned_contacts / totalContacts) * 100).toFixed(2)) : 0;

        return {
          google_campaign_id: campaign.google_campaign_id,
          campaign_name: campaign.campaign_name || 'Unknown Campaign',
          status: parseInt(campaign.status),
          campaign_type_name: campaign.campaign_type_name || 'Unknown',
          total_spend: spend,
          total_contacts: attribution.attributed_contacts,
          burned_contacts: attribution.burned_contacts,
          burn_rate: burnRate,
          total_deals: attribution.total_deals,
          won_deals: attribution.won_deals,
          lost_deals: attribution.total_deals - attribution.won_deals,
          total_revenue: attribution.campaign_revenue,
          true_roas: spend > 0 ? parseFloat((attribution.campaign_revenue / spend).toFixed(4)) : 0,
          win_rate: attribution.total_deals > 0 ? parseFloat(((attribution.won_deals / attribution.total_deals) * 100).toFixed(2)) : 0,
          attribution_issue: spend > 100 && attribution.attributed_contacts === 0
        };
      });
      
      // STEP 6: Calculate portfolio summary
      const totalSpend = campaigns.reduce((sum, c) => sum + c.total_spend, 0);
      const attributedRevenue = campaigns.reduce((sum, c) => sum + c.total_revenue, 0);
      const unattributedRevenue = Math.max(0, totalPortfolioRevenue - attributedRevenue);
      
      const portfolio = {
        total_campaigns: campaigns.length,
        total_spend: totalSpend,
        total_contacts: campaigns.reduce((sum, c) => sum + c.total_contacts, 0),
        total_burned: campaigns.reduce((sum, c) => sum + (c.burned_contacts || 0), 0),
        total_deals: campaigns.reduce((sum, c) => sum + c.total_deals, 0),
        total_won_deals: campaigns.reduce((sum, c) => sum + c.won_deals, 0),
        total_lost_deals: campaigns.reduce((sum, c) => sum + c.lost_deals, 0),
        total_revenue: totalPortfolioRevenue,
        attributed_revenue: attributedRevenue,
        unattributed_revenue: unattributedRevenue,
        portfolio_roas: totalSpend > 0 ? totalPortfolioRevenue / totalSpend : 0,
        overall_contact_rate: totalSpend > 0 ? (totalAttributedContacts / totalSpend) * 100 : 0,
        overall_win_rate: campaigns.reduce((sum, c) => sum + c.total_deals, 0) > 0 ?
          (campaigns.reduce((sum, c) => sum + c.won_deals, 0) / campaigns.reduce((sum, c) => sum + c.total_deals, 0)) * 100 : 0
      };
      
      // Performance distribution
      const excellentCampaigns = campaigns.filter(c => c.true_roas >= 3.0).length;
      const goodCampaigns = campaigns.filter(c => c.true_roas >= 2.0 && c.true_roas < 3.0).length;
      const averageCampaigns = campaigns.filter(c => c.true_roas >= 1.0 && c.true_roas < 2.0).length;
      const poorCampaigns = campaigns.filter(c => c.true_roas > 0 && c.true_roas < 1.0).length;
      const zeroCampaigns = campaigns.filter(c => c.true_roas === 0).length;
      const attributionIssues = campaigns.filter(c => c.attribution_issue).length;
      
      console.log(`📈 Enhanced Performance Distribution:`);
      console.log(`   🟢 Excellent (≥3.0): ${excellentCampaigns} campaigns`);
      console.log(`   🔵 Good (2.0-2.99): ${goodCampaigns} campaigns`);
      console.log(`   🟡 Average (1.0-1.99): ${averageCampaigns} campaigns`);
      console.log(`   🔴 Poor (0.1-0.99): ${poorCampaigns} campaigns`);
      console.log(`   ⚫ Zero Revenue: ${zeroCampaigns} campaigns`);
      console.log(`   ⚠️ Attribution Issues: ${attributionIssues} campaigns`);
      
      const result = {
        success: true,
        campaigns: campaigns,
        summary: portfolio,
        attribution_breakdown: attributionBreakdown,
        performance_distribution: {
          excellent: excellentCampaigns,
          good: goodCampaigns,
          average: averageCampaigns,
          poor: poorCampaigns,
          zero: zeroCampaigns,
          attribution_issues: attributionIssues
        },
        metadata: {
          status_filter: status,
          period: periodDescription,
          start_date: startDateStr,
          end_date: endDateStr,
          analysis_description: 'Cash Basis with Enhanced Attribution Fixes',
          attribution_method: 'enhanced_multi_layered_attribution',
          fixes_applied: [
            'Multi-layered attribution logic',
            'Custom Google Ads Campaign field integration',
            'Google Business (gb) source reclassification',
            'Comprehensive attribution quality reporting'
          ],
          data_sources: {
            spend: 'gads_campaign_metrics.cost_eur',
            attribution: 'Enhanced multi-field matching',
            deals: 'hub_deals (filtered by closedate)',
            revenue: 'hub_deals.amount (closedwon) - Enhanced Attribution'
          }
        },
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Enhanced Campaign Revenue Report Complete:`);
      console.log(`   💰 Portfolio ROAS: ${portfolio.portfolio_roas.toFixed(2)}:1`);
      console.log(`   📊 Total Spend: €${portfolio.total_spend.toLocaleString()}`);
      console.log(`   💎 Total Revenue: €${portfolio.total_revenue.toLocaleString()}`);
      console.log(`   🎯 Campaigns: ${campaigns.length}`);
      console.log(`   🔧 Attribution Fixes: Applied successfully`);
      
      return result;
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Enhanced Campaign Revenue Report failed:', error.message);
    return {
      success: false,
      error: error.message,
      campaigns: [],
      summary: { total_campaigns: 0, total_spend: 0, total_revenue: 0, portfolio_roas: 0 },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getTrueROASCampaigns,
  buildEnhancedAttributionQuery,
  getCampaignAttributionLogic
};