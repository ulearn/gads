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

  console.log('\n🔍 Checking Spain-ES Campaign Attribution\n');
  console.log('='.repeat(70));

  // Check contacts with campaign ID 32907697 in their URL
  const [contactsWithId] = await conn.execute(`
    SELECT
      google_ads_campaign,
      COUNT(*) as count
    FROM hub_contacts
    WHERE hs_analytics_first_url LIKE '%hsa_cam=32907697%'
    GROUP BY google_ads_campaign
    ORDER BY count DESC
  `);

  console.log('\n📊 Contacts with Campaign ID 32907697 in URL:\n');
  contactsWithId.forEach(row => {
    console.log(`   google_ads_campaign: "${row.google_ads_campaign || 'NULL'}"`);
    console.log(`   Count: ${row.count}\n`);
  });

  // Check contacts matching similar names
  const [similarNames] = await conn.execute(`
    SELECT
      google_ads_campaign,
      COUNT(*) as count
    FROM hub_contacts
    WHERE (
      google_ads_campaign LIKE '%Spain%'
      AND google_ads_campaign NOT LIKE '%LATAM%'
    )
    GROUP BY google_ads_campaign
    ORDER BY count DESC
    LIMIT 10
  `);

  console.log('\n📋 Contacts with "Spain" (not LATAM) in name:\n');
  similarNames.forEach(row => {
    console.log(`   "${row.google_ads_campaign || 'NULL'}" - ${row.count} contacts`);
  });

  // Check campaign in gads_campaigns
  const [campaign] = await conn.execute(`
    SELECT campaign_name, status
    FROM gads_campaigns
    WHERE google_campaign_id = '32907697'
  `);

  if (campaign.length > 0) {
    const statusLabel = campaign[0].status === 2 ? 'ACTIVE' : campaign[0].status === 3 ? 'PAUSED' : 'OTHER';
    console.log(`\n✅ Campaign 32907697 in gads_campaigns:`);
    console.log(`   Current name: "${campaign[0].campaign_name}"`);
    console.log(`   Status: ${statusLabel}\n`);
  }

  console.log('='.repeat(70) + '\n');

  await conn.end();
})();
