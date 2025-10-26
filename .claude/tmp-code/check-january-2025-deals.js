const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('\n🔍 CHECKING JANUARY 2025 DEALS\n');
  console.log('='.repeat(80));
  console.log('\n📅 Date Range: 2025-01-01 to 2025-01-31\n');

  // Query 1: Main Dashboard (all PAID_SEARCH)
  const [dashboardDeals] = await conn.execute(`
    SELECT
      hd.hubspot_deal_id,
      hd.dealname,
      hd.amount,
      hd.closedate,
      hc.hubspot_id as contact_id,
      hc.google_ads_campaign,
      hc.hs_analytics_source_data_1
    FROM hub_deals hd
    JOIN hub_contact_deal_associations a ON hd.hubspot_deal_id = a.deal_hubspot_id
    JOIN hub_contacts hc ON a.contact_hubspot_id = hc.hubspot_id
    WHERE hd.dealstage = 'closedwon'
      AND DATE(hd.closedate) >= '2025-01-01' AND DATE(hd.closedate) <= '2025-01-31'
      AND hd.pipeline = 'default'
      AND hc.hs_analytics_source = 'PAID_SEARCH'
      AND (
        hc.hubspot_owner_id != 10017927
        OR hc.hubspot_owner_id IS NULL
        OR hc.hubspot_owner_id = ''
      )
      AND hc.territory != 'Unsupported Territory'
    ORDER BY hd.closedate
  `);

  console.log('📊 MAIN DASHBOARD - All PAID_SEARCH Deals:\n');
  let dashTotal = 0;
  dashboardDeals.forEach((deal, i) => {
    console.log(`${i + 1}. ${deal.dealname} - €${deal.amount}`);
    console.log(`   Close Date: ${deal.closedate}`);
    console.log(`   Contact: ${deal.contact_id}`);
    console.log(`   google_ads_campaign: "${deal.google_ads_campaign || 'NULL'}"`);
    console.log(`   source_data_1: "${deal.hs_analytics_source_data_1 || 'NULL'}"`);
    console.log('');
    dashTotal += parseFloat(deal.amount || 0);
  });

  console.log(`   Total: ${dashboardDeals.length} deals, €${dashTotal.toLocaleString()}\n`);

  // Query 2: ROAS Revenue (only with google_ads_campaign)
  const [roasDeals] = await conn.execute(`
    SELECT
      hd.hubspot_deal_id,
      hd.dealname,
      hd.amount,
      hd.closedate,
      hc.hubspot_id as contact_id,
      hc.google_ads_campaign,
      hc.hs_analytics_source_data_1
    FROM hub_deals hd
    JOIN hub_contact_deal_associations a ON hd.hubspot_deal_id = a.deal_hubspot_id
    JOIN hub_contacts hc ON a.contact_hubspot_id = hc.hubspot_id
    WHERE hd.dealstage = 'closedwon'
      AND DATE(hd.closedate) >= '2025-01-01' AND DATE(hd.closedate) <= '2025-01-31'
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
    ORDER BY hd.closedate
  `);

  console.log('='.repeat(80));
  console.log('\n📊 ROAS REVENUE - Only with google_ads_campaign:\n');
  let roasTotal = 0;
  roasDeals.forEach((deal, i) => {
    console.log(`${i + 1}. ${deal.dealname} - €${deal.amount}`);
    console.log(`   Close Date: ${deal.closedate}`);
    console.log(`   Contact: ${deal.contact_id}`);
    console.log(`   google_ads_campaign: "${deal.google_ads_campaign}"`);
    console.log('');
    roasTotal += parseFloat(deal.amount || 0);
  });

  console.log(`   Total: ${roasDeals.length} deals, €${roasTotal.toLocaleString()}\n`);

  // Find missing deals
  console.log('='.repeat(80));
  console.log('\n❌ MISSING FROM ROAS REVENUE REPORT:\n');

  const roasDealIds = new Set(roasDeals.map(d => d.hubspot_deal_id));
  const missingDeals = dashboardDeals.filter(d => !roasDealIds.has(d.hubspot_deal_id));

  if (missingDeals.length > 0) {
    let missingTotal = 0;
    missingDeals.forEach((deal, i) => {
      console.log(`${i + 1}. ${deal.dealname} - €${deal.amount}`);
      console.log(`   Contact: ${deal.contact_id}`);
      console.log(`   google_ads_campaign: "${deal.google_ads_campaign || 'NULL'}"`);
      console.log(`   source_data_1: "${deal.hs_analytics_source_data_1 || 'NULL'}"`);
      console.log('   ⚠️  REASON: google_ads_campaign is NULL\n');
      missingTotal += parseFloat(deal.amount || 0);
    });
    console.log(`💰 Missing Revenue: €${missingTotal.toLocaleString()}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  await conn.end();
})();
