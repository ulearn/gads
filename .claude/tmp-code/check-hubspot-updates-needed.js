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

  console.log('\n📊 HUBSPOT UPDATE REQUIREMENTS\n');
  console.log('='.repeat(80));

  // Task 1: Contacts from 2025 with NULL google_ads_campaign
  const [nullCampaign] = await conn.execute(`
    SELECT COUNT(*) as count
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND (google_ads_campaign IS NULL OR google_ads_campaign = '')
      AND createdate >= '2025-01-01'
  `);

  console.log('\n1️⃣  Contacts from 2025 with NULL google_ads_campaign:');
  console.log(`   Total: ${nullCampaign[0].count} contacts`);
  console.log(`   Action: Already populated where possible via URL parsing`);
  console.log(`   Remaining: ${nullCampaign[0].count} (no hsa_cam in URL or unmapped)`);

  // Task 2: Contacts that need "LATAM-ES" update in HubSpot
  const [latamContacts] = await conn.execute(`
    SELECT hubspot_id
    FROM hub_contacts
    WHERE google_ads_campaign = 'LATAM-ES'
  `);

  console.log('\n2️⃣  Contacts with "LATAM-ES" in MySQL (need HubSpot update):');
  console.log(`   Total: ${latamContacts.length} contacts`);
  console.log(`   Action: Update HubSpot property 'google_ads_campaign' = "LATAM-ES"`);

  // Also check for any stragglers with old name
  const [oldName] = await conn.execute(`
    SELECT COUNT(*) as count
    FROM hub_contacts
    WHERE google_ads_campaign = 'Spain-LATAM-ES'
  `);

  if (oldName[0].count > 0) {
    console.log(`\n⚠️  WARNING: ${oldName[0].count} contacts still have "Spain-LATAM-ES" in MySQL!`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📋 NEXT STEPS:\n');
  console.log('   1. Bulk update HubSpot: Set google_ads_campaign = "LATAM-ES"');
  console.log(`      for ${latamContacts.length} contact IDs`);
  console.log('\n' + '='.repeat(80) + '\n');

  await conn.end();
})();
