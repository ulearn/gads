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

const ASSET_GROUP_ID = '6624724877'; // Asset Group #1

async function queryCurrentAssets() {
  console.log('Querying current LONG_HEADLINE and DESCRIPTION assets...\n');

  // Query long headlines
  const longHeadlineQuery = `
    SELECT
      asset_group_asset.resource_name,
      asset_group_asset.field_type,
      asset.id,
      asset.text_asset.text
    FROM asset_group_asset
    WHERE asset_group.id = ${ASSET_GROUP_ID}
    AND asset_group_asset.field_type = LONG_HEADLINE
  `;

  // Query descriptions
  const descriptionQuery = `
    SELECT
      asset_group_asset.resource_name,
      asset_group_asset.field_type,
      asset.id,
      asset.text_asset.text
    FROM asset_group_asset
    WHERE asset_group.id = ${ASSET_GROUP_ID}
    AND asset_group_asset.field_type = DESCRIPTION
  `;

  try {
    console.log('=== LONG HEADLINES ===');
    const longHeadlines = await customer.query(longHeadlineQuery);
    console.log(`Found ${longHeadlines.length} long headlines:\n`);
    longHeadlines.forEach((row, i) => {
      console.log(`${i + 1}. Asset ID: ${row.asset.id}`);
      console.log(`   Resource Name: ${row.asset_group_asset.resource_name}`);
      console.log(`   Text: ${row.asset.text_asset?.text || 'N/A'}`);
      console.log('');
    });

    console.log('\n=== DESCRIPTIONS ===');
    const descriptions = await customer.query(descriptionQuery);
    console.log(`Found ${descriptions.length} descriptions:\n`);
    descriptions.forEach((row, i) => {
      console.log(`${i + 1}. Asset ID: ${row.asset.id}`);
      console.log(`   Resource Name: ${row.asset_group_asset.resource_name}`);
      console.log(`   Text: ${row.asset.text_asset?.text || 'N/A'}`);
      console.log('');
    });

    // Extract field type enum from resource names
    if (longHeadlines.length > 0) {
      const resourceName = longHeadlines[0].asset_group_asset.resource_name;
      const parts = resourceName.split('~');
      console.log(`\nLONG_HEADLINE field type enum: ${parts[2]}`);
    }

    if (descriptions.length > 0) {
      const resourceName = descriptions[0].asset_group_asset.resource_name;
      const parts = resourceName.split('~');
      console.log(`DESCRIPTION field type enum: ${parts[2]}`);
    }

  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.errors) {
      console.error('Details:', error.errors);
    }
  }
}

queryCurrentAssets().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
