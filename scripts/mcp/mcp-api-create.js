const { GoogleAdsApi, ResourceNames, enums, toMicros } = require('google-ads-api');
const path = require('path');

// Ensure environment variables are loaded
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/** ---------- Small util for timestamped logs ---------- */
const log = (...args) => console.log(new Date().toISOString(), ...args);

// Initialize Google Ads client
const googleAdsClient = new GoogleAdsApi({
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  developer_token: process.env.GAdsAPI
});

/**
 * Creates a new campaign by copying from a template campaign
 * Includes complete campaign structure: ad groups, keywords, and ads
 */
async function createCampaignFromTemplate({
  account_id = process.env.GADS_LIVE_ID,
  template_campaign_id,
  new_campaign_name,
  target_country_code,
  target_language_code = 'en',
  daily_budget_micros,
  copy_ad_groups = true,
  copy_keywords = true,
  copy_ads = true
}) {
  // Debug: Check for EuPoliticalAdvertisingStatus enum
  log('🔍 Checking for EuPoliticalAdvertisingStatus enum...');
  if (enums.EuPoliticalAdvertisingStatus) {
    log('✅ EuPoliticalAdvertisingStatus found:', enums.EuPoliticalAdvertisingStatus);
  } else {
    log('❌ EuPoliticalAdvertisingStatus not found in enums');
  }

  log('🚀 Campaign Creation called:', {
    account_id,
    template_campaign_id,
    new_campaign_name,
    target_country_code,
    target_language_code,
    daily_budget_micros,
    copy_ad_groups,
    copy_keywords,
    copy_ads
  });

  try {
    const customer = googleAdsClient.Customer({
      customer_id: account_id,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      login_customer_id: process.env.GADS_LIVE_MCC_ID
    });

    // Step 1: Get template campaign details
    log('📋 Fetching template campaign details...');
    const templateQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.advertising_channel_type,
        campaign.advertising_channel_sub_type,
        campaign.status,
        campaign.bidding_strategy_type,
        campaign.campaign_budget,
        campaign.network_settings.target_google_search,
        campaign.network_settings.target_search_network,
        campaign.network_settings.target_content_network,
        campaign.network_settings.target_partner_search_network,
        campaign.geo_target_type_setting.positive_geo_target_type,
        campaign.geo_target_type_setting.negative_geo_target_type
      FROM campaign
      WHERE campaign.id = ${template_campaign_id}
    `;

    const templateResults = await customer.query(templateQuery);
    if (templateResults.length === 0) {
      throw new Error(`Template campaign ${template_campaign_id} not found`);
    }

    const templateCampaign = templateResults[0].campaign;
    log('✅ Template campaign found:', templateCampaign.name);

    // Step 2: Create budget and campaign atomically using mutateResources
    log('💰 Creating campaign budget and campaign...');

    // Create a resource name with a temporary resource id (-1)
    const budgetResourceName = ResourceNames.campaignBudget(account_id, "-1");

    const operations = [
      {
        entity: "campaign_budget",
        operation: "create",
        resource: {
          resource_name: budgetResourceName,
          name: `Budget for ${new_campaign_name}`,
          delivery_method: enums.BudgetDeliveryMethod.STANDARD,
          amount_micros: daily_budget_micros || toMicros(50), // Default $50/day
          explicitly_shared: false
        }
      },
      {
        entity: "campaign",
        operation: "create",
        resource: {
          name: new_campaign_name,
          advertising_channel_type: templateCampaign.advertising_channel_type,
          status: enums.CampaignStatus.PAUSED, // Start paused for safety
          manual_cpc: {
            enhanced_cpc_enabled: false
          },
          campaign_budget: budgetResourceName, // Use the temporary resource id
          network_settings: {
            target_google_search: templateCampaign.network_settings?.target_google_search ?? true,
            target_search_network: templateCampaign.network_settings?.target_search_network ?? true,
            target_content_network: templateCampaign.network_settings?.target_content_network ?? false,
            target_partner_search_network: templateCampaign.network_settings?.target_partner_search_network ?? false
          }
        }
      }
    ];

    // Debug: Check API permissions first
    log('🔐 Testing API permissions...');
    try {
      // Test basic account access
      const permissionTestQuery = `
        SELECT customer.id, customer.descriptive_name, customer.manager
        FROM customer
        LIMIT 1
      `;
      const permissionTest = await customer.query(permissionTestQuery);
      log('✅ Basic account access working:', permissionTest[0]?.customer || 'No customer data');

      // Test if we can query campaigns (read permission)
      const campaignTestQuery = `
        SELECT campaign.id, campaign.name
        FROM campaign
        LIMIT 5
      `;
      const campaignTest = await customer.query(campaignTestQuery);
      log('✅ Campaign read access working:', campaignTest.length, 'campaigns found');

      // Test if we can query budgets (needed for campaign creation)
      const budgetTestQuery = `
        SELECT campaign_budget.id, campaign_budget.name
        FROM campaign_budget
        LIMIT 5
      `;
      const budgetTest = await customer.query(budgetTestQuery);
      log('✅ Budget read access working:', budgetTest.length, 'budgets found');

    } catch (permissionError) {
      log('❌ API Permission test failed:', permissionError.message);
      log('❌ Permission error details:', JSON.stringify(permissionError, null, 2));
      throw new Error(`API Permission Error: ${permissionError.message}`);
    }

    log('🔄 Attempting mutateResources with operations:', JSON.stringify(operations, null, 2));

    let mutateResponse;
    try {
      // Try alternative approach using individual mutations instead of mutateResources
      log('🔄 Trying alternative campaign creation approach...');

      // First create budget separately
      const budgetOperation = operations[0];
      const budgetResponse = await customer.campaignBudgets.create([{
        name: budgetOperation.resource.name,
        delivery_method: budgetOperation.resource.delivery_method,
        amount_micros: budgetOperation.resource.amount_micros,
        explicitly_shared: budgetOperation.resource.explicitly_shared
      }]);

      const actualBudgetResourceName = budgetResponse.results[0].resource_name;
      log('✅ Budget created:', actualBudgetResourceName);

      // Then create campaign with the actual budget resource name
      const campaignOperation = operations[1];
      campaignOperation.resource.campaign_budget = actualBudgetResourceName;

      // Add required EU political advertising field using proper enum
      campaignOperation.resource.contains_eu_political_advertising = enums.EuPoliticalAdvertisingStatus.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING;

      const campaignResponse = await customer.campaigns.create([campaignOperation.resource]);
      log('✅ Campaign created successfully:', JSON.stringify(campaignResponse, null, 2));

      mutateResponse = {
        results: [
          { resource_name: actualBudgetResourceName },
          { resource_name: campaignResponse.results[0].resource_name }
        ]
      };
    } catch (mutateError) {
      log('❌ MutateResources failed:', mutateError.message);
      log('❌ MutateResources stack:', mutateError.stack);
      log('❌ MutateResources full error:', JSON.stringify(mutateError, null, 2));

      // Additional debugging for specific error types
      if (mutateError.details) {
        log('❌ MutateResources error details:', JSON.stringify(mutateError.details, null, 2));
      }
      if (mutateError.metadata) {
        log('❌ MutateResources error metadata:', JSON.stringify(mutateError.metadata, null, 2));
      }
      if (mutateError.errors) {
        log('❌ MutateResources specific errors:');
        mutateError.errors.forEach((error, index) => {
          log(`   Error ${index + 1}:`, JSON.stringify(error, null, 2));
        });
      }
      throw mutateError;
    }

    // Extract the created resources
    const newBudgetResourceName = mutateResponse.results[0].resource_name;
    const newCampaignResourceName = mutateResponse.results[1].resource_name;
    const newCampaignId = newCampaignResourceName.split('/')[3];

    log('✅ Budget and campaign created:', { budgetResourceName: newBudgetResourceName, campaignResourceName: newCampaignResourceName });

    // Step 3: Add geo and language targeting
    log('🌍 Adding geo and language targeting...');
    const targetingOperations = [
      {
        entity: "campaign_criterion",
        operation: "create",
        resource: {
          campaign: newCampaignResourceName,
          location: {
            geo_target_constant: `geoTargetConstants/${getCountryCriterionId(target_country_code)}`
          }
        }
      },
      {
        entity: "campaign_criterion",
        operation: "create",
        resource: {
          campaign: newCampaignResourceName,
          language: {
            language_constant: `languageConstants/${getLanguageCriterionId(target_language_code)}`
          }
        }
      }
    ];

    await customer.mutateResources(targetingOperations);
    log('✅ Geo and language targeting added:', { country: target_country_code, language: target_language_code });

    let copiedAssets = {
      ad_groups: 0,
      keywords: 0,
      ads: 0
    };

    // Step 6: Copy ad groups if requested
    if (copy_ad_groups) {
      log('📁 Copying ad groups from template...');
      const adGroupsQuery = `
        SELECT
          ad_group.id,
          ad_group.name,
          ad_group.status,
          ad_group.type,
          ad_group.cpc_bid_micros
        FROM ad_group
        WHERE ad_group.campaign = 'customers/${account_id}/campaigns/${template_campaign_id}'
      `;

      const adGroupResults = await customer.query(adGroupsQuery);

      for (const result of adGroupResults) {
        const templateAdGroup = result.ad_group;
        const adGroupOperations = [
          {
            entity: 'ad_group',
            operation: 'create',
            resource: {
              name: `${templateAdGroup.name} - ${target_country_code}`,
              campaign: newCampaignResourceName,
              status: 'PAUSED',
              type: templateAdGroup.type,
              cpc_bid_micros: templateAdGroup.cpc_bid_micros
            }
          }
        ];

        const adGroupResponse = await customer.mutateResources(adGroupOperations);
        const newAdGroupResourceName = adGroupResponse.results[0].resource_name;
        copiedAssets.ad_groups++;

        log(`✅ Ad group copied: ${templateAdGroup.name} -> ${newAdGroupResourceName}`);

        // Step 7: Copy keywords for this ad group if requested
        if (copy_keywords) {
          log(`🔑 Copying keywords for ad group: ${templateAdGroup.name}`);
          const keywordsQuery = `
            SELECT
              ad_group_criterion.keyword.text,
              ad_group_criterion.keyword.match_type,
              ad_group_criterion.status,
              ad_group_criterion.cpc_bid_micros,
              ad_group_criterion.negative
            FROM ad_group_criterion
            WHERE ad_group_criterion.ad_group = 'customers/${account_id}/adGroups/${templateAdGroup.id}'
            AND ad_group_criterion.type = 'KEYWORD'
          `;

          const keywordResults = await customer.query(keywordsQuery);

          for (const keywordResult of keywordResults) {
            const criterion = keywordResult.ad_group_criterion;
            const keywordOperations = [
              {
                entity: 'ad_group_criterion',
                operation: 'create',
                resource: {
                  ad_group: newAdGroupResourceName,
                  keyword: {
                    text: criterion.keyword.text,
                    match_type: criterion.keyword.match_type
                  },
                  status: 'PAUSED',
                  cpc_bid_micros: criterion.cpc_bid_micros,
                  negative: criterion.negative || false
                }
              }
            ];

            try {
              const keywordResponse = await customer.mutateResources(keywordOperations);
              copiedAssets.keywords++;
              log(`✅ Keyword copied: "${criterion.keyword.text}" (${criterion.keyword.match_type})`);
            } catch (keywordError) {
              log(`⚠️ Failed to copy keyword "${criterion.keyword.text}": ${keywordError.message}`);
            }
          }
        }

        // Step 8: Copy ads for this ad group if requested
        if (copy_ads) {
          log(`📢 Copying ads for ad group: ${templateAdGroup.name}`);
          const adsQuery = `
            SELECT
              ad_group_ad.ad.id,
              ad_group_ad.ad.type,
              ad_group_ad.ad.expanded_text_ad.headline_part1,
              ad_group_ad.ad.expanded_text_ad.headline_part2,
              ad_group_ad.ad.expanded_text_ad.headline_part3,
              ad_group_ad.ad.expanded_text_ad.description,
              ad_group_ad.ad.expanded_text_ad.description2,
              ad_group_ad.ad.expanded_text_ad.path1,
              ad_group_ad.ad.expanded_text_ad.path2,
              ad_group_ad.ad.responsive_search_ad.headlines,
              ad_group_ad.ad.responsive_search_ad.descriptions,
              ad_group_ad.ad.final_urls,
              ad_group_ad.status
            FROM ad_group_ad
            WHERE ad_group_ad.ad_group = 'customers/${account_id}/adGroups/${templateAdGroup.id}'
          `;

          const adResults = await customer.query(adsQuery);

          for (const adResult of adResults) {
            const templateAd = adResult.ad_group_ad.ad;

            try {
              let adResource = {
                ad_group: newAdGroupResourceName,
                status: 'PAUSED',
                ad: {
                  final_urls: templateAd.final_urls || []
                }
              };

              // Handle different ad types
              if (templateAd.type === 'EXPANDED_TEXT_AD' && templateAd.expanded_text_ad) {
                adResource.ad.expanded_text_ad = {
                  headline_part1: templateAd.expanded_text_ad.headline_part1,
                  headline_part2: templateAd.expanded_text_ad.headline_part2,
                  description: templateAd.expanded_text_ad.description
                };

                if (templateAd.expanded_text_ad.headline_part3) {
                  adResource.ad.expanded_text_ad.headline_part3 = templateAd.expanded_text_ad.headline_part3;
                }
                if (templateAd.expanded_text_ad.description2) {
                  adResource.ad.expanded_text_ad.description2 = templateAd.expanded_text_ad.description2;
                }
                if (templateAd.expanded_text_ad.path1) {
                  adResource.ad.expanded_text_ad.path1 = templateAd.expanded_text_ad.path1;
                }
                if (templateAd.expanded_text_ad.path2) {
                  adResource.ad.expanded_text_ad.path2 = templateAd.expanded_text_ad.path2;
                }
              } else if (templateAd.type === 'RESPONSIVE_SEARCH_AD' && templateAd.responsive_search_ad) {
                adResource.ad.responsive_search_ad = {
                  headlines: templateAd.responsive_search_ad.headlines || [],
                  descriptions: templateAd.responsive_search_ad.descriptions || []
                };
              } else {
                log(`⚠️ Unsupported ad type: ${templateAd.type}, skipping...`);
                continue;
              }

              const adOperations = [
                {
                  entity: 'ad_group_ad',
                  operation: 'create',
                  resource: adResource
                }
              ];

              const adResponse = await customer.mutateResources(adOperations);
              copiedAssets.ads++;
              log(`✅ Ad copied: ${templateAd.type} (${templateAd.expanded_text_ad?.headline_part1 || templateAd.responsive_search_ad?.headlines?.[0]?.text || 'Unknown headline'})`);
            } catch (adError) {
              log(`⚠️ Failed to copy ad ${templateAd.id}: ${adError.message}`);
            }
          }
        }
      }
    }

    return {
      success: true,
      campaign_id: newCampaignId,
      campaign_resource_name: newCampaignResourceName,
      budget_resource_name: newBudgetResourceName,
      template_campaign_id,
      copied_assets: copiedAssets,
      target_country: target_country_code,
      target_language: target_language_code,
      status: 'PAUSED',
      report: `✅ **Campaign Created Successfully!**

**New Campaign:** ${new_campaign_name}
**Campaign ID:** ${newCampaignId}
**Status:** PAUSED (safe start)
**Target Country:** ${target_country_code}
**Target Language:** ${target_language_code}

**Copied from Template Campaign ID:** ${template_campaign_id}

**Assets Copied:**
- 📁 Ad Groups: ${copiedAssets.ad_groups}
- 🔑 Keywords: ${copiedAssets.keywords}
- 📢 Ads: ${copiedAssets.ads}

**Next Steps:**
1. Review campaign settings in Google Ads interface
2. Adjust targeting and demographics as needed
3. Enable campaign when ready (currently PAUSED)
4. Monitor performance and optimize

The campaign is created but PAUSED for your safety. You can enable it when ready.`
    };

  } catch (error) {
    log('❌ Campaign creation failed:', error.message);
    log('❌ Full error stack:', error.stack);
    log('❌ Full error object:', JSON.stringify(error, null, 2));
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      report: `❌ **Campaign Creation Failed:**

**Error:** ${error.message}

**Possible causes:**
- Insufficient Google Ads API permissions
- Invalid template campaign ID
- Account lacks campaign creation privileges
- Billing issues or account restrictions

**Please check:**
1. Google Ads API access level
2. Account permissions for campaign creation
3. Template campaign exists and is accessible
4. Account has active billing setup`
    };
  }
}

/**
 * Helper function to get country criterion ID for geo targeting
 */
function getCountryCriterionId(countryCode) {
  const countryCodes = {
    'ES': 2724,  // Spain
    'IT': 2380,  // Italy
    'FR': 2250,  // France
    'DE': 2276,  // Germany
    'UK': 2826,  // United Kingdom
    'US': 2840,  // United States
    'IE': 2372,  // Ireland
    'PT': 2620,  // Portugal
    'NL': 2528,  // Netherlands
    'BE': 2056,  // Belgium
    'AT': 2040,  // Austria
    'CH': 2756,  // Switzerland
    'PL': 2616,  // Poland
    'CZ': 2203,  // Czech Republic
    'BR': 2076,  // Brazil
    'MX': 2484,  // Mexico
    'AR': 2032,  // Argentina
    'CO': 2170,  // Colombia
    'CL': 2152,  // Chile
    'PE': 2604   // Peru
  };

  return countryCodes[countryCode.toUpperCase()] || 2380; // Default to Italy
}

/**
 * Helper function to get language criterion ID for language targeting
 */
function getLanguageCriterionId(languageCode) {
  const languageCodes = {
    'en': 1000,  // English
    'es': 1003,  // Spanish
    'it': 1004,  // Italian
    'fr': 1002,  // French
    'de': 1001,  // German
    'pt': 1014,  // Portuguese
    'nl': 1010,  // Dutch
    'pl': 1013,  // Polish
    'cs': 1009   // Czech
  };

  return languageCodes[languageCode.toLowerCase()] || 1000; // Default to English
}

/**
 * Updates the daily budget of an existing campaign
 */
async function updateCampaignBudget({
  account_id = process.env.GADS_LIVE_ID,
  campaign_id,
  daily_budget_micros
}) {
  log('🔧 Campaign Budget Update called:', {
    account_id,
    campaign_id,
    daily_budget_micros
  });

  try {
    const customer = googleAdsClient.Customer({
      customer_id: account_id,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      login_customer_id: process.env.GADS_LIVE_MCC_ID
    });

    // Step 1: Get current campaign details including budget resource name
    log('📋 Fetching current campaign details...');
    const campaignQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.campaign_budget
      FROM campaign
      WHERE campaign.id = ${campaign_id}
    `;

    const campaignResults = await customer.query(campaignQuery);
    if (campaignResults.length === 0) {
      throw new Error(`Campaign ${campaign_id} not found`);
    }

    const campaign = campaignResults[0].campaign;
    log('✅ Campaign found:', campaign.name);
    log('💰 Budget resource name:', campaign.campaign_budget);

    // Step 1.5: Get budget details separately
    const budgetQuery = `
      SELECT
        campaign_budget.id,
        campaign_budget.name,
        campaign_budget.amount_micros,
        campaign_budget.resource_name
      FROM campaign_budget
      WHERE campaign_budget.resource_name = '${campaign.campaign_budget}'
    `;

    const budgetResults = await customer.query(budgetQuery);
    if (budgetResults.length === 0) {
      throw new Error(`Budget for campaign ${campaign_id} not found`);
    }

    const currentBudget = budgetResults[0].campaign_budget;
    log('✅ Budget found:', currentBudget.name);
    log('💰 Current budget:', `€${(currentBudget.amount_micros / 1000000).toFixed(2)}/day`);

    // Step 2: Update the budget
    log('💰 Updating campaign budget...');
    const budgetUpdateOperation = {
      resource_name: campaign.campaign_budget,
      amount_micros: daily_budget_micros
    };

    const budgetResponse = await customer.campaignBudgets.update(
      [budgetUpdateOperation],
      {
        updateMask: {
          paths: ['amount_micros']
        }
      }
    );
    log('✅ Budget updated successfully:', JSON.stringify(budgetResponse, null, 2));

    return {
      success: true,
      campaign_id,
      campaign_name: campaign.name,
      old_budget_micros: currentBudget.amount_micros,
      new_budget_micros: daily_budget_micros,
      old_budget_eur: (currentBudget.amount_micros / 1000000).toFixed(2),
      new_budget_eur: (daily_budget_micros / 1000000).toFixed(2),
      report: `✅ **Campaign Budget Updated Successfully!**

**Campaign:** ${campaign.name}
**Campaign ID:** ${campaign_id}

**Budget Change:**
- **Previous Budget:** €${(currentBudget.amount_micros / 1000000).toFixed(2)}/day
- **New Budget:** €${(daily_budget_micros / 1000000).toFixed(2)}/day
- **Change:** €${((daily_budget_micros - currentBudget.amount_micros) / 1000000).toFixed(2)}/day

**Next Steps:**
1. Monitor campaign performance with new budget
2. Adjust bids if necessary based on increased/decreased budget
3. Review daily spend patterns

The budget change is effective immediately.`
    };

  } catch (error) {
    log('❌ Campaign budget update failed:', error.message);
    log('❌ Full error stack:', error.stack);
    log('❌ Full error object:', JSON.stringify(error, null, 2));
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      report: `❌ **Campaign Budget Update Failed:**

**Error:** ${error.message}

**Possible causes:**
- Invalid campaign ID
- Insufficient Google Ads API permissions
- Campaign budget is shared across multiple campaigns
- Account lacks campaign modification privileges

**Please check:**
1. Campaign ID is correct and exists
2. Google Ads API access level includes campaign modification
3. Account has active billing setup
4. Budget is not shared with other campaigns`
    };
  }
}

/**
 * Updates campaign status (enable/pause)
 */
async function updateCampaignStatus({
  account_id = process.env.GADS_LIVE_ID,
  campaign_id,
  status // 'ENABLED', 'PAUSED', or 'REMOVED'
}) {
  log('🔧 Campaign Status Update called:', {
    account_id,
    campaign_id,
    status
  });

  try {
    const customer = googleAdsClient.Customer({
      customer_id: account_id,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      login_customer_id: process.env.GADS_LIVE_MCC_ID
    });

    // Step 1: Get current campaign details
    log('📋 Fetching current campaign details...');
    const campaignQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status
      FROM campaign
      WHERE campaign.id = ${campaign_id}
    `;

    const campaignResults = await customer.query(campaignQuery);
    if (campaignResults.length === 0) {
      throw new Error(`Campaign ${campaign_id} not found`);
    }

    const campaign = campaignResults[0].campaign;
    log('✅ Campaign found:', campaign.name);
    log('📊 Current status:', campaign.status);

    // Step 2: Update the status
    log(`🔄 Updating campaign status to ${status}...`);
    const campaignResourceName = `customers/${account_id}/campaigns/${campaign_id}`;

    const statusUpdateOperation = {
      update: {
        resource_name: campaignResourceName,
        status: enums.CampaignStatus[status]
      },
      update_mask: {
        paths: ['status']
      }
    };

    const statusResponse = await customer.campaigns.update([statusUpdateOperation]);
    log('✅ Status updated successfully:', JSON.stringify(statusResponse, null, 2));

    const statusEmoji = {
      'ENABLED': '▶️',
      'PAUSED': '⏸️',
      'REMOVED': '🗑️'
    };

    return {
      success: true,
      campaign_id,
      campaign_name: campaign.name,
      old_status: campaign.status,
      new_status: status,
      report: `✅ **Campaign Status Updated Successfully!**

**Campaign:** ${campaign.name}
**Campaign ID:** ${campaign_id}

**Status Change:**
- **Previous Status:** ${campaign.status}
- **New Status:** ${statusEmoji[status]} ${status}

**Next Steps:**
${status === 'ENABLED' ?
  '1. Monitor campaign performance and spend\n2. Review targeting and bids\n3. Check for any approval issues' :
  status === 'PAUSED' ?
  '1. Campaign will stop serving ads immediately\n2. No new costs will be incurred\n3. Can be re-enabled anytime' :
  '1. Campaign has been removed\n2. Historical data is preserved\n3. Cannot be re-enabled (create new campaign instead)'
}

The status change is effective immediately.`
    };

  } catch (error) {
    log('❌ Campaign status update failed:', error.message);
    log('❌ Full error stack:', error.stack);
    log('❌ Full error object:', JSON.stringify(error, null, 2));
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      report: `❌ **Campaign Status Update Failed:**

**Error:** ${error.message}

**Possible causes:**
- Invalid campaign ID
- Insufficient Google Ads API permissions
- Invalid status value
- Account lacks campaign modification privileges

**Please check:**
1. Campaign ID is correct and exists
2. Status is one of: ENABLED, PAUSED, REMOVED
3. Google Ads API access level includes campaign modification
4. Account permissions for campaign management`
    };
  }
}

module.exports = {
  createCampaignFromTemplate,
  updateCampaignBudget,
  updateCampaignStatus,
  getCountryCriterionId,
  getLanguageCriterionId,
  googleAdsClient // Export client for future extensions
};