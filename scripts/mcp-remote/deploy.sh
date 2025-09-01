#!/bin/bash

# Deploy Working Remote MCP Server
# This creates a NEW server that actually works with Claude Desktop

echo "🚀 Deploying Working Remote MCP Server"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "index.js" ]; then
    echo "❌ Error: Run this from /home/hub/public_html/gads directory"
    exit 1
fi

# Create new directory for working remote server
echo "📁 Creating working remote MCP directory..."
mkdir -p scripts/mcp-remote-working
cd scripts/mcp-remote-working

# Save the working remote server code
echo "💾 Creating working remote MCP server..."
cat > remote-server.js << 'EOF'
[PASTE THE WORKING REMOTE MCP SERVER CODE FROM ARTIFACT]
EOF

# Create package.json for dependencies
echo "📦 Creating package.json..."
cat > package.json << 'EOF'
{
  "name": "ulearn-working-remote-mcp",
  "version": "1.0.0",
  "description": "Working Remote MCP Server for Claude Desktop",
  "main": "remote-server.js",
  "scripts": {
    "start": "node remote-server.js",
    "dev": "nodemon remote-server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "google-ads-api": "^15.0.0",
    "mysql2": "^3.6.0",
    "dotenv": "^16.3.1"
  }
}
EOF

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create startup script
cat > start.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting Working Remote MCP Server..."

# Set environment
export NODE_PATH="/home/hub/public_html/gads"
export MCP_REMOTE_PORT=3002

# Start server
node remote-server.js
EOF

chmod +x start.sh

# Create PM2 config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'ulearn-working-mcp',
    script: 'remote-server.js',
    cwd: '/home/hub/public_html/gads/scripts/mcp-remote-working',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production',
      MCP_REMOTE_PORT: 3002,
      NODE_PATH: '/home/hub/public_html/gads'
    }
  }]
};
EOF

# Test the server
echo "🧪 Testing server startup..."
timeout 10s node remote-server.js &
SERVER_PID=$!
sleep 3

# Check if server started
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✅ Server started successfully!"
    kill $SERVER_PID
else
    echo "❌ Server failed to start"
fi

echo ""
echo "🎉 WORKING REMOTE MCP SERVER DEPLOYED!"
echo "====================================="
echo ""
echo "🚀 TO START:"
echo "cd scripts/mcp-remote-working && ./start.sh"
echo ""
echo "🔥 OR WITH PM2:"
echo "cd scripts/mcp-remote-working && pm2 start ecosystem.config.js"
echo ""
echo "🤖 CLAUDE DESKTOP:"
echo "Settings > Connectors > Add Custom Connector"
echo "URL: https://hub.ulearnschool.com:3002/"
echo "(No API key needed)"
echo ""
echo "🔍 TEST:"
echo "curl https://hub.ulearnschool.com:3002/health"