/**
 * MINIMAL ECL Handler - GCLID FIXED
 * Path: /home/hub/public_html/gads/scripts/google/ecl-handler.js
 * 
 * SIMPLIFIED: Does exactly what it needs to do, nothing more
 * FIXED: Properly includes GCLID in Google Ads API requests
 */

const { GoogleAdsApi, enums, ResourceNames } = require('google-ads-api');
const crypto = require('crypto');

function hashEmail(email) {
  if (!email) return null;
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function hashPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return crypto.createHash('sha256').update(`+${digits}`).digest('hex');
}

async function initializeGoogleAdsClient() {
  const client = new GoogleAdsApi({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    developer_token: process.env.GAdsAPI,
  });

  return client.Customer({
    customer_id: '1051706978',  // LIVE ACCOUNT
    login_customer_id: '4782061099',  // LIVE MCC
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
}

async function uploadEnhancedConversion(customer, payload) {
  const {
    conversion_action_id,
    order_id,
    gclid,  // CRITICAL: Include GCLID
    contact_email,
    contact_phone,
    conversion_value,
    currency_code = 'EUR'
  } = payload;

  console.log(`📤 Uploading Enhanced Conversion with GCLID: ${gclid ? 'YES' : 'NO'}`);
  console.log(`   Order ID: ${order_id}`);
  console.log(`   Value: ${currency_code}${conversion_value}`);

  const conversionActionResourceName = ResourceNames.conversionAction(
    customer.credentials.customer_id,
    conversion_action_id
  );

  // Build the conversion object
  // Build user identifiers array, filtering out null values
  const userIdentifiers = [];
  
  const hashedEmail = hashEmail(contact_email);
  const hashedPhone = hashPhone(contact_phone);
  
  if (hashedEmail) {
    userIdentifiers.push({
      user_identifier_source: enums.UserIdentifierSource.FIRST_PARTY,
      hashed_email: hashedEmail
    });
  }
  
  if (hashedPhone) {
    userIdentifiers.push({
      user_identifier_source: enums.UserIdentifierSource.FIRST_PARTY,
      hashed_phone_number: hashedPhone
    });
  }

  console.log(`👥 User identifiers: ${userIdentifiers.length} (${hashedEmail ? 'email' : ''}${hashedEmail && hashedPhone ? '+' : ''}${hashedPhone ? 'phone' : ''})`);

  // Handle date logic based on conversion type
  let conversionDateTime;
  
  // Adjustments ALWAYS use current time, regardless of date fields present
  if (payload.adjustment_type === 'RESTATEMENT') {
    const currentTime = new Date();
    currentTime.setHours(currentTime.getHours() + 1); // Add 1 hour for Dublin timezone
    conversionDateTime = currentTime.toISOString().slice(0, 19).replace('T', ' ') + '+00:00';
    console.log(`📅 Conversion Date: ${conversionDateTime} (CURRENT + Dublin TZ correction for ADJUSTMENT)`);
  }
  // Initial conversions REQUIRE a create date - FAIL if missing
  else {
    const dateField = payload.deal_create_date || payload.custom_conversion_date_time;
    
    if (!dateField) {
      throw new Error('Initial conversion requires deal_create_date or custom_conversion_date_time');
    }

    try {
      // Convert the historical date to Dublin timezone (+1 hour from server time)
      const dealDate = new Date(dateField);
      if (isNaN(dealDate.getTime())) {
        throw new Error(`Invalid date format: ${dateField}`);
      }
      
      dealDate.setHours(dealDate.getHours() + 1); // Add 1 hour for Dublin timezone
      conversionDateTime = dealDate.toISOString().slice(0, 19).replace('T', ' ') + '+00:00';
      console.log(`📅 Conversion Date: ${conversionDateTime} (HISTORICAL + Dublin TZ correction)`);
      
    } catch (error) {
      throw new Error(`Date processing failed: ${error.message}`);
    }
  }
  const clickConversion = {
    conversion_action: conversionActionResourceName,
    conversion_date_time: conversionDateTime,
    conversion_value: parseFloat(conversion_value),
    currency_code: currency_code,
    order_id: order_id,
    user_identifiers: userIdentifiers
  };

  // CRITICAL FIX: Add GCLID if provided
  if (gclid) {
    clickConversion.gclid = gclid;
    console.log(`✅ GCLID included in conversion: ${gclid.substring(0, 20)}...`);
  } else {
    console.log(`⚠️  No GCLID provided - using Enhanced Conversions for Leads only`);
  }

  const request = {
    customer_id: customer.credentials.customer_id,
    conversions: [clickConversion],
    partial_failure: true,
    validate_only: false
  };

  const response = await customer.conversionUploads.uploadClickConversions(request);

  console.log('FULL GOOGLE RESPONSE:', JSON.stringify(response, null, 2));

  if (response.partial_failure_error?.message) {
    throw new Error(`Upload failed: ${response.partial_failure_error.message}`);
  }

  console.log(`✅ Enhanced Conversion uploaded successfully`);
  console.log(`   Results count: ${response.results?.length || 0}`);

  return {
    success: true,
    conversion_details: {
      value: parseFloat(conversion_value),
      currency: currency_code,
      order_id: order_id,
      gclid_included: !!gclid,
      conversion_action: conversionActionResourceName
    },
    google_ads_response: {
      results_count: response.results?.length || 0,
      partial_failure: false
    }
  };
}

async function uploadConversionAdjustment(customer, payload) {
  const {
    conversion_action_id,
    order_id,
    adjustment_value,
    currency_code = 'EUR',
    adjustment_type = 'RESTATEMENT'
  } = payload;

  console.log(`📤 Uploading Conversion Adjustment: ${adjustment_type}`);
  console.log(`   Order ID: ${order_id}`);
  console.log(`   New Value: ${currency_code}${adjustment_value}`);

  const conversionActionResourceName = ResourceNames.conversionAction(
    customer.credentials.customer_id,
    conversion_action_id
  );

  const conversionAdjustment = {
    conversion_action: conversionActionResourceName,
    adjustment_date_time: new Date().toISOString().slice(0, 19).replace('T', ' ') + '+00:00',
    adjustment_type: enums.ConversionAdjustmentType[adjustment_type],
    restatement_value: {
      adjusted_value: parseFloat(adjustment_value),
      currency_code: currency_code
    },
    order_id: order_id
    // NOTE: No user_identifiers in adjustments!
  };

  const request = {
    customer_id: customer.credentials.customer_id,
    conversion_adjustments: [conversionAdjustment],
    partial_failure: true,
    validate_only: false
  };

  const response = await customer.conversionAdjustmentUploads.uploadConversionAdjustments(request);
  
  console.log('FULL GOOGLE RESPONSE:', JSON.stringify(response, null, 2));

  if (response.partial_failure_error?.message) {
    throw new Error(`Adjustment failed: ${response.partial_failure_error.message}`);
  }

  console.log(`✅ Conversion adjustment uploaded successfully`);

  return {
    success: true,
    adjustment_type: adjustment_type,
    conversion_details: {
      adjustment_value: parseFloat(adjustment_value),
      currency: currency_code,
      order_id: order_id,
      conversion_action: conversionActionResourceName
    }
  };
}

async function processConversionAdjustment(payload, dependencies) {
  const startTime = Date.now();
  
  try {
    console.log(`🎯 Processing ECL: ${payload.adjustment_type === 'RESTATEMENT' ? 'ADJUSTMENT' : 'INITIAL CONVERSION'}`);
    console.log(`   Stage: ${payload.stage}`);
    console.log(`   Order ID: ${payload.order_id}`);
    console.log(`   GCLID Present: ${payload.gclid ? 'YES' : 'NO'}`);

    const customer = await initializeGoogleAdsClient();

    let result;
    if (payload.adjustment_type === 'RESTATEMENT') {
      // This is an adjustment
      result = await uploadConversionAdjustment(customer, payload);
    } else {
      // This is an initial conversion
      result = await uploadEnhancedConversion(customer, payload);
    }

    const finalResult = {
      success: true,
      processing_time_ms: Date.now() - startTime,
      google_ads_account: '1051706978',
      step: payload.adjustment_type === 'RESTATEMENT' ? 'conversion_adjustment' : 'enhanced_conversion_upload',
      ...result
    };

    console.log(`✅ ECL completed in ${finalResult.processing_time_ms}ms`);

    // Log to database
    try {
      await logECLActivity(dependencies.getDbConnection, payload, finalResult);
    } catch (logError) {
      console.warn(`Database logging failed: ${logError.message}`);
    }

    return finalResult;

  } catch (error) {
    console.error(`❌ ECL failed: ${error.message}`);
    
    const errorResult = {
      success: false,
      error_message: error.message,
      processing_time_ms: Date.now() - startTime
    };

    try {
      await logECLActivity(dependencies.getDbConnection, payload, errorResult);
    } catch (logError) {
      console.error(`Database logging failed: ${logError.message}`);
    }

    throw error;
  }
}

async function logECLActivity(getDbConnection, payload, result) {
  try {
    const connection = await getDbConnection();
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS ecl_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          deal_id VARCHAR(255),
          contact_id VARCHAR(255),
          stage VARCHAR(100),
          adjustment_type VARCHAR(50),
          adjustment_value DECIMAL(10,2),
          gclid VARCHAR(255),
          order_id VARCHAR(255),
          contact_email VARCHAR(255),
          success BOOLEAN,
          error_message TEXT,
          payload JSON,
          result JSON,
          processing_time_ms INT,
          currency_code VARCHAR(10),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_order_id (order_id),
          INDEX idx_success (success)
        )
      `);

      await connection.execute(`
        INSERT INTO ecl_logs (
          deal_id, contact_id, stage, adjustment_type, adjustment_value,
          gclid, order_id, contact_email, success, error_message,
          payload, result, processing_time_ms, currency_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        payload.deal_id || null,
        payload.contact_id || null,
        payload.stage || null,
        payload.adjustment_type || null,
        payload.adjustment_value || payload.conversion_value ? parseFloat(payload.adjustment_value || payload.conversion_value) : null,
        payload.gclid || null,
        payload.order_id || null,
        payload.contact_email || null,
        result.success || false,
        result.error_message || null,
        JSON.stringify(payload),
        JSON.stringify(result),
        result.processing_time_ms || null,
        payload.currency_code || null
      ]);

    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error(`ECL logging failed: ${error.message}`);
  }
}

async function testConversionActionSetup() {
  try {
    const customer = await initializeGoogleAdsClient();
    
    const testPayload = {
      conversion_action_id: '7264211475',
      order_id: 'MINIMAL-TEST-' + Date.now(),
      gclid: 'EAIaIQobChMI4r2O4p6Z8gIVgYBQBh2mVQFzEAAYASAAEgJdwPD_BwE',
      contact_email: 'test@ulearntest.com',
      contact_phone: '+353871234567',
      conversion_value: 120.00,
      currency_code: 'EUR'
    };
    
    const result = await uploadEnhancedConversion(customer, testPayload);
    
    return {
      success: true,
      message: 'MINIMAL ECL handler test completed with GCLID',
      gclid_test: 'PASSED',
      result: result
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  processConversionAdjustment,
  uploadEnhancedConversion,
  uploadConversionAdjustment,
  testConversionActionSetup,
  initializeGoogleAdsClient
};