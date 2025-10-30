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

const BRAZIL_CAMPAIGN_ID = '23202585091';

async function getAssetGroups() {
  const query = `
    SELECT
      asset_group.id,
      asset_group.name,
      asset_group.status
    FROM asset_group
    WHERE campaign.id = ${BRAZIL_CAMPAIGN_ID}
    ORDER BY asset_group.id
  `;

  return await customer.query(query);
}

async function queryHeadlines(assetGroupId, assetGroupName) {
  console.log('='.repeat(70));
  console.log(`${assetGroupName} - HEADLINE Assets (30 char)`);
  console.log('='.repeat(70));

  const query = `
    SELECT
      asset.id,
      asset.text_asset.text,
      asset_group_asset.status,
      asset_group_asset.resource_name
    FROM asset_group_asset
    WHERE asset_group.id = ${assetGroupId}
    AND asset_group_asset.field_type = HEADLINE
    AND asset_group_asset.status = ENABLED
  `;

  const headlines = await customer.query(query);

  console.log(`\nFound ${headlines.length} ENABLED HEADLINE assets:\n`);

  // Detect English vs Portuguese
  const englishHeadlines = [];
  const portugueseHeadlines = [];

  headlines.forEach((row, i) => {
    const text = row.asset.text_asset.text;
    // Heuristic: common English words
    const isEnglish = /\b(school|learn|english|study|dublin|courses?|work|the|and|our|for|with|your|free|wifi|guarantee|central|location)\b/i.test(text);

    if (isEnglish) {
      englishHeadlines.push(row);
      console.log(`${i + 1}. [EN] ${row.asset.id} - "${text}"`);
    } else {
      portugueseHeadlines.push(row);
      console.log(`${i + 1}. [PT] ${row.asset.id} - "${text}"`);
    }
  });

  console.log(`\n📊 Summary:`);
  console.log(`   English: ${englishHeadlines.length}`);
  console.log(`   Portuguese: ${portugueseHeadlines.length}`);
  console.log(`   Total: ${headlines.length}/15 (min 3, max 15)`);

  if (englishHeadlines.length > 0) {
    console.log(`\n⚠️  ${englishHeadlines.length} English headlines need to be swapped!\n`);
  } else {
    console.log(`\n✅ All headlines are in Portuguese!\n`);
  }

  return { englishHeadlines, portugueseHeadlines, allHeadlines: headlines };
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('CHECK BRAZIL CAMPAIGN HEADLINE (30 char) ASSETS');
  console.log('Focus: Asset Groups #2 and #3');
  console.log('Campaign: PMax-Brazil-POR (23202585091)');
  console.log('='.repeat(70));

  const assetGroups = await getAssetGroups();

  console.log(`\nFound ${assetGroups.length} asset groups:\n`);
  assetGroups.forEach((ag, i) => {
    console.log(`${i + 1}. ${ag.asset_group.name} (ID: ${ag.asset_group.id})`);
  });

  if (assetGroups.length < 3) {
    console.error('\n❌ Expected at least 3 asset groups');
    return;
  }

  console.log('\n');

  // Check Asset Group #2
  const ag2 = assetGroups[1];
  const ag2Results = await queryHeadlines(ag2.asset_group.id, `Asset Group #2: ${ag2.asset_group.name}`);

  // Check Asset Group #3
  const ag3 = assetGroups[2];
  const ag3Results = await queryHeadlines(ag3.asset_group.id, `Asset Group #3: ${ag3.asset_group.name}`);

  // Summary
  console.log('='.repeat(70));
  console.log('OVERALL SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nAsset Group #2: ${ag2Results.englishHeadlines.length} English, ${ag2Results.portugueseHeadlines.length} Portuguese`);
  console.log(`Asset Group #3: ${ag3Results.englishHeadlines.length} English, ${ag3Results.portugueseHeadlines.length} Portuguese`);

  const totalEnglish = ag2Results.englishHeadlines.length + ag3Results.englishHeadlines.length;

  if (totalEnglish > 0) {
    console.log(`\n⚠️  Total English HEADLINE assets to swap: ${totalEnglish}`);
    console.log('\nNext step: Create Portuguese headlines and swap them out');

    console.log('\n' + '='.repeat(70));
    console.log('ASSET GROUP IDS FOR SWAP SCRIPT');
    console.log('='.repeat(70));
    console.log(`\nAsset Group #2: ${ag2.asset_group.id} (${ag2.asset_group.name})`);
    console.log(`Asset Group #3: ${ag3.asset_group.id} (${ag3.asset_group.name})`);
  } else {
    console.log('\n✅ All HEADLINE assets are already in Portuguese!');
  }
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
