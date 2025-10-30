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

async function fixBrazilTracking() {
  console.log('\n' + '='.repeat(70));
  console.log('FIX BRAZIL CAMPAIGN TRACKING TEMPLATE');
  console.log('='.repeat(70));

  // Corrected tracking template with:
  // 1. Dynamic {campaignid} instead of hardcoded ID
  // 2. Matching custom parameter structure to Ireland
  const correctedTemplate = '{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={_cname}&utm_term={keyword}&utm_content={creative}&hsa_acc=1051706978&hsa_cam={campaignid}&hsa_grp={adgroupid}&hsa_ad={creative}&hsa_src={network}&hsa_tgt={targetid}&hsa_mt={matchtype}&hsa_net=adwords&hsa_ver=3&hsa_kw={keyword}';

  console.log('\nChanges to apply:');
  console.log('  1. hsa_cam: 17440682130 (Ireland) → {campaignid} (dynamic)');
  console.log('  2. Custom param: cname=PMax-Brazil-PT → cname=PMax-Brazil-POR');
  console.log('\nCorrected Template:');
  console.log(`  ${correctedTemplate}`);

  const operations = [{
    resource_name: `customers/${account_id}/campaigns/${BRAZIL_CAMPAIGN_ID}`,
    tracking_url_template: correctedTemplate,
    url_custom_parameters: [{
      key: 'cname',
      value: 'PMax-Brazil-POR'
    }]
  }];

  console.log('\n' + '='.repeat(70));
  console.log('EXECUTING UPDATE...');
  console.log('='.repeat(70));

  try {
    const result = await customer.campaigns.update(operations);
    console.log('\n✅ SUCCESS: Tracking template updated!');
    console.log('\nResult:', result);

    // Verify the update
    console.log('\n' + '='.repeat(70));
    console.log('VERIFICATION');
    console.log('='.repeat(70));

    const verifyQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.tracking_url_template,
        campaign.url_custom_parameters
      FROM campaign
      WHERE campaign.id = ${BRAZIL_CAMPAIGN_ID}
    `;

    const verification = await customer.query(verifyQuery);

    if (verification.length > 0) {
      const campaign = verification[0].campaign;
      console.log('\nUpdated settings:');
      console.log(`  Tracking Template: ${campaign.tracking_url_template}`);
      console.log(`  Custom Parameters: ${JSON.stringify(campaign.url_custom_parameters, null, 2)}`);

      // Check if {campaignid} is in the template
      const usesDynamicId = campaign.tracking_url_template.includes('{campaignid}');
      console.log(`\n${usesDynamicId ? '✅' : '❌'} Uses dynamic {campaignid}: ${usesDynamicId}`);

      // Check custom parameter
      const hasCorrectParam = campaign.url_custom_parameters?.some(p =>
        p.key === 'cname' && p.value === 'PMax-Brazil-POR'
      );
      console.log(`${hasCorrectParam ? '✅' : '❌'} Custom parameter correct: ${hasCorrectParam}`);

      if (usesDynamicId && hasCorrectParam) {
        console.log('\n' + '='.repeat(70));
        console.log('✅ TRACKING TEMPLATE FIXED AND VERIFIED!');
        console.log('='.repeat(70));
      }
    }

  } catch (error) {
    console.error('\n❌ UPDATE FAILED:', error.message);
    if (error.errors) {
      error.errors.forEach((err, i) => {
        console.error(`  Error ${i + 1}:`, err.message || err);
      });
    }
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('CRITICAL: FIX MISATTRIBUTED TRACKING');
  console.log('Issue: Brazil campaign using Ireland campaign ID in tracking');
  console.log('='.repeat(70));

  await fixBrazilTracking();
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
