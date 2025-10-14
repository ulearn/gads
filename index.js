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
const mcpRouter = require('./scripts/mcp/mcp');

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

// SearchConsoleTrawler will be initialized after getDbConnection is defined

// Google Ads API Client - Initialized once
const googleAdsClient = new GoogleAdsApi({
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

const customer = googleAdsClient.Customer({
  customer_id: process.env.GADS_LIVE_ID,
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
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

// Initialize RND module AFTER getDbConnection is defined
try {
  console.log('🔬 Loading RND module...');
  const rndModule = require('./scripts/google/rnd/rnd-index');
  console.log('🔬 Calling RND module...');
  rndModule(router, googleOAuth, getDbConnection, customer);
  console.log('✅ RND module loaded successfully');
} catch (error) {
  console.error('❌ RND module failed to load:', error.message);
  console.error('RND Stack:', error.stack);
}


//=============================================================================//
//   SAFE MODULE LOADING
//=============================================================================//

const modules = {
  googleAdsSync: null,
  pipelineProb: null,
  dashboardServer: null,
  mcpServer: null
};

// Load Google Ads Sync Module
try {
  modules.googleAdsSync = require('./scripts/google/gads-sync.js');
  console.log('✅ Google Ads Sync module loaded');
} catch (error) {
  console.warn('⚠️ Google Ads Sync module not found');
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


//=============================================================================//
//   BASIC ROUTES
//=============================================================================//

// Root dashboard
router.get('/', (req, res) => {
  const hasGoogleAdsSync = !!modules.googleAdsSync;
  const hasDashboard = !!modules.dashboardServer;
  const hasPipeline = !!modules.pipelineProb;
  const hasMCP = !!modules.mcpServer;
  const isRecoveryMode = !hasGoogleAdsSync || !hasPipeline || !hasDashboard || !hasMCP;
  
  res.send(`
    <h1>🎯 Google Ads AI Iterator${isRecoveryMode ? ' - RECOVERY MODE v7' : ''}</h1>
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
      <p><strong>Claude Desktop URL:</strong> <code>https://hub.ulearnschool.com/gads/mcp</code></p>
      <p>Available Tools: Campaign Performance, Pipeline Analysis, Burn Rate, Audience Insights, Keyword Performance, Bid Updates</p>
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
  const isRecoveryMode = !modules.googleAdsSync || !modules.pipelineProb || !modules.dashboardServer || !modules.mcpServer;
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      hubspot: 'unknown', 
      google_ads: 'unknown'
    },
    recovery_mode: isRecoveryMode,
    loaded_modules: {
      google_ads_sync: !!modules.googleAdsSync,
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
  const isRecoveryMode = !modules.googleAdsSync || !modules.pipelineProb || !modules.dashboardServer || !modules.mcpServer;
  res.json({
    timestamp: new Date().toISOString(),
    recovery_mode: isRecoveryMode,
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
      google_ads_sync: !!modules.googleAdsSync,
      pipeline_probabilities: !!modules.pipelineProb,
      dashboard_server: !!modules.dashboardServer,
      mcp_server: !!modules.mcpServer
    }
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

if (modules.googleAdsSync) {
  // Google Ads sync endpoints
  router.get('/google-ads/sync/status', (req, res) => {
    modules.googleAdsSync.handleSyncStatus(req, res, getDbConnection);
  });
  
  router.post('/google-ads/sync/full', (req, res) => {
    modules.googleAdsSync.handleFullSync(req, res, customer, getDbConnection);
  });
  
  router.post('/google-ads/sync/incremental', (req, res) => {
    modules.googleAdsSync.handleIncrementalSync(req, res, customer, getDbConnection);
  });
  
  router.post('/google-ads/sync/campaigns', (req, res) => {
    modules.googleAdsSync.handleCampaignsSync(req, res, customer, getDbConnection);
  });
  
  router.post('/google-ads/sync/backfill', (req, res) => {
    modules.googleAdsSync.handleDateRangeBackfill(req, res, customer, getDbConnection);
  });
}

//=============================================================================//
//   ANALYTICS ROUTES
//=============================================================================//

// Keep the OLD route for backward compatibility but redirect to new one
router.get('/dashboard', (req, res) => {
  res.redirect('/gads/analytics/dashboard');
});


// Dashboard HTML Route - Serves the HTML file directly (like roas-revenue)
router.get('/analytics/dashboard', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'scripts', 'analytics', 'dashboard.html');
    
    if (fs.existsSync(filePath)) {
      const htmlContent = fs.readFileSync(filePath, 'utf8');
      res.send(htmlContent);
    } else {
      res.status(404).send('<h1>File not found</h1><p>dashboard.html not found</p>');
    }
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

// Dashboard Data API - Simple pass-through (already correct)
router.get('/analytics/dashboard-data', async (req, res) => {
  try {
    const hubspotData = require('./scripts/analytics/hubspot-data');
    const result = await hubspotData.getDashboardSummary(getDbConnection, req.query);
    res.json(result);
  } catch (error) {
    console.error('❌ Dashboard data API failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});


// ENHANCED: Campaign Performance API - Copy roas-revenue pattern  
router.get('/analytics/campaigns', async (req, res) => {
  try {
    const hubspotData = require('./scripts/analytics/hubspot-data');
    const result = await hubspotData.getCampaignPerformance(getDbConnection, req.query);
    res.json(result);
  } catch (error) {
    console.error('❌ Campaign data API failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ENHANCED: Territory Analysis API - Copy roas-revenue pattern
router.get('/analytics/territories', async (req, res) => {
  try {
    const hubspotData = require('./scripts/analytics/hubspot-data');
    const result = await hubspotData.getTerritoryAnalysis(getDbConnection, req.query);
    res.json(result);
  } catch (error) {
    console.error('❌ Territory data API failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

//=================================================================================================//
// Pipeline Analysis Route - FIXED: Now uses proper server pattern
router.get('/analytics/pipeline', (req, res) => {
  const pipelineServer = require('./scripts/analytics/pipeline-server');
  pipelineServer.servePipelineDashboard(req, res);
});

// Pipeline Probabilities API (you already have this)
router.get('/analytics/prob', (req, res) => {
  pipelineProb.handleGetProbabilities(req, res, hubspotClient);
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

// Pipeline Data API - ROUTING ONLY, NO BUSINESS LOGIC
router.get('/analytics/pipeline-data', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const campaign = req.query.campaign || 'all';
    console.log(`📈 Pipeline data request: ${days} days, campaign: ${campaign}`);
    
    const pipelineServer = require('./scripts/analytics/pipeline-server');
    const result = await pipelineServer.getFastPipelineData(getDbConnection, { days, campaign });
    res.json(result);
  } catch (error) {
    console.error('❌ Pipeline data failed:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
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

// Campaign Revenue Report -  Cash Basis ROAS - Dashboard Route  
router.get('/analytics/roas-revenue', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'scripts', 'analytics', 'roas-revenue.html');
    
    if (fs.existsSync(filePath)) {
      const htmlContent = fs.readFileSync(filePath, 'utf8');
      res.send(htmlContent);
    } else {
      res.status(404).send('<h1>File not found</h1><p>roas-revenue.html not found</p>');
    }
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

// Campaign Revenue Report ("Cash Basis") API
router.get('/analytics/roas-revenue-campaigns', async (req, res) => {
  try {
    const { status, days, startDate, endDate } = req.query;
    const roasRevenue = require('./scripts/analytics/roas-revenue');
    
    console.log(`📊 Campaign Revenue Report API: status=${status}, days=${days}`);
    
    const result = await roasRevenue.getTrueROASCampaigns(getDbConnection, {
      status, 
      days: parseInt(days) || 30,
      startDate,
      endDate
    });
    
    res.json(result);
  } catch (error) {
    console.error('❌ ROAS Revenue API failed:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Pipeline Predicted ROAS - Dashboard Route  
router.get('/analytics/roas-predicted', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'scripts', 'analytics', 'roas-predicted.html');
    
    if (fs.existsSync(filePath)) {
      const htmlContent = fs.readFileSync(filePath, 'utf8');
      res.send(htmlContent);
    } else {
      res.status(404).send('<h1>File not found</h1><p>roas-predicted.html not found</p>');
    }
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

// Pipeline Predicted ROAS Data API
router.get('/analytics/roas-predicted-campaigns', async (req, res) => {
  try {
    const { status, days, startDate, endDate } = req.query;
    const roasPredicted = require('./scripts/analytics/roas-predicted');
    
    console.log(`🔮 Pipeline Predicted ROAS API: status=${status}, days=${days}`);
    
    const result = await roasPredicted.getPipelinePredictedROAS(getDbConnection, {
      status, 
      days: parseInt(days) || 30,
      startDate,
      endDate
    });
    
    res.json(result);
  } catch (error) {
    console.error('❌ ROAS Predicted API failed:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

//=============================================================================//
//   ENHANCED CONVERSIONS FOR LEADS (ECL) ROUTES - ROUTING ONLY
//=============================================================================//

// HISTORIAL SECTION - WON'T BE USING MUCH ONCE SYSTEM IS UP & RUNNING 
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
//   MCP (Model Context Protocol) SERVER INTEGRATION - VERSION 2.1
//=============================================================================//
try {
  router.use('/mcp', mcpRouter);
  modules.mcpServer = true;
  console.log('✅ MCP Router loaded and mounted at /gads/mcp (working version)');
} catch (error) {
  console.error('❌ MCP Router failed to load:', error.message);
  modules.mcpServer = null;
}

// SSE MCP Server Integration (Working Pattern)
const { spawn } = require('child_process');
const path = require('path');

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
  const isRecoveryMode = !modules.googleAdsSync || !modules.pipelineProb || !modules.dashboardServer || !modules.mcpServer;

  res.json({
    recovery_mode: isRecoveryMode,
    timestamp: new Date().toISOString(),
    loaded_modules: {
      google_ads_sync: !!modules.googleAdsSync,
      pipeline_probabilities: !!modules.pipelineProb,
      dashboard_server: !!modules.dashboardServer,
      mcp_server: !!modules.mcpServer
    },
    file_check: {
      'scripts/analytics/pipeline-probs.js': checkFile('scripts/analytics/pipeline-probs.js'),
      'scripts/analytics/dashboard-server.js': checkFile('scripts/analytics/dashboard-server.js'),
      'scripts/analytics/burn-rate.html': checkFile('scripts/analytics/burn-rate.html'),
      'scripts/analytics/pipeline-analysis.html': checkFile('scripts/analytics/pipeline-analysis.html'),
      'gads-sync.js': checkFile('scripts/google/gads-sync.js'),
    }
  });
});

// Logs endpoint
router.get('/logs', (req, res) => {
  const isRecoveryMode = !modules.googleAdsSync || !modules.pipelineProb || !modules.dashboardServer || !modules.mcpServer;
  try {
    const fs = require('fs');
    const logFile = './gads.log';
    
    if (!fs.existsSync(logFile)) {
      return res.json({
        message: 'No log file found yet',
        timestamp: new Date().toISOString(),
        recovery_mode: isRecoveryMode
      });
    }
    
    const logs = fs.readFileSync(logFile, 'utf8');
    const lines = logs.split('\n').filter(line => line.trim()).slice(-50);
    
    res.json({
      recent_logs: lines,
      recovery_mode: isRecoveryMode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Log retrieval failed:', error.message);
    res.status(500).json({
      error: error.message,
      recovery_mode: isRecoveryMode,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling
router.use((error, req, res, next) => {
  const isRecoveryMode = !modules.googleAdsSync || !modules.pipelineProb || !modules.dashboardServer || !modules.mcpServer;
  console.error('❌ Unhandled error:', error.message);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    recovery_mode: isRecoveryMode,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
router.use((req, res) => {
  const isRecoveryMode = !modules.googleAdsSync || !modules.pipelineProb || !modules.dashboardServer || !modules.mcpServer;
  const mcpEndpoints = modules.mcpServer ? [
    '/gads/mcp/health',
    '/gads/mcp/list_tools', 
    '/gads/mcp/call_tool'
  ] : [];

  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    recovery_mode: isRecoveryMode,
    available_endpoints: [
      '/gads/',
      '/gads/health', 
      '/gads/test',
      '/gads/recovery/status',
      '/gads/logs',
      ...mcpEndpoints,
      modules.dashboardServer ? '/gads/dashboard' : null,
      modules.pipelineProb ? '/gads/analytics/prob' : null,
      '/gads/scripts/analytics/burn-rate.html',
      '/gads/scripts/analytics/pipeline-analysis.html'
    ].filter(Boolean),
    mcp_info: modules.mcpServer ? {
      protocol: 'Model Context Protocol',
      claude_desktop_url: 'https://hub.ulearnschool.com/gads/mcp',
      tools_available: 6
    } : {
      status: 'not_available',
      message: 'MCP server not loaded'
    },
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎉 Google Ads AI Iterator started on port ${PORT} - RECOVERY MODE v7`);
  console.log(`📊 Dashboard: https://hub.ulearnschool.com/gads/`);
  console.log(`🏥 Health: https://hub.ulearnschool.com/gads/health`);
  console.log('');
  console.log('⚠️  RECOVERY MODE v7 ACTIVE:');
  console.log(`   🔧 Google Ads Sync: ${modules.googleAdsSync ? 'Available' : 'Missing'}`);
  console.log(`   📊 Dashboard: ${modules.dashboardServer ? 'Available' : 'Missing'}`);
  console.log(`   📈 Pipeline: ${modules.pipelineProb ? 'Available' : 'Missing'}`);
  console.log(`   🤖 MCP Server: ${modules.mcpServer ? 'Available' : 'Missing'}`);
  
  if (modules.mcpServer) {
    console.log('');
    console.log('🤖 Claude Desktop MCP Integration Ready:');
    console.log('   URL: https://hub.ulearnschool.com/gads/mcp');
    console.log('   Protocol: HTTP (Model Context Protocol)');
    console.log('   Available Tools: 6');
  }
});

module.exports = app;