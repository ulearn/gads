/**
 * ECL Historical Conversion Upload Handler
 * Business Logic for processing historical deals for ECL upload
 * 
 * File: /home/hub/public_html/gads/scripts/google/ecl-history.js
 * CLEAN VERSION: Uses HubSpot's adjusted_amount directly - NO probability calculations
 */

async function getBaselinePipelineDeals(hubspotClient, getDbConnection, customStartDate = null, customEndDate = null) {
  try {
    console.log('🎯 Fetching baseline pipeline deals for ECL initial upload...');
    
    // Use custom dates if provided, otherwise default to Aug 17-27
    const startDate = customStartDate || new Date('2025-08-08T00:00:00.000Z');
    const endDate = customEndDate || new Date('2025-08-09T23:59:59.999Z');
    
    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // HubSpot API search - replicating your UI filter
    const searchRequest = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'pipeline',
              operator: 'EQ',
              value: 'default'
            },
            {
              propertyName: 'createdate',
              operator: 'BETWEEN',
              value: startDate.getTime().toString(),
              highValue: endDate.getTime().toString()
            },
            {
              propertyName: 'dealstage',
              operator: 'NEQ',
              value: 'closedlost'
            },
            {
              propertyName: 'dealstage',
              operator: 'NEQ',
              value: '114331579'
            }
          ]
        }
      ],
      properties: [
        'dealname',
        'dealstage', 
        'amount',
        'adjusted_amount',  // HubSpot calculated conversion value - MAIN FIELD
        'pipeline',
        'createdate',
        'closedate',
        'hubspot_owner_id'
      ],
      sorts: [
        {
          propertyName: 'createdate',
          direction: 'DESCENDING'
        }
      ],
      limit: 100
    };

    console.log('🔍 Executing HubSpot search...');
    
    let allDeals = [];
    let after = undefined;
    let pageCount = 0;
    
    // Fetch all deals with pagination
    do {
      pageCount++;
      console.log(`   📄 Fetching page ${pageCount}...`);
      
      if (after) {
        searchRequest.after = after;
      }
      
      const response = await hubspotClient.crm.deals.searchApi.doSearch(searchRequest);
      
      if (response.results && response.results.length > 0) {
        allDeals = allDeals.concat(response.results);
        console.log(`   ✅ Page ${pageCount}: Found ${response.results.length} deals`);
      }
      
      after = response.paging?.next?.after;
      
    } while (after);
    
    console.log(`\n✅ Total deals found: ${allDeals.length}`);
    
    // Process each deal to get contact data
    console.log('\n🔍 Fetching contact data for each deal...');
    
    let processedDeals = [];
    let dealsWithGCLID = 0;
    let dealsWithAmount = 0;
    let dealsByStage = {};
    
    for (let i = 0; i < allDeals.length; i++) {
      const deal = allDeals[i];
      const props = deal.properties;
      const dealId = deal.id;
      const stage = props.dealstage;
      const amount = parseFloat(props.amount || 0);
      const adjustedAmount = parseFloat(props.adjusted_amount || 0); // HUBSPOT CALCULATED VALUE
      
      // Count deals by stage
      dealsByStage[stage] = (dealsByStage[stage] || 0) + 1;
      
      if (amount > 0) {
        dealsWithAmount++;
      }
      
      // Initialize contact data
      let contactData = null;
      let gclid = null;
      let hasGCLID = false;
      
      try {
        // Try multiple approaches to get contact associations
        let associationsResponse = null;
        
        // Approach 1: Try deals associationsApi (v3)
        try {
          associationsResponse = await hubspotClient.crm.deals.associationsApi.getAll(
            dealId,
            'contact'
          );
        } catch (error1) {
          console.log(`   🔄 Deal ${dealId}: v3 API failed, trying v4...`);
          
          // Approach 2: Try v4 associations API
          try {
            associationsResponse = await hubspotClient.crm.associations.v4.basicApi.getPage(
              'deal',
              dealId,
              'contact'
            );
          } catch (error2) {
            console.log(`   🔄 Deal ${dealId}: v4 API failed, trying direct API...`);
            
            // Approach 3: Direct API call as fallback
            try {
              const apiResponse = await hubspotClient.apiRequest({
                method: 'GET',
                path: `/crm/v3/objects/deals/${dealId}/associations/contacts`
              });
              
              if (apiResponse && apiResponse.body && apiResponse.body.results) {
                associationsResponse = { results: apiResponse.body.results };
              }
            } catch (error3) {
              throw new Error(`All association methods failed: ${error1.message}, ${error2.message}, ${error3.message}`);
            }
          }
        }
        
        if (associationsResponse && associationsResponse.results && associationsResponse.results.length > 0) {
          // Get contact ID from result (different structures for different APIs)
          let contactId;
          const firstResult = associationsResponse.results[0];
          
          if (firstResult.id) {
            contactId = firstResult.id; // v3 API structure
          } else if (firstResult.toObjectId) {
            contactId = firstResult.toObjectId; // v4 API structure  
          } else if (firstResult.to && firstResult.to.id) {
            contactId = firstResult.to.id; // Direct API structure
          }
          
          if (contactId) {
          
          // Fetch contact data with all ECL required fields + source validation
          const contactResponse = await hubspotClient.crm.contacts.basicApi.getById(
            contactId,
            [
              // GCLID fields
              'hs_google_click_id', 
              'gclid',
              
              // Source validation
              'hs_analytics_source',
              
              // Contact identification
              'hs_object_id',
              'lead_id',
              'email',
              'phone',
              'firstname', 
              'lastname',
              
              // Additional useful fields
              'createdate',
              'country',
              'lifecyclestage'
            ]
          );
          
          const contactProps = contactResponse.properties;
          
          // FIRST: Check if contact is from PAID_SEARCH
          const analyticsSource = contactProps.hs_analytics_source;
          if (analyticsSource !== 'PAID_SEARCH') {
            if (i < 5) {
              console.log(`   ⚠️ Deal ${dealId}: Contact source is '${analyticsSource}', not PAID_SEARCH - skipping`);
            }
            continue; // Skip this deal - not from Google Ads
          } else {
            if (i < 3) {
              console.log(`   ✅ Deal ${dealId}: Contact source confirmed as PAID_SEARCH`);
            }
          }
          
          // SECOND: Get GCLID from contact (try both field names)
          const contactGCLID = contactProps.hs_google_click_id || contactProps.gclid;
          
          if (contactGCLID && contactGCLID.length > 10) {
            gclid = contactGCLID;
            hasGCLID = true;
            dealsWithGCLID++;
            
            contactData = {
              hubspot_id: contactProps.hs_object_id || contactId,
              lead_id: contactProps.lead_id,
              email: contactProps.email,
              phone: contactProps.phone,
              firstname: contactProps.firstname,
              lastname: contactProps.lastname
            };
            
            if (i < 3) {
              console.log(`   ✅ Deal ${dealId}: Found GCLID and contact data via associations API`);
            }
          } else {
            if (i < 3) {
              console.log(`   ⚠️ Deal ${dealId}: Contact found but no GCLID`);
            }
          }
          } else {
            if (i < 3) {
              console.log(`   ⚠️ Deal ${dealId}: Association found but no valid contact ID structure`);
            }
          }
        } else {
          if (i < 3) {
            console.log(`   ❌ Deal ${dealId}: No contact associations found`);
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (error) {
        if (i < 3) {
          console.log(`   ❌ Deal ${dealId}: API error - ${error.message}`);
        }
      }
      
      // Create processed deal object - USING HUBSPOT'S ADJUSTED_AMOUNT DIRECTLY
      const processedDeal = {
        dealId: dealId,
        dealName: props.dealname,
        dealStage: stage,
        amount: amount,
        adjustedAmount: adjustedAmount, // HubSpot calculated value - USE THIS
        createDate: props.createdate,
        gclid: gclid,
        hasGCLID: hasGCLID,
        contactId: contactData?.hubspot_id,
        leadId: contactData?.lead_id,
        contactEmail: contactData?.email,
        contactPhone: contactData?.phone,
        contactName: contactData ? `${contactData.firstname || ''} ${contactData.lastname || ''}`.trim() : null,
        conversionAction: '7264211475', // UPDATED CONVERSION ACTION ID
        conversionValue: adjustedAmount || 0, // USE HUBSPOT'S VALUE DIRECTLY
        dealCreateDate: props.createdate // ADD CREATE DATE FOR DATE CORRECTIONS
      };
      
      processedDeals.push(processedDeal);
    }
    
    // Summary report
    console.log('\n📊 BASELINE PIPELINE DEALS SUMMARY:');
    console.log(`   Total Deals: ${allDeals.length}`);
    console.log(`   Deals with GCLID: ${dealsWithGCLID}`);
    console.log(`   Deals with Amount: ${dealsWithAmount}`);
    
    console.log('\n📈 DEALS BY STAGE:');
    Object.entries(dealsByStage).forEach(([stage, count]) => {
      console.log(`   ${stage}: ${count} deals`);
    });
    
    if (allDeals.length === 65) {
      console.log('✅ PERFECT MATCH! Found exactly 65 deals as expected from UI');
    } else {
      console.log(`⚠️  Count mismatch: API found ${allDeals.length} deals, UI shows 65`);
    }
    
    return {
      success: true,
      totalDeals: allDeals.length,
      expectedCount: 65,
      matchesUI: allDeals.length === 65,
      dealsWithGCLID: dealsWithGCLID,
      dealsWithAmount: dealsWithAmount,
      dealsByStage: dealsByStage,
      processedDeals: processedDeals,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      filters: {
        pipeline: 'default',
        excludedStages: ['closedlost', '114331579'],
        createDateFilter: true
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Failed to fetch baseline pipeline deals:', error.message);
    throw error;
  }
}

/**
 * Export processed deals for ECL upload to Google Ads
 */
async function exportForECLUpload(processedDeals) {
  const eclConversions = [];
  
  for (const deal of processedDeals) {
    if (deal.gclid && deal.gclid.length > 10) {
      const eclPayload = {
        conversion_action_id: "7264211475", // UPDATED CONVERSION ACTION
        stage: deal.dealStage,
        order_id: deal.leadId || deal.contactId,
        gclid: deal.gclid,
        contact_email: deal.contactEmail,
        contact_phone: deal.contactPhone || null,
        contact_id: deal.contactId,
        currency_code: "EUR",
        conversion_value: deal.adjustedAmount || deal.conversionValue, // USE HUBSPOT'S CALCULATED VALUE
        deal_id: deal.dealId,
        deal_name: deal.dealName,
        contact_name: deal.contactName,
        original_amount: deal.amount,
        hubspot_calculated_value: deal.adjustedAmount, // SHOW HUBSPOT VALUE
        deal_create_date: deal.dealCreateDate, // ADD FOR DATE CORRECTIONS
        conversion_type: "initial"
      };
      
      eclConversions.push(eclPayload);
    }
  }
  
  console.log(`\n🚀 READY FOR ECL UPLOAD: ${eclConversions.length} conversions`);
  
  const validation = {
    totalWithGCLID: eclConversions.length,
    withLeadId: eclConversions.filter(c => c.order_id !== c.deal_id).length,
    withEmail: eclConversions.filter(c => c.contact_email).length,
    withPhone: eclConversions.filter(c => c.contact_phone).length,
    withHubSpotValue: eclConversions.filter(c => c.hubspot_calculated_value > 0).length,
    validForUpload: eclConversions.filter(c => 
      c.gclid && 
      c.contact_email && 
      c.order_id // All will have order_id now (leadId or dealId)
    ).length
  };
  
  console.log(`📊 ECL Validation:`);
  console.log(`   With Lead ID: ${validation.withLeadId}/${eclConversions.length}`);
  console.log(`   With Email: ${validation.withEmail}/${eclConversions.length}`);
  console.log(`   With Phone: ${validation.withPhone}/${eclConversions.length}`);
  console.log(`   With HubSpot Value: ${validation.withHubSpotValue}/${eclConversions.length}`);
  console.log(`   Ready for Upload: ${validation.validForUpload}/${eclConversions.length}`);
  
  return {
    conversions: eclConversions,
    validation: validation
  };
}

/**
 * Handle request for baseline pipeline deals (ROUTING HANDLER)
 */
async function handleBaselineDealsRequest(req, res, hubspotClient, getDbConnection) {
  try {
    console.log('🎯 Testing baseline pipeline deals API vs UI filter...');
    
    const result = await getBaselinePipelineDeals(hubspotClient, getDbConnection);
    
    res.json({
      success: true,
      message: 'Baseline pipeline deals fetched successfully',
      summary: {
        totalDeals: result.totalDeals,
        expectedFromUI: 65,
        matchesUI: result.matchesUI,
        dealsWithGCLID: result.dealsWithGCLID,
        dealsWithAmount: result.dealsWithAmount
      },
      breakdown: {
        dealsByStage: result.dealsByStage,
        dateRange: result.dateRange,
        filters: result.filters
      },
      sampleDeals: result.processedDeals.slice(0, 5).map(deal => ({
        dealId: deal.dealId,
        dealName: deal.dealName,
        dealStage: deal.dealStage,
        amount: deal.amount,
        adjustedAmount: deal.adjustedAmount, // SHOW HUBSPOT'S VALUE
        createDate: deal.createDate,
        hasGCLID: !!deal.gclid,
        contactEmail: deal.contactEmail,
        contactPhone: deal.contactPhone,
        leadId: deal.leadId,
        conversionValue: deal.conversionValue
      })),
      timestamp: result.timestamp
    });
    
  } catch (error) {
    console.error('❌ Baseline deals test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch baseline pipeline deals',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle request for ECL-ready baseline deals (ROUTING HANDLER)
 */
async function handleECLReadyRequest(req, res, hubspotClient, getDbConnection) {
  try {
    console.log('🚀 Preparing baseline deals for ECL upload...');
    
    const result = await getBaselinePipelineDeals(hubspotClient, getDbConnection);
    const eclResult = await exportForECLUpload(result.processedDeals);
    
    res.json({
      success: true,
      message: 'Baseline deals ready for ECL upload',
      summary: {
        totalDeals: result.totalDeals,
        readyForECL: eclResult.conversions.length,
        missingGCLID: result.totalDeals - eclResult.conversions.length
      },
      eclConversions: eclResult.conversions,
      eclValidation: eclResult.validation,
      validation: {
        matchesUICount: result.matchesUI,
        dateRange: result.dateRange,
        filters: result.filters
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ ECL preparation failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle ECL processing request (ROUTING HANDLER)
 */
/**
 * Handle ECL processing request (ROUTING HANDLER) - MODIFIED to send historical dates
 */
async function handleECLProcessRequest(req, res, hubspotClient, getDbConnection) {
  try {
    console.log('🎯 Processing ECL conversions for baseline deals WITH HISTORICAL DATES...');
    
    const result = await getBaselinePipelineDeals(hubspotClient, getDbConnection);
    const eclResult = await exportForECLUpload(result.processedDeals);
    
    const eclHandler = require('./ecl-handler');
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const conversion of eclResult.conversions) {
      try {
        // UPDATED: Simplified payload format for minimal handler
        const conversionPayload = {
          conversion_action_id: conversion.conversion_action_id,
          stage: conversion.stage,
          order_id: conversion.order_id,
          gclid: conversion.gclid,
          contact_email: conversion.contact_email,
          contact_phone: conversion.contact_phone,
          contact_id: conversion.contact_id,
          currency_code: conversion.currency_code,
          conversion_value: conversion.conversion_value,
          deal_id: conversion.deal_id,
          // REMOVED: custom_conversion_date_time - use deal create date if needed
          custom_conversion_date_time: new Date(conversion.deal_create_date).toISOString().slice(0, 19).replace('T', ' ') + '+00:00'
        };
        
        await eclHandler.processConversionAdjustment(conversionPayload, { getDbConnection });
        processedCount++;
        
        if (processedCount % 10 === 0) {
          console.log(`   ✅ Uploaded ${processedCount}/${eclResult.conversions.length} conversions with historical dates`);
        }
        
        // Rate limiting - reduced for faster processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Failed to process conversion ${conversion.deal_id}:`, error.message);
        errorCount++;
      }
    }
    
    res.json({
      success: true,
      message: 'ECL baseline processing completed WITH HISTORICAL DATES',
      summary: {
        totalConversions: eclResult.conversions.length,
        processedSuccessfully: processedCount,
        errors: errorCount,
        successRate: eclResult.conversions.length > 0 ? 
          ((processedCount / eclResult.conversions.length) * 100).toFixed(1) + '%' : '0%'
      },
      details: {
        conversionType: 'initial_with_historical_dates',
        dateRange: result.dateRange,
        purpose: 'Upload conversions with correct historical deal creation dates',
        handler: 'minimal_ecl_handler_compatible'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ ECL processing failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle ECL date correction request - Send RETRACTIONS for incorrectly dated conversions
 */
async function handleDateFixRequest(req, res, hubspotClient) {
  try {
    console.log('🔧 Retracting ECL conversions with incorrect dates...');
    
    const result = await getBaselinePipelineDeals(hubspotClient);
    const eclResult = await exportForECLUpload(result.processedDeals);
    
    // Process through ECL handler as RETRACTIONS to remove incorrect conversions
    const eclHandler = require('./ecl-handler');
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const conversion of eclResult.conversions) {
      try {
        // Send RETRACTION to remove the incorrectly dated conversion
        const retractionPayload = {
          conversion_action_id: conversion.conversion_action_id,
          adjustment_type: "RETRACTION",
          order_id: conversion.order_id,
          contact_email: conversion.contact_email,
          contact_phone: conversion.contact_phone,
          currency_code: "EUR",
          stage: conversion.stage,
          deal_id: conversion.deal_id
        };
        
        await eclHandler.processConversionAdjustment(retractionPayload, {});
        processedCount++;
        
        if (processedCount % 10 === 0) {
          console.log(`   ✅ Retracted ${processedCount}/${eclResult.conversions.length} conversions`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ Failed to retract conversion ${conversion.deal_id}:`, error.message);
        errorCount++;
      }
    }
    
    res.json({
      success: true,
      message: 'ECL conversions retracted - ready to re-upload with correct dates',
      summary: {
        totalDeals: result.totalDeals,
        totalConversions: eclResult.conversions.length,
        conversionsRetracted: processedCount,
        errors: errorCount,
        successRate: eclResult.conversions.length > 0 ? 
          ((processedCount / eclResult.conversions.length) * 100).toFixed(1) + '%' : '0%'
      },
      details: {
        adjustmentType: 'RETRACTION',
        dateRange: result.dateRange,
        purpose: 'Remove conversions with incorrect dates - ready for historical re-upload',
        nextStep: 'Use /ecl/baseline-process to re-upload with correct historical dates'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ ECL retraction failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  getBaselinePipelineDeals,
  exportForECLUpload,
  handleBaselineDealsRequest,
  handleECLReadyRequest,
  handleECLProcessRequest,
  handleDateFixRequest
};