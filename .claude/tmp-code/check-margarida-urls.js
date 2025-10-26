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

  console.log('\n🔍 CHECKING MARGARIDA CONTACT URLs\n');
  console.log('='.repeat(80));

  const [contact] = await conn.execute(`
    SELECT
      hubspot_id,
      firstname,
      lastname,
      google_ads_campaign,
      hs_analytics_source_data_1,
      hs_analytics_first_url,
      hs_analytics_first_referrer
    FROM hub_contacts
    WHERE hubspot_id = '175883265273'
  `);

  if (contact.length > 0) {
    const c = contact[0];
    console.log(`\n📋 Contact: ${c.firstname} ${c.lastname} (${c.hubspot_id})\n`);
    console.log(`   google_ads_campaign: "${c.google_ads_campaign}"`);
    console.log(`   source_data_1: "${c.hs_analytics_source_data_1 || 'NULL'}"`);
    console.log(`\n   First URL (MySQL):\n   ${c.hs_analytics_first_url || 'NULL'}`);
    console.log(`\n   First Referrer:\n   ${c.hs_analytics_first_referrer || 'NULL'}`);

    // Check if hsa_cam is in the URL
    if (c.hs_analytics_first_url) {
      const hsaCamMatch = c.hs_analytics_first_url.match(/hsa_cam=([^&\s]*)/);
      if (hsaCamMatch) {
        console.log(`\n   ✅ Found hsa_cam: ${hsaCamMatch[1]}`);

        const [campaign] = await conn.execute(`
          SELECT campaign_name FROM gads_campaigns WHERE google_campaign_id = ?
        `, [hsaCamMatch[1]]);

        if (campaign.length > 0) {
          console.log(`   Campaign: ${campaign[0].campaign_name}`);
        }
      } else {
        console.log('\n   ❌ No hsa_cam found in URL');
      }
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');

  await conn.end();
})();
