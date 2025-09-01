const express = require('express');
const mysql = require('mysql2/promise');
const hubspot = require('@hubspot/api-client');
const hubspotSync = require('./scripts/hubspot/hubspot-sync');
const hubspotTest = require('./scripts/hubspot/hubspot-test');
const hubspotData = require('./scripts/analytics/hubspot-data');
const { google } = require('googleapis');
const { GoogleAdsApi } = require('google-ads-api');
const dashboardServer = require('./scripts/analytics/dashboard-server');
const pipelineProb = require('./scripts/analytics/pipeline-probs');
const eclHandler = require('./scripts/google/ecl-handler');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config();

// Set up logging with auto-rotation (only if logger exists)
let logger = null;
try {
  logger = require('./logger');
  logger.setupLogger();
} catch (error) {
  console.warn('⚠️ Logger not found, using console logging');
  logger = {
    getLogStats: () => ({ message: 'Console logging active' })
  };
}

//=========================================================================
// Express Application Setup (Receiving HTTP Requests)
//=========================================================================
const app = express();
const router = express.Router();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Use router for all your routes, then mount it
app.use('/gads', router);
const PORT = process.env.PORT || 8080;


//=============================================================================//
//   CENTRALIZED API CLIENT SETUP
//=============================================================================//

// HubSpot Client - Initialized once
const hubspotClient = new hubspot.Client({ 
  accessToken: process.env.HubAccess 
});

// Google Ads OAuth Client - Initialized once  
const googleOAuth = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Set refresh token
googleOAuth.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

// Database Connection Pool - Reusable
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create database connection helper
const getDbConnection = async () => {
  return await mysql.createConnection(dbConfig);
};

//=============================================================================//
//   SAFE MODULE LOADING
//=============================================================================//

const modules = {
  mysqlCampaignUpdater: null,
  pipelineProb: null,
  dashboardServer: null,
  mcpServer: null
};

// Load MySQL Campaign Updater
try {
  modules.mysqlCampaignUpdater = require('./update-mysql-campaigns.js');
  console.log('✅ MySQL Campaign Updater loaded');
} catch (error) {
  console.warn('⚠️ MySQL Campaign Updater not found');
}

// Load Pipeline Probabilities
try {
  modules.pipelineProb = require('./scripts/analytics/pipeline-probs');
  console.log('✅ Pipeline Probabilities loaded');
} catch (error) {
  console.warn('⚠️ Pipeline Probabilities not found');
}

// Load Dashboard Server
try {
  modules.dashboardServer = require('./scripts/analytics/dashboard-server');
  console.log('✅ Dashboard Server loaded');
} catch (error) {
  console.warn('⚠️ Dashboard Server not found');
}

// Load MCP Server Module
try {
  modules.mcpServer = require('./scripts/mcp/mcp-server');
  console.log('✅ MCP Server loaded');
} catch (error) {
  console.warn('⚠️ MCP Server not found');
}

//=============================================================================//
//   MCP AUTHENTICATION SETUP
//=============================================================================//

// Generate MCP Bearer Token
const MCP_BEARER_TOKEN = process.env.MCP_BEARER_TOKEN || `ulearn-mcp-${crypto.randomBytes(8).toString('hex')}`;
console.log(`🔑 MCP Bearer Token: ${MCP_BEARER_TOKEN}`);

// MCP Authentication middleware
const mcpAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Bearer token required' });
  }
  
  const token = authHeader.substring(7);
  if (token !== MCP_BEARER_TOKEN) {
    return res.status(401).json({ error: 'Invalid bearer token' });
  }
  
  next();
};

//=============================================================================//
//   BASIC ROUTES
//=============================================================================//

// Root dashboard
router.get('/', (req, res) => {
  const hasUpdater = !!modules.mysqlCampaignUpdater;
  const hasDashboard = !!modules.dashboardServer;
  const hasPipeline = !!modules.pipelineProb;
  const hasMCP = !!modules.mcpServer;
  
  res.send(`
    <h1>🎯 Google Ads AI Iterator - RECOVERY MODE v6</h1>
    <p><strong>System Status:</strong> Running | <strong>Build:</strong> ${new Date().toISOString()}</p>
    
    <h2>🏥 System Health</h2>
    <p><a href="/gads/health">Health Check</a> | <a href="/gads/test">Environment Test</a></p>
    
    <h2>📊 Available Features</h2>
    ${hasDashboard ? `
      <h3>✅ Analytics Dashboard</h3>
      <p><a href="/gads/dashboard">📊 Main Dashboard</a></p>
    ` : `
      <p style="color: #d63384;">❌ Dashboard Server not available</p>
    `}
    
    ${hasPipeline ? `
      <h3>✅ Pipeline Analysis</h3>
      <p><a href="/gads/analytics/pipeline">📈 Pipeline Analysis</a></p>
      <p><a href="/gads/analytics/prob?days=30">📈 Pipeline Probabilities (API)</a></p>
    ` : `
      <p style="color: #d63384;">❌ Pipeline Analysis not available</p>
    `}

    ${hasMCP ? `
      <h3>✅ Claude AI Integration</h3>
      <p><a href="/gads/mcp/health">🤖 MCP Health Check</a></p>
    ` : `
      <p style="color: #d63384;">❌ MCP Server not available</p>
    `}
    
    <h3>📁 Direct File Access</h3>
    <p><a href="/gads/scripts/analytics/burn-rate.html">Burn Rate HTML</a></p>
    
    <h2>🔧 Recovery</h2>
    <p><a href="/gads/recovery/status">Recovery Status</a></p>
  `);
});

// Health check
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      hubspot: 'unknown', 
      google_ads: 'unknown'
    },
    recovery_mode: true,
    loaded_modules: {
      mysql_campaign_updater: !!modules.mysqlCampaignUpdater,
      pipeline_probabilities: !!modules.pipelineProb,
      dashboard_server: !!modules.dashboardServer,
      mcp_server: !!modules.mcpServer
    }
  };

  // Test database
  try {
    const connection = await getDbConnection();
    await connection.execute('SELECT 1');
    await connection.end();
    health.services.database = 'connected';
  } catch (error) {
    health.services.database = 'error';
    health.status = 'degraded';
  }

  // Test HubSpot
  try {
    await hubspotClient.crm.contacts.basicApi.getPage(1);
    health.services.hubspot = 'connected';
  } catch (error) {
    health.services.hubspot = 'error';
    health.status = 'degraded';
  }

  // Test Google OAuth
  try {
    await googleOAuth.refreshAccessToken();
    health.services.google_ads = 'connected';
  } catch (error) {
    health.services.google_ads = 'error';
    health.status = 'degraded';
  }

  res.json(health);
});

// Environment test
router.get('/test', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    recovery_mode: true,
    api_clients: {
      hubspot_token: process.env.HubAccess ? 'Present' : 'Missing',
      google_client_id: process.env.CLIENT_ID ? 'Present' : 'Missing',
      google_refresh_token: process.env.GOOGLE_REFRESH_TOKEN ? 'Present' : 'Missing'
    },
    database: {
      host: process.env.DB_HOST || 'Missing',
      name: process.env.DB_NAME || 'Missing',
      user: process.env.DB_USER ? 'Present' : 'Missing'
    },
    logging: logger ? logger.getLogStats() : { message: 'Console logging' },
    loaded_modules: {
      mysql_campaign_updater: !!modules.mysqlCampaignUpdater,
      pipeline_probabilities: !!modules.pipelineProb,
      dashboard_server: !!modules.dashboardServer,
      mcp_server: !!modules.mcpServer
    }
  });
});

//=============================================================================//
//   MCP ROUTES - ROUTING ONLY
//=============================================================================//

// MCP Health endpoint (no auth needed)
router.get('/mcp/health', (req, res) => {
  if (!modules.mcpServer) {
    return res.status(503).json({
      error: 'MCP module not available',
      service: "ULearn Google Ads MCP Server",
      status: "unavailable"
    });
  }
  
  modules.mcpServer.handleHealth(req, res);
});

// MCP Capabilities
router.get('/mcp/capabilities', mcpAuth, (req, res) => {
  if (!modules.mcpServer) {
    return res.status(503).json({ error: 'MCP module not available' });
  }
  
  modules.mcpServer.handleCapabilities(req, res);
});

// MCP Tools List
router.get('/mcp/tools/list', mcpAuth, (req, res) => {
  if (!modules.mcpServer) {
    return res.status(503).json({ error: 'MCP module not available' });
  }
  
  modules.mcpServer.handleToolsList(req, res);
});

// MCP Tools Call
router.post('/mcp/tools/call', mcpAuth, express.json(), async (req, res) => {
  if (!modules.mcpServer) {
    return res.status(503).json({ error: 'MCP module not available' });
  }
  
  // Pass the authenticated clients to the MCP module (same pattern as ECL routes)
  await modules.mcpServer.handleToolsCall(req, res, {
    getDbConnection,
    hubspotClient,
    googleOAuth
  });
});

//=============================================================================//
//   HUBSPOT MAIN SYNC ROUTES
//=============================================================================//

// Main HubSpot sync route - MINIMAL ROUTING ONLY
router.get('/hubspot/sync', async (req, res) => {
  try {
    // Parse query parameters for different sync options
    const { days, start, end, month } = req.query;
    
    let syncOptions = {};
    let description = '';
    
    // Determine sync type from parameters
    if (start && end) {
      // Date range sync
      syncOptions = { startDate: start, endDate: end };
      description = `Date range sync: ${start} to ${end}`;
    } else if (month) {
      // Month sync (format: YYYY-MM)
      const [year, monthNum] = month.split('-');
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0); // Last day of month
      syncOptions = { 
        startDate: startDate.toISOString().split('T')[0], 
        endDate: endDate.toISOString().split('T')[0] 
      };
      description = `Month sync: ${month}`;
    } else if (days) {
      // Days back sync (backwards compatibility)
      const daysBack = parseInt(days) || 30;
      syncOptions = { daysBack };
      description = `Sync last ${daysBack} days`;
    } else {
      // Default: last 30 days
      syncOptions = { daysBack: 30 };
      description = 'Default sync (last 30 days)';
    }
    
    console.log(`🔄 Starting HubSpot sync: ${description}`);
    
    // Return immediately, run sync in background
    res.json({
      success: true,
      service: 'HubSpot',
      message: description,
      status: 'running',
      options: syncOptions,
      timestamp: new Date().toISOString()
    });
    
    // Run sync with authenticated clients in background
    (async () => {
      try {
        // Call the schema-aware function
        const result = await hubspotSync.runSyncWithSchemaCheck(hubspotClient, getDbConnection, syncOptions);
        console.log(`✅ HubSpot sync completed:`, result);
      } catch (error) {
        console.error('❌ Background sync failed:', error.message);
      }
    })();
    
  } catch (error) {
    console.error('❌ HubSpot sync failed:', error.message);
    res.status(500).json({
      success: false,
      service: 'HubSpot',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// HubSpot contact fetch route
router.get('/hubspot/contact/:id', async (req, res) => {
  try {
    const contactId = req.params.id;
    console.log(`🔍 Fetching HubSpot contact ${contactId}...`);
    
    const hubspotTest = require('./scripts/hubspot/hubspot-test');
    const result = await hubspotTest.fetchSpecificContact(hubspotClient, contactId);
    
    // Return summary (full data is saved to file)
    res.json({
      success: true,
      service: 'HubSpot',
      contactId: contactId,
      summary: {
        totalProperties: Object.keys(result.allProperties).length,
        nonNullProperties: Object.entries(result.allProperties)
          .filter(([k, v]) => v !== null && v !== '').length,
        hasDeals: result.associations && result.associations.length > 0,
        dealCount: result.associations ? result.associations.length : 0
      },
      keyData: {
        email: result.allProperties.email,
        name: `${result.allProperties.firstname || ''} ${result.allProperties.lastname || ''}`.trim(),
        country: result.allProperties.country,
        lifecyclestage: result.allProperties.lifecyclestage,
        created: result.allProperties.createdate
      },
      message: `Full data saved to contact-${contactId}-export.json`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Contact fetch failed:', error.message);
    res.status(500).json({
      success: false,
      service: 'HubSpot',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});


//=============================================================================//
//   MYSQL ROUTES
//=============================================================================//

if (modules.mysqlCampaignUpdater) {
  router.post('/mysql/bulk-update-campaigns', (req, res) => {
    modules.mysqlCampaignUpdater.handleBulkCampaignUpdate(req, res, getDbConnection);
  });

  router.get('/mysql/campaign-stats', (req, res) => {
    modules.mysqlCampaignUpdater.handleCampaignStats(req, res, getDbConnection);
  });
}

//=============================================================================//
//   ANALYTICS ROUTES
//=============================================================================//

// Dashboard Route
router.get('/dashboard', (req, res) => {
  const dashboardServer = require('./scripts/analytics/dashboard-server');
  dashboardServer.serveDashboard(req, res);
});

// Pipeline Analysis Route - FIXED: Now uses proper server pattern
router.get('/analytics/pipeline', (req, res) => {
  const pipelineServer = require('./scripts/analytics/pipeline-server');
  pipelineServer.servePipelineDashboard(req, res);
});

// Pipeline Probabilities API (you already have this)
router.get('/analytics/prob', (req, res) => {
  pipelineProb.handleGetProbabilities(req, res, hubspotClient);
});

// Dashboard Data API - Enhanced with analysis mode
router.get('/analytics/dashboard-data', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const analysisMode = req.query.mode || 'pipeline';
    
    console.log(`📊 Dashboard data API: ${days} days, ${analysisMode} mode`);
    
    const hubspotData = require('./scripts/analytics/hubspot-data');
    const result = await hubspotData.getDashboardSummary(getDbConnection, days, analysisMode);
    res.json(result);
  } catch (error) {
    console.error('❌ Dashboard data API failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Campaign Performance API - Enhanced with analysis mode
router.get('/analytics/campaigns', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const analysisMode = req.query.mode || 'pipeline';
    
    console.log(`🎯 Campaign data API: ${days} days, ${analysisMode} mode`);
    
    const hubspotData = require('./scripts/analytics/hubspot-data');
    const result = await hubspotData.getCampaignPerformance(getDbConnection, days, analysisMode);
    res.json(result);
  } catch (error) {
    console.error('❌ Campaign data API failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Google Ads Metrics API - NEW: Dedicated endpoint for Google Ads data
router.get('/analytics/google-ads-metrics', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    console.log(`📊 Google Ads metrics API: ${days} days`);
    
    const result = await hubspotData.getGoogleAdsMetrics(getDbConnection, days);
    res.json(result);
  } catch (error) {
    console.error('❌ Google Ads metrics API failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Territory Analysis API - Enhanced with analysis mode
router.get('/analytics/territories', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const analysisMode = req.query.mode || 'pipeline';
    
    console.log(`🌍 Territory data API: ${days} days, ${analysisMode} mode`);
    
    const hubspotData = require('./scripts/analytics/hubspot-data');
    const result = await hubspotData.getTerritoryAnalysis(getDbConnection, days, analysisMode);
    res.json(result);
  } catch (error) {
    console.error('❌ Territory data API failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Trend Data API - Enhanced with analysis mode
router.get('/analytics/trends', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const analysisMode = req.query.mode || 'pipeline';
    
    console.log(`📈 Trend data API: ${days} days, ${analysisMode} mode`);
    
    const hubspotData = require('./scripts/analytics/hubspot-data');
    const result = await hubspotData.getTrendData(getDbConnection, days, analysisMode);
    res.json(result);
  } catch (error) {
    console.error('❌ Trend data API failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// NEW: MQL Validation Metrics API - The core Issue #2 fix
router.get('/analytics/mql-validation', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const analysisMode = req.query.mode || 'pipeline';
    
    console.log(`🎯 MQL Validation API: ${days} days, ${analysisMode} mode`);
    
    const hubspotData = require('./scripts/analytics/hubspot-data');
    const result = await hubspotData.getMQLValidationMetrics(getDbConnection, days, analysisMode);
    res.json(result);
  } catch (error) {
    console.error('❌ MQL validation API failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// CLEANED: Google Ads Attribution Test API - Business Logic Moved
router.get('/analytics/attribution-test', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    
    console.log(`🔍 Testing Google Ads attribution logic for ${days} days...`);
    
    const hubspotData = require('./scripts/analytics/hubspot-data');
    const result = await hubspotData.testGoogleAdsAttribution(getDbConnection, days);
    res.json(result);
    
  } catch (error) {
    console.error('❌ Attribution test failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});




// Burn Rate Timeseries API - ROUTING ONLY, NO BUSINESS LOGIC
router.get('/analytics/burn-rate-timeseries', (req, res) => {
  const burnRateTimeseries = require('./scripts/analytics/burn-rate-timeseries');
  burnRateTimeseries.handleBurnRateTimeseriesRequest(req, res, getDbConnection);
});

// Burn Rate Data API
router.get('/analytics/burn-rate-data', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const hubspotData = require('./scripts/analytics/hubspot-data');
    const result = await hubspotData.getTerritoryAnalysis(getDbConnection, days);
    res.json(result);
  } catch (error) {
    console.error('❌ Burn rate data failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

//=============================================================================//
//   ENHANCED CONVERSIONS FOR LEADS (ECL) ROUTES - ROUTING ONLY
//=============================================================================//

// HISTORIAL SECTION - WON'T BE USING ONCE SYSTEM IS UP & RUNNING 
// PROBABABLY BEST TO KEEP THEM JUST IN CASE THEY ARE REQUIRED IN FUTURE

//============================================================================//
// HISTORICAL#1 - Excluded: LOST & MAYBE/FUTURE (NOTE: WON is included)

// Test baseline deals filter vs UI
router.get('/ecl/baseline-deals', (req, res) => {
  const eclHistory = require('./scripts/google/ecl-history');
  eclHistory.handleBaselineDealsRequest(req, res, hubspotClient);
});

// Get deals ready for ECL upload
router.get('/ecl/baseline-ready', (req, res) => {
  const eclHistory = require('./scripts/google/ecl-history');  
  eclHistory.handleECLReadyRequest(req, res, hubspotClient);
});

// Process validated deals through ECL handler
router.post('/ecl/baseline-process', (req, res) => {
  const eclHistory = require('./scripts/google/ecl-history');
  eclHistory.handleECLProcessRequest(req, res, hubspotClient, getDbConnection);
});

// EMERGENCY ADJUSTOMENT OF HISTORICAL dateTime (use Deal create_date)
router.post('/ecl/baseline-fix-dates', (req, res) => {
  const eclHistory = require('./scripts/google/ecl-history');
  eclHistory.handleDateFixRequest(req, res, hubspotClient);
});

//===========================================================
// HISTORICAL#2 - ECL Rejected Contacts Routes  
router.get('/ecl/rejected-ready', (req, res) => {
  const eclRejected = require('./scripts/google/ecl-rejected');
  eclRejected.handleRejectedReadyRequest(req, res, hubspotClient);
});

router.post('/ecl/rejected-process', (req, res) => {
  const eclRejected = require('./scripts/google/ecl-rejected');
  eclRejected.handleRejectedProcessRequest(req, res, hubspotClient);
});
//============================================================
// HISTORICAL #3 - ECL Lost Deals
// Check readiness
router.get('/ecl/lost-ready', (req, res) => {
  const eclLost = require('./scripts/google/ecl-lost');
  eclLost.handleLostReadyRequest(req, res, hubspotClient);
});

// Process upload
router.post('/ecl/lost-process', (req, res) => {
  const eclLost = require('./scripts/google/ecl-lost');
  eclLost.handleLostProcessRequest(req, res, hubspotClient);
});

//=============================================================================//
//   ECL DIAGNOSTIC ROUTES - V2
//=============================================================================//

// Test conversion action setup with detailed diagnostics
router.get('/ecl/diagnose', async (req, res) => {
  try {
    console.log('🔍 Running ECL diagnostics...');
    const result = await eclHandler.testConversionActionSetup();
    res.json(result);
  } catch (error) {
    console.error('❌ ECL diagnostics failed:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test upload with validation only (won't actually send conversion)
router.post('/ecl/test', async (req, res) => {
  try {
    console.log('🧪 Testing ECL upload (validation only)...');
    
    // Force validation-only mode
    const testPayload = { 
      ...req.body, 
      validate_only: true,
      conversion_action_id: req.body.conversion_action_id || '938018560'
    };
    
    const result = await eclHandler.processConversionAdjustment(testPayload, {
      googleOAuth,
      getDbConnection
    });
    
    res.json({
      success: true,
      message: 'ECL test completed (validation only)',
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ ECL test failed:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get recent ECL logs for debugging
router.get('/ecl/logs', async (req, res) => {
  try {
    const connection = await getDbConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT 
          id, deal_id, contact_id, stage, adjustment_value, 
          order_id, success, error_message, created_at,
          processing_time_ms, currency_code
        FROM ecl_logs 
        ORDER BY created_at DESC 
        LIMIT 20
      `);
      
      res.json({
        success: true,
        logs: rows,
        count: rows.length,
        timestamp: new Date().toISOString()
      });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error('❌ ECL logs retrieval failed:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});



//-------------------------------------------------------
// Main ECL Webhook Endpoint
//---------------------------------------------------------
router.post('/ecl', async (req, res) => {
  try {
    console.log('ECL webhook received from HubSpot...');
    console.log('Payload:', JSON.stringify(req.body, null, 2));
    
    const result = await eclHandler.processConversionAdjustment(req.body, {
      getDbConnection
    });
    
    res.json({
      success: true,
      message: 'ECL conversion adjustment processed',
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('ECL webhook failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Simple ECL test route
router.get('/ecl/test-live', async (req, res) => {
  try {
    const result = await eclHandler.testLiveConnection();
    res.json(result);
  } catch (error) {
    console.error('ECL live test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

//=============================================================================//
//   STATIC FILE ROUTES
//=============================================================================//

router.get('/scripts/analytics/burn-rate.html', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'scripts', 'analytics', 'burn-rate.html');
    
    if (fs.existsSync(filePath)) {
      const htmlContent = fs.readFileSync(filePath, 'utf8');
      res.send(htmlContent);
    } else {
      res.status(404).send('<h1>File not found</h1><p>burn-rate.html not found</p>');
    }
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

router.get('/scripts/analytics/pipeline-analysis.html', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'scripts', 'analytics', 'pipeline-analysis.html');
    
    if (fs.existsSync(filePath)) {
      const htmlContent = fs.readFileSync(filePath, 'utf8');
      res.send(htmlContent);
    } else {
      res.status(404).send('<h1>File not found</h1><p>pipeline-analysis.html not found</p>');
    }
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

//=============================================================================//
//   RECOVERY ROUTES
//=============================================================================//

router.get('/recovery/status', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  const checkFile = (filePath) => {
    try {
      return fs.existsSync(path.join(__dirname, filePath));
    } catch {
      return false;
    }
  };

  res.json({
    recovery_mode: true,
    timestamp: new Date().toISOString(),
    loaded_modules: {
      mysql_campaign_updater: !!modules.mysqlCampaignUpdater,
      pipeline_probabilities: !!modules.pipelineProb,
      dashboard_server: !!modules.dashboardServer,
      mcp_server: !!modules.mcpServer
    },
    file_check: {
      'scripts/analytics/pipeline-probs.js': checkFile('scripts/analytics/pipeline-probs.js'),
      'scripts/analytics/dashboard-server.js': checkFile('scripts/analytics/dashboard-server.js'),
      'scripts/analytics/burn-rate.html': checkFile('scripts/analytics/burn-rate.html'),
      'scripts/analytics/pipeline-analysis.html': checkFile('scripts/analytics/pipeline-analysis.html'),
      'update-mysql-campaigns.js': checkFile('update-mysql-campaigns.js'),
      'scripts/mcp/mcp-server.js': checkFile('scripts/mcp/mcp-server.js')
    }
  });
});

// Logs endpoint
router.get('/logs', (req, res) => {
  try {
    const fs = require('fs');
    const logFile = './gads.log';
    
    if (!fs.existsSync(logFile)) {
      return res.json({
        message: 'No log file found yet',
        timestamp: new Date().toISOString(),
        recovery_mode: true
      });
    }
    
    const logs = fs.readFileSync(logFile, 'utf8');
    const lines = logs.split('\n').filter(line => line.trim()).slice(-50);
    
    res.json({
      recent_logs: lines,
      recovery_mode: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Log retrieval failed:', error.message);
    res.status(500).json({
      error: error.message,
      recovery_mode: true,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling
router.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error.message);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    recovery_mode: true,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
router.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    recovery_mode: true,
    available_endpoints: [
      '/gads/',
      '/gads/health', 
      '/gads/test',
      '/gads/recovery/status',
      '/gads/logs',
      modules.dashboardServer ? '/gads/dashboard' : null,
      modules.pipelineProb ? '/gads/analytics/prob' : null,
      modules.mcpServer ? '/gads/mcp/health' : null,
      modules.mcpServer ? '/gads/mcp/tools/list' : null,
      '/gads/scripts/analytics/burn-rate.html',
      '/gads/scripts/analytics/pipeline-analysis.html'
    ].filter(Boolean),
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎉 Google Ads AI Iterator started on port ${PORT} - RECOVERY MODE v6`);
  console.log(`📊 Dashboard: https://hub.ulearnschool.com/gads/`);
  console.log(`🏥 Health: https://hub.ulearnschool.com/gads/health`);
  console.log('');
  console.log('⚠️  RECOVERY MODE v6 ACTIVE:');
  console.log(`   🔧 MySQL Updater: ${modules.mysqlCampaignUpdater ? 'Available' : 'Missing'}`);
  console.log(`   📊 Dashboard: ${modules.dashboardServer ? 'Available' : 'Missing'}`);
  console.log(`   📈 Pipeline: ${modules.pipelineProb ? 'Available' : 'Missing'}`);
  console.log(`   🤖 MCP Server: ${modules.mcpServer ? 'Available' : 'Missing'}`);
});

// Log Claude Desktop configuration if MCP is available
if (modules.mcpServer) {
  console.log('\n🖥️ Claude Desktop Configuration:');
  console.log(JSON.stringify({
    mcpServers: {
      "ulearn-gads": {
        "url": "https://hub.ulearnschool.com/gads/mcp",
        "auth": {
          "type": "bearer",
          "token": MCP_BEARER_TOKEN
        }
      }
    }
  }, null, 2));
}

module.exports = app;