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

  console.log('\n✅ FINAL ATTRIBUTION STATUS REPORT\n');
  console.log('='.repeat(80));

  // Overall stats from Oct 2022
  const [overall] = await conn.execute(`
    SELECT
      COUNT(*) as total_contacts,
      SUM(CASE WHEN google_ads_campaign IS NOT NULL AND google_ads_campaign != '' THEN 1 ELSE 0 END) as has_campaign,
      SUM(CASE WHEN google_ads_campaign IS NULL OR google_ads_campaign = '' THEN 1 ELSE 0 END) as no_campaign,
      SUM(CASE WHEN google_ads_campaign = 'Campaign Unknown' THEN 1 ELSE 0 END) as unknown_campaign
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND createdate >= '2022-10-01'
  `);

  const total = overall[0].total_contacts;
  const withCampaign = overall[0].has_campaign;
  const withoutCampaign = overall[0].no_campaign;
  const unknownCampaign = overall[0].unknown_campaign;

  console.log('\n📊 OVERALL (Oct 2022 - Present):\n');
  console.log(`   Total PAID_SEARCH contacts: ${total.toLocaleString()}`);
  console.log(`   ✅ With campaign: ${withCampaign.toLocaleString()} (${((withCampaign / total) * 100).toFixed(2)}%)`);
  console.log(`   ❌ Without campaign: ${withoutCampaign.toLocaleString()} (${((withoutCampaign / total) * 100).toFixed(2)}%)`);
  console.log(`   ⚠️  "Campaign Unknown": ${unknownCampaign.toLocaleString()}`);

  // By year
  const [byYear] = await conn.execute(`
    SELECT
      YEAR(createdate) as year,
      COUNT(*) as total,
      SUM(CASE WHEN google_ads_campaign IS NOT NULL AND google_ads_campaign != '' THEN 1 ELSE 0 END) as with_campaign,
      SUM(CASE WHEN google_ads_campaign = 'Campaign Unknown' THEN 1 ELSE 0 END) as unknown
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND createdate >= '2022-10-01'
    GROUP BY YEAR(createdate)
    ORDER BY year
  `);

  console.log('\n📅 ATTRIBUTION BY YEAR:\n');
  byYear.forEach(row => {
    const pct = ((row.with_campaign / row.total) * 100).toFixed(1);
    console.log(`   ${row.year}: ${row.with_campaign}/${row.total} (${pct}%) | Unknown: ${row.unknown}`);
  });

  // Top campaigns
  const [topCampaigns] = await conn.execute(`
    SELECT
      google_ads_campaign,
      COUNT(*) as contact_count
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND createdate >= '2022-10-01'
      AND google_ads_campaign IS NOT NULL
      AND google_ads_campaign != ''
    GROUP BY google_ads_campaign
    ORDER BY contact_count DESC
    LIMIT 15
  `);

  console.log('\n📋 TOP 15 CAMPAIGNS BY CONTACT COUNT:\n');
  topCampaigns.forEach((row, i) => {
    console.log(`   ${i + 1}. ${row.google_ads_campaign}: ${row.contact_count.toLocaleString()} contacts`);
  });

  // Check January 2025 deals status
  const [janDeals] = await conn.execute(`
    SELECT
      COUNT(DISTINCT hd.hubspot_deal_id) as won_deals,
      COALESCE(SUM(CAST(hd.amount AS DECIMAL(15,2))), 0) as revenue
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
  `);

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ JANUARY 2025 VERIFICATION:\n');
  console.log(`   Won Deals: ${janDeals[0].won_deals}`);
  console.log(`   Revenue: €${parseFloat(janDeals[0].revenue).toLocaleString()}`);

  console.log('\n' + '='.repeat(80) + '\n');

  await conn.end();
})();
