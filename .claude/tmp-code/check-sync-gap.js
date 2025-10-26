const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSyncGap() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('\n📊 SYNC GAP ANALYSIS\n');
    console.log('='.repeat(60));

    // Check today's sync
    const [todaySync] = await connection.execute(`
      SELECT MIN(date) as earliest, MAX(date) as latest, COUNT(DISTINCT date) as day_count
      FROM gads_campaign_metrics
      WHERE synced_at >= '2025-10-26'
    `);
    console.log('\n✅ Today\'s Sync (Oct 26, 2025):');
    console.log(`   Dates synced: ${todaySync[0].earliest} to ${todaySync[0].latest}`);
    console.log(`   Days: ${todaySync[0].day_count}`);

    // Check last metrics before today
    const [beforeToday] = await connection.execute(`
      SELECT MAX(date) as last_date, MAX(synced_at) as last_sync_time
      FROM gads_campaign_metrics
      WHERE synced_at < '2025-10-26'
    `);
    console.log('\n📅 Last Successful Sync BEFORE Today:');
    console.log(`   Last data date: ${beforeToday[0].last_date || 'NONE'}`);
    console.log(`   Last sync time: ${beforeToday[0].last_sync_time || 'NONE'}`);

    // Check date coverage for 2025
    const [coverage] = await connection.execute(`
      SELECT
        DATE_FORMAT(date, '%Y-%m') as month,
        MIN(date) as first_date,
        MAX(date) as last_date,
        COUNT(DISTINCT date) as days_with_data,
        COUNT(*) as total_records
      FROM gads_campaign_metrics
      WHERE date >= '2025-01-01'
      GROUP BY DATE_FORMAT(date, '%Y-%m')
      ORDER BY month
    `);
    console.log('\n📆 2025 Data Coverage by Month:');
    console.table(coverage);

    // Check for date gaps
    const [gaps] = await connection.execute(`
      WITH RECURSIVE date_range AS (
        SELECT DATE('2025-01-01') as check_date
        UNION ALL
        SELECT DATE_ADD(check_date, INTERVAL 1 DAY)
        FROM date_range
        WHERE check_date < CURDATE()
      )
      SELECT
        dr.check_date as missing_date
      FROM date_range dr
      LEFT JOIN (
        SELECT DISTINCT date
        FROM gads_campaign_metrics
        WHERE date >= '2025-01-01'
      ) m ON dr.check_date = m.date
      WHERE m.date IS NULL
      ORDER BY dr.check_date
      LIMIT 50
    `);

    if (gaps.length > 0) {
      console.log('\n⚠️  Missing Dates (first 50):');
      const missingDates = gaps.map(g => g.missing_date.toISOString().split('T')[0]);
      console.log(missingDates.join(', '));
      console.log(`\n   Total missing days: ${gaps.length >= 50 ? '50+' : gaps.length}`);
    } else {
      console.log('\n✅ No missing dates found!');
    }

    // Check successful syncs in log
    const [successfulSyncs] = await connection.execute(`
      SELECT sync_id, sync_type, status, metrics_synced, completed_at
      FROM gads_sync_log
      WHERE status = 'completed' AND metrics_synced > 0
      ORDER BY sync_id DESC
      LIMIT 5
    `);
    console.log('\n📋 Recent Successful Syncs:');
    console.table(successfulSyncs);

  } finally {
    await connection.end();
  }
}

checkSyncGap().catch(console.error);
