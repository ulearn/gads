/**
 * FINAL FIXED: HubSpot Dashboard Data API Module
 * /scripts/analytics/hubspot-data.js
 * 
 * FIXED: Pipeline vs Revenue Analysis Mode Support
 * - Pipeline Mode: Filters by deal createdate (new deals in timeframe)
 * - Revenue Mode: Filters by deal closedate (deals won/lost in timeframe)
 */

const fs = require('fs');
const path = require('path');

// Load country classifications for territory analysis
function loadCountryClassifications() {
  try {
    const countriesFile = path.join(__dirname, '../country/country-codes.json');
    
    if (!fs.existsSync(countriesFile)) {
      console.log('⚠️ Country codes file not found, using default unsupported territories');
      return ['AF', 'BD', 'MM', 'KP', 'SO', 'SS', 'SY', 'YE']; // Default unsupported
    }
    
    const countriesData = JSON.parse(fs.readFileSync(countriesFile, 'utf8'));
    
    // Handle different file formats
    let countryArray = [];
    if (Array.isArray(countriesData)) {
      countryArray = countriesData;
    } else if (countriesData.countries && Array.isArray(countriesData.countries)) {
      countryArray = countriesData.countries;
    } else if (typeof countriesData === 'object') {
      countryArray = Object.values(countriesData);
    } else {
      throw new Error('Unrecognized country data format');
    }
    
    const unsupported = countryArray.filter(c => 
      c && (c.territory === 'Unsupported Territory' || c.status === 'unsupported')
    );
    
    const codes = unsupported.map(c => c.code || c.country_code).filter(Boolean);
    console.log(`✅ Successfully loaded ${codes.length} unsupported territory codes:`, codes);
    
    return codes.length > 0 ? codes : ['AF', 'BD', 'MM', 'KP', 'SO', 'SS', 'SY', 'YE']; // Fallback
    
  } catch (error) {
    console.error('⚠️ Error loading countries:', error.message);
    return ['AF', 'BD', 'MM', 'KP', 'SO', 'SS', 'SY', 'YE']; // Fallback
  }
}

/**
 * Build Google Ads attribution query
 */
function buildGoogleAdsAttributionQuery() {
  return `hs_analytics_source = 'PAID_SEARCH'`;
}

/**
 * FIXED: Get dashboard summary with proper Pipeline vs Revenue analysis
 */
async function getDashboardSummary(getDbConnection, days = 30, analysisMode = 'pipeline') {
  try {
    const connection = await getDbConnection();
    
    try {
      console.log(`📊 Getting Google Ads B2C ${analysisMode} summary for ${days} days...`);
      
      // CARD 3: MQLs Created - Total Google Ads B2C contacts (always filter by contact createdate)
      const [mqlsCreated] = await connection.execute(`
        SELECT COUNT(*) AS contact_count
        FROM hub_contacts c
        WHERE c.hs_analytics_source = 'PAID_SEARCH'
          AND (
                c.hubspot_owner_id != 10017927
                OR c.hubspot_owner_id IS NULL
                OR c.hubspot_owner_id = ''
              )
          AND c.createdate >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          AND c.createdate < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
      `, [days - 1]);
      
      const totalContacts = parseInt(mqlsCreated[0]?.contact_count) || 0;
      console.log(`✅ CARD 3 - MQLs Created: ${totalContacts}`);
      
      // CARD 4: MQLs Failed - Unsupported Territory validation failures (always filter by contact createdate)
      const [mqlsFailed] = await connection.execute(`
        SELECT COUNT(*) AS contact_count
        FROM hub_contacts c
        WHERE c.hs_analytics_source = 'PAID_SEARCH'
          AND (
                c.hubspot_owner_id != 10017927
                OR c.hubspot_owner_id IS NULL
                OR c.hubspot_owner_id = ''
              )
          AND c.territory = 'Unsupported Territory'
          AND c.createdate >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          AND c.createdate < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
      `, [days - 1]);
      
      const failedContacts = parseInt(mqlsFailed[0]?.contact_count) || 0;
      console.log(`✅ CARD 4 - MQLs Failed: ${failedContacts}`);
      
      // CARD 5: SQLs Passed - Territory validated + has deals (always filter by contact createdate)
      const [sqlsPassed] = await connection.execute(`
        SELECT COUNT(*) AS contact_count
        FROM hub_contacts c
        WHERE c.hs_analytics_source = 'PAID_SEARCH'
          AND (
                c.hubspot_owner_id != 10017927
                OR c.hubspot_owner_id IS NULL
                OR c.hubspot_owner_id = ''
              )
          AND c.territory != 'Unsupported Territory'
          AND c.num_associated_deals > 0
          AND c.createdate >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          AND c.createdate < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
      `, [days - 1]);
      
      const sqlsPassedCount = parseInt(sqlsPassed[0]?.contact_count) || 0;
      console.log(`✅ CARD 5 - SQLs Passed: ${sqlsPassedCount}`);
      
      // CARD 6: Deals WON/LOST - FIXED: Different logic for pipeline vs revenue analysis
      
      let dealResults;
      let dealLogicDescription;
      
      if (analysisMode === 'revenue') {
        // REVENUE MODE: Filter by deal closedate (deals that closed in timeframe)
        dealLogicDescription = "Deals closed in timeframe (any contact create date)";
        [dealResults] = await connection.execute(`
          SELECT 
            COUNT(DISTINCT d.hubspot_deal_id) as totalDeals,
            COUNT(CASE WHEN d.dealstage = 'closedwon' THEN d.hubspot_deal_id END) as wonDeals,
            COUNT(CASE WHEN d.dealstage = 'closedlost' THEN d.hubspot_deal_id END) as lostDeals,
            SUM(CASE WHEN d.dealstage = 'closedwon' AND d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) ELSE 0 END) as totalRevenue,
            AVG(CASE WHEN d.dealstage = 'closedwon' AND d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) ELSE NULL END) as avgDealValue
          FROM hub_contact_deal_associations a
          JOIN hub_contacts c ON a.contact_hubspot_id = c.hubspot_id
          JOIN hub_deals d ON a.deal_hubspot_id = d.hubspot_deal_id
          WHERE c.hubspot_owner_id != 10017927
            AND c.hs_analytics_source = 'PAID_SEARCH'
            AND c.territory != 'Unsupported Territory'
            AND c.num_associated_deals > 0
            AND d.pipeline = 'default'
            AND d.closedate >= DATE_SUB(CURDATE(), INTERVAL ? DAY)  -- FILTER BY CLOSE DATE
            AND d.closedate < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
            AND (d.dealstage = 'closedwon' OR d.dealstage = 'closedlost')  -- Only closed deals
        `, [days - 1]);
        
      } else {
        // PIPELINE MODE: Filter by contact createdate (deals from contacts created in timeframe)
        dealLogicDescription = "Deals from contacts created in timeframe (any deal close date)";
        [dealResults] = await connection.execute(`
          SELECT 
            COUNT(DISTINCT d.hubspot_deal_id) as totalDeals,
            COUNT(CASE WHEN d.dealstage = 'closedwon' THEN d.hubspot_deal_id END) as wonDeals,
            COUNT(CASE WHEN d.dealstage = 'closedlost' THEN d.hubspot_deal_id END) as lostDeals,
            SUM(CASE WHEN d.dealstage = 'closedwon' AND d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) ELSE 0 END) as totalRevenue,
            AVG(CASE WHEN d.dealstage = 'closedwon' AND d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) ELSE NULL END) as avgDealValue
          FROM hub_contact_deal_associations a
          JOIN hub_contacts c ON a.contact_hubspot_id = c.hubspot_id
          JOIN hub_deals d ON a.deal_hubspot_id = d.hubspot_deal_id
          WHERE c.hubspot_owner_id != 10017927
            AND c.hs_analytics_source = 'PAID_SEARCH'
            AND c.territory != 'Unsupported Territory'
            AND c.num_associated_deals > 0
            AND c.createdate >= DATE_SUB(CURDATE(), INTERVAL ? DAY)  -- FILTER BY CONTACT CREATE DATE
            AND c.createdate < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
            AND d.pipeline = 'default'
        `, [days - 1]);
      }
      
      const deals = dealResults[0] || {};
      console.log(`✅ CARD 6 - ${analysisMode.toUpperCase()} MODE deals:`, {
        logic: dealLogicDescription,
        total: deals.totalDeals,
        won: deals.wonDeals,
        lost: deals.lostDeals,
        revenue: deals.totalRevenue
      });
      
      // Calculate rates
      const conversionRate = totalContacts > 0 ? ((sqlsPassedCount / totalContacts) * 100).toFixed(1) : 0;
      const burnRate = totalContacts > 0 ? ((failedContacts / totalContacts) * 100).toFixed(1) : 0;

      const result = {
        success: true,
        summary: {
          // CARD 3: MQLs Created (always by contact createdate)
          totalContacts: totalContacts,
          
          // CARD 4: MQLs Failed (always by contact createdate)
          failed_validation: failedContacts,
          burn_rate: burnRate,
          
          // CARD 5: SQLs Passed (always by contact createdate)
          contactsWithDeals: sqlsPassedCount,
          conversionRate: conversionRate,
          
          // CARD 6: Deals - varies by analysis mode
          totalDeals: parseInt(deals.totalDeals) || 0,
          wonDeals: parseInt(deals.wonDeals) || 0,
          lostDeals: parseInt(deals.lostDeals) || 0,
          totalRevenue: parseFloat(deals.totalRevenue) || 0,
          avgDealValue: parseFloat(deals.avgDealValue) || 0,
          
          // Placeholder metrics for future
          gad_clicks: 0,
          gad_ctas: 0,
          uniqueCampaigns: 0
        },
        analysisMode: analysisMode,
        dealLogic: dealLogicDescription,
        period: `Last ${days} days`,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ ${analysisMode.toUpperCase()} MODE summary:`, {
        mqls_created: result.summary.totalContacts,
        mqls_failed: result.summary.failed_validation,
        sqls_passed: result.summary.contactsWithDeals,
        total_deals: result.summary.totalDeals,
        won_deals: result.summary.wonDeals,
        total_revenue: result.summary.totalRevenue
      });
      
      return result;
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Dashboard summary failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * FIXED: Get campaign performance with proper analysis mode support
 */
async function getCampaignPerformance(getDbConnection, days = 30, analysisMode = 'pipeline') {
  try {
    const connection = await getDbConnection();
    
    try {
      console.log(`🎯 Getting Google Ads B2C campaign performance for ${days} days (${analysisMode} mode)...`);
      
      let campaignResults;
      
      if (analysisMode === 'revenue') {
        // REVENUE MODE: Show campaigns with deals that closed in timeframe
        [campaignResults] = await connection.execute(`
          SELECT 
            c.hs_analytics_source_data_1 as campaignId,
            c.google_ads_campaign as campaignName,
            c.adgroup as adGroup,
            COUNT(DISTINCT c.hubspot_id) as contacts,
            COUNT(DISTINCT CASE 
              WHEN c.territory != 'Unsupported Territory' 
              AND c.num_associated_deals > 0 
              THEN c.hubspot_id 
            END) as contactsWithDeals,
            COUNT(DISTINCT d.hubspot_deal_id) as totalDeals,
            COUNT(DISTINCT CASE WHEN d.dealstage = 'closedwon' THEN d.hubspot_deal_id END) as wonDeals,
            SUM(CASE WHEN d.dealstage = 'closedwon' AND d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) ELSE 0 END) as revenue
          FROM hub_contacts c
          LEFT JOIN hub_contact_deal_associations a ON c.hubspot_id = a.contact_hubspot_id
          LEFT JOIN hub_deals d ON a.deal_hubspot_id = d.hubspot_deal_id 
            AND d.pipeline = 'default'
            AND d.closedate >= DATE_SUB(CURDATE(), INTERVAL ? DAY)  -- FILTER BY CLOSE DATE
            AND d.closedate < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
            AND (d.dealstage = 'closedwon' OR d.dealstage = 'closedlost')
          WHERE c.hs_analytics_source = 'PAID_SEARCH'
            AND (
                  c.hubspot_owner_id != 10017927
                  OR c.hubspot_owner_id IS NULL
                  OR c.hubspot_owner_id = ''
                )
          GROUP BY c.hs_analytics_source_data_1, c.google_ads_campaign, c.adgroup
          HAVING totalDeals > 0  -- Only show campaigns with closed deals
          ORDER BY revenue DESC, contacts DESC
          LIMIT 50
        `, [days - 1]);
        
      } else {
        // PIPELINE MODE: Show campaigns with contacts created in timeframe
        [campaignResults] = await connection.execute(`
          SELECT 
            c.hs_analytics_source_data_1 as campaignId,
            c.google_ads_campaign as campaignName,
            c.adgroup as adGroup,
            COUNT(DISTINCT c.hubspot_id) as contacts,
            COUNT(DISTINCT CASE 
              WHEN c.territory != 'Unsupported Territory' 
              AND c.num_associated_deals > 0 
              THEN c.hubspot_id 
            END) as contactsWithDeals,
            COUNT(DISTINCT d.hubspot_deal_id) as totalDeals,
            COUNT(DISTINCT CASE WHEN d.dealstage = 'closedwon' THEN d.hubspot_deal_id END) as wonDeals,
            SUM(CASE WHEN d.dealstage = 'closedwon' AND d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) ELSE 0 END) as revenue
          FROM hub_contacts c
          LEFT JOIN hub_contact_deal_associations a ON c.hubspot_id = a.contact_hubspot_id
          LEFT JOIN hub_deals d ON a.deal_hubspot_id = d.hubspot_deal_id 
            AND d.pipeline = 'default'
          WHERE c.hs_analytics_source = 'PAID_SEARCH'
            AND (
                  c.hubspot_owner_id != 10017927
                  OR c.hubspot_owner_id IS NULL
                  OR c.hubspot_owner_id = ''
                )
            AND c.createdate >= DATE_SUB(CURDATE(), INTERVAL ? DAY)  -- FILTER BY CONTACT CREATE DATE
            AND c.createdate < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
          GROUP BY c.hs_analytics_source_data_1, c.google_ads_campaign, c.adgroup
          HAVING contacts > 0
          ORDER BY revenue DESC, contacts DESC
          LIMIT 50
        `, [days - 1]);
      }
      
      const campaigns = campaignResults.map(campaign => ({
        campaignId: campaign.campaignId || 'N/A',
        campaignName: campaign.campaignName || 'N/A',
        adGroup: campaign.adGroup || 'Not Specified',
        contacts: parseInt(campaign.contacts) || 0,
        contactsWithDeals: parseInt(campaign.contactsWithDeals) || 0,
        totalDeals: parseInt(campaign.totalDeals) || 0,
        wonDeals: parseInt(campaign.wonDeals) || 0,
        revenue: parseFloat(campaign.revenue) || 0,
        conversionRate: campaign.contacts > 0 ? 
          ((parseInt(campaign.contactsWithDeals) / parseInt(campaign.contacts)) * 100).toFixed(1) : '0.0'
      }));
      
      console.log(`🎯 Found ${campaigns.length} Google Ads B2C campaigns (${analysisMode} mode)`);
      
      return {
        success: true,
        campaigns: campaigns,
        analysisMode: analysisMode,
        period: `Last ${days} days`,
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Campaign performance failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get territory analysis data with corrected filtering
 */
async function getTerritoryAnalysis(getDbConnection, days = 30, analysisMode = 'pipeline') {
  try {
    const connection = await getDbConnection();
    
    try {
      console.log(`🌍 Getting Google Ads B2C territory analysis for ${days} days...`);
      
      // Get territory breakdown from Google Ads contacts (always by contact createdate)
      const [territoryResults] = await connection.execute(`
        SELECT 
          COALESCE(territory, 'Unknown/Not Set') as territoryName,
          COUNT(*) as contacts,
          COUNT(CASE 
            WHEN territory != 'Unsupported Territory' 
            AND num_associated_deals > 0 
            THEN 1 
          END) as dealsCreated
        FROM hub_contacts 
        WHERE hs_analytics_source = 'PAID_SEARCH'
          AND (
                hubspot_owner_id != 10017927
                OR hubspot_owner_id IS NULL
                OR hubspot_owner_id = ''
              )
          AND createdate >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          AND createdate < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        GROUP BY COALESCE(territory, 'Unknown/Not Set')
        HAVING contacts > 0
        ORDER BY contacts DESC
        LIMIT 20
      `, [days - 1]);
      
      const territories = territoryResults.map((territory, index) => ({
        name: territory.territoryName,
        contacts: parseInt(territory.contacts) || 0,
        dealsCreated: parseInt(territory.dealsCreated) || 0,
        conversionRate: territory.contacts > 0 ? 
          ((parseInt(territory.dealsCreated) / parseInt(territory.contacts)) * 100).toFixed(1) : 0,
        isUnsupported: territory.territoryName === 'Unsupported Territory',
        color: `hsl(${index * 137.5 % 360}, 70%, 50%)`
      }));
      
      return {
        success: true,
        territories: territories,
        analysisMode: analysisMode,
        period: `Last ${days} days`,
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Territory analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get trends data
 */
async function getTrendData(getDbConnection, days = 30, analysisMode = 'pipeline') {
  try {
    return {
      success: true,
      trends: [],
      analysisMode: analysisMode,
      period: `Last ${days} days`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Trends analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get MQL validation metrics
 */
async function getMQLValidationMetrics(getDbConnection, days = 30, analysisMode = 'pipeline') {
  try {
    console.log(`🎯 Getting Google Ads B2C MQL validation metrics for ${days} days (${analysisMode} mode)...`);
    
    const summaryResult = await getDashboardSummary(getDbConnection, days, analysisMode);
    
    if (!summaryResult.success) {
      throw new Error(`Dashboard summary failed: ${summaryResult.error}`);
    }
    
    const summary = summaryResult.summary;
    
    return {
      success: true,
      mql_stage: {
        total_mqls: summary.totalContacts,
        supported_mqls: summary.totalContacts - summary.failed_validation,
        unsupported_mqls: summary.failed_validation,
        burn_rate_percentage: summary.burn_rate
      },
      sql_validation: {
        total_deals_created: summary.totalDeals,
        validation_rate_percentage: summary.conversionRate,
        won_deals: summary.wonDeals,
        lost_deals: summary.lostDeals
      },
      analysisMode: analysisMode,
      period: `Last ${days} days`,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ MQL validation metrics failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Test Google Ads attribution logic
 */
async function testGoogleAdsAttribution(getDbConnection, days = 7) {
  try {
    const connection = await getDbConnection();
    
    try {
      console.log(`🔍 Testing Google Ads attribution for ${days} days...`);
      
      const [attributionTest] = await connection.execute(`
        SELECT 
          COUNT(*) as total_contacts_matched,
          COUNT(CASE WHEN hs_analytics_source = 'PAID_SEARCH' THEN 1 END) as paid_search,
          COUNT(CASE 
            WHEN hubspot_owner_id != 10017927 
            OR hubspot_owner_id IS NULL 
            OR hubspot_owner_id = '' 
            THEN 1 
          END) as non_partners,
          COUNT(CASE 
            WHEN territory != 'Unsupported Territory' 
            AND num_associated_deals > 0 
            THEN 1 
          END) as passed_validation
        FROM hub_contacts 
        WHERE hs_analytics_source = 'PAID_SEARCH'
          AND (
                hubspot_owner_id != 10017927
                OR hubspot_owner_id IS NULL
                OR hubspot_owner_id = ''
              )
          AND createdate >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          AND createdate < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
      `, [days - 1]);
      
      return {
        success: true,
        attribution_test: attributionTest[0] || {},
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Attribution test failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getDashboardSummary,
  getCampaignPerformance,
  getTerritoryAnalysis,
  getTrendData,
  getMQLValidationMetrics,
  testGoogleAdsAttribution,
  buildGoogleAdsAttributionQuery
};