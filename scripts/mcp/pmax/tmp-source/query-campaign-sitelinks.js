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

const CAMPAIGN_ID = '23202585091'; // PMax-Brazil-POR

async function queryCampaignSitelinks() {
  console.log('=== QUERYING CAMPAIGN SITELINKS ===\n');
  console.log(`Campaign ID: ${CAMPAIGN_ID}\n`);

  const query = `
    SELECT
      campaign.id,
      campaign_asset.resource_name,
      campaign_asset.status,
      asset.id,
      asset.name,
      asset.sitelink_asset.link_text,
      asset.sitelink_asset.description1,
      asset.sitelink_asset.description2
    FROM campaign_asset
    WHERE campaign.id = ${CAMPAIGN_ID}
    AND campaign_asset.field_type = SITELINK
    AND campaign_asset.status = ENABLED
  `;

  try {
    const sitelinks = await customer.query(query);
    console.log(`Found ${sitelinks.length} ENABLED sitelinks:\n`);

    sitelinks.forEach((row, i) => {
      console.log(`${i + 1}. Asset ID: ${row.asset.id}`);
      console.log(`   Resource: ${row.campaign_asset.resource_name}`);
      console.log(`   Status: ${row.campaign_asset.status}`);
      console.log(`   Link Text: "${row.asset.sitelink_asset?.link_text || 'N/A'}"`);
      console.log(`   Desc1: "${row.asset.sitelink_asset?.description1 || 'N/A'}"`);
      console.log(`   Desc2: "${row.asset.sitelink_asset?.description2 || 'N/A'}"`);
      console.log('');
    });

    // Extract asset IDs for swap script
    const assetIds = sitelinks.map(s => s.asset.id.toString());
    console.log('\nAsset IDs for swap script:');
    console.log('[' + assetIds.map(id => `'${id}'`).join(', ') + ']');

    return sitelinks;

  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.errors) {
      console.error('Details:', error.errors);
    }
    return [];
  }
}

async function main() {
  console.log('=========================================================');
  console.log('QUERY CAMPAIGN SITELINKS - PMax-Brazil-POR');
  console.log('=========================================================\n');

  const sitelinks = await queryCampaignSitelinks();

  console.log('\n=========================================================');
  console.log(`Total ENABLED sitelinks: ${sitelinks.length}/20`);
  console.log('=========================================================');
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
