/**
 * Update Google Ads Campaign Field (MySQL)
 * Extracts campaign ID from hs_analytics_first_url (hsa_cam parameter)
 * Updates google_ads_campaign to standardized names
 * Leaves hs_analytics_source_data_1 untouched (keeps historical alignment)
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

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

async function updateCampaignNames(dryRun = true, year = null, month = null) {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('🔄 Starting Google Ads Campaign Field Update (MySQL)...');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE UPDATE'}`);
  if (year && month) {
    console.log(`Period: ${year}-${month.toString().padStart(2, '0')}`);
  } else if (year) {
    console.log(`Period: ${year} (all months)`);
  } else {
    console.log(`Period: ALL TIME`);
  }
  console.log();

  let totalUpdated = 0;
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

    // Find contacts with this campaign ID in URL
    const [contacts] = await connection.execute(`
      SELECT
        hubspot_id,
        email,
        google_ads_campaign as current_value,
        hs_analytics_source_data_1 as ogd1_value,
        YEAR(createdate) as year,
        MONTH(createdate) as month
      FROM hub_contacts
      WHERE hs_analytics_source = 'PAID_SEARCH'
        AND (
          hs_analytics_first_url LIKE CONCAT('%hsa_cam=', ?, '%')
          OR hs_analytics_source_data_1 = ?
          OR hs_analytics_source_data_1 LIKE CONCAT(?, '%')
        )
        AND (google_ads_campaign IS NULL OR google_ads_campaign != ?)
        ${dateFilter}
    `, [campaignId, campaignId, campaignId, newName, ...dateParams]);

    if (contacts.length === 0) {
      console.log(`   ℹ️  No contacts need updating`);
      continue;
    }

    console.log(`   📊 Found ${contacts.length} contacts to update`);

    // Show sample
    if (contacts.length > 0) {
      const sample = contacts[0];
      console.log(`   Example: ${sample.email}`);
      console.log(`     OGD-1 (untouched): "${sample.ogd1_value}"`);
      console.log(`     Current google_ads_campaign: "${sample.current_value || 'NULL'}"`);
      console.log(`     New google_ads_campaign: "${newName}"`);
    }

    if (!dryRun) {
      // Execute update
      const [result] = await connection.execute(`
        UPDATE hub_contacts
        SET google_ads_campaign = ?
        WHERE hs_analytics_source = 'PAID_SEARCH'
          AND (
            hs_analytics_first_url LIKE CONCAT('%hsa_cam=', ?, '%')
            OR hs_analytics_source_data_1 = ?
            OR hs_analytics_source_data_1 LIKE CONCAT(?, '%')
          )
          AND (google_ads_campaign IS NULL OR google_ads_campaign != ?)
          ${dateFilter}
      `, [newName, campaignId, campaignId, campaignId, newName, ...dateParams]);

      console.log(`   ✅ Updated ${result.affectedRows} contacts`);
      totalUpdated += result.affectedRows;
      updatesByCampaign[newName] = result.affectedRows;
    } else {
      console.log(`   🔍 Would update ${contacts.length} contacts`);
      totalUpdated += contacts.length;
      updatesByCampaign[newName] = contacts.length;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total contacts ${dryRun ? 'to be updated' : 'updated'}: ${totalUpdated}`);
  console.log();
  console.log('By Campaign:');
  Object.entries(updatesByCampaign).forEach(([name, count]) => {
    console.log(`  ${name.padEnd(35)} : ${count} contacts`);
  });

  if (dryRun) {
    console.log();
    console.log('⚠️  This was a DRY RUN - no changes were made');
    console.log('To apply changes, run: node update_campaign_names.js --live');
  } else {
    console.log();
    console.log('✅ All updates completed successfully!');
    console.log('📝 Note: hs_analytics_source_data_1 (OGD-1) was left unchanged');
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
Google Ads Campaign Field Update Script (MySQL)

Updates the 'google_ads_campaign' field for historical contacts.
Does NOT touch 'hs_analytics_source_data_1' (keeps alignment with HubSpot).

Usage:
  node update_campaign_names.js [options]

Options:
  --live            Actually update records (default is dry run)
  --year=YYYY       Only update contacts from specific year
  --month=MM        Only update contacts from specific month (requires --year)

Examples:
  node update_campaign_names.js                        # Dry run, all time
  node update_campaign_names.js --year=2024            # Dry run, 2024 only
  node update_campaign_names.js --year=2024 --month=1  # Dry run, Jan 2024
  node update_campaign_names.js --live                 # Live update, all time
  `);
  process.exit(0);
}

// Run script
updateCampaignNames(!isLive, year, month)
  .then(count => {
    console.log(`\n✅ Script completed. ${count} contacts processed.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
