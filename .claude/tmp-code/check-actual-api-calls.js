const mysql = require('mysql2/promise');
require('dotenv').config();

async function testQuery(startDateStr, endDateStr, label) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const [result] = await conn.execute(`
    SELECT
      COUNT(DISTINCT hd.hubspot_deal_id) as won_deals,
      COALESCE(SUM(CAST(hd.amount AS DECIMAL(15,2))), 0) as revenue,
      GROUP_CONCAT(CONCAT(hd.dealname, ' (€', hd.amount, ')') SEPARATOR ', ') as deals_list
    FROM hub_deals hd
    JOIN hub_contact_deal_associations a ON hd.hubspot_deal_id = a.deal_hubspot_id
    JOIN hub_contacts hc ON a.contact_hubspot_id = hc.hubspot_id
    WHERE hd.dealstage = 'closedwon'
      AND DATE(hd.closedate) >= ? AND DATE(hd.closedate) <= ?
      AND hd.pipeline = 'default'
      AND hc.hs_analytics_source = 'PAID_SEARCH'
      AND hc.google_ads_campaign IS NOT NULL
      AND hc.google_ads_campaign != ''
      AND (
        hc.hubspot_owner_id != 10017927
        OR hc.hubspot_owner_id IS NULL
        OR hc.hubspot_owner_id = ''
      )
      AND hc.territory != 'Unsupported Territory'
  `, [startDateStr, endDateStr]);

  await conn.end();
  return result[0];
}

(async () => {
  console.log('\n📊 TESTING DIFFERENT DATE RANGES\n');
  console.log('='.repeat(80));

  // Test various date ranges to match what user might be seeing
  const tests = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 14 days', days: 14 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 60 days', days: 60 },
    { label: 'Last 90 days', days: 90 },
  ];

  for (const test of tests) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - test.days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const result = await testQuery(startDateStr, endDateStr, test.label);

    console.log(`\n${test.label} (${startDateStr} to ${endDateStr}):`);
    console.log(`   Deals: ${result.won_deals}`);
    console.log(`   Revenue: €${parseFloat(result.revenue).toLocaleString()}`);

    if (result.won_deals == 2 || result.won_deals == 4) {
      console.log(`   ⭐ MATCHES USER REPORT!`);
      if (result.deals_list) {
        console.log(`   Deals: ${result.deals_list}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');
})();
