/**
 * Test Script: Keyword Creation via Google Ads API
 * Tests the exact structure needed for adGroupCriteria.create()
 */

const { GoogleAdsApi, enums } = require('google-ads-api');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const log = (...args) => console.log(new Date().toISOString(), ...args);

async function testKeywordCreation() {
  log('🧪 Starting keyword creation test...');

  // Initialize client
  const client = new GoogleAdsApi({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    developer_token: process.env.GAdsAPI
  });

  const customer = client.Customer({
    customer_id: process.env.GADS_LIVE_ID,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    login_customer_id: process.env.GADS_LIVE_MCC_ID
  });

  // Test configuration
  const TEST_AD_GROUP_ID = '190629382467';
  const TEST_KEYWORD = 'test keyword creation dublin';
  const TEST_MATCH_TYPE = 'PHRASE';

  log('📋 Test Configuration:');
  log('  Ad Group ID:', TEST_AD_GROUP_ID);
  log('  Keyword:', TEST_KEYWORD);
  log('  Match Type:', TEST_MATCH_TYPE);

  // Convert match type string to enum
  const matchTypeEnum = enums.KeywordMatchType[TEST_MATCH_TYPE];
  log('  Match Type Enum:', matchTypeEnum);

  // Test with INTEGER (what's stored in Italy keywords)
  const operation1 = {
    status: enums.AdGroupCriterionStatus.PAUSED,
    keyword: {
      text: TEST_KEYWORD,
      match_type: 3  // INTEGER like Italy keywords
    },
    ad_group: `customers/${process.env.GADS_LIVE_ID}/adGroups/${TEST_AD_GROUP_ID}`,
    cpc_bid_micros: 940000
  };

  log('\n🧪 Test: Using INTEGER 3 for match_type (like Italy keywords)');
  log('Structure:', JSON.stringify(operation1, null, 2));

  try {
    log('🔄 Attempting to create keyword with INTEGER match_type...');
    const response = await customer.adGroupCriteria.create([operation1]);
    log('✅ SUCCESS! Keyword created:', JSON.stringify(response, null, 2));

    // Get the created keyword ID for cleanup
    const createdResourceName = response?.results?.[0]?.resource_name;
    log('📌 Created resource:', createdResourceName);

    // Clean up - remove the test keyword
    if (createdResourceName) {
      log('🧹 Cleaning up test keyword...');
      await customer.adGroupCriteria.remove([createdResourceName]);
      log('✅ Test keyword removed');
    }

    return true;
  } catch (error) {
    log('❌ Test 1 FAILED');
    log('Error:', error.message);
    log('Error Details:', JSON.stringify(error, null, 2));
    return false;
  }
}

// Run the test
testKeywordCreation()
  .then(success => {
    if (success) {
      log('\n✅ All tests passed! Structure is correct.');
      process.exit(0);
    } else {
      log('\n❌ Tests failed. Need to adjust structure.');
      process.exit(1);
    }
  })
  .catch(error => {
    log('\n💥 Unexpected error:', error);
    process.exit(1);
  });
