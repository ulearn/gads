/**
 * Sync Google Ads Campaign field from MySQL to HubSpot
 * Simple approach: MySQL is source of truth, push all values to HubSpot
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const axios = require('axios');

const HUBSPOT_API_KEY = process.env.HUBSPOT_ACCESS_TOKEN;
const BATCH_SIZE = 100;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateHubSpotBatch(contacts, dryRun = true) {
  if (dryRun) {
    return { updated: contacts.length, errors: 0 };
  }

  const inputs = contacts.map(contact => ({
    id: contact.hubspot_id.toString(),
    properties: {
      google_ads_campaign: contact.google_ads_campaign
    }
  }));

  try {
    const response = await axios.post(
      'https://api.hubapi.com/crm/v3/objects/contacts/batch/update',
      { inputs },
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return { updated: response.data.results.length, errors: 0 };
  } catch (error) {
    console.error(`   ❌ Batch update failed:`, error.response?.data || error.message);
    return { updated: 0, errors: contacts.length };
  }
}

async function syncMySQLToHubSpot(dryRun = true, limit = null) {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('🔄 Syncing google_ads_campaign from MySQL to HubSpot...');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no API calls)' : 'LIVE UPDATE'}`);
  if (limit) {
    console.log(`Limit: ${limit} contacts`);
  }
  console.log();

  // Get all contacts with google_ads_campaign populated in MySQL
  const limitClause = limit ? `LIMIT ${limit}` : '';
  const [contacts] = await connection.execute(`
    SELECT
      hubspot_id,
      email,
      google_ads_campaign
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND google_ads_campaign IS NOT NULL
      AND google_ads_campaign != ''
    ${limitClause}
  `);

  console.log(`📊 Found ${contacts.length} contacts with google_ads_campaign in MySQL`);
  console.log();

  // Process in batches
  const batches = [];
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    batches.push(contacts.slice(i, i + BATCH_SIZE));
  }

  console.log(`📦 Processing ${batches.length} batch(es) of up to ${BATCH_SIZE} contacts`);
  console.log();

  let totalUpdated = 0;
  let totalErrors = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    if (!dryRun) {
      console.log(`⏳ Updating batch ${i + 1}/${batches.length} (${batch.length} contacts)...`);
    }

    const result = await updateHubSpotBatch(batch, dryRun);
    totalUpdated += result.updated;
    totalErrors += result.errors;

    if (!dryRun && i < batches.length - 1) {
      await sleep(200); // Rate limiting
    }

    // Progress update every 10 batches
    if ((i + 1) % 10 === 0) {
      console.log(`   Progress: ${i + 1}/${batches.length} batches (${totalUpdated} contacts updated)`);
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total contacts ${dryRun ? 'to be updated' : 'updated'}: ${totalUpdated}`);
  if (totalErrors > 0) {
    console.log(`Total errors: ${totalErrors}`);
  }

  if (dryRun) {
    console.log();
    console.log('⚠️  This was a DRY RUN - no API calls were made');
    console.log('To apply changes, run: node sync_mysql_to_hubspot_campaigns.js --live');
  } else {
    console.log();
    console.log('✅ All HubSpot updates completed!');
  }

  await connection.end();
  return totalUpdated;
}

// Parse command line arguments
const args = process.argv.slice(2);
const isLive = args.includes('--live');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

// Show usage
if (args.includes('--help')) {
  console.log(`
Sync Google Ads Campaign field from MySQL to HubSpot

Usage:
  node sync_mysql_to_hubspot_campaigns.js [options]

Options:
  --live            Actually update HubSpot via API (default is dry run)
  --limit=N         Only process first N contacts (for testing)

Examples:
  node sync_mysql_to_hubspot_campaigns.js                # Dry run, all contacts
  node sync_mysql_to_hubspot_campaigns.js --limit=100    # Dry run, first 100
  node sync_mysql_to_hubspot_campaigns.js --live         # Live update, all contacts
  `);
  process.exit(0);
}

// Run script
syncMySQLToHubSpot(!isLive, limit)
  .then(count => {
    console.log(`\n✅ Script completed. ${count} contacts processed.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
