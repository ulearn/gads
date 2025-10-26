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

  // Sample contacts with unknown campaign
  const [sample] = await conn.execute(`
    SELECT hubspot_id, hs_analytics_first_url, google_ads_campaign, createdate
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND (google_ads_campaign IS NULL OR google_ads_campaign = '')
      AND createdate >= '2025-01-01'
      AND hs_analytics_first_url IS NOT NULL
    LIMIT 5
  `);

  console.log('\n📊 Sample contacts with unknown campaign:\n');

  sample.forEach((contact, i) => {
    console.log(`${i + 1}. Contact ID: ${contact.hubspot_id}`);
    console.log(`   Created: ${contact.createdate}`);
    console.log(`   First URL: ${contact.hs_analytics_first_url}`);

    // Parse URL to extract campaign info
    const url = contact.hs_analytics_first_url;
    const utmCampaign = url.match(/utm_campaign=([^&]*)/)?.[1];
    const hsaCam = url.match(/hsa_cam=([^&]*)/)?.[1];

    if (utmCampaign) {
      console.log(`   utm_campaign: ${decodeURIComponent(utmCampaign)}`);
    }
    if (hsaCam) {
      console.log(`   hsa_cam (Campaign ID): ${hsaCam}`);
    }
    console.log('');
  });

  // Count total contacts needing fix
  const [count] = await conn.execute(`
    SELECT COUNT(*) as count
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND (google_ads_campaign IS NULL OR google_ads_campaign = '')
      AND createdate >= '2025-01-01'
      AND hs_analytics_first_url LIKE '%hsa_cam=%'
  `);

  console.log(`\n📈 Total contacts with hsa_cam that need fixing: ${count[0].count}`);

  await conn.end();
})();
