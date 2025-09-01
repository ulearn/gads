#!/usr/bin/env node

/**
 * ULearn MCP HTTP Server - Simplified ES Module Version  
 * Path: /home/hub/public_html/gads/scripts/mcp/mcp-http.js
 */

import express from 'express';
import cors from 'cors';
import { ULearnMCPServer } from './mcp-server.js';
import dotenv from 'dotenv';

dotenv.config({ path: '/home/hub/public_html/gads/.env' });

const app = express();
const port = process.env.MCP_PORT || 3001;
const host = process.env.MCP_HOST || '0.0.0.0';

// Generate bearer token
const bearerToken = process.env.MCP_BEARER_TOKEN || 'ulearn-mcp-' + Date.now() + '-' + Math.random().toString(36).substring(7);

console.log('🌐 Starting ULearn MCP HTTP Server...');
console.log('🔑 Bearer Token: ' + bearerToken);
console.log('📡 Server: http://' + host + ':' + port);

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Authentication middleware
const authenticateBearer = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Bearer token required',
      message: 'Include Authorization: Bearer <token> in headers'
    });
  }
  
  const token = authHeader.substring(7);
  if (token !== bearerToken) {
    return res.status(401).json({ 
      error: 'Invalid bearer token',
      message: 'Token does not match server configuration'
    });
  }
  
  next();
};

// Initialize MCP server instance
const mcpServer = new ULearnMCPServer();

// Routes
app.get('/', (req, res) => {
  res.json({
    service: 'ULearn Google Ads MCP Server',
    version: '1.0.0',
    transport: 'HTTP+JSON',
    status: 'running',
    authentication: 'Bearer token required',
    endpoints: {
      health: '/health',
      capabilities: '/mcp/capabilities',
      tools_list: '/mcp/tools/list',
      tools_call: '/mcp/tools/call',
      sse: '/mcp/sse'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ulearn-google-ads-mcp',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// MCP endpoints (authenticated)
app.get('/mcp/capabilities', authenticateBearer, (req, res) => {
  res.json({
    version: '2024-11-05',
    capabilities: {
      tools: {}
    },
    serverInfo: {
      name: 'ulearn-google-ads-server',
      version: '1.0.0'
    }
  });
});

app.get('/mcp/tools/list', authenticateBearer, async (req, res) => {
  try {
    const tools = [
      {
        name: 'list_ulearn_accounts',
        description: 'List ULearn Google Ads accounts (Test and Live)',
        inputSchema: { type: 'object', properties: {}, required: [] }
      },
      {
        name: 'analyze_ulearn_pipeline',
        description: 'Analyze ULearn click-to-close pipeline performance',
        inputSchema: {
          type: 'object',
          properties: {
            days: { type: 'integer', description: 'Number of days to analyze', default: 30 }
          },
          required: []
        }
      },
      {
        name: 'get_live_campaign_performance',
        description: 'Get real-time campaign performance from Google Ads API',
        inputSchema: {
          type: 'object',
          properties: {
            days: { type: 'integer', description: 'Number of days to analyze', default: 7 },
            limit: { type: 'integer', description: 'Maximum campaigns to return', default: 20 }
          },
          required: []
        }
      },
      {
        name: 'get_territory_analysis',
        description: 'Analyze leads by territory classification',
        inputSchema: {
          type: 'object',
          properties: {
            days: { type: 'integer', description: 'Number of days to analyze', default: 90 }
          },
          required: []
        }
      },
      {
        name: 'run_custom_gaql',
        description: 'Execute custom GAQL query on live Google Ads data',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'GAQL query to execute' }
          },
          required: ['query']
        }
      }
    ];

    res.json({ tools });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to list tools',
      message: error.message 
    });
  }
});

app.post('/mcp/tools/call', authenticateBearer, async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    
    if (!name) {
      return res.status(400).json({
        error: 'Tool name is required',
        message: 'Request body must include "name" field'
      });
    }

    console.log('🔧 Calling tool: ' + name + (args ? ' with args: ' + JSON.stringify(args) : ' with no args'));

    let result;
    
    // Route to MCP server methods
    switch (name) {
      case 'list_ulearn_accounts':
        result = await mcpServer.listULearnAccounts();
        break;
      case 'analyze_ulearn_pipeline':
        result = await mcpServer.analyzeULearnPipeline(args?.days || 30);
        break;
      case 'get_live_campaign_performance':
        result = await mcpServer.getLiveCampaignPerformance(args?.days || 7, args?.limit || 20);
        break;
      case 'get_territory_analysis':
        result = await mcpServer.getTerritoryAnalysis(args?.days || 90);
        break;
      case 'run_custom_gaql':
        if (!args?.query) {
          return res.status(400).json({
            error: 'GAQL query is required',
            message: 'Arguments must include "query" field'
          });
        }
        result = await mcpServer.runCustomGAQL(args.query);
        break;
      default:
        return res.status(404).json({
          error: 'Unknown tool',
          message: 'Tool "' + name + '" not found',
          available_tools: [
            'list_ulearn_accounts', 'analyze_ulearn_pipeline', 'get_live_campaign_performance',
            'get_territory_analysis', 'run_custom_gaql'
          ]
        });
    }

    res.json({
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    });

  } catch (error) {
    console.error('❌ Tool execution failed: ' + error.message);
    res.status(500).json({
      error: 'Tool execution failed',
      message: error.message,
      tool: req.body?.name || 'unknown'
    });
  }
});

// Server-Sent Events endpoint
app.get('/mcp/sse', authenticateBearer, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control, Authorization'
  });

  // Send initial connection event
  const connectionData = JSON.stringify({ 
    type: 'connection', 
    status: 'connected',
    server: 'ulearn-google-ads-mcp',
    timestamp: new Date().toISOString()
  });
  res.write('data: ' + connectionData + '\n\n');

  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    const heartbeatData = JSON.stringify({ 
      type: 'heartbeat', 
      timestamp: new Date().toISOString()
    });
    res.write('data: ' + heartbeatData + '\n\n');
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    console.log('📡 SSE client disconnected');
  });

  req.on('error', (err) => {
    console.error('📡 SSE error:', err);
    clearInterval(heartbeat);
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('💥 Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: req.method + ' ' + req.path + ' not found',
    available_endpoints: ['/', '/health', '/mcp/capabilities', '/mcp/tools/list', '/mcp/tools/call', '/mcp/sse']
  });
});

// Start server
app.listen(port, host, () => {
  console.log('');
  console.log('🚀 ULearn MCP HTTP Server Started Successfully!');
  console.log('='.repeat(60));
  console.log('📍 URL: http://' + host + ':' + port);
  console.log('🔑 Bearer Token: ' + bearerToken);
  console.log('💚 Health Check: http://' + host + ':' + port + '/health');
  console.log('');
  console.log('📋 Claude Desktop Configuration:');
  
  const claudeConfig = {
    mcpServers: {
      'ulearn-gads': {
        url: 'https://hub.ulearnschool.com:' + port + '/mcp',
        auth: {
          type: 'bearer',
          token: bearerToken
        }
      }
    }
  };
  
  console.log(JSON.stringify(claudeConfig, null, 2));
  console.log('');
  console.log('🎯 Available Tools:');
  console.log('  • list_ulearn_accounts - List test/live accounts');
  console.log('  • analyze_ulearn_pipeline - Click-to-close analysis');  
  console.log('  • get_live_campaign_performance - Real-time campaign data');
  console.log('  • get_territory_analysis - Territory & burn rate analysis');
  console.log('  • run_custom_gaql - Execute custom GAQL queries');
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down ULearn MCP Server...');
  await mcpServer.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down ULearn MCP Server...');
  await mcpServer.cleanup();
  process.exit(0);
});