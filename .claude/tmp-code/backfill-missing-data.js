/**
 * Backfill Missing Google Ads Data
 *
 * Identified gaps:
 * 1. April 2025 (30 days) - entire month missing
 * 2. October 14-23, 2025 (10 days) - recent gap
 */

const axios = require('axios');

const BASE_URL = 'https://hub.ulearnschool.com/gads';

// Missing periods to backfill
const BACKFILL_PERIODS = [
  {
    name: 'April 2025',
    start: '2025-04-01',
    end: '2025-04-30',
    priority: 'high'
  },
  {
    name: 'October 14-23, 2025',
    start: '2025-10-14',
    end: '2025-10-23',
    priority: 'critical'
  }
];

async function backfillPeriod(period) {
  const url = `${BASE_URL}/google-ads/sync/backfill?start=${period.start}&end=${period.end}`;

  console.log(`\n🔄 Starting backfill: ${period.name}`);
  console.log(`   Period: ${period.start} to ${period.end}`);
  console.log(`   URL: ${url}`);

  try {
    const response = await axios.post(url);
    console.log(`✅ ${period.name} backfill initiated`);
    console.log(`   Response:`, response.data);
    return { success: true, period: period.name, data: response.data };
  } catch (error) {
    console.error(`❌ ${period.name} backfill failed:`, error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
    return { success: false, period: period.name, error: error.message };
  }
}

async function runBackfill() {
  console.log('═'.repeat(70));
  console.log('🔄 GOOGLE ADS DATA BACKFILL');
  console.log('═'.repeat(70));
  console.log(`\nBackfilling ${BACKFILL_PERIODS.length} missing periods:\n`);

  BACKFILL_PERIODS.forEach((period, index) => {
    console.log(`${index + 1}. ${period.name} (${period.start} to ${period.end}) - ${period.priority}`);
  });

  console.log('\n' + '─'.repeat(70));
  console.log('⚠️  NOTE: Backfills run in background. Each period may take 1-5 minutes.');
  console.log('─'.repeat(70));

  // Process periods sequentially to avoid overwhelming the server
  const results = [];
  for (const period of BACKFILL_PERIODS) {
    const result = await backfillPeriod(period);
    results.push(result);

    // Wait 5 seconds between requests to avoid overwhelming the API
    if (period !== BACKFILL_PERIODS[BACKFILL_PERIODS.length - 1]) {
      console.log('\n⏳ Waiting 5 seconds before next backfill...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('📊 BACKFILL SUMMARY');
  console.log('═'.repeat(70));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ Failed periods:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.period}: ${r.error}`);
    });
  }

  console.log('\n💡 TIP: Run check-sync-gap.js again in 5-10 minutes to verify backfill completion.');
  console.log('═'.repeat(70));
}

// Run backfill
runBackfill().catch(console.error);
