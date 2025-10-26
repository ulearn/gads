const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkLastSync() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // Check last metrics sync
    const [metrics] = await connection.execute(`
      SELECT MAX(synced_at) as last_metrics_sync
      FROM gads_campaign_metrics
    `);

    // Check last campaign update
    const [campaigns] = await connection.execute(`
      SELECT MAX(updated_at) as last_campaign_update
      FROM gads_campaigns
    `);

    // Check sync log
    const [syncLog] = await connection.execute(`
      SELECT sync_id, sync_type, status, campaigns_synced, metrics_synced, completed_at
      FROM gads_sync_log
      ORDER BY sync_id DESC
      LIMIT 10
    `);

    console.log('\n📊 Last Metrics Sync:', metrics[0].last_metrics_sync);
    console.log('📊 Last Campaign Update:', campaigns[0].last_campaign_update);
    console.log('\n📋 Recent Sync History:');
    console.table(syncLog);

  } finally {
    await connection.end();
  }
}

checkLastSync().catch(console.error);
