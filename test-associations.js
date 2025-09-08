const mysql = require('mysql2/promise');

async function testAssociations() {
  let connection;
  try {
    // Use same connection config as the other scripts
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Kx#mP9$vL2qR',
      database: 'ulearn_gads'
    });
    
    console.log('🔗 Database connected');
    
    // Check recent PAID_SEARCH contacts
    const [recentContacts] = await connection.execute(`
      SELECT COUNT(*) as total_recent_paid_search_contacts 
      FROM hub_contacts 
      WHERE hs_analytics_source = 'PAID_SEARCH' 
        AND DATE(createdate) >= DATE_SUB(CURDATE(), INTERVAL 7 DAYS)
    `);
    
    // Check recent contacts WITH associations  
    const [contactsWithAssociations] = await connection.execute(`
      SELECT COUNT(*) as recent_contacts_with_associations
      FROM hub_contacts c
      JOIN hub_contact_deal_associations a ON c.hubspot_id = a.contact_hubspot_id
      WHERE c.hs_analytics_source = 'PAID_SEARCH' 
        AND DATE(c.createdate) >= DATE_SUB(CURDATE(), INTERVAL 7 DAYS)
    `);
    
    // Total association count
    const [totalAssociations] = await connection.execute(`
      SELECT COUNT(*) as total_associations 
      FROM hub_contact_deal_associations
    `);
    
    console.log('\n📊 Association Test Results:');
    console.log('Recent PAID_SEARCH contacts (7 days):', recentContacts[0].total_recent_paid_search_contacts);
    console.log('Recent contacts WITH associations:', contactsWithAssociations[0].recent_contacts_with_associations);
    console.log('Total associations in table:', totalAssociations[0].total_associations);
    
    // Show sample of recent contacts without associations
    const [samplesWithoutAssoc] = await connection.execute(`
      SELECT c.hubspot_id, c.firstname, c.lastname, c.createdate, c.hs_analytics_source
      FROM hub_contacts c
      LEFT JOIN hub_contact_deal_associations a ON c.hubspot_id = a.contact_hubspot_id
      WHERE c.hs_analytics_source = 'PAID_SEARCH' 
        AND DATE(c.createdate) >= DATE_SUB(CURDATE(), INTERVAL 7 DAYS)
        AND a.contact_hubspot_id IS NULL
      LIMIT 5
    `);
    
    console.log('\n📋 Sample recent PAID_SEARCH contacts WITHOUT associations:');
    samplesWithoutAssoc.forEach((contact, index) => {
      console.log(`${index + 1}. ID: ${contact.hubspot_id}, Name: ${contact.firstname} ${contact.lastname}, Created: ${contact.createdate}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testAssociations();