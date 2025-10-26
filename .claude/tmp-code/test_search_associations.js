require('dotenv').config();
const hubspot = require('@hubspot/api-client');

const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

(async () => {
  try {
    // Query for ONE contact modified in batch-6 range
    const searchRequest = {
      filterGroups: [{
        filters: [{
          propertyName: 'lastmodifieddate',
          operator: 'BETWEEN',
          highValue: '2025-10-24T13:02:00.000Z',
          value: '2025-10-24T12:26:00.000Z'
        }]
      }],
      properties: ['email', 'firstname', 'lastname', 'lastmodifieddate'],
      associations: ['deals'],
      limit: 1
    };

    const response = await hubspotClient.crm.contacts.searchApi.doSearch(searchRequest);
    
    console.log('=== SEARCH API RESPONSE ===');
    console.log('Total results:', response.total);
    
    if (response.results && response.results.length > 0) {
      const contact = response.results[0];
      console.log('\nContact ID:', contact.id);
      console.log('Email:', contact.properties?.email);
      console.log('\nAssociations object:');
      console.log(JSON.stringify(contact.associations, null, 2));
      
      if (contact.associations?.deals) {
        console.log('\nDeals found:', contact.associations.deals.results?.length || 0);
        if (contact.associations.deals.results) {
          contact.associations.deals.results.forEach(deal => {
            console.log('  - Deal ID:', deal.id);
          });
        }
      } else {
        console.log('\n❌ NO ASSOCIATIONS RETURNED IN RESPONSE');
      }
    } else {
      console.log('\n❌ NO CONTACTS RETURNED');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
