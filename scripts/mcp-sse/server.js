/**
 * Working SSE MCP Server for ULearn Google Ads (CommonJS)
 */

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const express = require("express");
const { z } = require("zod");
const { GoogleAdsApi } = require("google-ads-api");
const mysql = require("mysql2/promise");
const path = require("path");

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// Initialize Google Ads client
const googleAdsClient = new GoogleAdsApi({
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  developer_token: process.env.GAdsAPI
});

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
};

// Create MCP server
const server = new McpServer({
  name: "ulearn-google-ads-sse",
  version: "1.0.0",
});

// Add all your tools here (same content, just using CommonJS syntax)
// ... (same tool definitions as before)

// Express app
const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

let transport;

// SSE endpoint
app.get("/sse", async (req, res) => {
  console.log('📡 SSE connection established');
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

// Messages endpoint
app.post("/messages", async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(503).json({ error: "SSE transport not initialized" });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    server: "ULearn Google Ads SSE MCP Server",
    tools: 5,
    transport: "SSE"
  });
});

const PORT = process.env.MCP_SSE_PORT || 3001;
app.listen(PORT, () => {
  console.log(`🎉 SSE MCP Server running on port ${PORT}`);
});