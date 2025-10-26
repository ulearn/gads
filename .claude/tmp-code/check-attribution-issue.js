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

  // Check what names exist in HubSpot for these campaigns
  const campaigns = [
    { current_name: 'Spain-ES', id: '32907697' },
    { current_name: 'Remarket-Display (Obs)', id: '239036407' }
  ];

  for (const camp of campaigns) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 Campaign: ${camp.current_name} (ID: ${camp.id})`);
    console.log('='.repeat(70));

    // Check exact match
    const [exact] = await conn.execute(`
      SELECT COUNT(*) as count
      FROM hub_contacts
      WHERE google_ads_campaign = ?
    `, [camp.current_name]);
    console.log(`   Exact match in google_ads_campaign: ${exact[0].count} contacts`);

    // Check source_data_1 exact match
    const [source] = await conn.execute(`
      SELECT COUNT(*) as count
      FROM hub_contacts
      WHERE hs_analytics_source_data_1 = ?
    `, [camp.current_name]);
    console.log(`   Exact match in source_data_1: ${source[0].count} contacts`);

    // Check similar names in google_ads_campaign
    const [similar] = await conn.execute(`
      SELECT google_ads_campaign, COUNT(*) as count
      FROM hub_contacts
      WHERE google_ads_campaign LIKE ?
      GROUP BY google_ads_campaign
      ORDER BY count DESC
      LIMIT 5
    `, [`%${camp.current_name.substring(0, 10)}%`]);

    if (similar.length > 0) {
      console.log(`\n   Similar names in google_ads_campaign:`);
      similar.forEach(row => {
        console.log(`      - "${row.google_ads_campaign}" (${row.count} contacts)`);
      });
    }

    // Check similar in source_data_1
    const [sourceVars] = await conn.execute(`
      SELECT hs_analytics_source_data_1, COUNT(*) as count
      FROM hub_contacts
      WHERE hs_analytics_source_data_1 LIKE ?
      GROUP BY hs_analytics_source_data_1
      ORDER BY count DESC
      LIMIT 5
    `, [`%${camp.current_name.substring(0, 10)}%`]);

    if (sourceVars.length > 0) {
      console.log(`\n   Similar names in source_data_1:`);
      sourceVars.forEach(row => {
        console.log(`      - "${row.hs_analytics_source_data_1}" (${row.count} contacts)`);
      });
    }
  }

  await conn.end();
})();
