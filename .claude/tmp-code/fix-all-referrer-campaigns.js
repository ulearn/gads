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
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`   Batch ${batchIndex + 1}/${batches.length} (${batch.length} contacts)...`);

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
      console.log(`   ✅ ${batch.length} contacts`);
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

  console.log('\n🔧 COMPREHENSIVE FIX: Extract hsa_cam from First Referrer\n');
  console.log('='.repeat(80));

  // Get ALL PAID_SEARCH contacts where:
  // - First Referrer has hsa_cam
  // - First URL either doesn't have hsa_cam OR is empty
  const [contacts] = await conn.execute(`
    SELECT
      hubspot_id,
      google_ads_campaign,
      hs_analytics_first_url,
      hs_analytics_first_referrer
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND createdate >= '2022-10-01'
      AND hs_analytics_first_referrer LIKE '%hsa_cam=%'
      AND (
        hs_analytics_first_url NOT LIKE '%hsa_cam=%'
        OR hs_analytics_first_url IS NULL
        OR hs_analytics_first_url = ''
      )
  `);

  console.log(`\n📊 Found ${contacts.length} contacts with hsa_cam in First Referrer (not in URL)\n`);

  let updatedCount = 0;
  let alreadyCorrect = 0;
  let notFoundInDb = 0;
  const hubspotUpdates = [];
  const campaignCache = new Map();

  for (const contact of contacts) {
    // Extract campaign ID from First Referrer
    const match = contact.hs_analytics_first_referrer.match(/hsa_cam=([^&\s]*)/);
    if (!match) continue;

    const campaignId = match[1].trim();

    // Skip malformed IDs
    if (!campaignId || campaignId.length > 15 || campaignId.includes('http') || campaignId.includes('%20')) {
      continue;
    }

    // Get canonical campaign name (with caching)
    let canonicalName;
    if (campaignCache.has(campaignId)) {
      canonicalName = campaignCache.get(campaignId);
    } else {
      const [campaign] = await conn.execute(`
        SELECT campaign_name FROM gads_campaigns WHERE google_campaign_id = ?
      `, [campaignId]);

      if (campaign.length > 0) {
        canonicalName = campaign[0].campaign_name;
        campaignCache.set(campaignId, canonicalName);
      } else {
        campaignCache.set(campaignId, null);
        notFoundInDb++;
        continue;
      }
    }

    // Check if already correct
    if (contact.google_ads_campaign === canonicalName) {
      alreadyCorrect++;
      continue;
    }

    // Update MySQL
    await conn.execute(`
      UPDATE hub_contacts
      SET google_ads_campaign = ?
      WHERE hubspot_id = ?
    `, [canonicalName, contact.hubspot_id]);

    updatedCount++;

    // Track for HubSpot update
    hubspotUpdates.push({
      id: contact.hubspot_id,
      campaignName: canonicalName
    });

    // Log first few updates
    if (updatedCount <= 5) {
      console.log(`   ${contact.hubspot_id}: "${contact.google_ads_campaign || 'NULL'}" → "${canonicalName}"`);
    } else if (updatedCount === 6) {
      console.log('   ... (showing first 5 only)');
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📈 MYSQL UPDATE SUMMARY:\n');
  console.log(`   ✅ Updated: ${updatedCount}`);
  console.log(`   ⏭️  Already correct: ${alreadyCorrect}`);
  console.log(`   ⚠️  Campaign not in database: ${notFoundInDb}`);
  console.log(`   📊 Total processed: ${contacts.length}`);

  // Show campaign breakdown
  console.log('\n📋 Campaigns found in First Referrer:\n');
  const sortedCampaigns = Array.from(campaignCache.entries())
    .filter(([id, name]) => name !== null)
    .sort((a, b) => a[1].localeCompare(b[1]));

  sortedCampaigns.slice(0, 15).forEach(([id, name]) => {
    console.log(`   ${id} → "${name}"`);
  });

  if (sortedCampaigns.length > 15) {
    console.log(`   ... and ${sortedCampaigns.length - 15} more`);
  }

  // Update HubSpot
  if (hubspotUpdates.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('\n🔄 UPDATING HUBSPOT:\n');

    const successCount = await updateHubSpotBatch(hubspotUpdates);

    console.log(`\n✅ HubSpot: ${successCount}/${hubspotUpdates.length} contacts updated`);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  await conn.end();
})();
