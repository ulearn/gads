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

  console.log('\n🔍 DIAGNOSING DEAL DISCREPANCY\n');
  console.log('='.repeat(80));

  // Calculate last 30 days (default for both reports)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  console.log(`\n📅 Date Range: ${startDateStr} to ${endDateStr}\n`);

  // Query 1: Main dashboard logic (all PAID_SEARCH)
  const [dashboardDeals] = await conn.execute(`
    SELECT
      COUNT(DISTINCT hd.hubspot_deal_id) as won_deals,
      COALESCE(SUM(CAST(hd.amount AS DECIMAL(15,2))), 0) as revenue
    FROM hub_deals hd
    JOIN hub_contact_deal_associations a ON hd.hubspot_deal_id = a.deal_hubspot_id
    JOIN hub_contacts hc ON a.contact_hubspot_id = hc.hubspot_id
    WHERE hd.dealstage = 'closedwon'
      AND DATE(hd.closedate) >= ? AND DATE(hd.closedate) <= ?
      AND hd.pipeline = 'default'
      AND hc.hs_analytics_source = 'PAID_SEARCH'
      AND (
        hc.hubspot_owner_id != 10017927
        OR hc.hubspot_owner_id IS NULL
        OR hc.hubspot_owner_id = ''
      )
      AND hc.territory != 'Unsupported Territory'
  `, [startDateStr, endDateStr]);

  console.log('📊 Main Dashboard Logic (All PAID_SEARCH):');
  console.log(`   Won Deals: ${dashboardDeals[0].won_deals}`);
  console.log(`   Revenue: €${parseFloat(dashboardDeals[0].revenue).toLocaleString()}`);

  // Query 2: ROAS Revenue logic (only with google_ads_campaign populated)
  const [roasDeals] = await conn.execute(`
    SELECT
      COUNT(DISTINCT hd.hubspot_deal_id) as won_deals,
      COALESCE(SUM(CAST(hd.amount AS DECIMAL(15,2))), 0) as revenue
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

  console.log('\n📊 ROAS Revenue Logic (Only with google_ads_campaign):');
  console.log(`   Won Deals: ${roasDeals[0].won_deals}`);
  console.log(`   Revenue: €${parseFloat(roasDeals[0].revenue).toLocaleString()}`);

  // Query 3: Find the missing deals
  console.log('\n' + '='.repeat(80));
  console.log('\n🔎 MISSING DEALS (in Dashboard but not ROAS):');

  const [missingDeals] = await conn.execute(`
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
      AND DATE(hd.closedate) >= ? AND DATE(hd.closedate) <= ?
      AND hd.pipeline = 'default'
      AND hc.hs_analytics_source = 'PAID_SEARCH'
      AND (hc.google_ads_campaign IS NULL OR hc.google_ads_campaign = '')
      AND (
        hc.hubspot_owner_id != 10017927
        OR hc.hubspot_owner_id IS NULL
        OR hc.hubspot_owner_id = ''
      )
      AND hc.territory != 'Unsupported Territory'
  `, [startDateStr, endDateStr]);

  if (missingDeals.length > 0) {
    console.log(`\n❌ Found ${missingDeals.length} deals missing from ROAS report:\n`);
    missingDeals.forEach((deal, i) => {
      console.log(`${i + 1}. Deal: ${deal.dealname} (€${deal.amount})`);
      console.log(`   Close Date: ${deal.closedate}`);
      console.log(`   Contact ID: ${deal.contact_id}`);
      console.log(`   google_ads_campaign: "${deal.google_ads_campaign || 'NULL'}"`);
      console.log(`   source_data_1: "${deal.hs_analytics_source_data_1 || 'NULL'}"`);
      console.log('');
    });

    const totalMissing = missingDeals.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    console.log(`💰 Total missing revenue: €${totalMissing.toLocaleString()}`);
  } else {
    console.log('\n✅ No missing deals found');
  }

  console.log('\n' + '='.repeat(80) + '\n');

  await conn.end();
})();
