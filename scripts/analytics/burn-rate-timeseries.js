/**
 * ENHANCED: Burn Rate Timeseries Analysis Module with Attribution Fix
 * /scripts/analytics/burn-rate-timeseries.js
 * 
 * ATTRIBUTION FIXES APPLIED:
 * - Enhanced attribution logic for campaign tracking template fix
 * - Uses custom 'google_ads_campaign' field when hs_analytics_source_data_1 = '{campaign}'
 * - Multi-layered attribution matching consistent with other enhanced files
 * - Maintains burn rate accuracy while fixing attribution gaps
 * 
 * BUSINESS LOGIC ONLY - No routing, pure data processing
 * Provides time-series burn rate data with flexible date ranges + nationality breakdown
 */

const mysql = require('mysql2/promise');

/**
 * ENHANCED: Build Google Ads attribution query with fallback logic
 * This matches the same logic used in other enhanced files
 */
function buildEnhancedGoogleAdsAttributionQuery() {
  return `
    (
      -- Standard PAID_SEARCH attribution (when tracking template works)
      (
        hc.hs_analytics_source = 'PAID_SEARCH' 
        AND hc.hs_analytics_source_data_1 != '{campaign}'
        AND hc.hs_analytics_source_data_1 IS NOT NULL
        AND hc.hs_analytics_source_data_1 != ''
      )
      
      OR
      
      -- ENHANCED: Fixed attribution for broken tracking template
      (
        hc.hs_analytics_source = 'PAID_SEARCH'
        AND hc.hs_analytics_source_data_1 = '{campaign}'
        AND hc.google_ads_campaign IS NOT NULL
        AND hc.google_ads_campaign != ''
      )
      
      OR
      
      -- ENHANCED: Fallback attribution when google_ads_campaign field available
      (
        hc.hs_analytics_source = 'PAID_SEARCH'
        AND hc.google_ads_campaign IS NOT NULL
        AND hc.google_ads_campaign != ''
        AND (
          hc.hs_analytics_source_data_1 IS NULL
          OR hc.hs_analytics_source_data_1 = ''
          OR hc.hs_analytics_source_data_1 = '{campaign}'
        )
      )
    )
  `;
}

/**
 * ENHANCED: Get burn rate time-series data with flexible date ranges + nationality breakdown
 */
async function getBurnRateTimeseries(getDbConnection, options = {}) {
  try {
    const {
      days,
      startDate,
      endDate,
      granularity = 'auto' // 'daily', 'weekly', 'auto'
    } = options;

    console.log(`🔥 Getting ENHANCED burn rate timeseries:`, options);

    const connection = await getDbConnection();
    
    try {
      // Calculate date range
      const dateRange = calculateDateRange(days, startDate, endDate);
      console.log(`📅 Date range: ${dateRange.start} to ${dateRange.end} (${dateRange.totalDays} days)`);
      
      // Determine granularity
      const timeGranularity = determineGranularity(granularity, dateRange.totalDays);
      console.log(`📊 Using ${timeGranularity} granularity with ENHANCED attribution`);
      
      // Get attribution quality metrics first
      console.log(`🔍 Analyzing attribution quality...`);
      const [attributionQuality] = await connection.execute(`
        SELECT 
          COUNT(CASE 
            WHEN hc.hs_analytics_source = 'PAID_SEARCH' 
            AND hc.hs_analytics_source_data_1 != '{campaign}'
            AND hc.hs_analytics_source_data_1 IS NOT NULL
            AND hc.hs_analytics_source_data_1 != ''
            THEN 1 
          END) as standard_attribution,
          COUNT(CASE 
            WHEN hc.hs_analytics_source = 'PAID_SEARCH'
            AND hc.hs_analytics_source_data_1 = '{campaign}'
            AND hc.google_ads_campaign IS NOT NULL
            AND hc.google_ads_campaign != ''
            THEN 1 
          END) as enhanced_attribution,
          COUNT(CASE 
            WHEN hc.hs_analytics_source = 'PAID_SEARCH'
            AND hc.hs_analytics_source_data_1 = '{campaign}'
            THEN 1 
          END) as broken_template_count,
          COUNT(*) as total_google_ads_contacts
        FROM hub_contacts hc
        WHERE ${buildEnhancedGoogleAdsAttributionQuery()}
          AND (hc.hubspot_owner_id != 10017927 OR hc.hubspot_owner_id IS NULL OR hc.hubspot_owner_id = '')
          AND DATE(hc.createdate) >= ? AND DATE(hc.createdate) <= ?
      `, [dateRange.start, dateRange.end]);
      
      const attrQuality = attributionQuality[0] || {};
      console.log(`🔧 Attribution Quality Analysis:`, {
        standard: attrQuality.standard_attribution || 0,
        enhanced: attrQuality.enhanced_attribution || 0,
        broken_templates: attrQuality.broken_template_count || 0,
        total_google_ads: attrQuality.total_google_ads_contacts || 0,
        enhancement_recovery: attrQuality.broken_template_count > 0 ? 
          `${((attrQuality.enhanced_attribution / attrQuality.broken_template_count) * 100).toFixed(1)}%` : '100%'
      });
      
      // Build and execute enhanced timeseries query
      const query = buildEnhancedTimeseriesQuery(timeGranularity);
      const [results] = await connection.execute(query, [dateRange.start, dateRange.end]);
      
      console.log(`✅ Retrieved ${results.length} ${timeGranularity} data points using enhanced attribution`);
      
      // Get nationality breakdown of burned contacts (also enhanced)
      const nationalityBreakdown = await getEnhancedNationalityBreakdown(connection, dateRange);
      
      // Process and aggregate data
      const processedData = processTimeseriesData(results, timeGranularity, dateRange);
      
      // Calculate summary statistics
      const summary = calculateSummaryStats(processedData, dateRange);
      
      return {
        success: true,
        data: processedData,
        summary: summary,
        nationalityBreakdown: nationalityBreakdown,
        attribution_enhancement: {
          status: 'ACTIVE',
          features: [
            'Enhanced Google Ads attribution with {campaign} fix',
            'Multi-layered attribution matching',
            'Burn rate analysis enhancement',
            'Attribution quality reporting'
          ],
          quality_metrics: {
            standard_attribution: parseInt(attrQuality.standard_attribution) || 0,
            enhanced_attribution: parseInt(attrQuality.enhanced_attribution) || 0,
            broken_template_count: parseInt(attrQuality.broken_template_count) || 0,
            total_contacts: parseInt(attrQuality.total_google_ads_contacts) || 0,
            enhancement_coverage: attrQuality.broken_template_count > 0 ? 
              ((attrQuality.enhanced_attribution / attrQuality.broken_template_count) * 100).toFixed(1) + '%' : '100%'
          }
        },
        metadata: {
          dateRange: dateRange,
          granularity: timeGranularity,
          totalDataPoints: processedData.length,
          dataSource: 'MySQL HubSpot Enhanced Attribution Territory Query',
          methodology: 'Enhanced Google Ads Attribution + Direct HubSpot territory = "Unsupported Territory" count',
          attribution_method: 'enhanced_multi_layered_google_ads_attribution',
          enhancement_notes: [
            'Includes contacts with broken {campaign} tracking template',
            'Uses custom google_ads_campaign field for attribution recovery',
            'Multi-layered Google Ads attribution matching applied',
            'Attribution quality metrics included'
          ]
        },
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Enhanced burn rate timeseries failed:', error.message);
    return {
      success: false,
      error: error.message,
      attribution_enhancement: {
        status: 'ERROR',
        error: error.message
      },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Calculate flexible date ranges
 */
function calculateDateRange(days, startDate, endDate) {
  let start, end;
  
  if (startDate && endDate) {
    // Custom date range
    start = new Date(startDate);
    end = new Date(endDate);
  } else if (days) {
    // Days back from today
    end = new Date();
    end.setHours(23, 59, 59, 999);
    
    start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
  } else {
    // Default: last 30 days
    end = new Date();
    end.setHours(23, 59, 59, 999);
    
    start = new Date();
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }
  
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  
  return {
    start: start.toISOString().slice(0, 10), // YYYY-MM-DD
    end: end.toISOString().slice(0, 10),     // YYYY-MM-DD
    totalDays: totalDays,
    startObj: start,
    endObj: end
  };
}

/**
 * Determine optimal granularity based on date range
 */
function determineGranularity(granularity, totalDays) {
  if (granularity === 'daily') return 'daily';
  if (granularity === 'weekly') return 'weekly';
  if (granularity === 'monthly') return 'monthly';

  // Auto-determine based on range
  if (totalDays <= 31) return 'daily';   // 7-30 days: daily
  if (totalDays <= 90) return 'weekly';  // 60-90 days: weekly
  return 'monthly'; // Default to monthly for longer ranges (>90 days)
}

/**
 * ENHANCED: Build timeseries SQL query with enhanced attribution
 */
function buildEnhancedTimeseriesQuery(granularity) {
  const baseWhere = `
    WHERE ${buildEnhancedGoogleAdsAttributionQuery()}
      AND (hc.hubspot_owner_id != 10017927 OR hc.hubspot_owner_id IS NULL OR hc.hubspot_owner_id = '')
      AND DATE(hc.createdate) >= ? 
      AND DATE(hc.createdate) <= ?
  `;
  
  if (granularity === 'daily') {
    return `
      SELECT 
        DATE(hc.createdate) as period_date,
        'daily' as granularity,
        COUNT(*) as total_contacts,
        COUNT(CASE WHEN hc.territory = 'Unsupported Territory' THEN 1 END) as unsupported_contacts,
        COUNT(CASE WHEN hc.territory != 'Unsupported Territory' OR hc.territory IS NULL THEN 1 END) as supported_contacts,
        ROUND(
          (COUNT(CASE WHEN hc.territory = 'Unsupported Territory' THEN 1 END) / COUNT(*)) * 100, 
          2
        ) as burn_rate_percentage,
        -- Enhanced attribution breakdown per day
        COUNT(CASE 
          WHEN hc.hs_analytics_source = 'PAID_SEARCH' 
          AND hc.hs_analytics_source_data_1 != '{campaign}'
          AND hc.hs_analytics_source_data_1 IS NOT NULL
          AND hc.hs_analytics_source_data_1 != ''
          THEN 1 
        END) as standard_attribution_count,
        COUNT(CASE 
          WHEN hc.hs_analytics_source = 'PAID_SEARCH'
          AND hc.hs_analytics_source_data_1 = '{campaign}'
          AND hc.google_ads_campaign IS NOT NULL
          AND hc.google_ads_campaign != ''
          THEN 1 
        END) as enhanced_attribution_count
      FROM hub_contacts hc
      ${baseWhere}
      GROUP BY DATE(hc.createdate)
      ORDER BY period_date
    `;
  } else if (granularity === 'monthly') {
    // Monthly aggregation
    return `
      SELECT
        DATE_FORMAT(DATE(hc.createdate), '%Y-%m-01') as period_date,
        'monthly' as granularity,
        COUNT(*) as total_contacts,
        COUNT(CASE WHEN hc.territory = 'Unsupported Territory' THEN 1 END) as unsupported_contacts,
        COUNT(CASE WHEN hc.territory != 'Unsupported Territory' OR hc.territory IS NULL THEN 1 END) as supported_contacts,
        ROUND(
          (COUNT(CASE WHEN hc.territory = 'Unsupported Territory' THEN 1 END) / COUNT(*)) * 100,
          2
        ) as burn_rate_percentage,
        -- Enhanced attribution breakdown per month
        COUNT(CASE
          WHEN hc.hs_analytics_source = 'PAID_SEARCH'
          AND hc.hs_analytics_source_data_1 != '{campaign}'
          AND hc.hs_analytics_source_data_1 IS NOT NULL
          AND hc.hs_analytics_source_data_1 != ''
          THEN 1
        END) as standard_attribution_count,
        COUNT(CASE
          WHEN hc.hs_analytics_source = 'PAID_SEARCH'
          AND hc.hs_analytics_source_data_1 = '{campaign}'
          AND hc.google_ads_campaign IS NOT NULL
          AND hc.google_ads_campaign != ''
          THEN 1
        END) as enhanced_attribution_count
      FROM hub_contacts hc
      ${baseWhere}
      GROUP BY DATE_FORMAT(DATE(hc.createdate), '%Y-%m-01')
      ORDER BY period_date
    `;
  } else {
    // Weekly aggregation
    return `
      SELECT
        DATE_SUB(DATE(hc.createdate), INTERVAL WEEKDAY(DATE(hc.createdate)) DAY) as period_date,
        'weekly' as granularity,
        COUNT(*) as total_contacts,
        COUNT(CASE WHEN hc.territory = 'Unsupported Territory' THEN 1 END) as unsupported_contacts,
        COUNT(CASE WHEN hc.territory != 'Unsupported Territory' OR hc.territory IS NULL THEN 1 END) as supported_contacts,
        ROUND(
          (COUNT(CASE WHEN hc.territory = 'Unsupported Territory' THEN 1 END) / COUNT(*)) * 100,
          2
        ) as burn_rate_percentage,
        -- Enhanced attribution breakdown per week
        COUNT(CASE
          WHEN hc.hs_analytics_source = 'PAID_SEARCH'
          AND hc.hs_analytics_source_data_1 != '{campaign}'
          AND hc.hs_analytics_source_data_1 IS NOT NULL
          AND hc.hs_analytics_source_data_1 != ''
          THEN 1
        END) as standard_attribution_count,
        COUNT(CASE
          WHEN hc.hs_analytics_source = 'PAID_SEARCH'
          AND hc.hs_analytics_source_data_1 = '{campaign}'
          AND hc.google_ads_campaign IS NOT NULL
          AND hc.google_ads_campaign != ''
          THEN 1
        END) as enhanced_attribution_count
      FROM hub_contacts hc
      ${baseWhere}
      GROUP BY DATE_SUB(DATE(hc.createdate), INTERVAL WEEKDAY(DATE(hc.createdate)) DAY)
      ORDER BY period_date
    `;
  }
}

/**
 * ENHANCED: Process and clean timeseries data with attribution metrics
 */
function processTimeseriesData(results, granularity, dateRange) {
  return results.map(row => ({
    date: row.period_date,
    period: granularity,
    totalContacts: parseInt(row.total_contacts) || 0,
    supportedContacts: parseInt(row.supported_contacts) || 0,
    unsupportedContacts: parseInt(row.unsupported_contacts) || 0,
    burnRatePercentage: parseFloat(row.burn_rate_percentage) || 0,
    // Additional calculated fields
    supportedRatePercentage: row.total_contacts > 0 ? 
      ((parseInt(row.supported_contacts) / parseInt(row.total_contacts)) * 100).toFixed(2) : 0,
    // Enhanced attribution metrics per period
    attribution_breakdown: {
      standard_count: parseInt(row.standard_attribution_count) || 0,
      enhanced_count: parseInt(row.enhanced_attribution_count) || 0,
      total_attributed: (parseInt(row.standard_attribution_count) || 0) + (parseInt(row.enhanced_attribution_count) || 0),
      enhancement_percentage: ((parseInt(row.standard_attribution_count) || 0) + (parseInt(row.enhanced_attribution_count) || 0)) > 0 ?
        (((parseInt(row.enhanced_attribution_count) || 0) / 
          ((parseInt(row.standard_attribution_count) || 0) + (parseInt(row.enhanced_attribution_count) || 0))) * 100).toFixed(1) : '0'
    }
  }));
}

/**
 * Calculate summary statistics
 */
function calculateSummaryStats(data, dateRange) {
  const totalContacts = data.reduce((sum, d) => sum + d.totalContacts, 0);
  const totalUnsupported = data.reduce((sum, d) => sum + d.unsupportedContacts, 0);
  const totalSupported = data.reduce((sum, d) => sum + d.supportedContacts, 0);
  
  const avgBurnRate = data.length > 0 ? 
    (data.reduce((sum, d) => sum + d.burnRatePercentage, 0) / data.length) : 0;
  
  const maxBurnRate = data.length > 0 ? 
    Math.max(...data.map(d => d.burnRatePercentage)) : 0;
  
  const minBurnRate = data.length > 0 ? 
    Math.min(...data.map(d => d.burnRatePercentage)) : 0;
  
  // Trend calculation (simple linear trend)
  const trend = calculateTrend(data);
  
  // Enhanced attribution summary
  const totalStandardAttribution = data.reduce((sum, d) => sum + d.attribution_breakdown.standard_count, 0);
  const totalEnhancedAttribution = data.reduce((sum, d) => sum + d.attribution_breakdown.enhanced_count, 0);
  
  return {
    totalContacts,
    totalSupported,
    totalUnsupported,
    overallBurnRate: totalContacts > 0 ? ((totalUnsupported / totalContacts) * 100) : 0,
    avgDailyBurnRate: avgBurnRate,
    maxBurnRate,
    minBurnRate,
    trend: trend,
    period: {
      start: dateRange.start,
      end: dateRange.end,
      days: dateRange.totalDays
    },
    // Enhanced attribution summary
    attribution_summary: {
      standard_total: totalStandardAttribution,
      enhanced_total: totalEnhancedAttribution,
      total_attributed: totalStandardAttribution + totalEnhancedAttribution,
      enhancement_percentage: (totalStandardAttribution + totalEnhancedAttribution) > 0 ?
        ((totalEnhancedAttribution / (totalStandardAttribution + totalEnhancedAttribution)) * 100).toFixed(1) : '0'
    }
  };
}

/**
 * Calculate simple trend direction
 */
function calculateTrend(data) {
  if (data.length < 2) return { direction: 'stable', change: 0 };
  
  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));
  
  const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.burnRatePercentage, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d.burnRatePercentage, 0) / secondHalf.length;
  
  const change = secondHalfAvg - firstHalfAvg;
  
  let direction = 'stable';
  if (change > 1) direction = 'increasing';
  else if (change < -1) direction = 'decreasing';
  
  return {
    direction,
    change: change.toFixed(2),
    firstHalfAvg: firstHalfAvg.toFixed(2),
    secondHalfAvg: secondHalfAvg.toFixed(2)
  };
}

/**
 * ENHANCED: Get nationality breakdown of burned (unsupported territory) contacts with enhanced attribution
 */
async function getEnhancedNationalityBreakdown(connection, dateRange) {
  try {
    console.log(`🌍 Getting nationality breakdown for burned contacts with enhanced attribution...`);
    
    const [nationalityResults] = await connection.execute(`
      SELECT 
        COALESCE(hc.nationality, 'Unknown') as nationality,
        COUNT(*) as burned_contacts,
        ROUND((COUNT(*) * 25), 2) as estimated_waste_eur,
        -- Enhanced attribution breakdown by nationality
        COUNT(CASE 
          WHEN hc.hs_analytics_source = 'PAID_SEARCH' 
          AND hc.hs_analytics_source_data_1 != '{campaign}'
          AND hc.hs_analytics_source_data_1 IS NOT NULL
          AND hc.hs_analytics_source_data_1 != ''
          THEN 1 
        END) as standard_attribution_count,
        COUNT(CASE 
          WHEN hc.hs_analytics_source = 'PAID_SEARCH'
          AND hc.hs_analytics_source_data_1 = '{campaign}'
          AND hc.google_ads_campaign IS NOT NULL
          AND hc.google_ads_campaign != ''
          THEN 1 
        END) as enhanced_attribution_count
      FROM hub_contacts hc
      WHERE ${buildEnhancedGoogleAdsAttributionQuery()}
        AND hc.territory = 'Unsupported Territory'
        AND (hc.hubspot_owner_id != 10017927 OR hc.hubspot_owner_id IS NULL OR hc.hubspot_owner_id = '')
        AND DATE(hc.createdate) >= ? 
        AND DATE(hc.createdate) <= ?
      GROUP BY hc.nationality
      ORDER BY burned_contacts DESC
    `, [dateRange.start, dateRange.end]);
    
    const totalBurnedContacts = nationalityResults.reduce((sum, row) => sum + parseInt(row.burned_contacts), 0);
    const totalStandardAttribution = nationalityResults.reduce((sum, row) => sum + parseInt(row.standard_attribution_count), 0);
    const totalEnhancedAttribution = nationalityResults.reduce((sum, row) => sum + parseInt(row.enhanced_attribution_count), 0);
    
    console.log(`✅ Found ${nationalityResults.length} nationalities causing ${totalBurnedContacts} burned contacts`);
    console.log(`🔧 Attribution breakdown: ${totalStandardAttribution} standard, ${totalEnhancedAttribution} enhanced`);
    
    return {
      totalBurnedContacts: totalBurnedContacts,
      totalEstimatedWaste: totalBurnedContacts * 25, // €25 estimated cost per contact
      attribution_breakdown: {
        standard_total: totalStandardAttribution,
        enhanced_total: totalEnhancedAttribution,
        total_attributed: totalStandardAttribution + totalEnhancedAttribution,
        enhancement_percentage: (totalStandardAttribution + totalEnhancedAttribution) > 0 ?
          ((totalEnhancedAttribution / (totalStandardAttribution + totalEnhancedAttribution)) * 100).toFixed(1) : '0'
      },
      nationalities: nationalityResults.map(row => ({
        nationality: row.nationality,
        burnedContacts: parseInt(row.burned_contacts),
        estimatedWaste: parseFloat(row.estimated_waste_eur),
        percentage: totalBurnedContacts > 0 ? 
          ((parseInt(row.burned_contacts) / totalBurnedContacts) * 100).toFixed(1) : 0,
        attribution_breakdown: {
          standard_count: parseInt(row.standard_attribution_count) || 0,
          enhanced_count: parseInt(row.enhanced_attribution_count) || 0,
          total_attributed: (parseInt(row.standard_attribution_count) || 0) + (parseInt(row.enhanced_attribution_count) || 0),
          enhancement_percentage: ((parseInt(row.standard_attribution_count) || 0) + (parseInt(row.enhanced_attribution_count) || 0)) > 0 ?
            (((parseInt(row.enhanced_attribution_count) || 0) / 
              ((parseInt(row.standard_attribution_count) || 0) + (parseInt(row.enhanced_attribution_count) || 0))) * 100).toFixed(1) : '0'
        }
      }))
    };
    
  } catch (error) {
    console.error('❌ Enhanced nationality breakdown failed:', error.message);
    return {
      totalBurnedContacts: 0,
      totalEstimatedWaste: 0,
      attribution_breakdown: {
        standard_total: 0,
        enhanced_total: 0,
        total_attributed: 0,
        enhancement_percentage: '0'
      },
      nationalities: [],
      error: error.message
    };
  }
}

/**
 * Handle HTTP request for burn rate timeseries (for index.js routing)
 */
async function handleBurnRateTimeseriesRequest(req, res, getDbConnection) {
  try {
    console.log(`🔥 Enhanced burn rate timeseries request:`, req.query);
    
    // Extract and validate parameters
    const options = {
      days: req.query.days ? parseInt(req.query.days) : null,
      startDate: req.query.start || null,
      endDate: req.query.end || null,
      granularity: req.query.granularity || 'auto'
    };
    
    // Validate parameters
    if (options.days && (options.days < 1 || options.days > 365)) {
      return res.status(400).json({
        success: false,
        error: 'Days parameter must be between 1 and 365',
        timestamp: new Date().toISOString()
      });
    }
    
    if (options.startDate && options.endDate) {
      const start = new Date(options.startDate);
      const end = new Date(options.endDate);
      
      if (isNaN(start) || isNaN(end)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
          timestamp: new Date().toISOString()
        });
      }
      
      if (start > end) {
        return res.status(400).json({
          success: false,
          error: 'Start date must be before end date',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Get enhanced timeseries data
    const result = await getBurnRateTimeseries(getDbConnection, options);
    
    // Return result
    res.json(result);
    
  } catch (error) {
    console.error('❌ Enhanced burn rate timeseries request failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      attribution_enhancement: {
        status: 'ERROR',
        error: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  getBurnRateTimeseries,
  handleBurnRateTimeseriesRequest,
  // Export enhanced attribution functions for consistency
  buildEnhancedGoogleAdsAttributionQuery
};