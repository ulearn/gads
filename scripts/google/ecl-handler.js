/**
 * ECL Handler - Complete Version with FIXED Conversion Adjustments
 * CRITICAL FIX: Removed user_identifiers from conversion adjustments - Google Ads API doesn't support them
 */

const { GoogleAdsApi, enums, ResourceNames } = require('google-ads-api');
const crypto = require('crypto');

// Suppress gRPC warnings
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'MetadataLookupWarning') return;
  console.warn(warning);
});

// Enhanced email validation with auto-fix
function validateAndCleanEmail(email) {
  if (!email || typeof email !== 'string') return null;
  
  let cleaned = email.trim().toLowerCase();
  
  // Skip if empty or "null" string
  if (cleaned === '' || cleaned === 'null' || cleaned === 'n/a') return null;
  
  // Common domain fixes
  const domainFixes = {
    'gmail.co': 'gmail.com',
    'gmail.cm': 'gmail.com',
    'gmail.con': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'hotmail.co': 'hotmail.com',
    'hotmail.cm': 'hotmail.com',
    'hotmail.con': 'hotmail.com',
    'yahoo.co': 'yahoo.com',
    'yahoo.cm': 'yahoo.com',
    'outlook.co': 'outlook.com',
    'outlook.cm': 'outlook.com',
    'gmail.': 'gmail.com',
    'hotmail.': 'hotmail.com',
    'yahoo.': 'yahoo.com'
  };
  
  // Apply domain fixes
  for (const [wrong, correct] of Object.entries(domainFixes)) {
    if (cleaned.endsWith(`@${wrong}`)) {
      cleaned = cleaned.replace(`@${wrong}`, `@${correct}`);
      break;
    }
  }
  
  // Remove double dots
  cleaned = cleaned.replace(/\.\.+/g, '.');
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) return null;
  if (cleaned.length > 254) return null;
  
  return cleaned;
}

// Enhanced phone validation with auto-fix
function validateAndCleanPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  
  const original = phone.trim();
  
  // Skip null/empty values
  if (original === '' || original.toLowerCase() === 'null' || original === 'n/a') return null;
  
  // Check for repeated country codes (like +353+353+353)
  const countryCodeRepeats = /(\+\d{1,4})\1+/.test(original);
  if (countryCodeRepeats) {
    const match = original.match(/\+(\d{1,4})/);
    if (match) {
      const countryCode = match[1];
      const cleanNumber = original.replace(/\+\d{1,4}/g, '').replace(/\D/g, '');
      if (cleanNumber.length >= 7) {
        return `+${countryCode}${cleanNumber}`;
      }
    }
  }
  
  // Extract digits only
  const digits = original.replace(/\D/g, '');
  
  // Validate length
  if (digits.length < 10 || digits.length > 15 || /^0+$/.test(digits)) return null;
  
  return `+${digits}`;
}

// Enhanced GCLID validation with debug logging
function validateAndCleanGclid(gclid) {
  if (!gclid || typeof gclid !== 'string') {
    console.log('GCLID validation failed: not a string or empty');
    return null;
  }
  
  const trimmed = gclid.trim();
  
  if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed === 'n/a') {
    console.log('GCLID validation failed: empty or null string');
    return null;
  }
  if (trimmed.length < 10 || trimmed.length > 200) {
    console.log(`GCLID validation failed: length ${trimmed.length} (must be 10-200)`);
    return null;
  }
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) {
    console.log(`GCLID validation failed: regex test failed for "${trimmed}"`);
    return null;
  }
  
  console.log(`GCLID validation passed: "${trimmed}" (length: ${trimmed.length})`);
  return trimmed;
}

// Hash user data with enhanced validation
function hashUserData(email, phone = null) {
  const result = {
    hashed: {},
    validation: {
      email_valid: false,
      phone_valid: false,
      email_cleaned: false,
      phone_cleaned: false
    }
  };
  
  // Process email
  const originalEmail = email;
  const cleanEmail = validateAndCleanEmail(email);
  if (cleanEmail) {
    // Gmail normalization
    let normalizedEmail = cleanEmail;
    const gmailPattern = /@(gmail|googlemail)\.com$/i;
    if (gmailPattern.test(normalizedEmail)) {
      const [localPart, domain] = normalizedEmail.split('@');
      normalizedEmail = `${localPart.replace(/\./g, '')}@${domain}`;
    }
    
    result.hashed.hashed_email = crypto.createHash('sha256').update(normalizedEmail).digest('hex');
    result.validation.email_valid = true;
    result.validation.email_cleaned = cleanEmail !== originalEmail?.trim().toLowerCase();
    result.validation.final_email = normalizedEmail;
  }
  
  // Process phone
  const originalPhone = phone;
  const cleanPhone = validateAndCleanPhone(phone);
  if (cleanPhone) {
    result.hashed.hashed_phone_number = crypto.createHash('sha256').update(cleanPhone).digest('hex');
    result.validation.phone_valid = true;
    result.validation.phone_cleaned = cleanPhone !== originalPhone?.trim();
    result.validation.final_phone = cleanPhone;
  }
  
  return result;
}

// Build user identifiers array (only valid ones)
function buildUserIdentifiers(hashedUserData) {
  const identifiers = [];
  
  if (hashedUserData.hashed.hashed_email) {
    identifiers.push({
      user_identifier_source: enums.UserIdentifierSource.FIRST_PARTY,
      hashed_email: hashedUserData.hashed.hashed_email
    });
  }
  
  if (hashedUserData.hashed.hashed_phone_number) {
    identifiers.push({
      user_identifier_source: enums.UserIdentifierSource.FIRST_PARTY,
      hashed_phone_number: hashedUserData.hashed.hashed_phone_number
    });
  }
  
  return identifiers;
}

async function initializeGoogleAdsClient() {
  // EXPLICITLY FORCE LIVE ACCOUNT - NO ENVIRONMENT SWITCHING
  const customerId = '1051706978';  // HARDCODED LIVE
  const mccId = '4782061099';       // HARDCODED LIVE MCC
  
  console.log(`EXPLICITLY USING LIVE ACCOUNT`);
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

// ENHANCED: uploadEnhancedConversion with detailed API response logging
async function uploadEnhancedConversion(customer, payload) {
  try {
    const {
      conversion_action_id,
      order_id,
      contact_email, 
      contact_phone,
      conversion_value, 
      currency_code = 'EUR',
      stage,
      custom_conversion_date_time
    } = payload;

    console.log('Preparing Enhanced Conversion upload...');
    console.log(`  Stage: ${stage || 'N/A'}`);
    console.log(`  Value: ${currency_code}${conversion_value}`);
    console.log(`  Order ID: ${order_id}`);
    console.log(`  Conversion Action ID: ${conversion_action_id}`);
    console.log(`  Customer ID: ${customer.credentials.customer_id}`);
    
    // Date handling
    let finalConversionDateTime;
    let useCustomDate = false;
    
    if (custom_conversion_date_time) {
      const customDate = new Date(custom_conversion_date_time);
      if (!isNaN(customDate.getTime())) {
        finalConversionDateTime = customDate.toISOString().slice(0, 19).replace('T', ' ') + '+00:00';
        useCustomDate = true;
        console.log(`  Date: HISTORICAL (${finalConversionDateTime})`);
      } else {
        console.log(`  Date: CURRENT (invalid custom date provided: ${custom_conversion_date_time})`);
        finalConversionDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ') + '+00:00';
      }
    } else {
      console.log(`  Date: CURRENT (no custom date provided)`);
      finalConversionDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ') + '+00:00';
    }

    const conversionActionResourceName = ResourceNames.conversionAction(
      customer.credentials.customer_id, 
      conversion_action_id
    );
    
    console.log(`Using conversion action: ${conversionActionResourceName}`);

    // User data processing
    const userData = hashUserData(contact_email, contact_phone);
    const userIdentifiers = buildUserIdentifiers(userData);
    
    if (userIdentifiers.length === 0) {
      throw new Error('No valid user identifiers available (email or phone required)');
    }
    
    console.log(`User identifiers: ${userIdentifiers.length} (${userData.validation.email_valid ? 'email' : ''}${userData.validation.email_valid && userData.validation.phone_valid ? '+' : ''}${userData.validation.phone_valid ? 'phone' : ''})`);

    const clickConversion = {
      conversion_action: conversionActionResourceName,
      conversion_date_time: finalConversionDateTime,
      conversion_value: parseFloat(conversion_value),
      currency_code: currency_code,
      order_id: order_id,
      user_identifiers: userIdentifiers
    };

    // Add GCLID if present (no validation - trust the source)
    if (payload.gclid && payload.gclid.toString().trim() !== '' && payload.gclid.toString().toLowerCase() !== 'null') {
      clickConversion.gclid = payload.gclid.toString().trim();
      console.log(`  GCLID: ${clickConversion.gclid}`);
    } else {
      console.log(`  GCLID: Not provided`);
    }

    console.log('Uploading Enhanced Conversion to Google Ads...');
    console.log(`  Target account: ${customer.credentials.customer_id}`);

    const request = {
      customer_id: customer.credentials.customer_id,
      conversions: [clickConversion],
      partial_failure: true,
      validate_only: false,
      debug_enabled: false
    };

    // CAPTURE FULL API RESPONSE
    const response = await customer.conversionUploads.uploadClickConversions(request);

    // LOG COMPLETE GOOGLE API RESPONSE STRUCTURE
    console.log('=== GOOGLE ADS API RESPONSE ===');
    console.log('Response object keys:', Object.keys(response));
    console.log('Full response:', JSON.stringify(response, null, 2));
    
    // Extract detailed response information
    const apiResponseDetails = {
      results_count: response.results?.length || 0,
      results: response.results || [],
      partial_failure_error: response.partial_failure_error || null,
      response_metadata: response.responseMetadata || null,
      request_id: response.request_id || null,
      raw_response: response
    };

    // Log individual result details if available
    if (response.results && response.results.length > 0) {
      response.results.forEach((result, index) => {
        console.log(`Enhanced Conversion Result ${index}:`, JSON.stringify(result, null, 2));
      });
    }

    const hasPartialFailure = !!(response.partial_failure_error && response.partial_failure_error.message);
    
    if (hasPartialFailure) {
      console.error('=== GOOGLE ADS PARTIAL FAILURE ===');
      console.error('Error message:', response.partial_failure_error.message);
      console.error('Error code:', response.partial_failure_error.code);
      console.error('Error details:', JSON.stringify(response.partial_failure_error.details, null, 2));
      throw new Error(`Upload failed: ${response.partial_failure_error.message}`);
    } else {
      console.log(`Enhanced Conversion uploaded successfully to LIVE account with ${useCustomDate ? 'HISTORICAL' : 'CURRENT'} date`);
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
        target_account: customer.credentials.customer_id,
        user_identifiers_count: userIdentifiers.length,
        data_validation: userData.validation,
        conversion_date_time: finalConversionDateTime,
        used_custom_date: useCustomDate
      },
      // INCLUDE FULL GOOGLE API RESPONSE
      google_ads_response: apiResponseDetails,
    };

  } catch (error) {
    console.error('=== ENHANCED CONVERSION UPLOAD ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Log full error details if it's a Google Ads API error
    if (error.failure && error.failure.errors) {
      console.error('Google Ads API errors:', JSON.stringify(error.failure.errors, null, 2));
    }
    
    throw error;
  }
}

// CRITICAL FIX: uploadConversionAdjustment WITHOUT user identifiers
async function uploadConversionAdjustment(customer, payload) {
  try {
    const {
      conversion_action_id,
      order_id,
      adjustment_value,
      currency_code = 'EUR',
      adjustment_type = 'RESTATEMENT',
      stage,
      custom_adjustment_date_time
    } = payload;

    console.log('Uploading Conversion ADJUSTMENT...');
    console.log(`  Adjustment Type: ${adjustment_type}`);
    console.log(`  Stage: ${stage || 'N/A'}`);
    if (adjustment_type !== 'RETRACTION') {
      console.log(`  Adjustment Value: ${currency_code}${adjustment_value}`);
    }
    console.log(`  Order ID: ${order_id}`);
    console.log(`  Conversion Action ID: ${conversion_action_id}`);
    
    // Handle custom date for adjustments
    let finalAdjustmentDateTime;
    let useCustomDate = false;
    
    if (custom_adjustment_date_time) {
      const customDate = new Date(custom_adjustment_date_time);
      if (!isNaN(customDate.getTime())) {
        finalAdjustmentDateTime = customDate.toISOString().slice(0, 19).replace('T', ' ') + '+00:00';
        useCustomDate = true;
        console.log(`  Date: CUSTOM (${finalAdjustmentDateTime})`);
      } else {
        finalAdjustmentDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ') + '+00:00';
        console.log(`  Date: CURRENT (invalid custom date)`);
      }
    } else {
      finalAdjustmentDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ') + '+00:00';
      console.log(`  Date: CURRENT`);
    }

    const conversionActionResourceName = ResourceNames.conversionAction(
      customer.credentials.customer_id, 
      conversion_action_id
    );

    // CRITICAL FIX: NO USER IDENTIFIERS in conversion adjustments
    // Google Ads API matches adjustments by order_id + conversion_action only
    // Build conversion adjustment with explicit enum reference
    const conversionAdjustment = {
      conversion_action: conversionActionResourceName,
      adjustment_date_time: finalAdjustmentDateTime,
      adjustment_type: adjustment_type === 'RETRACTION' ? 
        enums.ConversionAdjustmentType.RETRACTION : 
        enums.ConversionAdjustmentType.RESTATEMENT,
      order_id: order_id
    };

    // ONLY add restatement_value for RESTATEMENT, NOT for RETRACTION
    if (adjustment_type === 'RESTATEMENT') {
      conversionAdjustment.restatement_value = {
        adjusted_value: parseFloat(adjustment_value),
        currency_code: currency_code
      };
    }

    console.log('Conversion adjustment payload:', JSON.stringify(conversionAdjustment, null, 2));

    const request = {
      customer_id: customer.credentials.customer_id,
      conversion_adjustments: [conversionAdjustment],
      partial_failure: true,
      validate_only: false,
      debug_enabled: false
    };

    // CAPTURE FULL API RESPONSE
    const response = await customer.conversionAdjustmentUploads.uploadConversionAdjustments(request);

    // LOG COMPLETE ADJUSTMENT API RESPONSE
    console.log('=== GOOGLE ADS ADJUSTMENT API RESPONSE ===');
    console.log('Response object keys:', Object.keys(response));
    console.log('Full response:', JSON.stringify(response, null, 2));

    const apiResponseDetails = {
      results_count: response.results?.length || 0,
      results: response.results || [],
      partial_failure_error: response.partial_failure_error || null,
      response_metadata: response.responseMetadata || null,
      request_id: response.request_id || null,
      raw_response: response
    };

    // Log individual result details
    if (response.results && response.results.length > 0) {
      response.results.forEach((result, index) => {
        console.log(`Adjustment Result ${index}:`, JSON.stringify(result, null, 2));
      });
    }

    const hasPartialFailure = !!(response.partial_failure_error && response.partial_failure_error.message);
    
    if (hasPartialFailure) {
      console.error('=== GOOGLE ADS ADJUSTMENT FAILURE ===');
      console.error('Error message:', response.partial_failure_error.message);
      console.error('Error code:', response.partial_failure_error.code);
      console.error('Error details:', JSON.stringify(response.partial_failure_error.details, null, 2));
      
      // Check if this is a CONVERSION_NOT_FOUND error (attribution latency)
      const isConversionNotFound = response.partial_failure_error.message.includes("conversion for this conversion action and conversion identifier can't be found");
      
      if (isConversionNotFound) {
        console.warn('⏳ ATTRIBUTION LATENCY: Original ECL conversion not yet materialized in Google Ads system');
        console.warn('   This is expected behavior for ECL uploads - retry this adjustment in 2-6 hours');
        throw new Error(`CONVERSION_NOT_FOUND - Attribution pending. Retry in 2-6 hours: ${response.partial_failure_error.message}`);
      } else {
        throw new Error(`Conversion adjustment failed: ${response.partial_failure_error.message}`);
      }
    }

    console.log(`Conversion adjustment (${adjustment_type}) uploaded successfully with ${useCustomDate ? 'CUSTOM' : 'CURRENT'} date`);

    return {
      success: true,
      conversion_type: 'adjustment',
      adjustment_type: adjustment_type,
      conversion_details: {
        stage: stage || 'N/A', 
        adjustment_value: adjustment_type === 'RETRACTION' ? 0 : parseFloat(adjustment_value),
        currency: currency_code, 
        order_id: order_id,
        conversion_action: conversionActionResourceName,
        target_account: customer.credentials.customer_id,
        adjustment_date_time: finalAdjustmentDateTime,
        used_custom_date: useCustomDate,
        // Note: No user_identifiers_count for adjustments
        matching_method: 'order_id_and_conversion_action'
      },
      // INCLUDE FULL GOOGLE API RESPONSE
      google_ads_response: apiResponseDetails,
    };

  } catch (error) {
    console.error('=== CONVERSION ADJUSTMENT ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    
    if (error.failure && error.failure.errors) {
      console.error('Google Ads API errors:', JSON.stringify(error.failure.errors, null, 2));
    }
    
    throw error;
  }
}

async function processConversionAdjustment(payload, dependencies) {
  const startTime = Date.now();
  let result = { success: false };
  
  try {
    const { getDbConnection } = dependencies;
    
    console.log('Processing ECL Enhanced Conversion - EXPLICIT LIVE MODE');
    console.log(`  Stage: ${payload.stage}`);
    console.log(`  Order ID: ${payload.order_id || 'N/A'}`);
    
    if (payload.custom_conversion_date_time) {
      console.log(`  Custom Date Received: ${payload.custom_conversion_date_time}`);
    } else {
      console.log(`  Custom Date: NOT PROVIDED`);
    }

    const validation = validateECLPayload(payload);
    
    if (!validation.isValid) {
      throw new Error(`Payload validation failed: ${validation.errors.join(', ')}`);
    }
    
    validation.warnings.forEach(warning => console.warn(`  ${warning}`));
    
    const cleanedPayload = validation.cleanedData;

    const { customer, customerId } = await initializeGoogleAdsClient();

    if (customerId !== '1051706978') {
      throw new Error(`Account mismatch! Expected 1051706978, got ${customerId}`);
    }

    let conversionResult;
    if (cleanedPayload.adjustment_type === 'RESTATEMENT' || cleanedPayload.adjustment_type === 'RETRACTION') {
      // FIXED: No user identifiers for adjustments
      conversionResult = await uploadConversionAdjustment(customer, {
        conversion_action_id: cleanedPayload.conversion_action_id,
        order_id: cleanedPayload.order_id,
        adjustment_value: cleanedPayload.conversion_value,
        currency_code: cleanedPayload.currency_code,
        adjustment_type: cleanedPayload.adjustment_type,
        stage: cleanedPayload.stage,
        custom_adjustment_date_time: payload.custom_adjustment_date_time
      });
    } else {
      // Enhanced conversions still use user identifiers
      conversionResult = await uploadEnhancedConversion(customer, {
        conversion_action_id: cleanedPayload.conversion_action_id,
        order_id: cleanedPayload.order_id,
        contact_email: cleanedPayload.final_email,
        contact_phone: cleanedPayload.final_phone,
        conversion_value: cleanedPayload.conversion_value,
        currency_code: cleanedPayload.currency_code,
        stage: cleanedPayload.stage,
        custom_conversion_date_time: payload.custom_conversion_date_time
      });
    }

    result = {
      success: true,
      processing_time_ms: Date.now() - startTime,
      google_ads_account: customerId,
      conversion_action: conversionResult.conversion_details.conversion_action,
      step: (cleanedPayload.adjustment_type === 'RESTATEMENT' || cleanedPayload.adjustment_type === 'RETRACTION') ? 'conversion_adjustment' : 'enhanced_conversion_upload',
      validation_summary: validation.summary,
      ...conversionResult
    };

    console.log(`ECL processing completed successfully in ${result.processing_time_ms}ms on LIVE account`);
    
  } catch (error) {
    console.error(`ECL processing failed: ${error.message}`);
    
    result = {
      success: false,
      error_message: error.message,
      processing_time_ms: Date.now() - startTime,
      webhook_safe: true
    };
  }
  
  try {
    if (dependencies.getDbConnection) {
      await logECLActivity(dependencies.getDbConnection, payload, result);
    }
  } catch (logError) {
    console.error('Database logging failed:', logError.message);
  }
  
  return result;
}

function validateECLPayload(payload) {
  const validation = {
    isValid: false,
    errors: [],
    warnings: [],
    cleanedData: {},
    summary: {}
  };
  
  if (!payload.conversion_action_id) {
    validation.errors.push('conversion_action_id is required');
  }
  
  if (!payload.order_id || payload.order_id.toString().trim() === '' || 
      payload.order_id.toString().toLowerCase() === 'null') {
    validation.errors.push('order_id is required');
  }
  
  if (!payload.stage) {
    validation.errors.push('stage is required');
  }
  
  const userData = hashUserData(payload.contact_email, payload.contact_phone);
  
  // For adjustments, email validation is less critical since we don't use user identifiers
  const isAdjustment = payload.adjustment_type === 'RESTATEMENT' || payload.adjustment_type === 'RETRACTION';
  
  if (!isAdjustment && !userData.validation.email_valid) {
    validation.errors.push('Valid email is required for Enhanced Conversions');
  }
  
  let conversionValue = null;
  const isRetraction = payload.adjustment_type === 'RETRACTION';
  
  if (!isRetraction) {
    const valueField = payload.adjustment_type === 'RESTATEMENT' ? 'adjustment_value' : 'conversion_value';
    conversionValue = payload[valueField];
    
    if (conversionValue) {
      const numericValue = parseFloat(conversionValue.toString().replace(/[^\d.-]/g, ''));
      if (isNaN(numericValue) || numericValue < 0) {
        validation.errors.push(`Invalid ${valueField}: "${conversionValue}"`);
        conversionValue = null;
      } else {
        conversionValue = numericValue;
      }
    }
    
    if (conversionValue === null || conversionValue === undefined) {
      validation.errors.push(`${valueField} is required`);
    }
  } else {
    conversionValue = 0;
    validation.warnings.push('RETRACTION: conversion value set to 0 (ignored by API)');
  }
  
  validation.cleanedData = {
    conversion_action_id: payload.conversion_action_id,
    order_id: payload.order_id?.toString().trim(),
    stage: payload.stage,
    conversion_value: conversionValue,
    currency_code: payload.currency_code || 'EUR',
    adjustment_type: payload.adjustment_type,
    final_email: userData.validation.final_email,
    final_phone: userData.validation.final_phone,
    gclid: validateAndCleanGclid(payload.gclid),
    deal_id: payload.deal_id || null,
    contact_id: payload.contact_id || null
  };
  
  validation.summary = {
    user_identifier_count: (userData.validation.email_valid ? 1 : 0) + (userData.validation.phone_valid ? 1 : 0),
    has_email: userData.validation.email_valid,
    has_phone: userData.validation.phone_valid,
    has_gclid: !!validation.cleanedData.gclid,
    email_auto_fixed: userData.validation.email_cleaned,
    phone_auto_fixed: userData.validation.phone_cleaned,
    is_retraction: isRetraction,
    is_adjustment: isAdjustment
  };
  
  if (!userData.validation.phone_valid && !isRetraction && !isAdjustment) {
    validation.warnings.push('No valid phone - using email-only Enhanced Conversion');
  }
  
  if (userData.validation.email_cleaned) {
    validation.warnings.push(`Email auto-fixed: "${payload.contact_email}" → "${userData.validation.final_email}"`);
  }
  
  if (userData.validation.phone_cleaned) {
    validation.warnings.push(`Phone auto-fixed: "${payload.contact_phone}" → "${userData.validation.final_phone}"`);
  }
  
  if (!validation.cleanedData.gclid && !isRetraction) {
    validation.warnings.push('No valid GCLID - reduced attribution accuracy');
  }

  if (isAdjustment) {
    validation.warnings.push('ADJUSTMENT: Using order_id matching only (no user identifiers)');
  }
  
  validation.isValid = validation.errors.length === 0;
  
  return validation;
}

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

async function testConversionActionSetup() {
  try {
    const { customer, customerId } = await initializeGoogleAdsClient();
    
    console.log('Running comprehensive conversion action test...');
    
    if (customerId !== '1051706978') {
      throw new Error(`Account verification failed! Expected LIVE (1051706978), got ${customerId}`);
    }
    
    const uploadClicksActions = await checkUploadClicksConversions(customer);
    const enabledUploadActions = uploadClicksActions.filter(action => action.is_enabled);
    
    const testPayload = {
      conversion_action_id: '7264211475',
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
        upload_clicks_actions: uploadClicksActions
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
      // Enhanced table with Google API response fields
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
          rejection_reason VARCHAR(100), 
          is_mql_rejection BOOLEAN DEFAULT FALSE,
          success BOOLEAN, 
          error_message TEXT, 
          payload JSON, 
          result JSON,
          processing_time_ms INT, 
          currency_code VARCHAR(10),
          phone_cleaned BOOLEAN DEFAULT FALSE,
          validation_summary TEXT,
          
          -- Google API Response Fields
          google_results_count INT DEFAULT 0,
          google_partial_failure_error TEXT,
          google_request_id VARCHAR(255),
          google_raw_response JSON,
          
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_order_id (order_id), 
          INDEX idx_stage (stage), 
          INDEX idx_success (success)
        )
      `);

      // Add new columns if they don't exist
      const alterQueries = [
        'ALTER TABLE ecl_logs ADD COLUMN IF NOT EXISTS phone_cleaned BOOLEAN DEFAULT FALSE',
        'ALTER TABLE ecl_logs ADD COLUMN IF NOT EXISTS validation_summary TEXT',
        'ALTER TABLE ecl_logs ADD COLUMN IF NOT EXISTS google_results_count INT DEFAULT 0',
        'ALTER TABLE ecl_logs ADD COLUMN IF NOT EXISTS google_partial_failure_error TEXT',
        'ALTER TABLE ecl_logs ADD COLUMN IF NOT EXISTS google_request_id VARCHAR(255)',
        'ALTER TABLE ecl_logs ADD COLUMN IF NOT EXISTS google_raw_response JSON'
      ];

      for (const query of alterQueries) {
        try {
          await connection.execute(query);
        } catch (e) { /* Column might already exist */ }
      }

      const isMQLRejection = payload.stage === 'mql_rejected' || 
                            payload.adjustment_type === 'RETRACTION' ||
                            (String(payload.adjustment_value || payload.conversion_value) === '0' && !payload.deal_id);

      const adjustmentValue = payload.adjustment_value || payload.conversion_value;
      const numericValue = adjustmentValue ? parseFloat(adjustmentValue.toString().replace(/[^\d.-]/g, '')) : null;

      // Extract Google API response data
      const googleResponse = result.google_ads_response || {};

      await connection.execute(`
        INSERT INTO ecl_logs (
          deal_id, contact_id, stage, adjustment_type, adjustment_value, 
          gclid, order_id, contact_email, rejection_reason, is_mql_rejection, 
          success, error_message, payload, result, processing_time_ms, currency_code,
          phone_cleaned, validation_summary,
          google_results_count, google_partial_failure_error, 
          google_request_id, google_raw_response
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        payload.deal_id || null, 
        payload.contact_id || null, 
        payload.stage || null,
        payload.adjustment_type || null, 
        numericValue,
        payload.gclid || null, 
        payload.order_id || null, 
        payload.contact_email || null,
        payload.rejection_reason || null, 
        isMQLRejection, 
        result.success || false,
        result.error_message || null, 
        JSON.stringify(payload), 
        JSON.stringify(result),
        result.processing_time_ms || null, 
        payload.currency_code || null,
        result.validation_summary?.phone_auto_fixed || false,
        JSON.stringify(result.validation_summary || {}),
        googleResponse.results_count || 0,
        googleResponse.partial_failure_error ? JSON.stringify(googleResponse.partial_failure_error) : null,
        googleResponse.request_id || null,
        JSON.stringify(googleResponse.raw_response || {})
      ]);

      console.log(`ECL activity logged successfully with Google API response data (Success: ${result.success})`);
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
  uploadConversionAdjustment,
  testConversionActionSetup,
  checkUploadClicksConversions,
  initializeGoogleAdsClient,
  hashUserData,
  validateAndCleanEmail,
  validateAndCleanPhone,
  validateAndCleanGclid,
  validateECLPayload,
  buildUserIdentifiers
};