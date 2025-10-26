/**
 * Test Script: Call MCP endpoint directly to test keyword creation
 * This replicates exactly what Claude Desktop does
 */

const axios = require('axios');

const MCP_URL = 'https://hub.ulearnschool.com/gads/mcp';
const AUTH_TOKEN = 'ulearn-mcp-20250901-5f1709520f2f5cf0';

async function testMCPKeywordCreation() {
  console.log('🧪 Testing MCP keyword creation endpoint...\n');

  // Test with BROAD match (required for campaign 35128987)
  const requestBody = {
    jsonrpc: '2.0',
    id: 999,
    method: 'tools/call',
    params: {
      name: 'GAds_Universal_Write_API',
      arguments: {
        resource_type: 'adGroupCriteria',
        operation_type: 'create',
        confirm_danger: true,
        operations: [
          {
            status: 'PAUSED',
            keyword: {
              text: 'test mcp final dublin',
              match_type: 'BROAD'  // BROAD required for campaign 35128987
            },
            ad_group: 'customers/1051706978/adGroups/190629382547',  // English Schools - Dublin Ireland
            cpc_bid_micros: 2000000
          }
        ]
      }
    }
  };

  console.log('📤 Request:', JSON.stringify(requestBody, null, 2));
  console.log('\n🔄 Calling MCP endpoint...\n');

  try {
    const response = await axios.post(MCP_URL, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    console.log('✅ Response received:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data?.result?.content?.[0]?.text) {
      console.log('\n📋 MCP Report:');
      console.log(response.data.result.content[0].text);
    }

    return response.data;
  } catch (error) {
    console.log('❌ Request failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
    return null;
  }
}

testMCPKeywordCreation()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test error:', error);
    process.exit(1);
  });
