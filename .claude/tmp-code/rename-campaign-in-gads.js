const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

(async () => {
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  });

  const customer = client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN
  });

  console.log('\n🔧 Renaming Campaign in Google Ads\n');
  console.log('='.repeat(70));
  console.log('\nCampaign ID: 22099718382');
  console.log('Old Name: "Spain-LATAM-ES"');
  console.log('New Name: "LATAM-ES"\n');

  try {
    const response = await customer.campaigns.update({
      resource_name: `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/campaigns/22099718382`,
      name: 'LATAM-ES'
    });

    console.log('✅ Campaign renamed successfully in Google Ads');
    console.log('\nResponse:', response);
  } catch (error) {
    console.error('❌ Error renaming campaign:', error.message);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error(`   ${err.message}`);
      });
    }
  }

  console.log('\n' + '='.repeat(70) + '\n');
})();
