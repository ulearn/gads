/**
 * Test script for refactored MCP MySQL module
 * Tests integration with existing analytics modules
 */

// Load environment variables first
require('dotenv').config();

const mcpRefactored = require('./mcp-mysql-refactored');

async function testRefactoredFunctions() {
  console.log('🧪 Testing refactored MCP MySQL functions...\n');
  
  const tests = [
    {
      name: 'Dashboard Summary (Pipeline Mode)',
      func: () => mcpRefactored.getDashboardSummary({ days: 7, mode: 'pipeline' })
    },
    {
      name: 'Dashboard Summary (Revenue Mode)', 
      func: () => mcpRefactored.getDashboardSummary({ days: 7, mode: 'revenue' })
    },
    {
      name: 'Pipeline Analysis',
      func: () => mcpRefactored.getPipelineAnalysis({ days: 7, campaign: 'all' })
    },
    {
      name: 'Burn Rate Analysis',
      func: () => mcpRefactored.getBurnRateAnalysis({ days: 7, granularity: 'daily' })
    },
    {
      name: 'Campaign Performance',
      func: () => mcpRefactored.getCampaignPerformance({ days: 7, mode: 'pipeline' })
    },
    {
      name: 'Territory Analysis',
      func: () => mcpRefactored.getTerritoryAnalysis({ days: 7, mode: 'pipeline' })
    }
  ];
  
  for (const test of tests) {
    console.log(`🔄 Testing: ${test.name}`);
    try {
      const result = await test.func();
      
      if (result.success) {
        console.log(`✅ ${test.name}: SUCCESS`);
        console.log(`   - Has data: ${!!result.data}`);
        console.log(`   - Has report: ${!!result.report}`);
        console.log(`   - Report length: ${result.report?.length || 0} chars`);
      } else {
        console.log(`❌ ${test.name}: FAILED`);
        console.log(`   - Error: ${result.error}`);
      }
    } catch (error) {
      console.log(`💥 ${test.name}: EXCEPTION`);
      console.log(`   - Error: ${error.message}`);
    }
    console.log(''); // Empty line
  }
  
  console.log('🏁 Test completed!');
  process.exit(0);
}

testRefactoredFunctions().catch(error => {
  console.error('💥 Test script failed:', error.message);
  process.exit(1);
});