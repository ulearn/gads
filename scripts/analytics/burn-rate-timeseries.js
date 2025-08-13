/**
 * Burn Rate Timeseries Analysis Module
 * /scripts/analytics/burn-rate-timeseries.js
 * 
 * BUSINESS LOGIC ONLY - No routing, pure data processing
 * Provides time-series burn rate data with flexible date ranges + nationality breakdown
 */

const mysql = require('mysql2/promise');

/**
 * Get burn rate time-series data with flexible date ranges + nationality breakdown
 */
async function getBurnRateTimeseries(getDbConnection, options = {}) {
  try {
    const {
      days,
      startDate,
      endDate,
      granularity = 'auto' // 'daily', 'weekly', 'auto'
    } = options;

    console.log(`🔥 Getting burn rate timeseries:`, options);

    const connection = await getDbConnection();
    
    try {
      // Calculate date range
      const dateRange = calculateDateRange(days, startDate, endDate);
      console.log(`📅 Date range: ${dateRange.start} to ${dateRange.end} (${dateRange.totalDays} days)`);
      
      // Determine granularity
      const timeGranularity = determineGranularity(granularity, dateRange.totalDays);
      console.log(`📊 Using ${timeGranularity} granularity`);
      
      // Build and execute timeseries query
      const query = buildTimeseriesQuery(timeGranularity);
      const [results] = await connection.execute(query, [dateRange.start, dateRange.end]);
      
      console.log(`✅ Retrieved ${results.length} ${timeGranularity} data points`);
      
      // Get nationality breakdown of burned contacts
      const nationalityBreakdown = await getNationalityBreakdown(connection, dateRange);
      
      // Process and aggregate data
      const processedData = processTimeseriesData(results, timeGranularity, dateRange);
      
      // Calculate summary statistics
      const summary = calculateSummaryStats(processedData, dateRange);
      
      return {
        success: true,
        data: processedData,
        summary: summary,
        nationalityBreakdown: nationalityBreakdown, // NEW: Added nationality data
        metadata: {
          dateRange: dateRange,
          granularity: timeGranularity,
          totalDataPoints: processedData.length,
          dataSource: 'MySQL HubSpot Direct Territory Query',
          methodology: 'Direct HubSpot territory = "Unsupported Territory" count'
        },
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Burn rate timeseries failed:', error.message);
    return {
      success: false,
      error: error.message,
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
  
  // Auto-determine based on range
  if (totalDays <= 31) return 'daily';   // 7-30 days: daily
  if (totalDays <= 90) return 'weekly';  // 60-90 days: weekly
  return 'weekly'; // Default to weekly for longer ranges
}

/**
 * Build timeseries SQL query based on granularity
 */
function buildTimeseriesQuery(granularity) {
  const baseWhere = `
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND (hubspot_owner_id != 10017927 OR hubspot_owner_id IS NULL OR hubspot_owner_id = '')
      AND DATE(createdate) >= ? 
      AND DATE(createdate) <= ?
  `;
  
  if (granularity === 'daily') {
    return `
      SELECT 
        DATE(createdate) as period_date,
        'daily' as granularity,
        COUNT(*) as total_contacts,
        COUNT(CASE WHEN territory = 'Unsupported Territory' THEN 1 END) as unsupported_contacts,
        COUNT(CASE WHEN territory != 'Unsupported Territory' OR territory IS NULL THEN 1 END) as supported_contacts,
        ROUND(
          (COUNT(CASE WHEN territory = 'Unsupported Territory' THEN 1 END) / COUNT(*)) * 100, 
          2
        ) as burn_rate_percentage
      FROM hub_contacts 
      ${baseWhere}
      GROUP BY DATE(createdate)
      ORDER BY period_date
    `;
  } else {
    // Weekly aggregation
    return `
      SELECT 
        DATE_SUB(DATE(createdate), INTERVAL WEEKDAY(DATE(createdate)) DAY) as period_date,
        'weekly' as granularity,
        COUNT(*) as total_contacts,
        COUNT(CASE WHEN territory = 'Unsupported Territory' THEN 1 END) as unsupported_contacts,
        COUNT(CASE WHEN territory != 'Unsupported Territory' OR territory IS NULL THEN 1 END) as supported_contacts,
        ROUND(
          (COUNT(CASE WHEN territory = 'Unsupported Territory' THEN 1 END) / COUNT(*)) * 100, 
          2
        ) as burn_rate_percentage
      FROM hub_contacts 
      ${baseWhere}
      GROUP BY DATE_SUB(DATE(createdate), INTERVAL WEEKDAY(DATE(createdate)) DAY)
      ORDER BY period_date
    `;
  }
}

/**
 * Process and clean timeseries data
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
      ((parseInt(row.supported_contacts) / parseInt(row.total_contacts)) * 100).toFixed(2) : 0
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
 * Get nationality breakdown of burned (unsupported territory) contacts
 */
async function getNationalityBreakdown(connection, dateRange) {
  try {
    console.log(`🌍 Getting nationality breakdown for burned contacts...`);
    
    const [nationalityResults] = await connection.execute(`
      SELECT 
        COALESCE(nationality, 'Unknown') as nationality,
        COUNT(*) as burned_contacts,
        ROUND((COUNT(*) * 25), 2) as estimated_waste_eur
      FROM hub_contacts 
      WHERE hs_analytics_source = 'PAID_SEARCH'
        AND territory = 'Unsupported Territory'
        AND (hubspot_owner_id != 10017927 OR hubspot_owner_id IS NULL OR hubspot_owner_id = '')
        AND DATE(createdate) >= ? 
        AND DATE(createdate) <= ?
      GROUP BY nationality
      ORDER BY burned_contacts DESC
    `, [dateRange.start, dateRange.end]);
    
    const totalBurnedContacts = nationalityResults.reduce((sum, row) => sum + parseInt(row.burned_contacts), 0);
    
    console.log(`✅ Found ${nationalityResults.length} nationalities causing ${totalBurnedContacts} burned contacts`);
    
    return {
      totalBurnedContacts: totalBurnedContacts,
      totalEstimatedWaste: totalBurnedContacts * 25, // €25 estimated cost per contact
      nationalities: nationalityResults.map(row => ({
        nationality: row.nationality,
        burnedContacts: parseInt(row.burned_contacts),
        estimatedWaste: parseFloat(row.estimated_waste_eur),
        percentage: totalBurnedContacts > 0 ? 
          ((parseInt(row.burned_contacts) / totalBurnedContacts) * 100).toFixed(1) : 0
      }))
    };
    
  } catch (error) {
    console.error('❌ Nationality breakdown failed:', error.message);
    return {
      totalBurnedContacts: 0,
      totalEstimatedWaste: 0,
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
    console.log(`🔥 Burn rate timeseries request:`, req.query);
    
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
    
    // Get timeseries data
    const result = await getBurnRateTimeseries(getDbConnection, options);
    
    // Return result
    res.json(result);
    
  } catch (error) {
    console.error('❌ Burn rate timeseries request failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  getBurnRateTimeseries,
  handleBurnRateTimeseriesRequest
};