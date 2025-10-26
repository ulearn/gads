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

  // Get campaigns that were just updated
  const [recent] = await conn.execute(`
    SELECT google_campaign_id, campaign_name, status, updated_at
    FROM gads_campaigns
    WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
    ORDER BY campaign_name
  `);

  console.log(`\n📊 Campaigns just synced (last 10 min) - ${recent.length} campaigns:\n`);
  recent.slice(0, 15).forEach(c => {
    const statusLabel = c.status === 2 ? 'ACTIVE' : c.status === 3 ? 'PAUSED' : 'OTHER';
    console.log(`   [${statusLabel}] ${c.campaign_name}`);
  });

  if (recent.length > 15) {
    console.log(`   ... and ${recent.length - 15} more`);
  }

  await conn.end();
})();
