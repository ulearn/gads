/**
 * Campaign Revenue Report ("Cash Basis") Analysis
 * /scripts/analytics/true-roas.js
 * 
 * Provides Cash Basis revenue tracking from Google Ads spend to HubSpot WON deal revenue.
 * Formula: [Cash Received from Paid Search Contact Deals] ÷ [Cash Spent on Ads]
 * 
 * CASH BASIS METHOD:
 * - Campaign Spend: FROM gads_campaign_metrics (cost_eur) during timeframe
 * - Attribution: VIA hub_contacts.hs_analytics_source = 'PAID_SEARCH' (Original Traffic Source)
 * - Revenue: FROM hub_deals WHERE dealstage = 'closedwon' AND closedate in timeframe
 */

const mysql = require('mysql2/promise');

/**
 * Get True ROAS Campaign Attribution Report
 * @param {Function} getDbConnection - Database connection function
 * @param {Object} options - Query options
 * @returns {Object} Campaign ROAS analysis with cash basis revenue
 */
async function getTrueROASCampaigns(getDbConnection, options = {}) {
  try {
    console.log('📊 Starting Campaign Revenue Report (Cash Basis)...');
    
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
      
      // Build deal date filter for Cash Basis (closedate filtering)
      const dealDateFilter = `AND DATE(hd.closedate) >= '${startDateStr}' AND DATE(hd.closedate) <= '${endDateStr}'`;
      const analysisDescription = 'Cash Basis (Deal Close Date)';
      
      console.log(`🎯 Campaign status filter: ${statusFilter}`);
      console.log(`📊 Analysis mode: ${analysisDescription}`);
      console.log(`📅 Deal date filter: ${dealDateFilter}`);
      
      // MAIN CASH BASIS QUERY - Revenue filtered by deal close date
      const [campaignResults] = await connection.execute(`
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
          
          -- ATTRIBUTION: Count contacts attributed to this campaign
          COUNT(DISTINCT hc.hubspot_id) as total_contacts,
          
          -- DEALS: Count deals from attributed contacts
          COUNT(DISTINCT hd.hubspot_deal_id) as total_deals,
          COUNT(DISTINCT CASE WHEN hd.dealstage = 'closedwon' THEN hd.hubspot_deal_id END) as won_deals,
          COUNT(DISTINCT CASE WHEN hd.dealstage = 'closedlost' THEN hd.hubspot_deal_id END) as lost_deals,
          
          -- REVENUE: Sum revenue from WON deals only (using DISTINCT to prevent duplication)
          COALESCE(SUM(DISTINCT CASE 
            WHEN hd.dealstage = 'closedwon' AND hd.amount IS NOT NULL 
            THEN CAST(hd.amount as DECIMAL(15,2)) 
            ELSE 0 
          END), 0) as total_revenue
          
        FROM gads_campaigns c
        
        -- Join contacts from Original Traffic Source = Paid Search
        LEFT JOIN hub_contacts hc ON (
          hc.hs_analytics_source = 'PAID_SEARCH' 
          AND (
            hc.hs_analytics_source_data_1 = c.google_campaign_id 
            OR hc.google_ads_campaign = c.campaign_name
          )
          AND (
            hc.hubspot_owner_id != 10017927 
            OR hc.hubspot_owner_id IS NULL 
            OR hc.hubspot_owner_id = ''
          )
          AND hc.territory != 'Unsupported Territory'
        )
        
        -- Join deals from contacts (filtered by close date for Cash Basis)
        LEFT JOIN hub_contact_deal_associations a ON hc.hubspot_id = a.contact_hubspot_id
        LEFT JOIN hub_deals hd ON a.deal_hubspot_id = hd.hubspot_deal_id 
          AND hd.pipeline = 'default'
          ${dealDateFilter}
        
        WHERE ${statusFilter}
        
        GROUP BY c.google_campaign_id, c.campaign_name, c.status, c.campaign_type_name
        HAVING total_spend > 0 OR total_contacts > 0  -- Only campaigns with activity
        ORDER BY total_spend DESC, total_revenue DESC
      `, [startDateStr, endDateStr]);
      
      console.log(`📊 Found ${campaignResults.length} campaigns with revenue activity`);
      
      // Process campaigns and add attribution issue flags
      const campaigns = campaignResults.map(campaign => {
        const spend = parseFloat(campaign.total_spend) || 0;
        const revenue = parseFloat(campaign.total_revenue) || 0;
        const contacts = parseInt(campaign.total_contacts) || 0;
        const deals = parseInt(campaign.total_deals) || 0;
        const wonDeals = parseInt(campaign.won_deals) || 0;
        
        const processedCampaign = {
          google_campaign_id: campaign.google_campaign_id,
          campaign_name: campaign.campaign_name || 'Unknown Campaign',
          status: parseInt(campaign.status),
          campaign_type_name: campaign.campaign_type_name || 'Unknown',
          total_spend: spend,
          total_contacts: contacts,
          total_deals: deals,
          won_deals: wonDeals,
          lost_deals: parseInt(campaign.lost_deals) || 0,
          total_revenue: revenue,
          // Calculate ROAS
          true_roas: spend > 0 ? parseFloat((revenue / spend).toFixed(4)) : 0,
          // Calculate contact rate (contacts per €100 spend)
          contact_rate: spend > 0 ? parseFloat(((contacts / spend) * 100).toFixed(2)) : 0,
          // Calculate win rate (% of deals that close as WON)
          win_rate: deals > 0 ? parseFloat(((wonDeals / deals) * 100).toFixed(2)) : 0
        };
        
        // Flag potential attribution issues
        // High spend but no contacts = attribution breakdown
        if (processedCampaign.total_spend > 100 && processedCampaign.total_contacts === 0) {
          processedCampaign.attribution_issue = true;
        }
        
        return processedCampaign;
      });
      
      // Calculate portfolio totals
      const portfolio = {
        total_campaigns: campaigns.length,
        total_spend: campaigns.reduce((sum, c) => sum + c.total_spend, 0),
        total_contacts: campaigns.reduce((sum, c) => sum + c.total_contacts, 0),
        total_deals: campaigns.reduce((sum, c) => sum + c.total_deals, 0),
        total_won_deals: campaigns.reduce((sum, c) => sum + c.won_deals, 0),
        total_lost_deals: campaigns.reduce((sum, c) => sum + c.lost_deals, 0),
        total_revenue: campaigns.reduce((sum, c) => sum + c.total_revenue, 0)
      };
      
      // Calculate portfolio ROAS
      portfolio.portfolio_roas = portfolio.total_spend > 0 ? 
        portfolio.total_revenue / portfolio.total_spend : 0;
      
      // Calculate portfolio metrics
      portfolio.overall_contact_rate = portfolio.total_spend > 0 ? 
        (portfolio.total_contacts / portfolio.total_spend) * 100 : 0;
      
      portfolio.overall_win_rate = portfolio.total_deals > 0 ? 
        (portfolio.total_won_deals / portfolio.total_deals) * 100 : 0;
      
      // Identify high performers and problem campaigns
      const excellentCampaigns = campaigns.filter(c => c.true_roas >= 3.0).length;
      const goodCampaigns = campaigns.filter(c => c.true_roas >= 2.0 && c.true_roas < 3.0).length;
      const averageCampaigns = campaigns.filter(c => c.true_roas >= 1.0 && c.true_roas < 2.0).length;
      const poorCampaigns = campaigns.filter(c => c.true_roas > 0 && c.true_roas < 1.0).length;
      const zeroCampaigns = campaigns.filter(c => c.true_roas === 0).length;
      
      const attributionIssues = campaigns.filter(c => c.attribution_issue).length;
      
      console.log(`📈 Campaign Performance Distribution:`);
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
          analysis_description: analysisDescription,
          attribution_method: 'paid_search_cash_basis',
          data_sources: {
            spend: 'gads_campaign_metrics.cost_eur (filtered by date)',
            attribution: 'hub_contacts.hs_analytics_source = PAID_SEARCH',
            deals: 'hub_deals (filtered by closedate)',
            revenue: 'hub_deals.amount (closedwon only)'
          }
        },
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Campaign Revenue Report Complete:`);
      console.log(`   💰 Portfolio ROAS: ${portfolio.portfolio_roas.toFixed(2)}:1`);
      console.log(`   📊 Total Spend: €${portfolio.total_spend.toLocaleString()}`);
      console.log(`   💎 Total Revenue: €${portfolio.total_revenue.toLocaleString()}`);
      console.log(`   🎯 Active Campaigns: ${campaigns.length}`);
      
      return result;
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Campaign Revenue Report failed:', error.message);
    return {
      success: false,
      error: error.message,
      campaigns: [],
      summary: {
        total_campaigns: 0,
        total_spend: 0,
        total_revenue: 0,
        portfolio_roas: 0
      },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get campaign attribution quality report
 * @param {Function} getDbConnection - Database connection function
 * @param {Object} options - Query options
 * @returns {Object} Attribution quality analysis
 */
async function getAttributionQualityReport(getDbConnection, options = {}) {
  try {
    console.log('🔍 Starting Attribution Quality Analysis...');
    
    const { days = 30 } = options;
    const connection = await getDbConnection();
    
    try {
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1));
      startDate.setHours(0, 0, 0, 0);
      
      const startDateStr = startDate.toISOString().slice(0, 10);
      const endDateStr = endDate.toISOString().slice(0, 10);
      
      // Check attribution gaps
      const [attributionGaps] = await connection.execute(`
        SELECT 
          'Missing Campaign Attribution' as issue_type,
          COUNT(*) as affected_contacts,
          SUM(CASE WHEN num_associated_deals > 0 THEN 1 ELSE 0 END) as deals_affected
        FROM hub_contacts
        WHERE hs_analytics_source = 'PAID_SEARCH'
          AND (
            hubspot_owner_id != 10017927 
            OR hubspot_owner_id IS NULL 
            OR hubspot_owner_id = ''
          )
          AND territory != 'Unsupported Territory'
          AND DATE(createdate) >= ? AND DATE(createdate) <= ?
          AND (
            hs_analytics_source_data_1 IS NULL 
            OR hs_analytics_source_data_1 = '' 
            OR google_ads_campaign IS NULL 
            OR google_ads_campaign = ''
          )
        
        UNION ALL
        
        SELECT 
          'Contacts Without Deals' as issue_type,
          COUNT(*) as affected_contacts,
          0 as deals_affected
        FROM hub_contacts
        WHERE hs_analytics_source = 'PAID_SEARCH'
          AND (
            hubspot_owner_id != 10017927 
            OR hubspot_owner_id IS NULL 
            OR hubspot_owner_id = ''
          )
          AND territory != 'Unsupported Territory'
          AND DATE(createdate) >= ? AND DATE(createdate) <= ?
          AND num_associated_deals = 0
      `, [startDateStr, endDateStr, startDateStr, endDateStr]);
      
      return {
        success: true,
        attribution_gaps: attributionGaps,
        period: `${startDateStr} to ${endDateStr}`,
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Attribution quality analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get campaign spend without attribution (for identifying data sync issues)
 * @param {Function} getDbConnection - Database connection function  
 * @param {Object} options - Query options
 * @returns {Object} Campaigns with spend but no attributed contacts
 */
async function getOrphanedSpendAnalysis(getDbConnection, options = {}) {
  try {
    console.log('👻 Starting Orphaned Spend Analysis...');
    
    const { days = 30 } = options;
    const connection = await getDbConnection();
    
    try {
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1));  
      startDate.setHours(0, 0, 0, 0);
      
      const startDateStr = startDate.toISOString().slice(0, 10);
      const endDateStr = endDate.toISOString().slice(0, 10);
      
      // Find campaigns with spend but zero attributed contacts
      const [orphanedSpend] = await connection.execute(`
        SELECT 
          c.google_campaign_id,
          c.campaign_name,
          c.status,
          SUM(m.cost_eur) as total_spend,
          COUNT(DISTINCT hc.hubspot_id) as attributed_contacts
        FROM gads_campaigns c
        INNER JOIN gads_campaign_metrics m ON c.google_campaign_id = m.google_campaign_id
          AND m.date >= ? AND m.date <= ?
        LEFT JOIN hub_contacts hc ON (
          hc.hs_analytics_source = 'PAID_SEARCH' 
          AND (
            hc.hs_analytics_source_data_1 = c.google_campaign_id 
            OR hc.google_ads_campaign = c.campaign_name
          )
          AND (
            hc.hubspot_owner_id != 10017927 
            OR hc.hubspot_owner_id IS NULL 
            OR hc.hubspot_owner_id = ''
          )
        )
        WHERE c.status IN (2, 3)
          AND m.cost_eur > 0
        GROUP BY c.google_campaign_id, c.campaign_name, c.status
        HAVING attributed_contacts = 0 AND total_spend > 50  -- €50+ spend threshold
        ORDER BY total_spend DESC
      `, [startDateStr, endDateStr]);
      
      const totalOrphanedSpend = orphanedSpend.reduce((sum, row) => sum + parseFloat(row.total_spend), 0);
      
      return {
        success: true,
        orphaned_campaigns: orphanedSpend.map(row => ({
          google_campaign_id: row.google_campaign_id,
          campaign_name: row.campaign_name,
          status: row.status,
          total_spend: parseFloat(row.total_spend),
          attributed_contacts: parseInt(row.attributed_contacts)
        })),
        total_orphaned_spend: totalOrphanedSpend,
        period: `${startDateStr} to ${endDateStr}`,
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Orphaned spend analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getTrueROASCampaigns,
  getAttributionQualityReport,
  getOrphanedSpendAnalysis
};