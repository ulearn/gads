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

  console.log('\n🔍 Checking Remarket-Display Campaign Attribution\n');
  console.log('='.repeat(70));

  // Check contacts with campaign ID 239036407 in their URL
  const [contactsWithId] = await conn.execute(`
    SELECT
      google_ads_campaign,
      hs_analytics_source_data_1,
      COUNT(*) as count
    FROM hub_contacts
    WHERE hs_analytics_first_url LIKE '%hsa_cam=239036407%'
    GROUP BY google_ads_campaign, hs_analytics_source_data_1
    ORDER BY count DESC
  `);

  console.log('\n📊 Contacts with Campaign ID 239036407 in URL:\n');
  contactsWithId.forEach(row => {
    console.log(`   google_ads_campaign: "${row.google_ads_campaign || 'NULL'}"`);
    console.log(`   source_data_1: "${row.hs_analytics_source_data_1 || 'NULL'}"`);
    console.log(`   Count: ${row.count}\n`);
  });

  // Check contacts matching old name patterns
  const [similarNames] = await conn.execute(`
    SELECT
      google_ads_campaign,
      hs_analytics_source_data_1,
      COUNT(*) as count
    FROM hub_contacts
    WHERE (
      google_ads_campaign LIKE '%Remarket%Display%'
      OR hs_analytics_source_data_1 LIKE '%Remarket%Display%'
    )
    GROUP BY google_ads_campaign, hs_analytics_source_data_1
    ORDER BY count DESC
    LIMIT 10
  `);

  console.log('\n📋 All contacts with "Remarket" + "Display" in name:\n');
  similarNames.forEach(row => {
    console.log(`   google_ads_campaign: "${row.google_ads_campaign || 'NULL'}"`);
    console.log(`   source_data_1: "${row.hs_analytics_source_data_1 || 'NULL'}"`);
    console.log(`   Count: ${row.count}\n`);
  });

  // Check campaign in gads_campaigns
  const [campaign] = await conn.execute(`
    SELECT campaign_name, status
    FROM gads_campaigns
    WHERE google_campaign_id = '239036407'
  `);

  if (campaign.length > 0) {
    const statusLabel = campaign[0].status === 2 ? 'ACTIVE' : campaign[0].status === 3 ? 'PAUSED' : 'OTHER';
    console.log(`\n✅ Campaign 239036407 in gads_campaigns:`);
    console.log(`   Current name: "${campaign[0].campaign_name}"`);
    console.log(`   Status: ${statusLabel}\n`);
  }

  console.log('='.repeat(70) + '\n');

  await conn.end();
})();
