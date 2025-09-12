/**
 * SHARED ATTRIBUTION UTILITIES MODULE - PRODUCTION READY
 * /scripts/analytics/attribution-utils.js
 * 
 * Centralizes Google Ads attribution logic to ensure consistency across ALL dashboards.
 * Based on the working roas-revenue.js implementation.
 * 
 * TRACKING TEMPLATE FIX:
 * - When hs_analytics_source_data_1 = '{campaign}', use google_ads_campaign field instead
 * - Recovers ~500 contacts that were losing attribution due to broken tracking template
 * 
 * USAGE:
 * const attribution = require('./attribution-utils');
 * const query = `SELECT ... WHERE ${attribution.buildEnhancedAttributionQuery()} ...`;
 */

/**
 * Enhanced Google Ads Attribution Query Builder
 * 
 * This is the CORE fix that handles the broken tracking template issue.
 * Matches the exact logic from your working roas-revenue.js file.
 * 
 * @returns {string} SQL WHERE clause for enhanced attribution
 */
function buildEnhancedAttributionQuery() {
  return `
    (
      -- STANDARD ATTRIBUTION: Normal PAID_SEARCH contacts
      (
        hc.hs_analytics_source = 'PAID_SEARCH' 
        AND hc.hs_analytics_source_data_1 != '{campaign}'
        AND hc.hs_analytics_source_data_1 IS NOT NULL
        AND hc.hs_analytics_source_data_1 != ''
      )
      
      OR
      
      -- FIX #1: BROKEN TEMPLATE - Use custom "Google Ads Campaign" field
      (
        hc.hs_analytics_source = 'PAID_SEARCH'
        AND hc.hs_analytics_source_data_1 = '{campaign}'
        AND hc.google_ads_campaign IS NOT NULL
        AND hc.google_ads_campaign != ''
      )
    )
  `;
}

/**
 * BACKWARD COMPATIBILITY: Simple Google Ads Attribution Query
 * 
 * For files that just need basic PAID_SEARCH filtering (like current system).
 * Can be gradually upgraded to enhanced version.
 * 
 * @returns {string} Simple SQL WHERE clause
 */
function buildSimpleAttributionQuery() {
  return `hc.hs_analytics_source = 'PAID_SEARCH'`;
}

/**
 * Get Effective Campaign Name Logic
 * 
 * Determines which campaign field to use based on whether tracking template is broken.
 * Matches the logic from your working roas-revenue.js file.
 * 
 * @returns {string} SQL CASE statement for getting campaign names
 */
function getCampaignAttributionLogic() {
  return `
    CASE 
      -- Use standard field when tracking template works
      WHEN hc.hs_analytics_source = 'PAID_SEARCH' 
           AND hc.hs_analytics_source_data_1 != '{campaign}'
           AND hc.hs_analytics_source_data_1 IS NOT NULL
           AND hc.hs_analytics_source_data_1 != ''
      THEN hc.hs_analytics_source_data_1
      
      -- Use custom field when tracking template is broken
      WHEN hc.hs_analytics_source = 'PAID_SEARCH'
           AND hc.hs_analytics_source_data_1 = '{campaign}'
           AND hc.google_ads_campaign IS NOT NULL
           AND hc.google_ads_campaign != ''
      THEN hc.google_ads_campaign
      
      ELSE 'attribution-unknown'
    END
  `;
}

/**
 * Standard Contact Filters
 * 
 * Consistent filtering logic used across all dashboards.
 * Matches your existing system filters.
 * 
 * @returns {string} SQL WHERE clause for contact filtering
 */
function getStandardContactFilters() {
  return `
    AND (
      hc.hubspot_owner_id != 10017927 
      OR hc.hubspot_owner_id IS NULL 
      OR hc.hubspot_owner_id = ''
    )
    AND hc.territory != 'Unsupported Territory'
  `;
}

/**
 * Build Campaign Matching Logic
 * 
 * Handles campaign matching across both standard and custom fields.
 * Used for campaign-specific attribution.
 * 
 * @param {string} campaignId - Google Ads campaign ID
 * @param {string} campaignName - Campaign name  
 * @returns {string} SQL WHERE clause for campaign matching
 */
function buildCampaignMatchingLogic(campaignId, campaignName) {
  return `
    (
      -- Match by campaign ID (standard tracking)
      hc.hs_analytics_source_data_1 = '${campaignId}'
      OR 
      -- Match by campaign name (broken template fix)
      hc.google_ads_campaign = '${campaignName}'
    )
  `;
}

/**
 * Build Total Revenue Attribution Query
 * 
 * Gets total portfolio revenue using enhanced attribution.
 * Used for portfolio-level ROAS calculations.
 * 
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {string} Complete SQL query for revenue attribution
 */
function buildTotalRevenueQuery(startDate, endDate) {
  return `
    SELECT 
      COUNT(DISTINCT hd.hubspot_deal_id) as total_won_deals,
      COALESCE(SUM(DISTINCT hd.amount), 0) as total_revenue,
      COUNT(DISTINCT hc.hubspot_id) as total_attributed_contacts
    FROM hub_deals hd
    JOIN hub_contact_deal_associations a ON hd.hubspot_deal_id = a.deal_hubspot_id  
    JOIN hub_contacts hc ON a.contact_hubspot_id = hc.hubspot_id
    WHERE hd.dealstage = 'closedwon'
      AND DATE(hd.closedate) >= '${startDate}' AND DATE(hd.closedate) <= '${endDate}'
      AND hd.pipeline = 'default'
      AND ${buildEnhancedAttributionQuery()}
      ${getStandardContactFilters()}
  `;
}

/**
 * Build Attribution Quality Check Query
 * 
 * Shows breakdown between standard vs broken template contacts.
 * Essential for monitoring the health of attribution fixes.
 * 
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {string} SQL query for attribution quality analysis
 */
function buildAttributionQualityQuery(startDate, endDate) {
  return `
    SELECT 
      'Standard Tracking (Working)' as attribution_type,
      COUNT(DISTINCT hc.hubspot_id) as contact_count,
      COUNT(DISTINCT hd.hubspot_deal_id) as deal_count,
      COALESCE(SUM(DISTINCT CASE WHEN hd.dealstage = 'closedwon' THEN hd.amount ELSE 0 END), 0) as revenue
    FROM hub_contacts hc
    LEFT JOIN hub_contact_deal_associations a ON hc.hubspot_id = a.contact_hubspot_id
    LEFT JOIN hub_deals hd ON a.deal_hubspot_id = hd.hubspot_deal_id 
      AND hd.pipeline = 'default'
      AND DATE(hd.closedate) >= '${startDate}' AND DATE(hd.closedate) <= '${endDate}'
    WHERE hc.hs_analytics_source = 'PAID_SEARCH' 
      AND hc.hs_analytics_source_data_1 != '{campaign}'
      AND hc.hs_analytics_source_data_1 IS NOT NULL
      AND hc.hs_analytics_source_data_1 != ''
      ${getStandardContactFilters()}
    
    UNION ALL
    
    SELECT 
      'Broken Template (Fixed via Custom Field)' as attribution_type,
      COUNT(DISTINCT hc.hubspot_id) as contact_count,
      COUNT(DISTINCT hd.hubspot_deal_id) as deal_count,
      COALESCE(SUM(DISTINCT CASE WHEN hd.dealstage = 'closedwon' THEN hd.amount ELSE 0 END), 0) as revenue
    FROM hub_contacts hc
    LEFT JOIN hub_contact_deal_associations a ON hc.hubspot_id = a.contact_hubspot_id
    LEFT JOIN hub_deals hd ON a.deal_hubspot_id = hd.hubspot_deal_id 
      AND hd.pipeline = 'default'
      AND DATE(hd.closedate) >= '${startDate}' AND DATE(hd.closedate) <= '${endDate}'
    WHERE hc.hs_analytics_source = 'PAID_SEARCH'
      AND hc.hs_analytics_source_data_1 = '{campaign}'
      AND hc.google_ads_campaign IS NOT NULL
      AND hc.google_ads_campaign != ''
      ${getStandardContactFilters()}
  `;
}

/**
 * Utility: Calculate date range
 * 
 * Standardized date range calculation used across all dashboards.
 * Matches your existing system approach.
 * 
 * @param {number} days - Number of days back (if no custom dates)
 * @param {string} startDate - Custom start date (optional)
 * @param {string} endDate - Custom end date (optional)
 * @returns {Object} Date range object with formatted strings and description
 */
function calculateDateRange(days, startDate = null, endDate = null) {
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
  
  return { startDateStr, endDateStr, periodDescription };
}

/**
 * Logging: Attribution fix status
 * 
 * Consistent logging format for attribution fix results.
 * 
 * @param {string} context - Context description
 * @param {number} totalRevenue - Total revenue found
 * @param {number} totalContacts - Total contacts found
 * @param {Object} breakdown - Optional breakdown data
 */
function logAttributionStatus(context, totalRevenue, totalContacts, breakdown = null) {
  console.log(`🔧 Tracking Template Fix Applied [${context}]:`);
  console.log(`   💰 Total Revenue: €${totalRevenue.toLocaleString()}`);
  console.log(`   👥 Total Contacts: ${totalContacts.toLocaleString()}`);
  
  if (breakdown) {
    console.log(`   📊 Attribution Breakdown:`);
    console.log(`      Standard Tracking: ${breakdown.standard || 0} contacts`);
    console.log(`      Fixed via Custom Field: ${breakdown.fixed || 0} contacts`);
    console.log(`      📈 Fix Impact: +${breakdown.fixed || 0} contacts recovered`);
  }
}

/**
 * Migration Helper: Update Old Attribution Queries
 * 
 * Helps migrate old simple attribution queries to enhanced version.
 * 
 * @param {string} oldQuery - Old attribution query
 * @returns {string} Updated query with enhanced attribution
 */
function migrateAttributionQuery(oldQuery) {
  // Replace simple attribution with enhanced version
  const simplePattern = /hc\.hs_analytics_source\s*=\s*['"]PAID_SEARCH['"]/g;
  
  if (simplePattern.test(oldQuery)) {
    console.log(`🔄 Migrating simple attribution query to enhanced version...`);
    return oldQuery.replace(simplePattern, buildEnhancedAttributionQuery());
  }
  
  return oldQuery;
}

/**
 * Validation: Check if Enhanced Attribution is Working
 * 
 * Validates that the attribution fix is working correctly.
 * 
 * @param {Function} getDbConnection - Database connection function
 * @param {number} days - Days to check
 * @returns {Object} Validation results
 */
async function validateAttributionFix(getDbConnection, days = 30) {
  const connection = await getDbConnection();
  
  try {
    const { startDateStr, endDateStr } = calculateDateRange(days);
    
    // Check standard vs enhanced attribution counts
    const [simpleCount] = await connection.execute(`
      SELECT COUNT(DISTINCT hc.hubspot_id) as contact_count
      FROM hub_contacts hc
      WHERE hc.hs_analytics_source = 'PAID_SEARCH'
        AND DATE(hc.createdate) >= ? AND DATE(hc.createdate) <= ?
        ${getStandardContactFilters()}
    `, [startDateStr, endDateStr]);
    
    const [enhancedCount] = await connection.execute(`
      SELECT COUNT(DISTINCT hc.hubspot_id) as contact_count
      FROM hub_contacts hc
      WHERE ${buildEnhancedAttributionQuery()}
        AND DATE(hc.createdate) >= ? AND DATE(hc.createdate) <= ?
        ${getStandardContactFilters()}
    `, [startDateStr, endDateStr]);
    
    const simpleContacts = parseInt(simpleCount[0].contact_count) || 0;
    const enhancedContacts = parseInt(enhancedCount[0].contact_count) || 0;
    const contactsRecovered = enhancedContacts - simpleContacts;
    
    return {
      success: true,
      simple_attribution_contacts: simpleContacts,
      enhanced_attribution_contacts: enhancedContacts,
      contacts_recovered: contactsRecovered,
      fix_impact_percentage: simpleContacts > 0 ? 
        ((contactsRecovered / simpleContacts) * 100).toFixed(1) : 0,
      period: `${startDateStr} to ${endDateStr}`,
      is_working: contactsRecovered > 0,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
  } finally {
    await connection.end();
  }
}

// Export all functions
module.exports = {
  // Core attribution functions
  buildEnhancedAttributionQuery,
  buildSimpleAttributionQuery,
  getCampaignAttributionLogic,
  getStandardContactFilters,
  
  // Campaign matching
  buildCampaignMatchingLogic,
  
  // Query builders
  buildTotalRevenueQuery,
  buildAttributionQualityQuery,
  
  // Utilities
  calculateDateRange,
  logAttributionStatus,
  
  // Migration helpers
  migrateAttributionQuery,
  validateAttributionFix
};