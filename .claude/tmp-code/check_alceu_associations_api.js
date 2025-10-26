require('dotenv').config();
const hubspot = require('@hubspot/api-client');

const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

(async () => {
  try {
    console.log('=== Checking Alceu Contact Associations via Associations API ===\n');
    
    // Use Associations API v4 to get deal associations for Alceu
    const response = await hubspotClient.apiRequest({
      method: 'POST',
      path: '/crm/v4/associations/contacts/deals/batch/read',
      body: {
        inputs: [{ id: '128995339456' }]
      }
    });
    
    const data = await response.json();
    console.log('Associations API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      console.log('\nContact ID:', result.from.id);
      console.log('Associated Deals:', result.to?.length || 0);
      
      if (result.to && result.to.length > 0) {
        result.to.forEach(deal => {
          const isAlceuDeal1 = deal.toObjectId === '77588262076';
          const isAlceuDeal2 = deal.toObjectId === '71535187170';
          console.log('  - Deal ID:', deal.toObjectId, 
            isAlceuDeal1 ? '<-- DEAL 1' : isAlceuDeal2 ? '<-- DEAL 2' : '');
        });
      }
    } else {
      console.log('\n❌ NO ASSOCIATIONS FOUND');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.body) {
      console.error('Body:', error.body);
    }
  }
})();
