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

  console.log('\n🔍 Checking "Spain-LATAM-ES" campaigns...\n');

  // Check both campaign IDs
  const [campaigns] = await conn.execute(`
    SELECT google_campaign_id, campaign_name, status, created_at
    FROM gads_campaigns
    WHERE google_campaign_id IN ('32907697', '22099718382')
    ORDER BY google_campaign_id
  `);

  campaigns.forEach(c => {
    const statusLabel = c.status === 2 ? 'ACTIVE' : c.status === 3 ? 'PAUSED' : 'OTHER';
    console.log(`Campaign ID: ${c.google_campaign_id}`);
    console.log(`   Name: "${c.campaign_name}"`);
    console.log(`   Status: ${statusLabel}`);
    console.log(`   Created: ${c.created_at}`);
    console.log('');
  });

  // Check if campaign 32907697 still exists
  const [oldCampaign] = await conn.execute(`
    SELECT COUNT(*) as has_data
    FROM gads_campaign_metrics
    WHERE google_campaign_id = '32907697'
  `);

  console.log(`Campaign 32907697 has ${oldCampaign[0].has_data} metrics records`);

  const [newCampaign] = await conn.execute(`
    SELECT COUNT(*) as has_data
    FROM gads_campaign_metrics
    WHERE google_campaign_id = '22099718382'
  `);

  console.log(`Campaign 22099718382 has ${newCampaign[0].has_data} metrics records\n`);

  await conn.end();
})();
