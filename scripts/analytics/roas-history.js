/**
 * ROAS History Timeseries - X=Time, Y=ROAS
 * /scripts/analytics/roas-history.js
 *
 * Uses same attribution logic as roas-revenue.js
 * Groups data by time periods (daily/weekly/monthly)
 * Returns timeseries data points for line chart visualization
 */

const mysql = require('mysql2/promise');

/**
 * Enhanced Google Ads attribution logic (same as roas-revenue.js)
 */
function buildEnhancedAttributionQuery() {
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

      OR

      -- FIX: GOOGLE BUSINESS - Reclassify gb sources with GCLID
      (
        hc.hs_analytics_source = 'Other Campaigns'
        AND hc.hs_analytics_source_data_1 = 'gb'
        AND hc.gclid IS NOT NULL
        AND hc.gclid != ''
      )
    )
  `;
}

/**
 * Get ROAS timeseries data
 */
async function getROASTimeseries(getDbConnection, options = {}) {
  try {
    console.log('📈 Starting ROAS Timeseries Analysis...');

    const {
      status = 'active',
      startDate,
      endDate,
      campaigns: campaignsFilter = null, // Array of campaign names to filter
      granularity = 'daily' // daily, weekly, monthly
    } = options;

    if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required');
    }

    const connection = await getDbConnection();

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      console.log(`📅 Period: ${startDate} to ${endDate} (${daysDiff} days)`);
      console.log(`📊 Granularity: ${granularity}`);

      // Build status filter
      let statusFilter;
      switch(status.toLowerCase()) {
        case 'active': statusFilter = 'c.status = 2'; break;
        case 'paused': statusFilter = 'c.status = 3'; break;
        case 'all': statusFilter = 'c.status IN (2, 3)'; break;
        default: statusFilter = 'c.status = 2';
      }

      // Build campaign filter
      let campaignFilter = '';
      let campaignParams = [];
      if (campaignsFilter && campaignsFilter.length > 0) {
        const placeholders = campaignsFilter.map(() => '?').join(',');
        campaignFilter = `AND c.campaign_name IN (${placeholders})`;
        campaignParams = campaignsFilter;
        console.log(`🎯 Filtering ${campaignsFilter.length} campaign(s)`);
      }

      // Determine date grouping based on granularity
      let dateGrouping, dateFormat;
      if (granularity === 'weekly') {
        dateGrouping = 'DATE_SUB(DATE(m.date), INTERVAL WEEKDAY(DATE(m.date)) DAY)';
        dateFormat = '%Y-%m-%d';
      } else if (granularity === 'monthly') {
        dateGrouping = "DATE_FORMAT(DATE(m.date), '%Y-%m-01')";
        dateFormat = '%Y-%m-01';
      } else {
        dateGrouping = 'DATE(m.date)';
        dateFormat = '%Y-%m-%d';
      }

      // Query for timeseries data - GROUP BY campaign AND period
      const query = `
        SELECT
          spend_data.campaign_name,
          spend_data.period_date,
          spend_data.period_spend,
          COALESCE(revenue_data.period_revenue, 0) as period_revenue,
          COALESCE(contact_data.period_contacts, 0) as period_contacts,
          COALESCE(revenue_data.period_won_deals, 0) as period_won_deals
        FROM (
          -- Get spend by campaign and period
          SELECT
            c.campaign_name,
            ${dateGrouping} as period_date,
            COALESCE(SUM(m.cost_eur), 0) as period_spend
          FROM gads_campaign_metrics m
          INNER JOIN gads_campaigns c ON m.google_campaign_id = c.google_campaign_id
          WHERE ${statusFilter}
            AND m.date >= ? AND m.date <= ?
            ${campaignFilter}
          GROUP BY c.campaign_name, ${dateGrouping}
        ) spend_data

        LEFT JOIN (
          -- Get revenue by campaign and period
          SELECT
            c.campaign_name,
            ${dateGrouping.replace('m.date', 'hd.closedate')} as period_date,
            COALESCE(SUM(CAST(hd.amount as DECIMAL(15,2))), 0) as period_revenue,
            COUNT(DISTINCT hd.hubspot_deal_id) as period_won_deals
          FROM hub_deals hd
          JOIN hub_contact_deal_associations a ON hd.hubspot_deal_id = a.deal_hubspot_id
          JOIN hub_contacts hc ON a.contact_hubspot_id = hc.hubspot_id
          JOIN gads_campaigns c ON (
            hc.google_ads_campaign = c.campaign_name
            OR hc.hs_analytics_source_data_1 = c.campaign_name
          )
          WHERE hd.dealstage = 'closedwon'
            AND hd.pipeline = 'default'
            AND hd.closedate >= ? AND hd.closedate <= ?
            AND ${statusFilter.replace('c.status', 'c.status')}
            AND ${buildEnhancedAttributionQuery()}
            AND (
              hc.hubspot_owner_id != 10017927
              OR hc.hubspot_owner_id IS NULL
              OR hc.hubspot_owner_id = ''
            )
            AND hc.territory != 'Unsupported Territory'
            ${campaignFilter}
          GROUP BY c.campaign_name, ${dateGrouping.replace('m.date', 'hd.closedate')}
        ) revenue_data ON spend_data.campaign_name = revenue_data.campaign_name
                       AND spend_data.period_date = revenue_data.period_date

        LEFT JOIN (
          -- Get contact count by campaign and period
          SELECT
            c.campaign_name,
            ${dateGrouping.replace('m.date', 'hc.createdate')} as period_date,
            COUNT(DISTINCT hc.hubspot_id) as period_contacts
          FROM hub_contacts hc
          JOIN gads_campaigns c ON (
            hc.google_ads_campaign = c.campaign_name
            OR hc.hs_analytics_source_data_1 = c.campaign_name
          )
          WHERE ${buildEnhancedAttributionQuery()}
            AND hc.createdate >= ? AND hc.createdate <= ?
            AND ${statusFilter.replace('c.status', 'c.status')}
            AND (
              hc.hubspot_owner_id != 10017927
              OR hc.hubspot_owner_id IS NULL
              OR hc.hubspot_owner_id = ''
            )
            AND hc.territory != 'Unsupported Territory'
            ${campaignFilter}
          GROUP BY c.campaign_name, ${dateGrouping.replace('m.date', 'hc.createdate')}
        ) contact_data ON spend_data.campaign_name = contact_data.campaign_name
                       AND spend_data.period_date = contact_data.period_date

        ORDER BY spend_data.campaign_name, period_date
      `;

      const queryParams = [
        startDate, endDate, ...campaignParams, // spend query
        startDate, endDate, ...campaignParams, // revenue query
        startDate, endDate, ...campaignParams  // contact query
      ];

      console.log(`🔍 Executing timeseries query...`);
      const [results] = await connection.execute(query, queryParams);

      console.log(`✅ Retrieved ${results.length} time periods`);

      // Process results - group by campaign
      const campaignMap = new Map();
      let totalSpend = 0;
      let totalRevenue = 0;

      results.forEach(row => {
        const campaignName = row.campaign_name;
        const spend = parseFloat(row.period_spend) || 0;
        const revenue = parseFloat(row.period_revenue) || 0;
        const roas = spend > 0 ? revenue / spend : 0;

        totalSpend += spend;
        totalRevenue += revenue;

        if (!campaignMap.has(campaignName)) {
          campaignMap.set(campaignName, []);
        }

        campaignMap.get(campaignName).push({
          date: row.period_date,
          spend: spend,
          revenue: revenue,
          roas: parseFloat(roas.toFixed(4)),
          contacts: parseInt(row.period_contacts) || 0,
          won_deals: parseInt(row.period_won_deals) || 0
        });
      });

      // Convert map to object
      const campaigns = {};
      campaignMap.forEach((data, name) => {
        campaigns[name] = data;
      });

      const overallROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

      return {
        success: true,
        campaigns: campaigns,
        summary: {
          total_campaigns: campaignMap.size,
          total_spend: totalSpend,
          total_revenue: totalRevenue,
          overall_roas: overallROAS
        },
        metadata: {
          status_filter: status,
          start_date: startDate,
          end_date: endDate,
          total_days: daysDiff,
          granularity: granularity,
          campaigns_filter: campaignsFilter,
          analysis_description: 'Cash Basis ROAS Timeseries (Deal Close Date)'
        },
        timestamp: new Date().toISOString()
      };

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('❌ ROAS Timeseries failed:', error.message);
    return {
      success: false,
      error: error.message,
      campaigns: {},
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getROASTimeseries
};
