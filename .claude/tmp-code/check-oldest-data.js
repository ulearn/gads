const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkOldestData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // Check oldest metrics data
    const [metrics] = await connection.execute(`
      SELECT MIN(date) as oldest_date, MAX(date) as newest_date, COUNT(DISTINCT date) as total_days
      FROM gads_campaign_metrics
    `);

    console.log('\n📊 GOOGLE ADS DATA RANGE IN DATABASE\n');
    console.log('='.repeat(60));
    console.log(`\n📅 Metrics Data:`);
    console.log(`   Oldest date: ${metrics[0].oldest_date}`);
    console.log(`   Newest date: ${metrics[0].newest_date}`);
    console.log(`   Total days with data: ${metrics[0].total_days}`);

    // Check data by year
    const [byYear] = await connection.execute(`
      SELECT
        YEAR(date) as year,
        MIN(date) as first_date,
        MAX(date) as last_date,
        COUNT(DISTINCT date) as days_with_data,
        COUNT(*) as total_records
      FROM gads_campaign_metrics
      GROUP BY YEAR(date)
      ORDER BY year
    `);

    console.log('\n📆 Data Coverage by Year:');
    console.table(byYear);

    // Check campaigns table
    const [campaigns] = await connection.execute(`
      SELECT MIN(created_at) as oldest_campaign, MAX(created_at) as newest_campaign, COUNT(*) as total_campaigns
      FROM gads_campaigns
    `);

    console.log('\n🎯 Campaign Records:');
    console.log(`   Oldest campaign: ${campaigns[0].oldest_campaign}`);
    console.log(`   Newest campaign: ${campaigns[0].newest_campaign}`);
    console.log(`   Total campaigns: ${campaigns[0].total_campaigns}`);

    console.log('\n' + '='.repeat(60));
    console.log('💡 NOTE: HubSpot data goes back to Oct 2022');
    console.log('   We can backfill Google Ads to match that timeframe.');
    console.log('='.repeat(60) + '\n');

  } finally {
    await connection.end();
  }
}

checkOldestData().catch(console.error);
