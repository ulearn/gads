require('dotenv').config();
const hubspot = require('@hubspot/api-client');

const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

(async () => {
  try {
    // Get Alceu's deal with contact associations
    const deal = await hubspotClient.crm.deals.basicApi.getById('71535187170', ['dealname', 'amount', 'closedate', 'dealstage'], ['contacts']);
    
    console.log('=== DEAL 71535187170 ===');
    console.log('ID:', deal.id);
    console.log('Name:', deal.properties.dealname);
    console.log('Amount:', deal.properties.amount);
    console.log('Stage:', deal.properties.dealstage);
    console.log('\nAssociations:');
    console.log(JSON.stringify(deal.associations, null, 2));
    
    if (deal.associations?.contacts?.results) {
      console.log('\nContacts associated:', deal.associations.contacts.results.length);
      deal.associations.contacts.results.forEach(contact => {
        console.log('  - Contact ID:', contact.id, contact.id === '128995339456' ? '<-- ALCEU CONTACT' : '');
      });
    } else {
      console.log('\n❌ NO CONTACT ASSOCIATIONS FOUND');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
