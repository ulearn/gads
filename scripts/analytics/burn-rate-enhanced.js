/**
 * Enhanced Burn Rate Analysis - Direct MySQL Queries (NO getTerritoryAnalysis)
 * /scripts/analytics/burn-rate-enhanced.js
 * 
 * BUSINESS LOGIC ONLY - No routing, pure data processing
 * SIMPLIFIED: Reads territory data directly from HubSpot-populated MySQL fields
 * NO re-analysis of territories - uses HubSpot's territory classifications
 */

const mysql = require('mysql2/promise');

/**
 * Get enhanced burn rate data with campaign filtering - DIRECT MYSQL APPROACH
 */
async function getEnhancedBurnRate(getDbConnection, options = {}) {
  try {
    const {
      days = 30,
      campaign = 'all',
      mode = 'pipeline'
    } = options;

    console.log(`🔥 Getting enhanced burn rate data (DIRECT): ${days} days, campaign: ${campaign}`);

    const connection = await getDbConnection();
    
    try {
      // Calculate date range
      const dateRange = calculateDateRange(days);
      console.log(`📅 Date range: ${dateRange.start} to ${dateRange.end}`);
      
      // Build campaign filter condition
      const campaignCondition = buildCampaignFilter(campaign);
      
      // Get all data in parallel using direct MySQL queries
      const [
        summaryData,
        timeseriesData,
        campaignsData,
        territoriesData,
        dealsData
      ] = await Promise.all([
        getBurnRateSummary(connection, dateRange, campaignCondition),
        getBurnRateTimeseries(connection, dateRange, campaignCondition),
        getCampaignBreakdown(connection, dateRange),
        getUnsupportedTerritories(connection, dateRange, campaignCondition),
        getSQLDealsData(connection, dateRange, campaignCondition)
      ]);
      
      // Calculate MQL validation pipeline
      const mqlValidation = {
        totalMQLs: summaryData.totalContacts,
        territoryChecked: summaryData.totalContacts, // All contacts get territory checked by HubSpot
        supportedTerritory: summaryData.supportedContacts,
        sqlsCreated: dealsData.sqlDeals
      };
      
      return {
        success: true,
        summary: {
          ...summaryData,
          sqlDeals: dealsData.sqlDeals
        },
        mqlValidation: mqlValidation,
        chartData: timeseriesData,
        campaigns: campaignsData,
        unsupportedTerritories: territoriesData,
        metadata: {
          dateRange: dateRange,
          campaignFilter: campaign,
          analysisMode: mode,
          dataSource: 'Direct MySQL - HubSpot Territory Classifications',
          methodology: 'Reading HubSpot-populated territory field directly'
        },
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Enhanced burn rate analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get burn rate data for existing endpoint compatibility - DIRECT MYSQL
 */
async function getBurnRateData(getDbConnection, days = 30) {
  try {
    console.log(`🔥 Getting burn rate data (DIRECT) for ${days} days...`);
    
    const connection = await getDbConnection();
    
    try {
      // Calculate date range
      const dateRange = calculateDateRange(days);
      
      // DIRECT MYSQL: Get burn rate data (no territory analysis - HubSpot already did it!)
      const [burnRateResults] = await connection.execute(`
        SELECT 
          COUNT(*) as total_contacts,
          COUNT(CASE WHEN territory = 'Unsupported Territory' THEN 1 END) as unsupported_contacts,
          COUNT(CASE WHEN territory != 'Unsupported Territory' OR territory IS NULL THEN 1 END) as supported_contacts,
          COUNT(CASE WHEN num_associated_deals > 0 THEN 1 END) as contacts_with_deals,
          ROUND(
            (COUNT(CASE WHEN territory = 'Unsupported Territory' THEN 1 END) / COUNT(*)) * 100, 
            2
          ) as burn_rate,
          ROUND(
            (COUNT(CASE WHEN num_associated_deals > 0 THEN 1 END) / COUNT(*)) * 100, 
            2
          ) as validation_rate
        FROM hub_contacts 
        WHERE hs_analytics_source = 'PAID_SEARCH'
          AND (hubspot_owner_id != 10017927 OR hubspot_owner_id IS NULL OR hubspot_owner_id = '')
          AND DATE(createdate) >= ? 
          AND DATE(createdate) <= ?
      `, [dateRange.start, dateRange.end]);
      
      const summary = burnRateResults[0] || {};
      
      // Get time series data for chart
      const [timeseriesResults] = await connection.execute(`
        SELECT 
          DATE(createdate) as date,
          COUNT(*) as total_contacts,
          COUNT(CASE WHEN territory = 'Unsupported Territory' THEN 1 END) as unsupported_contacts,
          ROUND(
            (COUNT(CASE WHEN territory = 'Unsupported Territory' THEN 1 END) / COUNT(*)) * 100, 
            2
          ) as burn_rate_percentage
        FROM hub_contacts 
        WHERE hs_analytics_source = 'PAID_SEARCH'
          AND (hubspot_owner_id != 10017927 OR hubspot_owner_id IS NULL OR hubspot_owner_id = '')
          AND DATE(createdate) >= ? 
          AND DATE(createdate) <= ?
        GROUP BY DATE(createdate)
        ORDER BY date
      `, [dateRange.start, dateRange.end]);
      
      // Get SQL deals count
      const [dealsResults] = await connection.execute(`
        SELECT COUNT(DISTINCT d.hubspot_deal_id) as sql_deals_count
        FROM hub_contact_deal_associations a
        JOIN hub_contacts c ON a.contact_hubspot_id = c.hubspot_id
        JOIN hub_deals d ON a.deal_hubspot_id = d.hubspot_deal_id
        WHERE c.hubspot_owner_id != 10017927
          AND c.hs_analytics_source = 'PAID_SEARCH'
          AND c.territory != 'Unsupported Territory'
          AND c.num_associated_deals > 0
          AND DATE(c.createdate) >= ?
          AND DATE(c.createdate) <= ?
          AND d.pipeline = 'default'
      `, [dateRange.start, dateRange.end]);
      
      const sqlDeals = dealsResults[0]?.sql_deals_count || 0;
      
      console.log(`✅ DIRECT burn rate data: ${summary.total_contacts} contacts, ${summary.burn_rate}% burn rate`);
      
      return {
        success: true,
        summary: {
          total_contacts: parseInt(summary.total_contacts) || 0,
          supported_contacts: parseInt(summary.supported_contacts) || 0,
          unsupported_contacts: parseInt(summary.unsupported_contacts) || 0,
          wasted_contacts: parseInt(summary.unsupported_contacts) || 0,
          burn_rate: parseFloat(summary.burn_rate) || 0,
          validation_rate: parseFloat(summary.validation_rate) || 0,
          contacts_with_deals: parseInt(summary.contacts_with_deals) || 0,
          sql_deals: parseInt(sqlDeals) || 0,
          estimated_waste: (parseInt(summary.unsupported_contacts) || 0) * 25
        },
        timeseries: timeseriesResults.map(row => ({
          date: row.date,
          total_contacts: parseInt(row.total_contacts) || 0,
          unsupported_contacts: parseInt(row.unsupported_contacts) || 0,
          burn_rate_percentage: parseFloat(row.burn_rate_percentage) || 0
        })),
        period: `Last ${days} days`,
        methodology: 'DIRECT MySQL - Reading HubSpot territory classifications',
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ DIRECT burn rate data failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get pipeline data for campaign dropdown - DIRECT MYSQL
 */
async function getPipelineData(getDbConnection, days = 30, campaign = 'all') {
  try {
    console.log(`📊 Getting pipeline data (DIRECT) for ${days} days, campaign: ${campaign}...`);
    
    const connection = await getDbConnection();
    
    try {
      // Calculate date range
      const dateRange = calculateDateRange(days);
      
      // DIRECT MYSQL: Get campaign names from HubSpot contacts (no complex analysis!)
      const [campaignResults] = await connection.execute(`
        SELECT DISTINCT 
          COALESCE(google_campaign_id, 'Unknown') as id,
          COALESCE(google_campaign_name, 'Unknown Campaign') as name,
          COUNT(*) as contact_count
        FROM hub_contacts 
        WHERE hs_analytics_source = 'PAID_SEARCH'
          AND (hubspot_owner_id != 10017927 OR hubspot_owner_id IS NULL OR hubspot_owner_id = '')
          AND DATE(createdate) >= ? 
          AND DATE(createdate) <= ?
          AND (google_campaign_name IS NOT NULL OR google_campaign_id IS NOT NULL)
        GROUP BY google_campaign_id, google_campaign_name
        HAVING contact_count > 0
        ORDER BY contact_count DESC
        LIMIT 20
      `, [dateRange.start, dateRange.end]);
      
      console.log(`🎯 Found ${campaignResults.length} campaigns with data (DIRECT)`);
      
      // Get basic summary data
      const [summaryResults] = await connection.execute(`
        SELECT 
          COUNT(*) as total_contacts,
          COUNT(CASE WHEN num_associated_deals > 0 THEN 1 END) as contacts_with_deals,
          COUNT(CASE WHEN territory = 'Unsupported Territory' THEN 1 END) as unsupported_contacts
        FROM hub_contacts 
        WHERE hs_analytics_source = 'PAID_SEARCH'
          AND (hubspot_owner_id != 10017927 OR hubspot_owner_id IS NULL OR hubspot_owner_id = '')
          AND DATE(createdate) >= ? 
          AND DATE(createdate) <= ?
      `, [dateRange.start, dateRange.end]);
      
      const summary = summaryResults[0] || {};
      
      // Get deals count
      const [dealsResults] = await connection.execute(`
        SELECT 
          COUNT(*) as total_deals,
          COUNT(CASE WHEN dealstage = 'closedwon' THEN 1 END) as won_deals,
          COUNT(CASE WHEN dealstage = 'closedlost' THEN 1 END) as lost_deals
        FROM hub_contact_deal_associations a
        JOIN hub_contacts c ON a.contact_hubspot_id = c.hubspot_id
        JOIN hub_deals d ON a.deal_hubspot_id = d.hubspot_deal_id
        WHERE c.hubspot_owner_id != 10017927
          AND c.hs_analytics_source = 'PAID_SEARCH'
          AND c.num_associated_deals > 0
          AND DATE(c.createdate) >= ?
          AND DATE(c.createdate) <= ?
          AND d.pipeline = 'default'
      `, [dateRange.start, dateRange.end]);
      
      const deals = dealsResults[0] || {};
      const totalDeals = parseInt(deals.total_deals) || 0;
      const wonDeals = parseInt(deals.won_deals) || 0;
      const lostDeals = parseInt(deals.lost_deals) || 0;
      const activeDeals = totalDeals - wonDeals - lostDeals;
      
      return {
        success: true,
        summary: {
          campaign: campaign === 'all' ? 'All Campaigns' : campaign,
          totalContacts: parseInt(summary.total_contacts) || 0,
          contactsWithDeals: parseInt(summary.contacts_with_deals) || 0,
          period: `Last ${days} days`,
          total_deals: totalDeals,
          active_deals: activeDeals,
          won_deals: wonDeals,
          lost_deals: lostDeals
        },
        campaigns: campaignResults.map(c => ({
          id: c.id,
          name: c.name,
          contact_count: parseInt(c.contact_count) || 0
        })),
        // Mock stage data for compatibility with Pipeline Analysis
        mqlStages: {
          impressions: { count: 0 },
          clicks: { count: 0 },
          ctaComplete: { count: parseInt(summary.total_contacts) || 0 },
          territoryValidation: { 
            accepted: Math.max(0, (parseInt(summary.total_contacts) || 0) - (parseInt(summary.unsupported_contacts) || 0)),
            rejected: parseInt(summary.unsupported_contacts) || 0
          }
        },
        sqlStages: {
          inbox: { count: 0, percentage: '0%', friendlyName: 'INBOX' },
          sequenced: { count: activeDeals, percentage: totalDeals > 0 ? ((activeDeals / totalDeals) * 100).toFixed(1) : 0, friendlyName: 'ACTIVE' },
          won: { count: wonDeals, percentage: totalDeals > 0 ? ((wonDeals / totalDeals) * 100).toFixed(1) : 0, friendlyName: 'WON' },
          lost: { count: lostDeals, percentage: totalDeals > 0 ? ((lostDeals / totalDeals) * 100).toFixed(1) : 0, friendlyName: 'LOST' }
        },
        methodology: 'DIRECT MySQL - No territory re-analysis',
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ DIRECT pipeline data failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Calculate date range
 */
function calculateDateRange(days) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  
  return {
    start: start.toISOString().slice(0, 10), // YYYY-MM-DD
    end: end.toISOString().slice(0, 10),     // YYYY-MM-DD
    totalDays: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
  };
}

/**
 * Build campaign filter condition for SQL queries
 */
function buildCampaignFilter(campaign) {
  if (!campaign || campaign === 'all') {
    return ''; // No filter
  }
  
  // Return SQL condition for campaign filtering
  return `AND (google_campaign_name = '${campaign.replace(/'/g, "''")}' OR google_campaign_id = '${campaign}')`;
}

/**
 * Get burn rate summary - DIRECT MYSQL, NO TERRITORY ANALYSIS
 */
async function getBurnRateSummary(connection, dateRange, campaignCondition) {
  try {
    console.log(`📊 Getting burn rate summary (DIRECT)...`);
    
    const [summaryResults] = await connection.execute(`
      SELECT 
        COUNT(*) as total_contacts,
        COUNT(CASE WHEN territory = 'Unsupported Territory' THEN 1 END) as unsupported_contacts,
        COUNT(CASE WHEN territory != 'Unsupported Territory' OR territory IS NULL THEN 1 END) as supported_contacts,
        COUNT(CASE WHEN num_associated_deals > 0 THEN 1 END) as contacts_with_deals,
        ROUND(
          (COUNT(CASE WHEN territory = 'Unsupported Territory' THEN 1 END) / COUNT(*)) * 100, 
          2
        ) as burn_rate_percentage,
        ROUND(
          (COUNT(CASE WHEN num_associated_deals > 0 THEN 1 END) / COUNT(*)) * 100, 
          2
        ) as validation_rate_percentage
      FROM hub_contacts 
      WHERE hs_analytics_source = 'PAID_SEARCH'
        AND (hubspot_owner_id != 10017927 OR hubspot_owner_id IS NULL OR hubspot_owner_id = '')
        AND DATE(createdate) >= ? 
        AND DATE(createdate) <= ?
        ${campaignCondition}
    `, [dateRange.start, dateRange.end]);
    
    const summary = summaryResults[0] || {};
    
    console.log(`✅ Summary (DIRECT): ${summary.total_contacts} contacts, ${summary.burn_rate_percentage}% burn rate`);
    
    return {
      totalContacts: parseInt(summary.total_contacts) || 0,
      supportedContacts: parseInt(summary.supported_contacts) || 0,
      unsupportedContacts: parseInt(summary.unsupported_contacts) || 0,
      wastedContacts: parseInt(summary.unsupported_contacts) || 0,
      burnRate: parseFloat(summary.burn_rate_percentage) || 0,
      validationRate: parseFloat(summary.validation_rate_percentage) || 0,
      estimatedWaste: (parseInt(summary.unsupported_contacts) || 0) * 25 // €25 per wasted contact
    };
    
  } catch (error) {
    console.error('❌ Burn rate summary failed:', error.message);
    return {
      totalContacts: 0,
      supportedContacts: 0,
      unsupportedContacts: 0,
      wastedContacts: 0,
      burnRate: 0,
      validationRate: 0,
      estimatedWaste: 0
    };
  }
}

/**
 * Get SQL deals data - DIRECT MYSQL
 */
async function getSQLDealsData(connection, dateRange, campaignCondition) {
  try {
    console.log(`📋 Getting SQL deals data (DIRECT)...`);
    
    // Build campaign condition for deals query (needs to join with contacts)
    const dealsFilter = campaignCondition ? 
      campaignCondition.replace(/^AND\s+/, 'AND c.') : '';
    
    const [dealsResults] = await connection.execute(`
      SELECT COUNT(DISTINCT d.hubspot_deal_id) as sql_deals_count
      FROM hub_contact_deal_associations a
      JOIN hub_contacts c ON a.contact_hubspot_id = c.hubspot_id
      JOIN hub_deals d ON a.deal_hubspot_id = d.hubspot_deal_id
      WHERE c.hubspot_owner_id != 10017927
        AND c.hs_analytics_source = 'PAID_SEARCH'
        AND c.territory != 'Unsupported Territory'
        AND c.num_associated_deals > 0
        AND DATE(c.createdate) >= ?
        AND DATE(c.createdate) <= ?
        AND d.pipeline = 'default'
        ${dealsFilter}
    `, [dateRange.start, dateRange.end]);
    
    const sqlDeals = dealsResults[0]?.sql_deals_count || 0;
    
    console.log(`✅ SQL deals (DIRECT): ${sqlDeals} deals`);
    
    return {
      sqlDeals: parseInt(sqlDeals) || 0
    };
    
  } catch (error) {
    console.error('❌ SQL deals data failed:', error.message);
    return {
      sqlDeals: 0
    };
  }
}

/**
 * Get burn rate time series - DIRECT MYSQL
 */
async function getBurnRateTimeseries(connection, dateRange, campaignCondition) {
  try {
    console.log(`📈 Getting burn rate timeseries (DIRECT)...`);
    
    const [timeseriesResults] = await connection.execute(`
      SELECT 
        DATE(createdate) as period_date,
        COUNT(*) as total_contacts,
        COUNT(CASE WHEN territory = 'Unsupported Territory' THEN 1 END) as unsupported_contacts,
        ROUND(
          (COUNT(CASE WHEN territory = 'Unsupported Territory' THEN 1 END) / COUNT(*)) * 100, 
          2
        ) as burn_rate_percentage
      FROM hub_contacts 
      WHERE hs_analytics_source = 'PAID_SEARCH'
        AND (hubspot_owner_id != 10017927 OR hubspot_owner_id IS NULL OR hubspot_owner_id = '')
        AND DATE(createdate) >= ? 
        AND DATE(createdate) <= ?
        ${campaignCondition}
      GROUP BY DATE(createdate)
      ORDER BY period_date
    `, [dateRange.start, dateRange.end]);
    
    console.log(`✅ Timeseries (DIRECT): ${timeseriesResults.length} data points`);
    
    return timeseriesResults.map(row => ({
      date: row.period_date,
      totalContacts: parseInt(row.total_contacts) || 0,
      unsupportedContacts: parseInt(row.unsupported_contacts) || 0,
      burnRate: parseFloat(row.burn_rate_percentage) || 0
    }));
    
  } catch (error) {
    console.error('❌ Burn rate timeseries failed:', error.message);
    return [];
  }
}

/**
 * Get campaign breakdown - DIRECT MYSQL
 */
async function getCampaignBreakdown(connection, dateRange) {
  try {
    console.log(`🎯 Getting campaign breakdown (DIRECT)...`);
    
    const [campaignResults] = await connection.execute(`
      SELECT 
        COALESCE(google_campaign_id, 'Unknown') as campaign_id,
        COALESCE(google_campaign_name, 'Unknown Campaign') as campaign_name,
        COALESCE(adgroup, 'Unknown AdGroup') as adgroup,
        COUNT(*) as total_mqls,
        COUNT(CASE WHEN num_associated_deals > 0 THEN 1 END) as sqls_created,
        COUNT(CASE WHEN territory = 'Unsupported Territory' THEN 1 END) as unsupported_mqls,
        ROUND(
          (COUNT(CASE WHEN num_associated_deals > 0 THEN 1 END) / COUNT(*)) * 100, 
          2
        ) as mql_sql_rate
      FROM hub_contacts 
      WHERE hs_analytics_source = 'PAID_SEARCH'
        AND (hubspot_owner_id != 10017927 OR hubspot_owner_id IS NULL OR hubspot_owner_id = '')
        AND DATE(createdate) >= ? 
        AND DATE(createdate) <= ?
        AND (google_campaign_name IS NOT NULL OR google_campaign_id IS NOT NULL)
      GROUP BY google_campaign_id, google_campaign_name, adgroup
      HAVING total_mqls > 0
      ORDER BY total_mqls DESC
      LIMIT 20
    `, [dateRange.start, dateRange.end]);
    
    console.log(`✅ Campaign breakdown (DIRECT): ${campaignResults.length} campaigns`);
    
    // Get deal data for each campaign
    const campaignsWithDeals = await Promise.all(
      campaignResults.map(async (campaign) => {
        try {
          const [dealResults] = await connection.execute(`
            SELECT 
              COUNT(CASE WHEN d.dealstage = 'closedwon' THEN 1 END) as won_deals,
              SUM(CASE WHEN d.dealstage = 'closedwon' AND d.amount IS NOT NULL 
                  THEN CAST(d.amount as DECIMAL(15,2)) ELSE 0 END) as total_revenue
            FROM hub_contact_deal_associations a
            JOIN hub_contacts c ON a.contact_hubspot_id = c.hubspot_id
            JOIN hub_deals d ON a.deal_hubspot_id = d.hubspot_deal_id
            WHERE c.google_campaign_id = ?
              AND c.hubspot_owner_id != 10017927
              AND c.hs_analytics_source = 'PAID_SEARCH'
              AND c.territory != 'Unsupported Territory'
              AND DATE(c.createdate) >= ?
              AND DATE(c.createdate) <= ?
              AND d.pipeline = 'default'
          `, [campaign.campaign_id, dateRange.start, dateRange.end]);
          
          const deals = dealResults[0] || {};
          
          return {
            id: campaign.campaign_id,
            name: campaign.campaign_name,
            adgroup: campaign.adgroup,
            totalMQLs: parseInt(campaign.total_mqls) || 0,
            sqlsCreated: parseInt(campaign.sqls_created) || 0,
            wonDeals: parseInt(deals.won_deals) || 0,
            revenue: parseFloat(deals.total_revenue) || 0,
            mqlSqlRate: parseFloat(campaign.mql_sql_rate) || 0,
            unsupportedMQLs: parseInt(campaign.unsupported_mqls) || 0,
            estimatedWaste: (parseInt(campaign.unsupported_mqls) || 0) * 25
          };
        } catch (error) {
          console.error(`❌ Deal data failed for campaign ${campaign.campaign_id}:`, error.message);
          return {
            id: campaign.campaign_id,
            name: campaign.campaign_name,
            adgroup: campaign.adgroup,
            totalMQLs: parseInt(campaign.total_mqls) || 0,
            sqlsCreated: parseInt(campaign.sqls_created) || 0,
            wonDeals: 0,
            revenue: 0,
            mqlSqlRate: parseFloat(campaign.mql_sql_rate) || 0,
            unsupportedMQLs: parseInt(campaign.unsupported_mqls) || 0,
            estimatedWaste: (parseInt(campaign.unsupported_mqls) || 0) * 25
          };
        }
      })
    );
    
    return campaignsWithDeals;
    
  } catch (error) {
    console.error('❌ Campaign breakdown failed:', error.message);
    return [];
  }
}

/**
 * Get unsupported territories breakdown - DIRECT MYSQL
 */
async function getUnsupportedTerritories(connection, dateRange, campaignCondition) {
  try {
    console.log(`🚫 Getting unsupported territories (DIRECT)...`);
    
    const [territoriesResults] = await connection.execute(`
      SELECT 
        COALESCE(nationality, 'Unknown') as nationality,
        COUNT(*) as contact_count,
        COUNT(*) * 25 as estimated_waste
      FROM hub_contacts 
      WHERE hs_analytics_source = 'PAID_SEARCH'
        AND territory = 'Unsupported Territory'
        AND (hubspot_owner_id != 10017927 OR hubspot_owner_id IS NULL OR hubspot_owner_id = '')
        AND DATE(createdate) >= ? 
        AND DATE(createdate) <= ?
        ${campaignCondition}
      GROUP BY nationality
      HAVING contact_count > 0
      ORDER BY contact_count DESC
      LIMIT 10
    `, [dateRange.start, dateRange.end]);
    
    console.log(`✅ Unsupported territories (DIRECT): ${territoriesResults.length} territories`);
    
    return territoriesResults.map(row => ({
      name: row.nationality,
      count: parseInt(row.contact_count) || 0,
      estimatedWaste: parseInt(row.estimated_waste) || 0
    }));
    
  } catch (error) {
    console.error('❌ Unsupported territories failed:', error.message);
    return [];
  }
}

/**
 * Handle HTTP request for enhanced burn rate (for index.js routing)
 */
async function handleEnhancedBurnRateRequest(req, res, getDbConnection) {
  try {
    console.log(`🔥 Enhanced burn rate request (DIRECT):`, req.query);
    
    // Extract and validate parameters
    const options = {
      days: req.query.days ? parseInt(req.query.days) : 30,
      campaign: req.query.campaign || 'all',
      mode: req.query.mode || 'pipeline'
    };
    
    // Validate parameters
    if (options.days < 1 || options.days > 365) {
      return res.status(400).json({
        success: false,
        error: 'Days parameter must be between 1 and 365',
        timestamp: new Date().toISOString()
      });
    }
    
    // Get enhanced burn rate data
    const result = await getEnhancedBurnRate(getDbConnection, options);
    
    // Return result
    res.json(result);
    
  } catch (error) {
    console.error('❌ Enhanced burn rate request failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle HTTP request for basic burn rate data (for index.js routing)
 */
async function handleBurnRateDataRequest(req, res, getDbConnection) {
  try {
    const days = parseInt(req.query.days) || 30;
    const result = await getBurnRateData(getDbConnection, days);
    res.json(result);
  } catch (error) {
    console.error('❌ Burn rate data request failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle HTTP request for pipeline data (for index.js routing)
 */
async function handlePipelineDataRequest(req, res, getDbConnection) {
  try {
    const days = parseInt(req.query.days) || 30;
    const campaign = req.query.campaign || 'all';
    const result = await getPipelineData(getDbConnection, days, campaign);
    res.json(result);
  } catch (error) {
    console.error('❌ Pipeline data request failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  getEnhancedBurnRate,
  getBurnRateData,
  getPipelineData,
  handleEnhancedBurnRateRequest,
  handleBurnRateDataRequest,
  handlePipelineDataRequest
};