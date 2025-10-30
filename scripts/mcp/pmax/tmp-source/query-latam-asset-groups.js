const { GoogleAdsApi } = require('google-ads-api');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const googleAdsClient = new GoogleAdsApi({
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  developer_token: process.env.GAdsAPI
});

const account_id = '1051706978';
const customer = googleAdsClient.Customer({
  customer_id: account_id,
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  login_customer_id: process.env.GADS_LIVE_MCC_ID
});

const LATAM_CAMPAIGN_ID = '23202626350';

async function queryAssetGroups() {
  console.log('\n' + '='.repeat(70));
  console.log('QUERYING PMAX-LATAM-ES ASSET GROUPS');
  console.log('='.repeat(70));

  const query = `
    SELECT
      asset_group.id,
      asset_group.name,
      asset_group.status
    FROM asset_group
    WHERE campaign.id = ${LATAM_CAMPAIGN_ID}
    ORDER BY asset_group.id
  `;

  const assetGroups = await customer.query(query);

  console.log(`\nFound ${assetGroups.length} asset groups:\n`);
  assetGroups.forEach((row, i) => {
    console.log(`${i + 1}. Asset Group #${i + 1}`);
    console.log(`   ID: ${row.asset_group.id}`);
    console.log(`   Name: ${row.asset_group.name}`);
    console.log(`   Status: ${row.asset_group.status}`);
    console.log('');
  });

  return assetGroups;
}

async function queryHeadlines(assetGroupId, assetGroupName) {
  console.log('\n' + '='.repeat(70));
  console.log(`HEADLINES: ${assetGroupName}`);
  console.log('='.repeat(70));

  const query = `
    SELECT
      asset.id,
      asset.text_asset.text,
      asset_group_asset.status
    FROM asset_group_asset
    WHERE asset_group.id = ${assetGroupId}
    AND asset_group_asset.field_type = HEADLINE
    AND asset_group_asset.status = ENABLED
  `;

  const headlines = await customer.query(query);

  console.log(`\nFound ${headlines.length} ENABLED headlines:\n`);

  // Check language - English vs Spanish
  const englishHeadlines = [];
  const spanishHeadlines = [];

  headlines.forEach((row, i) => {
    const text = row.asset.text_asset.text;
    // Simple heuristic: if contains common English words, flag as English
    const isEnglish = /\b(school|learn|english|study|dublin|courses?|work|the|and|our|for|with|your)\b/i.test(text);

    if (isEnglish) {
      englishHeadlines.push(row);
      console.log(`${i + 1}. [EN] ${row.asset.id} - ${text}`);
    } else {
      spanishHeadlines.push(row);
      console.log(`${i + 1}. [ES] ${row.asset.id} - ${text}`);
    }
  });

  console.log(`\n📊 Summary:`);
  console.log(`   English: ${englishHeadlines.length}`);
  console.log(`   Spanish: ${spanishHeadlines.length}`);
  console.log(`   Total: ${headlines.length}/15 (min 3, max 15)`);

  if (englishHeadlines.length > 0) {
    console.log(`\n⚠️  ${englishHeadlines.length} English headlines need to be swapped!`);
  } else {
    console.log(`\n✅ All headlines are in Spanish!`);
  }

  return { englishHeadlines, spanishHeadlines, allHeadlines: headlines };
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('CHECK PMAX-LATAM-ES HEADLINES');
  console.log('Focus: Asset Groups #2 and #3');
  console.log('='.repeat(70));

  const assetGroups = await queryAssetGroups();

  if (assetGroups.length < 3) {
    console.error('\n❌ Expected at least 3 asset groups');
    return;
  }

  // Check Asset Group #2
  const ag2 = assetGroups[1]; // Index 1 = second asset group
  const ag2Results = await queryHeadlines(ag2.asset_group.id, ag2.asset_group.name);

  // Check Asset Group #3
  const ag3 = assetGroups[2]; // Index 2 = third asset group
  const ag3Results = await queryHeadlines(ag3.asset_group.id, ag3.asset_group.name);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('OVERALL SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nAsset Group #2: ${ag2Results.englishHeadlines.length} English, ${ag2Results.spanishHeadlines.length} Spanish`);
  console.log(`Asset Group #3: ${ag3Results.englishHeadlines.length} English, ${ag3Results.spanishHeadlines.length} Spanish`);

  const totalEnglish = ag2Results.englishHeadlines.length + ag3Results.englishHeadlines.length;

  if (totalEnglish > 0) {
    console.log(`\n⚠️  Total English headlines to swap: ${totalEnglish}`);
    console.log('\nNext step: Create Spanish headlines and swap them out');
  } else {
    console.log('\n✅ All headlines are already in Spanish!');
  }

  // Export IDs for swap script
  if (totalEnglish > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('ASSET GROUP IDS FOR SWAP SCRIPT');
    console.log('='.repeat(70));
    console.log(`\nAsset Group #2 ID: ${ag2.asset_group.id}`);
    console.log(`Asset Group #3 ID: ${ag3.asset_group.id}`);
  }
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
