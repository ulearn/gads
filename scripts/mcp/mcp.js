const express = require('express');
const router = express.Router();
const path = require('path');

// Import our modular components
const apiTools = require('./mcp-api');
const mysqlTools = require('./mcp-mysql');
const { getAllTools, getToolByName, toolExists } = require('./mcp-tools');

// Ensure environment variables are loaded
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/** ---------- Small util for timestamped logs ---------- */
const log = (...args) => console.log(new Date().toISOString(), ...args);

// MCP SDK Components
let McpServer = null;
let SSEServerTransport = null;
let mcpServer = null;
let sseTransport = null;

/**
 * Initialize MCP SDK and register handlers
 */
async function initializeMCP() {
  try {
    log('🔄 Loading MCP server module...');
    const serverModule = await import('@modelcontextprotocol/sdk/server/index.js');
    log('🔄 Loading MCP SSE module...');
    const sseModule = await import('@modelcontextprotocol/sdk/server/sse.js');
    
    const { Server: McpServerClass } = serverModule;
    const { SSEServerTransport: SSETransport } = sseModule;
    
    McpServer = McpServerClass;
    SSEServerTransport = SSETransport;
    
    // Create MCP server
    mcpServer = new McpServer({
      name: 'ulearn-mcp-server',
      version: '2.0.0'
    }, {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    });
    
    log('🔧 MCP Server created successfully');
    log('🔄 Registering tool handlers...');
    
    // Register tools/list handler
    mcpServer.setRequestHandler('tools/list', async () => {
      log('🔧 tools/list handler called');
      return {
        tools: getAllTools()
      };
    });

    // Register tools/call handler
    mcpServer.setRequestHandler('tools/call', async (request) => {
      log('🔧 🎯 Tools/call handler called');
      log('🔧 Request:', JSON.stringify(request, null, 2));
      
      if (!request || !request.params) {
        throw new Error('Invalid request: missing params');
      }
      
      const { name, arguments: args } = request.params;
      
      // Route to appropriate handler
      return await handleToolCall(name, args || {});
    });
    
    log('✅ MCP SDK initialized with modular tools');
    return true;
  } catch (error) {
    log('❌ MCP SDK initialization failed:', error.message);
    return false;
  }
}

/**
 * Handle tool calls by routing to appropriate modules
 */
async function handleToolCall(toolName, args) {
  log(`🔧 Handling tool call: ${toolName}`, args);
  
  if (!toolExists(toolName)) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  
  let result;
  
  switch (toolName) {
    // Google Ads API tools
    case 'GAds_Account_API':
      result = await apiTools.getAccountOverview(args);
      break;
    
    case 'GAds_Campaign_API':
      result = await apiTools.getCampaignAnalysis(args);
      break;
    
    case 'GAds_Audience_API':
      result = await apiTools.getAudienceAnalysis(args);
      break;
    
    // MySQL database tools - Refactored to use proven analytics modules  
    case 'Summary_MySql':
      result = await mysqlTools.getDashboardSummary(args);
      break;
    
    case 'Pipeline_MySql':
      result = await mysqlTools.getPipelineAnalysis(args);
      break;
    
    case 'Burn_MySql':
      result = await mysqlTools.getBurnRateAnalysis(args);
      break;
    
    case 'Campaign_MySql':
      result = await mysqlTools.getCampaignPerformance(args);
      break;
    
    case 'Territory_MySql':
      result = await mysqlTools.getTerritoryAnalysis(args);
      break;
    
    case 'Budget_MySql':
      result = await mysqlTools.getBudgetAnalysis(args);
      break;
    
    default:
      throw new Error(`Tool handler not implemented: ${toolName}`);
  }
  
  // Return standardized MCP response
  return {
    content: [{
      type: 'text',
      text: result.report
    }]
  };
}

// Initialize MCP - start as true for basic functionality, async load will enhance it
let mcpInitialized = true;

// Start async initialization in background
console.log('🔄 Starting MCP SDK initialization...');
initializeMCP().then(success => {
  if (success) {
    console.log('✅ MCP SDK initialized with modular tools');
  } else {
    console.log('❌ MCP SDK initialization returned false');
  }
}).catch(error => {
  console.log('❌ MCP SDK initialization failed:', error.message);
  console.log('❌ Error stack:', error.stack);
});

/** ---------- CORS middleware for Claude Desktop ---------- */
router.use((req, res, next) => {
  // Log ALL requests to the MCP router
  log(`🌐 MCP Router request: ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    log(`🌐 MCP Router body preview: ${JSON.stringify(req.body).substring(0, 200)}...`);
  }
  
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, mcp-protocol-version, Authorization',
    'Access-Control-Max-Age': '3600'
  });
  next();
});

/** ---------- HEAD/OPTIONS support ---------- */
router.head('/', (_req, res) => {
  res.set('Content-Type', 'application/json; charset=utf-8');
  res.status(200).end();
});

router.options('/', (_req, res) => {
  res.set({
    'Allow': 'GET,POST,HEAD,OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.status(200).end();
});

/** ---------- SSE Connection (GET) ---------- */
router.get('/', async (req, res) => {
  if (!mcpInitialized) {
    return res.status(503).json({
      error: 'MCP SDK not available',
      message: 'Install with: npm install @modelcontextprotocol/sdk'
    });
  }
  
  log('📡 SSE connection request', { ua: req.headers['user-agent'] });
  
  try {
    // Create SSE transport
    sseTransport = new SSEServerTransport('/gads/mcp/messages', res);
    
    // Connect MCP server to SSE transport
    await mcpServer.connect(sseTransport);
    
    log('✅ SSE transport connected');
  } catch (error) {
    log('❌ SSE connection failed:', error.message);
    res.status(500).json({ error: 'SSE connection failed', details: error.message });
  }
});

/** ---------- JSON-RPC Requests (POST) ---------- */
router.post('/', async (req, res) => {
  log('🔍 ROOT POST REQUEST - MCP JSON-RPC endpoint');
  log('🔍 Request body:', JSON.stringify(req.body, null, 2));
  
  if (!mcpInitialized) {
    return res.status(503).json({
      error: 'MCP SDK not available',
      message: 'Connect to SSE endpoint first'
    });
  }

  // Handle notifications/initialized
  if (req.body?.method === 'notifications/initialized') {
    log('🔔 NOTIFICATIONS/INITIALIZED - returning 202');
    res.status(202).json({
      jsonrpc: '2.0',
      id: req.body.id || null
    });
    return;
  }

  // For tools/call, always handle directly (bypass SSE transport issues)  
  if (req.body?.method === 'tools/call') {
    log('🔧 🎯 TOOLS/CALL - handling directly (bypass SSE)');
    log('🔧 Tool call params:', JSON.stringify(req.body.params, null, 2));
    
    try {
      const { name, arguments: args } = req.body.params || {};
      const result = await handleToolCall(name, args || {});
      
      const response = {
        jsonrpc: '2.0',
        id: req.body.id || 0,
        result
      };
      
      log('📤 Sending tool response');
      return res.status(200).json(response);
      
    } catch (error) {
      log('❌ Tool call failed:', error.message);
      
      const errorResponse = {
        jsonrpc: '2.0',
        id: req.body.id || 0,
        error: {
          code: -32603,
          message: error.message
        }
      };
      
      return res.status(200).json(errorResponse);
    }
  }

  // For other requests, handle directly when no SSE transport
  if (!sseTransport) {
    log('⚠️ No SSE transport - handling request directly');
    
    if (req.body?.method === 'initialize') {
      log('🔧 Handling initialize directly');
      
      const initResponse = {
        jsonrpc: '2.0',
        id: req.body.id || 0,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: {
            tools: { listChanged: true },
            resources: {},
            prompts: {}
          },
          serverInfo: {
            name: 'ulearn-mcp-server',
            version: '2.0.0'
          }
        }
      };
      
      log('📤 Sending initialize response');
      return res.status(200).json(initResponse);
    }
    
    if (req.body?.method === 'tools/list') {
      log('🔧 Handling tools/list directly');
      
      const toolsResponse = {
        jsonrpc: '2.0',
        id: req.body.id || 0,
        result: {
          tools: getAllTools()
        }
      };
      
      log('📤 Sending tools/list response with', getAllTools().length, 'tools');
      return res.status(200).json(toolsResponse);
    }
    
    if (req.body?.method === 'prompts/list') {
      const promptsResponse = {
        jsonrpc: '2.0',
        id: req.body.id || 0,
        result: { prompts: [] }
      };
      return res.status(200).json(promptsResponse);
    }
    
    if (req.body?.method === 'resources/list') {
      const resourcesResponse = {
        jsonrpc: '2.0',
        id: req.body.id || 0,
        result: { resources: [] }
      };
      return res.status(200).json(resourcesResponse);
    }
    
    // For other methods when no SSE transport, return error
    return res.status(503).json({
      error: 'No active SSE connection',
      message: 'Establish SSE connection first via GET /'
    });
  }

  // If we have SSE transport, delegate to it
  try {
    log('🔄 Delegating to SSE transport');
    await sseTransport.handlePostMessage(req, res);
    log('✅ SSE transport handled request successfully');
  } catch (error) {
    log('❌ SSE transport handling failed:', error.message);
    res.status(500).json({
      error: 'Message handling failed',
      details: error.message
    });
  }
});

/** ---------- Health check ---------- */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** ---------- Debug endpoints ---------- */
router.get('/tools', (_req, res) => {
  res.json({
    tools: getAllTools(),
    count: getAllTools().length,
    timestamp: new Date().toISOString()
  });
});

/** ---------- 404 handler ---------- */
router.all('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    hint: 'Use / (GET/POST), /health, or /tools',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;