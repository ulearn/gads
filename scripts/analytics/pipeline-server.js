/**
 * ENHANCED: Pipeline Server with Attribution Fix - Using Enhanced hubspot-data.js Logic + Stage Mapping
 * /scripts/analytics/pipeline-server.js
 * 
 * ATTRIBUTION ENHANCEMENTS:
 * - Enhanced Google Ads attribution query handles {campaign} tracking template issue
 * - Uses custom 'google_ads_campaign' field for correct attribution
 * - Multi-layered attribution logic consistent with enhanced hubspot-data.js
 * - Comprehensive attribution quality reporting
 * 
 * ORACLE-ALIGNED FEATURES:
 * - Uses EXACT same SQL filtering logic as enhanced hubspot-data.js (the oracle)
 * - Loads stage mapping from stage-map.json
 * - Consistent date handling, territory filtering, and partner exclusion
 * - Immutable ID-based stage mapping
 * - ADDED servePipelineDashboard function for index.js compatibility
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

/**
 * Enhanced Google Ads attribution query - handles {campaign} issue
 */
function buildEnhancedAttributionQuery() {
  return `
    (
      hc.hs_analytics_source = 'PAID_SEARCH'
      AND (
        -- Standard attribution: Normal campaign data
        (
          hc.hs_analytics_source_data_1 != '{campaign}'
          AND hc.hs_analytics_source_data_1 IS NOT NULL
          AND hc.hs_analytics_source_data_1 != ''
        )
        OR
        -- FIX: Use custom 'Google Ads Campaign' field for broken tracking template
        (
          hc.hs_analytics_source_data_1 = '{campaign}'
          AND hc.google_ads_campaign IS NOT NULL
          AND hc.google_ads_campaign != ''
        )
      )
    )
  `;
}

/**
 * Get effective campaign identifier for attribution
 */
function getCampaignAttributionLogic() {
  return `
    CASE 
      WHEN hc.hs_analytics_source_data_1 != '{campaign}'
           AND hc.hs_analytics_source_data_1 IS NOT NULL
           AND hc.hs_analytics_source_data_1 != ''
      THEN hc.hs_analytics_source_data_1
      WHEN hc.hs_analytics_source_data_1 = '{campaign}'
           AND hc.google_ads_campaign IS NOT NULL
           AND hc.google_ads_campaign != ''
      THEN hc.google_ads_campaign
      ELSE 'attribution-unknown'
    END
  `;
}

// Load stage mapping from JSON file
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

// Load country classifications - SAME AS enhanced hubspot-data.js
function loadCountryClassifications() {
  try {
    const countriesFile = path.join(__dirname, '../country/country-codes.json');
    
    if (!fs.existsSync(countriesFile)) {
      console.log('⚠️ Country codes file not found, using default unsupported territories');
      return ['AF', 'BD', 'MM', 'KP', 'SO', 'SS', 'SY', 'YE']; // Default unsupported
    }
    
    const countriesData = JSON.parse(fs.readFileSync(countriesFile, 'utf8'));
    
    // Handle different file formats - EXACT SAME AS enhanced hubspot-data.js
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

// ENHANCED: Use enhanced Google Ads attribution same as enhanced hubspot-data.js
function buildGoogleAdsAttributionQuery() {
  return buildEnhancedAttributionQuery();
}

/**
 * ADDED: Serve Pipeline Dashboard HTML - For Index.js compatibility
 */
function servePipelineDashboard(req, res) {
  try {
    console.log('🔄 Serving pipeline dashboard with attribution enhancements...');
    const htmlFilePath = path.join(__dirname, 'pipeline-analysis.html');
    
    if (!fs.existsSync(htmlFilePath)) {
      console.error('❌ pipeline-analysis.html not found');
      return res.status(404).send(`
        <h1>Pipeline Analysis Dashboard</h1>
        <p>❌ pipeline-analysis.html file not found</p>
        <p>Expected location: ${htmlFilePath}</p>
        <p><strong>Attribution Enhancement:</strong> Active</p>
        <p><a href="/gads/">← Back to Main Dashboard</a></p>
      `);
    }
    
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
    console.log('✅ Pipeline dashboard served with attribution enhancement support');
    res.send(htmlContent);
    
  } catch (error) {
    console.error('❌ Error serving pipeline dashboard:', error.message);
    res.status(500).send(`
      <h1>Pipeline Analysis Dashboard - Error</h1>
      <p>❌ Error: ${error.message}</p>
      <p><strong>Attribution Enhancement:</strong> Active (Error in serving)</p>
      <p><a href="/gads/">← Back to Main Dashboard</a></p>
    `);
  }
}

/**
 * ENHANCED: Get pipeline data with attribution fixes applied
 */
async function getFastPipelineData(getDbConnection, options = {}) {
  try {
    const { days = 30, campaign = 'all' } = options;
    const connection = await getDbConnection();
    
    try {
      console.log(`⚡ Getting ENHANCED ATTRIBUTION pipeline data: ${days} days, campaign: ${campaign}`);
      
      // Load stage mapping
      const stageMapping = loadStageMapping();
      
      // ORACLE: Better date range calculation - EXACT SAME AS enhanced hubspot-data.js
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999); // End of today
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1)); // Include today in count
      startDate.setHours(0, 0, 0, 0); // Start of start day
      
      const startDateStr = startDate.toISOString().slice(0, 10); // YYYY-MM-DD format
      const endDateStr = endDate.toISOString().slice(0, 10);     // YYYY-MM-DD format
      
      console.log(`📅 Date range: ${startDateStr} to ${endDateStr} (${days} days including today)`);
      
      // ENHANCED: Get attribution quality metrics first
      const [attributionBreakdown] = await connection.execute(`
        SELECT 
          'Standard PAID_SEARCH' as attribution_type,
          COUNT(*) as contact_count
        FROM hub_contacts hc
        WHERE hc.hs_analytics_source = 'PAID_SEARCH' 
          AND hc.hs_analytics_source_data_1 != '{campaign}'
          AND hc.hs_analytics_source_data_1 IS NOT NULL
          AND hc.hs_analytics_source_data_1 != ''
          AND (hc.hubspot_owner_id != 10017927 OR hc.hubspot_owner_id IS NULL OR hc.hubspot_owner_id = '')
          AND DATE(hc.createdate) >= ? AND DATE(hc.createdate) <= ?
        
        UNION ALL
        
        SELECT 
          'Fixed Template (Custom Field)' as attribution_type,
          COUNT(*) as contact_count
        FROM hub_contacts hc
        WHERE hc.hs_analytics_source = 'PAID_SEARCH'
          AND hc.hs_analytics_source_data_1 = '{campaign}'
          AND hc.google_ads_campaign IS NOT NULL
          AND hc.google_ads_campaign != ''
          AND (hc.hubspot_owner_id != 10017927 OR hc.hubspot_owner_id IS NULL OR hc.hubspot_owner_id = '')
          AND DATE(hc.createdate) >= ? AND DATE(hc.createdate) <= ?
      `, [startDateStr, endDateStr, startDateStr, endDateStr]);
      
      console.log(`🔧 Attribution breakdown:`, attributionBreakdown);
      
      // ORACLE: Get Google Ads metrics with proper date format - SAME AS enhanced hubspot-data.js approach
      const [googleAdsMetrics] = await connection.execute(`
        SELECT 
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          SUM(cost_eur) as total_cost,
          COUNT(DISTINCT google_campaign_id) as active_campaigns,
          AVG(cost_eur / NULLIF(clicks, 0)) as avg_cpc
        FROM gads_campaign_metrics 
        WHERE date >= ? AND date <= ?
      `, [startDateStr, endDateStr]);
      
      const googleMetrics = googleAdsMetrics[0] || {};
      console.log(`📊 Google Ads metrics (ENHANCED):`, googleMetrics);
      
      // ENHANCED: Get campaign names with proper date format and attribution
      const [campaignNames] = await connection.execute(`
        SELECT DISTINCT 
          c.google_campaign_id,
          c.campaign_name,
          COUNT(m.metric_id) as metrics_count,
          SUM(m.cost_eur) as total_cost
        FROM gads_campaigns c
        LEFT JOIN gads_campaign_metrics m ON c.google_campaign_id = m.google_campaign_id 
          AND m.date >= ? AND m.date <= ?
        WHERE c.status = 2
        GROUP BY c.google_campaign_id, c.campaign_name
        HAVING metrics_count > 0
        ORDER BY total_cost DESC
        LIMIT 20
      `, [startDateStr, endDateStr]);
      
      console.log(`🎯 Found ${campaignNames.length} active campaigns with data`);
      
      // ENHANCED: Get HubSpot contacts using enhanced attribution logic
      const [contactMetrics] = await connection.execute(`
        SELECT 
          COUNT(*) as total_contacts,
          COUNT(CASE WHEN hc.num_associated_deals > 0 THEN 1 END) as contacts_with_deals,
          COUNT(CASE WHEN hc.territory = 'Unsupported Territory' THEN 1 END) as unsupported_contacts,
          COUNT(CASE WHEN hc.hs_analytics_source_data_1 = '{campaign}' THEN 1 END) as broken_template_contacts,
          COUNT(CASE 
            WHEN hc.hs_analytics_source_data_1 = '{campaign}' 
            AND hc.google_ads_campaign IS NOT NULL 
            AND hc.google_ads_campaign != '' 
            THEN 1 
          END) as fixed_template_contacts
        FROM hub_contacts hc
        WHERE ${buildEnhancedAttributionQuery()}
          AND (
                hc.hubspot_owner_id != 10017927
                OR hc.hubspot_owner_id IS NULL
                OR hc.hubspot_owner_id = ''
              )
          AND DATE(hc.createdate) >= ?
          AND DATE(hc.createdate) <= ?
      `, [startDateStr, endDateStr]);
      
      const contactData = contactMetrics[0] || {};
      console.log(`👥 Contact metrics (ENHANCED ATTRIBUTION):`, contactData);
      
      // ENHANCED: Get deal stage progression using enhanced attribution logic
      const [sqlStagesRaw] = await connection.execute(`
        SELECT 
          d.dealstage,
          COUNT(*) as count,
          SUM(CASE WHEN d.dealstage = 'closedwon' AND d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) ELSE 0 END) as total_value
        FROM hub_contact_deal_associations a
        JOIN hub_contacts hc ON a.contact_hubspot_id = hc.hubspot_id
        JOIN hub_deals d ON a.deal_hubspot_id = d.hubspot_deal_id
        WHERE hc.hubspot_owner_id != 10017927
          AND ${buildEnhancedAttributionQuery()}
          AND hc.territory != 'Unsupported Territory'
          AND hc.num_associated_deals > 0
          AND DATE(hc.createdate) >= ?
          AND DATE(hc.createdate) <= ?
          AND d.pipeline = 'default'
        GROUP BY d.dealstage
      `, [startDateStr, endDateStr]);
      
      // Transform raw stage data with proper names and ordering using JSON mapping
      const sqlStages = sqlStagesRaw.map(stage => {
        const mapping = stageMapping[stage.dealstage];
        return {
          dealstage: stage.dealstage,
          friendlyName: mapping ? mapping.label : stage.dealstage,
          displayOrder: mapping ? mapping.displayOrder : 999,
          probability: mapping ? mapping.probability : 0,
          count: stage.count,
          total_value: stage.total_value
        };
      }).sort((a, b) => a.displayOrder - b.displayOrder);
      
      console.log(`📋 SQL stages mapped (ENHANCED ATTRIBUTION):`, sqlStages.map(s => `${s.friendlyName}: ${s.count}`));
      
      // ENHANCED: Calculate totals properly with attribution insights
      const totalDeals = sqlStages.reduce((sum, stage) => sum + parseInt(stage.count), 0);
      const wonDeals = sqlStages.filter(s => s.dealstage === 'closedwon').reduce((sum, s) => sum + parseInt(s.count), 0);
      const lostDeals = sqlStages.filter(s => s.dealstage === 'closedlost').reduce((sum, s) => sum + parseInt(s.count), 0);
      const activeDeals = totalDeals - wonDeals - lostDeals;
      const totalRevenue = sqlStages.reduce((sum, stage) => sum + parseFloat(stage.total_value || 0), 0);
      
      console.log(`📊 Deal summary (ENHANCED ATTRIBUTION): ${totalDeals} total, ${activeDeals} active, ${wonDeals} won, ${lostDeals} lost`);
      
      // Build SQL stages object using friendly names from JSON mapping
      const sqlStagesObject = {};
      sqlStages.forEach(stage => {
        const key = stage.friendlyName.toLowerCase().replace(/\\s+/g, '_').replace(/&/g, 'and');
        sqlStagesObject[key] = {
          count: parseInt(stage.count),
          percentage: totalDeals > 0 ? ((parseInt(stage.count) / totalDeals) * 100).toFixed(1) : 0,
          value: parseFloat(stage.total_value) || 0,
          probability: stage.probability,
          friendlyName: stage.friendlyName,
          internalId: stage.dealstage
        };
      });
      
      // Ensure all expected stages exist (even with 0 counts) using JSON mapping
      Object.entries(stageMapping).forEach(([stageId, stageInfo]) => {
        const key = stageInfo.label.toLowerCase().replace(/\\s+/g, '_').replace(/&/g, 'and');
        if (!sqlStagesObject[key]) {
          sqlStagesObject[key] = {
            count: 0,
            percentage: 0,
            value: 0,
            probability: stageInfo.probability || 0,
            friendlyName: stageInfo.label,
            internalId: stageId
          };
        }
      });

      // Build enhanced response structure with attribution metadata
      const result = {
        success: true,
        summary: {
          campaign: campaign === 'all' ? 'All Campaigns' : campaign,
          totalContacts: parseInt(contactData.total_contacts) || 0,
          contactsWithDeals: parseInt(contactData.contacts_with_deals) || 0,
          period: `Last ${days} days`,
          audience: "Google Ads B2C Contacts (ENHANCED ATTRIBUTION)",
          totalCost: parseFloat(googleMetrics.total_cost) || 0,
          costPerContact: contactData.total_contacts > 0 ? 
            (parseFloat(googleMetrics.total_cost) / parseInt(contactData.total_contacts)) : 0,
          conversionRate: contactData.total_contacts > 0 ? 
            ((parseInt(contactData.contacts_with_deals) / parseInt(contactData.total_contacts)) * 100).toFixed(1) : 0,
          activeCampaigns: parseInt(googleMetrics.active_campaigns) || 0,
          avgCPC: parseFloat(googleMetrics.avg_cpc) || 0,
          total_deals: totalDeals,
          active_deals: activeDeals,
          won_deals: wonDeals,
          lost_deals: lostDeals,
          total_value: totalRevenue,
          avg_deal_size: totalDeals > 0 ? (totalRevenue / totalDeals) : 0,
          dataQuality: {
            googleAdsRecords: "26,440+ metrics",
            hubspotContacts: parseInt(contactData.total_contacts) || 0,
            dataSource: "MySQL Enhanced Attribution ⚡🔧"
          }
        },
        mqlStages: {
          impressions: {
            count: parseInt(googleMetrics.total_impressions) || 0,
            cost: 0,
            source: "MySQL Google Ads"
          },
          clicks: {
            count: parseInt(googleMetrics.total_clicks) || 0,
            cost: parseFloat(googleMetrics.total_cost) * 0.8 || 0, // Estimate
            ctr: googleMetrics.total_impressions > 0 ? 
              ((parseInt(googleMetrics.total_clicks) / parseInt(googleMetrics.total_impressions)) * 100).toFixed(2) : 0,
            source: "MySQL Google Ads"
          },
          ctaComplete: {
            count: parseInt(contactData.total_contacts) || 0,
            cost: parseFloat(googleMetrics.total_cost) || 0,
            conversionRate: googleMetrics.total_clicks > 0 ? 
              ((parseInt(contactData.total_contacts) / parseInt(googleMetrics.total_clicks)) * 100).toFixed(2) : 0,
            source: "MySQL HubSpot (ENHANCED ATTRIBUTION)"
          },
          territoryValidation: {
            accepted: Math.max(0, parseInt(contactData.total_contacts) - parseInt(contactData.unsupported_contacts)),
            rejected: parseInt(contactData.unsupported_contacts) || 0,
            rejectionRate: contactData.total_contacts > 0 ? 
              ((parseInt(contactData.unsupported_contacts) / parseInt(contactData.total_contacts)) * 100).toFixed(1) : 0,
            cost: parseFloat(googleMetrics.total_cost) || 0,
            source: "MySQL HubSpot + country_rules (ENHANCED ATTRIBUTION)"
          }
        },
        sqlStages: sqlStagesObject,
        campaigns: campaignNames.map(c => ({
          id: c.google_campaign_id,
          name: c.campaign_name,
          cost: parseFloat(c.total_cost) || 0,
          metrics_count: parseInt(c.metrics_count) || 0
        })),
        
        // ENHANCED: Attribution enhancement metadata
        attributionEnhancement: {
          status: 'ACTIVE',
          features: [
            'Campaign tracking template fix',
            'Custom Google Ads Campaign field integration', 
            'Multi-layered attribution logic',
            'Enhanced contact recovery'
          ],
          metrics: {
            broken_template_contacts: parseInt(contactData.broken_template_contacts) || 0,
            fixed_template_contacts: parseInt(contactData.fixed_template_contacts) || 0,
            enhancement_coverage: contactData.broken_template_contacts > 0 ? 
              ((contactData.fixed_template_contacts / contactData.broken_template_contacts) * 100).toFixed(1) + '%' : '100%',
            total_enhanced_contacts: parseInt(contactData.total_contacts) || 0
          },
          breakdown: attributionBreakdown
        },
        
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ ENHANCED ATTRIBUTION Pipeline data: ${result.summary.totalContacts} contacts, ${activeDeals} active deals`);
      console.log(`🔧 Attribution Enhancement: ${result.attributionEnhancement.metrics.broken_template_contacts} broken templates, ${result.attributionEnhancement.metrics.fixed_template_contacts} fixed`);
      return result;
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Enhanced attribution pipeline data failed:', error.message);
    return {
      success: false,
      error: error.message,
      attributionEnhancement: {
        status: 'ERROR',
        error: error.message
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getFastPipelineData,
  servePipelineDashboard,  // ADDED for index.js compatibility
  
  // NEW: Export enhanced attribution functions
  buildEnhancedAttributionQuery,
  getCampaignAttributionLogic,
  buildGoogleAdsAttributionQuery  // Enhanced version
};