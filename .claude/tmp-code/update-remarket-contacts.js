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

  console.log('\n🔄 Updating Remarket-Display contacts to canonical name\n');
  console.log('='.repeat(70));

  // Count contacts before update
  const [before] = await conn.execute(`
    SELECT COUNT(*) as count
    FROM hub_contacts
    WHERE google_ads_campaign = 'Remarket-Display (Obs&Place)'
  `);

  console.log(`\n📊 Contacts with old name: ${before[0].count}`);

  // Update to canonical name
  const [result] = await conn.execute(`
    UPDATE hub_contacts
    SET google_ads_campaign = 'Remarket-Display (Obs)'
    WHERE google_ads_campaign = 'Remarket-Display (Obs&Place)'
  `);

  console.log(`✅ Updated ${result.affectedRows} contacts`);

  // Count contacts after update
  const [after] = await conn.execute(`
    SELECT COUNT(*) as count
    FROM hub_contacts
    WHERE google_ads_campaign = 'Remarket-Display (Obs)'
  `);

  console.log(`📊 Contacts with canonical name: ${after[0].count}`);

  // Verify deals attribution
  const [deals] = await conn.execute(`
    SELECT COUNT(DISTINCT hd.hubspot_deal_id) as deal_count,
           SUM(CAST(hd.amount AS DECIMAL(15,2))) as total_revenue
    FROM hub_deals hd
    INNER JOIN hub_contact_deal_associations hcda ON hd.hubspot_deal_id = hcda.deal_hubspot_id
    INNER JOIN hub_contacts hc ON hcda.contact_hubspot_id = hc.hubspot_id
    WHERE hc.google_ads_campaign = 'Remarket-Display (Obs)'
      AND hd.dealstage != 'appointmentscheduled'
      AND hd.amount IS NOT NULL
      AND CAST(hd.amount AS DECIMAL(15,2)) > 0
  `);

  console.log(`\n💰 Attribution Results:`);
  console.log(`   Deals: ${deals[0].deal_count || 0}`);
  console.log(`   Revenue: €${deals[0].total_revenue || 0}`);

  console.log('\n' + '='.repeat(70) + '\n');

  await conn.end();
})();
