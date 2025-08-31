const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

const server = new WebSocket.Server({ port: 8001 });
console.log('MCP WebSocket Bridge running on port 8001');

server.on('connection', (ws) => {
  console.log('Client connected');
  
  // Spawn the Python MCP server
  const pythonPath = path.join(__dirname, '.venv', 'bin', 'python');
  const serverPath = path.join(__dirname, 'google_ads_server.py');
  
  const mcpProcess = spawn(pythonPath, [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname
  });
  
  // Forward WebSocket messages to MCP server stdin
  ws.on('message', (data) => {
    mcpProcess.stdin.write(data);
  });
  
  // Forward MCP server stdout to WebSocket
  mcpProcess.stdout.on('data', (data) => {
    ws.send(data);
  });
  
  // Handle errors
  mcpProcess.stderr.on('data', (data) => {
    console.error('MCP Error:', data.toString());
  });
  
  // Cleanup on disconnect
  ws.on('close', () => {
    console.log('Client disconnected');
    mcpProcess.kill();
  });
});