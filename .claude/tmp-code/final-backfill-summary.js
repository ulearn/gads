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

  console.log('\n✅ COMPLETE HISTORICAL BACKFILL SUMMARY\n');
  console.log('='.repeat(80));

  // Check NULL campaigns remaining by year
  const [byYear] = await conn.execute(`
    SELECT
      YEAR(createdate) as year,
      COUNT(*) as null_contacts,
      SUM(CASE WHEN hs_analytics_first_url LIKE '%hsa_cam=%' THEN 1 ELSE 0 END) as has_campaign_id_unfixed,
      SUM(CASE WHEN hs_analytics_first_url NOT LIKE '%hsa_cam=%' OR hs_analytics_first_url IS NULL THEN 1 ELSE 0 END) as no_campaign_id
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND (google_ads_campaign IS NULL OR google_ads_campaign = '')
      AND createdate >= '2022-10-01'
    GROUP BY YEAR(createdate)
    ORDER BY year
  `);

  console.log('\n📊 Remaining NULL campaigns by year:\n');
  console.table(byYear);

  // Get total filled
  const [filled] = await conn.execute(`
    SELECT
      YEAR(createdate) as year,
      COUNT(*) as filled_contacts
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND google_ads_campaign IS NOT NULL
      AND google_ads_campaign != ''
      AND createdate >= '2022-10-01'
    GROUP BY YEAR(createdate)
    ORDER BY year
  `);

  console.log('\n✅ Contacts with campaigns assigned:\n');
  console.table(filled);

  // Overall stats
  const [total] = await conn.execute(`
    SELECT
      COUNT(*) as total_paid_search,
      SUM(CASE WHEN google_ads_campaign IS NOT NULL AND google_ads_campaign != '' THEN 1 ELSE 0 END) as has_campaign,
      SUM(CASE WHEN google_ads_campaign IS NULL OR google_ads_campaign = '' THEN 1 ELSE 0 END) as no_campaign
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND createdate >= '2022-10-01'
  `);

  console.log('\n📈 OVERALL (Oct 2022 - Present):\n');
  console.log(`   Total Paid Search contacts: ${total[0].total_paid_search.toLocaleString()}`);
  console.log(`   ✅ With campaign: ${total[0].has_campaign.toLocaleString()} (${((total[0].has_campaign / total[0].total_paid_search) * 100).toFixed(1)}%)`);
  console.log(`   ⚠️  Without campaign: ${total[0].no_campaign.toLocaleString()} (${((total[0].no_campaign / total[0].total_paid_search) * 100).toFixed(1)}%)`);

  console.log('\n' + '='.repeat(80));
  console.log('\n💡 NOTE: Remaining contacts without campaigns either:');
  console.log('   • Don\'t have hsa_cam in their tracking URL');
  console.log('   • Have unmapped/deleted campaign IDs');
  console.log('   • Have malformed tracking URLs\n');
  console.log('='.repeat(80) + '\n');

  await conn.end();
})();
