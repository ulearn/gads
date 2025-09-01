#!/bin/bash
# ULearn MCP Google Ads Server Setup Script (Node.js)
# Sets up the Node.js MCP server for Claude Desktop connectivity

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 ULearn MCP Google Ads Server Setup (Node.js)${NC}"
echo -e "=================================================="

# Configuration
BASE_DIR="/home/hub/public_html/gads"
MCP_DIR="${BASE_DIR}/scripts/mcp"
NODE_MODULES_DIR="${MCP_DIR}/node_modules"
LOG_DIR="${BASE_DIR}/logs"

echo -e "${YELLOW}📍 Base directory: ${BASE_DIR}${NC}"
echo -e "${YELLOW}📍 MCP directory: ${MCP_DIR}${NC}"

# Check if we're in the right location
if [ ! -d "$BASE_DIR" ]; then
    echo -e "${RED}❌ Error: Base directory ${BASE_DIR} not found${NC}"
    exit 1
fi

# Create MCP directory if it doesn't exist
echo -e "${BLUE}📁 Setting up MCP directory...${NC}"
mkdir -p "$MCP_DIR"
mkdir -p "$LOG_DIR"

cd "$MCP_DIR"

# Check Node.js version
echo -e "${BLUE}🔍 Checking Node.js version...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 16 or higher${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo -e "${RED}❌ Node.js version 16+ required. Current: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node -v) detected${NC}"

# Create package.json if it doesn't exist
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}⚠️  package.json not found. Please save the package.json artifact to:${NC}"
    echo -e "   ${MCP_DIR}/package.json"
fi

# Install dependencies
echo -e "${BLUE}📦 Installing Node.js dependencies...${NC}"
if [ -f "package.json" ]; then
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Skipping npm install - package.json not found${NC}"
fi

# Check if our custom server files exist
echo -e "${BLUE}📄 Checking MCP server files...${NC}"
MISSING_FILES=()

if [ ! -f "${MCP_DIR}/mcp-server.js" ]; then
    MISSING_FILES+=("mcp-server.js")
fi

if [ ! -f "${MCP_DIR}/mcp-http.js" ]; then
    MISSING_FILES+=("mcp-http.js")
fi

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Missing MCP server files. Please save the artifacts to:${NC}"
    for file in "${MISSING_FILES[@]}"; do
        echo -e "   - ${MCP_DIR}/${file}"
    done
    echo -e "${YELLOW}📋 Copy the JavaScript code from the artifacts above into these files.${NC}"
fi

# Generate bearer token for authentication
echo -e "${BLUE}🔐 Setting up authentication...${NC}"
BEARER_TOKEN="ulearn-mcp-$(date +%Y%m%d)-$(openssl rand -hex 8)"
echo -e "${GREEN}✅ Generated bearer token: ${BEARER_TOKEN}${NC}"

# Create environment file for MCP server
echo -e "${BLUE}📝 Creating MCP environment configuration...${NC}"
cat > "${MCP_DIR}/.env.mcp" << EOF
# ULearn MCP Server Configuration
MCP_BEARER_TOKEN=${BEARER_TOKEN}
MCP_HOST=0.0.0.0
MCP_PORT=3001

# Import from main .env file
NODE_PATH=${BASE_DIR}
EOF

echo -e "${GREEN}✅ Created MCP environment file: ${MCP_DIR}/.env.mcp${NC}"

# Test database connection
echo -e "${BLUE}🗄️  Testing database connection...${NC}"
cd "$BASE_DIR"

# Create a simple connection test
cat > "${MCP_DIR}/test-connection.js" << 'EOF'
#!/usr/bin/env node
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/home/hub/public_html/gads/.env' });

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME || 'hub_gads',
      user: process.env.DB_USER || 'hub_admin',
      password: process.env.DB_PASSWORD,
      timeout: 10000
    });
    
    const [results] = await connection.execute('SELECT COUNT(*) as contact_count FROM hub_contacts LIMIT 1');
    console.log(`✅ Database connection successful. Found ${results[0].contact_count} contacts.`);
    
    const [campaigns] = await connection.execute('SELECT COUNT(*) as campaign_count FROM gads_campaigns LIMIT 1');
    console.log(`✅ Found ${campaigns[0].campaign_count} campaigns in sync database.`);
    
    await connection.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
EOF

chmod +x "${MCP_DIR}/test-connection.js"

# Run the test if dependencies are installed
if [ -d "$NODE_MODULES_DIR" ]; then
    cd "$MCP_DIR"
    node test-connection.js
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Database connection test failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Skipping database test - dependencies not installed${NC}"
fi

# Create startup scripts
echo -e "${BLUE}🚀 Creating startup scripts...${NC}"

# Stdio transport startup script
cat > "${MCP_DIR}/start-mcp-stdio.sh" << 'EOF'
#!/bin/bash
# ULearn MCP Server Startup Script (stdio transport)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BASE_DIR="/home/hub/public_html/gads"

echo -e "${GREEN}🚀 Starting ULearn MCP Server (stdio transport)...${NC}"

# Load environment variables
export NODE_PATH="${BASE_DIR}"
source "${BASE_DIR}/.env"

# Change to MCP directory
cd "$SCRIPT_DIR"

# Start the stdio server
node mcp-server.js
EOF

# HTTP transport startup script
cat > "${MCP_DIR}/start-mcp-http.sh" << 'EOF'
#!/bin/bash
# ULearn MCP HTTP Server Startup Script

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BASE_DIR="/home/hub/public_html/gads"

echo -e "${GREEN}🚀 Starting ULearn MCP HTTP Server...${NC}"

# Load environment variables
export NODE_PATH="${BASE_DIR}"
source "${BASE_DIR}/.env"
source "${SCRIPT_DIR}/.env.mcp"

# Change to MCP directory
cd "$SCRIPT_DIR"

# Start the HTTP server
node mcp-http.js
EOF

chmod +x "${MCP_DIR}/start-mcp-stdio.sh"
chmod +x "${MCP_DIR}/start-mcp-http.sh"

# Create systemd service file (optional)
echo -e "${BLUE}🔧 Creating systemd service...${NC}"
cat > "/tmp/ulearn-mcp-http.service" << EOF
[Unit]
Description=ULearn MCP Google Ads HTTP Server
After=network.target mysql.service

[Service]
Type=simple
User=hub
WorkingDirectory=${MCP_DIR}
ExecStart=${MCP_DIR}/start-mcp-http.sh
Restart=always
RestartSec=10
Environment=NODE_PATH=${BASE_DIR}
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

echo -e "${YELLOW}📄 Systemd service file created at /tmp/ulearn-mcp-http.service${NC}"
echo -e "${YELLOW}📋 To install the service (requires sudo):${NC}"
echo -e "   sudo mv /tmp/ulearn-mcp-http.service /etc/systemd/system/"
echo -e "   sudo systemctl daemon-reload"
echo -e "   sudo systemctl enable ulearn-mcp-http"
echo -e "   sudo systemctl start ulearn-mcp-http"

# Create Claude Desktop configuration
echo -e "${BLUE}🖥️  Creating Claude Desktop configuration...${NC}"
CLAUDE_CONFIG_JSON=$(cat << EOF
{
  "mcpServers": {
    "ulearn-gads": {
      "url": "https://hub.ulearnschool.com:3001/mcp",
      "auth": {
        "type": "bearer",
        "token": "${BEARER_TOKEN}"
      }
    }
  }
}
EOF
)

# Create nginx configuration snippet
echo -e "${BLUE}🌐 Creating Nginx configuration...${NC}"
cat > "${MCP_DIR}/nginx-mcp.conf" << EOF
# ULearn MCP Server Nginx Configuration
# Add this to your existing Nginx config

location /mcp {
    proxy_pass http://127.0.0.1:3001/mcp;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_cache_bypass \$http_upgrade;
    
    # SSE support
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400;
}

location /health {
    proxy_pass http://127.0.0.1:3001/health;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
}
EOF

echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo -e "=================================================="
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo -e ""
echo -e "${BLUE}1. Save the artifact code:${NC}"
echo -e "   Copy the JavaScript code from the artifacts above to:"
echo -e "   - ${MCP_DIR}/package.json"
echo -e "   - ${MCP_DIR}/mcp-server.js"
echo -e "   - ${MCP_DIR}/mcp-http.js"
echo -e ""
echo -e "${BLUE}2. Install dependencies:${NC}"
echo -e "   cd ${MCP_DIR}"
echo -e "   npm install"
echo -e ""
echo -e "${BLUE}3. Test the connection:${NC}"
echo -e "   cd ${MCP_DIR}"
echo -e "   node test-connection.js"
echo -e ""
echo -e "${BLUE}4. Start the HTTP server:${NC}"
echo -e "   cd ${MCP_DIR}"
echo -e "   ./start-mcp-http.sh"
echo -e ""
echo -e "${BLUE}5. Configure Claude Desktop:${NC}"
echo -e "   Add this to your Claude Desktop config:"
echo -e "${GREEN}${CLAUDE_CONFIG_JSON}${NC}"
echo -e ""
echo -e "${BLUE}6. Configure Nginx (optional):${NC}"
echo -e "   Add the config from: ${MCP_DIR}/nginx-mcp.conf"
echo -e ""
echo -e "${BLUE}🔑 Bearer Token:${NC} ${BEARER_TOKEN}"
echo -e "${BLUE}🌐 Server URL:${NC} https://hub.ulearnschool.com:3001/mcp"
echo -e "${BLUE}💚 Health Check:${NC} https://hub.ulearnschool.com:3001/health"
echo -e ""
echo -e "${BLUE}📊 Available Tools:${NC}"
echo -e "   • list_ulearn_accounts - List test/live accounts"
echo -e "   • analyze_ulearn_pipeline - Click-to-close analysis"
echo -e "   • get_live_campaign_performance - Real-time campaign data"
echo -e "   • get_audience_targeting - Demographics & audience settings"
echo -e "   • get_ad_creatives - Headlines, descriptions, assets"
echo -e "   • get_territory_analysis - Territory & burn rate analysis"
echo -e "   • run_custom_gaql - Execute custom GAQL queries"
echo -e "   • get_keyword_performance - Keyword analysis"
echo -e "   • get_hubspot_attribution - Deal attribution data"

# Save configuration files for later reference
echo "$CLAUDE_CONFIG_JSON" > "${MCP_DIR}/claude-desktop-config.json"
echo -e "${GREEN}📄 Claude Desktop config saved to: ${MCP_DIR}/claude-desktop-config.json${NC}"

# Create quick start guide
cat > "${MCP_DIR}/QUICKSTART.md" << EOF
# ULearn MCP Server Quick Start Guide

## What This Is
Node.js MCP server that connects Claude Desktop to your ULearn Google Ads and HubSpot data.

## Files Overview
- \`mcp-server.js\` - Main MCP server (stdio transport)
- \`mcp-http.js\` - HTTP wrapper for Claude Desktop
- \`package.json\` - Node.js dependencies
- \`test-connection.js\` - Database connection test
- \`.env.mcp\` - MCP-specific environment variables

## Quick Start
1. Install dependencies: \`npm install\`
2. Test connection: \`node test-connection.js\`
3. Start HTTP server: \`./start-mcp-http.sh\`
4. Configure Claude Desktop with the generated config

## Available Tools
- **analyze_ulearn_pipeline** - Your core click-to-close analysis
- **get_live_campaign_performance** - Real-time Google Ads data
- **get_audience_targeting** - Demographics and audience settings
- **get_ad_creatives** - Headlines, descriptions, and assets
- **run_custom_gaql** - Execute any GAQL query
- **get_hubspot_attribution** - HubSpot deal attribution data

## Bearer Token
${BEARER_TOKEN}

## Endpoints
- Health: https://hub.ulearnschool.com:3001/health
- MCP: https://hub.ulearnschool.com:3001/mcp

## Troubleshooting
- Check logs: \`journalctl -u ulearn-mcp-http -f\`
- Test database: \`node test-connection.js\`
- Verify environment: \`source .env && env | grep -E "(DB_|GAds|CLIENT_|GOOGLE_)"\`
EOF

echo -e "${GREEN}📚 Quick start guide created: ${MCP_DIR}/QUICKSTART.md${NC}"
echo -e "${GREEN}🎉 Setup complete! Ready to deploy.${NC}"