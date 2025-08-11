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
    const unsupported = countriesData.filter(c => c.territory === 'Unsupported Territory');
    return unsupported.map(c => c.code);
  } catch (error) {
    console.error('⚠️ Error loading countries:', error.message);
    return ['AF', 'BD', 'MM', 'KP', 'SO', 'SS', 'SY', 'YE']; // Fallback
  }
}

/**
 * Get dashboard summary data
 */
async function getDashboardSummary(getDbConnection, days = 30) {
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
      
      // Get deal summary data
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
 * Get campaign performance data with proper column names
 */
async function getCampaignPerformance(getDbConnection, days = 30) {
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
 * Get territory analysis data
 */
async function getTerritoryAnalysis(getDbConnection, days = 30) {
  try {
    const connection = await getDbConnection();
    
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
      const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ');
      
      console.log(`🌍 Getting territory analysis for ${days} days...`);
      
      // Load unsupported territories
      const unsupportedTerritories = loadCountryClassifications();
      
      // Get territory breakdown
      const [territoryResults] = await connection.execute(`
        SELECT 
          CASE 
            WHEN COALESCE(nationality, country, territory, ip_country, '') IN (${unsupportedTerritories.map(() => '?').join(',') || 'NULL'})
            THEN 'Unsupported Territory'
            ELSE COALESCE(nationality, country, territory, ip_country, 'Unknown')
          END as territoryName,
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
        GROUP BY CASE 
          WHEN COALESCE(nationality, country, territory, ip_country, '') IN (${unsupportedTerritories.map(() => '?').join(',') || 'NULL'})
          THEN 'Unsupported Territory'
          ELSE COALESCE(nationality, country, territory, ip_country, 'Unknown')
        END
        HAVING contacts > 0
        ORDER BY contacts DESC
        LIMIT 20
      `, [
        ...unsupportedTerritories,
        startDateStr, 
        endDateStr,
        ...unsupportedTerritories
      ]);
      
      const territories = territoryResults.map((territory, index) => {
        const isUnsupported = territory.territoryName === 'Unsupported Territory';
        return {
          name: territory.territoryName,
          contacts: parseInt(territory.contacts) || 0,
          dealsCreated: parseInt(territory.dealsCreated) || 0,
          conversionRate: territory.contacts > 0 ? 
            ((parseInt(territory.dealsCreated) / parseInt(territory.contacts)) * 100).toFixed(1) : 0,
          isUnsupported: isUnsupported,
          color: isUnsupported ? '#EF4444' : `hsl(${index * 137.5 % 360}, 70%, 50%)`
        };
      });
      
      const totalContacts = territories.reduce((sum, t) => sum + t.contacts, 0);
      const unsupportedContacts = territories.find(t => t.isUnsupported)?.contacts || 0;
      
      console.log(`🌍 Found ${territories.length} territories, ${unsupportedContacts}/${totalContacts} unsupported`);
      
      return {
        success: true,
        territories: territories,
        burnRateSummary: {
          unsupportedContacts: unsupportedContacts,
          totalContacts: totalContacts,
          burnRatePercentage: totalContacts > 0 ? ((unsupportedContacts / totalContacts) * 100).toFixed(1) : 0
        },
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
 * Get trends data (placeholder for now)
 */
async function getTrends(getDbConnection, days = 30) {
  try {
    // For now, return a simple success response
    // You can implement actual trends logic later
    return {
      success: true,
      trends: [],
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

module.exports = {
  getDashboardSummary,
  getCampaignPerformance,
  getTerritoryAnalysis,
  getTrends
};