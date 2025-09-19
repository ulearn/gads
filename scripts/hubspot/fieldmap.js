/**
 * COMPREHENSIVE FIX: Dynamic Field Mapping Module - Production Version
 * Creates every HubSpot field in MySQL with exact field names
 * CRITICAL FIX: Properly handles ALL zero values (0, "0", 0.00) and ensures complete field sync
 */

const { syncLogger } = require('../../logger');

//=============================================================================//
//   SIMPLE CONFIGURATION - Just table names and basics
//=============================================================================//

const TABLE_CONFIGS = {
  contacts: {
    tableName: 'hub_contacts',
    extensionTableName: 'hub_contacts_ext',
    primaryKey: 'contact_id',
    hubspotIdField: 'hubspot_id'
  },
  deals: {
    tableName: 'hub_deals',
    extensionTableName: 'hub_deals_ext',
    primaryKey: 'deal_id',
    hubspotIdField: 'hubspot_deal_id'
  }
};

//=============================================================================//
//   UTILITY FUNCTIONS FOR PROPER VALUE HANDLING
//=============================================================================//

/**
 * CRITICAL FUNCTION: Determines if a value should be synced to MySQL
 * RULE: Only skip NULL and UNDEFINED - NEVER skip zeros, empty strings, false, etc.
 */
function shouldSyncValue(value) {
  // ✅ SYNC these values: 0, "0", 0.00, false, "", "false", []
  // ❌ DON'T SYNC these values: null, undefined
  
  if (value === null || value === undefined) {
    return false; // Skip null/undefined
  }
  
  // EVERYTHING ELSE should be synced, including:
  // - Zero values: 0, "0", 0.00
  // - Empty strings: ""
  // - Boolean false: false, "false" 
  // - Empty arrays: []
  // - Any other actual value
  
  return true;
}

/**
 * Enhanced logging for debugging value sync issues
 */
function logValueSync(fieldName, originalValue, transformedValue, action = 'SYNC') {
  // Special logging for numeric fields and important fields
  if (fieldName.includes('amount') || 
      fieldName.includes('price') || 
      fieldName.includes('cost') || 
      fieldName.includes('revenue') ||
      fieldName.includes('value') ||
      originalValue === 0 || 
      originalValue === "0") {
    
    syncLogger.log(`   💾 ${action}: ${fieldName} = "${originalValue}" (${typeof originalValue}) → "${transformedValue}" (${typeof transformedValue})`);
  }
}

//=============================================================================//
//   DYNAMIC FIELD HANDLER FUNCTIONS
//=============================================================================//

/**
 * Check if a column exists and route appropriately:
 * - If exists in main table → use main table
 * - If exists in extension table → use extension table  
 * - If doesn't exist anywhere → create in extension table (NEW FIELDS GO TO EXTENSION)
 */
async function ensureColumnExists(connection, tableName, hubspotFieldName, fieldValue, extensionTableName = null) {
  try {
    // Check if column exists in main table
    const [mainColumns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = ? 
       AND COLUMN_NAME = ?`,
      [process.env.DB_NAME, tableName, hubspotFieldName]
    );
    
    if (mainColumns.length > 0) {
      // Column exists in main table - use it
      return { tableName, columnName: hubspotFieldName };
    }
    
    // Check if column exists in extension table
    if (extensionTableName) {
      const [extColumns] = await connection.execute(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = ? 
         AND COLUMN_NAME = ?`,
        [process.env.DB_NAME, extensionTableName, hubspotFieldName]
      );
      
      if (extColumns.length > 0) {
        // Column exists in extension table - use it
        return { tableName: extensionTableName, columnName: hubspotFieldName };
      }
      
      // Column doesn't exist anywhere - CREATE IN EXTENSION TABLE (new strategy)
      const dataType = getMySQLDataType(hubspotFieldName, fieldValue);
      
      try {
        await connection.execute(
          `ALTER TABLE ${extensionTableName} ADD COLUMN \`${hubspotFieldName}\` ${dataType} DEFAULT NULL`
        );
        
        syncLogger.log(`   ✅ NEW field → Extension: ${hubspotFieldName} (${dataType}) in ${extensionTableName}`);
        return { tableName: extensionTableName, columnName: hubspotFieldName };
        
      } catch (error) {
        syncLogger.error(`   ❌ Failed to add new field ${hubspotFieldName} to extension table: ${error.message}`);
        return null;
      }
    } else {
      // No extension table available, fall back to main table
      const dataType = getMySQLDataType(hubspotFieldName, fieldValue);
      
      try {
        await connection.execute(
          `ALTER TABLE ${tableName} ADD COLUMN \`${hubspotFieldName}\` ${dataType} DEFAULT NULL`
        );
        
        syncLogger.log(`   ✅ Added column: ${hubspotFieldName} (${dataType}) to ${tableName}`);
        return { tableName, columnName: hubspotFieldName };
        
      } catch (error) {
        syncLogger.error(`   ❌ Failed to add column ${hubspotFieldName}: ${error.message}`);
        return null;
      }
    }
    
  } catch (error) {
    syncLogger.error(`   ❌ Error checking column ${hubspotFieldName}: ${error.message}`);
    return null;
  }
}

/**
 * Determine MySQL data type based on value - handles ALL value types properly
 */
function getMySQLDataType(fieldName, value) {
  // Analyze the actual value to determine type
  // Note: We now accept ANY value including 0, "", false, etc.
  if (shouldSyncValue(value)) {
    
    // Check if it's a timestamp (HubSpot often uses milliseconds)
    if (typeof value === 'string' && /^\d{13}$/.test(value)) {
      return 'BIGINT';
    }
    
    // Check if it's a date string
    if (typeof value === 'string' && Date.parse(value) && (value.includes('T') || value.includes('-'))) {
      return 'DATETIME';
    }
    
    // Check if it's a boolean
    if (value === 'true' || value === 'false' || typeof value === 'boolean') {
      return 'BOOLEAN';
    }
    
    // Check if it's a number (including zero!)
    if ((typeof value === 'number') || (!isNaN(value) && value !== '')) {
      const numValue = Number(value);
      
      // Handle decimals
      if (numValue % 1 !== 0) {
        return 'DECIMAL(15,6)';
      }
      
      // Handle large integers
      if (numValue > 2147483647 || numValue < -2147483648) {
        return 'BIGINT';
      } else {
        return 'INT';
      }
    }
  }
  
  // DEFAULT TO TEXT FOR ALL STRING FIELDS (avoids row size limits)
  return 'TEXT';
}

/**
 * Transform field values for MySQL storage - handles ALL values including zeros
 */
function transformValue(fieldName, value) {
  // Only return null for truly null/undefined values
  if (!shouldSyncValue(value)) {
    return null;
  }
  
  // Handle HubSpot timestamps
  if (typeof value === 'string' && /^\d{13}$/.test(value)) {
    return parseInt(value);
  }
  
  // Handle date strings
  if (typeof value === 'string' && Date.parse(value) && (value.includes('T') || value.includes('-'))) {
    try {
      return new Date(value);
    } catch (error) {
      return value;
    }
  }
  
  // Handle booleans
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  
  // Handle numbers (including zero!)
  if ((typeof value === 'number') || (!isNaN(value) && value !== '')) {
    return Number(value);
  }
  
  // Return everything else as-is (including empty strings)
  return value;
}

//=============================================================================//
//   TABLE INITIALIZATION FUNCTIONS
//=============================================================================//

async function ensureTableExists(connection, objectType) {
  try {
    const config = TABLE_CONFIGS[objectType];
    if (!config) {
      throw new Error(`Unknown object type: ${objectType}`);
    }
    
    const { tableName, primaryKey, hubspotIdField } = config;
    
    const createSQL = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${primaryKey} INT AUTO_INCREMENT PRIMARY KEY,
        ${hubspotIdField} VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_hubspot_id (${hubspotIdField})
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createSQL);
    syncLogger.log(`✅ ${tableName} table ready`);
    
    return config;
  } catch (error) {
    syncLogger.error(`❌ Failed to initialize table for ${objectType}:` + error.message);
    throw error;
  }
}

//=============================================================================//
//   DYNAMIC PROCESSING WITH COMPREHENSIVE VALUE HANDLING
//=============================================================================//

/**
 * COMPREHENSIVE FIX: Process HubSpot objects with proper handling of ALL values
 * CRITICAL FIX: Now syncs EVERY populated field including zeros, empty strings, false, etc.
 */
async function processHubSpotObject(hubspotObject, connection, objectType) {
  try {
    const config = TABLE_CONFIGS[objectType];
    if (!config) {
      throw new Error(`Unknown object type: ${objectType}`);
    }
    
    const { tableName, extensionTableName, hubspotIdField } = config;

    // Separate data for main table and extension table
    const mainTableData = {};
    const extTableData = {};
    mainTableData[hubspotIdField] = hubspotObject.id;
    extTableData[hubspotIdField] = hubspotObject.id;
    
    let processedFields = 0;
    let zeroValueFields = 0;
    
    // Process ALL properties that have values
    if (hubspotObject.properties) {
      for (const [hubspotFieldName, fieldValue] of Object.entries(hubspotObject.properties)) {
        
        // 🚀 COMPREHENSIVE FIX: Use our shouldSyncValue function
        // This ONLY skips null and undefined - NEVER skips zeros!
        if (!shouldSyncValue(fieldValue)) {
          continue;
        }
        
        // Track zero values for debugging
        if (fieldValue === 0 || fieldValue === "0" || fieldValue === 0.0) {
          zeroValueFields++;
          syncLogger.log(`   🔢 ZERO VALUE DETECTED: ${hubspotFieldName} = ${fieldValue} (will be synced)`);
        }
        
        try {
          // Ensure column exists (may return main table or extension table)
          const columnResult = await ensureColumnExists(connection, tableName, hubspotFieldName, fieldValue, extensionTableName);
          
          if (columnResult) {
            // Transform and store value in appropriate table
            const transformedValue = transformValue(hubspotFieldName, fieldValue);
            
            if (columnResult.tableName === extensionTableName) {
              extTableData[columnResult.columnName] = transformedValue;
            } else {
              mainTableData[columnResult.columnName] = transformedValue;
            }
            processedFields++;
            
            // Enhanced logging for value tracking
            logValueSync(hubspotFieldName, fieldValue, transformedValue, 'SYNC');
          }
        } catch (error) {
          syncLogger.error(`❌ Error processing field ${hubspotFieldName}:` + error.message);
        }
      }
    }
    
    // Save to main table
    await saveTableData(connection, tableName, mainTableData, hubspotIdField);
    
    // Save to extension table if we have extension data
    if (Object.keys(extTableData).length > 1) { // More than just the hubspot_id
      await saveTableData(connection, extensionTableName, extTableData, hubspotIdField);
    }
    
    if (processedFields > 0) {
      let logMessage = `✅ Saved ${objectType} ${hubspotObject.id} (${processedFields} fields`;
      if (zeroValueFields > 0) {
        logMessage += `, ${zeroValueFields} zero values`;
      }
      logMessage += ')';
      syncLogger.log(logMessage);
    }
    
    return true;
  } catch (error) {
    syncLogger.error(`❌ Failed to process ${objectType} ${hubspotObject.id}:` + error.message);
    return false;
  }
}

/**
 * Helper function to save data to a specific table
 */
async function saveTableData(connection, tableName, data, hubspotIdField) {
  if (Object.keys(data).length <= 1) return; // Only hubspot_id, nothing to save
  
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => '?').join(', ');
  const updateClauses = columns
    .filter(col => col !== hubspotIdField)
    .map(col => `\`${col}\` = VALUES(\`${col}\`)`)
    .join(', ');
  
  const query = `
    INSERT INTO ${tableName} (${columns.map(c => `\`${c}\``).join(', ')})
    VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE ${updateClauses}
  `;
  
  await connection.execute(query, values);
}

//=============================================================================//
//   EXPORTED FUNCTIONS
//=============================================================================//

module.exports = {
  ensureTableExists,
  ensureColumnExists,
  processHubSpotObject,
  saveTableData,
  getMySQLDataType,
  transformValue,
  shouldSyncValue, // Export the new utility function
  logValueSync,    // Export the logging function
  TABLE_CONFIGS
};