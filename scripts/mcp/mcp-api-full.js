/**
 * Full Google Ads API Access - Universal Query and Write Operations
 * Path: /home/hub/public_html/gads/scripts/mcp/mcp-api-full.js
 * 
 * SAFETY ARCHITECTURE:
 * - Universal Query: READ-ONLY, safe for all analysis
 * - Universal Write: DANGEROUS, requires explicit confirmation
 * 
 * This provides complete access to the Google Ads API
 * Use queries freely, use writes with extreme caution
 */

const { GoogleAdsApi } = require('google-ads-api');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const log = (...args) => console.log(new Date().toISOString(), ...args);

// Initialize Google Ads client
const googleAdsClient = new GoogleAdsApi({
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  developer_token: process.env.GAdsAPI
});

/**
 * Universal Query Access - READ ONLY - SAFE FOR ALL ANALYSIS
 * Execute any GAQL query for data analysis
 */
async function universalGoogleAdsQuery({
  account_id = process.env.GADS_LIVE_ID,
  query,  // GAQL query string
  limit = 1000
}) {

  log('📊 Universal Query:', {
    account_id,
    query_preview: query.substring(0, 150) + '...'
  });

  // Add timeout wrapper
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Query timeout after 30 seconds')), 30000)
  );

  try {
    const customer = googleAdsClient.Customer({
      customer_id: account_id,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      login_customer_id: process.env.GADS_LIVE_MCC_ID
    });

    // Add safety limit if not present
    if (!query.toLowerCase().includes('limit')) {
      query += ` LIMIT ${limit}`;
    }

    // Execute query with timeout
    const queryPromise = customer.query(query);
    const results = await Promise.race([queryPromise, timeoutPromise]);
    
    log(`✅ Query returned ${results.length} results`);
    
    return {
      success: true,
      data: results,
      count: results.length,
      report: `✅ **Query Executed Successfully**
      
**Results:** ${results.length} rows returned
**Query:** \`\`\`sql
${query}
\`\`\`

✅ This was a READ-ONLY operation. No changes were made to the account.`
    };

  } catch (error) {
    log('❌ Query failed:', error.message);
    return {
      success: false,
      error: error.message,
      report: `❌ **Query Failed**
      
**Error:** ${error.message}

**Query:** \`\`\`sql
${query}
\`\`\`

Please check your GAQL syntax and try again.
Common issues:
- Invalid field names
- Missing FROM clause
- Incorrect resource relationships`
    };
  }
}

/**
 * Convert match_type strings to enum values for keyword operations
 * Also flattens criterion.keyword to just keyword at top level
 */
function normalizeKeywordMatchType(operations, resource_type) {
  if (resource_type !== 'adGroupCriteria' && resource_type !== 'keywords' && resource_type !== 'campaignCriteria') {
    return operations;
  }

  const { enums } = require('google-ads-api');

  const normalized = operations.map(op => {
    let result = { ...op };

    // Handle nested criterion.keyword structure - flatten it
    if (op.criterion && op.criterion.keyword) {
      log('🔄 Flattening criterion.keyword structure');
      result = {
        ...result,
        keyword: op.criterion.keyword
      };
      delete result.criterion;
    }

    // Convert string match type to enum value
    if (result.keyword && result.keyword.match_type) {
      const matchType = result.keyword.match_type;
      if (typeof matchType === 'string') {
        const matchTypeEnum = enums.KeywordMatchType[matchType.toUpperCase()];
        if (matchTypeEnum !== undefined) {
          log(`🔄 Converting match_type: "${matchType}" → ${matchTypeEnum}`);
          result.keyword = {
            ...result.keyword,
            match_type: matchTypeEnum
          };
        } else {
          log(`⚠️ Unknown match_type string: "${matchType}"`);
        }
      }
    }

    return result;
  });

  return normalized;
}

/**
 * Universal Write Access to Google Ads API
 * ⚠️ DANGEROUS - THIS CAN MODIFY ANYTHING IN YOUR ACCOUNT
 * Requires explicit confirmation via confirm_danger parameter
 */
async function universalGoogleAdsWrite({
  account_id = process.env.GADS_LIVE_ID,
  resource_type,    // 'adGroups', 'keywords', 'ads', etc.
  operation_type,   // 'create', 'update', 'remove', 'mutate'
  operations,       // Array of operations
  confirm_danger = false  // Must be explicitly set to true
}) {
  
  // SAFETY CHECK - Require explicit confirmation
  if (!confirm_danger) {
    log('⚠️ Write operation blocked - no confirmation');
    return {
      success: false,
      error: 'Safety confirmation required',
      report: `⚠️ **Universal Write Access Blocked - Safety Check**
      
This is a DANGEROUS operation that will modify your Google Ads account.

**What you're trying to do:**
- Resource: ${resource_type}
- Operation: ${operation_type}
- Number of changes: ${operations?.length || 0}

**To proceed, you must:**
1. Review the operations carefully
2. Set 'confirm_danger' parameter to true
3. Re-run the command

**Example:**
\`\`\`javascript
{
  resource_type: '${resource_type}',
  operation_type: '${operation_type}',
  operations: [...],
  confirm_danger: true  // ← Add this
}
\`\`\`

This safety check prevents accidental modifications.`
    };
  }

  // Normalize keyword match types from strings to enum values
  operations = normalizeKeywordMatchType(operations, resource_type);

  log('⚠️ EXECUTING UNIVERSAL WRITE OPERATION:', {
    account_id,
    resource_type,
    operation_type,
    operations_count: operations?.length
  });

  // Log the actual operations for audit trail
  log('📝 Operation details:', JSON.stringify(operations, null, 2));

  // Add timeout wrapper for write operations
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Write operation timeout after 60 seconds')), 60000)
  );

  try {
    const customer = googleAdsClient.Customer({
      customer_id: account_id,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      login_customer_id: process.env.GADS_LIVE_MCC_ID
    });

    let response;
    
    // Map resource types to proper API endpoints
    const resourceMap = {
      'adGroups': 'adGroups',
      'ad_groups': 'adGroups',
      'keywords': 'adGroupCriteria',
      'adGroupCriteria': 'adGroupCriteria',
      'ads': 'adGroupAds',
      'adGroupAds': 'adGroupAds',
      'campaigns': 'campaigns',
      'campaignBudgets': 'campaignBudgets',
      'campaign_budgets': 'campaignBudgets',
      'campaignCriteria': 'campaignCriteria',
      'campaign_criteria': 'campaignCriteria',
      'assets': 'assets',
      'assetGroups': 'assetGroups',
      'asset_groups': 'assetGroups',
      'assetGroupAssets': 'assetGroupAssets',
      'asset_group_assets': 'assetGroupAssets',
      'audiences': 'audiences',
      'userLists': 'userLists',
      'user_lists': 'userLists',
      'conversionActions': 'conversionActions',
      'conversion_actions': 'conversionActions',
      'campaignAssets': 'campaignAssets',
      'campaign_asset': 'campaignAssets'
    };

    const mappedResource = resourceMap[resource_type] || resource_type;

    // Handle different operation types
    switch(operation_type) {
      case 'create':
        if (!customer[mappedResource]) {
          throw new Error(`Resource type '${resource_type}' not found. Valid types: ${Object.keys(resourceMap).join(', ')}`);
        }
        const createPromise = customer[mappedResource].create(operations);
        response = await Promise.race([createPromise, timeoutPromise]);
        break;
      
      case 'update':
        if (!customer[mappedResource]) {
          throw new Error(`Resource type '${resource_type}' not found`);
        }
        const updatePromise = customer[mappedResource].update(operations);
        response = await Promise.race([updatePromise, timeoutPromise]);
        break;
      
      case 'remove':
        if (!customer[mappedResource]) {
          throw new Error(`Resource type '${resource_type}' not found`);
        }
        const removePromise = customer[mappedResource].remove(operations);
        response = await Promise.race([removePromise, timeoutPromise]);
        break;
      
      case 'mutate':
        // For complex multi-resource operations
        const mutatePromise = customer.mutateResources(operations);
        response = await Promise.race([mutatePromise, timeoutPromise]);
        break;
      
      default:
        throw new Error(`Unknown operation type: ${operation_type}. Valid types: create, update, remove, mutate`);
    }

    log('✅ Universal write operation successful');
    log('📊 Response:', JSON.stringify(response, null, 2));
    
    // Build detailed report
    const createdResources = response?.results?.map(r => r.resource_name) || [];
    
    return {
      success: true,
      data: response,
      created_resources: createdResources,
      report: `✅ **Universal Write Operation Completed Successfully**
      
**Resource Type:** ${resource_type}
**Operation:** ${operation_type}
**Status:** SUCCESS

**Results:**
- Items processed: ${response?.results?.length || 0}
- Resource names created/modified:
${createdResources.map(r => `  - ${r}`).join('\n')}

**Raw Response:**
\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\`

⚠️ **Important:**
- Changes have been applied to your Google Ads account
- Please verify the changes in the Google Ads UI
- These changes may take a few minutes to propagate

**Timestamp:** ${new Date().toISOString()}`
    };

  } catch (error) {
    log('❌ Universal write operation failed:', error.message);
    log('❌ Error details:', JSON.stringify(error, null, 2));
    log('❌ Error stack:', error.stack);

    // Extract error message - handle Google Ads API error formats
    let errorMsg = 'Unknown error';

    if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
      // Google Ads API error format
      const firstError = error.errors[0];
      errorMsg = firstError.message || JSON.stringify(firstError.error_code);

      // Add details about all errors if multiple
      if (error.errors.length > 1) {
        errorMsg += ` (and ${error.errors.length - 1} more errors)`;
      }
    } else if (error.message) {
      errorMsg = error.message;
    } else if (error.error?.message) {
      errorMsg = error.error.message;
    } else {
      errorMsg = JSON.stringify(error);
    }

    return {
      success: false,
      error: errorMsg,
      report: `❌ **Universal Write Operation Failed**

**Error:** ${errorMsg}

**Attempted Operation:**
- Resource: ${resource_type}
- Operation: ${operation_type}
- Operations count: ${operations?.length || 0}

**Common Issues:**
- Invalid resource type (check spelling)
- Missing required fields in operations
- Invalid resource names or IDs
- Insufficient permissions
- Billing/budget restrictions

**Debug Information:**
\`\`\`
Resource Type: ${resource_type}
Operation Type: ${operation_type}
Operations: ${JSON.stringify(operations, null, 2)}
\`\`\`

Please review the error and try again.`
    };
  }
}

/**
 * Helper function to list available resource types
 */
function getAvailableResourceTypes() {
  return {
    resources: [
      'campaigns',
      'campaignBudgets',
      'adGroups',
      'adGroupCriteria',  // Keywords
      'adGroupAds',       // Ads
      'assets',
      'audiences',
      'userLists',
      'campaignCriteria',
      'conversionActions',
      'biddingStrategies',
      'extensionFeedItems',
      'labels'
    ],
    operations: ['create', 'update', 'remove', 'mutate'],
    report: `Available Google Ads API Resources:
    
**Campaign Level:**
- campaigns
- campaignBudgets
- campaignCriteria (targeting)

**Ad Group Level:**
- adGroups
- adGroupCriteria (keywords)
- adGroupAds (ads)

**Account Level:**
- assets
- audiences
- userLists
- conversionActions
- biddingStrategies

**Operations:**
- create: Add new items
- update: Modify existing items
- remove: Delete items
- mutate: Complex multi-resource operations`
  };
}

/**
 * Create Responsive Search Ad (RSA)
 * The most common ad type for Google Ads campaigns
 */
async function createResponsiveSearchAd({
  account_id = process.env.GADS_LIVE_ID,
  ad_group_id,
  headlines = [],
  descriptions = [],
  final_urls = [],
  path1 = '',
  path2 = '',
  status = 'ENABLED'
}) {

  log('📝 Creating Responsive Search Ad:', {
    account_id,
    ad_group_id,
    headlines_count: headlines.length,
    descriptions_count: descriptions.length
  });

  // Validation
  if (!ad_group_id) {
    return {
      success: false,
      error: 'ad_group_id is required',
      report: `❌ **Ad Creation Failed**

**Error:** ad_group_id is required

**Required Parameters:**
- ad_group_id: ID of the ad group where the ad will be created
- headlines: Array of headline texts (minimum 3, maximum 15)
- descriptions: Array of description texts (minimum 2, maximum 4)
- final_urls: Array of landing page URLs`
    };
  }

  if (headlines.length < 3 || headlines.length > 15) {
    return {
      success: false,
      error: 'Headlines must be between 3 and 15',
      report: `❌ **Ad Creation Failed**

**Error:** Responsive Search Ads require between 3 and 15 headlines
**Current:** ${headlines.length} headlines provided

**Requirements:**
- Headlines: 3-15 (each max 30 characters)
- Descriptions: 2-4 (each max 90 characters)`
    };
  }

  if (descriptions.length < 2 || descriptions.length > 4) {
    return {
      success: false,
      error: 'Descriptions must be between 2 and 4',
      report: `❌ **Ad Creation Failed**

**Error:** Responsive Search Ads require between 2 and 4 descriptions
**Current:** ${descriptions.length} descriptions provided`
    };
  }

  if (final_urls.length === 0) {
    return {
      success: false,
      error: 'At least one final_url is required',
      report: `❌ **Ad Creation Failed**

**Error:** At least one landing page URL is required`
    };
  }

  const operations = [{
    adGroup: `customers/${account_id}/adGroups/${ad_group_id}`,
    status: status,
    ad: {
      finalUrls: final_urls,
      responsiveSearchAd: {
        headlines: headlines.map(text => ({ text })),
        descriptions: descriptions.map(text => ({ text })),
        path1: path1,
        path2: path2
      }
    }
  }];

  return await universalGoogleAdsWrite({
    account_id,
    resource_type: 'adGroupAds',
    operation_type: 'create',
    operations,
    confirm_danger: true
  });
}

/**
 * Create Sitelink Asset (Ad Extension)
 * Provides additional links below your main ad
 */
async function createSitelinkAsset({
  account_id = process.env.GADS_LIVE_ID,
  link_text,
  final_urls = [],
  description1 = '',
  description2 = ''
}) {

  log('🔗 Creating Sitelink Asset:', {
    account_id,
    link_text,
    final_urls_count: final_urls.length
  });

  if (!link_text || final_urls.length === 0) {
    return {
      success: false,
      error: 'link_text and final_urls are required',
      report: `❌ **Sitelink Asset Creation Failed**

**Error:** link_text and final_urls are required

**Required:**
- link_text: Visible text for the sitelink (max 25 characters)
- final_urls: Array of destination URLs

**Optional:**
- description1: First description line (max 35 characters)
- description2: Second description line (max 35 characters)`
    };
  }

  const operations = [{
    type: 'SITELINK',
    name: `Sitelink: ${link_text}`,
    final_urls: final_urls,  // At Asset level
    sitelink_asset: {
      link_text: link_text,
      description1: description1,
      description2: description2
    }
  }];

  return await universalGoogleAdsWrite({
    account_id,
    resource_type: 'assets',
    operation_type: 'create',
    operations,
    confirm_danger: true
  });
}

/**
 * Create Callout Asset (Ad Extension)
 * Short promotional text that appears with your ad
 */
async function createCalloutAsset({
  account_id = process.env.GADS_LIVE_ID,
  text
}) {

  log('📢 Creating Callout Asset:', {
    account_id,
    text
  });

  if (!text) {
    return {
      success: false,
      error: 'text is required',
      report: `❌ **Callout Asset Creation Failed**

**Error:** text is required

**Requirements:**
- text: Callout text (max 25 characters)
- Non-clickable promotional text
- Examples: "Free Shipping", "24/7 Support", "Best Price"`
    };
  }

  const operations = [{
    type: 'CALLOUT',
    name: `Callout: ${text}`,
    callout_asset: {
      callout_text: text
    }
  }];

  return await universalGoogleAdsWrite({
    account_id,
    resource_type: 'assets',
    operation_type: 'create',
    operations,
    confirm_danger: true
  });
}

/**
 * Create Structured Snippet Asset (Ad Extension)
 * Organized list of features, brands, or services
 */
async function createStructuredSnippetAsset({
  account_id = process.env.GADS_LIVE_ID,
  header,
  values = []
}) {

  log('📋 Creating Structured Snippet Asset:', {
    account_id,
    header,
    values_count: values.length
  });

  const validHeaders = [
    'AMENITIES', 'BRANDS', 'COURSES', 'DEGREE_PROGRAMS', 'DESTINATIONS',
    'FEATURED_HOTELS', 'INSURANCE_COVERAGE', 'NEIGHBORHOODS', 'SERVICE_CATALOG',
    'SERVICES', 'SHOWS', 'STYLES', 'TYPES'
  ];

  if (!header || !validHeaders.includes(header)) {
    return {
      success: false,
      error: `Invalid header. Must be one of: ${validHeaders.join(', ')}`,
      report: `❌ **Structured Snippet Asset Creation Failed**

**Error:** Invalid header "${header}"

**Valid Headers:**
${validHeaders.map(h => `- ${h}`).join('\n')}

**For ULearn English School, consider:**
- COURSES: ["General English", "IELTS Preparation", "Business English"]
- SERVICES: ["Online Classes", "Work & Study Program", "Accommodation"]
- AMENITIES: ["WiFi", "Student Lounge", "Library"]`
    };
  }

  if (values.length < 3) {
    return {
      success: false,
      error: 'At least 3 values are required',
      report: `❌ **Structured Snippet Asset Creation Failed**

**Error:** At least 3 values are required
**Current:** ${values.length} values provided

**Requirements:**
- Minimum 3 values recommended
- Maximum 10 values
- Each value max 25 characters`
    };
  }

  const operations = [{
    structuredSnippetAsset: {
      header: header,
      values: values
    }
  }];

  return await universalGoogleAdsWrite({
    account_id,
    resource_type: 'assets',
    operation_type: 'create',
    operations,
    confirm_danger: true
  });
}

/**
 * Create Call Asset (Phone Extension)
 * Adds clickable phone number to your ads
 */
async function createCallAsset({
  account_id = process.env.GADS_LIVE_ID,
  phone_number,
  country_code = 'IE',
  call_tracking_enabled = true
}) {

  log('📞 Creating Call Asset:', {
    account_id,
    phone_number,
    country_code
  });

  if (!phone_number) {
    return {
      success: false,
      error: 'phone_number is required',
      report: `❌ **Call Asset Creation Failed**

**Error:** phone_number is required

**Requirements:**
- phone_number: Phone number in E.164 format (e.g., "+35312345678")
- country_code: Country code (default: "IE" for Ireland)
- call_tracking_enabled: Enable call tracking (default: true)

**Example for ULearn:**
- phone_number: "+35318901234"
- country_code: "IE"`
    };
  }

  const operations = [{
    callAsset: {
      phoneNumber: phone_number,
      countryCode: country_code,
      callTrackingEnabled: call_tracking_enabled
    }
  }];

  return await universalGoogleAdsWrite({
    account_id,
    resource_type: 'assets',
    operation_type: 'create',
    operations,
    confirm_danger: true
  });
}

/**
 * Link Asset to Campaign
 * Associates an asset (extension) with a specific campaign
 */
async function linkAssetToCampaign({
  account_id = process.env.GADS_LIVE_ID,
  campaign_id,
  asset_id,
  field_type
}) {

  log('🔗 Linking Asset to Campaign:', {
    account_id,
    campaign_id,
    asset_id,
    field_type
  });

  const validFieldTypes = ['SITELINK', 'CALLOUT', 'STRUCTURED_SNIPPET', 'CALL'];

  if (!campaign_id || !asset_id || !field_type) {
    return {
      success: false,
      error: 'campaign_id, asset_id, and field_type are required',
      report: `❌ **Asset Linking Failed**

**Error:** Missing required parameters

**Required:**
- campaign_id: ID of the campaign
- asset_id: ID of the created asset
- field_type: Type of asset (${validFieldTypes.join(', ')})`
    };
  }

  if (!validFieldTypes.includes(field_type)) {
    return {
      success: false,
      error: `Invalid field_type. Must be one of: ${validFieldTypes.join(', ')}`,
      report: `❌ **Asset Linking Failed**

**Error:** Invalid field_type "${field_type}"

**Valid Field Types:**
- SITELINK: For sitelink assets
- CALLOUT: For callout assets
- STRUCTURED_SNIPPET: For structured snippet assets
- CALL: For call assets`
    };
  }

  const operations = [{
    campaign: `customers/${account_id}/campaigns/${campaign_id}`,
    asset: `customers/${account_id}/assets/${asset_id}`,
    field_type: field_type
  }];

  return await universalGoogleAdsWrite({
    account_id,
    resource_type: 'campaignAssets',
    operation_type: 'create',
    operations,
    confirm_danger: true
  });
}

/**
 * Link Asset to Ad Group
 * Associates an asset (extension) with a specific ad group
 */
async function linkAssetToAdGroup({
  account_id = process.env.GADS_LIVE_ID,
  ad_group_id,
  asset_id,
  field_type
}) {

  log('🔗 Linking Asset to Ad Group:', {
    account_id,
    ad_group_id,
    asset_id,
    field_type
  });

  const validFieldTypes = ['SITELINK', 'CALLOUT', 'STRUCTURED_SNIPPET', 'CALL'];

  if (!ad_group_id || !asset_id || !field_type) {
    return {
      success: false,
      error: 'ad_group_id, asset_id, and field_type are required',
      report: `❌ **Asset Linking Failed**

**Error:** Missing required parameters

**Required:**
- ad_group_id: ID of the ad group
- asset_id: ID of the created asset
- field_type: Type of asset (${validFieldTypes.join(', ')})`
    };
  }

  const operations = [{
    adGroup: `customers/${account_id}/adGroups/${ad_group_id}`,
    asset: `customers/${account_id}/assets/${asset_id}`,
    fieldType: field_type
  }];

  return await universalGoogleAdsWrite({
    account_id,
    resource_type: 'adGroupAssets',
    operation_type: 'create',
    operations,
    confirm_danger: true
  });
}

/**
 * Complete Ad Creation Workflow
 * Creates ad with multiple assets (extensions) in one operation
 */
async function createCompleteAd({
  account_id = process.env.GADS_LIVE_ID,
  ad_group_id,
  campaign_id,

  // Ad content
  headlines = [],
  descriptions = [],
  final_urls = [],
  path1 = '',
  path2 = '',

  // Assets (extensions)
  sitelinks = [],
  callouts = [],
  structured_snippets = [],
  call_asset = null
}) {

  log('🚀 Creating Complete Ad with Assets:', {
    account_id,
    ad_group_id,
    campaign_id,
    headlines_count: headlines.length,
    sitelinks_count: sitelinks.length,
    callouts_count: callouts.length
  });

  const results = {
    ad: null,
    sitelinks: [],
    callouts: [],
    structured_snippets: [],
    call_asset: null,
    links: []
  };

  let errors = [];

  try {
    // 1. Create the main ad
    log('📝 Step 1: Creating Responsive Search Ad...');
    results.ad = await createResponsiveSearchAd({
      account_id,
      ad_group_id,
      headlines,
      descriptions,
      final_urls,
      path1,
      path2
    });

    if (!results.ad.success) {
      errors.push(`Ad creation failed: ${results.ad.error}`);
    }

    // 2. Create sitelinks
    if (sitelinks.length > 0) {
      log('🔗 Step 2: Creating sitelink assets...');
      for (const sitelink of sitelinks) {
        const result = await createSitelinkAsset({
          account_id,
          ...sitelink
        });
        results.sitelinks.push(result);

        if (!result.success) {
          errors.push(`Sitelink creation failed: ${result.error}`);
        }
      }
    }

    // 3. Create callouts
    if (callouts.length > 0) {
      log('📢 Step 3: Creating callout assets...');
      for (const callout of callouts) {
        const result = await createCalloutAsset({
          account_id,
          text: callout
        });
        results.callouts.push(result);

        if (!result.success) {
          errors.push(`Callout creation failed: ${result.error}`);
        }
      }
    }

    // 4. Create structured snippets
    if (structured_snippets.length > 0) {
      log('📋 Step 4: Creating structured snippet assets...');
      for (const snippet of structured_snippets) {
        const result = await createStructuredSnippetAsset({
          account_id,
          ...snippet
        });
        results.structured_snippets.push(result);

        if (!result.success) {
          errors.push(`Structured snippet creation failed: ${result.error}`);
        }
      }
    }

    // 5. Create call asset
    if (call_asset) {
      log('📞 Step 5: Creating call asset...');
      results.call_asset = await createCallAsset({
        account_id,
        ...call_asset
      });

      if (!results.call_asset.success) {
        errors.push(`Call asset creation failed: ${results.call_asset.error}`);
      }
    }

    return {
      success: errors.length === 0,
      data: results,
      errors: errors,
      report: `🚀 **Complete Ad Creation ${errors.length === 0 ? 'Completed Successfully' : 'Completed with Errors'}**

**Ad Creation:** ${results.ad?.success ? '✅ Success' : '❌ Failed'}
**Sitelinks:** ${results.sitelinks.length} created (${results.sitelinks.filter(s => s.success).length} successful)
**Callouts:** ${results.callouts.length} created (${results.callouts.filter(c => c.success).length} successful)
**Structured Snippets:** ${results.structured_snippets.length} created (${results.structured_snippets.filter(s => s.success).length} successful)
**Call Asset:** ${results.call_asset ? (results.call_asset.success ? '✅ Success' : '❌ Failed') : 'Not requested'}

${errors.length > 0 ? `**Errors Encountered:**
${errors.map((error, i) => `${i + 1}. ${error}`).join('\n')}` : ''}

**Next Steps:**
1. Link created assets to campaign or ad group using linkAssetToCampaign/linkAssetToAdGroup
2. Monitor ad performance and adjust as needed
3. Test different asset combinations for optimization

**Generated:** ${new Date().toISOString()}`
    };

  } catch (error) {
    log('❌ Complete ad creation failed:', error.message);
    return {
      success: false,
      error: error.message,
      data: results,
      report: `❌ **Complete Ad Creation Failed**

**Error:** ${error.message}

**Partial Results:**
- Ad: ${results.ad ? (results.ad.success ? 'Created' : 'Failed') : 'Not attempted'}
- Assets: ${Object.values(results).flat().filter(r => r && r.success).length} items created successfully

Please review the error and try again.`
    };
  }
}

/**
 * Update Campaign Tracking Template
 * Specialized function for setting UTM tracking at campaign level
 */
async function updateCampaignTrackingTemplate({
  account_id = process.env.GADS_LIVE_ID,
  campaign_id,
  tracking_url_template
}) {

  log('🎯 Updating Campaign Tracking Template:', {
    account_id,
    campaign_id,
    template: tracking_url_template
  });

  return await universalGoogleAdsWrite({
    account_id,
    resource_type: 'campaigns',
    operation_type: 'update',
    operations: [{
      resource_name: `customers/${account_id}/campaigns/${campaign_id}`,
      tracking_url_template: tracking_url_template
    }],
    confirm_danger: true
  });
}

/**
 * Query Asset Groups from a Performance Max Campaign
 * Gets all asset groups with their basic info and associated assets
 */
async function queryAssetGroups({
  account_id = process.env.GADS_LIVE_ID,
  campaign_id
}) {

  log('🔍 Querying Asset Groups:', { account_id, campaign_id });

  try {
    const customer = googleAdsClient.Customer({
      customer_id: account_id,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      login_customer_id: process.env.GADS_LIVE_MCC_ID
    });

    // Query asset groups
    const assetGroupQuery = `
      SELECT
        asset_group.id,
        asset_group.name,
        asset_group.status,
        asset_group.resource_name,
        asset_group.final_urls,
        asset_group.final_mobile_urls,
        asset_group.path1,
        asset_group.path2,
        campaign.id,
        campaign.name
      FROM asset_group
      WHERE campaign.id = ${campaign_id}
    `;

    const assetGroups = await customer.query(assetGroupQuery);

    log(`✅ Found ${assetGroups.length} asset groups`);

    // For each asset group, get its assets
    const detailedAssetGroups = [];

    for (const row of assetGroups) {
      const assetGroupId = row.asset_group.id;

      // Query assets for this asset group
      const assetQuery = `
        SELECT
          asset_group_asset.asset,
          asset_group_asset.field_type,
          asset_group_asset.resource_name,
          asset.id,
          asset.name,
          asset.type,
          asset.text_asset.text,
          asset.image_asset.full_size.url,
          asset.youtube_video_asset.youtube_video_id
        FROM asset_group_asset
        WHERE asset_group.id = ${assetGroupId}
      `;

      const assets = await customer.query(assetQuery);

      detailedAssetGroups.push({
        id: row.asset_group.id?.toString(),
        name: row.asset_group.name,
        status: row.asset_group.status,
        resource_name: row.asset_group.resource_name,
        final_urls: row.asset_group.final_urls || [],
        final_mobile_urls: row.asset_group.final_mobile_urls || [],
        path1: row.asset_group.path1 || '',
        path2: row.asset_group.path2 || '',
        campaign_id: row.campaign.id?.toString(),
        campaign_name: row.campaign.name,
        assets: assets.map(a => ({
          asset_resource: a.asset_group_asset.asset,
          field_type: a.asset_group_asset.field_type,
          asset_id: a.asset.id?.toString(),
          asset_name: a.asset.name,
          asset_type: a.asset.type,
          text: a.asset.text_asset?.text,
          image_url: a.asset.image_asset?.full_size?.url,
          video_id: a.asset.youtube_video_asset?.youtube_video_id
        }))
      });
    }

    return {
      success: true,
      data: detailedAssetGroups,
      count: detailedAssetGroups.length,
      report: `✅ **Asset Groups Retrieved Successfully**

**Campaign:** ${detailedAssetGroups[0]?.campaign_name || 'N/A'}
**Asset Groups Found:** ${detailedAssetGroups.length}

${detailedAssetGroups.map((ag, i) => `
**${i + 1}. ${ag.name}**
- ID: ${ag.id}
- Status: ${ag.status}
- Final URLs: ${ag.final_urls.join(', ')}
- Assets: ${ag.assets.length} items
  - Headlines: ${ag.assets.filter(a => a.field_type === 'HEADLINE').length}
  - Long Headlines: ${ag.assets.filter(a => a.field_type === 'LONG_HEADLINE').length}
  - Descriptions: ${ag.assets.filter(a => a.field_type === 'DESCRIPTION').length}
  - Images: ${ag.assets.filter(a => a.field_type === 'MARKETING_IMAGE').length}
  - Logos: ${ag.assets.filter(a => a.field_type === 'LOGO').length}
`).join('\n')}

**Note:** These asset groups can be cloned to new PMax campaigns using \`cloneAssetGroups\` function.`
    };

  } catch (error) {
    log('❌ Asset group query failed:', error.message);
    return {
      success: false,
      error: error.message,
      report: `❌ **Failed to Query Asset Groups**

**Error:** ${error.message}

**Possible Causes:**
- Campaign is not a Performance Max campaign
- Invalid campaign ID
- API permissions issue
- Asset groups don't exist for this campaign`
    };
  }
}

/**
 * Clone Asset Groups from one PMax campaign to another
 * This creates new asset groups in the target campaign with the same structure
 */
async function cloneAssetGroups({
  account_id = process.env.GADS_LIVE_ID,
  source_campaign_id,
  target_campaign_id,
  new_final_urls = null,  // Optional: override URLs
  status = 'PAUSED',      // Default to PAUSED for safety
  confirm_danger = false
}) {

  // SAFETY CHECK
  if (!confirm_danger) {
    return {
      success: false,
      error: 'Safety confirmation required',
      report: `⚠️ **Asset Group Cloning Blocked - Safety Check**

This operation will create new asset groups in campaign ${target_campaign_id}.

**To proceed:**
Set 'confirm_danger' parameter to true

**Example:**
\`\`\`javascript
{
  source_campaign_id: ${source_campaign_id},
  target_campaign_id: ${target_campaign_id},
  confirm_danger: true  // ← Add this
}
\`\`\``
    };
  }

  log('🔄 Cloning Asset Groups:', {
    account_id,
    source_campaign_id,
    target_campaign_id,
    status
  });

  try {
    // Step 1: Get source asset groups
    const sourceResult = await queryAssetGroups({
      account_id,
      campaign_id: source_campaign_id
    });

    if (!sourceResult.success) {
      throw new Error(`Failed to query source asset groups: ${sourceResult.error}`);
    }

    const sourceAssetGroups = sourceResult.data;

    if (sourceAssetGroups.length === 0) {
      return {
        success: false,
        error: 'No asset groups found in source campaign',
        report: `⚠️ **No Asset Groups to Clone**

Source campaign ${source_campaign_id} has no asset groups.`
      };
    }

    log(`📋 Found ${sourceAssetGroups.length} asset groups to clone`);

    // Step 2: Create asset groups in target campaign
    const customer = googleAdsClient.Customer({
      customer_id: account_id,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      login_customer_id: process.env.GADS_LIVE_MCC_ID
    });

    const createdAssetGroups = [];

    for (const sourceAG of sourceAssetGroups) {
      // Create the asset group structure
      const assetGroupOperation = {
        campaign: `customers/${account_id}/campaigns/${target_campaign_id}`,
        name: sourceAG.name,
        status: status,
        final_urls: new_final_urls || sourceAG.final_urls,
        final_mobile_urls: sourceAG.final_mobile_urls,
        path1: sourceAG.path1,
        path2: sourceAG.path2
      };

      // Create asset group
      const agResponse = await customer.assetGroups.create([assetGroupOperation]);

      const newAssetGroupResourceName = agResponse.results[0].resource_name;
      const newAssetGroupId = newAssetGroupResourceName.split('/').pop();

      log(`✅ Created asset group: ${sourceAG.name} (ID: ${newAssetGroupId})`);

      // Step 3: Link assets to the new asset group
      const assetLinkOperations = sourceAG.assets.map(asset => ({
        asset_group: newAssetGroupResourceName,
        asset: asset.asset_resource,
        field_type: asset.field_type
      }));

      if (assetLinkOperations.length > 0) {
        await customer.assetGroupAssets.create(assetLinkOperations);
        log(`✅ Linked ${assetLinkOperations.length} assets to asset group ${newAssetGroupId}`);
      }

      createdAssetGroups.push({
        name: sourceAG.name,
        id: newAssetGroupId,
        resource_name: newAssetGroupResourceName,
        assets_linked: assetLinkOperations.length
      });
    }

    return {
      success: true,
      data: createdAssetGroups,
      report: `✅ **Asset Groups Cloned Successfully**

**Source Campaign:** ${source_campaign_id}
**Target Campaign:** ${target_campaign_id}
**Asset Groups Created:** ${createdAssetGroups.length}

${createdAssetGroups.map((ag, i) => `
**${i + 1}. ${ag.name}**
- New ID: ${ag.id}
- Assets Linked: ${ag.assets_linked}
- Status: ${status}
`).join('\n')}

**Next Steps:**
1. Review asset groups in Google Ads UI
2. Update target campaign status to ENABLED when ready
3. Monitor learning period (2-4 weeks for PMax campaigns)

**Timestamp:** ${new Date().toISOString()}`
    };

  } catch (error) {
    log('❌ Asset group cloning failed:', error.message);
    log('❌ Error stack:', error.stack);

    return {
      success: false,
      error: error.message,
      report: `❌ **Asset Group Cloning Failed**

**Error:** ${error.message}

**Operation Details:**
- Source Campaign: ${source_campaign_id}
- Target Campaign: ${target_campaign_id}

**Common Issues:**
- Target campaign is not Performance Max type
- Assets from source campaign no longer exist
- Insufficient permissions
- Invalid campaign IDs

Please verify both campaigns exist and are Performance Max campaigns.`
    };
  }
}

/**
 * Add assets to a PMax asset group
 * Properly formatted for Google Ads API assetGroupAssets.mutate()
 */
async function addAssetsToAssetGroup({
  account_id = process.env.GADS_LIVE_ID,
  asset_group_id,
  assets,  // Array of { asset_id, field_type }
  confirm_danger = false
}) {

  // SAFETY CHECK
  if (!confirm_danger) {
    return {
      success: false,
      error: 'Safety confirmation required',
      report: `⚠️ **Asset Addition Blocked - Safety Check**

This operation will add assets to asset group ${asset_group_id}.

**To proceed:**
Set 'confirm_danger' parameter to true

**Example:**
\`\`\`javascript
{
  asset_group_id: "${asset_group_id}",
  assets: [
    { asset_id: "123456", field_type: "HEADLINE" },
    { asset_id: "789012", field_type: "DESCRIPTION" }
  ],
  confirm_danger: true  // ← Add this
}
\`\`\``
    };
  }

  log('➕ Adding assets to asset group:', { account_id, asset_group_id, count: assets.length });

  try {
    const customer = googleAdsClient.Customer({
      customer_id: account_id,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      login_customer_id: process.env.GADS_LIVE_MCC_ID
    });

    // Format operations for assetGroupAssets.create()
    const operations = assets.map(asset => ({
      asset_group: `customers/${account_id}/assetGroups/${asset_group_id}`,
      asset: `customers/${account_id}/assets/${asset.asset_id}`,
      field_type: asset.field_type
    }));

    log(`📤 Adding ${operations.length} assets...`);
    const result = await customer.assetGroupAssets.create(operations);

    // Check for partial failure errors
    if (result.partial_failure_error) {
      log('⚠️ Partial failure in create operation');
      return {
        success: false,
        error: 'Partial failure - some assets could not be added',
        report: `⚠️ **Partial Failure Adding Assets**

**Asset Group:** ${asset_group_id}
**Attempted:** ${operations.length} assets

**Error Details:** ${JSON.stringify(result.partial_failure_error, null, 2)}

Some assets may have been added successfully, but others failed.
Common reasons: duplicate assets, maximum asset count reached, invalid field types.`
      };
    }

    log(`✅ Successfully added ${operations.length} assets`);
    return {
      success: true,
      added_count: operations.length,
      report: `✅ **Assets Added Successfully**

**Asset Group:** ${asset_group_id}
**Assets Added:** ${operations.length}

${assets.map((a, i) => `${i + 1}. Asset ${a.asset_id} → ${a.field_type}`).join('\n')}

**Timestamp:** ${new Date().toISOString()}`
    };

  } catch (error) {
    log('❌ Failed to add assets:', error);
    log('❌ Error details:', JSON.stringify(error, null, 2));

    // Extract Google Ads API error details
    let errorMsg = 'Unknown error';
    let errorDetails = '';

    if (error.errors && error.errors.length > 0) {
      const firstError = error.errors[0];
      errorMsg = firstError.message || 'API Error';

      // Extract error code
      if (firstError.error_code) {
        const errorCode = Object.keys(firstError.error_code)[0];
        const errorValue = firstError.error_code[errorCode];
        errorDetails = `\n**Error Code:** ${errorCode} = ${errorValue}`;
      }

      // Add request ID if available
      if (error.request_id) {
        errorDetails += `\n**Request ID:** ${error.request_id}`;
      }
    } else {
      errorMsg = error.message || error.toString() || 'Unknown error';
    }

    return {
      success: false,
      error: errorMsg,
      report: `❌ **Failed to Add Assets**

**Error:** ${errorMsg}${errorDetails}

**Asset Group:** ${asset_group_id}
**Attempted:** ${assets.length} assets

Check that:
- Asset IDs exist in the account
- Field types are valid (HEADLINE, LONG_HEADLINE, DESCRIPTION, etc.)
- Asset group exists and is part of a Performance Max campaign
- Asset group hasn't reached maximum asset limits (15 headlines, 5 descriptions, etc.)
- Assets aren't already linked to this asset group

**Full Error:** ${JSON.stringify(error.errors || error, null, 2)}`
    };
  }
}

/**
 * Remove assets from a PMax asset group
 * Uses proper resource name format: customers/ID/assetGroupAssets/GROUP~ASSET~FIELD
 */
async function removeAssetsFromAssetGroup({
  account_id = process.env.GADS_LIVE_ID,
  asset_group_id,
  assets,  // Array of { asset_id, field_type } to remove
  confirm_danger = false
}) {

  // SAFETY CHECK
  if (!confirm_danger) {
    return {
      success: false,
      error: 'Safety confirmation required',
      report: `⚠️ **Asset Removal Blocked - Safety Check**

This operation will remove assets from asset group ${asset_group_id}.

**To proceed:**
Set 'confirm_danger' parameter to true

**Example:**
\`\`\`javascript
{
  asset_group_id: "${asset_group_id}",
  assets: [
    { asset_id: "123456", field_type: "HEADLINE" },
    { asset_id: "789012", field_type: "DESCRIPTION" }
  ],
  confirm_danger: true  // ← Add this
}
\`\`\``
    };
  }

  log('➖ Removing assets from asset group:', { account_id, asset_group_id, count: assets.length });

  try {
    const customer = googleAdsClient.Customer({
      customer_id: account_id,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      login_customer_id: process.env.GADS_LIVE_MCC_ID
    });

    // Format resource names for assetGroupAssets.remove()
    const resourceNames = assets.map(asset =>
      `customers/${account_id}/assetGroupAssets/${asset_group_id}~${asset.asset_id}~${asset.field_type}`
    );

    log(`🗑️ Removing ${resourceNames.length} assets...`);
    const result = await customer.assetGroupAssets.remove(resourceNames);

    // Check for partial failure errors
    if (result.partial_failure_error) {
      log('⚠️ Partial failure in remove operation');
      return {
        success: false,
        error: 'Partial failure - some assets could not be removed',
        report: `⚠️ **Partial Failure Removing Assets**

**Asset Group:** ${asset_group_id}
**Attempted:** ${resourceNames.length} assets

**Error Details:** ${JSON.stringify(result.partial_failure_error, null, 2)}

Some assets may have been removed successfully, but others failed.`
      };
    }

    log(`✅ Successfully removed ${resourceNames.length} assets`);
    return {
      success: true,
      removed_count: resourceNames.length,
      report: `✅ **Assets Removed Successfully**

**Asset Group:** ${asset_group_id}
**Assets Removed:** ${resourceNames.length}

${assets.map((a, i) => `${i + 1}. Asset ${a.asset_id} → ${a.field_type}`).join('\n')}

**Timestamp:** ${new Date().toISOString()}`
    };

  } catch (error) {
    log('❌ Failed to remove assets:', error);
    log('❌ Error details:', JSON.stringify(error, null, 2));

    // Extract Google Ads API error details
    let errorMsg = 'Unknown error';
    let errorDetails = '';

    if (error.errors && error.errors.length > 0) {
      const firstError = error.errors[0];
      errorMsg = firstError.message || 'API Error';

      // Extract error code
      if (firstError.error_code) {
        const errorCode = Object.keys(firstError.error_code)[0];
        const errorValue = firstError.error_code[errorCode];
        errorDetails = `\n**Error Code:** ${errorCode} = ${errorValue}`;
      }

      // Add request ID if available
      if (error.request_id) {
        errorDetails += `\n**Request ID:** ${error.request_id}`;
      }
    } else {
      errorMsg = error.message || error.toString() || 'Unknown error';
    }

    return {
      success: false,
      error: errorMsg,
      report: `❌ **Failed to Remove Assets**

**Error:** ${errorMsg}${errorDetails}

**Asset Group:** ${asset_group_id}
**Attempted:** ${assets.length} assets

Check that:
- Asset IDs are correct and exist
- Assets are currently linked to this asset group
- Assets haven't already been removed
- Field types match the linked assets

**Full Error:** ${JSON.stringify(error.errors || error, null, 2)}`
    };
  }
}

module.exports = {
  universalGoogleAdsQuery,
  universalGoogleAdsWrite,
  getAvailableResourceTypes,
  createResponsiveSearchAd,
  createSitelinkAsset,
  createCalloutAsset,
  createStructuredSnippetAsset,
  createCallAsset,
  linkAssetToCampaign,
  linkAssetToAdGroup,
  createCompleteAd,
  updateCampaignTrackingTemplate,
  queryAssetGroups,
  cloneAssetGroups,
  addAssetsToAssetGroup,
  removeAssetsFromAssetGroup
};