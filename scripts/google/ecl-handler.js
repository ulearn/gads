/**
 * Enhanced Conversions for Leads (ECL) Handler
 * Processes HubSpot pipeline stage changes and sends conversion adjustments to Google Ads
 * 
 * File: /scripts/google/ecl-handler.js
 */

const { GoogleAdsApi } = require('google-ads-api');
const crypto = require('crypto');

/**
 * Hash email/phone for Enhanced Conversions
 * Google Ads requires SHA256 hashed, normalized data
 */
function hashUserData(email, phone = null) {
  const hashedData = {};
  
  if (email) {
    // Normalize email: lowercase, trim whitespace
    const normalizedEmail = email.toLowerCase().trim();
    hashedData.hashed_email = crypto.createHash('sha256')
      .update(normalizedEmail)
      .digest('hex');
  }
  
  if (phone) {
    // Normalize phone: remove all non-digits, keep country code
    const normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length >= 10) {
      hashedData.hashed_phone_number = crypto.createHash('sha256')
        .update(normalizedPhone)
        .digest('hex');
    }
  }
  
  return hashedData;
}

/**
 * Initialize Google Ads API client
 */
async function initializeGoogleAdsClient(googleOAuth) {
  try {
    // Use test or live account based on environment
    const customerId = process.env.NODE_ENV === 'production' ? 
      process.env.GADS_LIVE_ID : 
      process.env.GADS_TEST_ID;
    
    console.log(`🎯 Using Google Ads Account ID: ${customerId} (${process.env.NODE_ENV || 'development'})`);
    
    const client = new GoogleAdsApi({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      developer_token: process.env.GAdsAPI,
    });

    // Get fresh access token
    const { credentials } = await googleOAuth.refreshAccessToken();
    
    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
    
    return { customer, customerId };
    
  } catch (error) {
    console.error('❌ Failed to initialize Google Ads client:', error);
    throw new Error(`Google Ads API initialization failed: ${error.message}`);
  }
}

/**
 * Get or create conversion action for ECL
 * Returns the conversion action resource name
 */
async function getConversionAction(customer) {
  try {
    // First, try to find existing ECL conversion action
    const query = `
      SELECT 
        conversion_action.id,
        conversion_action.name,
        conversion_action.resource_name,
        conversion_action.status
      FROM conversion_action 
      WHERE conversion_action.name LIKE 'Pipeline%' 
        OR conversion_action.name LIKE 'ECL%'
        OR conversion_action.name LIKE '%Enhanced%'
      ORDER BY conversion_action.id DESC
      LIMIT 5
    `;
    
    const response = await customer.query(query);
    
    if (response.length > 0) {
      const action = response[0].conversion_action;
      console.log(`✅ Found existing conversion action: ${action.name} (${action.resource_name})`);
      return action.resource_name;
    }
    
    // If no existing action found, create one
    console.log('🔧 Creating new ECL conversion action...');
    
    const conversionAction = {
      name: 'Pipeline Progression (ECL)',
      type: 'WEBPAGE',
      category: 'LEAD',
      status: 'ENABLED',
      view_through_lookback_window_days: 30,
      click_through_lookback_window_days: 90,
      counting_type: 'ONE_PER_CLICK',
      attribution_model_settings: {
        attribution_model: 'LAST_CLICK',
        data_driven_model_status: 'OPTED_OUT'
      }
    };
    
    const operation = {
      create: conversionAction
    };
    
    const request = {
      customer_id: customer.credentials.customer_id,
      operations: [operation]
    };
    
    const createResponse = await customer.conversionActions.mutate(request);
    const newResourceName = createResponse.results[0].resource_name;
    
    console.log(`✅ Created new conversion action: ${newResourceName}`);
    return newResourceName;
    
  } catch (error) {
    console.error('❌ Failed to get/create conversion action:', error);
    throw new Error(`Conversion action setup failed: ${error.message}`);
  }
}

/**
 * Send conversion adjustment to Google Ads
 */
async function uploadConversionAdjustment(customer, conversionActionResourceName, payload) {
  try {
    const { 
      gclid, 
      contact_email, 
      contact_phone, 
      adjustment_value, 
      currency_code = 'EUR',
      adjustment_type = 'RESTATEMENT',
      order_id,
      stage
    } = payload;
    
    // Validate required fields
    if (!gclid) {
      throw new Error('GCLID is required for conversion adjustment');
    }
    
    if (!adjustment_value || isNaN(parseFloat(adjustment_value))) {
      throw new Error('Valid adjustment_value is required');
    }
    
    // Hash user data for Enhanced Conversions
    const hashedUserData = hashUserData(contact_email, contact_phone);
    
    // Convert adjustment value to micros (Google Ads uses micros for currency)
    const adjustmentValueMicros = Math.round(parseFloat(adjustment_value) * 1000000);
    
    // Create conversion adjustment
    const conversionAdjustment = {
      conversion_action: conversionActionResourceName,
      gclid_date_time_pair: {
        gclid: gclid,
        conversion_date_time: new Date().toISOString().slice(0, 19).replace('T', ' ')
      },
      adjustment_type: adjustment_type,
      adjustment_date_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
      restatement_value: {
        adjusted_value: adjustmentValueMicros,
        currency_code: currency_code
      }
    };
    
    // Add Enhanced Conversions data if available
    if (Object.keys(hashedUserData).length > 0) {
      conversionAdjustment.user_identifiers = [hashedUserData];
      console.log(`🔐 Enhanced Conversions data included: ${Object.keys(hashedUserData).join(', ')}`);
    }
    
    // Add order ID if available
    if (order_id) {
      conversionAdjustment.order_id = order_id;
    }
    
    const operation = {
      create: conversionAdjustment
    };
    
    const request = {
      customer_id: customer.credentials.customer_id,
      operations: [operation],
      partial_failure: true
    };
    
    console.log('📤 Uploading conversion adjustment to Google Ads...');
    console.log(`   Stage: ${stage}`);
    console.log(`   Value: €${adjustment_value}`);
    console.log(`   GCLID: ${gclid}`);
    console.log(`   Order ID: ${order_id || 'None'}`);
    
    const response = await customer.conversionAdjustments.mutate(request);
    
    if (response.partial_failure_error) {
      console.warn('⚠️ Partial failure in conversion adjustment:', response.partial_failure_error);
    }
    
    console.log('✅ Conversion adjustment uploaded successfully');
    
    return {
      success: true,
      adjustment_details: {
        stage,
        value: adjustment_value,
        currency: currency_code,
        gclid,
        order_id,
        enhanced_conversions: Object.keys(hashedUserData).length > 0,
        adjustment_type
      },
      google_ads_response: {
        results_count: response.results?.length || 0,
        partial_failure: !!response.partial_failure_error
      }
    };
    
  } catch (error) {
    console.error('❌ Failed to upload conversion adjustment:', error);
    throw new Error(`Conversion adjustment upload failed: ${error.message}`);
  }
}

/**
 * Log ECL activity to database for tracking and debugging
 */
async function logECLActivity(getDbConnection, payload, result) {
  try {
    const connection = await getDbConnection();
    
    try {
      // Create ECL log table if it doesn't exist
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS ecl_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          deal_id VARCHAR(255),
          contact_id VARCHAR(255),
          stage VARCHAR(100),
          adjustment_value DECIMAL(10,2),
          gclid VARCHAR(255),
          order_id VARCHAR(255),
          contact_email VARCHAR(255),
          rejection_reason VARCHAR(100),
          is_mql_rejection BOOLEAN DEFAULT FALSE,
          success BOOLEAN,
          error_message TEXT,
          payload JSON,
          result JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_deal_id (deal_id),
          INDEX idx_contact_id (contact_id),
          INDEX idx_gclid (gclid),
          INDEX idx_stage (stage),
          INDEX idx_mql_rejection (is_mql_rejection),
          INDEX idx_created_at (created_at)
        )
      `);
      
      // Detect MQL rejection for logging
      const isMQLRejection = payload.stage === 'mql_rejected' || 
                            (payload.adjustment_value === '0' && !payload.deal_id);
      
      // Insert log entry
      await connection.execute(`
        INSERT INTO ecl_logs (
          deal_id, contact_id, stage, adjustment_value, gclid, order_id, 
          contact_email, rejection_reason, is_mql_rejection, success, error_message, payload, result
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        payload.deal_id || null,
        payload.contact_id || null,
        payload.stage || null,
        parseFloat(payload.adjustment_value) || 0,
        payload.gclid || null,
        payload.order_id || null,
        payload.contact_email || null,
        payload.rejection_reason || null,
        isMQLRejection,
        result.success || false,
        result.error_message || null,
        JSON.stringify(payload),
        JSON.stringify(result)
      ]);
      
      console.log(`📝 ECL activity logged to database (MQL Rejection: ${isMQLRejection})`);
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('⚠️ Failed to log ECL activity:', error.message);
    // Don't throw - logging failure shouldn't break the main process
  }
}

/**
 * Main function: Process conversion adjustment from HubSpot webhook
 */
async function processConversionAdjustment(payload, dependencies) {
  const startTime = Date.now();
  let result = { success: false };
  
  try {
    const { googleOAuth, getDbConnection } = dependencies;
    
    // Detect if this is MQL rejection or deal stage progression
    const isMQLRejection = payload.stage === 'mql_rejected' || 
                          (payload.adjustment_value === '0' && !payload.deal_id);
    
    console.log('🚀 Processing ECL conversion adjustment...');
    console.log(`   Type: ${isMQLRejection ? 'MQL Rejection' : 'Deal Stage Progression'}`);
    console.log(`   Deal: ${payload.deal_id || 'N/A'}`);
    console.log(`   Contact: ${payload.contact_id || 'N/A'}`);
    console.log(`   Stage: ${payload.stage}`);
    console.log(`   Value: €${payload.adjustment_value}`);
    console.log(`   GCLID: ${payload.gclid}`);
    console.log(`   Rejection Reason: ${payload.rejection_reason || 'N/A'}`);
    
    // Validate payload
    if (!payload.gclid) {
      throw new Error('GCLID is required but missing from payload');
    }
    
    if (payload.adjustment_value === undefined || isNaN(parseFloat(payload.adjustment_value))) {
      throw new Error('Valid adjustment_value is required but missing from payload');
    }
    
    // Initialize Google Ads client
    const { customer, customerId } = await initializeGoogleAdsClient(googleOAuth);
    
    // Get conversion action
    const conversionActionResourceName = await getConversionAction(customer);
    
    // Upload conversion adjustment
    const adjustmentResult = await uploadConversionAdjustment(
      customer, 
      conversionActionResourceName, 
      payload
    );
    
    result = {
      success: true,
      processing_time_ms: Date.now() - startTime,
      google_ads_account: customerId,
      conversion_action: conversionActionResourceName,
      is_mql_rejection: isMQLRejection,
      ...adjustmentResult
    };
    
    console.log(`✅ ECL processing completed in ${result.processing_time_ms}ms`);
    
    // Log activity to database
    await logECLActivity(getDbConnection, payload, result);
    
    return result;
    
  } catch (error) {
    console.error('❌ ECL processing failed:', error.message);
    
    result = {
      success: false,
      error_message: error.message,
      processing_time_ms: Date.now() - startTime
    };
    
    // Log failure to database
    await logECLActivity(getDbConnection, payload, result);
    
    throw error;
  }
}

module.exports = {
  processConversionAdjustment,
  hashUserData,
  initializeGoogleAdsClient,
  getConversionAction,
  uploadConversionAdjustment
};