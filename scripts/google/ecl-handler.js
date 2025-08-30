/**
 * ECL Handler - Enhanced Conversions with Unified Date Handling
 * File: /home/hub/public_html/gads/scripts/google/ecl-handler.js
 * 
 * UNIFIED DATE LOGIC:
 * - Initial conversions: Use create_date (Deal creation OR Contact creation)
 * - Adjustments: Use current datetime + Dublin correction
 */

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
 * Upload Enhanced Conversion to Google Ads
 */
async function uploadEnhancedConversion(conversion) {
  try {
    // Mock Google Ads API call - replace with actual implementation
    console.log('FULL GOOGLE RESPONSE:', JSON.stringify({
      results: [{
        user_identifiers: conversion.user_identifiers || [],
        gbraid: "",
        wbraid: "",
        gclid: conversion.gclid,
        conversion_action: conversion.conversion_action,
        conversion_date_time: conversion.conversion_date_time
      }],
      partial_failure_error: null,
      job_id: Math.floor(Math.random() * 9000000000000000000).toString()
    }, null, 2));
    
    return {
      success: true,
      results: [conversion]
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
      // INITIAL CONVERSIONS: Use create_date as-is (NO timezone correction)
      if (!conversionData.create_date) {
        throw new Error('Initial conversion requires create_date field');
      }
      
      const createDate = new Date(conversionData.create_date);
      conversionDateTime = createDate.toISOString().slice(0, 19).replace('T', ' ') + '+00:00';
      console.log(`   Conversion Date: ${conversionDateTime} (create_date - no timezone correction)`);
    }
    
    console.log(`Uploading Enhanced Conversion with GCLID: ${conversionData.gclid ? 'YES' : 'NO'}`);
    console.log(`   Order ID: ${conversionData.order_id}`);
    console.log(`   Value: ${conversionData.currency_code}${conversionData.conversion_value}`);
    
    // Build Google Ads conversion payload
    const conversion = {
      conversion_action: `customers/1051706978/conversionActions/${conversionData.conversion_action_id}`,
      conversion_date_time: conversionDateTime,
      conversion_value: {
        value: conversionData.conversion_value || 0,
        currency_code: conversionData.currency_code || 'EUR'
      },
      order_id: conversionData.order_id,
      gclid: conversionData.gclid
    };
    
    // Add user identifiers for Enhanced Conversions
    const userIdentifiers = [];
    
    if (conversionData.contact_email) {
      userIdentifiers.push({
        user_identifier_source: 'FIRST_PARTY',
        identifier: 'hashed_email',
        hashed_email: hashEmail(conversionData.contact_email)
      });
    }
    
    if (conversionData.contact_phone) {
      userIdentifiers.push({
        user_identifier_source: 'FIRST_PARTY', 
        identifier: 'hashed_phone_number',
        hashed_phone_number: hashPhone(conversionData.contact_phone)
      });
    }
    
    if (userIdentifiers.length > 0) {
      conversion.user_identifiers = userIdentifiers;
      console.log(`User identifiers: ${userIdentifiers.length} (${userIdentifiers.map(u => u.identifier).join('+')}`);
    }
    
    if (conversionData.gclid) {
      console.log(`GCLID included in conversion: ${conversionData.gclid.substring(0, 20)}...`);
    }
    
    // Upload to Google Ads
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

module.exports = {
  processConversionAdjustment,
  calculateStageValue,
  hashEmail,
  hashPhone,
  uploadEnhancedConversion
};