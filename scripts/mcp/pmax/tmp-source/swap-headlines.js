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

// Define target Portuguese headlines (15 max)
const TARGET_PORTUGUESE = [
  '303655694285', '303655694282', '303655694279', '303655694276', '303655694273',
  '303655694270', '303655694267', '303655694264', '303655694261', '303627645795',
  '303627645792', '303627645789', '303626191761', '303626191758', '303626191755'
];

// Known English headlines to remove
const ENGLISH_TO_REMOVE = [
  '387422062', '610244015', '610244018', '1055732439', '39725975675',
  '40344308452', '41219225301', '41219225307', '96760538784', '96760538787',
  '121365633522', '121491473943', '125831333233', '121366186284', '172245651971'
];

async function swapHeadlinesInAssetGroup(assetGroupId, assetGroupName) {
  console.log(`\n================================================================`);
  console.log(`PROCESSING: ${assetGroupName} (${assetGroupId})`);
  console.log('================================================================');

  // Step 1: Query current headlines
  const query = `SELECT asset.id, asset.text_asset.text FROM asset_group_asset WHERE asset_group.id = ${assetGroupId} AND asset_group_asset.field_type = HEADLINE`;

  let currentHeadlines;
  try {
    currentHeadlines = await customer.query(query);
  } catch (error) {
    console.error('ERROR: Failed to query current headlines:', error.message);
    return false;
  }

  const currentIds = currentHeadlines.map(h => h.asset.id.toString());
  console.log(`\nCurrent state: ${currentIds.length} headlines`);

  // Identify what needs to change
  const englishPresent = currentIds.filter(id => ENGLISH_TO_REMOVE.includes(id));
  const portuguesePresent = currentIds.filter(id => TARGET_PORTUGUESE.includes(id));
  const portugueseMissing = TARGET_PORTUGUESE.filter(id => !currentIds.includes(id));

  console.log(`  Portuguese already present: ${portuguesePresent.length}`);
  console.log(`  English still present: ${englishPresent.length}`);
  console.log(`  Portuguese to add: ${portugueseMissing.length}`);
  console.log(`  English to remove: ${englishPresent.length}`);

  if (englishPresent.length === 0 && portugueseMissing.length === 0) {
    console.log(`\nSUCCESS: Asset group already has correct headlines - skipping`);
    return true;
  }

  // Step 2: Build operations
  const operations = [];

  // Strategy:
  // - If over 15 headlines: REMOVE English first to get to 15, then ADD Portuguese
  // - If under 15 headlines: ADD Portuguese first, then REMOVE English
  // This ensures we maintain 3-15 headline requirement at all times

  console.log(`\nBuilding operations...`);

  let toRemove = 0;
  let toAdd = 0;

  if (currentIds.length > 15) {
    // REMOVE first to get under limit
    const needToRemoveToReach15 = currentIds.length - 15;
    toRemove = Math.min(englishPresent.length, needToRemoveToReach15 + portugueseMissing.length);

    englishPresent.slice(0, toRemove).forEach(id => {
      operations.push({
        entity: 'asset_group_asset',
        operation: 'remove',
        resource_name: `customers/${account_id}/assetGroupAssets/${assetGroupId}~${id}~2`
      });
    });

    // Then ADD Portuguese to fill up to 15
    toAdd = Math.min(portugueseMissing.length, 15 - (currentIds.length - toRemove));

    portugueseMissing.slice(0, toAdd).forEach(id => {
      operations.push({
        entity: 'asset_group_asset',
        operation: 'create',
        resource: {
          asset_group: `customers/${account_id}/assetGroups/${assetGroupId}`,
          asset: `customers/${account_id}/assets/${id}`,
          field_type: 'HEADLINE'
        }
      });
    });
  } else {
    // ADD Portuguese first
    const spaceAvailable = 15 - currentIds.length;
    toAdd = Math.min(portugueseMissing.length, spaceAvailable);

    portugueseMissing.slice(0, toAdd).forEach(id => {
      operations.push({
        entity: 'asset_group_asset',
        operation: 'create',
        resource: {
          asset_group: `customers/${account_id}/assetGroups/${assetGroupId}`,
          asset: `customers/${account_id}/assets/${id}`,
          field_type: 'HEADLINE'
        }
      });
    });

    // Then REMOVE English if needed
    const afterAdd = currentIds.length + toAdd;
    if (afterAdd > 15) {
      toRemove = afterAdd - 15;
    } else {
      toRemove = Math.min(englishPresent.length, 15 - afterAdd);
    }

    if (toRemove > 0) {
      englishPresent.slice(0, toRemove).forEach(id => {
        operations.push({
          entity: 'asset_group_asset',
          operation: 'remove',
          resource_name: `customers/${account_id}/assetGroupAssets/${assetGroupId}~${id}~2`
        });
      });
    }
  }

  console.log(`  Operations: ${toRemove} removes first, then ${toAdd} adds`);

  if (operations.length === 0) {
    console.log(`\nSUCCESS: No operations needed`);
    return true;
  }

  // Step 3: Execute operations
  try {
    await customer.mutateResources(operations);
    console.log(`\nSUCCESS: Headlines updated!`);
    console.log(`  Final state should be: ${Math.min(15, currentIds.length + toAdd - toRemove)} headlines`);
    return true;
  } catch (error) {
    console.error(`\nERROR: Failed to update headlines:`, error.message || 'Unknown error');
    if (error.errors) {
      console.error(`  Error details:`, error.errors[0]?.message || 'No details');
    }
    return false;
  }
}

async function main() {
  console.log('\nSMART HEADLINE SWAP - ALL 3 ASSET GROUPS');
  console.log('Target: Replace English headlines with Portuguese ones');
  console.log('Strategy: Add Portuguese first, then remove English to stay within limits\n');

  const assetGroups = [
    { id: '6624724877', name: 'Asset Group #1: InMarket' },
    { id: '6624805206', name: 'Asset Group #2: Schools & Agents' },
    { id: '6624812695', name: 'Asset Group #3: All Users' }
  ];

  let successCount = 0;

  for (const group of assetGroups) {
    const success = await swapHeadlinesInAssetGroup(group.id, group.name);
    if (success) successCount++;

    // Small delay between groups
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n================================================================`);
  console.log(`FINAL RESULTS: ${successCount}/${assetGroups.length} asset groups updated successfully`);
  console.log('================================================================');
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
