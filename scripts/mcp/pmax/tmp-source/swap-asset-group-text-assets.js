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

async function swapOneByOne(assetGroupId, assetGroupName, fieldType, targetAssets) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`SWAPPING ${fieldType}: ${assetGroupName}`);
  console.log('='.repeat(70));

  // Step 1: Query current assets
  const query = `
    SELECT
      asset.id,
      asset_group_asset.resource_name
    FROM asset_group_asset
    WHERE asset_group.id = ${assetGroupId}
    AND asset_group_asset.field_type = ${fieldType}
  `;

  let currentAssets;
  try {
    currentAssets = await customer.query(query);
  } catch (error) {
    console.error('ERROR querying:', error.message);
    return false;
  }

  const currentIds = currentAssets.map(a => a.asset.id.toString());
  const maxAllowed = 5;

  console.log(`Found ${currentAssets.length} existing ${fieldType.toLowerCase()}s`);

  // Identify Portuguese vs English
  const portuguesePresent = currentIds.filter(id => targetAssets.includes(id));
  const englishPresent = currentAssets.filter(a => !targetAssets.includes(a.asset.id.toString()));

  console.log(`  ${portuguesePresent.length} already Portuguese`);
  console.log(`  ${englishPresent.length} to swap out`);

  if (englishPresent.length === 0) {
    console.log(`✅ Already all Portuguese - skipping`);
    return true;
  }

  // Strategy:
  // 1. If over max (like 7), first remove extras down to max (5)
  // 2. Then do 1-for-1 swaps: remove 1 English, add 1 Portuguese

  // Step 1: Remove extras if over max
  if (currentAssets.length > maxAllowed) {
    const toRemoveCount = currentAssets.length - maxAllowed;
    console.log(`\nRemoving ${toRemoveCount} extras to get to max (${maxAllowed})...`);

    const toRemove = englishPresent.slice(0, toRemoveCount).map(a => a.asset_group_asset.resource_name);

    try {
      await customer.assetGroupAssets.remove(toRemove);
      console.log(`✅ Removed ${toRemoveCount} assets`);

      // Update our tracking
      englishPresent.splice(0, toRemoveCount);
    } catch (error) {
      console.error(`❌ Remove failed:`, error.message);
      if (error.errors) {
        error.errors.forEach((err, i) => console.error(`  Error ${i + 1}:`, err.message));
      }
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Step 2: Do 1-for-1 swaps
  console.log(`\nPerforming 1-for-1 swaps...`);

  for (let i = 0; i < targetAssets.length && i < englishPresent.length; i++) {
    const englishAsset = englishPresent[i];
    const portugueseAssetId = targetAssets[i];

    console.log(`  Swap ${i + 1}/${Math.min(targetAssets.length, englishPresent.length)}: ${englishAsset.asset.id} → ${portugueseAssetId}`);

    // Remove 1 English
    try {
      await customer.assetGroupAssets.remove([englishAsset.asset_group_asset.resource_name]);
    } catch (error) {
      console.error(`    ❌ Remove failed:`, error.message);
      continue;
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    // Add 1 Portuguese
    const createOp = {
      asset_group: `customers/${account_id}/assetGroups/${assetGroupId}`,
      asset: `customers/${account_id}/assets/${portugueseAssetId}`,
      field_type: fieldType
    };

    try {
      await customer.assetGroupAssets.create([createOp]);
      console.log(`    ✅ Swapped`);
    } catch (error) {
      console.error(`    ❌ Add failed:`, error.message);
      // Try to add the English one back
      const rollback = {
        asset_group: `customers/${account_id}/assetGroups/${assetGroupId}`,
        asset: `customers/${account_id}/assets/${englishAsset.asset.id}`,
        field_type: fieldType
      };
      try {
        await customer.assetGroupAssets.create([rollback]);
        console.log(`    ⚠️  Rolled back`);
      } catch (rollbackError) {
        console.error(`    ❌ Rollback also failed!`);
      }
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`✅ Swap completed for ${fieldType}`);
  return true;
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('ONE-BY-ONE SWAP: Long Headlines & Descriptions');
  console.log('Maintains min/max requirements at all times');
  console.log('='.repeat(70));

  const assetGroups = [
    { id: '6624724877', name: 'Asset Group #1: InMarket' },
    { id: '6624805206', name: 'Asset Group #2: Schools & Agents' },
    { id: '6624812695', name: 'Asset Group #3: All Users' }
  ];

  let successCount = 0;

  for (const group of assetGroups) {
    const longHeadlineSuccess = await swapOneByOne(
      group.id,
      group.name,
      'LONG_HEADLINE',
      PORTUGUESE_LONG_HEADLINES
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    const descriptionSuccess = await swapOneByOne(
      group.id,
      group.name,
      'DESCRIPTION',
      PORTUGUESE_DESCRIPTIONS
    );

    if (longHeadlineSuccess && descriptionSuccess) successCount++;

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`RESULTS: ${successCount}/${assetGroups.length} asset groups completed successfully`);
  console.log('='.repeat(70));
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
