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
