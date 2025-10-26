/**
 * Update Remaining Contacts using OTSDrilldown-1 Variants
 * Matches variant names from hs_analytics_source_data_1 to canonical campaign names
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

// Comprehensive mapping of ALL known variant names to canonical names
// Based on campaign_evolution_final.csv and historical data
const VARIANT_TO_CANONICAL = {
  // Campaign 32907697 - Spain-LATAM-ES
  'spanish - es': 'Spain-LATAM-ES',
  'spain & latam - es - leads': 'Spain-LATAM-ES',
  '1. search - spain - es': 'Spain-LATAM-ES',
  '1_search.spain-latam_es': 'Spain-LATAM-ES',
  '1.search-spain_es': 'Spain-LATAM-ES',

  // Campaign 239036407 - Remarket-Display (Obs&Place)
  'dp:remarketing': 'Remarket-Display (Obs&Place)',
  '04. display - remarketing': 'Remarket-Display (Obs&Place)',
  '2dsply-rmrktng--obs placmnts': 'Remarket-Display (Obs&Place)',
  '2. display - remarketing (observation + placements)': 'Remarket-Display (Obs&Place)',

  // Campaign 1051942797 - Intl-DP-Smart
  'dp:smart campaign': 'Intl-DP-Smart',
  '04. display - smart targeting: intl-dp': 'Intl-DP-Smart',
  '2. display - smart targeting: intl-dp': 'Intl-DP-Smart',

  // Campaign 35203507 - Dublin-EN-GnrlTerms
  'dublin - en - gnrl terms': 'Dublin-EN-GnrlTerms',
  'ireland - en - gnrl terms': 'Dublin-EN-GnrlTerms',
  'ireland - en - gnrl terms "ireland/dublin"': 'Dublin-EN-GnrlTerms',
  '1.search-ireland-gnrlterms "ireland/dublin"_en': 'Dublin-EN-GnrlTerms',
  'searchdublin-gnrlterms_en': 'Dublin-EN-GnrlTerms',
  'gnrltermsen': 'Dublin-EN-GnrlTerms',
  '1. search - ireland - gnrl terms "ireland/dublin" - en': 'Dublin-EN-GnrlTerms',

  // Campaign 35127547 - Ireland-ES
  'ireland - es': 'Ireland-ES',
  '02. search - ireland - es': 'Ireland-ES',
  '1. search - ireland - es': 'Ireland-ES',

  // Campaign 17486528534 - Intl-DGen-Disco
  'dgen-int-dscvry-leads': 'Intl-DGen-Disco',
  'intrnl-discovery-leads': 'Intl-DGen-Disco',
  '4. demand gen - intrnl-discovery-leads': 'Intl-DGen-Disco',

  // Campaign 682598152 - Intl-DP-InMarket
  'dp:influence': 'Intl-DP-InMarket',
  '04. display - awareness: intl - in-market - dp': 'Intl-DP-InMarket',
  '2. display - in-market - intrntl': 'Intl-DP-InMarket',

  // Campaign 20774719371 - France-FR
  'france - fr': 'France-FR',
  '02. search - france - fr': 'France-FR',
  '1. search - france - fr': 'France-FR',

  // Campaign 20884739698 - Germany-DE
  'german - de': 'Germany-DE',
  'germany - de': 'Germany-DE',
  '1. search - german - de': 'Germany-DE',

  // Campaign 35203687 - Spain-EN
  'spanish - en': 'Spain-EN',
  'spain - en': 'Spain-EN',
  '1. search - spain - en': 'Spain-EN',

  // Campaign 17440682130 - Pmax-Ireland
  'irl-perfom-max': 'Pmax-Ireland',
  '3pmax': 'Pmax-Ireland',
  '3.pmax(new)-ireland_es': 'Pmax-Ireland',
  '3. perfomance max': 'Pmax-Ireland',

  // Campaign 695837889 - Dublin-DynamicSearch
  'dublin - dynamic search': 'Dublin-DynamicSearch',
  '02. search - dublin - dsas - dynamic search': 'Dublin-DynamicSearch',
  '1_searchdublin.dynamic': 'Dublin-DynamicSearch',
  '1. search - dublin - dsas - dynamic search': 'Dublin-DynamicSearch',

  // Campaign 70252567 - Dublin-Exams-EN
  'ireland - en - exam courses': 'Dublin-Exams-EN',
  '02. search - dublin - exam courses - en': 'Dublin-Exams-EN',

  // Campaign 35127997 - Ireland-IT
  'ireland - it': 'Ireland-IT',

  // Campaign 149491087 - Brazil-GnrlTerms-POR
  'brazil - por - gnrl terms': 'Brazil-GnrlTerms-POR',
  '1. search - brazil (por) - gnrl terms': 'Brazil-GnrlTerms-POR',

  // Campaign 21010812408 - PMax(new)-Ireland-ES
  'performance max (new) - ireland - es': 'PMax(new)-Ireland-ES',
  '3. performance max (new) - ireland - es': 'PMax(new)-Ireland-ES',

  // Other campaigns
  'ww:remarketing': 'Remarket-Search',
  'remarketing (search)': 'Remarket-Search'
};

async function updateRemainingContacts(dryRun = true) {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('🔄 Updating Remaining Contacts (Variant Name Matching)...');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE UPDATE'}`);
  console.log();

  let totalUpdated = 0;
  const updatesByCampaign = {};

  for (const [variantName, canonicalName] of Object.entries(VARIANT_TO_CANONICAL)) {
    // Find contacts with this variant name but blank google_ads_campaign
    const [contacts] = await connection.execute(`
      SELECT
        hubspot_id,
        email,
        hs_analytics_source_data_1,
        YEAR(createdate) as year
      FROM hub_contacts
      WHERE hs_analytics_source = 'PAID_SEARCH'
        AND LOWER(hs_analytics_source_data_1) = LOWER(?)
        AND (google_ads_campaign IS NULL OR google_ads_campaign = '')
    `, [variantName]);

    if (contacts.length === 0) continue;

    console.log(`\n📋 Found ${contacts.length} contacts with "${variantName}" → "${canonicalName}"`);

    // Show sample
    if (contacts.length > 0) {
      const sample = contacts[0];
      console.log(`   Example: ${sample.email} (${sample.year})`);
    }

    if (!dryRun) {
      const [result] = await connection.execute(`
        UPDATE hub_contacts
        SET google_ads_campaign = ?
        WHERE hs_analytics_source = 'PAID_SEARCH'
          AND LOWER(hs_analytics_source_data_1) = LOWER(?)
          AND (google_ads_campaign IS NULL OR google_ads_campaign = '')
      `, [canonicalName, variantName]);

      console.log(`   ✅ Updated ${result.affectedRows} contacts`);
      totalUpdated += result.affectedRows;
      updatesByCampaign[canonicalName] = (updatesByCampaign[canonicalName] || 0) + result.affectedRows;
    } else {
      console.log(`   🔍 Would update ${contacts.length} contacts`);
      totalUpdated += contacts.length;
      updatesByCampaign[canonicalName] = (updatesByCampaign[canonicalName] || 0) + contacts.length;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total contacts ${dryRun ? 'to be updated' : 'updated'}: ${totalUpdated}`);
  console.log();
  console.log('By Campaign:');
  Object.entries(updatesByCampaign)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      console.log(`  ${name.padEnd(35)} : ${count} contacts`);
    });

  // Check how many still remain
  const [remaining] = await connection.execute(`
    SELECT COUNT(*) as count
    FROM hub_contacts
    WHERE hs_analytics_source = 'PAID_SEARCH'
      AND (google_ads_campaign IS NULL OR google_ads_campaign = '')
  `);

  console.log();
  console.log(`Remaining contacts without google_ads_campaign: ${remaining[0].count}`);

  if (dryRun) {
    console.log();
    console.log('⚠️  This was a DRY RUN - no changes were made');
    console.log('To apply changes, run: node update_remaining_campaigns.js --live');
  }

  await connection.end();
  return totalUpdated;
}

// Parse command line arguments
const args = process.argv.slice(2);
const isLive = args.includes('--live');

// Run script
updateRemainingContacts(!isLive)
  .then(count => {
    console.log(`\n✅ Script completed. ${count} contacts processed.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
