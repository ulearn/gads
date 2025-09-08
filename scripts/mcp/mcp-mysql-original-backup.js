const mysql = require('mysql2/promise');
const path = require('path');

// Ensure environment variables are loaded
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/** ---------- Small util for timestamped logs ---------- */
const log = (...args) => console.log(new Date().toISOString(), ...args);

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
};

/**
 * Get database connection
 */
async function getDbConnection() {
  return await mysql.createConnection(dbConfig);
}

/**
 * Get pipeline analysis from HubSpot data in MySQL
 */
async function getPipelineAnalysis({ days = 30 }) {
  log('📈 Pipeline Analysis called:', { days });
  
  try {
    const connection = await getDbConnection();
    
    try {
      // Get pipeline stage progression data using proper schema
      const pipelineQuery = `
        SELECT 
          d.dealstage,
          COUNT(*) as deal_count,
          AVG(CAST(d.amount as DECIMAL(15,2))) as avg_amount,
          SUM(CAST(d.amount as DECIMAL(15,2))) as total_amount
        FROM hub_contact_deal_associations a
        JOIN hub_contacts c ON a.contact_hubspot_id = c.hubspot_id
        JOIN hub_deals d ON a.deal_hubspot_id = d.hubspot_deal_id
        WHERE c.hubspot_owner_id != 10017927
          AND c.hs_analytics_source = 'PAID_SEARCH'
          AND c.createdate >= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND d.dealstage IS NOT NULL
          AND d.dealstage != ''
          AND d.pipeline = 'default'
        GROUP BY d.dealstage
        ORDER BY deal_count DESC
      `;
      
      const [pipelineResults] = await connection.execute(pipelineQuery, [days]);
      
      // Get territory breakdown from contacts
      const territoryQuery = `
        SELECT 
          c.territory,
          COUNT(DISTINCT c.hubspot_id) as contact_count,
          COUNT(DISTINCT d.hubspot_deal_id) as deal_count,
          AVG(CASE WHEN d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) END) as avg_amount,
          SUM(CASE WHEN d.amount IS NOT NULL THEN CAST(d.amount as DECIMAL(15,2)) ELSE 0 END) as total_amount
        FROM hub_contacts c
        LEFT JOIN hub_contact_deal_associations a ON c.hubspot_id = a.contact_hubspot_id
        LEFT JOIN hub_deals d ON a.deal_hubspot_id = d.hubspot_deal_id AND d.pipeline = 'default'
        WHERE c.hs_analytics_source = 'PAID_SEARCH'
          AND c.createdate >= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND c.territory IS NOT NULL
        GROUP BY c.territory
        ORDER BY contact_count DESC
        LIMIT 10
      `;
      
      const [territoryResults] = await connection.execute(territoryQuery, [days]);
      
      const reportText = `# 📈 Pipeline Analysis (Last ${days} days)

## 🎯 Pipeline Stage Breakdown
${pipelineResults.map(stage => `
### ${stage.dealstage}
- **Deal Count:** ${stage.deal_count}
- **Average Amount:** €${(stage.avg_amount || 0).toFixed(2)}
- **Total Amount:** €${(stage.total_amount || 0).toFixed(2)}
`).join('')}

## 🌍 Territory Performance
${territoryResults.map(territory => `
### ${territory.country || 'Unknown'}
- **Deal Count:** ${territory.deal_count}
- **Average Amount:** €${(territory.avg_amount || 0).toFixed(2)}
- **Total Amount:** €${(territory.total_amount || 0).toFixed(2)}
`).join('')}

*Generated: ${new Date().toISOString()}*`;

      log('✅ Pipeline analysis completed successfully');
      
      return {
        success: true,
        data: {
          pipeline_stages: pipelineResults,
          territories: territoryResults,
          date_range: `${days} days`
        },
        report: reportText
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    log('❌ Pipeline analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      report: `❌ **Error getting pipeline analysis:**\n\n${error.message}\n\nPlease check your database connection.`
    };
  }
}

/**
 * Get burn rate analysis (MQLs that don't become SQLs)
 */
async function getBurnRateAnalysis({ days = 30 }) {
  log('🔥 Burn Rate Analysis called:', { days });
  
  try {
    const connection = await getDbConnection();
    
    try {
      // Get MQL to SQL conversion data using proper schema
      const burnRateQuery = `
        SELECT 
          DATE(c.createdate) as date,
          COUNT(*) as total_mqls,
          COUNT(CASE WHEN a.contact_hubspot_id IS NOT NULL THEN 1 END) as converted_sqls,
          (COUNT(*) - COUNT(CASE WHEN a.contact_hubspot_id IS NOT NULL THEN 1 END)) as burned_mqls,
          ROUND((COUNT(*) - COUNT(CASE WHEN a.contact_hubspot_id IS NOT NULL THEN 1 END)) / COUNT(*) * 100, 2) as burn_rate_percent
        FROM hub_contacts c
        LEFT JOIN hub_contact_deal_associations a ON c.hubspot_id = a.contact_hubspot_id
        WHERE c.createdate >= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND c.hs_analytics_source = 'PAID_SEARCH'
          AND c.hubspot_owner_id != 10017927
        GROUP BY DATE(c.createdate)
        ORDER BY date DESC
      `;
      
      const [burnResults] = await connection.execute(burnRateQuery, [days]);
      
      // Get territory-based burn rate
      const territoryBurnQuery = `
        SELECT 
          c.territory,
          COUNT(*) as total_mqls,
          COUNT(CASE WHEN a.contact_hubspot_id IS NOT NULL THEN 1 END) as converted_sqls,
          (COUNT(*) - COUNT(CASE WHEN a.contact_hubspot_id IS NOT NULL THEN 1 END)) as burned_mqls,
          ROUND((COUNT(*) - COUNT(CASE WHEN a.contact_hubspot_id IS NOT NULL THEN 1 END)) / COUNT(*) * 100, 2) as burn_rate_percent
        FROM hub_contacts c
        LEFT JOIN hub_contact_deal_associations a ON c.hubspot_id = a.contact_hubspot_id
        WHERE c.createdate >= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND c.hs_analytics_source = 'PAID_SEARCH'
          AND c.hubspot_owner_id != 10017927
          AND c.territory IS NOT NULL
        GROUP BY c.territory
        HAVING total_mqls > 5
        ORDER BY burn_rate_percent DESC
        LIMIT 15
      `;
      
      const [territoryBurnResults] = await connection.execute(territoryBurnQuery, [days]);
      
      const totalMQLs = burnResults.reduce((sum, row) => sum + row.total_mqls, 0);
      const totalSQLs = burnResults.reduce((sum, row) => sum + row.converted_sqls, 0);
      const overallBurnRate = totalMQLs > 0 ? ((totalMQLs - totalSQLs) / totalMQLs * 100).toFixed(2) : 0;
      
      const reportText = `# 🔥 Burn Rate Analysis (Last ${days} days)

## 📊 Overall Performance
- **Total MQLs:** ${totalMQLs.toLocaleString()}
- **Converted SQLs:** ${totalSQLs.toLocaleString()}
- **Burned MQLs:** ${(totalMQLs - totalSQLs).toLocaleString()}
- **Overall Burn Rate:** ${overallBurnRate}%

## 📅 Daily Burn Rate Trend
${burnResults.slice(0, 10).map(day => `
### ${day.date}
- **MQLs:** ${day.total_mqls} | **SQLs:** ${day.converted_sqls} | **Burned:** ${day.burned_mqls}
- **Burn Rate:** ${day.burn_rate_percent}%
`).join('')}

## 🌍 Territory Burn Rate Analysis
${territoryBurnResults.map(territory => `
### ${territory.country || 'Unknown'}
- **MQLs:** ${territory.total_mqls} | **SQLs:** ${territory.converted_sqls} | **Burned:** ${territory.burned_mqls}
- **Burn Rate:** ${territory.burn_rate_percent}%
`).join('')}

*Generated: ${new Date().toISOString()}*`;

      log('✅ Burn rate analysis completed successfully');
      
      return {
        success: true,
        data: {
          overall: { totalMQLs, totalSQLs, burnRate: overallBurnRate },
          daily_trend: burnResults,
          territories: territoryBurnResults,
          date_range: `${days} days`
        },
        report: reportText
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    log('❌ Burn rate analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      report: `❌ **Error getting burn rate analysis:**\n\n${error.message}\n\nPlease check your database connection.`
    };
  }
}

/**
 * Get Google Ads attribution data from MySQL
 */
async function getAttributionData({ days = 30 }) {
  log('🔗 Attribution Analysis called:', { days });
  
  try {
    const connection = await getDbConnection();
    
    try {
      // Get attribution data linking Google Ads to HubSpot deals using proper schema
      const attributionQuery = `
        SELECT 
          c.hs_google_click_id as gclid,
          c.hs_latest_source as source,
          c.territory,
          d.dealstage,
          CAST(d.amount as DECIMAL(15,2)) as amount,
          d.createdate as deal_created,
          c.createdate as contact_created
        FROM hub_contacts c
        LEFT JOIN hub_contact_deal_associations a ON c.hubspot_id = a.contact_hubspot_id
        LEFT JOIN hub_deals d ON a.deal_hubspot_id = d.hubspot_deal_id AND d.pipeline = 'default'
        WHERE c.createdate >= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND c.hs_google_click_id IS NOT NULL
          AND c.hs_google_click_id != ''
          AND c.hs_analytics_source = 'PAID_SEARCH'
          AND c.hubspot_owner_id != 10017927
        ORDER BY c.createdate DESC
        LIMIT 100
      `;
      
      const [attributionResults] = await connection.execute(attributionQuery, [days]);
      
      // Calculate attribution metrics
      const totalAttributed = attributionResults.length;
      const withDeals = attributionResults.filter(row => row.amount).length;
      const totalValue = attributionResults.reduce((sum, row) => sum + (row.amount || 0), 0);
      const avgDealValue = withDeals > 0 ? totalValue / withDeals : 0;
      
      const reportText = `# 🔗 Google Ads Attribution Analysis (Last ${days} days)

## 📊 Attribution Overview
- **Total Attributed Contacts:** ${totalAttributed.toLocaleString()}
- **Contacts with Deals:** ${withDeals.toLocaleString()}
- **Conversion Rate:** ${totalAttributed > 0 ? (withDeals / totalAttributed * 100).toFixed(2) : 0}%
- **Total Deal Value:** €${totalValue.toFixed(2)}
- **Average Deal Value:** €${avgDealValue.toFixed(2)}

## 🎯 Recent Attributed Conversions
${attributionResults.slice(0, 15).map(row => `
### GCLID: ${row.gclid.substring(0, 20)}...
- **Country:** ${row.country || 'Unknown'}
- **Source:** ${row.source || 'Unknown'}
- **Deal Stage:** ${row.dealstage || 'No Deal'}
- **Amount:** €${(row.amount || 0).toFixed(2)}
- **Contact Created:** ${row.contact_created ? new Date(row.contact_created).toLocaleDateString() : 'Unknown'}
`).join('')}

*Generated: ${new Date().toISOString()}*`;

      log('✅ Attribution analysis completed successfully');
      
      return {
        success: true,
        data: {
          summary: { totalAttributed, withDeals, totalValue, avgDealValue },
          attributions: attributionResults,
          date_range: `${days} days`
        },
        report: reportText
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    log('❌ Attribution analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      report: `❌ **Error getting attribution analysis:**\n\n${error.message}\n\nPlease check your database connection.`
    };
  }
}

module.exports = {
  getPipelineAnalysis,
  getBurnRateAnalysis,
  getAttributionData,
  getDbConnection // Export for future extensions
};