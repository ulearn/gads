/**
 * Asset Query Utility
 *
 * Generic functions for querying Google Ads assets across all types.
 * Supports filtering, language detection, and status filtering.
 */

const { getAssetConfig } = require('./assets.js');

/**
 * Query all asset groups for a campaign
 *
 * @param {Object} customer - Google Ads customer object
 * @param {string} campaignId - Campaign ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of asset group objects
 */
async function queryAssetGroupsForCampaign(customer, campaignId, options = {}) {
  const { verbose = false, orderBy = 'asset_group.id' } = options;

  const query = `
    SELECT
      asset_group.id,
      asset_group.name,
      asset_group.status,
      asset_group.resource_name
    FROM asset_group
    WHERE campaign.id = ${campaignId}
    ${orderBy ? `ORDER BY ${orderBy}` : ''}
  `;

  try {
    const results = await customer.query(query);

    if (verbose) {
      console.log(`\nFound ${results.length} asset groups in campaign ${campaignId}:\n`);
      results.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.asset_group.name} (ID: ${row.asset_group.id})`);
        console.log(`     Status: ${row.asset_group.status}`);
      });
    }

    return results.map(row => ({
      id: row.asset_group.id.toString(),
      name: row.asset_group.name,
      status: row.asset_group.status,
      resource_name: row.asset_group.resource_name
    }));

  } catch (error) {
    throw new Error(`Failed to query asset groups for campaign ${campaignId}: ${error.message}`);
  }
}

/**
 * Query assets in an asset group
 *
 * @param {Object} customer - Google Ads customer object
 * @param {string} assetGroupId - Asset group ID
 * @param {string} assetType - Asset type (HEADLINE, LONG_HEADLINE, DESCRIPTION, etc.)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of asset objects
 */
async function queryAssetGroupAssets(customer, assetGroupId, assetType, options = {}) {
  const {
    enabledOnly = true,
    verbose = false,
    includeText = true,
    includeResourceName = true
  } = options;

  const config = getAssetConfig(assetType, false);

  const query = `
    SELECT
      asset.id,
      ${includeResourceName ? 'asset_group_asset.resource_name,' : ''}
      asset_group_asset.status,
      asset_group_asset.field_type
      ${includeText && config.char_limit ? ', asset.text_asset.text' : ''}
    FROM asset_group_asset
    WHERE asset_group.id = ${assetGroupId}
    AND asset_group_asset.field_type = ${assetType}
    ${enabledOnly ? 'AND asset_group_asset.status = ENABLED' : ''}
  `;

  try {
    const results = await customer.query(query);

    if (verbose) {
      console.log(`\nFound ${results.length} ${enabledOnly ? 'ENABLED' : ''} ${assetType} assets:\n`);
      results.forEach((row, i) => {
        console.log(`  ${i + 1}. Asset ID: ${row.asset.id}`);
        if (row.asset.text_asset?.text) {
          console.log(`     Text: "${row.asset.text_asset.text}"`);
        }
        console.log(`     Status: ${row.asset_group_asset.status}`);
      });
    }

    return results.map(row => ({
      id: row.asset.id.toString(),
      resource_name: row.asset_group_asset?.resource_name,
      status: row.asset_group_asset.status,
      text: row.asset.text_asset?.text || null,
      raw: row
    }));

  } catch (error) {
    throw new Error(`Failed to query ${assetType} assets in asset group ${assetGroupId}: ${error.message}`);
  }
}

/**
 * Query campaign-level assets (sitelinks, callouts, etc.)
 *
 * @param {Object} customer - Google Ads customer object
 * @param {string} campaignId - Campaign ID
 * @param {string} assetType - Asset type (SITELINK, CALLOUT, etc.)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of asset objects
 */
async function queryCampaignAssets(customer, campaignId, assetType, options = {}) {
  const {
    enabledOnly = true,
    verbose = false
  } = options;

  // Build SELECT based on asset type
  let assetFields = '';
  if (assetType === 'SITELINK') {
    assetFields = 'asset.sitelink_asset.link_text, asset.sitelink_asset.description1, asset.sitelink_asset.description2,';
  } else if (assetType === 'CALLOUT') {
    assetFields = 'asset.callout_asset.callout_text,';
  } else {
    assetFields = 'asset.text_asset.text,';
  }

  const query = `
    SELECT
      asset.id,
      campaign_asset.resource_name,
      campaign_asset.status,
      ${assetFields}
      asset.type
    FROM campaign_asset
    WHERE campaign.id = ${campaignId}
    AND campaign_asset.field_type = ${assetType}
    ${enabledOnly ? 'AND campaign_asset.status = ENABLED' : ''}
  `;

  try {
    const results = await customer.query(query);

    if (verbose) {
      console.log(`\nFound ${results.length} ${enabledOnly ? 'ENABLED' : ''} ${assetType} assets:\n`);
      results.forEach((row, i) => {
        console.log(`  ${i + 1}. Asset ID: ${row.asset.id}`);
        if (row.asset.sitelink_asset) {
          console.log(`     Link Text: "${row.asset.sitelink_asset.link_text}"`);
        } else if (row.asset.callout_asset) {
          console.log(`     Callout: "${row.asset.callout_asset.callout_text}"`);
        }
      });
    }

    return results.map(row => ({
      id: row.asset.id.toString(),
      resource_name: row.campaign_asset.resource_name,
      status: row.campaign_asset.status,
      text: row.asset.text_asset?.text ||
            row.asset.callout_asset?.callout_text ||
            row.asset.sitelink_asset?.link_text ||
            null,
      sitelink: row.asset.sitelink_asset || null,
      callout: row.asset.callout_asset?.callout_text || null,
      raw: row
    }));

  } catch (error) {
    throw new Error(`Failed to query ${assetType} assets in campaign ${campaignId}: ${error.message}`);
  }
}

/**
 * Query all text assets in account
 *
 * @param {Object} customer - Google Ads customer object
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of all text assets
 */
async function queryAllTextAssets(customer, options = {}) {
  const {
    maxCharLength = null,
    minCharLength = null,
    verbose = false
  } = options;

  const query = `
    SELECT
      asset.id,
      asset.text_asset.text,
      asset.type
    FROM asset
    WHERE asset.type = TEXT
  `;

  try {
    const results = await customer.query(query);

    let filtered = results;

    // Apply character length filters
    if (maxCharLength || minCharLength) {
      filtered = results.filter(row => {
        const text = row.asset.text_asset?.text || '';
        const len = text.length;

        if (maxCharLength && len > maxCharLength) return false;
        if (minCharLength && len < minCharLength) return false;

        return true;
      });
    }

    if (verbose) {
      console.log(`\nFound ${results.length} text assets in account`);
      if (maxCharLength || minCharLength) {
        console.log(`Filtered to ${filtered.length} assets (length: ${minCharLength || 0}-${maxCharLength || '∞'})`);
      }
    }

    return filtered.map(row => ({
      id: row.asset.id.toString(),
      text: row.asset.text_asset.text,
      length: row.asset.text_asset.text.length,
      type: row.asset.type
    }));

  } catch (error) {
    throw new Error(`Failed to query all text assets: ${error.message}`);
  }
}

/**
 * Get asset content by ID(s)
 *
 * @param {Object} customer - Google Ads customer object
 * @param {string|Array<string>} assetIds - Asset ID or array of IDs
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of assets with full content
 */
async function getAssetContent(customer, assetIds, options = {}) {
  const { verbose = false } = options;

  const ids = Array.isArray(assetIds) ? assetIds : [assetIds];

  const query = `
    SELECT
      asset.id,
      asset.type,
      asset.text_asset.text,
      asset.sitelink_asset.link_text,
      asset.sitelink_asset.description1,
      asset.sitelink_asset.description2,
      asset.callout_asset.callout_text,
      asset.image_asset.full_size.url
    FROM asset
    WHERE asset.id IN (${ids.join(', ')})
  `;

  try {
    const results = await customer.query(query);

    if (verbose) {
      console.log(`\nRetrieved ${results.length} assets:`);
      results.forEach((row, i) => {
        console.log(`  ${i + 1}. Asset ${row.asset.id} (${row.asset.type})`);
      });
    }

    return results.map(row => ({
      id: row.asset.id.toString(),
      type: row.asset.type,
      text: row.asset.text_asset?.text || null,
      sitelink: row.asset.sitelink_asset ? {
        link_text: row.asset.sitelink_asset.link_text,
        description1: row.asset.sitelink_asset.description1,
        description2: row.asset.sitelink_asset.description2
      } : null,
      callout: row.asset.callout_asset?.callout_text || null,
      image_url: row.asset.image_asset?.full_size?.url || null
    }));

  } catch (error) {
    throw new Error(`Failed to get asset content: ${error.message}`);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect language of text asset
 *
 * @param {string} text - Text to analyze
 * @param {Array<string>} languages - Languages to detect (default: ['english', 'spanish', 'portuguese'])
 * @returns {Object} Detection result with language and confidence
 */
function detectLanguage(text, languages = ['english', 'spanish', 'portuguese']) {
  const patterns = {
    english: /\b(school|learn|english|study|dublin|courses?|work|the|and|our|for|with|your|free|wifi|guarantee|central|location|teachers|teaching|business|class|accommodation|family|contact|life)\b/i,
    spanish: /\b(escuela|estudiar|curso|cursos|inglés|trabajo|dublin|irlanda|años|con|para|todos|nuestro|gratis)\b/i,
    portuguese: /\b(escola|estudar|aprender|curso|cursos|inglês|inglesa|trabalho|dublin|irlanda|anos|professores|ensino|aulas|preços|visto|garantida|acomodação)\b/i
  };

  const results = {};
  let detectedLanguage = 'unknown';
  let maxMatches = 0;

  for (const lang of languages) {
    const pattern = patterns[lang];
    if (pattern) {
      const matches = (text.match(pattern) || []).length;
      results[lang] = matches;

      if (matches > maxMatches) {
        maxMatches = matches;
        detectedLanguage = lang;
      }
    }
  }

  return {
    language: detectedLanguage,
    confidence: maxMatches > 0 ? 'high' : 'low',
    matches: results
  };
}

/**
 * Filter assets by character length
 *
 * @param {Array} assets - Array of asset objects with 'text' property
 * @param {number} maxLength - Maximum character length
 * @param {number} minLength - Minimum character length (optional)
 * @returns {Array} Filtered assets
 */
function filterByCharLength(assets, maxLength, minLength = 0) {
  return assets.filter(asset => {
    if (!asset.text) return false;
    const len = asset.text.length;
    return len >= minLength && len <= maxLength;
  });
}

/**
 * Categorize assets by language
 *
 * @param {Array} assets - Array of asset objects with 'text' property
 * @param {Array<string>} languages - Languages to categorize
 * @returns {Object} Object with assets categorized by language
 */
function categorizeByLanguage(assets, languages = ['english', 'spanish', 'portuguese']) {
  const categorized = {
    unknown: []
  };

  languages.forEach(lang => {
    categorized[lang] = [];
  });

  assets.forEach(asset => {
    if (!asset.text) {
      categorized.unknown.push(asset);
      return;
    }

    const detection = detectLanguage(asset.text, languages);
    categorized[detection.language].push(asset);
  });

  return categorized;
}

/**
 * Extract field type enum from resource name
 *
 * @param {string} resourceName - Asset resource name
 * @returns {string|null} Field type enum or null
 */
function extractFieldTypeEnum(resourceName) {
  if (!resourceName) return null;

  // Resource name format: customers/{customer_id}/assetGroupAssets/{asset_group_id}~{asset_id}~{field_type_enum}
  const parts = resourceName.split('~');

  if (parts.length >= 3) {
    return parts[2];
  }

  return null;
}

// ============================================================================
// COMING SOON: Additional query functions
// ============================================================================

/**
 * COMING SOON: Query image assets
 */
async function queryImageAssets(customer, assetGroupId, imageType, options = {}) {
  throw new Error('Image asset querying not yet implemented. Coming soon...');
}

/**
 * COMING SOON: Query video assets
 */
async function queryVideoAssets(customer, assetGroupId, options = {}) {
  throw new Error('Video asset querying not yet implemented. Coming soon...');
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Primary query functions
  queryAssetGroupsForCampaign,
  queryAssetGroupAssets,
  queryCampaignAssets,
  queryAllTextAssets,
  getAssetContent,

  // Helper functions
  detectLanguage,
  filterByCharLength,
  categorizeByLanguage,
  extractFieldTypeEnum,

  // Coming soon
  queryImageAssets,
  queryVideoAssets
};
