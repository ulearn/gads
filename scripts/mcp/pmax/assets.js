/**
 * Asset Type Definitions and Configuration
 *
 * Defines all asset types used in Performance Max campaigns with their
 * limits, character counts, and field type enums.
 */

const ASSET_TYPES = {
  HEADLINE: {
    field_type: 'HEADLINE',
    field_type_enum: 3,
    min: 3,
    max: 15,
    char_limit: 30,
    description: 'Headlines (30 char)'
  },
  LONG_HEADLINE: {
    field_type: 'LONG_HEADLINE',
    field_type_enum: 5,
    min: 1,
    max: 5,
    char_limit: 90,
    description: 'Long Headlines (90 char)'
  },
  DESCRIPTION: {
    field_type: 'DESCRIPTION',
    field_type_enum: 2,
    min: 2,
    max: 5,
    char_limit: 90,
    description: 'Descriptions (90 char)'
  },
  BUSINESS_NAME: {
    field_type: 'BUSINESS_NAME',
    field_type_enum: 10,
    min: 1,
    max: 5,
    char_limit: 25,
    description: 'Business Names (25 char)'
  },
  MARKETING_IMAGE: {
    field_type: 'MARKETING_IMAGE',
    field_type_enum: 7,
    min: 1,
    max: 20,
    description: 'Marketing Images'
  },
  SQUARE_MARKETING_IMAGE: {
    field_type: 'SQUARE_MARKETING_IMAGE',
    field_type_enum: 8,
    min: 1,
    max: 20,
    description: 'Square Marketing Images (1:1)'
  },
  LOGO: {
    field_type: 'LOGO',
    field_type_enum: 6,
    min: 1,
    max: 5,
    description: 'Logos'
  },
  LANDSCAPE_LOGO: {
    field_type: 'LANDSCAPE_LOGO',
    field_type_enum: 9,
    min: 0,
    max: 5,
    description: 'Landscape Logos (4:1)'
  },
  YOUTUBE_VIDEO: {
    field_type: 'YOUTUBE_VIDEO',
    field_type_enum: 19,
    min: 0,
    max: 5,
    description: 'YouTube Videos'
  },
  CALL_TO_ACTION_SELECTION: {
    field_type: 'CALL_TO_ACTION_SELECTION',
    field_type_enum: 13,
    min: 1,
    max: 1,
    description: 'Call to Action'
  }
};

// Campaign-level assets (not asset group level)
const CAMPAIGN_ASSET_TYPES = {
  SITELINK: {
    field_type: 'SITELINK',
    field_type_enum: 1,
    max: 20,
    description: 'Sitelinks',
    link_text_limit: 25,
    description_line_limit: 35
  },
  CALLOUT: {
    field_type: 'CALLOUT',
    field_type_enum: 3,
    max: null, // No strict limit
    text_limit: 25,
    description: 'Callouts (25 char)'
  },
  STRUCTURED_SNIPPET: {
    field_type: 'STRUCTURED_SNIPPET',
    field_type_enum: 4,
    max: null,
    description: 'Structured Snippets'
  },
  PRICE: {
    field_type: 'PRICE',
    field_type_enum: 7,
    max: 8,
    description: 'Price Extensions'
  },
  PROMOTION: {
    field_type: 'PROMOTION',
    field_type_enum: 8,
    max: 20,
    description: 'Promotion Extensions'
  }
};

/**
 * Get asset type configuration
 * @param {string} assetType - Asset type name (e.g., 'HEADLINE', 'SITELINK')
 * @param {boolean} isCampaignLevel - Whether this is a campaign-level asset
 * @returns {Object} Asset type configuration
 */
function getAssetConfig(assetType, isCampaignLevel = false) {
  const config = isCampaignLevel
    ? CAMPAIGN_ASSET_TYPES[assetType]
    : ASSET_TYPES[assetType];

  if (!config) {
    throw new Error(`Unknown asset type: ${assetType}. Available types: ${
      isCampaignLevel
        ? Object.keys(CAMPAIGN_ASSET_TYPES).join(', ')
        : Object.keys(ASSET_TYPES).join(', ')
    }`);
  }

  return config;
}

/**
 * Validate asset count against limits
 * @param {string} assetType - Asset type name
 * @param {number} currentCount - Current number of assets
 * @param {boolean} isCampaignLevel - Whether this is a campaign-level asset
 * @returns {Object} Validation result with status and message
 */
function validateAssetCount(assetType, currentCount, isCampaignLevel = false) {
  const config = getAssetConfig(assetType, isCampaignLevel);

  const result = {
    valid: true,
    atMin: false,
    atMax: false,
    message: ''
  };

  if (config.min !== undefined && currentCount < config.min) {
    result.valid = false;
    result.message = `Below minimum: ${currentCount}/${config.min}`;
  } else if (config.min !== undefined && currentCount === config.min) {
    result.atMin = true;
    result.message = `At minimum: ${currentCount}/${config.min}`;
  }

  if (config.max !== undefined && config.max !== null && currentCount > config.max) {
    result.valid = false;
    result.message = `Exceeds maximum: ${currentCount}/${config.max}`;
  } else if (config.max !== undefined && config.max !== null && currentCount === config.max) {
    result.atMax = true;
    result.message = `At maximum: ${currentCount}/${config.max}`;
  }

  if (result.valid && !result.atMin && !result.atMax) {
    result.message = `Within limits: ${currentCount} (min: ${config.min || 0}, max: ${config.max || 'none'})`;
  }

  return result;
}

/**
 * Calculate swap strategy based on current count and limits
 * @param {string} assetType - Asset type name
 * @param {number} currentCount - Current number of assets
 * @param {number} assetsToRemove - Number of assets to remove
 * @param {number} assetsToAdd - Number of assets to add
 * @param {boolean} isCampaignLevel - Whether this is a campaign-level asset
 * @returns {Object} Strategy with steps and warnings
 */
function calculateSwapStrategy(assetType, currentCount, assetsToRemove, assetsToAdd, isCampaignLevel = false) {
  const config = getAssetConfig(assetType, isCampaignLevel);
  const finalCount = currentCount - assetsToRemove + assetsToAdd;

  const strategy = {
    valid: true,
    steps: [],
    warnings: [],
    finalCount
  };

  // Check if final count would violate limits
  if (config.min !== undefined && finalCount < config.min) {
    strategy.valid = false;
    strategy.warnings.push(`Final count (${finalCount}) would be below minimum (${config.min})`);
  }

  if (config.max !== undefined && config.max !== null && finalCount > config.max) {
    strategy.valid = false;
    strategy.warnings.push(`Final count (${finalCount}) would exceed maximum (${config.max})`);
  }

  // CRITICAL: Handle over-max situation FIRST
  // If currentCount > max (e.g., 11 when max is 5), clean up overage before any swaps
  if (config.max !== undefined && config.max !== null && currentCount > config.max) {
    const overageCount = currentCount - config.max;
    strategy.steps.push({
      action: 'CLEANUP_OVERAGE',
      reason: `Current count (${currentCount}) exceeds maximum (${config.max})`,
      count: overageCount,
      afterCleanup: config.max
    });
    // Update currentCount for subsequent strategy calculations
    currentCount = config.max;
  }

  // Determine order of operations
  if (currentCount >= (config.max || Infinity)) {
    // At or over max - MUST remove first
    strategy.steps.push({
      action: 'REMOVE_FIRST',
      reason: 'At or above maximum limit',
      count: assetsToRemove
    });
    strategy.steps.push({
      action: 'THEN_ADD',
      reason: 'Space created',
      count: assetsToAdd
    });
  } else if (currentCount + assetsToAdd <= (config.max || Infinity)) {
    // Have space - ADD first, then remove
    strategy.steps.push({
      action: 'ADD_FIRST',
      reason: 'Space available under maximum',
      count: assetsToAdd
    });
    strategy.steps.push({
      action: 'THEN_REMOVE',
      reason: 'Clean up old assets',
      count: assetsToRemove
    });
  } else {
    // Would exceed if we add first - do sequential 1-for-1
    strategy.steps.push({
      action: 'SEQUENTIAL_SWAP',
      reason: 'Maintain limits throughout operation',
      pairs: Math.min(assetsToRemove, assetsToAdd)
    });

    // Handle any remaining after swaps
    if (assetsToRemove > assetsToAdd) {
      strategy.steps.push({
        action: 'REMOVE_REMAINING',
        count: assetsToRemove - assetsToAdd
      });
    } else if (assetsToAdd > assetsToRemove) {
      strategy.steps.push({
        action: 'ADD_REMAINING',
        count: assetsToAdd - assetsToRemove
      });
    }
  }

  return strategy;
}

module.exports = {
  ASSET_TYPES,
  CAMPAIGN_ASSET_TYPES,
  getAssetConfig,
  validateAssetCount,
  calculateSwapStrategy
};
