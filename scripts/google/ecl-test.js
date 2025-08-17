/**
 * ECL Test Module - Simplified Business Logic
 * File: /scripts/google/ecl-test.js
 * 
 * Uses explicit environment variables without NODE_ENV detection
 */

const eclHandler = require('./ecl-handler');

/**
 * Test Google Ads connection and list conversion actions
 */
async function testConversionActions() {
  try {
    console.log('Testing Google Ads connection and listing conversion actions...');
    
    const { customer, customerId } = await eclHandler.initializeGoogleAdsClient();
    
    const query = `
      SELECT 
        conversion_action.id,
        conversion_action.name,
        conversion_action.resource_name,
        conversion_action.type,
        conversion_action.status,
        conversion_action.category,
        conversion_action.counting_type,
        conversion_action.click_through_lookback_window_days,
        conversion_action.view_through_lookback_window_days
      FROM conversion_action
      WHERE conversion_action.status IN ('ENABLED', 'PAUSED')
      ORDER BY conversion_action.id DESC
      LIMIT 20
    `;
    
    const results = await customer.query(query);
    
    const conversionActions = results.map(row => ({
      id: row.conversion_action.id,
      name: row.conversion_action.name,
      resource_name: row.conversion_action.resource_name,
      type: row.conversion_action.type,
      status: row.conversion_action.status,
      category: row.conversion_action.category,
      counting_type: row.conversion_action.counting_type,
      click_lookback_days: row.conversion_action.click_through_lookback_window_days,
      view_lookback_days: row.conversion_action.view_through_lookback_window_days
    }));
    
    // Find the specific ULearn conversion action
    const ulearnAction = conversionActions.find(action => 
      action.id === '938018560' || action.name.includes('Submit lead form')
    );
    
    return {
      success: true,
      google_ads_account: customerId,
      conversion_actions: conversionActions,
      total_found: conversionActions.length,
      ulearn_action_found: !!ulearnAction,
      ulearn_action: ulearnAction || null,
      environment_info: {
        conversion_customer_id: process.env.GADS_CONVERSION_CUSTOMER_ID,
        login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
        conversion_action_id: process.env.GADS_CONVERSION_ACTION_ID
      },
      instructions: {
        next_steps: [
          "Verify your 'Submit lead form (thanks)' action is listed above",
          "Confirm GADS_CONVERSION_ACTION_ID=938018560 is in your .env",
          "Test specific action with GET /gads/ecl/test-action/938018560",
          "Run ECL test with POST /gads/ecl"
        ]
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('ECL test failed:', error.message);
    throw new Error(`Google Ads connection test failed: ${error.message}`);
  }
}

/**
 * Validate specific conversion action by ID
 */
async function testSpecificAction(actionId) {
  try {
    console.log(`Testing specific conversion action: ${actionId}`);
    
    const { customer, customerId } = await eclHandler.initializeGoogleAdsClient();
    
    const conversionActionResource = await eclHandler.getConversionAction(customer, {
      preferredId: actionId
    });
    
    const query = `
      SELECT 
        conversion_action.id,
        conversion_action.name,
        conversion_action.resource_name,
        conversion_action.type,
        conversion_action.status,
        conversion_action.category,
        conversion_action.counting_type,
        conversion_action.attribution_model_settings.attribution_model,
        conversion_action.click_through_lookback_window_days,
        conversion_action.view_through_lookback_window_days
      FROM conversion_action
      WHERE conversion_action.id = ${actionId}
    `;
    
    const results = await customer.query(query);
    
    if (results.length === 0) {
      throw new Error(`Conversion action ${actionId} not found`);
    }
    
    const action = results[0].conversion_action;
    
    return {
      success: true,
      google_ads_account: customerId,
      conversion_action: {
        id: action.id,
        name: action.name,
        resource_name: action.resource_name,
        type: action.type,
        status: action.status,
        category: action.category,
        counting_type: action.counting_type,
        attribution_model: action.attribution_model_settings?.attribution_model,
        click_lookback_days: action.click_through_lookback_window_days,
        view_lookback_days: action.view_through_lookback_window_days
      },
      validation: {
        is_enabled: action.status === 'ENABLED',
        suitable_for_ecl: action.type === 'WEBPAGE' && action.status === 'ENABLED',
        is_ulearn_action: action.id === '938018560',
        resource_name_built: conversionActionResource
      },
      sample_test_payload: {
        conversion_action_id: action.id,
        order_id: "ULEARN-TEST-001",
        adjustment_type: "RESTATEMENT", 
        adjustment_value: 300.00,
        currency_code: "EUR",
        contact_email: "test@ulearntest.com",
        stage: "engaging"
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('ECL action test failed:', error.message);
    throw new Error(`Conversion action validation failed: ${error.message}`);
  }
}

/**
 * Check ECL database logs and statistics
 */
async function testECLLogs(getDbConnection, limit = 10) {
  try {
    console.log(`Checking ECL logs (last ${limit} entries)...`);
    
    const connection = await getDbConnection();
    
    try {
      const [tables] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = 'ecl_logs'
      `);
      
      if (tables.length === 0) {
        return {
          success: true,
          message: 'ECL logs table does not exist yet - will be created on first ECL request',
          table_exists: false,
          timestamp: new Date().toISOString()
        };
      }
      
      const [logs] = await connection.execute(`
        SELECT 
          id, deal_id, contact_id, stage, adjustment_type, adjustment_value,
          gclid, order_id, is_mql_rejection, success, error_message, created_at
        FROM ecl_logs 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [limit]);
      
      const [stats] = await connection.execute(`
        SELECT 
          COUNT(*) as total_attempts,
          SUM(success) as successful_attempts,
          SUM(is_mql_rejection) as mql_rejections,
          COUNT(DISTINCT order_id) as unique_order_ids,
          COUNT(DISTINCT gclid) as unique_gclids
        FROM ecl_logs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `);
      
      const [stageStats] = await connection.execute(`
        SELECT 
          stage,
          adjustment_type,
          COUNT(*) as count,
          AVG(adjustment_value) as avg_value,
          SUM(success) as successful
        FROM ecl_logs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY stage, adjustment_type
        ORDER BY count DESC
      `);
      
      return {
        success: true,
        table_exists: true,
        recent_logs: logs,
        summary_stats: stats[0] || {},
        stage_breakdown: stageStats,
        logs_count: logs.length,
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('ECL logs test failed:', error.message);
    throw new Error(`Database logs check failed: ${error.message}`);
  }
}

/**
 * Generate sample test payloads for ULearn pipeline stages
 */
function generateULearnTestPayloads() {
  const baseOrderId = `ULEARN-TEST-${Date.now()}`;
  
  return {
    mql_rejection: {
      conversion_action_id: "938018560",
      order_id: `${baseOrderId}-REJECT`,
      adjustment_type: "RETRACTION",
      contact_email: "test.mql.reject@ulearntest.com",
      contact_phone: "+353871234567",
      stage: "mql_rejected",
      rejection_reason: "unsupported_territory",
      contact_id: "TEST123456",
      deal_id: null
    },
    sql_inbox: {
      conversion_action_id: "938018560",
      order_id: `${baseOrderId}-SQL`,
      adjustment_type: "RESTATEMENT",
      adjustment_value: 120.00,
      currency_code: "EUR",
      contact_email: "test.sql@ulearntest.com",
      contact_phone: "+353871234567",
      stage: "sql_inbox",
      contact_id: "TEST123457",
      deal_id: "DEAL123001"
    },
    engaging: {
      conversion_action_id: "938018560",
      order_id: `${baseOrderId}-ENGAGING`,
      adjustment_type: "RESTATEMENT",
      adjustment_value: 300.00,
      currency_code: "EUR",
      contact_email: "test.engaging@ulearntest.com",
      contact_phone: "+353871234567",
      stage: "engaging",
      contact_id: "TEST123458",
      deal_id: "DEAL123002"
    },
    responsive: {
      conversion_action_id: "938018560",
      order_id: `${baseOrderId}-RESPONSIVE`,
      adjustment_type: "RESTATEMENT",
      adjustment_value: 600.00,
      currency_code: "EUR",
      contact_email: "test.responsive@ulearntest.com",
      contact_phone: "+353871234567",
      stage: "responsive",
      contact_id: "TEST123459",
      deal_id: "DEAL123003"
    },
    won: {
      conversion_action_id: "938018560",
      order_id: `${baseOrderId}-WON`,
      adjustment_type: "RESTATEMENT",
      adjustment_value: 1200.00,
      currency_code: "EUR",
      contact_email: "test.won@ulearntest.com",
      contact_phone: "+353871234567",
      stage: "won",
      contact_id: "TEST123460",
      deal_id: "DEAL123004"
    }
  };
}

/**
 * Validate ECL payload structure
 */
function validateECLPayload(payload) {
  const errors = [];
  
  if (!payload.conversion_action && !payload.conversion_action_id && !payload.conversion_action_name) {
    errors.push('Missing conversion action identifier');
  }
  
  if (!payload.order_id && !payload.gclid) {
    errors.push('Missing conversion identifier (order_id or gclid)');
  }
  
  if (payload.gclid && !payload.original_conversion_date_time) {
    errors.push('original_conversion_date_time required when using gclid');
  }
  
  if (payload.adjustment_type === 'RESTATEMENT') {
    if (payload.adjustment_value === undefined || isNaN(parseFloat(payload.adjustment_value))) {
      errors.push('Valid adjustment_value required for RESTATEMENT');
    }
  }
  
  if (payload.contact_email && !payload.contact_email.includes('@')) {
    errors.push('Invalid email format');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    recommendations: {
      use_order_id: !payload.order_id && payload.gclid,
      set_currency: !payload.currency_code && payload.adjustment_value,
      include_enhanced_conversions: !payload.contact_email && !payload.contact_phone
    }
  };
}

module.exports = {
  testConversionActions,
  testSpecificAction,
  testECLLogs,
  generateULearnTestPayloads,
  validateECLPayload
};