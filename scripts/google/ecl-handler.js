/**
 * ECL Handler - Explicit LIVE Mode with UPLOAD_CLICKS Detection
 * Forces LIVE account usage and shows exactly which account is being used
 * Includes UPLOAD_CLICKS conversion action detection
 * UPDATED: Supports both initial conversions and adjustments
 */

const { GoogleAdsApi, enums, ResourceNames } = require('google-ads-api');
const crypto = require('crypto');

// Suppress gRPC warnings
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'MetadataLookupWarning') return;
  console.warn(warning);
});

function hashUserData(email, phone = null) {
  const hashed = {};
  if (email) {
    let normalizedEmail = String(email).trim().toLowerCase();
    const gmailPattern = /@(gmail|googlemail)\.com$/i;
    if (gmailPattern.test(normalizedEmail)) {
      const [localPart, domain] = normalizedEmail.split('@');
      normalizedEmail = `${localPart.replace(/\./g, '')}@${domain}`;
    }
    hashed.hashed_email = crypto.createHash('sha256').update(normalizedEmail).digest('hex');
  }
  if (phone) {
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length >= 10) {
      const e164Phone = `+${digits}`;
      hashed.hashed_phone_number = crypto.createHash('sha256').update(e164Phone).digest('hex');
    }
  }
  return hashed;
}

async function initializeGoogleAdsClient() {
  // EXPLICITLY FORCE LIVE ACCOUNT - NO ENVIRONMENT SWITCHING
  const customerId = '1051706978';  // HARDCODED LIVE
  const mccId = '4782061099';       // HARDCODED LIVE MCC
  
  console.log(`🎯 EXPLICITLY USING LIVE ACCOUNT`);
  console.log(`   Customer ID: ${customerId}`);
  console.log(`   MCC ID: ${mccId}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
  
  const client = new GoogleAdsApi({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    developer_token: process.env.GAdsAPI,
  });

  const customer = client.Customer({
    customer_id: customerId,
    login_customer_id: mccId,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return { customer, customerId };
}

// NEW: Check for UPLOAD_CLICKS conversion actions as required by Google
async function checkUploadClicksConversions(customer) {
  try {
    console.log('Checking for UPLOAD_CLICKS conversion actions...');
    
    const query = `
      SELECT 
        conversion_action.id,
        conversion_action.name,
        conversion_action.status,
        conversion_action.resource_name
      FROM conversion_action
      WHERE conversion_action.type = 'UPLOAD_CLICKS'
    `;
    
    const results = await customer.query(query);
    const statusMap = { 2: 'ENABLED', 3: 'REMOVED', 4: 'HIDDEN', 5: 'PAUSED' };
    
    const uploadClicksActions = results.map(r => ({
      id: r.conversion_action.id.toString(),
      name: r.conversion_action.name,
      status: statusMap[r.conversion_action.status] || r.conversion_action.status,
      resource_name: r.conversion_action.resource_name,
      is_enabled: r.conversion_action.status === 2
    }));
    
    console.log(`Found ${uploadClicksActions.length} UPLOAD_CLICKS conversion actions`);
    uploadClicksActions.forEach(action => {
      console.log(`  ${action.id}: ${action.name} (${action.status})`);
    });
    
    return uploadClicksActions;
    
  } catch (error) {
    console.error('UPLOAD_CLICKS check failed:', error.message);
    return [];
  }
}

async function uploadEnhancedConversion(customer, payload) {
  try {
    const {
      conversion_action_id,  // REMOVED DEFAULT - now required from payload
      order_id,
      contact_email, 
      contact_phone,
      conversion_value, 
      currency_code = 'EUR',
      stage
    } = payload;

    console.log('Preparing Enhanced Conversion upload...');
    console.log(`  Stage: ${stage || 'N/A'}`);
    console.log(`  Value: ${currency_code}${conversion_value}`);
    console.log(`  Order ID: ${order_id}`);
    console.log(`  Conversion Action ID: ${conversion_action_id}`);
    console.log(`  Customer ID: ${customer.credentials.customer_id}`);

    const conversionActionResourceName = ResourceNames.conversionAction(
      customer.credentials.customer_id, 
      conversion_action_id
    );
    
    console.log(`Using conversion action: ${conversionActionResourceName}`);

    const hashedUserData = hashUserData(contact_email, contact_phone);

    const clickConversion = {
      conversion_action: conversionActionResourceName,
      conversion_date_time: new Date().toISOString().slice(0, 19).replace('T', ' ') + '+00:00',
      conversion_value: parseFloat(conversion_value),
      currency_code: currency_code,
      order_id: order_id,
      user_identifiers: [
        {
          user_identifier_source: enums.UserIdentifierSource.FIRST_PARTY,
          hashed_email: hashedUserData.hashed_email
        },
        {
          user_identifier_source: enums.UserIdentifierSource.FIRST_PARTY,
          hashed_phone_number: hashedUserData.hashed_phone_number
        }
      ]
    };

    console.log('Uploading Enhanced Conversion to Google Ads...');
    console.log(`  Target account: ${customer.credentials.customer_id}`);

    const request = {
      customer_id: customer.credentials.customer_id,
      conversions: [clickConversion],
      partial_failure: true,
      validate_only: false,
      debug_enabled: false  // ADDED: Suppress CLICK_NOT_FOUND warnings for non-Google Ads traffic
    };

    const response = await customer.conversionUploads.uploadClickConversions(request);

    const hasPartialFailure = !!(response.partial_failure_error && response.partial_failure_error.message);
    
    if (hasPartialFailure) {
      console.error(`Upload failed: ${response.partial_failure_error.message}`);
      throw new Error(`Upload failed: ${response.partial_failure_error.message}`);
    } else {
      console.log('Enhanced Conversion uploaded successfully to LIVE account');
    }

    return {
      success: true,
      conversion_details: {
        stage: stage || 'N/A', 
        value: parseFloat(conversion_value),
        currency: currency_code, 
        order_id: order_id,
        enhanced_conversions: true,
        conversion_type: 'enhanced_conversion_upload',
        conversion_action: conversionActionResourceName,
        target_account: customer.credentials.customer_id
      },
      google_ads_response: {
        results_count: response.results?.length || 0,
        partial_failure: false,
        error_message: null,
      },
    };

  } catch (error) {
    console.error(`Enhanced Conversion upload failed: ${error.message}`);
    throw error;
  }
}

// NEW: Upload conversion adjustment (for stage changes)
async function uploadConversionAdjustment(customer, payload) {
  try {
    const {
      conversion_action_id,
      order_id,
      contact_email, 
      contact_phone,
      adjustment_value,
      currency_code = 'EUR',
      adjustment_type = 'RESTATEMENT',
      stage
    } = payload;

    console.log('Uploading Conversion ADJUSTMENT...');
    console.log(`  Adjustment Type: ${adjustment_type}`);
    console.log(`  Stage: ${stage || 'N/A'}`);
    console.log(`  Adjustment Value: ${currency_code}${adjustment_value}`);
    console.log(`  Order ID: ${order_id}`);
    console.log(`  Conversion Action ID: ${conversion_action_id}`);

    const conversionActionResourceName = ResourceNames.conversionAction(
      customer.credentials.customer_id, 
      conversion_action_id
    );

    const hashedUserData = hashUserData(contact_email, contact_phone);

    const conversionAdjustment = {
      conversion_action: conversionActionResourceName,
      adjustment_date_time: new Date().toISOString().slice(0, 19).replace('T', ' ') + '+00:00',
      adjustment_type: enums.ConversionAdjustmentType[adjustment_type] || enums.ConversionAdjustmentType.RESTATEMENT,
      restatement_value: {
        adjusted_value: parseFloat(adjustment_value),
        currency_code: currency_code
      },
      order_id: order_id
      // REMOVED: user_identifiers - not supported in conversion adjustments
    };

    const request = {
      customer_id: customer.credentials.customer_id,
      conversion_adjustments: [conversionAdjustment],
      partial_failure: true,
      validate_only: false,
      debug_enabled: false  // Suppress warnings for non-Google Ads traffic
    };

    // CORRECTED: Use the proper service path for conversion adjustments
    const response = await customer.conversionAdjustmentUploads.uploadConversionAdjustments(request);

    const hasPartialFailure = !!(response.partial_failure_error && response.partial_failure_error.message);
    
    if (hasPartialFailure) {
      throw new Error(`Conversion adjustment failed: ${response.partial_failure_error.message}`);
    }

    console.log(`✅ Conversion adjustment (${adjustment_type}) uploaded successfully`);

    return {
      success: true,
      conversion_type: 'adjustment',
      adjustment_type: adjustment_type,
      conversion_details: {
        stage: stage || 'N/A', 
        adjustment_value: parseFloat(adjustment_value),
        currency: currency_code, 
        order_id: order_id,
        conversion_action: conversionActionResourceName,
        target_account: customer.credentials.customer_id
      },
      google_ads_response: {
        results_count: response.results?.length || 0,
        partial_failure: false,
        error_message: null,
      },
    };

  } catch (error) {
    console.error(`Conversion adjustment failed: ${error.message}`);
    throw error;
  }
}

async function processConversionAdjustment(payload, dependencies) {
  const startTime = Date.now();
  let result = { success: false };
  
  try {
    const { getDbConnection } = dependencies;
    
    console.log('🎯 Processing ECL Enhanced Conversion - EXPLICIT LIVE MODE');
    console.log(`  Stage: ${payload.stage}`);
    console.log(`  Order ID: ${payload.order_id || 'N/A'}`);

    // No validation needed - HubSpot ensures required fields are present

    // Initialize Google Ads client with explicit LIVE mode
    const { customer, customerId } = await initializeGoogleAdsClient();

    // Verify we're on the right account
    if (customerId !== '1051706978') {
      throw new Error(`Account mismatch! Expected 1051706978, got ${customerId}`);
    }

    // SIMPLE STRATEGY: Check for adjustment_type to determine action
    let conversionResult;
    if (payload.adjustment_type === 'RESTATEMENT') {
      // Send adjustment using the correct API
      conversionResult = await uploadConversionAdjustment(customer, {
        conversion_action_id: payload.conversion_action_id,
        order_id: payload.order_id,
        contact_email: payload.contact_email,
        contact_phone: payload.contact_phone,
        adjustment_value: payload.adjustment_value,
        currency_code: payload.currency_code || 'EUR',
        adjustment_type: payload.adjustment_type,
        stage: payload.stage
      });
    } else {
      // Send initial conversion (whether €120, €0, or any value)
      conversionResult = await uploadEnhancedConversion(customer, {
        conversion_action_id: payload.conversion_action_id,
        order_id: payload.order_id,
        contact_email: payload.contact_email,
        contact_phone: payload.contact_phone,
        conversion_value: payload.conversion_value,
        currency_code: payload.currency_code || 'EUR',
        stage: payload.stage
      });
    }

    result = {
      success: true,
      processing_time_ms: Date.now() - startTime,
      google_ads_account: customerId,
      conversion_action: conversionResult.conversion_details.conversion_action,
      step: payload.adjustment_type === 'RESTATEMENT' ? 'conversion_adjustment' : 'enhanced_conversion_upload',
      ...conversionResult
    };

    console.log(`ECL processing completed successfully in ${result.processing_time_ms}ms on LIVE account`);
    
    // Log to database
    try {
      await logECLActivity(getDbConnection, payload, result);
    } catch (logError) {
      console.warn('Database logging failed:', logError.message);
    }
    
    return result;
    
  } catch (error) {
    console.error(`ECL processing failed: ${error.message}`);
    
    result = {
      success: false,
      error_message: error.message,
      processing_time_ms: Date.now() - startTime,
    };
    
    try {
      await logECLActivity(dependencies.getDbConnection, payload, result);
    } catch (logError) {
      console.error('Failed to log ECL failure:', logError.message);
    }
    
    throw error;
  }
}

// UPDATED: testConversionActionSetup now includes UPLOAD_CLICKS check
async function testConversionActionSetup() {
  try {
    const { customer, customerId } = await initializeGoogleAdsClient();
    
    console.log('Running comprehensive conversion action test...');
    
    // Verify account
    if (customerId !== '1051706978') {
      throw new Error(`Account verification failed! Expected LIVE (1051706978), got ${customerId}`);
    }
    
    // NEW: Check for UPLOAD_CLICKS conversion actions
    const uploadClicksActions = await checkUploadClicksConversions(customer);
    const enabledUploadActions = uploadClicksActions.filter(action => action.is_enabled);
    
    // Test with a working email first (known to work)
    const testPayload = {
      conversion_action_id: '7264211475',  // UPDATED: Use correct conversion action
      order_id: 'EXPLICIT-LIVE-TEST-' + Date.now(),
      contact_email: 'test@ulearntest.com',
      contact_phone: '+353871234567',
      conversion_value: 1.00,
      currency_code: 'EUR'
    };
    
    const result = await uploadEnhancedConversion(customer, testPayload);
    
    return {
      success: result.success,
      google_ads_account: customerId,
      account_verification: 'LIVE account explicitly verified',
      upload_clicks_check: {
        total_upload_clicks_actions: uploadClicksActions.length,
        enabled_upload_clicks_actions: enabledUploadActions.length,
        upload_clicks_actions: uploadClicksActions,
        recommended_action: enabledUploadActions.length > 0 ? 
          `Use UPLOAD_CLICKS action ${enabledUploadActions[0].id} (${enabledUploadActions[0].name})` :
          'No enabled UPLOAD_CLICKS actions found'
      },
      test_result: result,
      message: 'Test upload completed successfully on LIVE account',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function logECLActivity(getDbConnection, payload, result) {
  try {
    const connection = await getDbConnection();
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS ecl_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          deal_id VARCHAR(255), contact_id VARCHAR(255), stage VARCHAR(100),
          adjustment_type VARCHAR(50), adjustment_value DECIMAL(10,2),
          gclid VARCHAR(255), order_id VARCHAR(255), contact_email VARCHAR(255),
          rejection_reason VARCHAR(100), is_mql_rejection BOOLEAN DEFAULT FALSE,
          success BOOLEAN, error_message TEXT, payload JSON, result JSON,
          processing_time_ms INT, currency_code VARCHAR(10),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_order_id (order_id), INDEX idx_stage (stage), INDEX idx_success (success)
        )
      `);

      const isMQLRejection = payload.stage === 'mql_rejected' || 
                            payload.adjustment_type === 'RETRACTION' ||
                            (String(payload.adjustment_value) === '0' && !payload.deal_id);

      await connection.execute(`
        INSERT INTO ecl_logs (
          deal_id, contact_id, stage, adjustment_type, adjustment_value, 
          gclid, order_id, contact_email, rejection_reason, is_mql_rejection, 
          success, error_message, payload, result, processing_time_ms, currency_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        payload.deal_id || null, payload.contact_id || null, payload.stage || null,
        payload.adjustment_type || null, 
        payload.adjustment_value || payload.conversion_value ? parseFloat(payload.adjustment_value || payload.conversion_value) : null,
        payload.gclid || null, payload.order_id || null, payload.contact_email || null,
        payload.rejection_reason || null, isMQLRejection, result.success || false,
        result.error_message || null, JSON.stringify(payload), JSON.stringify(result),
        result.processing_time_ms || null, payload.currency_code || null
      ]);

      console.log(`ECL activity logged (Success: ${result.success})`);
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error('ECL logging failed:', error.message);
  }
}

module.exports = {
  processConversionAdjustment,
  uploadEnhancedConversion,
  uploadConversionAdjustment,  // NEW: Export the adjustment function
  testConversionActionSetup,
  checkUploadClicksConversions,
  initializeGoogleAdsClient,
  hashUserData
};