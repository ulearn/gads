/**
 * Test script for Customer Match MySQL queries
 * Validates query logic matches HubSpot filters
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const {
  queryEligibleContacts,
  queryNewOptOuts,
  getCustomerMatchStats,
  TARGET_STAGES,
  EXCLUDED_LOST_REASONS,
  RETENTION_DAYS
} = require(path.join(__dirname, '../../scripts/google/cust-match.js'));

async function testQueries() {
  console.log('='.repeat(70));
  console.log('CUSTOMER MATCH QUERY TEST');
  console.log('='.repeat(70));
  console.log();

  console.log('Configuration:');
  console.log(`  Target Stages: ${TARGET_STAGES.length}`);
  console.log(`  Excluded Lost Reasons: ${EXCLUDED_LOST_REASONS.join(', ')}`);
  console.log(`  Retention Days: ${RETENTION_DAYS}`);
  console.log();

  try {
    // Test 1: Get detailed statistics
    console.log('Test 1: Getting Customer Match Statistics...');
    console.log('-'.repeat(70));
    const stats = await getCustomerMatchStats();

    console.log(`\nTotal Eligible Contacts: ${stats.total_eligible}`);
    console.log(`Total Opted Out: ${stats.total_opted_out}`);
    console.log();

    console.log('Active Pipeline Breakdown:');
    for (const [stage, count] of Object.entries(stats.active_by_stage)) {
      console.log(`  ${stage}: ${count}`);
    }
    console.log();

    console.log('Lost Contacts Stats:');
    console.log(`  Total Lost: ${stats.lost.total_lost}`);
    console.log(`  Excluded by Reason: ${stats.lost.excluded_by_reason}`);
    console.log(`  Excluded by Date (>${RETENTION_DAYS}d): ${stats.lost.excluded_by_date}`);
    console.log(`  Eligible Lost (<${RETENTION_DAYS}d, valid reasons): ${stats.lost.eligible_lost}`);
    console.log();

    // Test 2: Get all eligible contacts (verbose mode)
    console.log('Test 2: Querying All Eligible Contacts...');
    console.log('-'.repeat(70));
    const contacts = await queryEligibleContacts({
      includePhone: true,
      verbose: true
    });

    console.log();
    console.log(`Total Contacts Retrieved: ${contacts.length}`);
    console.log();

    // Verify against expected count
    const expectedCount = 4580;
    const variance = Math.abs(contacts.length - expectedCount);
    const percentDiff = ((variance / expectedCount) * 100).toFixed(2);

    console.log('Validation:');
    console.log(`  Expected (HubSpot): ${expectedCount}`);
    console.log(`  Actual (MySQL): ${contacts.length}`);
    console.log(`  Difference: ${variance} (${percentDiff}%)`);

    if (percentDiff < 5) {
      console.log('  ✓ PASS - Within 5% variance');
    } else {
      console.log('  ⚠ WARNING - Variance exceeds 5%');
    }
    console.log();

    // Sample data (first 3 contacts)
    console.log('Sample Contacts (first 3):');
    contacts.slice(0, 3).forEach((contact, i) => {
      console.log(`  ${i + 1}. ${contact.email}`);
      console.log(`     Name: ${contact.firstName} ${contact.lastName}`);
      console.log(`     Phone: ${contact.phone || 'N/A'}`);
      console.log(`     Stage: ${contact.dealstage}`);
      console.log(`     Lost Reason: ${contact.lostReason || 'N/A'}`);
      console.log(`     Close Date: ${contact.closedate || 'N/A'}`);
    });
    console.log();

    // Test 3: Check for recent opt-outs
    console.log('Test 3: Checking for Recent Opt-Outs (last 24 hours)...');
    console.log('-'.repeat(70));
    const optOuts = await queryNewOptOuts(24, { verbose: true });
    console.log(`Recent Opt-Outs: ${optOuts.length}`);
    if (optOuts.length > 0) {
      console.log('Sample Opt-Outs:');
      optOuts.slice(0, 3).forEach((contact, i) => {
        console.log(`  ${i + 1}. ${contact.email} (${contact.optOutDate})`);
      });
    }
    console.log();

    // Summary
    console.log('='.repeat(70));
    console.log('TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`✓ Statistics Query: Success`);
    console.log(`✓ Eligible Contacts Query: ${contacts.length} contacts`);
    console.log(`✓ Opt-Out Query: ${optOuts.length} recent opt-outs`);
    console.log(`✓ Target Validation: ${percentDiff}% variance from HubSpot`);
    console.log();

  } catch (error) {
    console.error('Error running tests:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testQueries()
  .then(() => {
    console.log('All tests completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
