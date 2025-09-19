/**
 * ECL Handler - Enhanced Conversions with Unified Date Handling - FIXED VERSION
 * File: /home/hub/public_html/gads/scripts/google/ecl-handler.js
 * 
 * UNIFIED DATE LOGIC:
 * - Initial conversions: Parse UK/ISO format + server timezone compensation
 * - Adjustments: Use current datetime (no buffer - HubSpot workflow has 1-minute delay)
 * 
 * FIXES:
 * - Handles UK date format: "13/09/2025 13:13 IST"
 * - Handles ISO date format: "2025-09-13T12:13:00.000Z"
 * - Compensates for server being 1 hour behind Dublin
 * - Prevents "conversion sent before click" errors
 * - CRITICAL FIX: Adjustments use current time (not future time)
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
 * Parse UK date format from HubSpot - SIMPLE VERSION RESTORED
 */
function parseAndAdjustCreateDate(dateValue) {
  if (!dateValue) return null;
  
  console.log(`🔧 Processing date: "${dateValue}"`);
  
  let baseDate;
  
  // Handle UK format from HubSpot: "13/09/2025 13:13 IST"
  if (dateValue.includes('/')) {
    const parts = dateValue.trim().split(' ');
    const datePart = parts[0]; // "13/09/2025"
    const timePart = parts[1]; // "13:13" or undefined
    
    console.log(`   📅 Date parts: ${JSON.stringify(parts)}`);
    
    // Parse date components
    const [day, month, year] = datePart.split('/');
    console.log(`   🗓️  Parsed: day=${day}, month=${month}, year=${year}`);
    
    // Handle time - default to noon if missing
    let timeString = '12:00:00';
    if (timePart && timePart.includes(':')) {
      timeString = timePart.split(':').length === 2 ? `${timePart}:00` : timePart;
    }
    console.log(`   ⏰ Time: ${timeString}`);
    
    // Parse time components
    const timeParts = timeString.split(':');
    const hours = parseInt(timeParts[0]) || 0;
    const minutes = parseInt(timeParts[1]) || 0;
    const seconds = parseInt(timeParts[2]) || 0;
    
    // Create Date object using components
    // JavaScript Date expects (year, month-1, day, hour, minute, second)
    const parsedYear = parseInt(year);
    const parsedMonth = parseInt(month) - 1; // JavaScript months are 0-based
    const parsedDay = parseInt(day);
    
    baseDate = new Date(parsedYear, parsedMonth, parsedDay, hours, minutes, seconds);
    
    console.log(`   ✅ Created date: ${baseDate.toISOString()}`);
    
  } else {
    // Already ISO format
    baseDate = new Date(dateValue);
    console.log(`   ✅ Using ISO format: ${baseDate.toISOString()}`);
  }
  
  // Final validation
  if (isNaN(baseDate.getTime())) {
    console.error(`❌ Invalid date: ${dateValue}`);
    throw new Error(`Invalid date format: ${dateValue}`);
  }
  
  return baseDate;
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
 * Process conversion with unified date handling - MAIN ENTRY POINT
 * FIXED: Adjustments use current time (no buffer - HubSpot has 1-minute workflow delay)
 */
async function processConversionAdjustment(conversionData, options = {}) {
  try {
    console.log(`Processing ECL: ${conversionData.stage?.toUpperCase().includes('ADJUSTMENT') ? 'STAGE ADJUSTMENT' : 'INITIAL CONVERSION'}`);
    console.log(`   Stage: ${conversionData.stage}`);
    console.log(`   Order ID: ${conversionData.order_id}`);
    console.log(`   GCLID Present: ${conversionData.gclid ? 'YES' : 'NO'}`);
    
    // UNIFIED DATE HANDLING - FIXED FOR ADJUSTMENTS
    let conversionDateTime;
    
    if (conversionData.adjustment_type === 'RESTATEMENT') {
      // ADJUSTMENTS: Use current time (no buffer needed - HubSpot workflow already has 1-minute delay)
      const now = new Date();
      conversionDateTime = now.toISOString().slice(0, 19).replace('T', ' ') + '+00:00';
      console.log(`   Conversion Date: ${conversionDateTime} (current time for adjustment - HubSpot has 1min delay)`);
      
    } else {
      // INITIAL CONVERSIONS: Parse HubSpot date + server timezone compensation
      if (!conversionData.create_date) {
        throw new Error('Initial conversion requires create_date field');
      }
      
      // Parse the date (handles both UK and ISO formats)
      const createDate = parseAndAdjustCreateDate(conversionData.create_date);
      
      // Check if this is a chat conversion (Bird.com) or HubSpot conversion
      const isChatConversion = conversionData.channel === "chat";
      
      if (isChatConversion) {
        // Chat conversions (Bird.com) are already in UTC - no adjustment needed
        console.log(`   📱 Chat conversion detected - no time adjustment needed`);
      } else {
        // HubSpot conversions need +1 hour (server is 1 hour behind Dublin IST)
        createDate.setHours(createDate.getHours() + 1);
        console.log(`   🔄 HubSpot conversion - adding 1hr for IST→UTC adjustment`);
      }
      
      conversionDateTime = createDate.toISOString().slice(0, 19).replace('T', ' ') + '+00:00';
      console.log(`   Conversion Date: ${conversionDateTime}${isChatConversion ? ' (chat - no adjustment)' : ' (HubSpot + 1hr)'}`);
    }
    
    // Parse the conversion value FIRST (handle Euro symbol and commas)
    let parsedValue = 0;
    if (conversionData.adjustment_value) {
      // Handle adjustment_value field (e.g., "€1,367.77")
      parsedValue = parseFloat(conversionData.adjustment_value.replace(/[€,]/g, ''));
    } else if (conversionData.conversion_value) {
      // Handle conversion_value field (can also have Euro symbol)
      const valueStr = String(conversionData.conversion_value);
      parsedValue = parseFloat(valueStr.replace(/[€,]/g, ''));
    }
    
    // Validate parsed value
    if (isNaN(parsedValue)) {
      console.log(`⚠️  Value parsing failed: adjustment_value="${conversionData.adjustment_value}", conversion_value="${conversionData.conversion_value}"`);
      parsedValue = 0;
    }
    
    console.log(`Uploading Enhanced Conversion with GCLID: ${conversionData.gclid ? 'YES' : 'NO'}`);
    console.log(`   Order ID: ${conversionData.order_id}`);
    console.log(`   Value: ${conversionData.currency_code || 'EUR'}${parsedValue.toFixed(2)}`);
    
    // Build Google Ads conversion payload
    const conversion = {
      conversion_action_id: conversionData.conversion_action_id,
      conversion_date_time: conversionDateTime,
      conversion_value: parsedValue,
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

/**
 * Test live connection with safe date handling
 */
async function testLiveConnection() {
  try {
    console.log('🔍 Testing ECL live connection with safe date...');
    
    const testData = {
      conversion_action_id: '7264211475',
      stage: 'TEST',
      order_id: `TEST-${Date.now()}`,
      gclid: 'TEST-GCLID-' + Math.random().toString(36).substring(7),
      contact_email: 'test@ulearntest.com',
      contact_phone: '',
      currency_code: 'EUR',
      adjustment_type: 'RESTATEMENT', // This will trigger the safe date logic
      conversion_value: 10.00
    };
    
    const result = await processConversionAdjustment(testData);
    
    return {
      success: true,
      message: 'ECL live connection test successful',
      result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

module.exports = {
  processConversionAdjustment,
  calculateStageValue,
  hashEmail,
  hashPhone,
  uploadEnhancedConversion,
  testConversionActionSetup,
  testLiveConnection
};