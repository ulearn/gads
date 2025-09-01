# ULearn MCP Server Quick Start Guide

## What This Is
Node.js MCP server that connects Claude Desktop to your ULearn Google Ads and HubSpot data.

## Files Overview
- `mcp-server.js` - Main MCP server (stdio transport)
- `mcp-http.js` - HTTP wrapper for Claude Desktop
- `package.json` - Node.js dependencies
- `test-connection.js` - Database connection test
- `.env.mcp` - MCP-specific environment variables

## Quick Start
1. Install dependencies: `npm install`
2. Test connection: `node test-connection.js`
3. Start HTTP server: `./start-mcp-http.sh`
4. Configure Claude Desktop with the generated config

## Available Tools
- **analyze_ulearn_pipeline** - Your core click-to-close analysis
- **get_live_campaign_performance** - Real-time Google Ads data
- **get_audience_targeting** - Demographics and audience settings
- **get_ad_creatives** - Headlines, descriptions, and assets
- **run_custom_gaql** - Execute any GAQL query
- **get_hubspot_attribution** - HubSpot deal attribution data

## Bearer Token
ulearn-mcp-20250901-5f1709520f2f5cf0

## Endpoints
- Health: https://hub.ulearnschool.com:3001/health
- MCP: https://hub.ulearnschool.com:3001/mcp

## Troubleshooting
- Check logs: `journalctl -u ulearn-mcp-http -f`
- Test database: `node test-connection.js`
- Verify environment: `source .env && env | grep -E "(DB_|GAds|CLIENT_|GOOGLE_)"`
