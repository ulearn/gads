/**
 * Verify if campaigns were actually active during missing periods
 * This checks Google Ads API directly to see if data exists for those dates
 */

const { GoogleAdsApi } = require('google-ads-api');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function verifyCampaignsActive() {
  console.log('🔍 Verifying if campaigns had activity during missing periods...\n');

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

  // Test periods
  const testPeriods = [
    { name: 'April 2025 (missing month)', start: '2025-04-01', end: '2025-04-30' },
    { name: 'October 14-23 (missing days)', start: '2025-10-14', end: '2025-10-23' }
  ];

  for (const period of testPeriods) {
    console.log(`\n📅 Testing: ${period.name}`);
    console.log(`   Period: ${period.start} to ${period.end}`);

    try {
      const query = `
        SELECT
          campaign.id,
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros
        FROM campaign
        WHERE segments.date BETWEEN '${period.start}' AND '${period.end}'
          AND campaign.status = 'ENABLED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 5
      `;

      const results = await customer.query(query);

      if (results.length > 0) {
        console.log(`   ✅ Found ${results.length} campaigns with activity`);
        console.log(`   📊 Top campaigns:`);
        results.slice(0, 3).forEach(row => {
          const spend = row.metrics?.cost_micros ? (row.metrics.cost_micros / 1000000).toFixed(2) : 0;
          console.log(`      - ${row.campaign.name}: €${spend} spend, ${row.metrics?.impressions || 0} impressions`);
        });
      } else {
        console.log(`   ⚠️  No campaign activity found (campaigns may have been paused/removed)`);
      }

    } catch (error) {
      console.error(`   ❌ Error checking period: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('💡 CONCLUSION:');
  console.log('   If campaigns show activity above, we have a sync gap to backfill.');
  console.log('   If no activity, campaigns weren\'t running (no backfill needed).');
  console.log('═'.repeat(70));
}

verifyCampaignsActive().catch(console.error);
