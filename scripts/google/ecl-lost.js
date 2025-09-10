/**
 * ECL LOST Deals Handler - BATCH API for Stage History
 * 
 * SOLUTION: 
 * 1. Search API to get deal IDs (limited date range)
 * 2. Batch API to get stage history for up to 50 deals at once (HubSpot limit for propertiesWithHistory)
 */

const fs = require('fs');
const path = require('path');

// Load stage mapping from stage-map.json
function loadStageMapping() {
  try {
    const stageMappingPath = path.join(__dirname, '../analytics/stage-map.json');
    const stageData = JSON.parse(fs.readFileSync(stageMappingPath, 'utf8'));
    
    console.log('✅ Stage mapping loaded successfully');
    console.log(`   Pipeline: ${stageData.metadata?.pipelineId || 'default'}`);
    console.log(`   Stages mapped: ${Object.keys(stageData.stageMapping).length}`);
    
    return stageData.stageMapping;
  } catch (error) {
    console.error('❌ Failed to load stage mapping:', error.message);
    throw error;
  }
}

async function getLostDeals(hubspotClient) {
  try {
    console.log('Fetching LOST deals with BATCH API for stage history...');
    
    // Load stage mapping FIRST
    const stageMapping = loadStageMapping();
    
    // LIMITED DATE RANGE - 1 week for testing
    const startDate = new Date('2025-08-30T00:00:00.000Z');
    const endDate = new Date('2025-09-09T16:00:00.000Z');
    
    console.log(`📅 Limited date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // STEP 1: Search for LOST deals to get IDs only
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
      sorts: [
        {
          propertyName: 'createdate',
          direction: 'DESCENDING'
        }
      ],
      limit: 100
    };

    console.log('🔍 STEP 1: Searching for LOST deals (IDs only)...');
    
    let allDealIds = [];
    let allBasicDeals = [];
    let after = undefined;
    let pageCount = 0;
    
    // Get all deal IDs
    do {
      pageCount++;
      console.log(`   Fetching search page ${pageCount}...`);
      
      if (after) {
        searchRequest.after = after;
      }
      
      const response = await hubspotClient.crm.deals.searchApi.doSearch(searchRequest);
      
      if (response.results && response.results.length > 0) {
        // Collect deal IDs and basic data
        response.results.forEach(deal => {
          allDealIds.push(deal.id);
          allBasicDeals.push(deal);
        });
        
        console.log(`   Page ${pageCount}: Found ${response.results.length} LOST deals`);
      }
      
      after = response.paging?.next?.after;
      
    } while (after);
    
    console.log(`\\n📋 STEP 1 COMPLETE: Found ${allDealIds.length} LOST deals`);
    
    if (allDealIds.length === 0) {
      throw new Error('No LOST deals found in date range');
    }
    
    // STEP 2: Fetch deals with stage history using BATCH API
    console.log(`\\n🔄 STEP 2: Fetching stage history using BATCH API...`);
    
    let allDealsWithHistory = [];
    const batchSize = 50; // HubSpot batch limit for propertiesWithHistory
    const batches = [];
    
    // Split deal IDs into batches of 100
    for (let i = 0; i < allDealIds.length; i += batchSize) {
      batches.push(allDealIds.slice(i, i + batchSize));
    }
    
    console.log(`   Processing ${batches.length} batch(es) of up to ${batchSize} deals each...`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`   ⚡ Batch ${batchIndex + 1}/${batches.length}: ${batch.length} deals`);
      
      try {
        // HubSpot Batch Read API with propertiesWithHistory
        const batchRequest = {
          inputs: batch.map(id => ({ id: id })),
          properties: [
            'dealname',
            'dealstage', 
            'amount',
            'pipeline',
            'createdate',
            'closedate',
            'hubspot_owner_id'
          ],
          propertiesWithHistory: ['dealstage'] // This should work in batch API!
        };
        
        const batchResponse = await hubspotClient.crm.deals.batchApi.read(batchRequest);
        
        if (batchResponse.results && batchResponse.results.length > 0) {
          allDealsWithHistory = allDealsWithHistory.concat(batchResponse.results);
          console.log(`     ✅ Batch ${batchIndex + 1}: Got ${batchResponse.results.length} deals with history`);
        } else {
          console.log(`     ⚠️ Batch ${batchIndex + 1}: No results returned`);
        }
        
        // Rate limiting between batches
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`     ❌ Batch ${batchIndex + 1} failed: ${error.message}`);
        // Continue with other batches
      }
    }
    
    console.log(`\\n📊 STEP 2 COMPLETE: Retrieved ${allDealsWithHistory.length} deals with stage history`);
    
    // STEP 3: Process stage history and analyze
    console.log(`\\n🧮 STEP 3: Analyzing stage history with stage mapping...`);
    
    let processedDeals = [];
    let dealsWithHistory = 0;
    let dealsWithValidHistory = 0;
    let dealsWithGCLID = 0;
    let stageDistribution = {};
    
    for (let i = 0; i < allDealsWithHistory.length; i++) {
      const deal = allDealsWithHistory[i];
      const props = deal.properties;
      const dealId = deal.id;
      const amount = parseFloat(props.amount || 0);
      
      // Analyze stage history with stage mapping
      let lastActiveStage = null;
      let lastActiveStageName = null;
      let lastActiveProbability = null;
      let lastActiveStageTimestamp = null;
      let hasValidHistory = false;
      let stageHistory = [];
      
      // Process HubSpot stage history (from batch API)
      if (deal.propertiesWithHistory && deal.propertiesWithHistory.dealstage) {
        stageHistory = deal.propertiesWithHistory.dealstage;
        dealsWithHistory++;
        
        if (stageHistory.length > 1) {
          // Find the last active stage before closedlost
          for (let j = 0; j < stageHistory.length; j++) {
            const historyEntry = stageHistory[j];
            const stageId = historyEntry.value;
            
            // Skip closedlost - we want the stage BEFORE it was lost
            if (stageId === 'closedlost') {
              continue;
            }
            
            // Check if this stage ID exists in our mapping
            if (stageMapping[stageId]) {
              lastActiveStage = stageId;
              lastActiveStageName = stageMapping[stageId].label;
              lastActiveProbability = stageMapping[stageId].probability;
              lastActiveStageTimestamp = historyEntry.timestamp; // Capture the timestamp when deal moved TO this stage
              hasValidHistory = true;
              
              if (i < 5) {
                console.log(`   Deal ${dealId}: Last active stage "${lastActiveStageName}" (${stageId}) - ${(lastActiveProbability * 100)}% probability`);
                console.log(`     Stage reached on: ${new Date(lastActiveStageTimestamp).toISOString()}`);
                
                // Show progression for first few deals
                const progression = stageHistory
                  .map(h => {
                    const mapped = stageMapping[h.value];
                    const timestamp = new Date(h.timestamp).toISOString().slice(0, 10);
                    return mapped ? `${mapped.label}(${timestamp})` : `${h.value}(${timestamp})`;
                  })
                  .reverse()
                  .join(' → ');
                console.log(`     Progression: ${progression}`);
              }
              break;
            }
          }
          
          if (hasValidHistory) {
            dealsWithValidHistory++;
          } else {
            if (i < 3) {
              console.log(`   Deal ${dealId}: No valid stages found in mapping`);
            }
          }
        }
      } else {
        if (i < 3) {
          console.log(`   Deal ${dealId}: No stage history in batch response`);
        }
      }
      
      // Count stage distribution
      if (lastActiveStageName) {
        stageDistribution[lastActiveStageName] = (stageDistribution[lastActiveStageName] || 0) + 1;
      } else {
        stageDistribution['NO_VALID_HISTORY'] = (stageDistribution['NO_VALID_HISTORY'] || 0) + 1;
      }
      
      // Get associated contact data (existing logic)
      let contactData = null;
      let gclid = null;
      
      try {
        // Contact fetching logic (same as before)
        let associationsResponse = null;
        
        try {
          associationsResponse = await hubspotClient.crm.deals.associationsApi.getAll(
            dealId,
            'contact'
          );
        } catch (error1) {
          try {
            associationsResponse = await hubspotClient.crm.associations.v4.basicApi.getPage(
              'deal',
              dealId,
              'contact'
            );
          } catch (error2) {
            try {
              const apiResponse = await hubspotClient.apiRequest({
                method: 'GET',
                path: `/crm/v3/objects/deals/${dealId}/associations/contacts`
              });
              
              if (apiResponse && apiResponse.body && apiResponse.body.results) {
                associationsResponse = { results: apiResponse.body.results };
              }
            } catch (error3) {
              throw new Error('All association methods failed');
            }
          }
        }
        
        if (associationsResponse && associationsResponse.results && associationsResponse.results.length > 0) {
          let contactId;
          const firstResult = associationsResponse.results[0];
          
          if (firstResult.id) {
            contactId = firstResult.id;
          } else if (firstResult.toObjectId) {
            contactId = firstResult.toObjectId;
          } else if (firstResult.to && firstResult.to.id) {
            contactId = firstResult.to.id;
          }
          
          if (contactId) {
            const contactResponse = await hubspotClient.crm.contacts.basicApi.getById(
              contactId,
              [
                'hs_google_click_id', 
                'gclid',
                'hs_analytics_source',
                'hs_object_id',
                'lead_id',
                'email',
                'phone',
                'firstname', 
                'lastname',
                'territory'
              ]
            );
            
            const contactProps = contactResponse.properties;
            const analyticsSource = contactProps.hs_analytics_source;
            
            if (analyticsSource === 'PAID_SEARCH') {
              const contactGCLID = contactProps.hs_google_click_id || contactProps.gclid;
              
              if (contactGCLID && contactGCLID.length > 10) {
                gclid = contactGCLID;
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
                  console.log(`   Deal ${dealId}: ✅ Found GCLID and PAID_SEARCH contact`);
                }
              }
            } else {
              if (i < 3) {
                console.log(`   Deal ${dealId}: Contact source '${analyticsSource}', not PAID_SEARCH`);
              }
            }
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        if (i < 3) {
          console.log(`   Deal ${dealId}: Contact fetch error - ${error.message}`);
        }
      }
      
      // Create processed deal object
      const processedDeal = {
        dealId: dealId,
        dealName: props.dealname,
        amount: amount,
        currentStage: 'closedlost',
        lastActiveStage: lastActiveStage,
        lastActiveStageName: lastActiveStageName,
        lastActiveProbability: lastActiveProbability,
        lastActiveStageTimestamp: lastActiveStageTimestamp, // Timestamp when deal reached penultimate stage
        hasValidHistory: hasValidHistory,
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
    
    // Final summary
    console.log('\\n📋 LOST DEALS ANALYSIS (BATCH API + STAGE MAPPING):');
    console.log(`   Total LOST Deals Found: ${allDealIds.length}`);
    console.log(`   Deals Retrieved with History: ${allDealsWithHistory.length}`);
    console.log(`   Deals with Stage History: ${dealsWithHistory}`);
    console.log(`   Deals with Valid Mapped History: ${dealsWithValidHistory}`);
    console.log(`   Deals with GCLID (PAID_SEARCH): ${dealsWithGCLID}`);
    
    console.log('\\nLAST ACTIVE STAGE DISTRIBUTION:');
    Object.entries(stageDistribution)
      .sort(([,a], [,b]) => b - a)
      .forEach(([stage, count]) => {
        console.log(`   ${stage}: ${count} deals`);
      });
    
    return {
      success: true,
      totalDealsFound: allDealIds.length,
      totalDealsWithHistory: allDealsWithHistory.length,
      dealsWithHistory: dealsWithHistory,
      dealsWithValidHistory: dealsWithValidHistory,
      dealsWithGCLID: dealsWithGCLID,
      stageDistribution: stageDistribution,
      processedDeals: processedDeals,
      batchInfo: {
        batchesProcessed: batches.length,
        batchSize: batchSize
      },
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Failed to fetch LOST deals with batch API:', error.message);
    throw error;
  }
}

/**
 * Export LOST deals for ECL upload using ACTUAL stage mapping probabilities
 * UPDATED: Only processes deals with valid stage history from batch API
 */
async function exportLostDealsForECL(processedDeals) {
  const eclConversions = [];
  
  let dealsWithGCLID = 0;
  let dealsWithValidHistory = 0;
  let dealsSkippedNoHistory = 0;
  let dealsWithLeadId = 0;
  let dealsUsingDealIdFallback = 0;
  let totalValue = 0;
  const defaultAmount = 1000;
  
  console.log('\\n🔍 ECL EXPORT ANALYSIS (BATCH API + STAGE MAPPING):');
  
  for (const deal of processedDeals) {
    // Only process deals with GCLID from PAID_SEARCH contacts
    if (!deal.contact || !deal.contact.gclid || deal.contact.source !== 'PAID_SEARCH') {
      continue;
    }
    
    dealsWithGCLID++;
    
    // Only process deals with valid stage history
    if (!deal.hasValidHistory || !deal.lastActiveProbability) {
      dealsSkippedNoHistory++;
      console.log(`   Deal ${deal.dealId}: ❌ SKIPPED - No valid stage history`);
      continue;
    }
    
    dealsWithValidHistory++;
    
    // Use deal amount OR €1000 default
    const dealAmount = deal.amount || defaultAmount;
    
    // Calculate ECL value using ACTUAL stage probability
    const stageProbability = deal.lastActiveProbability;
    const eclValue = Math.round(dealAmount * stageProbability * 100) / 100;
    totalValue += eclValue;
    
    console.log(`   Deal ${deal.dealId}: ✅ Amount €${dealAmount}, Stage "${deal.lastActiveStageName}" (${(stageProbability * 100)}%), ECL €${eclValue}`);
    
    // Determine order_id: lead_id (preferred) or fallback to Deal ID
    let orderId;
    let orderIdSource;
    
    if (deal.contact.leadId && deal.contact.leadId.trim() !== '') {
      orderId = deal.contact.leadId;
      orderIdSource = 'lead_id';
      dealsWithLeadId++;
    } else {
      orderId = deal.dealId;
      orderIdSource = 'deal_id_fallback';
      dealsUsingDealIdFallback++;
      console.log(`   Deal ${deal.dealId}: ⚠️ No lead_id, using Deal ID as order_id`);
    }
    
    const eclPayload = {
      conversion_action_id: "7264211475",
      stage: deal.lastActiveStage,
      stage_name: deal.lastActiveStageName,
      order_id: orderId,
      order_id_source: orderIdSource, // Track which ID we used
      gclid: deal.contact.gclid,
      contact_email: deal.contact.email,
      contact_phone: deal.contact.phone,
      contact_id: deal.contact.hubspotId,
      deal_id: deal.dealId,
      currency_code: "EUR",
      conversion_value: eclValue,
      create_date: deal.lastActiveStageTimestamp, // Use timestamp when deal reached penultimate stage
      deal_stage: deal.lastActiveStage,
      deal_stage_name: deal.lastActiveStageName,
      deal_amount: dealAmount,
      stage_probability: stageProbability,
      used_default_amount: !deal.amount,
      lost_from_stage: deal.lastActiveStageName,
      final_stage: 'closedlost',
      original_create_date: deal.createDate, // Keep original deal creation for reference
      stage_reached_date: deal.lastActiveStageTimestamp // Clear field name for ECL handler
    };
    
    eclConversions.push(eclPayload);
  }
  
  console.log(`\\n🎯 ECL BATCH RESULTS:`);
  console.log(`   Total ECL Conversions: ${eclConversions.length}`);
  console.log(`   Total ECL Value: €${totalValue.toFixed(2)}`);
  console.log(`   Average ECL Value: €${eclConversions.length > 0 ? (totalValue / eclConversions.length).toFixed(2) : '0.00'}`);
  
  return {
    conversions: eclConversions,
    validation: {
      totalDeals: processedDeals.length,
      withGCLID: dealsWithGCLID,
      withValidHistory: dealsWithValidHistory,
      skippedNoHistory: dealsSkippedNoHistory,
      readyForUpload: eclConversions.length,
      totalECLValue: totalValue,
      averageECLValue: eclConversions.length > 0 ? (totalValue / eclConversions.length) : 0,
      usingDefaultAmount: eclConversions.filter(c => c.used_default_amount).length
    }
  };
}

/**
 * Handle request to show LOST deals ready for ECL (ROUTING HANDLER)
 */
async function handleLostReadyRequest(req, res, hubspotClient) {
  try {
    console.log('🚀 Preparing LOST deals for ECL upload with BATCH API + stage mapping...');
    
    const result = await getLostDeals(hubspotClient);
    const eclResult = await exportLostDealsForECL(result.processedDeals);
    
    res.json({
      success: true,
      message: 'LOST deals ready for ECL upload using BATCH API with actual stage mapping',
      summary: {
        totalLostDealsFound: result.totalDealsFound,
        dealsRetrievedWithBatchAPI: result.totalDealsWithHistory,
        dealsWithValidHistory: result.dealsWithValidHistory,
        readyForECL: eclResult.conversions.length,
        totalECLValue: eclResult.validation.totalECLValue,
        averageECLValue: eclResult.validation.averageECLValue
      },
      batchInfo: {
        batchesProcessed: result.batchInfo.batchesProcessed,
        batchSize: result.batchInfo.batchSize,
        dateRangeLimited: 'Limited to 1 week for testing'
      },
      stageAnalysis: {
        stageDistribution: result.stageDistribution,
        validHistoryRate: result.dealsWithValidHistory > 0 ? 
          `${((result.dealsWithValidHistory / result.totalDealsFound) * 100).toFixed(1)}%` : '0%'
      },
      eclConversions: eclResult.conversions.slice(0, 5), // Sample
      eclValidation: eclResult.validation,
      validation: {
        dateRange: result.dateRange,
        stageMappingUsed: 'scripts/analytics/stage-map.json',
        batchAPIUsed: 'HubSpot Batch Read API for stage history',
        noGuessing: 'Only processes deals with actual stage history data'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ LOST deals batch preparation failed:', error.message);
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
    console.log('🚀 Processing LOST deals for ECL upload with BATCH API...');
    
    const result = await getLostDeals(hubspotClient);
    const eclResult = await exportLostDealsForECL(result.processedDeals);
    
    if (eclResult.conversions.length === 0) {
      return res.json({
        success: false,
        message: 'No LOST deals with valid stage history found for ECL upload',
        summary: {
          totalLostDeals: result.totalDealsFound,
          dealsWithGCLID: eclResult.validation.withGCLID,
          dealsSkippedNoHistory: eclResult.validation.skippedNoHistory,
          readyForUpload: 0
        },
        recommendation: 'Check date range, stage mapping, or HubSpot data quality',
        timestamp: new Date().toISOString()
      });
    }
    
    // Process through ECL handler
    const eclHandler = require('./ecl-handler');
    
    let processedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    console.log(`🎯 Starting ECL upload of ${eclResult.conversions.length} LOST deals with batch-retrieved stage data...`);
    
    for (const conversion of eclResult.conversions) {
      try {
        console.log(`Processing ECL: LOST DEAL (BATCH API)`);
        console.log(`   Deal Stage: ${conversion.stage_name} (${conversion.stage}) - ${(conversion.stage_probability * 100)}%`);
        console.log(`   Order ID: ${conversion.order_id}`);
        console.log(`   Value: EUR${conversion.conversion_value} (batch API + stage mapping)`);
        
        await eclHandler.processConversionAdjustment(conversion, {
          conversionType: 'lost_deal_batch_api',
          useActualStageData: true
        });
        
        processedCount++;
        
        if (processedCount % 5 === 0) {
          console.log(`   Processed ${processedCount}/${eclResult.conversions.length} LOST deals`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Failed to process LOST deal ${conversion.deal_id}: ${error.message}`);
        errorCount++;
        errors.push({
          dealId: conversion.deal_id,
          stageName: conversion.stage_name,
          eclValue: conversion.conversion_value,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: 'ECL LOST deals processing completed using BATCH API with stage mapping',
      summary: {
        totalLostDeals: result.totalDealsFound,
        processedSuccessfully: processedCount,
        errors: errorCount,
        successRate: `${((processedCount / eclResult.conversions.length) * 100).toFixed(1)}%`,
        totalECLValue: eclResult.validation.totalECLValue
      },
      batchInfo: {
        batchesProcessed: result.batchInfo.batchesProcessed,
        dealsPerBatch: result.batchInfo.batchSize
      },
      details: {
        conversionType: 'lost_deal_batch_api_with_stage_mapping',
        stageMappingUsed: 'scripts/analytics/stage-map.json',
        batchAPI: 'HubSpot Batch Read API for efficient stage history retrieval',
        conversionAction: '7264211475'
      },
      errors: errors.slice(0, 3),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ LOST deals batch ECL processing failed:', error.message);
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