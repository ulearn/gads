/**
 * Asset Creation Utility
 *
 * Generic functions for creating Google Ads assets of all types.
 * Uses assets.json for content storage.
 */

const { GoogleAdsApi } = require('google-ads-api');
const path = require('path');
const fs = require('fs');

// Load asset content from JSON
const ASSET_DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'assets.json'), 'utf8')
);

/**
 * Create text assets (HEADLINE, LONG_HEADLINE, DESCRIPTION, BUSINESS_NAME, CALLOUT)
 *
 * @param {Object} customer - Google Ads customer object
 * @param {string} assetType - Type of asset (headline, long_headline, description, etc.)
 * @param {Array<string>} texts - Array of text strings to create (if not using assets.json)
 * @param {Object} options - Additional options
 * @returns {Promise<Array<string>>} Array of created asset IDs
 */
async function createTextAssets(customer, assetType, texts = null, options = {}) {
  const {
    verbose = true,
    returnFullResponse = false
  } = options;

  // Use provided texts or load from assets.json
  const textArray = texts || ASSET_DATA[assetType];

  if (!textArray || textArray.length === 0) {
    throw new Error(`No text content found for asset type: ${assetType}`);
  }

  if (verbose) {
    console.log(`\nCreating ${textArray.length} ${assetType.toUpperCase()} assets...`);
  }

  // Prepare operations
  const operations = textArray.map(text => ({
    text_asset: {
      text: text
    }
  }));

  try {
    const response = await customer.assets.create(operations);

    // Extract asset IDs from response
    const assetIds = response.map(result => {
      return result.resource_name.split('/')[3];
    });

    if (verbose) {
      console.log(`✅ Created ${assetIds.length} assets:\n`);
      textArray.forEach((text, i) => {
        console.log(`  ${i + 1}. [${assetIds[i]}] "${text}" (${text.length} chars)`);
      });
    }

    return returnFullResponse ? { assetIds, texts: textArray } : assetIds;

  } catch (error) {
    console.error(`\n❌ ERROR creating ${assetType} assets:`, error.message);
    if (error.errors) {
      error.errors.forEach((err, i) => {
        console.error(`  Error ${i + 1}:`, err.message || err);
      });
    }
    throw error;
  }
}

/**
 * Create text assets using universalGoogleAdsWrite (alternative method)
 * Useful when customer.assets.create() has issues
 *
 * @param {Function} universalGoogleAdsWrite - The universal write function from mcp-api-full.js
 * @param {string} accountId - Google Ads account ID
 * @param {string} assetType - Type of asset (headline, long_headline, description, etc.)
 * @param {Array<string>} texts - Array of text strings to create (if not using assets.json)
 * @param {Object} options - Additional options
 * @returns {Promise<Array<string>>} Array of created asset IDs
 */
async function createTextAssetsViaUniversal(universalGoogleAdsWrite, accountId, assetType, texts = null, options = {}) {
  const { verbose = true } = options;

  // Use provided texts or load from assets.json
  const textArray = texts || ASSET_DATA[assetType];

  if (!textArray || textArray.length === 0) {
    throw new Error(`No text content found for asset type: ${assetType}`);
  }

  if (verbose) {
    console.log(`\nCreating ${textArray.length} ${assetType.toUpperCase()} assets (via universalGoogleAdsWrite)...`);
  }

  const assetIds = [];

  // Create one at a time to handle errors gracefully
  for (const text of textArray) {
    const operations = [{
      type: 'TEXT',
      text_asset: {
        text: text
      }
    }];

    try {
      const result = await universalGoogleAdsWrite({
        account_id: accountId,
        resource_type: 'assets',
        operation_type: 'create',
        operations,
        confirm_danger: true
      });

      if (result.success && result.created_resources) {
        const assetId = result.created_resources[0].split('/').pop();
        assetIds.push(assetId);

        if (verbose) {
          console.log(`  ✅ [${assetId}] "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
        }
      } else {
        console.error(`  ❌ Failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`  ❌ Exception: ${error.message}`);
    }
  }

  if (verbose) {
    console.log(`\n✅ Created ${assetIds.length}/${textArray.length} assets successfully`);
  }

  return assetIds;
}

/**
 * Create multiple asset types at once
 *
 * @param {Object} customer - Google Ads customer object
 * @param {Array<string>} assetTypes - Array of asset types to create
 * @param {Object} options - Options
 * @returns {Promise<Object>} Object with asset IDs keyed by type
 */
async function createMultipleAssetTypes(customer, assetTypes, options = {}) {
  const { verbose = true } = options;

  const results = {};

  for (const assetType of assetTypes) {
    if (verbose) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`Creating ${assetType.toUpperCase()} assets...`);
      console.log('='.repeat(70));
    }

    try {
      results[assetType] = await createTextAssets(customer, assetType, null, options);
    } catch (error) {
      console.error(`Failed to create ${assetType}:`, error.message);
      results[assetType] = [];
    }

    // Small delay between asset types
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

// ============================================================================
// COMING SOON: Additional asset type creation functions
// ============================================================================

/**
 * Create sitelink assets
 *
 * Sitelinks require:
 * - link_text (25 char max)
 * - description1 (35 char max)
 * - description2 (35 char max)
 * - final_url
 *
 * @param {Function} universalGoogleAdsWrite - Universal write function from mcp-api-full.js
 * @param {string} accountId - Google Ads account ID
 * @param {Array<Object>} sitelinks - Array of sitelink objects (if not using assets.json)
 * @param {Object} options - Options
 * @returns {Promise<Array<string>>} Array of created asset IDs
 */
async function createSitelinkAssets(universalGoogleAdsWrite, accountId, sitelinks = null, options = {}) {
  const { verbose = true, delayMs = 500 } = options;

  // Use provided sitelinks or load from assets.json
  const sitelinkArray = sitelinks || ASSET_DATA.sitelink;

  if (!sitelinkArray || sitelinkArray.length === 0) {
    throw new Error('No sitelink content found');
  }

  if (verbose) {
    console.log(`\nCreating ${sitelinkArray.length} SITELINK assets...`);
  }

  const assetIds = [];

  // Create one at a time to handle errors gracefully
  for (const sitelink of sitelinkArray) {
    const operations = [{
      type: 'SITELINK',
      name: `Sitelink: ${sitelink.link_text}`,
      final_urls: [sitelink.final_url],
      sitelink_asset: {
        link_text: sitelink.link_text,
        description1: sitelink.description1,
        description2: sitelink.description2
      }
    }];

    try {
      const result = await universalGoogleAdsWrite({
        account_id: accountId,
        resource_type: 'assets',
        operation_type: 'create',
        operations,
        confirm_danger: true
      });

      if (result.success && result.created_resources) {
        const assetId = result.created_resources[0].split('/').pop();
        assetIds.push(assetId);

        if (verbose) {
          console.log(`  ✅ [${assetId}] "${sitelink.link_text}"`);
        }
      } else {
        console.error(`  ❌ Failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`  ❌ Exception: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  if (verbose) {
    console.log(`\n✅ Created ${assetIds.length}/${sitelinkArray.length} sitelinks successfully`);
  }

  return assetIds;
}

/**
 * COMING SOON: Create image assets
 *
 * Images require uploading binary data or providing URL
 */
async function createImageAssets(customer, images, options = {}) {
  throw new Error('Image asset creation not yet implemented. Coming soon...');

  // TODO: Implementation
  // - Upload from file path
  // - Upload from URL
  // - Upload from base64 data
}

/**
 * COMING SOON: Create YouTube video assets
 *
 * Videos require YouTube video ID
 */
async function createYouTubeVideoAssets(customer, videoIds, options = {}) {
  throw new Error('YouTube video asset creation not yet implemented. Coming soon...');

  // TODO: Implementation
  // const operations = videoIds.map(videoId => ({
  //   youtube_video_asset: {
  //     youtube_video_id: videoId
  //   }
  // }));
}

/**
 * COMING SOON: Create callout assets
 */
async function createCalloutAssets(customer, callouts, options = {}) {
  throw new Error('Callout asset creation not yet implemented. Coming soon...');
}

/**
 * COMING SOON: Create structured snippet assets
 */
async function createStructuredSnippetAssets(customer, snippets, options = {}) {
  throw new Error('Structured snippet asset creation not yet implemented. Coming soon...');
}

/**
 * COMING SOON: Create price assets
 */
async function createPriceAssets(customer, prices, options = {}) {
  throw new Error('Price asset creation not yet implemented. Coming soon...');
}

/**
 * COMING SOON: Create promotion assets
 */
async function createPromotionAssets(customer, promotions, options = {}) {
  throw new Error('Promotion asset creation not yet implemented. Coming soon...');
}

/**
 * COMING SOON: Create logo assets
 */
async function createLogoAssets(customer, logos, options = {}) {
  throw new Error('Logo asset creation not yet implemented. Coming soon...');
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Text asset creation
  createTextAssets,
  createTextAssetsViaUniversal,
  createMultipleAssetTypes,

  // Coming soon (placeholders)
  createSitelinkAssets,
  createImageAssets,
  createYouTubeVideoAssets,
  createCalloutAssets,
  createStructuredSnippetAssets,
  createPriceAssets,
  createPromotionAssets,
  createLogoAssets,

  // Asset data
  ASSET_DATA
};
