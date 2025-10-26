/**
 * ENHANCED: Burn Rate Analysis Module with Attribution Fix
 * Path: /home/hub/public_html/gads/scripts/analytics/burn.js
 *
 * UPDATED: Now uses google_ads_campaign as PRIMARY attribution field
 * - google_ads_campaign: Standardized campaign names (96% of contacts)
 * - hs_analytics_source_data_1: Fallback for unmapped legacy contacts
 * - Simplified attribution logic prioritizing clean campaign names
 *
 * Handles all burn rate-related queries and analysis
 * Receives database connection from index.js
 */

const mysql = require('mysql2/promise');

/**
 * SIMPLIFIED: Build Google Ads attribution query - prioritizes google_ads_campaign
 */
function buildEnhancedGoogleAdsAttributionQuery() {
  return `
    (
      -- PRIMARY: PAID_SEARCH contacts with google_ads_campaign populated
      (
        hc.hs_analytics_source = 'PAID_SEARCH'
        AND hc.google_ads_campaign IS NOT NULL
        AND hc.google_ads_campaign != ''
      )

      OR

      -- FALLBACK: PAID_SEARCH contacts without google_ads_campaign (legacy/unmapped)
      (
        hc.hs_analytics_source = 'PAID_SEARCH'
        AND (hc.google_ads_campaign IS NULL OR hc.google_ads_campaign = '')
        AND hc.hs_analytics_source_data_1 IS NOT NULL
        AND hc.hs_analytics_source_data_1 != ''
        AND hc.hs_analytics_source_data_1 != '{campaign}'
      )
    )
  `;
}

/**
 * ENHANCED: Get comprehensive burn rate analysis with attribution fixes
 * @param {Function} getDbConnection - Database connection function
 * @param {Object} options - Analysis options
 * @param {number} options.days - Number of days to analyze (default: 30)
 * @returns {Object} Comprehensive burn rate analysis
 */
async function getBurnRateAnalysis(getDbConnection, options = {}) {
  try {
    console.log('🔥 Performing enhanced burn rate analysis with attribution fixes...');
    
    const days = options.days || 30;
    
    const connection = await getDbConnection();
    
    try {
      // Calculate date range
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1));
      startDate.setHours(0, 0, 0, 0);
      
      const startDateStr = startDate.toISOString().slice(0, 10);
      const endDateStr = endDate.toISOString().slice(0, 10);
      
      console.log(`📅 Analysis period: ${startDateStr} to ${endDateStr} (${days} days)`);
      
      // ENHANCED: Get attribution quality metrics
      console.log(`🔍 Analyzing attribution quality...`);
      const [attributionQuality] = await connection.execute(`
        SELECT 
          COUNT(CASE 
            WHEN hc.hs_analytics_source = 'PAID_SEARCH' 
            AND hc.hs_analytics_source_data_1 != '{campaign}'
            AND hc.hs_analytics_source_data_1 IS NOT NULL
            AND hc.hs_analytics_source_data_1 != ''
            THEN 1 
          END) as standard_attribution,
          COUNT(CASE 
            WHEN hc.hs_analytics_source = 'PAID_SEARCH'
            AND hc.hs_analytics_source_data_1 = '{campaign}'
            AND hc.google_ads_campaign IS NOT NULL
            AND hc.google_ads_campaign != ''
            THEN 1 
          END) as enhanced_attribution,
          COUNT(CASE 
            WHEN hc.hs_analytics_source = 'PAID_SEARCH'
            AND hc.hs_analytics_source_data_1 = '{campaign}'
            THEN 1 
          END) as broken_template_count,
          COUNT(*) as total_google_ads_contacts
        FROM hub_contacts hc
        WHERE ${buildEnhancedGoogleAdsAttributionQuery()}
          AND (hc.hubspot_owner_id != 10017927 OR hc.hubspot_owner_id IS NULL OR hc.hubspot_owner_id = '')
          AND DATE(hc.createdate) >= ? AND DATE(hc.createdate) <= ?
      `, [startDateStr, endDateStr]);
      
      const attrQuality = attributionQuality[0] || {};
      console.log(`🔧 Attribution Quality:`, {
        standard: attrQuality.standard_attribution || 0,
        enhanced: attrQuality.enhanced_attribution || 0,
        broken_templates: attrQuality.broken_template_count || 0,
        total: attrQuality.total_google_ads_contacts || 0
      });
      
      // ENHANCED: Get burn rate analysis with enhanced attribution
      const [burnResults] = await connection.execute(`
        SELECT 
          COUNT(*) as total_contacts,
          COUNT(CASE WHEN hc.territory = 'Unsupported Territory' THEN 1 END) as unsupported_contacts,
          COUNT(CASE WHEN hc.territory != 'Unsupported Territory' OR hc.territory IS NULL THEN 1 END) as supported_contacts,
          
          -- Enhanced attribution breakdown
          COUNT(CASE 
            WHEN hc.hs_analytics_source = 'PAID_SEARCH' 
            AND hc.hs_analytics_source_data_1 != '{campaign}'
            AND hc.hs_analytics_source_data_1 IS NOT NULL
            AND hc.hs_analytics_source_data_1 != ''
            THEN 1 
          END) as standard_attribution_contacts,
          COUNT(CASE 
            WHEN hc.hs_analytics_source = 'PAID_SEARCH'
            AND hc.hs_analytics_source_data_1 = '{campaign}'
            AND hc.google_ads_campaign IS NOT NULL
            AND hc.google_ads_campaign != ''
            THEN 1 
          END) as enhanced_attribution_contacts,
          
          -- Burn rate by attribution type
          COUNT(CASE 
            WHEN hc.territory = 'Unsupported Territory'
            AND hc.hs_analytics_source = 'PAID_SEARCH' 
            AND hc.hs_analytics_source_data_1 != '{campaign}'
            AND hc.hs_analytics_source_data_1 IS NOT NULL
            AND hc.hs_analytics_source_data_1 != ''
            THEN 1 
          END) as standard_burned_contacts,
          COUNT(CASE 
            WHEN hc.territory = 'Unsupported Territory'
            AND hc.hs_analytics_source = 'PAID_SEARCH'
            AND hc.hs_analytics_source_data_1 = '{campaign}'
            AND hc.google_ads_campaign IS NOT NULL
            AND hc.google_ads_campaign != ''
            THEN 1 
          END) as enhanced_burned_contacts
          
        FROM hub_contacts hc
        WHERE ${buildEnhancedGoogleAdsAttributionQuery()}
          AND (hc.hubspot_owner_id != 10017927 OR hc.hubspot_owner_id IS NULL OR hc.hubspot_owner_id = '')
          AND DATE(hc.createdate) >= ? AND DATE(hc.createdate) <= ?
      `, [startDateStr, endDateStr]);
      
      const burnData = burnResults[0] || {};
      
      // Calculate burn rate metrics
      const totalContacts = parseInt(burnData.total_contacts) || 0;
      const unsupportedContacts = parseInt(burnData.unsupported_contacts) || 0;
      const supportedContacts = parseInt(burnData.supported_contacts) || 0;
      
      const burnRate = totalContacts > 0 ? ((unsupportedContacts / totalContacts) * 100).toFixed(2) : 0;
      const supportRate = totalContacts > 0 ? ((supportedContacts / totalContacts) * 100).toFixed(2) : 0;
      
      // Enhanced attribution metrics
      const standardContacts = parseInt(burnData.standard_attribution_contacts) || 0;
      const enhancedContacts = parseInt(burnData.enhanced_attribution_contacts) || 0;
      const standardBurned = parseInt(burnData.standard_burned_contacts) || 0;
      const enhancedBurned = parseInt(burnData.enhanced_burned_contacts) || 0;
      
      // Get nationality breakdown
      const [nationalityResults] = await connection.execute(`
        SELECT 
          COALESCE(hc.nationality, 'Unknown') as nationality,
          COUNT(*) as burned_contacts,
          ROUND((COUNT(*) * 25), 2) as estimated_waste_eur
        FROM hub_contacts hc
        WHERE ${buildEnhancedGoogleAdsAttributionQuery()}
          AND hc.territory = 'Unsupported Territory'
          AND (hc.hubspot_owner_id != 10017927 OR hc.hubspot_owner_id IS NULL OR hc.hubspot_owner_id = '')
          AND DATE(hc.createdate) >= ? 
          AND DATE(hc.createdate) <= ?
        GROUP BY hc.nationality
        ORDER BY burned_contacts DESC
        LIMIT 10
      `, [startDateStr, endDateStr]);
      
      // Calculate waste estimates
      const estimatedWasteEur = unsupportedContacts * 25; // €25 per wasted contact
      const potentialSavings = estimatedWasteEur * 0.8; // 80% could be prevented with better targeting
      
      const result = {
        success: true,
        period: `${startDateStr} to ${endDateStr} (${days} days)`,
        summary: {
          total_contacts: totalContacts,
          supported_contacts: supportedContacts,
          unsupported_contacts: unsupportedContacts,
          burn_rate_percentage: parseFloat(burnRate),
          support_rate_percentage: parseFloat(supportRate),
          estimated_waste_eur: estimatedWasteEur,
          potential_savings_eur: potentialSavings
        },
        attribution_breakdown: {
          standard_attribution: {
            contacts: standardContacts,
            burned_contacts: standardBurned,
            burn_rate: standardContacts > 0 ? ((standardBurned / standardContacts) * 100).toFixed(2) : 0
          },
          enhanced_attribution: {
            contacts: enhancedContacts,
            burned_contacts: enhancedBurned,
            burn_rate: enhancedContacts > 0 ? ((enhancedBurned / enhancedContacts) * 100).toFixed(2) : 0
          },
          total_attributed: standardContacts + enhancedContacts,
          enhancement_recovery: attrQuality.broken_template_count > 0 ? 
            ((attrQuality.enhanced_attribution / attrQuality.broken_template_count) * 100).toFixed(1) + '%' : '100%'
        },
        nationality_breakdown: nationalityResults.map(row => ({
          nationality: row.nationality,
          burned_contacts: parseInt(row.burned_contacts),
          estimated_waste: parseFloat(row.estimated_waste_eur),
          percentage: unsupportedContacts > 0 ? 
            ((parseInt(row.burned_contacts) / unsupportedContacts) * 100).toFixed(1) : 0
        })),
        attribution_enhancement: {
          status: 'ACTIVE',
          features: [
            'Enhanced Google Ads attribution with {campaign} fix',
            'Multi-layered attribution matching',
            'Burn rate analysis enhancement',
            'Attribution quality reporting'
          ],
          quality_metrics: {
            standard_attribution: parseInt(attrQuality.standard_attribution) || 0,
            enhanced_attribution: parseInt(attrQuality.enhanced_attribution) || 0,
            broken_template_count: parseInt(attrQuality.broken_template_count) || 0,
            total_contacts: parseInt(attrQuality.total_google_ads_contacts) || 0,
            enhancement_coverage: attrQuality.broken_template_count > 0 ? 
              ((attrQuality.enhanced_attribution / attrQuality.broken_template_count) * 100).toFixed(1) + '%' : '100%'
          }
        },
        recommendations: generateBurnRateRecommendations({
          burnRate: parseFloat(burnRate),
          unsupportedContacts,
          estimatedWaste: estimatedWasteEur,
          topNationalities: nationalityResults.slice(0, 3),
          enhancedContacts
        }),
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Enhanced burn rate analysis complete:`);
      console.log(`   🔥 Burn Rate: ${burnRate}%`);
      console.log(`   👥 Total Contacts: ${totalContacts.toLocaleString()}`);
      console.log(`   💸 Estimated Waste: €${estimatedWasteEur.toLocaleString()}`);
      console.log(`   🔧 Enhanced Attribution: ${enhancedContacts} contacts recovered`);
      
      return result;
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Enhanced burn rate analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      attribution_enhancement: {
        status: 'ERROR',
        error: error.message
      },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Generate burn rate optimization recommendations
 * @param {Object} data - Burn rate analysis data
 * @returns {Array} Array of recommendations
 */
function generateBurnRateRecommendations(data) {
  const recommendations = [];
  const { burnRate, unsupportedContacts, estimatedWaste, topNationalities, enhancedContacts } = data;
  
  // High burn rate recommendations
  if (burnRate > 40) {
    recommendations.push({
      type: 'critical',
      category: 'Burn Rate',
      title: 'Critical Burn Rate Alert',
      message: `Burn rate is ${burnRate}% - over 40% of ad spend is wasted`,
      action: 'Immediately review and exclude unsupported territories from targeting',
      priority: 1,
      impact: `Could save €${(estimatedWaste * 0.8).toFixed(0)} monthly`
    });
  } else if (burnRate > 25) {
    recommendations.push({
      type: 'high',
      category: 'Burn Rate',
      title: 'High Burn Rate Warning',
      message: `Burn rate is ${burnRate}% - significantly above optimal 15%`,
      action: 'Optimize geographic targeting and exclude high-burn territories',
      priority: 2,
      impact: `Could save €${(estimatedWaste * 0.6).toFixed(0)} monthly`
    });
  }
  
  // Territory-specific recommendations
  if (topNationalities.length > 0) {
    const topNationality = topNationalities[0];
    if (parseInt(topNationality.burned_contacts) > 10) {
      recommendations.push({
        type: 'medium',
        category: 'Geographic Targeting',
        title: `High Burn Rate from ${topNationality.nationality}`,
        message: `${topNationality.nationality} accounts for ${topNationality.burned_contacts} burned contacts`,
        action: `Consider excluding ${topNationality.nationality} or creating specific campaigns with adjusted messaging`,
        priority: 3,
        impact: `Could save €${topNationality.estimated_waste_eur} monthly`
      });
    }
  }
  
  // Attribution enhancement acknowledgment
  if (enhancedContacts > 0) {
    recommendations.push({
      type: 'success',
      category: 'Attribution Enhancement',
      title: 'Attribution Recovery Active',
      message: `Attribution enhancement has recovered ${enhancedContacts} contacts from broken tracking`,
      action: 'Continue monitoring attribution quality and ensure custom field population',
      priority: 4,
      impact: 'Maintains data accuracy for optimization decisions'
    });
  }
  
  // Cost optimization recommendation
  if (estimatedWaste > 1000) {
    recommendations.push({
      type: 'high',
      category: 'Budget Optimization',
      title: 'Significant Budget Waste Detected',
      message: `Estimated monthly waste: €${estimatedWaste.toLocaleString()}`,
      action: 'Implement negative location targeting and optimize audience exclusions',
      priority: 2,
      impact: `Recover up to €${(estimatedWaste * 0.7).toFixed(0)} for profitable campaigns`
    });
  }
  
  return recommendations.sort((a, b) => a.priority - b.priority);
}

/**
 * ENHANCED: Get burn rate by campaign with attribution fixes
 * @param {Function} getDbConnection - Database connection function
 * @param {Object} options - Analysis options
 * @returns {Object} Burn rate analysis by campaign
 */
async function getBurnRateByCampaign(getDbConnection, options = {}) {
  try {
    console.log('📊 Getting enhanced burn rate analysis by campaign...');
    
    const days = options.days || 30;
    const connection = await getDbConnection();
    
    try {
      // Calculate date range
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1));
      startDate.setHours(0, 0, 0, 0);
      
      const startDateStr = startDate.toISOString().slice(0, 10);
      const endDateStr = endDate.toISOString().slice(0, 10);
      
      // STEP 1: Get all campaigns (same as ROAS dashboard)
      const [allCampaigns] = await connection.execute(`
        SELECT
          google_campaign_id,
          campaign_name,
          status,
          campaign_type_name
        FROM gads_campaigns
        WHERE status IN (2, 3)
        ORDER BY campaign_name
      `);

      console.log(`📊 Found ${allCampaigns.length} campaigns to analyze`);

      // STEP 2: Get contacts for each campaign (same matching logic as ROAS dashboard)
      const campaignResults = [];

      for (const campaign of allCampaigns) {
        const [contactResults] = await connection.execute(`
          SELECT
            COUNT(DISTINCT hc.hubspot_id) as total_contacts,
            COUNT(DISTINCT CASE WHEN hc.territory = 'Unsupported Territory' THEN hc.hubspot_id END) as burned_contacts,
            COUNT(DISTINCT CASE WHEN hc.territory != 'Unsupported Territory' OR hc.territory IS NULL THEN hc.hubspot_id END) as supported_contacts,
            COUNT(DISTINCT CASE
              WHEN hc.hs_analytics_source = 'PAID_SEARCH'
              AND hc.hs_analytics_source_data_1 != '{campaign}'
              AND hc.hs_analytics_source_data_1 IS NOT NULL
              AND hc.hs_analytics_source_data_1 != ''
              THEN hc.hubspot_id
            END) as standard_attribution_count,
            COUNT(DISTINCT CASE
              WHEN hc.hs_analytics_source = 'PAID_SEARCH'
              AND hc.hs_analytics_source_data_1 = '{campaign}'
              AND hc.google_ads_campaign IS NOT NULL
              AND hc.google_ads_campaign != ''
              THEN hc.hubspot_id
            END) as enhanced_attribution_count
          FROM hub_contacts hc
          WHERE ${buildEnhancedGoogleAdsAttributionQuery()}
            AND (
              -- PRIMARY: Match by standardized google_ads_campaign name
              hc.google_ads_campaign = ?
              OR
              -- FALLBACK: Match by legacy campaign ID or name in source_data_1
              hc.hs_analytics_source_data_1 = ?
              OR
              hc.hs_analytics_source_data_1 = ?
            )
            AND (hc.hubspot_owner_id != 10017927 OR hc.hubspot_owner_id IS NULL OR hc.hubspot_owner_id = '')
            AND DATE(hc.createdate) >= ? AND DATE(hc.createdate) <= ?
        `, [
          campaign.google_campaign_id,
          campaign.campaign_name,
          campaign.campaign_name,
          startDateStr,
          endDateStr
        ]);

        const contacts = contactResults[0];
        const totalContacts = parseInt(contacts.total_contacts) || 0;

        // Only include campaigns with contacts
        if (totalContacts > 0) {
          campaignResults.push({
            google_campaign_id: campaign.google_campaign_id,
            campaign_name: campaign.campaign_name,
            status: campaign.status,
            campaign_type_name: campaign.campaign_type_name,
            total_contacts: totalContacts,
            burned_contacts: parseInt(contacts.burned_contacts) || 0,
            supported_contacts: parseInt(contacts.supported_contacts) || 0,
            standard_attribution_count: parseInt(contacts.standard_attribution_count) || 0,
            enhanced_attribution_count: parseInt(contacts.enhanced_attribution_count) || 0
          });
        }
      }

      console.log(`✅ Found ${campaignResults.length} campaigns with contacts`);
      
      // Process campaign results - sort by burned contacts
      const campaigns = campaignResults
        .map(row => {
          const totalContacts = row.total_contacts;
          const burnedContacts = row.burned_contacts;
          const supportedContacts = row.supported_contacts;
          const burnRate = totalContacts > 0 ? ((burnedContacts / totalContacts) * 100).toFixed(2) : 0;

          return {
            google_campaign_id: row.google_campaign_id,
            campaign_identifier: row.campaign_name || 'Unknown Campaign',
            campaign_name: row.campaign_name || 'Unknown Campaign',
            status: parseInt(row.status) || 0,
            campaign_type_name: row.campaign_type_name || 'Unknown',
            total_contacts: totalContacts,
            burned_contacts: burnedContacts,
            supported_contacts: supportedContacts,
            burn_rate_percentage: parseFloat(burnRate),
            estimated_waste_eur: burnedContacts * 25, // €25 per wasted contact
            attribution_breakdown: {
              standard_count: row.standard_attribution_count,
              enhanced_count: row.enhanced_attribution_count,
              enhancement_percentage: totalContacts > 0 ?
                ((row.enhanced_attribution_count / totalContacts) * 100).toFixed(1) : '0'
            },
            performance_rating: getBurnRateRating(parseFloat(burnRate))
          };
        })
        .sort((a, b) => b.burned_contacts - a.burned_contacts); // Sort by burned contacts descending
      
      // Calculate summary
      const totalContacts = campaigns.reduce((sum, c) => sum + c.total_contacts, 0);
      const totalBurned = campaigns.reduce((sum, c) => sum + c.burned_contacts, 0);
      const totalWaste = campaigns.reduce((sum, c) => sum + c.estimated_waste_eur, 0);
      const overallBurnRate = totalContacts > 0 ? ((totalBurned / totalContacts) * 100).toFixed(2) : 0;
      
      // Performance distribution
      const excellentCampaigns = campaigns.filter(c => c.burn_rate_percentage <= 15).length;
      const goodCampaigns = campaigns.filter(c => c.burn_rate_percentage > 15 && c.burn_rate_percentage <= 25).length;
      const averageCampaigns = campaigns.filter(c => c.burn_rate_percentage > 25 && c.burn_rate_percentage <= 40).length;
      const poorCampaigns = campaigns.filter(c => c.burn_rate_percentage > 40).length;
      
      console.log(`✅ Enhanced campaign burn rate analysis complete:`);
      console.log(`   📊 Total Campaigns: ${campaigns.length}`);
      console.log(`   🔥 Overall Burn Rate: ${overallBurnRate}%`);
      console.log(`   💸 Total Waste: €${totalWaste.toLocaleString()}`);
      
      return {
        success: true,
        period: `${startDateStr} to ${endDateStr} (${days} days)`,
        campaigns: campaigns,
        summary: {
          total_campaigns: campaigns.length,
          total_contacts: totalContacts,
          total_burned: totalBurned,
          overall_burn_rate: parseFloat(overallBurnRate),
          total_waste_eur: totalWaste
        },
        performance_distribution: {
          excellent: excellentCampaigns,  // ≤15%
          good: goodCampaigns,           // 15-25%
          average: averageCampaigns,     // 25-40%
          poor: poorCampaigns            // >40%
        },
        attribution_enhancement: {
          status: 'ACTIVE',
          campaigns_enhanced: campaigns.filter(c => c.attribution_breakdown.enhanced_count > 0).length
        },
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ Enhanced campaign burn rate analysis failed:', error.message);
    return {
      success: false,
      error: error.message,
      attribution_enhancement: {
        status: 'ERROR',
        error: error.message
      },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Helper function to rate burn rate performance
 */
function getBurnRateRating(burnRate) {
  if (burnRate <= 15) return 'Excellent';
  if (burnRate <= 25) return 'Good';
  if (burnRate <= 40) return 'Average';
  return 'Poor';
}

// Export functions
module.exports = {
  getBurnRateAnalysis,
  getBurnRateByCampaign,
  generateBurnRateRecommendations,
  // Export enhanced attribution functions for consistency
  buildEnhancedGoogleAdsAttributionQuery
};