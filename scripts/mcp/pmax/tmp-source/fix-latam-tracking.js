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

async function checkLatamTracking() {
  console.log('\n' + '='.repeat(70));
  console.log('CHECKING PMAX-LATAM-ES TRACKING');
  console.log('='.repeat(70));

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.tracking_url_template,
      campaign.url_custom_parameters,
      campaign.final_url_suffix
    FROM campaign
    WHERE campaign.id = ${LATAM_CAMPAIGN_ID}
  `;

  const results = await customer.query(query);

  if (results.length === 0) {
    console.error('❌ Campaign not found');
    return null;
  }

  const campaign = results[0].campaign;

  console.log('\nCurrent Tracking Settings:');
  console.log(`  Name: ${campaign.name}`);
  console.log(`  ID: ${campaign.id}`);
  console.log(`\nTracking Template:\n  ${campaign.tracking_url_template || 'Not set'}`);
  console.log(`\nCustom Parameters:\n  ${JSON.stringify(campaign.url_custom_parameters || [], null, 2)}`);
  console.log(`\nFinal URL Suffix:\n  ${campaign.final_url_suffix || 'Not set'}`);

  // Check for hardcoded campaign IDs
  const template = campaign.tracking_url_template || '';
  const hardcodedIds = template.match(/hsa_cam=(\d+)/);

  console.log('\n' + '='.repeat(70));
  console.log('ANALYSIS');
  console.log('='.repeat(70));

  if (hardcodedIds) {
    const hardcodedId = hardcodedIds[1];
    console.log(`\n⚠️  ISSUE FOUND: Hardcoded campaign ID in tracking template`);
    console.log(`   hsa_cam=${hardcodedId}`);

    if (hardcodedId !== LATAM_CAMPAIGN_ID) {
      console.log(`   ❌ WRONG CAMPAIGN: ${hardcodedId} (should be ${LATAM_CAMPAIGN_ID})`);
      console.log(`   This will misattribute LATAM traffic to campaign ${hardcodedId}!`);
    } else {
      console.log(`   ⚠️  Correct ID but hardcoded (should use {campaignid})`);
    }
  } else if (template.includes('{campaignid}')) {
    console.log('\n✅ Uses dynamic {campaignid} - Good!');
  } else {
    console.log('\n❌ No campaign ID tracking found');
  }

  return campaign;
}

async function fixLatamTracking() {
  console.log('\n' + '='.repeat(70));
  console.log('FIXING PMAX-LATAM-ES TRACKING');
  console.log('='.repeat(70));

  const correctedTemplate = '{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={_cname}&utm_term={keyword}&utm_content={creative}&hsa_acc=1051706978&hsa_cam={campaignid}&hsa_grp={adgroupid}&hsa_ad={creative}&hsa_src={network}&hsa_tgt={targetid}&hsa_mt={matchtype}&hsa_net=adwords&hsa_ver=3&hsa_kw={keyword}';

  console.log('\nApplying corrected template with:');
  console.log('  ✅ hsa_cam={campaignid} (dynamic)');
  console.log('  ✅ Custom param: cname=PMax-LATAM-ES');

  const operations = [{
    resource_name: `customers/${account_id}/campaigns/${LATAM_CAMPAIGN_ID}`,
    tracking_url_template: correctedTemplate,
    url_custom_parameters: [{
      key: 'cname',
      value: 'PMax-LATAM-ES'
    }]
  }];

  console.log('\n' + '='.repeat(70));
  console.log('EXECUTING UPDATE...');
  console.log('='.repeat(70));

  try {
    await customer.campaigns.update(operations);
    console.log('\n✅ SUCCESS: Tracking template updated!');

    // Verify
    const verifyQuery = `
      SELECT
        campaign.tracking_url_template,
        campaign.url_custom_parameters
      FROM campaign
      WHERE campaign.id = ${LATAM_CAMPAIGN_ID}
    `;

    const verification = await customer.query(verifyQuery);
    const updated = verification[0].campaign;

    console.log('\n' + '='.repeat(70));
    console.log('VERIFICATION');
    console.log('='.repeat(70));
    console.log(`\nTracking Template:\n  ${updated.tracking_url_template}`);
    console.log(`\nCustom Parameters:\n  ${JSON.stringify(updated.url_custom_parameters, null, 2)}`);

    const usesDynamicId = updated.tracking_url_template.includes('{campaignid}');
    const hasCorrectParam = updated.url_custom_parameters?.some(p =>
      p.key === 'cname' && p.value === 'PMax-LATAM-ES'
    );

    console.log(`\n${usesDynamicId ? '✅' : '❌'} Uses dynamic {campaignid}: ${usesDynamicId}`);
    console.log(`${hasCorrectParam ? '✅' : '❌'} Custom parameter correct: ${hasCorrectParam}`);

    if (usesDynamicId && hasCorrectParam) {
      console.log('\n' + '='.repeat(70));
      console.log('✅ TRACKING FIXED AND VERIFIED!');
      console.log('='.repeat(70));
    }

    return true;
  } catch (error) {
    console.error('\n❌ UPDATE FAILED:', error.message);
    if (error.errors) {
      error.errors.forEach(err => console.error(`  ${err.message}`));
    }
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('FIX PMAX-LATAM-ES TRACKING TEMPLATE');
  console.log('Campaign ID: 23202626350');
  console.log('='.repeat(70));

  await checkLatamTracking();
  await fixLatamTracking();
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
