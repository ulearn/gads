/**
 * Sequential Asset Swap Utility
 *
 * Generic utility for swapping assets in Performance Max campaigns.
 * Works with any asset type and maintains min/max limits throughout operations.
 */

const { getAssetConfig, validateAssetCount, calculateSwapStrategy } = require('./assets.js');
const { detectLanguage, categorizeByLanguage } = require('./query.js');

/**
 * Query current assets in an asset group or campaign
 * @param {Object} customer - Google Ads customer object
 * @param {Object} options - Query options
 * @param {string} options.assetType - Asset type (e.g., 'HEADLINE')
 * @param {string} options.assetGroupId - Asset group ID (for asset group assets)
 * @param {string} options.campaignId - Campaign ID (for campaign assets)
 * @param {boolean} options.includeDisabled - Whether to include disabled assets (default: false)
 * @returns {Promise<Array>} Array of asset objects with id, resource_name, text, and status
 */
async function queryAssets(customer, options) {
  const { assetType, assetGroupId, campaignId, includeDisabled = false } = options;

  const isCampaignLevel = !!campaignId;
  const config = getAssetConfig(assetType, isCampaignLevel);

  let query;

  if (isCampaignLevel) {
    // Campaign-level assets (sitelinks, callouts, etc.)
    query = `
      SELECT
        asset.id,
        campaign_asset.resource_name,
        campaign_asset.status,
        ${assetType === 'SITELINK' ? 'asset.sitelink_asset.link_text,' : ''}
        ${assetType === 'CALLOUT' ? 'asset.callout_asset.callout_text,' : ''}
        ${config.char_limit ? 'asset.text_asset.text,' : ''}
        asset.type
      FROM campaign_asset
      WHERE campaign.id = ${campaignId}
      AND campaign_asset.field_type = ${assetType}
      ${includeDisabled ? '' : 'AND campaign_asset.status = ENABLED'}
    `;
  } else {
    // Asset group level assets (headlines, descriptions, images, etc.)
    query = `
      SELECT
        asset.id,
        asset_group_asset.resource_name,
        asset_group_asset.status,
        ${config.char_limit ? 'asset.text_asset.text,' : ''}
        asset.type
      FROM asset_group_asset
      WHERE asset_group.id = ${assetGroupId}
      AND asset_group_asset.field_type = ${assetType}
      ${includeDisabled ? '' : 'AND asset_group_asset.status = ENABLED'}
    `;
  }

  try {
    const results = await customer.query(query);

    // Format results consistently
    return results.map(row => {
      const asset = row.asset;
      const assetLink = isCampaignLevel ? row.campaign_asset : row.asset_group_asset;

      return {
        id: asset.id.toString(),
        resource_name: assetLink.resource_name,
        status: assetLink.status,
        text: asset.text_asset?.text ||
              asset.sitelink_asset?.link_text ||
              asset.callout_asset?.callout_text ||
              null,
        type: asset.type,
        raw: row // Keep raw data for additional analysis
      };
    });
  } catch (error) {
    throw new Error(`Failed to query ${assetType} assets: ${error.message}`);
  }
}

/**
 * Get asset content for analysis
 * @param {Object} customer - Google Ads customer object
 * @param {string|Array<string>} assetIds - Asset ID(s) to retrieve
 * @returns {Promise<Array>} Array of assets with full content
 */
async function getAssetContent(customer, assetIds) {
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

/**
 * Remove assets from asset group or campaign
 * @param {Object} customer - Google Ads customer object
 * @param {Array<string>} resourceNames - Resource names to remove
 * @param {boolean} isCampaignLevel - Whether these are campaign-level assets
 */
async function removeAssets(customer, resourceNames, isCampaignLevel = false) {
  if (!resourceNames || resourceNames.length === 0) {
    return { success: true, removed: 0 };
  }

  try {
    if (isCampaignLevel) {
      await customer.campaignAssets.remove(resourceNames);
    } else {
      await customer.assetGroupAssets.remove(resourceNames);
    }

    return { success: true, removed: resourceNames.length };
  } catch (error) {
    throw new Error(`Failed to remove assets: ${error.message}`);
  }
}

/**
 * Add assets to asset group or campaign
 * @param {Object} customer - Google Ads customer object
 * @param {Object} options - Add options
 * @param {string} options.accountId - Account ID
 * @param {string} options.assetGroupId - Asset group ID (for asset group assets)
 * @param {string} options.campaignId - Campaign ID (for campaign assets)
 * @param {string} options.assetType - Asset type
 * @param {Array<string>} options.assetIds - Asset IDs to add
 */
async function addAssets(customer, options) {
  const { accountId, assetGroupId, campaignId, assetType, assetIds } = options;

  if (!assetIds || assetIds.length === 0) {
    return { success: true, added: 0 };
  }

  const isCampaignLevel = !!campaignId;

  const operations = assetIds.map(assetId => ({
    [isCampaignLevel ? 'campaign' : 'asset_group']: isCampaignLevel
      ? `customers/${accountId}/campaigns/${campaignId}`
      : `customers/${accountId}/assetGroups/${assetGroupId}`,
    asset: `customers/${accountId}/assets/${assetId}`,
    field_type: assetType
  }));

  try {
    if (isCampaignLevel) {
      await customer.campaignAssets.create(operations);
    } else {
      await customer.assetGroupAssets.create(operations);
    }

    return { success: true, added: assetIds.length };
  } catch (error) {
    throw new Error(`Failed to add assets: ${error.message}`);
  }
}

/**
 * Perform sequential asset swap
 * @param {Object} customer - Google Ads customer object
 * @param {Object} options - Swap options
 * @param {string} options.accountId - Account ID
 * @param {string} options.assetGroupId - Asset group ID (for asset group assets)
 * @param {string} options.campaignId - Campaign ID (for campaign assets)
 * @param {string} options.assetType - Asset type (e.g., 'HEADLINE')
 * @param {Array<string>} options.removeAssetIds - Asset IDs to remove
 * @param {Array<string>} options.addAssetIds - Asset IDs to add
 * @param {number} options.delayMs - Delay between operations (default: 500ms)
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<Object>} Swap result with success status and details
 */
async function sequentialSwap(customer, options) {
  const {
    accountId,
    assetGroupId,
    campaignId,
    assetType,
    removeAssetIds = [],
    addAssetIds = [],
    delayMs = 500,
    onProgress = () => {}
  } = options;

  const isCampaignLevel = !!campaignId;

  onProgress({ stage: 'QUERY', message: 'Querying current assets...' });

  // Step 1: Query current assets
  const currentAssets = await queryAssets(customer, {
    assetType,
    assetGroupId,
    campaignId
  });

  const config = getAssetConfig(assetType, isCampaignLevel);

  onProgress({
    stage: 'VALIDATE',
    message: `Current: ${currentAssets.length} assets`,
    current: currentAssets.length,
    config
  });

  // Step 2: Validate current count
  const validation = validateAssetCount(assetType, currentAssets.length, isCampaignLevel);

  if (!validation.valid) {
    throw new Error(`Invalid current state: ${validation.message}`);
  }

  // Step 3: Identify assets to remove by ID
  const assetsToRemove = currentAssets.filter(a => removeAssetIds.includes(a.id));

  onProgress({
    stage: 'PLAN',
    message: `Planning: Remove ${assetsToRemove.length}, Add ${addAssetIds.length}`
  });

  // Step 4: Calculate swap strategy
  const strategy = calculateSwapStrategy(
    assetType,
    currentAssets.length,
    assetsToRemove.length,
    addAssetIds.length,
    isCampaignLevel
  );

  if (!strategy.valid) {
    throw new Error(`Invalid swap strategy: ${strategy.warnings.join(', ')}`);
  }

  onProgress({
    stage: 'STRATEGY',
    message: `Strategy: ${strategy.steps.map(s => s.action).join(' → ')}`,
    strategy
  });

  // Step 5: Execute swap based on strategy
  const result = {
    success: true,
    removed: 0,
    added: 0,
    errors: []
  };

  for (const step of strategy.steps) {
    if (step.action === 'CLEANUP_OVERAGE') {
      // Handle over-max situation: remove extras before any swapping
      onProgress({ stage: 'CLEANUP', message: `Removing ${step.count} excess assets (over max)...` });

      try {
        // Remove oldest/first assets to get down to max
        const toRemove = assetsToRemove.slice(0, step.count).map(a => a.resource_name);
        await removeAssets(customer, toRemove, isCampaignLevel);
        result.removed += step.count;

        // Update assetsToRemove list
        assetsToRemove.splice(0, step.count);

        onProgress({
          stage: 'CLEANUP',
          message: `✅ Cleaned up ${step.count} excess assets. Now at max (${step.afterCleanup})`
        });

        await new Promise(resolve => setTimeout(resolve, delayMs * 2));
      } catch (error) {
        result.errors.push({ action: 'CLEANUP_OVERAGE', error: error.message });
        result.success = false;
        break;
      }

    } else if (step.action === 'SEQUENTIAL_SWAP') {
      // Do 1-for-1 swaps
      onProgress({ stage: 'SWAP', message: `Performing ${step.pairs} sequential swaps...` });

      for (let i = 0; i < step.pairs; i++) {
        const oldAsset = assetsToRemove[i];
        const newAssetId = addAssetIds[i];

        onProgress({
          stage: 'SWAP',
          message: `Swap ${i + 1}/${step.pairs}: Remove ${oldAsset.id}, Add ${newAssetId}`,
          progress: i + 1,
          total: step.pairs
        });

        try {
          // Remove 1
          await removeAssets(customer, [oldAsset.resource_name], isCampaignLevel);
          result.removed++;

          await new Promise(resolve => setTimeout(resolve, delayMs));

          // Add 1
          await addAssets(customer, {
            accountId,
            assetGroupId,
            campaignId,
            assetType,
            assetIds: [newAssetId]
          });
          result.added++;

          await new Promise(resolve => setTimeout(resolve, delayMs));

        } catch (error) {
          result.errors.push({
            swap: i + 1,
            remove: oldAsset.id,
            add: newAssetId,
            error: error.message
          });

          // Try rollback
          try {
            await addAssets(customer, {
              accountId,
              assetGroupId,
              campaignId,
              assetType,
              assetIds: [oldAsset.id]
            });
            onProgress({ stage: 'ROLLBACK', message: `Rolled back swap ${i + 1}` });
          } catch (rollbackError) {
            result.errors.push({
              swap: i + 1,
              error: `Rollback also failed: ${rollbackError.message}`
            });
          }

          result.success = false;
          break;
        }
      }

    } else if (step.action === 'REMOVE_FIRST') {
      onProgress({ stage: 'REMOVE', message: `Removing ${step.count} assets...` });

      try {
        const toRemove = assetsToRemove.slice(0, step.count).map(a => a.resource_name);
        await removeAssets(customer, toRemove, isCampaignLevel);
        result.removed += step.count;

        await new Promise(resolve => setTimeout(resolve, delayMs * 2));
      } catch (error) {
        result.errors.push({ action: 'REMOVE_FIRST', error: error.message });
        result.success = false;
        break;
      }

    } else if (step.action === 'THEN_ADD' || step.action === 'ADD_FIRST') {
      onProgress({ stage: 'ADD', message: `Adding ${step.count} assets...` });

      try {
        await addAssets(customer, {
          accountId,
          assetGroupId,
          campaignId,
          assetType,
          assetIds: addAssetIds.slice(0, step.count)
        });
        result.added += step.count;

        await new Promise(resolve => setTimeout(resolve, delayMs * 2));
      } catch (error) {
        result.errors.push({ action: step.action, error: error.message });
        result.success = false;
        break;
      }

    } else if (step.action === 'THEN_REMOVE') {
      onProgress({ stage: 'REMOVE', message: `Removing ${step.count} old assets...` });

      try {
        const toRemove = assetsToRemove.map(a => a.resource_name);
        await removeAssets(customer, toRemove, isCampaignLevel);
        result.removed += step.count;
      } catch (error) {
        result.errors.push({ action: 'THEN_REMOVE', error: error.message });
        result.success = false;
        break;
      }
    }
  }

  onProgress({
    stage: 'COMPLETE',
    message: result.success ? 'Swap completed successfully' : 'Swap completed with errors',
    result
  });

  return result;
}

/**
 * Intelligent asset swap with analysis and reporting
 *
 * This function performs comprehensive analysis before swapping:
 * 1. Checks max/min limits for asset type
 * 2. Analyzes current content (count, language, meaning)
 * 3. Plans optimal swap strategy
 * 4. Executes swap with error handling
 * 5. Reports final state with language breakdown
 *
 * @param {Object} customer - Google Ads customer object
 * @param {Object} options - Swap options
 * @param {string} options.accountId - Account ID
 * @param {string} options.assetGroupId - Asset group ID (for asset group assets)
 * @param {string} options.campaignId - Campaign ID (for campaign assets)
 * @param {string} options.assetType - Asset type (e.g., 'HEADLINE')
 * @param {Array<string>} options.newAssetIds - New asset IDs to add
 * @param {Object} options.targetLanguage - Target language info (e.g., {code: 'es', name: 'Spanish'})
 * @param {boolean} options.removeAllOtherLanguages - Remove all non-target language assets (default: true)
 * @param {number} options.delayMs - Delay between operations (default: 500ms)
 * @param {boolean} options.verbose - Verbose logging (default: true)
 * @returns {Promise<Object>} Detailed swap result with before/after analysis
 */
async function analyzeAndSwap(customer, options) {
  const {
    accountId,
    assetGroupId,
    campaignId,
    assetType,
    newAssetIds,
    targetLanguage = { code: 'unknown', name: 'Unknown' },
    removeAllOtherLanguages = true,
    delayMs = 500,
    verbose = true
  } = options;

  const isCampaignLevel = !!campaignId;
  const config = getAssetConfig(assetType, isCampaignLevel);

  if (verbose) {
    console.log('\n' + '='.repeat(70));
    console.log(`INTELLIGENT ASSET SWAP: ${assetType}`);
    console.log('='.repeat(70));
  }

  // ========================================
  // STEP 1: Query and analyze current state
  // ========================================
  if (verbose) console.log('\n📊 STEP 1: Analyzing current assets...\n');

  const currentAssets = await queryAssets(customer, {
    assetType,
    assetGroupId,
    campaignId,
    includeDisabled: false
  });

  const currentCount = currentAssets.length;

  if (verbose) {
    console.log(`Current Count: ${currentCount}`);
    console.log(`Limits: Min=${config.min || 0}, Max=${config.max || 'unlimited'}`);
  }

  // Validate current state
  const validation = validateAssetCount(assetType, currentCount, isCampaignLevel);
  if (!validation.valid) {
    throw new Error(`Current state invalid: ${validation.message}`);
  }

  // ========================================
  // STEP 2: Language detection & categorization
  // ========================================
  if (verbose) console.log('\n🌍 STEP 2: Detecting languages...\n');

  const languageBreakdown = categorizeByLanguage(currentAssets, ['english', 'spanish', 'portuguese']);

  if (verbose) {
    Object.keys(languageBreakdown).forEach(lang => {
      const count = languageBreakdown[lang].length;
      if (count > 0) {
        console.log(`  ${lang.charAt(0).toUpperCase() + lang.slice(1)}: ${count} assets`);
        if (count <= 3) {
          languageBreakdown[lang].forEach(a => {
            console.log(`    - "${a.text?.substring(0, 50)}${a.text?.length > 50 ? '...' : ''}"`);
          });
        }
      }
    });
  }

  // ========================================
  // STEP 3: Determine what to remove
  // ========================================
  if (verbose) console.log('\n🎯 STEP 3: Planning swap strategy...\n');

  let assetsToRemove = [];

  if (removeAllOtherLanguages) {
    // Remove all assets that aren't in target language
    Object.keys(languageBreakdown).forEach(lang => {
      if (lang !== targetLanguage.code && lang !== 'unknown') {
        assetsToRemove = assetsToRemove.concat(languageBreakdown[lang]);
      }
    });

    // Also remove unknown language assets to be safe
    if (targetLanguage.code !== 'unknown') {
      assetsToRemove = assetsToRemove.concat(languageBreakdown.unknown || []);
    }
  }

  const removeAssetIds = assetsToRemove.map(a => a.id);
  const addCount = newAssetIds.length;
  const removeCount = removeAssetIds.length;

  if (verbose) {
    console.log(`Plan: Remove ${removeCount} assets, Add ${addCount} new ${targetLanguage.name} assets`);
    console.log(`Final count will be: ${currentCount - removeCount + addCount}`);
  }

  // Validate final count
  const finalCount = currentCount - removeCount + addCount;
  const finalValidation = validateAssetCount(assetType, finalCount, isCampaignLevel);

  if (!finalValidation.valid) {
    throw new Error(`Swap would result in invalid state: ${finalValidation.message}. Current: ${currentCount}, Remove: ${removeCount}, Add: ${addCount}, Final: ${finalCount}`);
  }

  // Calculate strategy
  const strategy = calculateSwapStrategy(
    assetType,
    currentCount,
    removeCount,
    addCount,
    isCampaignLevel
  );

  if (!strategy.valid) {
    throw new Error(`Invalid swap strategy: ${strategy.warnings.join(', ')}`);
  }

  if (verbose) {
    console.log('\nSwap Strategy:');
    strategy.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.action} - ${step.reason} (count: ${step.count || step.pairs || 'N/A'})`);
    });
  }

  // ========================================
  // STEP 4: Execute swap
  // ========================================
  if (verbose) {
    console.log('\n⚙️  STEP 4: Executing swap...\n');
  }

  const swapResult = await sequentialSwap(customer, {
    accountId,
    assetGroupId,
    campaignId,
    assetType,
    removeAssetIds,
    addAssetIds: newAssetIds,
    delayMs,
    onProgress: (progress) => {
      if (verbose && progress.stage !== 'QUERY' && progress.stage !== 'VALIDATE') {
        console.log(`  [${progress.stage}] ${progress.message}`);
      }
    }
  });

  if (!swapResult.success) {
    console.error('\n❌ Swap completed with errors:');
    swapResult.errors.forEach((err, i) => {
      console.error(`  ${i + 1}. ${err.error || JSON.stringify(err)}`);
    });
  }

  // ========================================
  // STEP 5: Verify and report final state
  // ========================================
  if (verbose) console.log('\n✅ STEP 5: Verifying final state...\n');

  const finalAssets = await queryAssets(customer, {
    assetType,
    assetGroupId,
    campaignId,
    includeDisabled: false
  });

  const finalLanguageBreakdown = categorizeByLanguage(finalAssets, ['english', 'spanish', 'portuguese']);

  const report = {
    success: swapResult.success,
    assetType,
    before: {
      total: currentCount,
      byLanguage: Object.keys(languageBreakdown).reduce((acc, lang) => {
        acc[lang] = languageBreakdown[lang].length;
        return acc;
      }, {})
    },
    changes: {
      removed: swapResult.removed,
      added: swapResult.added,
      errors: swapResult.errors
    },
    after: {
      total: finalAssets.length,
      byLanguage: Object.keys(finalLanguageBreakdown).reduce((acc, lang) => {
        acc[lang] = finalLanguageBreakdown[lang].length;
        return acc;
      }, {})
    },
    config: {
      min: config.min || 0,
      max: config.max || 'unlimited',
      charLimit: config.char_limit || null
    }
  };

  if (verbose) {
    console.log('Final State:');
    console.log(`  Total: ${report.after.total} assets`);
    console.log('  By Language:');
    Object.keys(report.after.byLanguage).forEach(lang => {
      const count = report.after.byLanguage[lang];
      if (count > 0) {
        const before = report.before.byLanguage[lang] || 0;
        const change = count - before;
        const changeStr = change > 0 ? `+${change}` : change < 0 ? `${change}` : 'no change';
        console.log(`    ${lang.charAt(0).toUpperCase() + lang.slice(1)}: ${count} (${changeStr})`);
      }
    });

    console.log('\n' + '='.repeat(70));
    if (swapResult.success) {
      console.log('✅ SWAP COMPLETED SUCCESSFULLY');
    } else {
      console.log('⚠️  SWAP COMPLETED WITH ERRORS (see details above)');
    }
    console.log('='.repeat(70) + '\n');
  }

  return report;
}

module.exports = {
  queryAssets,
  getAssetContent,
  removeAssets,
  addAssets,
  sequentialSwap,
  analyzeAndSwap
};
