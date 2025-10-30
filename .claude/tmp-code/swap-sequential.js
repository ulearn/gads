const { GoogleAdsApi } = require('google-ads-api');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

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

// Portuguese Long Headlines
const PORTUGUESE_LONG_HEADLINES = [
  '303954226027', '303867879563', '303954232465',
  '303954226129', '303954239821'
];

// Portuguese Descriptions
const PORTUGUESE_DESCRIPTIONS = [
  '303954238030', '303954239908', '303977566353',
  '303954240841', '303954238150'
];

async function swapLongHeadlines(assetGroupId, assetGroupName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`SWAPPING LONG HEADLINES: ${assetGroupName}`);
  console.log('='.repeat(70));

  // Step 1: Query current long headlines
  const query = `
    SELECT
      asset.id,
      asset_group_asset.resource_name
    FROM asset_group_asset
    WHERE asset_group.id = ${assetGroupId}
    AND asset_group_asset.field_type = LONG_HEADLINE
  `;

  let currentAssets;
  try {
    currentAssets = await customer.query(query);
  } catch (error) {
    console.error('ERROR querying:', error.message);
    return false;
  }

  console.log(`Found ${currentAssets.length} existing long headlines`);

  // Step 2: Remove all current long headlines (we'll add Portuguese ones back)
  if (currentAssets.length > 0) {
    const resourceNames = currentAssets.map(a => a.asset_group_asset.resource_name);
    console.log(`Removing ${resourceNames.length} existing long headlines...`);

    try {
      await customer.assetGroupAssets.remove(resourceNames);
      console.log(`✅ Removed successfully`);
    } catch (error) {
      console.error(`❌ Remove failed:`, error.message);
      if (error.errors) {
        error.errors.forEach((err, i) => console.error(`  Error ${i + 1}:`, err.message));
      }
      return false;
    }
  }

  // Step 3: Add Portuguese long headlines
  console.log(`\nAdding ${PORTUGUESE_LONG_HEADLINES.length} Portuguese long headlines...`);

  const createOperations = PORTUGUESE_LONG_HEADLINES.map(assetId => ({
    asset_group: `customers/${account_id}/assetGroups/${assetGroupId}`,
    asset: `customers/${account_id}/assets/${assetId}`,
    field_type: 'LONG_HEADLINE'
  }));

  try {
    await customer.assetGroupAssets.create(createOperations);
    console.log(`✅ Added successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Add failed:`, error.message);
    if (error.errors) {
      error.errors.forEach((err, i) => console.error(`  Error ${i + 1}:`, err.message));
    }
    return false;
  }
}

async function swapDescriptions(assetGroupId, assetGroupName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`SWAPPING DESCRIPTIONS: ${assetGroupName}`);
  console.log('='.repeat(70));

  // Step 1: Query current descriptions
  const query = `
    SELECT
      asset.id,
      asset_group_asset.resource_name
    FROM asset_group_asset
    WHERE asset_group.id = ${assetGroupId}
    AND asset_group_asset.field_type = DESCRIPTION
  `;

  let currentAssets;
  try {
    currentAssets = await customer.query(query);
  } catch (error) {
    console.error('ERROR querying:', error.message);
    return false;
  }

  console.log(`Found ${currentAssets.length} existing descriptions`);

  // Step 2: Remove all current descriptions (we'll add Portuguese ones back)
  if (currentAssets.length > 0) {
    const resourceNames = currentAssets.map(a => a.asset_group_asset.resource_name);
    console.log(`Removing ${resourceNames.length} existing descriptions...`);

    try {
      await customer.assetGroupAssets.remove(resourceNames);
      console.log(`✅ Removed successfully`);
    } catch (error) {
      console.error(`❌ Remove failed:`, error.message);
      if (error.errors) {
        error.errors.forEach((err, i) => console.error(`  Error ${i + 1}:`, err.message));
      }
      return false;
    }
  }

  // Step 3: Add Portuguese descriptions
  console.log(`\nAdding ${PORTUGUESE_DESCRIPTIONS.length} Portuguese descriptions...`);

  const createOperations = PORTUGUESE_DESCRIPTIONS.map(assetId => ({
    asset_group: `customers/${account_id}/assetGroups/${assetGroupId}`,
    asset: `customers/${account_id}/assets/${assetId}`,
    field_type: 'DESCRIPTION'
  }));

  try {
    await customer.assetGroupAssets.create(createOperations);
    console.log(`✅ Added successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Add failed:`, error.message);
    if (error.errors) {
      error.errors.forEach((err, i) => console.error(`  Error ${i + 1}:`, err.message));
    }
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('SEQUENTIAL SWAP: Long Headlines & Descriptions');
  console.log('Using individual remove() and create() methods');
  console.log('='.repeat(70));

  const assetGroups = [
    { id: '6624724877', name: 'Asset Group #1: InMarket' },
    { id: '6624805206', name: 'Asset Group #2: Schools & Agents' },
    { id: '6624812695', name: 'Asset Group #3: All Users' }
  ];

  let successCount = 0;

  for (const group of assetGroups) {
    const longHeadlineSuccess = await swapLongHeadlines(group.id, group.name);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const descriptionSuccess = await swapDescriptions(group.id, group.name);
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (longHeadlineSuccess && descriptionSuccess) successCount++;
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`RESULTS: ${successCount}/${assetGroups.length} asset groups completed`);
  console.log('='.repeat(70));
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
