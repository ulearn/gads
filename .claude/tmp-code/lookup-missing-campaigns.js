const mysql = require('mysql2/promise');
require('dotenv').config();

const UNMAPPED_IDS = [
  '21735035647',
  '22099718382',
  '22238601547',
  '999999',
  '23040507289'
];

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('\n🔍 Looking up unmapped campaign IDs in gads_campaigns table...\n');
  console.log('='.repeat(70));

  for (const campaignId of UNMAPPED_IDS) {
    console.log(`\nCampaign ID: ${campaignId}`);

    const [campaign] = await conn.execute(`
      SELECT google_campaign_id, campaign_name, status
      FROM gads_campaigns
      WHERE google_campaign_id = ?
    `, [campaignId]);

    if (campaign.length > 0) {
      const statusLabel = campaign[0].status === 2 ? 'ACTIVE' : campaign[0].status === 3 ? 'PAUSED' : 'OTHER';
      console.log(`   Name: "${campaign[0].campaign_name}"`);
      console.log(`   Status: ${statusLabel}`);

      // Count contacts with this campaign in URL
      const [count] = await conn.execute(`
        SELECT COUNT(*) as count
        FROM hub_contacts
        WHERE hs_analytics_first_url LIKE ?
          AND (google_ads_campaign IS NULL OR google_ads_campaign = '')
      `, [`%hsa_cam=${campaignId}%`]);

      console.log(`   Contacts needing update: ${count[0].count}`);
    } else {
      console.log(`   ❌ Not found in gads_campaigns table`);
    }
  }

  console.log('\n' + '='.repeat(70) + '\n');

  await conn.end();
})();
