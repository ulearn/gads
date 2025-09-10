/**
 * ECL Handler - Enhanced Conversions with Unified Date Handling
 * File: /home/hub/public_html/gads/scripts/google/ecl-handler.js
 * 
 * UNIFIED DATE LOGIC:
 * - Initial conversions: Use create_date (Deal creation OR Contact creation)
 * - Adjustments: Use current datetime + Dublin correction
 * 
 * FIXED: Removed mock data, uses real Google Ads API
 */

const { GoogleAdsApi, enums, ResourceNames } = require('google-ads-api');
const crypto = require('crypto');

/**
 * Hash email for Enhanced Conversions
 */
function hashEmail(email) {
  if (!email) return null;
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

/**
 * Hash phone number for Enhanced Conversions
 */
function hashPhone(phone) {
  if (!phone) return null;
  // Remove all non-digit characters and ensure E.164 format
  const cleanPhone = phone.replace(/\D/g, '');
  return crypto.createHash('sha256').update(cleanPhone).digest('hex');
}

/**
 * Initialize Google Ads client
 */
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

/**
 * Upload Enhanced Conversion to Google Ads - REAL API CALL
 */
async function uploadEnhancedConversion(conversion) {
  try {
    const customer = await initializeGoogleAdsClient();
    
    const conversionActionResourceName = ResourceNames.conversionAction(
      customer.credentials.customer_id,
      conversion.conversion_action_id
    );

    // Build user identifiers array, filtering out null values
    const userIdentifiers = [];
    
    const hashedEmail = hashEmail(conversion.contact_email);
    const hashedPhone = hashPhone(conversion.contact_phone);
    
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

    // Build the conversion object
    const clickConversion = {
      conversion_action: conversionActionResourceName,
      conversion_date_time: conversion.conversion_date_time,
      conversion_value: parseFloat(conversion.conversion_value || 0),
      currency_code: conversion.currency_code || 'EUR',
      order_id: conversion.order_id,
      user_identifiers: userIdentifiers
    };

    // Add GCLID if provided
    if (conversion.gclid) {
      clickConversion.gclid = conversion.gclid;
      console.log(`✅ GCLID included in conversion: ${conversion.gclid.substring(0, 20)}...`);
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
      results: response.results || []
    };
  } catch (error) {
    console.error('Google Ads upload failed:', error);
    throw error;
  }
}

/**
 * Process conversion with unified date handling
 */
async function processConversionAdjustment(conversionData, options = {}) {
  try {
    console.log(`Processing ECL: ${conversionData.stage?.toUpperCase().includes('ADJUSTMENT') ? 'STAGE ADJUSTMENT' : 'INITIAL CONVERSION'}`);
    console.log(`   Stage: ${conversionData.stage}`);
    console.log(`   Order ID: ${conversionData.order_id}`);
    console.log(`   GCLID Present: ${conversionData.gclid ? 'YES' : 'NO'}`);
    
    // UNIFIED DATE HANDLING
    let conversionDateTime;
    
    if (conversionData.adjustment_type === 'RESTATEMENT') {
      // ADJUSTMENTS: Use current time + Dublin correction
      const now = new Date();
      const dublinOffset = 1; // Dublin UTC+1
      now.setHours(now.getHours() + dublinOffset);
      conversionDateTime = now.toISOString().slice(0, 19).replace('T', ' ') + '+00:00';
      console.log(`   Conversion Date: ${conversionDateTime} (CURRENT + Dublin TZ correction)`);
      
    } else {
  // INITIAL CONVERSIONS: Use create_date WITH safety buffer to prevent click precedence error
  if (!conversionData.create_date) {
    throw new Error('Initial conversion requires create_date field');
  }
  
  const createDate = new Date(conversionData.create_date);
  if (isNaN(createDate.getTime())) {
    throw new Error(`Invalid date format: ${conversionData.create_date}`);
  }
  
  // ADD SAFETY BUFFER: Add 2 hours to ensure conversion is always after click
  createDate.setHours(createDate.getHours() + 2);
  
  conversionDateTime = createDate.toISOString().slice(0, 19).replace('T', ' ') + '+00:00';
  console.log(`   Conversion Date: ${conversionDateTime} (create_date + 2hr safety buffer)`);
}
    
    console.log(`Uploading Enhanced Conversion with GCLID: ${conversionData.gclid ? 'YES' : 'NO'}`);
    console.log(`   Order ID: ${conversionData.order_id}`);
    console.log(`   Value: ${conversionData.currency_code}${conversionData.conversion_value}`);
    
    // Build Google Ads conversion payload
    const conversion = {
      conversion_action_id: conversionData.conversion_action_id,
      conversion_date_time: conversionDateTime,
      conversion_value: conversionData.conversion_value || 0,
      currency_code: conversionData.currency_code || 'EUR',
      order_id: conversionData.order_id,
      gclid: conversionData.gclid,
      contact_email: conversionData.contact_email,
      contact_phone: conversionData.contact_phone
    };
    
    // Upload to Google Ads (REAL API CALL)
    const result = await uploadEnhancedConversion(conversion);
    
    console.log(`Enhanced Conversion uploaded successfully`);
    console.log(`   Results count: ${result.results?.length || 0}`);
    
    return {
      success: true,
      conversionDateTime: conversionDateTime,
      orderId: conversion.order_id,
      value: conversionData.conversion_value,
      result: result
    };
    
  } catch (error) {
    console.error(`ECL failed: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate stage-based conversion value
 */
function calculateStageValue(dealAmount, dealStage) {
  const stageProbabilities = {
    'qualifiedtobuy': 0.06,    // INBOX - 6%
    'sequenced': 0.09,         // SEQUENCED - 9%
    'engaging': 0.10,          // ENGAGING - 10%
    'responsive': 0.27,        // RESPONSIVE - 27%
    'advising': 0.50,          // ADVISING - 50%
    'consideration': 0.80,     // NEGOTIATION - 80%
    'trial': 0.90,             // TRIAL - 90%
    'contractsent': 0.85,      // CONTRACT - 85%
    'closedwon': 1.00,         // WON - 100%
    'closedlost': 0.00,        // LOST - 0%
    'mql_rejected': 0.00
  };
  
  const amount = parseFloat(dealAmount) || 1000; // Default €1000 if no amount
  const probability = stageProbabilities[dealStage] || 0.06; // Default to INBOX probability
  
  return Math.round(amount * probability * 100) / 100;
}

/**
 * Test conversion action setup
 */
async function testConversionActionSetup() {
  try {
    const customer = await initializeGoogleAdsClient();
    
    const testPayload = {
      conversion_action_id: '7264211475',
      order_id: 'TEST-' + Date.now(),
      gclid: 'EAIaIQobChMI4r2O4p6Z8gIVgYBQBh2mVQFzEAAYASAAEgJdwPD_BwE',
      contact_email: 'test@ulearntest.com',
      contact_phone: '+353871234567',
      conversion_value: 120.00,
      currency_code: 'EUR'
    };
    
    const result = await uploadEnhancedConversion(testPayload);
    
    return {
      success: true,
      message: 'ECL handler test completed',
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
  calculateStageValue,
  hashEmail,
  hashPhone,
  uploadEnhancedConversion,
  testConversionActionSetup
};