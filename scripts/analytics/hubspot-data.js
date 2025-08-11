/**
 * FIXED: HubSpot Dashboard Data API Module
 * /scripts/analytics/hubspot-data.js
 * 
 * FIXES:
 * - All missing functions that dashboard.js needs
 * - Correct database column names from schema
 * - Proper error handling
 * - Territory classification loading
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
    console.log('🔍 Raw countries data type:', typeof countriesData, 'Sample:', countriesData);
    
    // Handle different file formats
    let countryArray = [];
    if (Array.isArray(countriesData)) {
      countryArray = countriesData;
    } else if (countriesData.countries && Array.isArray(countriesData.countries)) {
      countryArray = countriesData.countries;
    } else if (typeof countriesData === 'object') {
      // Convert object to array if needed
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
 * Get dashboard summary data with analysis mode support
 */
async function getDashboardSummary(getDbConnection, days = 30, analysisMode = 'pipeline') {
  try {
    const connection = await getDbConnection();
    
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
      const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ');
      
      console.log(`📊 Getting dashboard summary for ${days} days...`);
      
      // Get summary contact data with Google Ads attribution
      const [summaryResult] = await connection.execute(`
        SELECT 
          COUNT(*) as totalContacts,
          COUNT(CASE WHEN num_associated_deals > 0 THEN 1 END) as contactsWithDeals,
          COUNT(DISTINCT hs_analytics_source_data_1) as uniqueCampaigns
        FROM hub_contacts 
        WHERE (
          hs_analytics_source = 'PAID_SEARCH' 
          OR hs_object_source = 'FORM'
          OR gclid IS NOT NULL 
          OR hs_object_source_label LIKE '%google%'
        )
          AND createdate >= ? 
          AND createdate <= ?
          AND hs_analytics_source_data_1 IS NOT NULL
      `, [startDateStr, endDateStr]);
      
      const summary = summaryResult[0] || {};
      
      // Get deal summary data - FIXED: Use correct association column names
      const [dealSummary] = await connection.execute(`
        SELECT 
          COUNT(*) as totalDeals,
          COUNT(CASE WHEN dealstage = 'closedwon' THEN 1 END) as wonDeals,
          COUNT(CASE WHEN dealstage = 'closedlost' THEN 1 END) as lostDeals,
          SUM(CAST(COALESCE(amount, '0') as DECIMAL(15,2))) as totalRevenue,
          AVG(CAST(COALESCE(amount, '0') as DECIMAL(15,2))) as avgDealValue
        FROM hub_deals d
        JOIN hub_contact_deal_associations a ON d.hubspot_deal_id = a.deal_hubspot_id
        JOIN hub_contacts c ON a.contact_hubspot_id = c.hubspot_id
        WHERE (
          c.hs_analytics_source = 'PAID_SEARCH' 
          OR c.hs_object_source = 'FORM'
          OR c.gclid IS NOT NULL 
          OR c.hs_object_source_label LIKE '%google%'
        )
          AND d.createdate >= ? 
          AND d.createdate <= ?
          AND c.hs_analytics_source_data_1 IS NOT NULL
      `, [startDateStr, endDateStr]);
      
      const deals = dealSummary[0] || {};
      
      const result = {
        success: true,
        summary: {
          totalContacts: parseInt(summary.totalContacts) || 0,
          contactsWithDeals: parseInt(summary.contactsWithDeals) || 0,
          uniqueCampaigns: parseInt(summary.uniqueCampaigns) || 0,
          totalDeals: parseInt(deals.totalDeals) || 0,
          wonDeals: parseInt(deals.wonDeals) || 0,
          lostDeals: parseInt(deals.lostDeals) || 0,
          totalRevenue: parseFloat(deals.totalRevenue) || 0,
          avgDealValue: parseFloat(deals.avgDealValue) || 0,
          conversionRate: summary.totalContacts > 0 ? 
            ((parseInt(summary.contactsWithDeals) / parseInt(summary.totalContacts)) * 100).toFixed(1) : 0
        },
        period: `Last ${days} days`,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Dashboard summary generated:`, result.summary);
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
 * Get campaign performance data with proper column names and analysis mode
 */
async function getCampaignPerformance(getDbConnection, days = 30, analysisMode = 'pipeline') {
  try {
    const connection = await getDbConnection();
    
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
      const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ');
      
      console.log(`🎯 Getting campaign performance for ${days} days...`);
      
      // FIXED: Get campaign performance using correct column names
      const [campaignResults] = await connection.execute(`
        SELECT 
          hs_analytics_source_data_1 as campaignId,
          google_ads_campaign as campaignName,
          adgroup as adGroup,
          COUNT(*) as contacts,
          COUNT(CASE WHEN num_associated_deals > 0 THEN 1 END) as dealsCreated,
          AVG(CASE WHEN num_associated_deals > 0 THEN 1 ELSE 0 END) * 100 as conversionRate
        FROM hub_contacts 
        WHERE (
          hs_analytics_source = 'PAID_SEARCH' 
          OR hs_object_source = 'FORM'
          OR gclid IS NOT NULL 
          OR hs_object_source_label LIKE '%google%'
        )
          AND createdate >= ? 
          AND createdate <= ?
          AND hs_analytics_source_data_1 IS NOT NULL
        GROUP BY hs_analytics_source_data_1, google_ads_campaign, adgroup
        HAVING contacts > 0
        ORDER BY contacts DESC
        LIMIT 50
      `, [startDateStr, endDateStr]);
      
      // Get revenue data for each campaign
      const campaigns = [];
      for (const campaign of campaignResults) {
        const [revenueResult] = await connection.execute(`
          SELECT 
            COUNT(*) as deals,
            COUNT(CASE WHEN d.dealstage = 'closedwon' THEN 1 END) as wonDeals,
            SUM(CAST(COALESCE(d.amount, '0') as DECIMAL(15,2))) as revenue
          FROM hub_deals d
          JOIN hub_contact_deal_associations a ON d.hubspot_deal_id = a.deal_hubspot_id
          JOIN hub_contacts c ON a.contact_hubspot_id = c.hubspot_id
          WHERE c.hs_analytics_source_data_1 = ?
            AND d.createdate >= ? 
            AND d.createdate <= ?
        `, [campaign.campaignId, startDateStr, endDateStr]);
        
        const revenue = revenueResult[0] || {};
        
        campaigns.push({
          campaignId: campaign.campaignId || 'N/A',
          campaignName: campaign.campaignName || 'N/A',
          adGroup: campaign.adGroup || 'Not Specified',
          contacts: parseInt(campaign.contacts) || 0,
          dealsCreated: parseInt(campaign.dealsCreated) || 0,
          conversionRate: parseFloat(campaign.conversionRate).toFixed(1) || '0.0',
          deals: parseInt(revenue.deals) || 0,
          wonDeals: parseInt(revenue.wonDeals) || 0,
          revenue: parseFloat(revenue.revenue) || 0
        });
      }
      
      console.log(`🎯 Found ${campaigns.length} campaigns with data`);
      
      return {
        success: true,
        campaigns: campaigns,
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
 * Get territory analysis data - SIMPLIFIED: Use HubSpot's existing logic
 */
async function getTerritoryAnalysis(getDbConnection, days = 30, analysisMode = 'pipeline') {
  try {
    const connection = await getDbConnection();
    
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
      const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ');
      
      console.log(`🌍 Getting territory analysis for ${days} days (${analysisMode} mode)...`);
      
      // SIMPLIFIED: Just get basic territory breakdown from contacts
      const [territoryResults] = await connection.execute(`
        SELECT 
          COALESCE(nationality, country, territory, ip_country, 'Unknown') as territoryName,
          COUNT(*) as contacts,
          COUNT(CASE WHEN num_associated_deals > 0 THEN 1 END) as dealsCreated
        FROM hub_contacts 
        WHERE (
          hs_analytics_source = 'PAID_SEARCH' 
          OR hs_object_source = 'FORM'
          OR gclid IS NOT NULL 
          OR hs_object_source_label LIKE '%google%'
        )
          AND createdate >= ? 
          AND createdate <= ?
          AND hs_analytics_source_data_1 IS NOT NULL
        GROUP BY COALESCE(nationality, country, territory, ip_country, 'Unknown')
        HAVING contacts > 0
        ORDER BY contacts DESC
        LIMIT 20
      `, [startDateStr, endDateStr]);
      
      // SIMPLIFIED: Calculate burn rate the simple way
      // First get the basic summary data we need
      const [summaryForBurnRate] = await connection.execute(`
        SELECT 
          COUNT(*) as totalContacts,
          COUNT(CASE WHEN num_associated_deals > 0 THEN 1 END) as contactsWithDeals
        FROM hub_contacts 
        WHERE (
          hs_analytics_source = 'PAID_SEARCH' 
          OR hs_object_source = 'FORM'
          OR gclid IS NOT NULL 
          OR hs_object_source_label LIKE '%google%'
        )
          AND createdate >= ? 
          AND createdate <= ?
          AND hs_analytics_source_data_1 IS NOT NULL
      `, [startDateStr, endDateStr]);
      
      const summaryData = summaryForBurnRate[0] || {};
      const totalContacts = parseInt(summaryData.totalContacts) || 0;
      const contactsWithDeals = parseInt(summaryData.contactsWithDeals) || 0;
      const failedInitialValidation = totalContacts - contactsWithDeals;
      
      // Also get contacts who passed initial validation but later marked as unsupported
      const [additionalUnsupported] = await connection.execute(`
        SELECT 
          COUNT(*) as later_unsupported
        FROM hub_deals d
        JOIN hub_contact_deal_associations a ON d.hubspot_deal_id = a.deal_hubspot_id
        JOIN hub_contacts c ON a.contact_hubspot_id = c.hubspot_id
        WHERE (
          c.hs_analytics_source = 'PAID_SEARCH' 
          OR c.hs_object_source = 'FORM'
          OR c.gclid IS NOT NULL 
          OR c.hs_object_source_label LIKE '%google%'
        )
          AND c.createdate >= ? 
          AND c.createdate <= ?
          AND c.hs_analytics_source_data_1 IS NOT NULL
          AND d.dealstage = 'closedlost'
          AND (d.closed_lost_reason LIKE '%Unsupported Territory%' 
               OR d.closed_lost_reason LIKE '%unsupported%'
               OR d.hs_closed_lost_reason LIKE '%Unsupported Territory%')
      `, [startDateStr, endDateStr]);
      
      const laterUnsupported = parseInt(additionalUnsupported[0]?.later_unsupported) || 0;
      const totalUnsupported = failedInitialValidation + laterUnsupported;
      
      console.log(`✅ Territory calculation: ${totalContacts} total → ${contactsWithDeals} got deals → ${failedInitialValidation} failed initial + ${laterUnsupported} later unsupported = ${totalUnsupported} total rejected`);
      
      const territories = territoryResults.map((territory, index) => ({
        name: territory.territoryName,
        contacts: parseInt(territory.contacts) || 0,
        dealsCreated: parseInt(territory.dealsCreated) || 0,
        conversionRate: territory.contacts > 0 ? 
          ((parseInt(territory.dealsCreated) / parseInt(territory.contacts)) * 100).toFixed(1) : 0,
        isUnsupported: false, // We don't duplicate HubSpot's logic
        color: `hsl(${index * 137.5 % 360}, 70%, 50%)`
      }));
      
      return {
        success: true,
        territories: territories,
        burnRateSummary: {
          unsupportedContacts: totalUnsupported, // Simple calculation
          totalContacts: totalContacts,
          burnRatePercentage: totalContacts > 0 ? ((totalUnsupported / totalContacts) * 100).toFixed(1) : 0,
          breakdown: {
            failed_initial_validation: failedInitialValidation,
            later_marked_unsupported: laterUnsupported,
            passed_validation: contactsWithDeals
          }
        },
        period: `Last ${days} days`,
        mode: analysisMode,
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
 * Get trends data with analysis mode support
 */
async function getTrendData(getDbConnection, days = 30, analysisMode = 'pipeline') {
  try {
    // For now, return a simple success response
    // You can implement actual trends logic later
    return {
      success: true,
      trends: [],
      period: `Last ${days} days`,
      mode: analysisMode,
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
 * Get MQL validation metrics - FIXED: Proper error handling
 */
async function getMQLValidationMetrics(getDbConnection, days = 30, analysisMode = 'pipeline') {
  try {
    console.log(`🎯 Getting MQL validation metrics for ${days} days (${analysisMode} mode)...`);
    
    // Get both summary and territory data independently
    const [summaryResult, territoriesResult] = await Promise.all([
      getDashboardSummary(getDbConnection, days, analysisMode),
      getTerritoryAnalysis(getDbConnection, days, analysisMode)
    ]);
    
    if (!summaryResult.success) {
      throw new Error(`Dashboard summary failed: ${summaryResult.error}`);
    }
    if (!territoriesResult.success) {
      throw new Error(`Territory analysis failed: ${territoriesResult.error}`);
    }
    
    // Calculate MQL validation metrics
    const totalContacts = summaryResult.summary.totalContacts || 0;
    const contactsWithDeals = summaryResult.summary.contactsWithDeals || 0;
    const totalDeals = summaryResult.summary.totalDeals || 0;
    
    // Use territory analysis burn rate data
    const burnRateData = territoriesResult.burnRateSummary || {};
    const unsupportedContacts = burnRateData.unsupportedContacts || 0;
    const supportedContacts = totalContacts - unsupportedContacts;
    
    console.log(`✅ MQL Validation: ${totalContacts} MQLs → ${totalDeals} SQLs (${totalContacts > 0 ? ((totalDeals / totalContacts) * 100).toFixed(1) : 0}% conversion)`);
    
    return {
      success: true,
      mql_stage: {
        total_mqls: totalContacts,
        supported_mqls: supportedContacts,
        unsupported_mqls: unsupportedContacts,
        burn_rate_percentage: totalContacts > 0 ? ((unsupportedContacts / totalContacts) * 100).toFixed(1) : 0
      },
      sql_validation: {
        total_deals_created: totalDeals,
        validation_rate_percentage: supportedContacts > 0 ? ((totalDeals / supportedContacts) * 100).toFixed(1) : 0,
        won_deals: summaryResult.summary.wonDeals || 0,
        lost_deals: summaryResult.summary.lostDeals || 0
      },
      period: `Last ${days} days`,
      mode: analysisMode,
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

module.exports = {
  getDashboardSummary,
  getCampaignPerformance,
  getTerritoryAnalysis,
  getTrendData,
  getMQLValidationMetrics
};