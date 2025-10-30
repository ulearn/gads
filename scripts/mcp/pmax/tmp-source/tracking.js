/**
 * Campaign Tracking Template Utility
 *
 * Generic functions for managing Google Ads campaign tracking templates,
 * custom parameters, and final URL suffixes.
 */

/**
 * Query campaign tracking settings
 *
 * @param {Object} customer - Google Ads customer object
 * @param {string} campaignId - Campaign ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Campaign tracking settings
 */
async function getCampaignTracking(customer, campaignId, options = {}) {
  const { verbose = false } = options;

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.tracking_url_template,
      campaign.url_custom_parameters,
      campaign.final_url_suffix
    FROM campaign
    WHERE campaign.id = ${campaignId}
  `;

  try {
    const results = await customer.query(query);

    if (results.length === 0) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const campaign = results[0].campaign;
    const tracking = {
      id: campaign.id.toString(),
      name: campaign.name,
      tracking_url_template: campaign.tracking_url_template || null,
      final_url_suffix: campaign.final_url_suffix || null,
      url_custom_parameters: campaign.url_custom_parameters || []
    };

    if (verbose) {
      console.log(`\nCampaign: ${tracking.name} (ID: ${tracking.id})`);
      console.log(`  Tracking Template: ${tracking.tracking_url_template || 'Not set'}`);
      console.log(`  Final URL Suffix: ${tracking.final_url_suffix || 'Not set'}`);
      console.log(`  Custom Parameters: ${JSON.stringify(tracking.url_custom_parameters, null, 2)}`);
    }

    return tracking;

  } catch (error) {
    throw new Error(`Failed to query campaign tracking for ${campaignId}: ${error.message}`);
  }
}

/**
 * Update campaign tracking template
 *
 * @param {Object} customer - Google Ads customer object
 * @param {string} accountId - Google Ads account ID
 * @param {string} campaignId - Campaign ID
 * @param {Object} trackingSettings - Tracking settings to update
 * @param {string} trackingSettings.tracking_url_template - Tracking URL template
 * @param {Array<Object>} trackingSettings.url_custom_parameters - Custom parameters [{key, value}]
 * @param {string} trackingSettings.final_url_suffix - Final URL suffix (optional)
 * @param {Object} options - Update options
 * @returns {Promise<Object>} Update result
 */
async function updateCampaignTracking(customer, accountId, campaignId, trackingSettings, options = {}) {
  const { verbose = false, verify = true } = options;

  const operation = {
    resource_name: `customers/${accountId}/campaigns/${campaignId}`
  };

  // Add tracking settings to operation
  if (trackingSettings.tracking_url_template !== undefined) {
    operation.tracking_url_template = trackingSettings.tracking_url_template;
  }

  if (trackingSettings.url_custom_parameters !== undefined) {
    operation.url_custom_parameters = trackingSettings.url_custom_parameters;
  }

  if (trackingSettings.final_url_suffix !== undefined) {
    operation.final_url_suffix = trackingSettings.final_url_suffix;
  }

  if (verbose) {
    console.log(`\nUpdating tracking for campaign ${campaignId}...`);
    console.log('  Settings:', JSON.stringify(trackingSettings, null, 2));
  }

  try {
    const result = await customer.campaigns.update([operation]);

    if (verbose) {
      console.log('✅ Tracking template updated successfully');
    }

    // Verify the update if requested
    if (verify) {
      const verification = await getCampaignTracking(customer, campaignId, { verbose: false });

      if (verbose) {
        console.log('\nVerification:');
        console.log(`  Tracking Template: ${verification.tracking_url_template}`);
        console.log(`  Custom Parameters: ${JSON.stringify(verification.url_custom_parameters, null, 2)}`);
      }

      return {
        success: true,
        result,
        verification
      };
    }

    return { success: true, result };

  } catch (error) {
    if (verbose) {
      console.error('❌ Update failed:', error.message);
      if (error.errors) {
        error.errors.forEach((err, i) => {
          console.error(`  Error ${i + 1}:`, err.message || err);
        });
      }
    }
    throw new Error(`Failed to update campaign tracking: ${error.message}`);
  }
}

/**
 * Compare tracking settings between two campaigns
 *
 * @param {Object} tracking1 - First campaign tracking settings
 * @param {Object} tracking2 - Second campaign tracking settings
 * @param {Object} options - Comparison options
 * @returns {Object} Comparison result with match status and differences
 */
function compareTrackingSettings(tracking1, tracking2, options = {}) {
  const { verbose = false } = options;

  const comparison = {
    tracking_template_match: tracking1.tracking_url_template === tracking2.tracking_url_template,
    final_url_suffix_match: tracking1.final_url_suffix === tracking2.final_url_suffix,
    custom_parameters_match: JSON.stringify(tracking1.url_custom_parameters) === JSON.stringify(tracking2.url_custom_parameters),
    differences: []
  };

  // Track differences
  if (!comparison.tracking_template_match) {
    comparison.differences.push({
      field: 'tracking_url_template',
      campaign1: tracking1.tracking_url_template,
      campaign2: tracking2.tracking_url_template
    });
  }

  if (!comparison.final_url_suffix_match) {
    comparison.differences.push({
      field: 'final_url_suffix',
      campaign1: tracking1.final_url_suffix,
      campaign2: tracking2.final_url_suffix
    });
  }

  if (!comparison.custom_parameters_match) {
    comparison.differences.push({
      field: 'url_custom_parameters',
      campaign1: tracking1.url_custom_parameters,
      campaign2: tracking2.url_custom_parameters
    });
  }

  comparison.fully_aligned = comparison.tracking_template_match &&
                             comparison.final_url_suffix_match &&
                             comparison.custom_parameters_match;

  if (verbose) {
    console.log('\n' + '='.repeat(70));
    console.log('TRACKING COMPARISON');
    console.log('='.repeat(70));
    console.log(`\nCampaign 1: ${tracking1.name} (${tracking1.id})`);
    console.log(`Campaign 2: ${tracking2.name} (${tracking2.id})`);
    console.log('\nResults:');
    console.log(`  Tracking Template: ${comparison.tracking_template_match ? '✅ MATCH' : '❌ DIFFERENT'}`);
    console.log(`  Final URL Suffix: ${comparison.final_url_suffix_match ? '✅ MATCH' : '❌ DIFFERENT'}`);
    console.log(`  Custom Parameters: ${comparison.custom_parameters_match ? '✅ MATCH' : '❌ DIFFERENT'}`);

    if (comparison.differences.length > 0) {
      console.log('\nDifferences:');
      comparison.differences.forEach(diff => {
        console.log(`\n  ${diff.field}:`);
        console.log(`    ${tracking1.name}: ${JSON.stringify(diff.campaign1)}`);
        console.log(`    ${tracking2.name}: ${JSON.stringify(diff.campaign2)}`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log(comparison.fully_aligned ? '✅ FULLY ALIGNED' : '⚠️  MISALIGNED');
    console.log('='.repeat(70));
  }

  return comparison;
}

/**
 * Validate tracking template for common issues
 *
 * @param {string} trackingTemplate - Tracking URL template to validate
 * @param {string} campaignId - Campaign ID (for checking hardcoded IDs)
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with issues and warnings
 */
function validateTrackingTemplate(trackingTemplate, campaignId, options = {}) {
  const { verbose = false } = options;

  const validation = {
    valid: true,
    issues: [],
    warnings: []
  };

  if (!trackingTemplate) {
    validation.valid = false;
    validation.issues.push('No tracking template set');
    return validation;
  }

  // Check for hardcoded campaign IDs
  const hardcodedCampaignIds = trackingTemplate.match(/hsa_cam=(\d+)/g);
  if (hardcodedCampaignIds) {
    const ids = hardcodedCampaignIds.map(match => match.replace('hsa_cam=', ''));
    ids.forEach(id => {
      if (id !== campaignId) {
        validation.issues.push({
          type: 'WRONG_CAMPAIGN_ID',
          message: `Hardcoded wrong campaign ID: ${id} (should be ${campaignId})`,
          severity: 'critical'
        });
        validation.valid = false;
      } else {
        validation.warnings.push({
          type: 'HARDCODED_CAMPAIGN_ID',
          message: `Hardcoded campaign ID found: ${id} (should use {campaignid})`,
          severity: 'warning'
        });
      }
    });
  }

  // Check if uses dynamic {campaignid}
  const usesDynamicId = trackingTemplate.includes('{campaignid}');
  if (!usesDynamicId && hardcodedCampaignIds) {
    validation.warnings.push({
      type: 'MISSING_DYNAMIC_PLACEHOLDER',
      message: 'Should use {campaignid} placeholder instead of hardcoded ID',
      severity: 'warning'
    });
  }

  // Check for required UTM parameters
  const requiredParams = ['utm_source', 'utm_medium', 'utm_campaign'];
  requiredParams.forEach(param => {
    if (!trackingTemplate.includes(param)) {
      validation.warnings.push({
        type: 'MISSING_UTM_PARAMETER',
        message: `Missing recommended parameter: ${param}`,
        severity: 'info'
      });
    }
  });

  if (verbose) {
    console.log('\n' + '='.repeat(70));
    console.log('TRACKING TEMPLATE VALIDATION');
    console.log('='.repeat(70));
    console.log(`\nTemplate: ${trackingTemplate}`);
    console.log(`\nStatus: ${validation.valid ? '✅ VALID' : '❌ INVALID'}`);

    if (validation.issues.length > 0) {
      console.log('\nIssues:');
      validation.issues.forEach(issue => {
        console.log(`  ❌ [${issue.severity}] ${issue.message}`);
      });
    }

    if (validation.warnings.length > 0) {
      console.log('\nWarnings:');
      validation.warnings.forEach(warning => {
        console.log(`  ⚠️  [${warning.severity}] ${warning.message}`);
      });
    }

    console.log('='.repeat(70));
  }

  return validation;
}

/**
 * Build standard tracking template
 *
 * @param {Object} params - Template parameters
 * @param {string} params.accountId - Google Ads account ID
 * @param {string} params.campaignName - Campaign name for utm_campaign parameter
 * @param {Object} options - Build options
 * @returns {Object} Tracking settings (template and custom parameters)
 */
function buildStandardTrackingTemplate(params, options = {}) {
  const {
    accountId,
    campaignName
  } = params;

  const {
    includeHsaParams = true,
    hsaVersion = 3
  } = options;

  // Base UTM parameters
  let template = '{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={_cname}&utm_term={keyword}&utm_content={creative}';

  // Add HubSpot Analytics (hsa) parameters if requested
  if (includeHsaParams) {
    template += `&hsa_acc=${accountId}&hsa_cam={campaignid}&hsa_grp={adgroupid}&hsa_ad={creative}&hsa_src={network}&hsa_tgt={targetid}&hsa_mt={matchtype}&hsa_net=adwords&hsa_ver=${hsaVersion}&hsa_kw={keyword}`;
  }

  const customParameters = [{
    key: 'cname',
    value: campaignName
  }];

  return {
    tracking_url_template: template,
    url_custom_parameters: customParameters
  };
}

module.exports = {
  getCampaignTracking,
  updateCampaignTracking,
  compareTrackingSettings,
  validateTrackingTemplate,
  buildStandardTrackingTemplate
};
