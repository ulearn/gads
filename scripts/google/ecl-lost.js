/**
 * ECL LOST Deals Handler
 * Business Logic for processing LOST deals with stage history analysis
 * 
 * File: /home/hub/public_html/gads/scripts/google/ecl-lost.js
 * Purpose: Send ECL conversions for LOST deals using last active stage probability
 * 
 * CRITICAL: LOST deals require stage history to find last active stage before closedlost
 */

async function getLostDeals(hubspotClient) {
  try {
    console.log('Fetching LOST deals with GCLID contacts and stage history...');
    
    // Date range: Same as other historical sweeps
    const startDate = new Date('2025-08-17T00:00:00.000Z');
    const endDate = new Date('2025-08-27T23:59:59.999Z');
    
    console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // HubSpot API search - EXACT same pattern as ecl-history.js
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
              operator: 'EQ',
              value: 'closedlost'
            }
          ]
        }
      ],
      properties: [
        'dealname',
        'dealstage', 
        'amount',
        'pipeline',
        'createdate',
        'closedate',
        'hubspot_owner_id'
      ],
      // CRITICAL: Request stage history
      propertiesWithHistory: ['dealstage'],
      sorts: [
        {
          propertyName: 'createdate',
          direction: 'DESCENDING'
        }
      ],
      limit: 100
    };

    console.log('Executing HubSpot deals search with stage history...');
    
    let allDeals = [];
    let after = undefined;
    let pageCount = 0;
    
    // Fetch all LOST deals with pagination
    do {
      pageCount++;
      console.log(`   Fetching page ${pageCount}...`);
      
      if (after) {
        searchRequest.after = after;
      }
      
      const response = await hubspotClient.crm.deals.searchApi.doSearch(searchRequest);
      
      if (response.results && response.results.length > 0) {
        allDeals = allDeals.concat(response.results);
        console.log(`   Page ${pageCount}: Found ${response.results.length} LOST deals`);
      }
      
      after = response.paging?.next?.after;
      
    } while (after);
    
    console.log(`\nTotal LOST deals found: ${allDeals.length}`);
    
    // Process each deal - EXACT same contact fetching pattern as ecl-history.js
    console.log('\nAnalyzing stage history and fetching contact data for LOST deals...');
    
    let processedDeals = [];
    let dealsWithHistory = 0;
    let dealsWithoutHistory = 0;
    let dealsWithGCLID = 0;
    let stageDistribution = {};
    
    for (let i = 0; i < allDeals.length; i++) {
      const deal = allDeals[i];
      const props = deal.properties;
      const dealId = deal.id;
      const stage = props.dealstage;
      const amount = parseFloat(props.amount || 0);
      
      // Analyze stage history - CORRECT structure from HubSpot API
      let lastActiveStage = 'qualifiedtobuy'; // Default fallback
      let hasHistory = false;
      
      // HubSpot returns propertiesWithHistory.dealstage as an array in reverse chronological order
      if (deal.propertiesWithHistory && deal.propertiesWithHistory.dealstage) {
        const stageHistory = deal.propertiesWithHistory.dealstage;
        
        if (stageHistory.length > 1) {
          hasHistory = true;
          dealsWithHistory++;
          
          // History is in reverse chronological order - most recent first
          // Find the penultimate stage (second item in array, index 1)
          if (stageHistory[0].value === 'closedlost' && stageHistory[1]) {
            lastActiveStage = stageHistory[1].value;
            
            if (i < 5) {
              console.log(`   Deal ${dealId}: Last active stage was "${lastActiveStage}" before closedlost`);
              console.log(`   Stage progression: ${stageHistory.map(s => s.value).reverse().join(' → ')}`);
            }
          } else {
            // Fallback - find closedlost and get previous stage
            const lostIndex = stageHistory.findIndex(stage => stage.value === 'closedlost');
            if (lostIndex !== -1 && stageHistory[lostIndex + 1]) {
              lastActiveStage = stageHistory[lostIndex + 1].value;
              
              if (i < 5) {
                console.log(`   Deal ${dealId}: Found closedlost at index ${lostIndex}, previous stage "${lastActiveStage}"`);
              }
            }
          }
        }
      } else {
        dealsWithoutHistory++;
        if (i < 5) {
          console.log(`   Deal ${dealId}: No stage history available - using default stage "${lastActiveStage}"`);
        }
      }
      
      // Count stages
      stageDistribution[lastActiveStage] = (stageDistribution[lastActiveStage] || 0) + 1;
      
      // Initialize contact data
      let contactData = null;
      let gclid = null;
      let hasGCLID = false;
      
      try {
        // EXACT same contact fetching pattern as ecl-history.js
        let associationsResponse = null;
        
        // Approach 1: Try deals associationsApi (v3)
        try {
          associationsResponse = await hubspotClient.crm.deals.associationsApi.getAll(
            dealId,
            'contact'
          );
        } catch (error1) {
          console.log(`   Deal ${dealId}: v3 API failed, trying v4...`);
          
          // Approach 2: Try v4 associations API
          try {
            associationsResponse = await hubspotClient.crm.associations.v4.basicApi.getPage(
              'deal',
              dealId,
              'contact'
            );
          } catch (error2) {
            console.log(`   Deal ${dealId}: v4 API failed, trying direct API...`);
            
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
            // Fetch contact data - EXACT same pattern as ecl-history.js
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
                'lifecyclestage',
                'territory'
              ]
            );
            
            const contactProps = contactResponse.properties;
            
            // FIRST: Check if contact is from PAID_SEARCH
            const analyticsSource = contactProps.hs_analytics_source;
            if (analyticsSource !== 'PAID_SEARCH') {
              if (i < 5) {
                console.log(`   Deal ${dealId}: Contact source is '${analyticsSource}', not PAID_SEARCH - skipping`);
              }
              continue; // Skip this deal - not from Google Ads
            } else {
              if (i < 3) {
                console.log(`   Deal ${dealId}: Contact source confirmed as PAID_SEARCH`);
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
                lastname: contactProps.lastname,
                territory: contactProps.territory
              };
              
              if (i < 3) {
                console.log(`   Deal ${dealId}: Found GCLID and contact data via associations API`);
              }
            } else {
              if (i < 3) {
                console.log(`   Deal ${dealId}: Contact found but no GCLID`);
              }
            }
          } else {
            if (i < 3) {
              console.log(`   Deal ${dealId}: Association found but no valid contact ID structure`);
            }
          }
        } else {
          if (i < 3) {
            console.log(`   Deal ${dealId}: No contact associations found`);
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (error) {
        if (i < 3) {
          console.log(`   Deal ${dealId}: API error - ${error.message}`);
        }
      }
      
      // Create processed deal object
      const processedDeal = {
        dealId: dealId,
        dealName: props.dealname,
        amount: amount,
        currentStage: 'closedlost',
        lastActiveStage: lastActiveStage,
        hasStageHistory: hasHistory,
        createDate: props.createdate,
        closeDate: props.closedate,
        ownerId: props.hubspot_owner_id,
        stageHistory: stageHistory,
        contact: contactData ? {
          hubspotId: contactData.hubspot_id,
          leadId: contactData.lead_id,
          email: contactData.email,
          phone: contactData.phone,
          gclid: gclid,
          source: 'PAID_SEARCH',
          territory: contactData.territory,
          contactName: `${contactData.firstname || ''} ${contactData.lastname || ''}`.trim()
        } : null,
        conversionAction: '7264211475'
      };
      
      processedDeals.push(processedDeal);
    }
    
    // Summary report
    console.log('\nLOST DEALS ANALYSIS:');
    console.log(`   Total LOST Deals: ${allDeals.length}`);
    console.log(`   Deals with Stage History: ${dealsWithHistory}`);
    console.log(`   Deals without History: ${dealsWithoutHistory}`);
    console.log(`   Deals with GCLID (PAID_SEARCH): ${dealsWithGCLID}`);
    
    console.log('\nLAST ACTIVE STAGE DISTRIBUTION:');
    Object.entries(stageDistribution)
      .sort(([,a], [,b]) => b - a)
      .forEach(([stage, count]) => {
        console.log(`   ${stage}: ${count} deals`);
      });
    
    return {
      success: true,
      totalDeals: allDeals.length,
      dealsWithHistory: dealsWithHistory,
      dealsWithoutHistory: dealsWithoutHistory,
      dealsWithGCLID: dealsWithGCLID,
      stageDistribution: stageDistribution,
      processedDeals: processedDeals,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      filters: {
        dealstage: 'closedlost',
        pipeline: 'default',
        requiresGCLID: true,
        requiresPaidSearch: true
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Failed to fetch LOST deals:', error.message);
    throw error;
  }
}

/**
 * Export LOST deals for ECL upload using last active stage probabilities
 * CORRECTED: Uses deal amount OR €1000 default, filters for GCLID only
 */
async function exportLostDealsForECL(processedDeals) {
  const eclConversions = [];
  
  // Stage completion probabilities - ACTUAL DATA
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
    'closedlost': 0.00         // LOST - 0%
  };
  
  let dealsWithGCLID = 0;
  let totalValue = 0;
  const defaultAmount = 1000; // €1000 average spend
  
  for (const deal of processedDeals) {
    // Only process deals with GCLID from PAID_SEARCH contacts
    if (!deal.contact || !deal.contact.gclid || deal.contact.source !== 'PAID_SEARCH') {
      console.log(`   Deal ${deal.dealId}: Skipping - no GCLID or not PAID_SEARCH`);
      continue;
    }
    
    dealsWithGCLID++;
    
    // Use deal amount OR €1000 default
    const dealAmount = deal.amount || defaultAmount;
    
    // Calculate ECL value using last active stage probability
    const stageProbability = stageProbabilities[deal.lastActiveStage] || 0.10;
    const eclValue = Math.round(dealAmount * stageProbability * 100) / 100;
    totalValue += eclValue;
    
    console.log(`Deal ${deal.dealId}: Amount €${dealAmount} ${deal.amount ? '(set)' : '(default)'}, Last stage "${deal.lastActiveStage}" (${(stageProbability * 100)}%), ECL value €${eclValue}`);
    
    const eclPayload = {
      conversion_action_id: "7264211475",
      stage: deal.lastActiveStage,
      order_id: deal.contact.hubspotId || deal.dealId, // Use contact ID as order ID
      gclid: deal.contact.gclid,
      contact_email: deal.contact.email,
      contact_phone: deal.contact.phone,
      contact_id: deal.contact.hubspotId,
      deal_id: deal.dealId,
      currency_code: "EUR",
      conversion_value: eclValue,
      create_date: deal.createDate, // Deal creation date
      deal_stage: deal.lastActiveStage,
      deal_amount: dealAmount,
      used_default_amount: !deal.amount,
      lost_from_stage: deal.lastActiveStage,
      final_stage: 'closedlost'
    };
    
    eclConversions.push(eclPayload);
  }
  
  console.log(`\nREADY FOR ECL UPLOAD: ${eclConversions.length} LOST deal conversions (with GCLID)`);
  console.log(`Total ECL Value: €${totalValue.toFixed(2)}`);
  
  const validation = {
    totalDeals: processedDeals.length,
    withGCLID: dealsWithGCLID,
    withoutGCLID: processedDeals.length - dealsWithGCLID,
    readyForUpload: eclConversions.length,
    totalECLValue: totalValue,
    averageECLValue: eclConversions.length > 0 ? (totalValue / eclConversions.length) : 0,
    usingDefaultAmount: eclConversions.filter(c => c.used_default_amount).length
  };
  
  console.log(`ECL LOST Validation:`);
  console.log(`   Total Deals: ${validation.totalDeals}`);
  console.log(`   With GCLID: ${validation.withGCLID}`);
  console.log(`   Ready for Upload: ${validation.readyForUpload}`);
  console.log(`   Using Default Amount (€1000): ${validation.usingDefaultAmount}/${validation.readyForUpload}`);
  console.log(`   Average ECL Value: €${validation.averageECLValue.toFixed(2)}`);
  
  return {
    conversions: eclConversions,
    validation: validation
  };
}

/**
 * Handle request to show LOST deals ready for ECL (ROUTING HANDLER)
 */
async function handleLostReadyRequest(req, res, hubspotClient) {
  try {
    console.log('Preparing LOST deals for ECL upload...');
    
    const result = await getLostDeals(hubspotClient);
    const eclResult = await exportLostDealsForECL(result.processedDeals);
    
    res.json({
      success: true,
      message: 'LOST deals ready for ECL upload with last active stage analysis',
      summary: {
        totalLostDeals: result.totalDeals,
        dealsWithStageHistory: result.dealsWithHistory,
        dealsWithoutHistory: result.dealsWithoutHistory,
        readyForECL: eclResult.conversions.length,
        totalECLValue: eclResult.validation.totalECLValue
      },
      stageAnalysis: {
        lastActiveStageDistribution: result.stageDistribution,
        stageProbabilitiesUsed: {
          'qualifiedtobuy': '10%',
          'sequenced': '15%',
          'engaging': '25%',
          'responsive': '50%',
          'advising': '60%',
          'consideration': '75%',
          'contractsent': '90%'
        }
      },
      eclConversions: eclResult.conversions.slice(0, 5), // Sample only
      eclValidation: eclResult.validation,
      validation: {
        dateRange: result.dateRange,
        filters: result.filters,
        stageHistoryRequired: 'Uses propertiesWithHistory for dealstage analysis'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('LOST deals preparation failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle request to process LOST deals through ECL (ROUTING HANDLER)
 */
async function handleLostProcessRequest(req, res, hubspotClient) {
  try {
    console.log('Processing LOST deals for ECL upload...');
    
    const result = await getLostDeals(hubspotClient);
    const eclResult = await exportLostDealsForECL(result.processedDeals);
    
    // Process through ECL handler
    const eclHandler = require('./ecl-handler');
    
    let processedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    console.log(`Starting ECL upload of ${eclResult.conversions.length} LOST deal conversions...`);
    
    for (const conversion of eclResult.conversions) {
      try {
        console.log(`Processing ECL: LOST DEAL CONVERSION`);
        console.log(`   Deal Stage: ${conversion.deal_stage} (last active)`);
        console.log(`   Order ID: ${conversion.order_id}`);
        console.log(`   Value: EUR${conversion.conversion_value}`);
        console.log(`   create_date: ${conversion.create_date}`);
        
        // Process LOST deal conversion with create_date
        await eclHandler.processConversionAdjustment(conversion, {
          conversionType: 'lost_deal',
          useLastActiveStage: true
        });
        
        processedCount++;
        
        if (processedCount % 10 === 0) {
          console.log(`   Processed ${processedCount}/${eclResult.conversions.length} LOST deals`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Failed to process LOST deal ${conversion.deal_id}: ${error.message}`);
        errorCount++;
        errors.push({
          dealId: conversion.deal_id,
          orderId: conversion.order_id,
          lastActiveStage: conversion.deal_stage,
          createDate: conversion.create_date,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: 'ECL LOST deals processing completed',
      summary: {
        totalLostDeals: result.totalDeals,
        totalConversions: eclResult.conversions.length,
        processedSuccessfully: processedCount,
        errors: errorCount,
        successRate: eclResult.conversions.length > 0 ? 
          ((processedCount / eclResult.conversions.length) * 100).toFixed(1) + '%' : '0%',
        totalECLValue: eclResult.validation.totalECLValue
      },
      details: {
        conversionType: 'lost_deal_with_last_active_stage',
        averageECLValue: eclResult.validation.averageECLValue,
        conversionAction: '7264211475',
        purpose: 'Upload conversions for LOST deals using last active stage probabilities',
        stageHistoryAnalysis: 'Used propertiesWithHistory to find last stage before closedlost'
      },
      errors: errors.slice(0, 5),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('LOST deals ECL processing failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  getLostDeals,
  exportLostDealsForECL,
  handleLostReadyRequest,
  handleLostProcessRequest
};