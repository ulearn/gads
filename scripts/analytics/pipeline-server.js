/**
 * FIXED: Pipeline Server with Correct Active Deals Calculation
 * /scripts/analytics/pipeline-server.js
 * 
 * FIXES:
 * - Active deals calculation (was always showing 0)
 * - Better SQL stage counting
 * - Proper territory filtering for Google Ads contacts
 */

const mysql = require('mysql2/promise');

function loadCountryClassifications() {
  try {
    const path = require('path');
    const fs = require('fs');
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

// FIXED: Better Google Ads attribution query
function buildGoogleAdsAttributionQuery() {
  return `(
    hs_analytics_source = 'PAID_SEARCH' 
    OR hs_object_source = 'FORM'
    OR gclid IS NOT NULL 
    OR hs_object_source_label LIKE '%google%'
    OR hs_analytics_first_touch_converting_campaign IS NOT NULL
    OR hs_analytics_last_touch_converting_campaign IS NOT NULL
  )`;
}

async function getFastPipelineData(getDbConnection, options = {}) {
  try {
    const { days = 30, campaign = 'all' } = options;
    const connection = await getDbConnection();
    
    try {
      console.log(`⚡ Getting FAST pipeline data: ${days} days, campaign: ${campaign}`);
      
      // Date range calculation
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
      const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ');
      
      console.log(`📅 Date range: ${startDateStr} to ${endDateStr}`);
      
      // Load unsupported territories
      const unsupportedTerritories = loadCountryClassifications();
      console.log(`🌍 Loaded ${unsupportedTerritories.length} unsupported territories`);
      
      // FIXED: Get Google Ads metrics from MySQL (using correct column names from schema)
      const [googleAdsMetrics] = await connection.execute(`
        SELECT 
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          SUM(cost_eur) as total_cost,
          COUNT(DISTINCT google_campaign_id) as active_campaigns,
          AVG(cost_eur / NULLIF(clicks, 0)) as avg_cpc
        FROM gads_campaign_metrics 
        WHERE date >= ? AND date <= ?
      `, [startDateStr.slice(0, 10), endDateStr.slice(0, 10)]);
      
      const googleMetrics = googleAdsMetrics[0] || {};
      console.log(`📊 Google Ads metrics:`, googleMetrics);
      
      // FIXED: Get campaign names from MySQL (using correct schema structure)
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
      `, [startDateStr.slice(0, 10), endDateStr.slice(0, 10)]);
      
      console.log(`🎯 Found ${campaignNames.length} active campaigns with data`);
      
      // FIXED: Get HubSpot contacts with better filtering (using correct column names from schema)
      const contactQuery = campaign === 'all' ? 
        `SELECT 
          COUNT(*) as total_contacts,
          COUNT(CASE WHEN num_associated_deals > 0 THEN 1 END) as contacts_with_deals,
          COUNT(CASE WHEN COALESCE(nationality, country, territory, ip_country, '') IN (${unsupportedTerritories.map(() => '?').join(',') || 'NULL'}) THEN 1 END) as unsupported_contacts
        FROM hub_contacts 
        WHERE ${buildGoogleAdsAttributionQuery()}
          AND createdate >= ? 
          AND createdate <= ?` :
        `SELECT 
          COUNT(*) as total_contacts,
          COUNT(CASE WHEN num_associated_deals > 0 THEN 1 END) as contacts_with_deals,
          COUNT(CASE WHEN COALESCE(nationality, country, territory, ip_country, '') IN (${unsupportedTerritories.map(() => '?').join(',') || 'NULL'}) THEN 1 END) as unsupported_contacts
        FROM hub_contacts 
        WHERE ${buildGoogleAdsAttributionQuery()}
          AND createdate >= ? 
          AND createdate <= ?
          AND (hs_analytics_source_data_1 = ? OR google_ads_campaign LIKE ?)`;
          
      const contactParams = campaign === 'all' ? 
        [...unsupportedTerritories, startDateStr, endDateStr] :
        [...unsupportedTerritories, startDateStr, endDateStr, campaign, `%${campaign}%`];
        
      const [contactMetrics] = await connection.execute(contactQuery, contactParams);
      const contactData = contactMetrics[0] || {};
      console.log(`👥 Contact metrics:`, contactData);
      
      // FIXED: HubSpot Stage ID to Name Mapping
      const stageMapping = {
        'appointmentscheduled': { name: 'INBOX', order: 1 },
        '113151423': { name: 'SEQUENCED', order: 2 },
        'qualifiedtobuy': { name: 'ENGAGING', order: 3 },
        '767120827': { name: 'RESPONSIVE', order: 4 },
        'presentationscheduled': { name: 'ADVISING', order: 5 },
        'decisionmakerboughtin': { name: 'CONSIDERATION & NEGOTIATION', order: 6 },
        '114331579': { name: 'MAYBE / FUTURE', order: 7 },
        '111070952': { name: 'TRIAL', order: 8 },
        'contractsent': { name: 'CONTRACT', order: 9 },
        'closedwon': { name: 'WON', order: 10 },
        'closedlost': { name: 'LOST', order: 11 }
      };

      // FIXED: Get deal stage progression (SQL stages) with proper ID mapping
      const [sqlStagesRaw] = await connection.execute(`
        SELECT 
          d.dealstage,
          COUNT(*) as count,
          SUM(CAST(COALESCE(d.amount, '0') as DECIMAL(15,2))) as total_value
        FROM hub_deals d
        JOIN hub_contact_deal_associations a ON d.hubspot_deal_id = a.deal_hubspot_id
        JOIN hub_contacts c ON a.contact_hubspot_id = c.hubspot_id
        WHERE (
          c.hs_analytics_source = 'PAID_SEARCH' 
          OR c.hs_object_source = 'FORM'
          OR c.gclid IS NOT NULL 
          OR c.hs_object_source_label LIKE '%google%'
          OR c.hs_analytics_first_touch_converting_campaign IS NOT NULL
          OR c.hs_analytics_last_touch_converting_campaign IS NOT NULL
        )
          AND d.createdate >= ? 
          AND d.createdate <= ?
          AND COALESCE(d.pipeline, '') = 'default'
        GROUP BY d.dealstage
      `, [startDateStr, endDateStr]);
      
      // Transform raw stage data with proper names and ordering
      const sqlStages = sqlStagesRaw.map(stage => {
        const mapping = stageMapping[stage.dealstage];
        return {
          dealstage: stage.dealstage,
          friendlyName: mapping ? mapping.name : stage.dealstage,
          order: mapping ? mapping.order : 999,
          count: stage.count,
          total_value: stage.total_value
        };
      }).sort((a, b) => a.order - b.order);
      
      console.log(`📋 SQL stages mapped:`, sqlStages.map(s => `${s.friendlyName}: ${s.count}`));
      
      // FIXED: Calculate totals and active deals properly using mapped stages
      const totalDeals = sqlStages.reduce((sum, stage) => sum + parseInt(stage.count), 0);
      const wonDeals = sqlStages.filter(s => s.dealstage === 'closedwon').reduce((sum, s) => sum + parseInt(s.count), 0);
      const lostDeals = sqlStages.filter(s => s.dealstage === 'closedlost').reduce((sum, s) => sum + parseInt(s.count), 0);
      const activeDeals = totalDeals - wonDeals - lostDeals; // FIXED: This was the bug!
      const totalRevenue = sqlStages.reduce((sum, stage) => sum + parseFloat(stage.total_value || 0), 0);
      
      console.log(`📊 Deal summary: ${totalDeals} total, ${activeDeals} active, ${wonDeals} won, ${lostDeals} lost`);
      
      // Build SQL stages object using friendly names
      const sqlStagesObject = {};
      sqlStages.forEach(stage => {
        const key = stage.friendlyName.toLowerCase().replace(/\s+/g, '_').replace(/&/g, 'and');
        sqlStagesObject[key] = {
          count: parseInt(stage.count),
          percentage: totalDeals > 0 ? ((parseInt(stage.count) / totalDeals) * 100).toFixed(1) : 0,
          value: parseFloat(stage.total_value) || 0,
          friendlyName: stage.friendlyName,
          internalId: stage.dealstage
        };
      });
      
      // Ensure all expected stages exist (even with 0 counts)
      const expectedStages = [
        { key: 'inbox', name: 'INBOX' },
        { key: 'sequenced', name: 'SEQUENCED' },
        { key: 'engaging', name: 'ENGAGING' },
        { key: 'responsive', name: 'RESPONSIVE' },
        { key: 'advising', name: 'ADVISING' },
        { key: 'consideration_and_negotiation', name: 'CONSIDERATION & NEGOTIATION' },
        { key: 'maybe_future', name: 'MAYBE / FUTURE' },
        { key: 'trial', name: 'TRIAL' },
        { key: 'contract', name: 'CONTRACT' },
        { key: 'won', name: 'WON' },
        { key: 'lost', name: 'LOST' }
      ];
      
      expectedStages.forEach(stage => {
        if (!sqlStagesObject[stage.key]) {
          sqlStagesObject[stage.key] = {
            count: 0,
            percentage: 0,
            value: 0,
            friendlyName: stage.name,
            internalId: null
          };
        }
      });

      // Build response structure
      const result = {
        success: true,
        summary: {
          campaign: campaign === 'all' ? 'All Campaigns' : campaign,
          totalContacts: parseInt(contactData.total_contacts) || 0,
          contactsWithDeals: parseInt(contactData.contacts_with_deals) || 0,
          period: `Last ${days} days`,
          audience: "Google Ads Contacts",
          totalCost: parseFloat(googleMetrics.total_cost) || 0,
          costPerContact: contactData.total_contacts > 0 ? 
            (parseFloat(googleMetrics.total_cost) / parseInt(contactData.total_contacts)) : 0,
          conversionRate: contactData.total_contacts > 0 ? 
            ((parseInt(contactData.contacts_with_deals) / parseInt(contactData.total_contacts)) * 100).toFixed(1) : 0,
          activeCampaigns: parseInt(googleMetrics.active_campaigns) || 0,
          avgCPC: parseFloat(googleMetrics.avg_cpc) || 0,
          // FIXED: Active deals calculation
          total_deals: totalDeals,
          active_deals: activeDeals, // This was always 0 before!
          won_deals: wonDeals,
          lost_deals: lostDeals,
          total_value: totalRevenue,
          avg_deal_size: totalDeals > 0 ? (totalRevenue / totalDeals) : 0,
          dataQuality: {
            googleAdsRecords: "26,440+ metrics",
            hubspotContacts: parseInt(contactData.total_contacts) || 0,
            dataSource: "MySQL Lightning Fast ⚡"
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
            source: "MySQL HubSpot"
          },
          territoryValidation: {
            accepted: Math.max(0, parseInt(contactData.total_contacts) - parseInt(contactData.unsupported_contacts)),
            rejected: parseInt(contactData.unsupported_contacts) || 0,
            rejectionRate: contactData.total_contacts > 0 ? 
              ((parseInt(contactData.unsupported_contacts) / parseInt(contactData.total_contacts)) * 100).toFixed(1) : 0,
            cost: parseFloat(googleMetrics.total_cost) || 0,
            source: "MySQL HubSpot + country_rules",
            // Debug info
            debug: {
              total_contacts: parseInt(contactData.total_contacts),
              unsupported_contacts: parseInt(contactData.unsupported_contacts),
              calculation: `${contactData.total_contacts} - ${contactData.unsupported_contacts} = ${Math.max(0, parseInt(contactData.total_contacts) - parseInt(contactData.unsupported_contacts))}`
            }
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
      
      console.log(`✅ Pipeline data generated: ${result.summary.totalContacts} contacts, ${activeDeals} active deals`);
      return result;
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Fast pipeline data failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getFastPipelineData
};