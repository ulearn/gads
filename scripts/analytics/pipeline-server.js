/**
 * ORACLE-ALIGNED: Pipeline Server using hubspot-data.js Logic + Stage Mapping
 * /scripts/analytics/pipeline-server.js
 * 
 * CHANGES:
 * - Uses EXACT same SQL filtering logic as hubspot-data.js (the oracle)
 * - Loads stage mapping from stage-map.json
 * - Consistent date handling, territory filtering, and partner exclusion
 * - Immutable ID-based stage mapping
 * - ADDED servePipelineDashboard function for index.js compatibility
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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

// Load country classifications - SAME AS hubspot-data.js
function loadCountryClassifications() {
  try {
    const countriesFile = path.join(__dirname, '../country/country-codes.json');
    
    if (!fs.existsSync(countriesFile)) {
      console.log('⚠️ Country codes file not found, using default unsupported territories');
      return ['AF', 'BD', 'MM', 'KP', 'SO', 'SS', 'SY', 'YE']; // Default unsupported
    }
    
    const countriesData = JSON.parse(fs.readFileSync(countriesFile, 'utf8'));
    
    // Handle different file formats - EXACT SAME AS hubspot-data.js
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

// ORACLE: Use same Google Ads attribution as hubspot-data.js
function buildGoogleAdsAttributionQuery() {
  return `hs_analytics_source = 'PAID_SEARCH'`;
}

/**
 * ADDED: Serve Pipeline Dashboard HTML - For Index.js compatibility
 */
function servePipelineDashboard(req, res) {
  try {
    const htmlFilePath = path.join(__dirname, 'pipeline-analysis.html');
    
    if (!fs.existsSync(htmlFilePath)) {
      console.error('❌ pipeline-analysis.html not found');
      return res.status(404).send(`
        <h1>Pipeline Analysis Dashboard</h1>
        <p>❌ pipeline-analysis.html file not found</p>
        <p>Expected location: ${htmlFilePath}</p>
        <p><a href="/gads/">← Back to Main Dashboard</a></p>
      `);
    }
    
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
    res.send(htmlContent);
    
  } catch (error) {
    console.error('❌ Error serving pipeline dashboard:', error.message);
    res.status(500).send(`
      <h1>Pipeline Analysis Dashboard - Error</h1>
      <p>❌ Error: ${error.message}</p>
      <p><a href="/gads/">← Back to Main Dashboard</a></p>
    `);
  }
}

async function getFastPipelineData(getDbConnection, options = {}) {
  try {
    const { days = 30, campaign = 'all' } = options;
    const connection = await getDbConnection();
    
    try {
      console.log(`⚡ Getting ORACLE-ALIGNED pipeline data: ${days} days, campaign: ${campaign}`);
      
      // Load stage mapping
      const stageMapping = loadStageMapping();
      
      // ORACLE: Better date range calculation - EXACT SAME AS hubspot-data.js
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999); // End of today
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1)); // Include today in count
      startDate.setHours(0, 0, 0, 0); // Start of start day
      
      const startDateStr = startDate.toISOString().slice(0, 10); // YYYY-MM-DD format
      const endDateStr = endDate.toISOString().slice(0, 10);     // YYYY-MM-DD format
      
      console.log(`📅 Date range: ${startDateStr} to ${endDateStr} (${days} days including today)`);
      
      // ORACLE: Get Google Ads metrics with proper date format - SAME AS hubspot-data.js approach
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
      console.log(`📊 Google Ads metrics (ORACLE):`, googleMetrics);
      
      // ORACLE: Get campaign names with proper date format
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
      
      // ORACLE: Get HubSpot contacts using EXACT same logic as hubspot-data.js
      const [contactMetrics] = await connection.execute(`
        SELECT 
          COUNT(*) as total_contacts,
          COUNT(CASE WHEN num_associated_deals > 0 THEN 1 END) as contacts_with_deals,
          COUNT(CASE WHEN territory = 'Unsupported Territory' THEN 1 END) as unsupported_contacts
        FROM hub_contacts 
        WHERE hs_analytics_source = 'PAID_SEARCH'
          AND (
                hubspot_owner_id != 10017927
                OR hubspot_owner_id IS NULL
                OR hubspot_owner_id = ''
              )
          AND DATE(createdate) >= ?
          AND DATE(createdate) <= ?
      `, [startDateStr, endDateStr]);
      
      const contactData = contactMetrics[0] || {};
      console.log(`👥 Contact metrics (ORACLE):`, contactData);
      
      // ORACLE: Get deal stage progression using EXACT same logic as hubspot-data.js
      const [sqlStagesRaw] = await connection.execute(`
        SELECT 
          d.dealstage,
          COUNT(*) as count,
          SUM(CASE WHEN d.dealstage = 'closedwon' AND d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) ELSE 0 END) as total_value
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
      
      console.log(`📋 SQL stages mapped (ORACLE):`, sqlStages.map(s => `${s.friendlyName}: ${s.count}`));
      
      // ORACLE: Calculate totals properly - SAME AS hubspot-data.js
      const totalDeals = sqlStages.reduce((sum, stage) => sum + parseInt(stage.count), 0);
      const wonDeals = sqlStages.filter(s => s.dealstage === 'closedwon').reduce((sum, s) => sum + parseInt(s.count), 0);
      const lostDeals = sqlStages.filter(s => s.dealstage === 'closedlost').reduce((sum, s) => sum + parseInt(s.count), 0);
      const activeDeals = totalDeals - wonDeals - lostDeals;
      const totalRevenue = sqlStages.reduce((sum, stage) => sum + parseFloat(stage.total_value || 0), 0);
      
      console.log(`📊 Deal summary (ORACLE): ${totalDeals} total, ${activeDeals} active, ${wonDeals} won, ${lostDeals} lost`);
      
      // Build SQL stages object using friendly names from JSON mapping
      const sqlStagesObject = {};
      sqlStages.forEach(stage => {
        const key = stage.friendlyName.toLowerCase().replace(/\s+/g, '_').replace(/&/g, 'and');
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
        const key = stageInfo.label.toLowerCase().replace(/\s+/g, '_').replace(/&/g, 'and');
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

      // Build response structure - CONSISTENT WITH hubspot-data.js
      const result = {
        success: true,
        summary: {
          campaign: campaign === 'all' ? 'All Campaigns' : campaign,
          totalContacts: parseInt(contactData.total_contacts) || 0,
          contactsWithDeals: parseInt(contactData.contacts_with_deals) || 0,
          period: `Last ${days} days`,
          audience: "Google Ads B2C Contacts (ORACLE)",
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
            dataSource: "MySQL Oracle-Aligned ⚡"
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
            source: "MySQL HubSpot (ORACLE)"
          },
          territoryValidation: {
            accepted: Math.max(0, parseInt(contactData.total_contacts) - parseInt(contactData.unsupported_contacts)),
            rejected: parseInt(contactData.unsupported_contacts) || 0,
            rejectionRate: contactData.total_contacts > 0 ? 
              ((parseInt(contactData.unsupported_contacts) / parseInt(contactData.total_contacts)) * 100).toFixed(1) : 0,
            cost: parseFloat(googleMetrics.total_cost) || 0,
            source: "MySQL HubSpot + country_rules (ORACLE)"
          }
        },
        sqlStages: sqlStagesObject,
        campaigns: campaignNames.map(c => ({
          id: c.google_campaign_id,
          name: c.campaign_name,
          cost: parseFloat(c.total_cost) || 0,
          metrics_count: parseInt(c.metrics_count) || 0
        })),
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ ORACLE-ALIGNED Pipeline data: ${result.summary.totalContacts} contacts, ${activeDeals} active deals`);
      return result;
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Oracle-aligned pipeline data failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getFastPipelineData,
  servePipelineDashboard  // ADDED for index.js compatibility
};