require('dotenv').config();
const hubspot = require('@hubspot/api-client');

const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

(async () => {
  try {
    // Get Alceu's contact with deals association
    const contact = await hubspotClient.crm.contacts.basicApi.getById('128995339456', ['email'], ['deals']);
    
    console.log('=== ALCEU CONTACT ===');
    console.log('ID:', contact.id);
    console.log('Email:', contact.properties.email);
    console.log('\nAssociations:');
    console.log(JSON.stringify(contact.associations, null, 2));
    
    if (contact.associations?.deals?.results) {
      console.log('\nDeals associated:', contact.associations.deals.results.length);
      contact.associations.deals.results.forEach(deal => {
        console.log('  - Deal ID:', deal.id, deal.id === '71535187170' ? '<-- ALCEU DEAL' : '');
      });
    } else {
      console.log('\n❌ NO DEAL ASSOCIATIONS FOUND');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
