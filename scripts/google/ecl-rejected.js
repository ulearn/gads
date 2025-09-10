/**
 * ECL Rejected Contacts Handler
 * Business Logic for processing rejected MQL contacts (Unsupported Territory)
 * 
 * File: /home/hub/public_html/gads/scripts/google/ecl-rejected.js
 * Purpose: Send €0 ECL conversions to counteract initial conversion values for rejected leads
 * 
 * UNIFIED DATE HANDLING: Uses create_date field for consistency with ECL handler
 */

async function getRejectedContacts(hubspotClient) {
  try {
    console.log('Fetching rejected MQL contacts (Unsupported Territory)...');
    
    // Date range: 17/08/2025 to 27/08/2025 (create_date filter) - SAME AS BASELINE
    const startDate = new Date('2025-08-30T00:00:00.000Z');
    const endDate = new Date('2024-09-09T23:59:59.999Z');
    
    console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // HubSpot API search for rejected contacts
    console.log('Building search request with simplified filters...');
    
    const searchRequest = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'createdate',
              operator: 'BETWEEN',
              value: startDate.getTime().toString(),
              highValue: endDate.getTime().toString()
            },
            {
              propertyName: 'territory',
              operator: 'EQ',
              value: 'Unsupported Territory'
            },
            {
              propertyName: 'hs_analytics_source',
              operator: 'EQ',
              value: 'PAID_SEARCH'
            }
          ]
        }
      ],
      properties: [
        'hs_object_id',
        'lead_id', 
        'email',
        'phone',
        'firstname',
        'lastname',
        'hs_google_click_id',
        'gclid',
        'hs_analytics_source',
        'hs_analytics_latest_source',
        'hubspot_owner_id',
        'territory',
        'country',
        'nationality',
        'createdate',
        'lifecyclestage'
      ],
      sorts: [
        {
          propertyName: 'createdate',
          direction: 'DESCENDING'
        }
      ],
      limit: 100
    };

    console.log('Executing HubSpot contacts search...');
    
    let allContacts = [];
    let after = undefined;
    let pageCount = 0;
    
    do {
      pageCount++;
      console.log(`   Fetching page ${pageCount}...`);
      
      if (after) {
        searchRequest.after = after;
      }
      
      const response = await hubspotClient.crm.contacts.searchApi.doSearch(searchRequest);
      
      if (response.results && response.results.length > 0) {
        allContacts = allContacts.concat(response.results);
        console.log(`   Page ${pageCount}: Found ${response.results.length} rejected contacts`);
      }
      
      after = response.paging?.next?.after;
      
    } while (after);
    
    console.log(`\nTotal rejected contacts found: ${allContacts.length}`);
    
    // Process and validate each contact
    console.log('\nProcessing rejected contacts for ECL...');
    
    let processedContacts = [];
    let contactsWithGCLID = 0;
    let contactsByTerritory = {};
    let contactsByCountry = {};
    
    for (let i = 0; i < allContacts.length; i++) {
      const contact = allContacts[i];
      const props = contact.properties;
      const contactId = contact.id;
      
      // Count by territory - improved territory detection
      const territory = props.territory || props.nationality || 'Unknown';
      contactsByTerritory[territory] = (contactsByTerritory[territory] || 0) + 1;
      
      // Count by country  
      const country = props.country || 'Unknown';
      contactsByCountry[country] = (contactsByCountry[country] || 0) + 1;
      
      // Check for GCLID (required for ECL)
      const gclid = props.hs_google_click_id || props.gclid;
      let hasGCLID = false;
      
      if (gclid && gclid.length > 10) {
        hasGCLID = true;
        contactsWithGCLID++;
        
        if (i < 3) {
          console.log(`   Contact ${contactId}: Has GCLID for ECL processing`);
        }
      } else {
        if (i < 3) {
          console.log(`   Contact ${contactId}: No GCLID - cannot process via ECL`);
        }
      }
      
      // Create processed contact object with create_date
      const processedContact = {
        contactId: contactId,
        leadId: props.lead_id,
        email: props.email,
        phone: props.phone,
        contactName: `${props.firstname || ''} ${props.lastname || ''}`.trim(),
        territory: props.territory || props.nationality,
        country: props.country,
        lifecyclestage: props.lifecyclestage,
        createDate: props.createdate, // Used for create_date field
        gclid: gclid,
        hasGCLID: hasGCLID,
        orderId: props.lead_id || props.hs_object_id || contactId,
        conversionAction: '7284140601',
        conversionValue: 0.00,
        rejectionReason: 'unsupported_territory'
      };
      
      processedContacts.push(processedContact);
    }
    
    // Summary report
    console.log('\nREJECTED CONTACTS SUMMARY:');
    console.log(`   Total Rejected Contacts: ${allContacts.length}`);
    console.log(`   Contacts with GCLID: ${contactsWithGCLID}`);
    console.log(`   Territory = "Unsupported Territory": ${contactsByTerritory['Unsupported Territory'] || 0}`);
    
    console.log('\nCONTACTS BY TERRITORY:');
    Object.entries(contactsByTerritory).forEach(([territory, count]) => {
      console.log(`   ${territory}: ${count} contacts`);
    });
    
    console.log('\nTOP COUNTRIES:');
    Object.entries(contactsByCountry)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([country, count]) => {
        console.log(`   ${country}: ${count} contacts`);
      });
    
    return {
      success: true,
      totalContacts: allContacts.length,
      contactsWithGCLID: contactsWithGCLID,
      contactsByTerritory: contactsByTerritory,
      contactsByCountry: contactsByCountry,
      processedContacts: processedContacts,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      filters: {
        source: 'PAID_SEARCH',
        territory: 'Unsupported Territory',
        deals: 0,
        requiresGCLID: true
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Failed to fetch rejected contacts:', error.message);
    throw error;
  }
}

/**
 * Export rejected contacts for ECL upload to Google Ads
 * UNIFIED: Uses create_date field (Contact creation date)
 */
async function exportRejectedForECL(processedContacts) {
  const eclConversions = [];
  
  for (const contact of processedContacts) {
    if (contact.gclid && contact.gclid.length > 10 && contact.createDate) {
      
      console.log(`Contact ${contact.contactId}: Using create_date ${contact.createDate} (Contact creation)`);
      
      const eclPayload = {
        conversion_action_id: "7284140601",
        stage: "mql_rejected",
        order_id: contact.orderId,
        gclid: contact.gclid,
        contact_email: contact.email,
        contact_phone: contact.phone || null,
        contact_id: contact.contactId,
        currency_code: "EUR",
        conversion_value: 0.00,
        create_date: contact.createDate, // UNIFIED FIELD - Contact creation date
        territory: contact.territory,
        rejection_reason: contact.rejectionReason
      };
      
      eclConversions.push(eclPayload);
    }
  }
  
  console.log(`\nREADY FOR ECL UPLOAD: ${eclConversions.length} zero-value conversions WITH create_date`);
  
  // Updated validation to check for create_date
  const validation = {
    totalWithGCLID: eclConversions.length,
    withLeadId: eclConversions.filter(c => c.order_id !== c.contact_id && c.order_id.length < 15).length,
    withEmail: eclConversions.filter(c => c.contact_email).length,
    withPhone: eclConversions.filter(c => c.contact_phone).length,
    withCreateDate: eclConversions.filter(c => c.create_date).length,
    unsupportedTerritory: eclConversions.filter(c => c.territory === 'Unsupported Territory').length,
    validForUpload: eclConversions.filter(c => 
      c.gclid && 
      c.contact_email && 
      c.order_id &&
      c.conversion_value === 0.00 &&
      c.create_date
    ).length
  };
  
  console.log(`ECL Validation:`);
  console.log(`   With Lead ID: ${validation.withLeadId}/${eclConversions.length}`);
  console.log(`   With Email: ${validation.withEmail}/${eclConversions.length}`);
  console.log(`   With Phone: ${validation.withPhone}/${eclConversions.length}`);
  console.log(`   With create_date: ${validation.withCreateDate}/${eclConversions.length}`);
  console.log(`   Unsupported Territory: ${validation.unsupportedTerritory}/${eclConversions.length}`);
  console.log(`   Ready for Upload: ${validation.validForUpload}/${eclConversions.length}`);
  
  return {
    conversions: eclConversions,
    validation: validation
  };
}

/**
 * Handle request to show rejected contacts ready for ECL (ROUTING HANDLER)
 */
async function handleRejectedReadyRequest(req, res, hubspotClient) {
  try {
    console.log('Preparing rejected contacts for ECL upload...');
    
    const result = await getRejectedContacts(hubspotClient);
    const eclResult = await exportRejectedForECL(result.processedContacts);
    
    res.json({
      success: true,
      message: 'Rejected contacts ready for ECL upload WITH create_date',
      summary: {
        totalRejectedContacts: result.totalContacts,
        readyForECL: eclResult.conversions.length,
        missingGCLID: result.totalContacts - eclResult.conversions.length,
        zeroValueConversions: eclResult.conversions.length,
        withCreateDate: eclResult.validation.withCreateDate
      },
      breakdown: {
        contactsByTerritory: result.contactsByTerritory,
        topCountries: Object.entries(result.contactsByCountry)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([country, count]) => ({ country, count }))
      },
      eclConversions: eclResult.conversions.slice(0, 5),
      eclValidation: eclResult.validation,
      validation: {
        dateRange: result.dateRange,
        filters: result.filters,
        dateHandling: 'Using create_date field for contact creation date'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Rejected contacts preparation failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle request to process rejected contacts through ECL (ROUTING HANDLER)
 */
async function handleRejectedProcessRequest(req, res, hubspotClient) {
  try {
    console.log('Processing rejected contacts for ECL upload WITH create_date...');
    
    const result = await getRejectedContacts(hubspotClient);
    const eclResult = await exportRejectedForECL(result.processedContacts);
    
    // Process through ECL handler
    const eclHandler = require('./ecl-handler');
    
    let processedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    console.log(`Starting ECL upload of ${eclResult.conversions.length} zero-value conversions...`);
    
    for (const conversion of eclResult.conversions) {
      try {
        console.log(`Processing ECL: ZERO-VALUE REJECTION`);
        console.log(`   Stage: ${conversion.stage}`);
        console.log(`   Order ID: ${conversion.order_id}`);
        console.log(`   GCLID Present: ${conversion.gclid ? 'YES' : 'NO'}`);
        console.log(`   Value: EUR${conversion.conversion_value}`);
        console.log(`   create_date: ${conversion.create_date}`);
        
        // Process zero-value conversion with create_date
        await eclHandler.processConversionAdjustment(conversion, {
          conversionType: 'rejection'
        });
        
        processedCount++;
        
        if (processedCount % 5 === 0) {
          console.log(`   Processed ${processedCount}/${eclResult.conversions.length} rejected contacts`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Failed to process rejected contact ${conversion.contact_id}: ${error.message}`);
        errorCount++;
        errors.push({
          contactId: conversion.contact_id,
          email: conversion.contact_email,
          createDate: conversion.create_date,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: 'ECL rejected contacts processing completed WITH create_date',
      summary: {
        totalRejectedContacts: result.totalContacts,
        totalConversions: eclResult.conversions.length,
        processedSuccessfully: processedCount,
        errors: errorCount,
        successRate: eclResult.conversions.length > 0 ? 
          ((processedCount / eclResult.conversions.length) * 100).toFixed(1) + '%' : '0%'
      },
      details: {
        conversionType: 'zero_value_rejection_with_create_date',
        zeroValueConversions: eclResult.conversions.length,
        conversionAction: '7284140601',
        purpose: 'Counteract initial conversion values for rejected leads using contact creation dates',
        dateHandling: 'create_date field for contact creation date'
      },
      errors: errors.slice(0, 5),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Rejected contacts ECL processing failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  getRejectedContacts,
  exportRejectedForECL,
  handleRejectedReadyRequest,
  handleRejectedProcessRequest
};