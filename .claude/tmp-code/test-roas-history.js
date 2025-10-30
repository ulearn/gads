/**
 * Test ROAS history query
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function test() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('🔍 Testing simple ROAS history query...\n');

    const startDate = '2025-10-20';
    const endDate = '2025-10-27';

    // Simplified query for testing
    const [results] = await connection.execute(`
      SELECT
        DATE(m.date) as period_date,
        'daily' as granularity,
        COALESCE(SUM(m.cost_eur), 0) as period_spend,
        COUNT(*) as records
      FROM gads_campaign_metrics m
      INNER JOIN gads_campaigns c ON m.google_campaign_id = c.google_campaign_id
      WHERE c.status = 2
        AND m.date >= ? AND m.date <= ?
      GROUP BY DATE(m.date)
      ORDER BY period_date
    `, [startDate, endDate]);

    console.log(`✅ Query succeeded!`);
    console.log(`Found ${results.length} periods:\n`);

    results.forEach(row => {
      console.log(`${row.period_date}: €${parseFloat(row.period_spend).toFixed(2)} (${row.records} records)`);
    });

  } catch (error) {
    console.error('❌ Query failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await connection.end();
  }
}

test().catch(console.error);
