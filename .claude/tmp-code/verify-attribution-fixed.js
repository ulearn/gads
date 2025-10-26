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

  console.log('\n🔍 Verifying Attribution Fix for Problem Campaigns\n');
  console.log('='.repeat(70));

  const campaignsToCheck = [
    'Remarket-Display (Obs)',
    'Spain-ES',
    'Spain-LATAM-ES'
  ];

  for (const campaignName of campaignsToCheck) {
    console.log(`\n📊 Campaign: "${campaignName}"\n`);

    // Check contacts with this campaign name
    const [contacts] = await conn.execute(`
      SELECT COUNT(*) as count
      FROM hub_contacts
      WHERE google_ads_campaign = ?
    `, [campaignName]);

    console.log(`   Total Contacts: ${contacts[0].count}`);

    // Check recent contacts (2025)
    const [recent] = await conn.execute(`
      SELECT COUNT(*) as count
      FROM hub_contacts
      WHERE google_ads_campaign = ?
        AND createdate >= '2025-01-01'
    `, [campaignName]);

    console.log(`   Contacts in 2025: ${recent[0].count}`);

    // Check deals attribution
    const [deals] = await conn.execute(`
      SELECT COUNT(DISTINCT hd.hubspot_deal_id) as deal_count,
             SUM(CAST(hd.amount AS DECIMAL(15,2))) as total_revenue
      FROM hub_deals hd
      INNER JOIN hub_contact_deal_associations hcda ON hd.hubspot_deal_id = hcda.deal_hubspot_id
      INNER JOIN hub_contacts hc ON hcda.contact_hubspot_id = hc.hubspot_id
      WHERE hc.google_ads_campaign = ?
        AND hd.dealstage != 'appointmentscheduled'
        AND hd.amount IS NOT NULL
        AND CAST(hd.amount AS DECIMAL(15,2)) > 0
    `, [campaignName]);

    console.log(`   Deals: ${deals[0].deal_count || 0}`);
    console.log(`   Revenue: €${deals[0].total_revenue || 0}`);
  }

  console.log('\n' + '='.repeat(70));

  // Summary of NULL google_ads_campaign remaining
  const [stillNull] = await conn.execute(`
    SELECT COUNT(*) as count
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND (google_ads_campaign IS NULL OR google_ads_campaign = '')
      AND createdate >= '2025-01-01'
  `);

  console.log(`\n📈 Contacts still with NULL google_ads_campaign: ${stillNull[0].count}`);
  console.log('   (These don\'t have hsa_cam in their URL or have unmapped campaign IDs)\n');

  await conn.end();
})();
