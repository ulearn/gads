/**
 * Update Google Ads Campaign Field (HubSpot API)
 * Updates the google_ads_campaign custom property via HubSpot API
 * Processes contacts from MySQL that need HubSpot updates
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const axios = require('axios');

// Campaign ID to Standardized Name Mapping
const CAMPAIGN_MAPPING = {
  '32907697': 'Spain-LATAM-ES',
  '239036407': 'Remarket-Display (Obs&Place)',
  '1051942797': 'Intl-DP-Smart',
  '35203507': 'Dublin-EN-GnrlTerms',
  '35127547': 'Ireland-ES',
  '17486528534': 'Intl-DGen-Disco',
  '682598152': 'Intl-DP-InMarket',
  '20774719371': 'France-FR',
  '20884739698': 'Germany-DE',
  '35203687': 'Spain-EN',
  '17440682130': 'Pmax-Ireland',
  '695837889': 'Dublin-DynamicSearch',
  '70252567': 'Dublin-Exams-EN',
  '35127997': 'Ireland-IT',
  '149491087': 'Brazil-GnrlTerms-POR',
  '21010812408': 'PMax(new)-Ireland-ES'
};

const HUBSPOT_API_KEY = process.env.HUBSPOT_ACCESS_TOKEN;
const BATCH_SIZE = 100; // HubSpot API batch limit

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
      google_ads_campaign: contact.new_campaign_name
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

async function updateHubSpotCampaignNames(dryRun = true, year = null, month = null) {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('🔄 Starting Google Ads Campaign Field Update (HubSpot API)...');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no API calls)' : 'LIVE UPDATE'}`);
  if (year && month) {
    console.log(`Period: ${year}-${month.toString().padStart(2, '0')}`);
  } else if (year) {
    console.log(`Period: ${year} (all months)`);
  } else {
    console.log(`Period: ALL TIME`);
  }
  console.log();

  let totalUpdated = 0;
  let totalErrors = 0;
  const updatesByCampaign = {};

  // Build date filter
  let dateFilter = '';
  let dateParams = [];
  if (year && month) {
    dateFilter = ' AND YEAR(createdate) = ? AND MONTH(createdate) = ?';
    dateParams = [year, month];
  } else if (year) {
    dateFilter = ' AND YEAR(createdate) = ?';
    dateParams = [year];
  }

  for (const [campaignId, newName] of Object.entries(CAMPAIGN_MAPPING)) {
    console.log(`\n📋 Processing Campaign ID: ${campaignId} -> "${newName}"`);

    // Find contacts that need updating in HubSpot
    const [contacts] = await connection.execute(`
      SELECT
        hubspot_id,
        email
      FROM hub_contacts
      WHERE hs_analytics_source = 'PAID_SEARCH'
        AND (
          hs_analytics_first_url LIKE CONCAT('%hsa_cam=', ?, '%')
          OR hs_analytics_source_data_1 = ?
          OR hs_analytics_source_data_1 LIKE CONCAT(?, '%')
        )
        ${dateFilter}
    `, [campaignId, campaignId, campaignId, ...dateParams]);

    if (contacts.length === 0) {
      console.log(`   ℹ️  No contacts to update`);
      continue;
    }

    console.log(`   📊 Found ${contacts.length} contacts to update`);

    // Add campaign name to each contact
    const contactsWithCampaign = contacts.map(c => ({
      ...c,
      new_campaign_name: newName
    }));

    // Process in batches
    const batches = [];
    for (let i = 0; i < contactsWithCampaign.length; i += BATCH_SIZE) {
      batches.push(contactsWithCampaign.slice(i, i + BATCH_SIZE));
    }

    console.log(`   📦 Processing ${batches.length} batch(es) of up to ${BATCH_SIZE} contacts`);

    let campaignUpdated = 0;
    let campaignErrors = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      if (!dryRun) {
        console.log(`   ⏳ Updating batch ${i + 1}/${batches.length} (${batch.length} contacts)...`);
      }

      const result = await updateHubSpotBatch(batch, dryRun);
      campaignUpdated += result.updated;
      campaignErrors += result.errors;

      if (!dryRun && i < batches.length - 1) {
        // Rate limiting: wait between batches
        await sleep(200);
      }
    }

    if (dryRun) {
      console.log(`   🔍 Would update ${campaignUpdated} contacts in HubSpot`);
    } else {
      console.log(`   ✅ Updated ${campaignUpdated} contacts in HubSpot`);
      if (campaignErrors > 0) {
        console.log(`   ⚠️  ${campaignErrors} errors occurred`);
      }
    }

    totalUpdated += campaignUpdated;
    totalErrors += campaignErrors;
    updatesByCampaign[newName] = campaignUpdated;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total contacts ${dryRun ? 'to be updated' : 'updated'}: ${totalUpdated}`);
  if (totalErrors > 0) {
    console.log(`Total errors: ${totalErrors}`);
  }
  console.log();
  console.log('By Campaign:');
  Object.entries(updatesByCampaign).forEach(([name, count]) => {
    console.log(`  ${name.padEnd(35)} : ${count} contacts`);
  });

  if (dryRun) {
    console.log();
    console.log('⚠️  This was a DRY RUN - no API calls were made');
    console.log('To apply changes, run: node update_hubspot_campaign_names.js --live');
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
const yearArg = args.find(arg => arg.startsWith('--year='));
const monthArg = args.find(arg => arg.startsWith('--month='));

const year = yearArg ? parseInt(yearArg.split('=')[1]) : null;
const month = monthArg ? parseInt(monthArg.split('=')[1]) : null;

// Show usage if needed
if (args.includes('--help')) {
  console.log(`
Google Ads Campaign Field Update Script (HubSpot API)

Updates the 'google_ads_campaign' custom property via HubSpot API.
Processes contacts in batches of ${BATCH_SIZE}.

Usage:
  node update_hubspot_campaign_names.js [options]

Options:
  --live            Actually update HubSpot via API (default is dry run)
  --year=YYYY       Only update contacts from specific year
  --month=MM        Only update contacts from specific month (requires --year)

Examples:
  node update_hubspot_campaign_names.js                        # Dry run, all time
  node update_hubspot_campaign_names.js --year=2024            # Dry run, 2024 only
  node update_hubspot_campaign_names.js --year=2024 --month=1  # Dry run, Jan 2024
  node update_hubspot_campaign_names.js --live                 # Live update, all time
  `);
  process.exit(0);
}

// Run script
updateHubSpotCampaignNames(!isLive, year, month)
  .then(count => {
    console.log(`\n✅ Script completed. ${count} contacts processed.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
