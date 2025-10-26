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

  console.log('\n🔧 FIXING UNATTRIBUTED PAID SEARCH CONTACTS\n');
  console.log('='.repeat(80));

  // Get all PAID_SEARCH contacts without google_ads_campaign
  const [contacts] = await conn.execute(`
    SELECT
      hubspot_id,
      hs_analytics_source_data_1,
      hs_analytics_first_url,
      hs_analytics_first_referrer
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND (google_ads_campaign IS NULL OR google_ads_campaign = '')
  `);

  console.log(`\n📊 Found ${contacts.length} PAID_SEARCH contacts without google_ads_campaign\n`);

  let fixedByHsaCam = 0;
  let fixedBySourceData1 = 0;
  let setToUnknown = 0;
  const hubspotUpdates = [];
  const campaignCache = new Map();

  for (const contact of contacts) {
    let campaignName = null;

    // PRIORITY 1: Extract hsa_cam from First Page Seen URL
    if (contact.hs_analytics_first_url && contact.hs_analytics_first_url.includes('hsa_cam=')) {
      const match = contact.hs_analytics_first_url.match(/hsa_cam=([^&\s]*)/);
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
            fixedByHsaCam++;
          }
        }
      }
    }

    // PRIORITY 2: Use source_data_1 if available and valid
    if (!campaignName && contact.hs_analytics_source_data_1 &&
        contact.hs_analytics_source_data_1 !== '' &&
        contact.hs_analytics_source_data_1 !== '{campaign}') {
      campaignName = contact.hs_analytics_source_data_1;
      fixedBySourceData1++;
    }

    // PRIORITY 3: Set to "Unknown" if truly unattributable
    if (!campaignName) {
      campaignName = 'Campaign Unknown';
      setToUnknown++;
    }

    // Update MySQL
    await conn.execute(`
      UPDATE hub_contacts
      SET google_ads_campaign = ?
      WHERE hubspot_id = ?
    `, [campaignName, contact.hubspot_id]);

    // Track for HubSpot update
    hubspotUpdates.push({
      id: contact.hubspot_id,
      campaignName: campaignName
    });
  }

  console.log('='.repeat(80));
  console.log('\n📈 MYSQL UPDATE SUMMARY:\n');
  console.log(`   ✅ Fixed via hsa_cam extraction: ${fixedByHsaCam}`);
  console.log(`   ✅ Fixed via source_data_1: ${fixedBySourceData1}`);
  console.log(`   ⚠️  Set to "Campaign Unknown": ${setToUnknown}`);
  console.log(`   📊 Total updated: ${contacts.length}`);

  // Update HubSpot
  if (hubspotUpdates.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('\n🔄 UPDATING HUBSPOT...\n');

    const successCount = await updateHubSpotBatch(hubspotUpdates);

    console.log(`\n✅ HubSpot: ${successCount}/${hubspotUpdates.length} contacts updated`);
  }

  // Show breakdown of "Unknown" contacts
  if (setToUnknown > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('\n⚠️  CONTACTS SET TO "Campaign Unknown":\n');

    const [unknownContacts] = await conn.execute(`
      SELECT hubspot_id, hs_analytics_first_url
      FROM hub_contacts
      WHERE google_ads_campaign = 'Campaign Unknown'
      LIMIT 10
    `);

    unknownContacts.forEach((c, i) => {
      console.log(`${i + 1}. Contact ${c.hubspot_id}`);
      console.log(`   First URL: ${c.hs_analytics_first_url || 'NULL'}`);
    });

    if (setToUnknown > 10) {
      console.log(`   ... and ${setToUnknown - 10} more`);
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');

  await conn.end();
})();
