const mysql = require('mysql2/promise');
require('dotenv').config();

// Campaign ID to Canonical Name mapping (from user)
const CAMPAIGN_MAPPING = {
  '32907697': 'Spain-LATAM-ES',
  '239036407': 'Remarket-Display (Obs)',
  '1051942797': 'Intl-DP-Smart',
  '21724696965': 'Brazil-DP-InMkt',
  '21728244988': 'Mexico-DP-InMkt',
  '21724696938': 'Colombia-DP-InMkt',
  '21724696935': 'Argentina-DP-InMkt',
  '21739044681': 'Ecuador-DP-InMkt',
  '21755031732': 'Chile-DP-InMkt',
  '21739044678': 'Peru-DP-InMkt',
  '21739044684': 'Venezuela-DP-InMkt',
  '32873407': 'Portugal-PT',
  '22097290049': '1. Search-EN Countries',
  '35128987': '1. Search-Dublin-Gnrl Terms_EN',
  '35154707': '1. Search-Cork-Gnrl Terms_EN',
  '21787838733': '1. Search-IRL-Brand',
  '21787830393': '1. Search-EN-CompMegaSchools'
};

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('\n🔍 Starting campaign attribution update from URLs...\n');
  console.log('='.repeat(70));

  // Get all contacts with NULL google_ads_campaign that have hsa_cam in URL
  const [contacts] = await conn.execute(`
    SELECT hubspot_id, hs_analytics_first_url, createdate
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND (google_ads_campaign IS NULL OR google_ads_campaign = '')
      AND createdate >= '2025-01-01'
      AND hs_analytics_first_url LIKE '%hsa_cam=%'
  `);

  console.log(`\n📊 Found ${contacts.length} contacts with hsa_cam in URL\n`);

  let successCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;
  const notFoundCampaigns = new Set();

  for (const contact of contacts) {
    try {
      // Extract campaign ID from URL
      const url = contact.hs_analytics_first_url;
      const hsaCamMatch = url.match(/hsa_cam=([^&]*)/);

      if (!hsaCamMatch) {
        console.log(`⚠️  Contact ${contact.hubspot_id}: No hsa_cam found in URL`);
        errorCount++;
        continue;
      }

      const campaignId = hsaCamMatch[1];
      const canonicalName = CAMPAIGN_MAPPING[campaignId];

      if (!canonicalName) {
        notFoundCampaigns.add(campaignId);
        notFoundCount++;
        continue;
      }

      // Update the contact
      await conn.execute(`
        UPDATE hub_contacts
        SET google_ads_campaign = ?
        WHERE hubspot_id = ?
      `, [canonicalName, contact.hubspot_id]);

      successCount++;

      if (successCount <= 5) {
        console.log(`✅ Contact ${contact.hubspot_id}: hsa_cam=${campaignId} → "${canonicalName}"`);
      } else if (successCount === 6) {
        console.log('   ... (showing first 5 only)');
      }

    } catch (err) {
      console.error(`❌ Error updating contact ${contact.hubspot_id}:`, err.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n📈 Update Summary:\n');
  console.log(`   ✅ Successfully updated: ${successCount} contacts`);
  console.log(`   ⚠️  Campaign ID not in mapping: ${notFoundCount} contacts`);
  console.log(`   ❌ Errors: ${errorCount} contacts`);

  if (notFoundCampaigns.size > 0) {
    console.log('\n🔍 Campaign IDs not found in mapping:');
    notFoundCampaigns.forEach(id => {
      // Count how many contacts have this campaign
      const count = contacts.filter(c =>
        c.hs_analytics_first_url.includes(`hsa_cam=${id}`)
      ).length;
      console.log(`   ${id} (${count} contacts)`);
    });
  }

  console.log('\n' + '='.repeat(70) + '\n');

  await conn.end();
})();
