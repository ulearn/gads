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
const { syncLogger } = require('../../logger');

/**
 * SMART SYNC: Check if a record needs to be synced
 * Only sync if lastmodifieddate in HubSpot differs from MySQL OR record doesn't exist
 */
async function shouldSyncRecord(connection, hubspotObject, objectType) {
  try {
    const dateField = objectType === 'contacts' ? 'lastmodifieddate' : 'hs_lastmodifieddate';
    const tableName = objectType === 'contacts' ? 'hub_contacts' : 'hub_deals';
    const idField = objectType === 'contacts' ? 'hubspot_id' : 'hubspot_deal_id';

    // Get the lastmodifieddate from HubSpot
    const hubspotDateStr = hubspotObject.properties[dateField];
    if (!hubspotDateStr) {
      return true; // No date in HubSpot, sync it anyway
    }

    const hubspotDate = new Date(hubspotDateStr);

    // Check if record exists in MySQL and get its lastmodifieddate
    const [rows] = await connection.execute(
      `SELECT ${dateField} FROM ${tableName} WHERE ${idField} = ? LIMIT 1`,
      [hubspotObject.id]
    );

    // If doesn't exist in MySQL, we need to sync it
    if (rows.length === 0) {
      return true;
    }

    // Record exists - compare dates
    const mysqlDate = new Date(rows[0][dateField]);

    // Only sync if dates are different
    const needsSync = hubspotDate.getTime() !== mysqlDate.getTime();

    return needsSync;

  } catch (error) {
    // If error checking, sync it to be safe
    syncLogger.error(`   ⚠️ Error checking if sync needed for ${objectType} ${hubspotObject.id}: ${error.message}`);
    return true;
  }
}

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
    syncLogger.log('✅ Association table ready');
    
  } catch (error) {
    syncLogger.error('❌ Failed to create association table: ' + error.message);
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
        syncLogger.error(`   ⚠️ Failed to save association ${contactId} → ${dealId}: ` + error.message);
      }
    }
    
    return savedCount;
    
  } catch (error) {
    syncLogger.error(`❌ Error saving associations for contact ${contactId}: ` + error.message);
    return 0;
  }
}

/**
 * FIXED: Enhanced sync function that captures BOTH new records AND updates
 * CRITICAL CHANGE: Uses lastmodifieddate instead of createdate
 *
 * NEW FIXES:
 * - Added error handling with retry logic for rate limiting
 * - Increased delay to 500ms to avoid rate limits
 * - Added progress tracking (current page / total)
 * - Always logs completion status (success or failure)
 */
async function syncObjectsWithAllPropertiesAndAssociations(hubspotClient, connection, objectType, startDate, endDate, allPropertyNames) {
  let after = undefined;
  let totalSynced = 0;
  let page = 1;
  let totalCount = null; // Track total count from HubSpot
  let consecutiveErrors = 0;
  const MAX_RETRIES = 3;
  const processedContactIds = new Set(); // Track contact IDs from this batch

  try {
    syncLogger.log(`🔄 Syncing ${objectType} with associations (${allPropertyNames.length} properties)...`);
    syncLogger.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    syncLogger.log(`🔧 USING lastmodifieddate filter (captures both new records AND updates)`);

    const dateFieldName = objectType === 'contacts' ? 'lastmodifieddate' : 'hs_lastmodifieddate';
    syncLogger.log(`🔍 Using field: ${dateFieldName} for ${objectType}`);

    while (true) {
      let response;
      let retryCount = 0;
      let pageSuccess = false;

      // Retry loop for this page
      while (!pageSuccess && retryCount < MAX_RETRIES) {
        try {
          // Build search request
          const searchRequest = {
            filterGroups: [{
              filters: objectType === 'contacts'
                ? [
                    {
                      propertyName: dateFieldName,
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
                : [
                    {
                      propertyName: dateFieldName,
                      operator: 'BETWEEN',
                      value: startDate.getTime().toString(),
                      highValue: endDate.getTime().toString()
                    }
                  ]
            }],
            properties: allPropertyNames,
            associations: objectType === 'contacts' ? ['deals'] : ['contacts'],
            limit: 100,
            after: after
          };

          // Make API call
          if (objectType === 'contacts') {
            response = await hubspotClient.crm.contacts.searchApi.doSearch(searchRequest);
          } else if (objectType === 'deals') {
            response = await hubspotClient.crm.deals.searchApi.doSearch(searchRequest);
          }

          pageSuccess = true;
          consecutiveErrors = 0; // Reset error counter on success

          // Capture total count on first page
          if (page === 1 && response.total !== undefined) {
            totalCount = response.total;
            const estimatedPages = Math.ceil(totalCount / 100);
            syncLogger.log(`📊 HubSpot reports ${totalCount} total ${objectType} (≈${estimatedPages} pages)`);
          }

        } catch (error) {
          retryCount++;
          consecutiveErrors++;

          // Check if rate limited (429 error)
          const isRateLimited = error.statusCode === 429 || error.message?.includes('rate limit');
          const retryAfter = error.headers?.['retry-after'] || 10;

          if (isRateLimited) {
            syncLogger.error(`⚠️ Rate limited on page ${page}, waiting ${retryAfter}s before retry ${retryCount}/${MAX_RETRIES}`);
            await delay(retryAfter * 1000);
          } else {
            syncLogger.error(`❌ Error on page ${page} (retry ${retryCount}/${MAX_RETRIES}): ${error.message}`);
            await delay(2000 * retryCount); // Exponential backoff
          }

          if (retryCount >= MAX_RETRIES) {
            throw new Error(`Failed after ${MAX_RETRIES} retries on page ${page}: ${error.message}`);
          }

          // If too many consecutive errors, abort
          if (consecutiveErrors >= 10) {
            throw new Error(`Too many consecutive errors (${consecutiveErrors}), aborting sync`);
          }
        }
      }

      const objects = response.results || [];

      if (objects.length === 0) {
        syncLogger.log(`   ℹ️ No more results at page ${page}`);
        break;
      }

      // Enhanced progress logging
      const progressStr = totalCount
        ? `${page}/${Math.ceil(totalCount / 100)}`
        : `${page}`;
      const recordRange = `${totalSynced + 1}-${totalSynced + objects.length}`;
      const totalStr = totalCount ? ` of ${totalCount}` : '';

      syncLogger.log(`   📄 Page ${progressStr}: Processing ${objects.length} ${objectType} (records ${recordRange}${totalStr})...`);

      // Process objects
      for (const obj of objects) {
        // Track contact IDs from this batch (for STEP 5 deal sync)
        if (objectType === 'contacts') {
          processedContactIds.add(obj.id);
        }

        // Debug logging for important records
        if (objectType === 'deals' && (obj.properties?.dealname?.includes('Aika') || obj.properties?.amount)) {
          syncLogger.log(`   🔍 Processing deal: ${obj.properties?.dealname} | Stage: ${obj.properties?.dealstage} | Amount: ${obj.properties?.amount}`);
        }
        if (objectType === 'contacts' && obj.properties?.email?.includes('aika')) {
          syncLogger.log(`   🔍 Processing contact: ${obj.properties?.email} | Modified: ${obj.properties?.lastmodifieddate}`);
        }

        // Check for Alceu specifically
        if (objectType === 'contacts' && obj.id === '128995339456') {
          syncLogger.log(`   ✅ FOUND ALCEU CONTACT: ${obj.id} - ${obj.properties?.email}`);
        }
        if (objectType === 'deals' && obj.id === '71535187170') {
          syncLogger.log(`   ✅ FOUND ALCEU DEAL: ${obj.id} - ${obj.properties?.dealname}`);
        }

        // Note: Search API doesn't return associations, so deals are synced in STEP 5
        // after fetching associations via Associations API in STEP 4

        // SMART SYNC: Check if this contact/deal record itself needs updating
        const needsSync = await shouldSyncRecord(connection, obj, objectType);
        if (!needsSync) {
          syncLogger.log(`   ⏭️  Skipping ${objectType} ${obj.id} - already up-to-date`);
          continue; // Skip syncing this record, but deals were already synced above
        }

        // Save the main object (contact or deal) - only if it needs updating
        const success = await fieldMap.processHubSpotObject(obj, connection, objectType);
        if (success) {
          totalSynced++;
        }
      }

      after = response.paging?.next?.after;
      if (!after) {
        syncLogger.log(`   ℹ️ No more pages (pagination token empty)`);
        break;
      }

      page++;

      // MEMORY OPTIMIZATION: Force garbage collection every 5 pages
      if (page % 5 === 0) {
        if (global.gc) {
          global.gc();
          syncLogger.log(`   🧹 Memory cleanup at page ${page}`);
        }
      }

      // FIXED: Increased delay to 500ms to avoid rate limiting
      // HubSpot limit: 100 req/10s = max 10 req/s
      // 500ms = 2 req/s = well under limit
      await delay(500);
    }

    // ALWAYS log completion
    const completionMsg = totalCount
      ? `✅ ${objectType} sync complete: ${totalSynced}/${totalCount} records (${page} pages)`
      : `✅ ${objectType} sync complete: ${totalSynced} records (${page} pages)`;

    if (objectType === 'contacts') {
      syncLogger.log(`${completionMsg} (deals will be synced in STEP 5)`);
    } else {
      syncLogger.log(completionMsg);
    }

    return {
      synced: totalSynced,
      associations: 0, // Associations are handled in STEP 4
      total: totalCount,
      pages: page,
      dealsSynced: 0, // Deals are synced in STEP 5
      dealIds: [],
      contactIds: objectType === 'contacts' ? Array.from(processedContactIds) : [] // Contact IDs from this batch
    };

  } catch (error) {
    // ALWAYS log failure state
    syncLogger.error(`❌ ${objectType} sync FAILED at page ${page}: ${error.message}`);
    syncLogger.error(`   Progress: ${totalSynced} of ${totalCount || 'unknown'} records synced before failure`);
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
    syncLogger.log(`🔍 Getting ${objectType} properties from HubSpot...`);
    
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
      syncLogger.log(`⚠️ Skipped ${skippedCount} problematic properties to avoid row size limits`);
    }
    
    syncLogger.log(`✅ Found ${allProperties.length} ${objectType} properties, using ${filteredProperties.length} safe ones`);
    
    return filteredProperties;
    
  } catch (error) {
    syncLogger.error(`❌ Failed to get ${objectType} properties: ` + error.message);
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
    syncLogger.error(`❌ Failed to get existing columns for ${tableName}: ` + error.message);
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
    syncLogger.log(`✅ ${tableName}: Schema up to date`);
    return;
  }

  syncLogger.log(`🔧 ${tableName}: Adding ${missingColumns.length} missing columns...`);
  
  for (const column of missingColumns) {
    try {
      const columnType = getColumnType(column.type, column.fieldType);
      const alterQuery = `ALTER TABLE ${tableName} ADD COLUMN \`${column.name}\` ${columnType}`;
      
      await connection.execute(alterQuery);
      syncLogger.log(`   ✅ Added column: ${column.name}`);
      
    } catch (error) {
      syncLogger.error(`   ❌ Failed to add column ${column.name}: ` + error.message);
    }
  }
}

/**
 * Sync HubSpot schema with MySQL tables
 */
async function syncSchema(hubspotClient, getDbConnection) {
  try {
    syncLogger.log('🚀 Starting schema sync...');
    
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
      
      syncLogger.log(`📊 Contacts: ${contactProperties.length} properties, ${missingContactColumns.length} missing`);
      syncLogger.log(`   ⚠️ SKIPPING old schema sync - using dynamic field mapping with extension tables instead`);
      
      // Process deals schema  
      const dealProperties = await getAllAvailableProperties(hubspotClient, 'deals');
      const existingDealColumns = await getExistingColumns(connection, 'hub_deals');
      
      const missingDealColumns = dealProperties.filter(
        prop => !existingDealColumns.includes(prop.name)
      );
      
      syncLogger.log(`📊 Deals: ${dealProperties.length} properties, ${missingDealColumns.length} missing`);
      syncLogger.log(`   ⚠️ SKIPPING old schema sync - using dynamic field mapping with extension tables instead`);
      
      syncLogger.log('✅ Schema sync completed');
      
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
    syncLogger.error('💥 Schema sync failed:' + error.message);
    throw error;
  }
}

/**
 * NEW: Sync contact-deal associations using the Associations API v4
 * This runs AFTER contacts and deals are synced
 */
async function syncContactDealAssociations(hubspotClient, connection, batchContactIds = null, saveToDb = true) {
  try {
    syncLogger.log('🔗 Starting contact-deal associations sync using Associations API v4...');

    let contactIds;

    if (batchContactIds && batchContactIds.length > 0) {
      // Use provided contact IDs from current batch
      syncLogger.log(`   📋 Using ${batchContactIds.length} contacts from current batch`);
      contactIds = batchContactIds.map(id => ({ id }));
    } else {
      // Fallback: Get contacts that either have deals OR were recently modified
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

      syncLogger.log(`   📊 Found ${contacts.length} contacts to check (existing + recently modified)`);

      if (contacts.length === 0) {
        syncLogger.log('   ⚠️ No contacts found with deals or recent modifications');
        return { success: true, associations: 0, associationsList: [], dealIds: [] };
      }

      contactIds = contacts.map(row => ({ id: row.hubspot_id }));
    }
    let totalAssociations = 0;
    let contactsWithAssociations = 0;
    const associationsList = []; // Collect all associations
    const dealIdsSet = new Set(); // Collect unique deal IDs

    // Process in batches of 100 (API limit)
    for (let i = 0; i < contactIds.length; i += 100) {
      const batch = contactIds.slice(i, i + 100);

      syncLogger.log(`   📦 Processing batch ${Math.floor(i/100) + 1}/${Math.ceil(contactIds.length/100)}`);

      try {
        // Use the V3 batch API (V4 doesn't have batch endpoints)
        const response = await hubspotClient.crm.associations.batchApi.read(
          'contacts', // fromObjectType
          'deals',    // toObjectType
          {
            inputs: batch
          }
        );

        syncLogger.log(`   🔍 API Response for batch: ` + JSON.stringify({
          status: response.status,
          resultsCount: response.results?.length || 0
        }));

        // Step 3: Process the associations
        if (response.results && response.results.length > 0) {
          for (const result of response.results) {
            // FIXED: Parse the correct structure from V3 API
            const contactId = result._from?.id || result.from?.id;
            const dealAssociations = result.to || [];

            if (contactId && dealAssociations.length > 0) {
              syncLogger.log(`   🔗 Contact ${contactId} has ${dealAssociations.length} deal associations`);
              contactsWithAssociations++;

              // Collect or save each association
              for (const dealAssoc of dealAssociations) {
                const dealId = dealAssoc.id;

                if (dealId) {
                  // Add to collections
                  associationsList.push({ contactId, dealId });
                  dealIdsSet.add(dealId);

                  if (saveToDb) {
                    // Save to database
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
                          syncLogger.log(`     ✅ NEW association: ${contactId} → ${dealId}`);
                        } else {
                          syncLogger.log(`     🔄 Updated association: ${contactId} → ${dealId}`);
                        }
                      }

                    } catch (error) {
                      syncLogger.error(`     ❌ Failed to save association ${contactId} → ${dealId}:` + error.message);
                    }
                  } else {
                    // Just count for logging
                    totalAssociations++;
                  }
                }
              }
            }
          }
        }

        // Rate limiting
        await delay(200);

      } catch (error) {
        syncLogger.error(`   ❌ Failed to fetch associations for batch:` + error.message);
        syncLogger.error(`   📋 Batch sample: ` + JSON.stringify(batch.slice(0, 3))); // Log first 3 for debugging
      }
    }

    if (saveToDb) {
      syncLogger.log(`✅ Associations sync complete: ${totalAssociations} associations saved to DB`);
    } else {
      syncLogger.log(`✅ Associations query complete: ${totalAssociations} associations found`);
    }
    syncLogger.log(`   📊 Contacts with associations: ${contactsWithAssociations}`);
    syncLogger.log(`   📋 Unique deals found: ${dealIdsSet.size}`);

    return {
      success: true,
      associations: totalAssociations,
      contacts_processed: contactIds.length,
      contacts_with_associations: contactsWithAssociations,
      associationsList: associationsList,
      dealIds: Array.from(dealIdsSet)
    };

  } catch (error) {
    syncLogger.error('❌ Associations sync failed:' + error.message);
    throw error;
  }
}

/**
 * Save associations to database (after deals are synced)
 */
async function saveAssociationsToDb(connection, associationsList) {
  try {
    syncLogger.log('💾 Saving associations to database...');
    let saved = 0;
    let updated = 0;
    let errors = 0;

    for (const assoc of associationsList) {
      try {
        const [insertResult] = await connection.execute(`
          INSERT INTO hub_contact_deal_associations
          (contact_hubspot_id, deal_hubspot_id, association_type)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
        `, [assoc.contactId, assoc.dealId, 'primary']);

        if (insertResult.affectedRows > 0) {
          if (insertResult.insertId > 0) {
            saved++;
          } else {
            updated++;
          }
        }
      } catch (error) {
        errors++;
        syncLogger.error(`   ❌ Failed to save association ${assoc.contactId} → ${assoc.dealId}: ${error.message}`);
      }
    }

    syncLogger.log(`✅ Associations saved: ${saved} new, ${updated} updated, ${errors} errors`);
    return { saved, updated, errors };

  } catch (error) {
    syncLogger.error('❌ Failed to save associations:' + error.message);
    throw error;
  }
}

/**
 * NEW: Sync deals by ID list (association-based sync)
 * No date filtering - gets ALL deals associated with synced contacts
 */
async function syncDealsByIds(hubspotClient, connection, dealIds, allPropertyNames) {
  if (!dealIds || dealIds.length === 0) {
    syncLogger.log('ℹ️ No deal IDs to sync');
    return { synced: 0, total: 0 };
  }

  syncLogger.log(`🔄 Syncing ${dealIds.length} deals by association (no date filter)...`);

  const BATCH_SIZE = 100; // HubSpot batch API limit
  let totalSynced = 0;
  let totalBatches = Math.ceil(dealIds.length / BATCH_SIZE);

  try {
    for (let i = 0; i < dealIds.length; i += BATCH_SIZE) {
      const batchIds = dealIds.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      syncLogger.log(`   📦 Batch ${batchNum}/${totalBatches}: Fetching ${batchIds.length} deals...`);

      try {
        const response = await hubspotClient.crm.deals.batchApi.read({
          properties: allPropertyNames,
          inputs: batchIds.map(id => ({ id }))
        });

        const deals = response.results || [];
        syncLogger.log(`   ✅ Retrieved ${deals.length} deals from HubSpot`);

        // Sync each deal to MySQL
        for (const deal of deals) {
          try {
            // Check for Alceu's deal
            if (deal.id === '71535187170') {
              syncLogger.log(`   ✅ FOUND ALCEU DEAL: ${deal.id} - ${deal.properties?.dealname} - €${deal.properties?.amount}`);
            }

            // Use smart sync check
            const needsSync = await shouldSyncRecord(connection, deal, 'deals');
            if (!needsSync) {
              syncLogger.log(`   ⏭️  Skipping deal ${deal.id} - already up-to-date`);
              continue;
            }

            const success = await fieldMap.processHubSpotObject(deal, connection, 'deals');
            if (success) {
              totalSynced++;
            }
          } catch (error) {
            syncLogger.error(`   ❌ Failed to sync deal ${deal.id}: ${error.message}`);
          }
        }

        syncLogger.log(`   ✅ Batch ${batchNum} complete: ${totalSynced} deals synced so far\n`);

      } catch (error) {
        syncLogger.error(`   ❌ Batch ${batchNum} failed: ${error.message}`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    syncLogger.log(`✅ Association-based deal sync complete: ${totalSynced}/${dealIds.length} deals`);
    return { synced: totalSynced, total: dealIds.length };

  } catch (error) {
    syncLogger.error(`❌ Deal sync by IDs failed: ${error.message}`);
    throw error;
  }
}

/**
 * FIXED: Enhanced sync function with proper date handling for lastmodifieddate
 */
async function runSyncWithSchemaCheck(hubspotClient, getDbConnection, options = {}) {
  try {
    // Step 1: Sync schema first
    syncLogger.log('🔧 STEP 1: Syncing schema...');
    await syncSchema(hubspotClient, getDbConnection);
    
    // Step 2: Get current complete property lists
    syncLogger.log('📋 STEP 2: Getting property lists for data sync...');
    const contactProperties = await getAllAvailableProperties(hubspotClient, 'contacts');
    const dealProperties = await getAllAvailableProperties(hubspotClient, 'deals');
    
    const contactPropertyNames = contactProperties.map(p => p.name);
    const dealPropertyNames = dealProperties.map(p => p.name);
    
    // Step 3: FIXED date range calculation - includes TODAY
    // NEW: Supports DATETIME filtering for hourly/minute batches
    syncLogger.log('🚀 STEP 3: Calculating date range for sync...');

    let startDate, endDate;
    let hasTimeComponent = false;

    if (options.startDate && options.endDate) {
      // Check if datetime was specified (contains 'T' or ':' indicating time)
      hasTimeComponent = (options.startDate.includes('T') || options.startDate.includes(':')) &&
                        (options.endDate.includes('T') || options.endDate.includes(':'));

      startDate = new Date(options.startDate);
      endDate = new Date(options.endDate);

      // Only force end-of-day if NO time component was provided
      if (!hasTimeComponent) {
        endDate.setHours(23, 59, 59, 999); // End of day for date-only filters
        if (!options.startDate.includes('T') && !options.startDate.includes(':')) {
          startDate.setHours(0, 0, 0, 0); // Start of day for date-only filters
        }
      }
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

    // Show full datetime if time component present, otherwise just date
    if (hasTimeComponent) {
      syncLogger.log(`📅 SYNC DATETIME RANGE: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      syncLogger.log(`⏰ HOURLY BATCH MODE: Syncing specific time window`);
    } else {
      syncLogger.log(`📅 SYNC DATE RANGE: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
    }
    syncLogger.log(`🔧 USING lastmodifieddate filter - captures NEW records AND updates!`);
    
    const connection = await getDbConnection();
    
    try {
      // STEP 3: Sync contacts using date filter
      const contactResult = await syncObjectsWithAllPropertiesAndAssociations(
        hubspotClient, connection, 'contacts', startDate, endDate, contactPropertyNames
      );

      // STEP 4: Query associations via Associations API v4 (don't save yet - deals may not exist)
      syncLogger.log('🔗 STEP 4: Querying contact-deal associations from HubSpot...');
      const associationsResult = await syncContactDealAssociations(
        hubspotClient, connection, contactResult.contactIds, false // saveToDb=false
      );

      // STEP 5: Sync deals using deal IDs from associations
      syncLogger.log('🔗 STEP 5: Syncing deals from associations...');
      syncLogger.log(`   📋 Found ${associationsResult.dealIds.length} unique deals to sync`);

      const dealResult = await syncDealsByIds(
        hubspotClient, connection, associationsResult.dealIds, dealPropertyNames
      );

      // STEP 6: Save associations to database (after deals exist)
      syncLogger.log('🔗 STEP 6: Saving contact-deal associations to database...');
      const saveResult = await saveAssociationsToDb(connection, associationsResult.associationsList);

      syncLogger.log('🎉 ASSOCIATION-BASED DEAL SYNC completed successfully!');
      syncLogger.log(`📊 Synced: ${contactResult.synced} contacts, ${dealResult.synced} deals`);
      syncLogger.log(`🔗 Contact-Deal Associations: ${saveResult.saved} new, ${saveResult.updated} updated`);
      syncLogger.log(`✨ Deals synced BEFORE associations saved (correct FK order)!`);

      return {
        success: true,
        contacts_synced: contactResult.synced,
        deals_synced: dealResult.synced,
        associations_synced: saveResult.saved + saveResult.updated,
        contact_properties_used: contactPropertyNames.length,
        deal_properties_used: dealPropertyNames.length,
        sync_method: 'association-based (deals synced before associations saved - correct FK order)',
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
    syncLogger.error('💥 Enhanced sync failed:' + error.message);
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
  syncContactDealAssociations,
  syncDealsByIds // NEW: Association-based deal sync
};