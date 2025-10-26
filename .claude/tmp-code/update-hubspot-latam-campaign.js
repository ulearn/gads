const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const BATCH_SIZE = 100;

async function updateHubSpotContacts(contactIds, campaignName) {
  const batches = [];
  for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
    batches.push(contactIds.slice(i, i + BATCH_SIZE));
  }

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`\n   Processing batch ${i + 1}/${batches.length} (${batch.length} contacts)...`);

    const inputs = batch.map(id => ({
      id: id.toString(),
      properties: {
        google_ads_campaign: campaignName
      }
    }));

    try {
      const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/contacts/batch/update',
        { inputs },
        {
          headers: {
            'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      successCount += response.data.results.length;
      console.log(`   ✅ Updated ${response.data.results.length} contacts`);

    } catch (error) {
      errorCount += batch.length;
      console.error(`   ❌ Error: ${error.response?.data?.message || error.message}`);
    }

    // Rate limiting: wait 200ms between batches
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return { successCount, errorCount };
}

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('\n🔄 UPDATING HUBSPOT CONTACTS\n');
  console.log('='.repeat(80));

  // First, fix any stragglers in MySQL
  const [stragglers] = await conn.execute(`
    UPDATE hub_contacts
    SET google_ads_campaign = 'LATAM-ES'
    WHERE google_ads_campaign = 'Spain-LATAM-ES'
  `);

  if (stragglers.affectedRows > 0) {
    console.log(`\n✅ Fixed ${stragglers.affectedRows} stragglers in MySQL\n`);
  }

  // Get all contacts that should have "LATAM-ES"
  const [contacts] = await conn.execute(`
    SELECT hubspot_id
    FROM hub_contacts
    WHERE google_ads_campaign = 'LATAM-ES'
  `);

  console.log(`\n📊 Updating ${contacts.length} contacts in HubSpot`);
  console.log('   Setting: google_ads_campaign = "LATAM-ES"\n');

  const contactIds = contacts.map(c => c.hubspot_id);
  const result = await updateHubSpotContacts(contactIds, 'LATAM-ES');

  console.log('\n' + '='.repeat(80));
  console.log('\n📈 HUBSPOT UPDATE SUMMARY:\n');
  console.log(`   ✅ Successfully updated: ${result.successCount} contacts`);
  console.log(`   ❌ Errors: ${result.errorCount} contacts`);
  console.log('\n' + '='.repeat(80) + '\n');

  await conn.end();
})();
