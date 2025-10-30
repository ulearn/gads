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

const ASSET_GROUP_ID = '6624724877'; // Asset Group #1

async function queryEnabledAssets() {
  console.log('Querying ENABLED assets only...\n');

  // Query long headlines - only ENABLED status
  const longHeadlineQuery = `
    SELECT
      asset_group_asset.resource_name,
      asset_group_asset.status,
      asset.id,
      asset.text_asset.text
    FROM asset_group_asset
    WHERE asset_group.id = ${ASSET_GROUP_ID}
    AND asset_group_asset.field_type = LONG_HEADLINE
    AND asset_group_asset.status = ENABLED
  `;

  // Query descriptions - only ENABLED status
  const descriptionQuery = `
    SELECT
      asset_group_asset.resource_name,
      asset_group_asset.status,
      asset.id,
      asset.text_asset.text
    FROM asset_group_asset
    WHERE asset_group.id = ${ASSET_GROUP_ID}
    AND asset_group_asset.field_type = DESCRIPTION
    AND asset_group_asset.status = ENABLED
  `;

  try {
    console.log('=== LONG HEADLINES (ENABLED ONLY) ===');
    const longHeadlines = await customer.query(longHeadlineQuery);
    console.log(`Found ${longHeadlines.length} ENABLED long headlines:\n`);
    longHeadlines.forEach((row, i) => {
      console.log(`${i + 1}. Asset ID: ${row.asset.id}`);
      console.log(`   Status: ${row.asset_group_asset.status}`);
      console.log(`   Text: ${row.asset.text_asset?.text || 'N/A'}`);
      console.log('');
    });

    console.log('\n=== DESCRIPTIONS (ENABLED ONLY) ===');
    const descriptions = await customer.query(descriptionQuery);
    console.log(`Found ${descriptions.length} ENABLED descriptions:\n`);
    descriptions.forEach((row, i) => {
      console.log(`${i + 1}. Asset ID: ${row.asset.id}`);
      console.log(`   Status: ${row.asset_group_asset.status}`);
      console.log(`   Text: ${row.asset.text_asset?.text || 'N/A'}`);
      console.log('');
    });

  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.errors) {
      console.error('Details:', error.errors);
    }
  }
}

queryEnabledAssets().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
