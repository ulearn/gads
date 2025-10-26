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

  console.log('\n✅ FINAL ATTRIBUTION STATUS\n');
  console.log('='.repeat(80));

  const campaignsToCheck = [
    { name: 'Remarket-Display (Obs)', id: '239036407' },
    { name: 'Spain-ES', id: '32907697' },
    { name: 'LATAM-ES', id: '22099718382' }
  ];

  for (const campaign of campaignsToCheck) {
    console.log(`\n📊 ${campaign.name} (ID: ${campaign.id})\n`);

    // Contacts
    const [contacts] = await conn.execute(`
      SELECT COUNT(*) as count
      FROM hub_contacts
      WHERE google_ads_campaign = ?
    `, [campaign.name]);

    // Recent contacts (2025)
    const [recent] = await conn.execute(`
      SELECT COUNT(*) as count
      FROM hub_contacts
      WHERE google_ads_campaign = ?
        AND createdate >= '2025-01-01'
    `, [campaign.name]);

    // Deals
    const [deals] = await conn.execute(`
      SELECT
        COUNT(DISTINCT hd.hubspot_deal_id) as deal_count,
        SUM(CAST(hd.amount AS DECIMAL(15,2))) as total_revenue
      FROM hub_deals hd
      INNER JOIN hub_contact_deal_associations hcda ON hd.hubspot_deal_id = hcda.deal_hubspot_id
      INNER JOIN hub_contacts hc ON hcda.contact_hubspot_id = hc.hubspot_id
      WHERE hc.google_ads_campaign = ?
        AND hd.dealstage != 'appointmentscheduled'
        AND hd.amount IS NOT NULL
        AND CAST(hd.amount AS DECIMAL(15,2)) > 0
    `, [campaign.name]);

    console.log(`   Total Contacts: ${contacts[0].count}`);
    console.log(`   Contacts (2025): ${recent[0].count}`);
    console.log(`   Deals: ${deals[0].deal_count || 0}`);
    console.log(`   Revenue: €${(deals[0].total_revenue || 0).toLocaleString()}`);
  }

  console.log('\n' + '='.repeat(80));

  // Overall stats
  const [nullContacts] = await conn.execute(`
    SELECT COUNT(*) as count
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND (google_ads_campaign IS NULL OR google_ads_campaign = '')
      AND createdate >= '2025-01-01'
  `);

  console.log(`\n📈 REMAINING ISSUES:\n`);
  console.log(`   Contacts (2025) with NULL campaign: ${nullContacts[0].count}`);
  console.log(`   (These have no hsa_cam in URL or unmapped campaign IDs)\n`);

  console.log('='.repeat(80) + '\n');

  await conn.end();
})();
