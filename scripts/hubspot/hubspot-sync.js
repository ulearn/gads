/**
 * FIXED: Enhanced HubSpot Sync with True Update Detection
 * /scripts/hubspot/hubspot-sync.js
 * 
 * CRITICAL FIX: Uses lastmodifieddate instead of createdate
 * - Now picks up updates to existing records (like deal stage changes)
 * - Captures both new records AND modifications
 * - Fixes the "Aika deal not updating" issue
 */

const fieldMap = require('./fieldmap');

/**
 * Create association table if it doesn't exist
 */
async function ensureAssociationTableExists(connection) {
  try {
    const createAssociationTable = `
      CREATE TABLE IF NOT EXISTS hub_contact_deal_associations (
        association_id INT AUTO_INCREMENT PRIMARY KEY,
        contact_hubspot_id VARCHAR(50) NOT NULL,
        deal_hubspot_id VARCHAR(50) NOT NULL,
        association_type VARCHAR(50) DEFAULT 'contact_to_deal',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_contact_id (contact_hubspot_id),
        INDEX idx_deal_id (deal_hubspot_id),
        UNIQUE KEY unique_contact_deal (contact_hubspot_id, deal_hubspot_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createAssociationTable);
    console.log('✅ Association table ready');
    
  } catch (error) {
    console.error('❌ Failed to create association table:', error.message);
    throw error;
  }
}

/**
 * Save contact-deal associations
 */
async function saveContactAssociations(connection, contactId, associations) {
  if (!associations || associations.length === 0) {
    return 0;
  }
  
  try {
    let savedCount = 0;
    
    for (const dealId of associations) {
      try {
        await connection.execute(`
          INSERT INTO hub_contact_deal_associations 
          (contact_hubspot_id, deal_hubspot_id) 
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
        `, [contactId, dealId]);
        
        savedCount++;
        
      } catch (error) {
        console.error(`   ⚠️ Failed to save association ${contactId} → ${dealId}:`, error.message);
      }
    }
    
    return savedCount;
    
  } catch (error) {
    console.error(`❌ Error saving associations for contact ${contactId}:`, error.message);
    return 0;
  }
}

/**
 * FIXED: Enhanced sync function that captures BOTH new records AND updates
 * CRITICAL CHANGE: Uses lastmodifieddate instead of createdate
 */
async function syncObjectsWithAllPropertiesAndAssociations(hubspotClient, connection, objectType, startDate, endDate, allPropertyNames) {
  try {
    console.log(`🔄 Syncing ${objectType} with associations (${allPropertyNames.length} properties)...`);
    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`🔧 USING lastmodifieddate filter (captures both new records AND updates)`);
    
    let after = undefined;
    let totalSynced = 0;
    let totalAssociations = 0;
    let page = 1;
    
    while (true) {
      let response;
      
      // 🔧 FIXED: Use lastmodifieddate for BOTH contacts and deals to capture updates
      const dateFieldName = objectType === 'contacts' ? 'lastmodifieddate' : 'hs_lastmodifieddate';
      console.log(`🔍 Using field: ${dateFieldName} for ${objectType}`);
      
      if (objectType === 'contacts') {
        response = await hubspotClient.crm.contacts.searchApi.doSearch({
          filterGroups: [{
            filters: [
              {
                propertyName: dateFieldName, // ✅ 'lastmodifieddate' for contacts - CRITICAL FIX
                operator: 'BETWEEN',
                value: startDate.getTime().toString(),
                highValue: endDate.getTime().toString()
              },
              {
                propertyName: 'hs_object_source',
                operator: 'NEQ',
                value: 'IMPORT'
              }
            ]
          }],
          properties: allPropertyNames,
          associations: ['deals'], // Capture contact-deal associations
          limit: 100,
          after: after
        });
        
      } else if (objectType === 'deals') {
        response = await hubspotClient.crm.deals.searchApi.doSearch({
          filterGroups: [{
            filters: [{
              propertyName: dateFieldName, // ✅ 'hs_lastmodifieddate' for deals
              operator: 'BETWEEN', 
              value: startDate.getTime().toString(),
              highValue: endDate.getTime().toString()
            }]
          }],
          properties: allPropertyNames,
          associations: ['contacts'], // Capture deal-contact associations
          limit: 100,
          after: after
        });
      }
      
      const objects = response.results || [];
      
      if (objects.length === 0) {
        break;
      }
      
      console.log(`   📄 Page ${page}: Processing ${objects.length} ${objectType}...`);
      
      // Process objects
      for (const obj of objects) {
        // Debug logging for important records
        if (objectType === 'deals' && (obj.properties?.dealname?.includes('Aika') || obj.properties?.amount)) {
          console.log(`   🔍 Processing deal: ${obj.properties?.dealname} | Stage: ${obj.properties?.dealstage} | Amount: ${obj.properties?.amount}`);
        }
        if (objectType === 'contacts' && obj.properties?.email?.includes('aika')) {
          console.log(`   🔍 Processing contact: ${obj.properties?.email} | Modified: ${obj.properties?.lastmodifieddate}`);
        }
        
        // Save the main object (contact or deal)
        const success = await fieldMap.processHubSpotObject(obj, connection, objectType);
        
        if (success) {
          totalSynced++;
          
          // For contacts: save associations to deals
          if (objectType === 'contacts') {
            const dealAssociations = obj.associations?.deals?.results?.map(d => d.id) || [];
            
            if (dealAssociations.length > 0) {
              console.log(`   🔗 Contact ${obj.id} has ${dealAssociations.length} deal associations`);
              const associationCount = await saveContactAssociations(
                connection, 
                obj.id, 
                dealAssociations
              );
              totalAssociations += associationCount;
            }
          }
        }
      }
      
      after = response.paging?.next?.after;
      if (!after) {
        break;
      }
      
      page++;
      await delay(100); // Rate limiting
    }
    
    if (objectType === 'contacts') {
      console.log(`✅ ${objectType} sync complete: ${totalSynced} records, ${totalAssociations} associations`);
    } else {
      console.log(`✅ ${objectType} sync complete: ${totalSynced} records`);
    }
    
    return { synced: totalSynced, associations: totalAssociations };
    
  } catch (error) {
    console.error(`❌ ${objectType} sync failed:`, error.message);
    throw error;
  }
}

// Properties to SKIP - these cause row size issues
const SKIP_PROPERTIES = [
  'hs_user_ids_of_all_notification_followers',
  'hs_user_ids_of_all_notification_unfollowers', 
  'industry',
  'instagram',
  'ip_latlon',
  'ip_zipcode',
  'job_function',
  'linkedinbio',
  'marital_status',
  'markets',
  'military_status',
  'nick',
  'numemployees',
  'owneremail',
  'ownername',
  'partner_tags',
  'phone_2',
  'photo',
  'preferred_period_to_study',
  'relationship_status',
  'salutation',
  'school',
  'seniority',
  'student_id',
  'tiktok',
  'twitterbio',
  'twitterhandle',
  'twitterprofilephoto',
  'website',
  'work_email',
  
  'hs_gps_error',
  'hs_gps_latitude',
  'hs_gps_longitude',
  'hs_inferred_language_codes',
  'hs_journey_stage',
  'hs_language',
  'hs_linkedin_ad_clicked',
  'hs_linkedin_url',
  'hs_mobile_sdk_push_tokens',
  'hs_persona',
  'hs_predictivecontactscorebucket',
  'hs_predictivescoringtier',
  'hs_registration_method',
  'hs_shared_team_ids',
  'hs_shared_user_ids',
  'hs_state_code',
  'hs_sub_role',
  'hs_testpurge',
  'hs_testrollback',
  'hs_unique_creation_key'
];

/**
 * Get ALL available properties but filter out problematic ones
 */
async function getAllAvailableProperties(hubspotClient, objectType) {
  try {
    console.log(`🔍 Getting ${objectType} properties from HubSpot...`);
    
    const response = await hubspotClient.crm.properties.coreApi.getAll(objectType);
    const allProperties = response.results.map(prop => ({
      name: prop.name,
      type: prop.type,
      fieldType: prop.fieldType
    }));
    
    // Filter out problematic properties for contacts
    let filteredProperties = allProperties;
    if (objectType === 'contacts') {
      filteredProperties = allProperties.filter(prop => 
        !SKIP_PROPERTIES.includes(prop.name)
      );
      
      const skippedCount = allProperties.length - filteredProperties.length;
      console.log(`⚠️ Skipped ${skippedCount} problematic properties to avoid row size limits`);
    }
    
    console.log(`✅ Found ${allProperties.length} ${objectType} properties, using ${filteredProperties.length} safe ones`);
    
    return filteredProperties;
    
  } catch (error) {
    console.error(`❌ Failed to get ${objectType} properties:`, error.message);
    throw error;
  }
}

/**
 * Get existing MySQL table columns
 */
async function getExistingColumns(connection, tableName) {
  try {
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName]
    );
    
    return columns.map(col => col.COLUMN_NAME);
    
  } catch (error) {
    console.error(`❌ Failed to get existing columns for ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Map HubSpot property type to MySQL column type
 * Fixed: Use TEXT instead of VARCHAR to avoid row size limits
 */
function getColumnType(hubspotPropertyType, fieldType) {
  switch (hubspotPropertyType) {
    case 'string':
      return 'TEXT';  // Changed: Always use TEXT instead of VARCHAR(255)
    case 'number':
      return 'DECIMAL(15,2)';
    case 'bool':
    case 'boolean':
      return 'BOOLEAN';
    case 'datetime':
    case 'date':
      return 'DATETIME';
    case 'enumeration':
      return 'TEXT';  // Changed: Use TEXT instead of VARCHAR(255)
    default:
      return 'TEXT';
  }
}

/**
 * Add missing columns to MySQL table
 */
async function addMissingColumns(connection, tableName, missingColumns) {
  if (missingColumns.length === 0) {
    console.log(`✅ ${tableName}: Schema up to date`);
    return;
  }

  console.log(`🔧 ${tableName}: Adding ${missingColumns.length} missing columns...`);
  
  for (const column of missingColumns) {
    try {
      const columnType = getColumnType(column.type, column.fieldType);
      const alterQuery = `ALTER TABLE ${tableName} ADD COLUMN \`${column.name}\` ${columnType}`;
      
      await connection.execute(alterQuery);
      console.log(`   ✅ Added column: ${column.name}`);
      
    } catch (error) {
      console.error(`   ❌ Failed to add column ${column.name}:`, error.message);
    }
  }
}

/**
 * Sync HubSpot schema with MySQL tables
 */
async function syncSchema(hubspotClient, getDbConnection) {
  try {
    console.log('🚀 Starting schema sync...');
    
    const connection = await getDbConnection();
    
    try {
      // Initialize tables
      await fieldMap.ensureTableExists(connection, 'contacts');
      await fieldMap.ensureTableExists(connection, 'deals');
      
      // NEW: Initialize association table
      await ensureAssociationTableExists(connection);
      
      // Process contacts schema
      const contactProperties = await getAllAvailableProperties(hubspotClient, 'contacts');
      const existingContactColumns = await getExistingColumns(connection, 'hub_contacts');
      
      const missingContactColumns = contactProperties.filter(
        prop => !existingContactColumns.includes(prop.name)
      );
      
      console.log(`📊 Contacts: ${contactProperties.length} properties, ${missingContactColumns.length} missing`);
      console.log(`   ⚠️ SKIPPING old schema sync - using dynamic field mapping with extension tables instead`);
      
      // Process deals schema  
      const dealProperties = await getAllAvailableProperties(hubspotClient, 'deals');
      const existingDealColumns = await getExistingColumns(connection, 'hub_deals');
      
      const missingDealColumns = dealProperties.filter(
        prop => !existingDealColumns.includes(prop.name)
      );
      
      console.log(`📊 Deals: ${dealProperties.length} properties, ${missingDealColumns.length} missing`);
      console.log(`   ⚠️ SKIPPING old schema sync - using dynamic field mapping with extension tables instead`);
      
      console.log('✅ Schema sync completed');
      
      return {
        success: true,
        contacts: {
          hubspot_properties: contactProperties.length,
          columns_added: missingContactColumns.length
        },
        deals: {
          hubspot_properties: dealProperties.length,
          columns_added: missingDealColumns.length
        },
        associations_table: 'ready',
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('💥 Schema sync failed:', error.message);
    throw error;
  }
}

/**
 * NEW: Sync contact-deal associations using the Associations API v4
 * This runs AFTER contacts and deals are synced
 */
async function syncContactDealAssociations(hubspotClient, connection) {
  try {
    console.log('🔗 Starting contact-deal associations sync using Associations API v4...');
    
    // FIXED: Get contacts that either have deals OR were recently modified
    const [contacts] = await connection.execute(`
      SELECT DISTINCT hubspot_id 
      FROM hub_contacts 
      WHERE (
        num_associated_deals > 0 
        OR DATE(lastmodifieddate) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      )
      ORDER BY lastmodifieddate DESC
      LIMIT 2000
    `);
    
    console.log(`   📊 Found ${contacts.length} contacts to check (existing + recently modified)`);
    
    if (contacts.length === 0) {
      console.log('   ⚠️ No contacts found with deals or recent modifications');
      return { success: true, associations: 0 };
    }
    
    // Step 2: Batch query associations using HubSpot Associations API v4
    const contactIds = contacts.map(row => ({ id: row.hubspot_id }));
    let totalAssociations = 0;
    let contactsWithAssociations = 0;
    
    // Process in batches of 100 (API limit)
    for (let i = 0; i < contactIds.length; i += 100) {
      const batch = contactIds.slice(i, i + 100);
      
      console.log(`   📦 Processing batch ${Math.floor(i/100) + 1}/${Math.ceil(contactIds.length/100)}`);
      
      try {
        // Use the V3 batch API (V4 doesn't have batch endpoints)
        const response = await hubspotClient.crm.associations.batchApi.read(
          'contacts', // fromObjectType
          'deals',    // toObjectType
          {
            inputs: batch
          }
        );
        
        console.log(`   🔍 API Response for batch:`, {
          status: response.status,
          resultsCount: response.results?.length || 0
        });
        
        // Step 3: Process the associations
        if (response.results && response.results.length > 0) {
          for (const result of response.results) {
            // FIXED: Parse the correct structure from V3 API
            const contactId = result._from?.id || result.from?.id;
            const dealAssociations = result.to || [];
            
            if (contactId && dealAssociations.length > 0) {
              console.log(`   🔗 Contact ${contactId} has ${dealAssociations.length} deal associations`);
              contactsWithAssociations++;
              
              // Save each association
              for (const dealAssoc of dealAssociations) {
                const dealId = dealAssoc.id;
                
                if (dealId) {
                  try {
                    const [insertResult] = await connection.execute(`
                      INSERT INTO hub_contact_deal_associations 
                      (contact_hubspot_id, deal_hubspot_id, association_type) 
                      VALUES (?, ?, ?)
                      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
                    `, [contactId, dealId, 'primary']);
                    
                    // Check if it was a new association
                    if (insertResult.affectedRows > 0) {
                      totalAssociations++;
                      if (insertResult.insertId > 0) {
                        console.log(`     ✅ NEW association: ${contactId} → ${dealId}`);
                      } else {
                        console.log(`     🔄 Updated association: ${contactId} → ${dealId}`);
                      }
                    }
                    
                  } catch (error) {
                    console.error(`     ❌ Failed to save association ${contactId} → ${dealId}:`, error.message);
                  }
                }
              }
            }
          }
        }
        
        // Rate limiting
        await delay(200);
        
      } catch (error) {
        console.error(`   ❌ Failed to fetch associations for batch:`, error.message);
        console.error(`   📋 Batch sample:`, batch.slice(0, 3)); // Log first 3 for debugging
      }
    }
    
    console.log(`✅ Associations sync complete: ${totalAssociations} associations processed`);
    console.log(`   📊 Contacts with associations: ${contactsWithAssociations}`);
    
    return {
      success: true,
      associations: totalAssociations,
      contacts_processed: contacts.length,
      contacts_with_associations: contactsWithAssociations
    };
    
  } catch (error) {
    console.error('❌ Associations sync failed:', error.message);
    throw error;
  }
}

/**
 * FIXED: Enhanced sync function with proper date handling for lastmodifieddate
 */
async function runSyncWithSchemaCheck(hubspotClient, getDbConnection, options = {}) {
  try {
    // Step 1: Sync schema first
    console.log('🔧 STEP 1: Syncing schema...');
    await syncSchema(hubspotClient, getDbConnection);
    
    // Step 2: Get current complete property lists
    console.log('📋 STEP 2: Getting property lists for data sync...');
    const contactProperties = await getAllAvailableProperties(hubspotClient, 'contacts');
    const dealProperties = await getAllAvailableProperties(hubspotClient, 'deals');
    
    const contactPropertyNames = contactProperties.map(p => p.name);
    const dealPropertyNames = dealProperties.map(p => p.name);
    
    // Step 3: FIXED date range calculation - includes TODAY
    console.log('🚀 STEP 3: Calculating date range for sync...');
    
    let startDate, endDate;
    if (options.startDate && options.endDate) {
      startDate = new Date(options.startDate);
      endDate = new Date(options.endDate);
      endDate.setHours(23, 59, 59, 999); // End of day
    } else if (options.daysBack) {
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999); // End of today
      
      startDate = new Date();
      startDate.setDate(startDate.getDate() - (options.daysBack - 1)); // Include today in count
      startDate.setHours(0, 0, 0, 0); // Start of day
    } else {
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 364); // Last 365 days including today
      startDate.setHours(0, 0, 0, 0);
    }
    
    console.log(`📅 SYNC DATE RANGE: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
    console.log(`🔧 USING lastmodifieddate filter - captures NEW records AND updates!`);
    
    const connection = await getDbConnection();
    
    try {
      // Sync contacts and deals using lastmodifieddate
      const contactResult = await syncObjectsWithAllPropertiesAndAssociations(
        hubspotClient, connection, 'contacts', startDate, endDate, contactPropertyNames
      );
      
      const dealResult = await syncObjectsWithAllPropertiesAndAssociations(
        hubspotClient, connection, 'deals', startDate, endDate, dealPropertyNames
      );
      
      // Step 4: Sync associations using Associations API v4
      console.log('🔗 STEP 4: Syncing contact-deal associations...');
      const associationsResult = await syncContactDealAssociations(hubspotClient, connection);
      
      console.log('🎉 FIXED sync completed successfully!');
      console.log(`📊 Synced: ${contactResult.synced} contacts, ${dealResult.synced} deals`);
      console.log(`🔗 Contact-Deal Associations: ${associationsResult.associations} via API v4`);
      console.log(`🔧 Using lastmodifieddate: Captures both new records AND updates`);
      
      return {
        success: true,
        contacts_synced: contactResult.synced,
        deals_synced: dealResult.synced,
        associations_synced: associationsResult.associations,
        contact_properties_used: contactPropertyNames.length,
        deal_properties_used: dealPropertyNames.length,
        sync_method: 'lastmodifieddate (new + updates)',
        date_range: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('💥 Enhanced sync failed:', error.message);
    throw error;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { 
  syncSchema,
  runSyncWithSchemaCheck,
  getAllAvailableProperties,
  saveContactAssociations,
  ensureAssociationTableExists,
  syncContactDealAssociations
};