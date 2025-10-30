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

const CAMPAIGNS = {
  'PMax-Brazil-POR': '23202585091',
  'PMax-Ireland': '17440682130'
};

async function getCampaignTracking(campaignId, campaignName) {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.tracking_url_template,
      campaign.url_custom_parameters,
      campaign.final_url_suffix
    FROM campaign
    WHERE campaign.id = ${campaignId}
  `;

  try {
    const results = await customer.query(query);

    if (results.length > 0) {
      const campaign = results[0].campaign;
      return {
        name: campaignName,
        id: campaign.id,
        tracking_url_template: campaign.tracking_url_template || 'Not set',
        final_url_suffix: campaign.final_url_suffix || 'Not set',
        url_custom_parameters: campaign.url_custom_parameters || []
      };
    }

    return null;
  } catch (error) {
    console.error(`Error querying ${campaignName}:`, error.message);
    return null;
  }
}

function compareTrackingTemplates(brazil, ireland) {
  console.log('\n' + '='.repeat(70));
  console.log('COMPARISON ANALYSIS');
  console.log('='.repeat(70));

  // Compare tracking templates
  const templatesMatch = brazil.tracking_url_template === ireland.tracking_url_template;
  console.log(`\n1. Tracking URL Template: ${templatesMatch ? '✅ MATCH' : '❌ DIFFERENT'}`);

  if (!templatesMatch) {
    console.log('\n   PMax-Brazil-POR:');
    console.log(`   ${brazil.tracking_url_template}`);
    console.log('\n   PMax-Ireland:');
    console.log(`   ${ireland.tracking_url_template}`);
  } else {
    console.log(`   Both use: ${brazil.tracking_url_template}`);
  }

  // Compare final URL suffix
  const suffixMatch = brazil.final_url_suffix === ireland.final_url_suffix;
  console.log(`\n2. Final URL Suffix: ${suffixMatch ? '✅ MATCH' : '❌ DIFFERENT'}`);

  if (!suffixMatch) {
    console.log('\n   PMax-Brazil-POR:');
    console.log(`   ${brazil.final_url_suffix}`);
    console.log('\n   PMax-Ireland:');
    console.log(`   ${ireland.final_url_suffix}`);
  } else {
    console.log(`   Both use: ${brazil.final_url_suffix}`);
  }

  // Compare custom parameters
  const brazilParams = JSON.stringify(brazil.url_custom_parameters);
  const irelandParams = JSON.stringify(ireland.url_custom_parameters);
  const paramsMatch = brazilParams === irelandParams;

  console.log(`\n3. Custom Parameters: ${paramsMatch ? '✅ MATCH' : '❌ DIFFERENT'}`);

  if (!paramsMatch) {
    console.log('\n   PMax-Brazil-POR:');
    console.log(`   ${brazilParams}`);
    console.log('\n   PMax-Ireland:');
    console.log(`   ${irelandParams}`);
  } else if (brazil.url_custom_parameters.length > 0) {
    console.log(`   Both use: ${brazilParams}`);
  } else {
    console.log('   Both have no custom parameters');
  }

  // Overall assessment
  console.log('\n' + '='.repeat(70));
  if (templatesMatch && suffixMatch && paramsMatch) {
    console.log('✅ TRACKING ALIGNED: All tracking settings match!');
  } else {
    console.log('⚠️  TRACKING MISALIGNED: Differences found above');
    console.log('\nAction required: Align tracking templates for consistent reporting');
  }
  console.log('='.repeat(70));

  return templatesMatch && suffixMatch && paramsMatch;
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('TRACKING TEMPLATE COMPARISON');
  console.log('Comparing: PMax-Brazil-POR vs PMax-Ireland');
  console.log('='.repeat(70));

  // Get tracking for both campaigns
  console.log('\nQuerying campaign tracking settings...\n');

  const brazil = await getCampaignTracking(
    CAMPAIGNS['PMax-Brazil-POR'],
    'PMax-Brazil-POR'
  );

  const ireland = await getCampaignTracking(
    CAMPAIGNS['PMax-Ireland'],
    'PMax-Ireland'
  );

  if (!brazil || !ireland) {
    console.error('\n❌ Failed to retrieve one or both campaigns');
    return;
  }

  // Display individual settings
  console.log('='.repeat(70));
  console.log('PMAX-BRAZIL-POR (ID: 23202585091)');
  console.log('='.repeat(70));
  console.log(`Tracking URL Template:\n  ${brazil.tracking_url_template}`);
  console.log(`\nFinal URL Suffix:\n  ${brazil.final_url_suffix}`);
  console.log(`\nCustom Parameters:\n  ${JSON.stringify(brazil.url_custom_parameters, null, 2)}`);

  console.log('\n' + '='.repeat(70));
  console.log('PMAX-IRELAND (ID: 17440682130)');
  console.log('='.repeat(70));
  console.log(`Tracking URL Template:\n  ${ireland.tracking_url_template}`);
  console.log(`\nFinal URL Suffix:\n  ${ireland.final_url_suffix}`);
  console.log(`\nCustom Parameters:\n  ${JSON.stringify(ireland.url_custom_parameters, null, 2)}`);

  // Compare
  const aligned = compareTrackingTemplates(brazil, ireland);

  if (!aligned) {
    console.log('\n📝 Recommendation: Copy tracking template from PMax-Ireland to PMax-Brazil-POR');
  }
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
