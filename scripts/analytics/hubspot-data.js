/**
 * ENHANCED: HubSpot Dashboard Data API Module with Attribution Fix
 * /scripts/analytics/hubspot-data.js
 * 
 * ATTRIBUTION FIX APPLIED:
 * - Handles contacts where hs_analytics_source_data_1 = '{campaign}'
 * - Uses custom 'google_ads_campaign' field for correct attribution
 * - Enhanced campaign matching logic throughout all functions
 * 
 * FIXED: Date range to properly include TODAY's deals
 * - Revenue Mode: Filters by deal closedate including today
 * - Pipeline Mode: Filters by contact createdate including today
 */

const fs = require('fs');
const path = require('path');
const pipelineServer = require('./pipeline-server');

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

/**
 * Get effective campaign name for display
 */
function getCampaignNameLogic() {
  return `
    COALESCE(
      NULLIF(hc.google_ads_campaign, ''),
      CASE 
        WHEN hc.hs_analytics_source_data_1 != '{campaign}' 
        THEN hc.hs_analytics_source_data_1
        ELSE 'Unknown Campaign'
      END
    )
  `;
}

/**
 * NEW: Get Google Ads metrics by calling pipeline server (proven to work)
 */
async function getGoogleAdsMetricsFromPipeline(getDbConnection, days = 30) {
  try {
    console.log(`📊 Getting Google Ads metrics from pipeline server for ${days} days...`);
    
    // Import and call the proven pipeline server
    const pipelineServer = require('./pipeline-server');
    const pipelineResult = await pipelineServer.getFastPipelineData(getDbConnection, { days, campaign: 'all' });
    
    if (!pipelineResult.success) {
      throw new Error(`Pipeline server failed: ${pipelineResult.error}`);
    }
    
    const { mqlStages, summary } = pipelineResult;
    
    console.log(`✅ Pipeline data extracted:`, {
      clicks: mqlStages.clicks?.count || 0,
      ctas: mqlStages.ctaComplete?.count || 0,
      impressions: mqlStages.impressions?.count || 0,
      total_cost: summary.totalCost || 0
    });
    
    return {
      success: true,
      metrics: {
        // CARD 1: GAd Clicks - from pipeline mqlStages
        gad_clicks: parseInt(mqlStages.clicks?.count) || 0,
        gad_impressions: parseInt(mqlStages.impressions?.count) || 0,
        gad_cost: parseFloat(summary.totalCost) || 0,
        gad_ctr: parseFloat(mqlStages.clicks?.ctr) || 0,
        
        // CARD 2: GAd CTAs - from pipeline mqlStages  
        gad_ctas: parseInt(mqlStages.ctaComplete?.count) || 0,
        gad_conversion_rate: parseFloat(mqlStages.ctaComplete?.conversionRate) || 0,
        
        // Additional metrics from pipeline
        active_campaigns: parseInt(summary.activeCampaigns) || 0,
        avg_cpc: parseFloat(summary.avgCPC) || 0,
        cost_per_cta: mqlStages.ctaComplete?.count > 0 ? 
          (parseFloat(summary.totalCost) / parseInt(mqlStages.ctaComplete.count)) : 0
      },
      period: summary.period || `Last ${days} days`,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Google Ads metrics from pipeline failed:', error.message);
    return {
      success: false,
      error: error.message,
      metrics: {
        gad_clicks: 0,
        gad_ctas: 0,
        gad_impressions: 0,
        gad_cost: 0,
        gad_ctr: 0,
        gad_conversion_rate: 0,
        active_campaigns: 0,
        avg_cpc: 0,
        cost_per_cta: 0
      },
      timestamp: new Date().toISOString()
    };
  }
}

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
 * Build Google Ads attribution query (enhanced version)
 */
function buildGoogleAdsAttributionQuery() {
  return buildEnhancedAttributionQuery();
}

/**
 * ENHANCED: Get dashboard summary with proper date ranges including TODAY + Attribution Fix
 */
async function getDashboardSummary(getDbConnection, options = {}) {
  try {
    console.log('📊 Starting Enhanced Dashboard Summary (Attribution Fixes Applied)...');
    
    const {
      mode: analysisMode = 'pipeline',
      days = 30,
      startDate = null,
      endDate = null
    } = options;
    
    const connection = await getDbConnection();
    
    try {
      // COPIED FROM ROAS-REVENUE.JS: Calculate date range
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
      
      // NEW: Get Google Ads metrics from proven pipeline server
      const googleAdsResult = await getGoogleAdsMetricsFromPipeline(getDbConnection, { days });
      const googleMetrics = googleAdsResult.metrics || {};
      
      console.log(`📊 Google Ads metrics from pipeline:`, googleMetrics);
      
      // CARD 3: MQLs Created - Enhanced attribution (always filter by contact createdate)
      const [mqlsCreated] = await connection.execute(`
        SELECT COUNT(*) AS contact_count
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
      
      const totalContacts = parseInt(mqlsCreated[0]?.contact_count) || 0;
      console.log(`✅ CARD 3 - MQLs Created (Enhanced Attribution): ${totalContacts}`);
      
      // CARD 4: MQLs Failed - Enhanced attribution (always filter by contact createdate)
      const [mqlsFailed] = await connection.execute(`
        SELECT COUNT(*) AS contact_count
        FROM hub_contacts hc
        WHERE ${buildEnhancedAttributionQuery()}
          AND (
                hc.hubspot_owner_id != 10017927
                OR hc.hubspot_owner_id IS NULL
                OR hc.hubspot_owner_id = ''
              )
          AND hc.territory = 'Unsupported Territory'
          AND DATE(hc.createdate) >= ?
          AND DATE(hc.createdate) <= ?
      `, [startDateStr, endDateStr]);
      
      const failedContacts = parseInt(mqlsFailed[0]?.contact_count) || 0;
      console.log(`✅ CARD 4 - MQLs Failed (Enhanced Attribution): ${failedContacts}`);
      
      // CARD 5: SQLs Passed - Enhanced attribution (always filter by contact createdate)
      const [sqlsPassed] = await connection.execute(`
        SELECT COUNT(*) AS contact_count
        FROM hub_contacts hc
        WHERE ${buildEnhancedAttributionQuery()}
          AND (
                hc.hubspot_owner_id != 10017927
                OR hc.hubspot_owner_id IS NULL
                OR hc.hubspot_owner_id = ''
              )
          AND hc.territory != 'Unsupported Territory'
          AND hc.num_associated_deals > 0
          AND DATE(hc.createdate) >= ?
          AND DATE(hc.createdate) <= ?
      `, [startDateStr, endDateStr]);
      
      const sqlsPassedCount = parseInt(sqlsPassed[0]?.contact_count) || 0;
      console.log(`✅ CARD 5 - SQLs Passed (Enhanced Attribution): ${sqlsPassedCount}`);
      
      // CARD 6: Deals WON/LOST - ENHANCED: Different logic for pipeline vs revenue analysis
      
      let dealResults;
      let dealLogicDescription;
      
      if (analysisMode === 'revenue') {
        // REVENUE MODE: Filter by deal closedate (deals that closed in timeframe)
        dealLogicDescription = `Deals closed ${startDateStr} to ${endDateStr} (any contact create date) - Enhanced Attribution`;
        [dealResults] = await connection.execute(`
          SELECT 
            COUNT(DISTINCT d.hubspot_deal_id) as totalDeals,
            COUNT(CASE WHEN d.dealstage = 'closedwon' THEN d.hubspot_deal_id END) as wonDeals,
            COUNT(CASE WHEN d.dealstage = 'closedlost' THEN d.hubspot_deal_id END) as lostDeals,
            SUM(CASE WHEN d.dealstage = 'closedwon' AND d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) ELSE 0 END) as totalRevenue,
            AVG(CASE WHEN d.dealstage = 'closedwon' AND d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) ELSE NULL END) as avgDealValue
          FROM hub_contact_deal_associations a
          JOIN hub_contacts hc ON a.contact_hubspot_id = hc.hubspot_id
          JOIN hub_deals d ON a.deal_hubspot_id = d.hubspot_deal_id
          WHERE hc.hubspot_owner_id != 10017927
            AND ${buildEnhancedAttributionQuery()}
            AND hc.territory != 'Unsupported Territory'
            AND hc.num_associated_deals > 0
            AND d.pipeline = 'default'
            AND DATE(d.closedate) >= ?
            AND DATE(d.closedate) <= ?
            AND (d.dealstage = 'closedwon' OR d.dealstage = 'closedlost')
        `, [startDateStr, endDateStr]);
        
      } else {
        // PIPELINE MODE: Filter by contact createdate (deals from contacts created in timeframe)
        dealLogicDescription = `Deals from contacts created ${startDateStr} to ${endDateStr} (any deal close date) - Enhanced Attribution`;
        [dealResults] = await connection.execute(`
          SELECT 
            COUNT(DISTINCT d.hubspot_deal_id) as totalDeals,
            COUNT(CASE WHEN d.dealstage = 'closedwon' THEN d.hubspot_deal_id END) as wonDeals,
            COUNT(CASE WHEN d.dealstage = 'closedlost' THEN d.hubspot_deal_id END) as lostDeals,
            SUM(CASE WHEN d.dealstage = 'closedwon' AND d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) ELSE 0 END) as totalRevenue,
            AVG(CASE WHEN d.dealstage = 'closedwon' AND d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) ELSE NULL END) as avgDealValue
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
        `, [startDateStr, endDateStr]);
      }
      
      const deals = dealResults[0] || {};
      console.log(`✅ CARD 6 - ${analysisMode.toUpperCase()} MODE deals (Enhanced Attribution):`, {
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
          // CARD 1 & 2: REAL Google Ads data from pipeline server
          gad_clicks: googleMetrics.gad_clicks || 0,
          gad_ctas: googleMetrics.gad_ctas || 0,
          gad_impressions: googleMetrics.gad_impressions || 0,
          gad_cost: googleMetrics.gad_cost || 0,
          gad_ctr: googleMetrics.gad_ctr || 0,
          gad_conversion_rate: googleMetrics.gad_conversion_rate || 0,

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

          // Additional metrics from pipeline
          uniqueCampaigns: googleMetrics.active_campaigns || 0,
          avgCPC: googleMetrics.avg_cpc || 0,
          costPerCTA: googleMetrics.cost_per_cta || 0
        },
        analysisMode: analysisMode,
        dealLogic: dealLogicDescription,
        dateRange: `${startDateStr} to ${endDateStr}`,
        period: periodDescription,
        attribution_enhancement: 'Applied attribution fix for {campaign} tracking template issue',
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ ${analysisMode.toUpperCase()} MODE summary (Enhanced Attribution):`, {
        period: periodDescription,
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
 * ENHANCED: Get campaign performance with proper date ranges including TODAY + Attribution Fix
 */
async function getCampaignPerformance(getDbConnection, options = {}) {
  try {
    console.log('🎯 Starting Enhanced Campaign Performance (Attribution Fixes Applied)...');
    
    const {
      mode: analysisMode = 'pipeline',
      days = 30,
      startDate = null,
      endDate = null
    } = options;
    
    const connection = await getDbConnection();
    
    try {
      // COPIED FROM ROAS-REVENUE.JS: Calculate date range
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
      
      let campaignResults;
      
      if (analysisMode === 'revenue') {
        // REVENUE MODE: Show campaigns with deals that closed in timeframe
        [campaignResults] = await connection.execute(`
          SELECT 
            ${getCampaignAttributionLogic()} as campaignId,
            ${getCampaignNameLogic()} as campaignName,
            hc.adgroup as adGroup,
            COUNT(DISTINCT hc.hubspot_id) as contacts,
            COUNT(DISTINCT CASE 
              WHEN hc.territory != 'Unsupported Territory' 
              AND hc.num_associated_deals > 0 
              THEN hc.hubspot_id 
            END) as contactsWithDeals,
            COUNT(DISTINCT d.hubspot_deal_id) as totalDeals,
            COUNT(DISTINCT CASE WHEN d.dealstage = 'closedwon' THEN d.hubspot_deal_id END) as wonDeals,
            SUM(CASE WHEN d.dealstage = 'closedwon' AND d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) ELSE 0 END) as revenue
          FROM hub_contacts hc
          LEFT JOIN hub_contact_deal_associations a ON hc.hubspot_id = a.contact_hubspot_id
          LEFT JOIN hub_deals d ON a.deal_hubspot_id = d.hubspot_deal_id 
            AND d.pipeline = 'default'
            AND DATE(d.closedate) >= ?
            AND DATE(d.closedate) <= ?
            AND (d.dealstage = 'closedwon' OR d.dealstage = 'closedlost')
          WHERE ${buildEnhancedAttributionQuery()}
            AND (
                  hc.hubspot_owner_id != 10017927
                  OR hc.hubspot_owner_id IS NULL
                  OR hc.hubspot_owner_id = ''
                )
          GROUP BY ${getCampaignAttributionLogic()}, ${getCampaignNameLogic()}, hc.adgroup
          HAVING totalDeals > 0
          ORDER BY revenue DESC, contacts DESC
          LIMIT 50
        `, [startDateStr, endDateStr]);
        
      } else {
        // PIPELINE MODE: Show campaigns with contacts created in timeframe
        [campaignResults] = await connection.execute(`
          SELECT 
            ${getCampaignAttributionLogic()} as campaignId,
            ${getCampaignNameLogic()} as campaignName,
            hc.adgroup as adGroup,
            COUNT(DISTINCT hc.hubspot_id) as contacts,
            COUNT(DISTINCT CASE 
              WHEN hc.territory != 'Unsupported Territory' 
              AND hc.num_associated_deals > 0 
              THEN hc.hubspot_id 
            END) as contactsWithDeals,
            COUNT(DISTINCT d.hubspot_deal_id) as totalDeals,
            COUNT(DISTINCT CASE WHEN d.dealstage = 'closedwon' THEN d.hubspot_deal_id END) as wonDeals,
            SUM(CASE WHEN d.dealstage = 'closedwon' AND d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) ELSE 0 END) as revenue
          FROM hub_contacts hc
          LEFT JOIN hub_contact_deal_associations a ON hc.hubspot_id = a.contact_hubspot_id
          LEFT JOIN hub_deals d ON a.deal_hubspot_id = d.hubspot_deal_id 
            AND d.pipeline = 'default'
          WHERE ${buildEnhancedAttributionQuery()}
            AND (
                  hc.hubspot_owner_id != 10017927
                  OR hc.hubspot_owner_id IS NULL
                  OR hc.hubspot_owner_id = ''
                )
            AND DATE(hc.createdate) >= ?
            AND DATE(hc.createdate) <= ?
          GROUP BY ${getCampaignAttributionLogic()}, ${getCampaignNameLogic()}, hc.adgroup
          HAVING contacts > 0
          ORDER BY revenue DESC, contacts DESC
          LIMIT 50
        `, [startDateStr, endDateStr]);
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
      
      console.log(`🎯 Found ${campaigns.length} Google Ads B2C campaigns (${analysisMode} mode, Enhanced Attribution)`);
      
      return {
        success: true,
        campaigns: campaigns,
        analysisMode: analysisMode,
        dateRange: `${startDateStr} to ${endDateStr}`,
        period: periodDescription,
        attribution_enhancement: 'Applied attribution fix for {campaign} tracking template issue',
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
 * ENHANCED: Get territory analysis data with corrected date ranges + Attribution Fix
 */
async function getTerritoryAnalysis(getDbConnection, options = {}) {
  try {
    console.log('🌍 Starting Enhanced Territory Analysis (Attribution Fixes Applied)...');
    
    const {
      mode: analysisMode = 'pipeline',
      days = 30,
      startDate = null,
      endDate = null
    } = options;
    
    const connection = await getDbConnection();
    
    try {
      // COPIED FROM ROAS-REVENUE.JS: Calculate date range
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
      
      // Get territory breakdown from Google Ads contacts (always by contact createdate)
      const [territoryResults] = await connection.execute(`
        SELECT 
          COALESCE(hc.territory, 'Unknown/Not Set') as territoryName,
          COUNT(*) as contacts,
          COUNT(CASE 
            WHEN hc.territory != 'Unsupported Territory' 
            AND hc.num_associated_deals > 0 
            THEN 1 
          END) as dealsCreated
        FROM hub_contacts hc
        WHERE ${buildEnhancedAttributionQuery()}
          AND (
                hc.hubspot_owner_id != 10017927
                OR hc.hubspot_owner_id IS NULL
                OR hc.hubspot_owner_id = ''
              )
          AND DATE(hc.createdate) >= ?
          AND DATE(hc.createdate) <= ?
        GROUP BY COALESCE(hc.territory, 'Unknown/Not Set')
        HAVING contacts > 0
        ORDER BY contacts DESC
        LIMIT 20
      `, [startDateStr, endDateStr]);
      
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
        dateRange: `${startDateStr} to ${endDateStr}`,
        period: periodDescription,
        attribution_enhancement: 'Applied attribution fix for {campaign} tracking template issue',
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
 * ENHANCED: Get MQL validation metrics with Attribution Fix
 */
async function getMQLValidationMetrics(getDbConnection, days = 30, analysisMode = 'pipeline') {
  try {
    console.log(`🎯 Getting Google Ads B2C MQL validation metrics for ${days} days (${analysisMode} mode, with attribution fix)...`);
    
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
      attribution_enhancement: 'Applied attribution fix for {campaign} tracking template issue',
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
 * ENHANCED: Test Google Ads attribution logic with Attribution Fix
 */
async function testGoogleAdsAttribution(getDbConnection, days = 7) {
  try {
    const connection = await getDbConnection();
    
    try {
      console.log(`🔍 Testing Google Ads attribution for ${days} days (with attribution fix)...`);
      
      // FIXED: Better date range calculation that definitely includes today
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999); // End of today
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1)); // Include today in count
      startDate.setHours(0, 0, 0, 0); // Start of start day
      
      const startDateStr = startDate.toISOString().slice(0, 10); // YYYY-MM-DD format
      const endDateStr = endDate.toISOString().slice(0, 10);     // YYYY-MM-DD format
      
      const [attributionTest] = await connection.execute(`
        SELECT 
          COUNT(*) as total_contacts_matched,
          COUNT(CASE WHEN hc.hs_analytics_source = 'PAID_SEARCH' THEN 1 END) as paid_search,
          COUNT(CASE 
            WHEN hc.hubspot_owner_id != 10017927 
            OR hc.hubspot_owner_id IS NULL 
            OR hc.hubspot_owner_id = '' 
            THEN 1 
          END) as non_partners,
          COUNT(CASE 
            WHEN hc.territory != 'Unsupported Territory' 
            AND hc.num_associated_deals > 0 
            THEN 1 
          END) as passed_validation,
          COUNT(CASE 
            WHEN hc.hs_analytics_source_data_1 = '{campaign}' 
            THEN 1 
          END) as broken_template_count,
          COUNT(CASE 
            WHEN hc.hs_analytics_source_data_1 = '{campaign}' 
            AND hc.google_ads_campaign IS NOT NULL
            AND hc.google_ads_campaign != ''
            THEN 1 
          END) as fixed_template_count
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
      
      const testResults = attributionTest[0] || {};
      
      console.log(`✅ Attribution Test Results (Enhanced):`, {
        total_matched: testResults.total_contacts_matched,
        broken_template: testResults.broken_template_count,
        fixed_template: testResults.fixed_template_count
      });
      
      return {
        success: true,
        attribution_test: testResults,
        attribution_enhancement: {
          broken_template_contacts: testResults.broken_template_count || 0,
          fixed_template_contacts: testResults.fixed_template_count || 0,
          enhancement_coverage: testResults.broken_template_count > 0 ? 
            ((testResults.fixed_template_count / testResults.broken_template_count) * 100).toFixed(1) + '%' : '100%'
        },
        dateRange: `${startDateStr} to ${endDateStr}`,
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
  buildGoogleAdsAttributionQuery,
  getGoogleAdsMetricsFromPipeline,  // NEW: Export the pipeline-based Google Ads function
  
  // NEW: Export enhanced attribution functions
  buildEnhancedAttributionQuery,
  getCampaignAttributionLogic,
  getCampaignNameLogic
};