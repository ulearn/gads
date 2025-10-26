const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const BATCH_SIZE = 100;

async function updateHubSpotBatch(updates) {
  const batches = [];
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    batches.push(updates.slice(i, i + BATCH_SIZE));
  }

  let successCount = 0;
  for (const batch of batches) {
    const inputs = batch.map(u => ({
      id: u.id.toString(),
      properties: { google_ads_campaign: u.campaignName }
    }));

    try {
      await axios.post(
        'https://api.hubapi.com/crm/v3/objects/contacts/batch/update',
        { inputs },
        { headers: { 'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }
      );
      successCount += batch.length;
    } catch (error) {
      console.error(`   ❌ Batch error: ${error.response?.data?.message || error.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return successCount;
}

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('\n🔧 FIXING "Campaign Unknown" CONTACTS (V2 - Check First Referrer)\n');
  console.log('='.repeat(80));

  // Get contacts currently set to "Campaign Unknown"
  const [contacts] = await conn.execute(`
    SELECT
      hubspot_id,
      hs_analytics_source_data_1,
      hs_analytics_first_url,
      hs_analytics_first_referrer
    FROM hub_contacts
    WHERE google_ads_campaign = 'Campaign Unknown'
  `);

  console.log(`\n📊 Found ${contacts.length} contacts with "Campaign Unknown"\n`);

  let fixedCount = 0;
  const hubspotUpdates = [];
  const campaignCache = new Map();

  for (const contact of contacts) {
    let campaignName = null;

    // Check BOTH First URL and First Referrer for hsa_cam
    const urlsToCheck = [
      contact.hs_analytics_first_url,
      contact.hs_analytics_first_referrer
    ];

    for (const url of urlsToCheck) {
      if (url && url.includes('hsa_cam=')) {
        const match = url.match(/hsa_cam=([^&\s]*)/);
        if (match) {
          const campaignId = match[1].trim();

          // Skip malformed IDs
          if (campaignId && campaignId.length <= 15 && !campaignId.includes('http') && !campaignId.includes('%20')) {
            // Get campaign name (with caching)
            if (campaignCache.has(campaignId)) {
              campaignName = campaignCache.get(campaignId);
            } else {
              const [campaign] = await conn.execute(`
                SELECT campaign_name FROM gads_campaigns WHERE google_campaign_id = ?
              `, [campaignId]);

              if (campaign.length > 0) {
                campaignName = campaign[0].campaign_name;
                campaignCache.set(campaignId, campaignName);
              } else {
                campaignCache.set(campaignId, null);
              }
            }

            if (campaignName) {
              break; // Found it, stop searching
            }
          }
        }
      }
    }

    // If we found a campaign name, update it
    if (campaignName) {
      await conn.execute(`
        UPDATE hub_contacts
        SET google_ads_campaign = ?
        WHERE hubspot_id = ?
      `, [campaignName, contact.hubspot_id]);

      hubspotUpdates.push({
        id: contact.hubspot_id,
        campaignName: campaignName
      });

      fixedCount++;
    }
  }

  console.log('='.repeat(80));
  console.log('\n📈 MYSQL UPDATE SUMMARY:\n');
  console.log(`   ✅ Fixed by checking First Referrer: ${fixedCount}`);
  console.log(`   ⚠️  Still "Campaign Unknown": ${contacts.length - fixedCount}`);

  // Update HubSpot
  if (hubspotUpdates.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('\n🔄 UPDATING HUBSPOT...\n');

    const successCount = await updateHubSpotBatch(hubspotUpdates);

    console.log(`\n✅ HubSpot: ${successCount}/${hubspotUpdates.length} contacts updated`);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  await conn.end();
})();
