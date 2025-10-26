const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const BATCH_SIZE = 100;

async function updateHubSpotContacts(contactIds, updates) {
  const batches = [];
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    batches.push(updates.slice(i, i + BATCH_SIZE));
  }

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`   Batch ${i + 1}/${batches.length} (${batch.length} contacts)...`);

    const inputs = batch.map(update => ({
      id: update.id.toString(),
      properties: {
        google_ads_campaign: update.campaignName
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
      console.log(`   ✅ ${response.data.results.length} contacts`);

    } catch (error) {
      errorCount += batch.length;
      console.error(`   ❌ Error: ${error.response?.data?.message || error.message}`);
    }

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

  console.log('\n📅 BACKFILLING 2023 CAMPAIGN ATTRIBUTION\n');
  console.log('='.repeat(80));

  // Get all 2023 contacts with NULL campaign that have hsa_cam
  const [contacts] = await conn.execute(`
    SELECT
      hubspot_id,
      google_ads_campaign,
      SUBSTRING_INDEX(SUBSTRING_INDEX(hs_analytics_first_url, 'hsa_cam=', -1), '&', 1) as url_campaign_id
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND (google_ads_campaign IS NULL OR google_ads_campaign = '')
      AND createdate >= '2023-01-01' AND createdate < '2024-01-01'
      AND hs_analytics_first_url LIKE '%hsa_cam=%'
  `);

  console.log(`\n📊 Found ${contacts.length} contacts from 2023 with campaign IDs\n`);

  // Build campaign ID to name mapping
  const campaignMap = new Map();
  let updateCount = 0;
  let notFoundCount = 0;
  const hubspotUpdates = [];

  for (const contact of contacts) {
    const campaignId = contact.url_campaign_id;

    // Skip malformed IDs
    if (!campaignId || campaignId.length > 15 || campaignId.includes('http') || campaignId.includes('%20')) {
      continue;
    }

    // Get canonical name (with caching)
    let canonicalName;
    if (campaignMap.has(campaignId)) {
      canonicalName = campaignMap.get(campaignId);
    } else {
      const [gadsName] = await conn.execute(`
        SELECT campaign_name
        FROM gads_campaigns
        WHERE google_campaign_id = ?
      `, [campaignId]);

      if (gadsName.length > 0) {
        canonicalName = gadsName[0].campaign_name;
        campaignMap.set(campaignId, canonicalName);
      } else {
        campaignMap.set(campaignId, null);
        notFoundCount++;
        continue;
      }
    }

    // Update MySQL
    await conn.execute(`
      UPDATE hub_contacts
      SET google_ads_campaign = ?
      WHERE hubspot_id = ?
    `, [canonicalName, contact.hubspot_id]);

    updateCount++;

    // Track for HubSpot update
    hubspotUpdates.push({
      id: contact.hubspot_id,
      campaignName: canonicalName
    });
  }

  console.log('='.repeat(80));
  console.log('\n📈 MYSQL UPDATE SUMMARY (2023):\n');
  console.log(`   ✅ Updated: ${updateCount} contacts`);
  console.log(`   ⚠️  Campaign not found: ${notFoundCount} contacts`);

  // Update HubSpot
  if (hubspotUpdates.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('\n🔄 UPDATING HUBSPOT (2023):\n');

    const result = await updateHubSpotContacts(null, hubspotUpdates);

    console.log('\n📈 HUBSPOT UPDATE SUMMARY (2023):\n');
    console.log(`   ✅ Successfully updated: ${result.successCount} contacts`);
    console.log(`   ❌ Errors: ${result.errorCount} contacts`);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  await conn.end();
})();
