#!/usr/bin/env python3
"""
Complete MCP HTTP Server that bridges to stdio MCP server
"""
import asyncio
import json
import subprocess
import logging
from typing import AsyncGenerator
from fastapi import FastAPI, Request, HTTPException
from sse_starlette.sse import EventSourceResponse
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

class MCPBridge:
    def __init__(self):
        self.process = None
    
    async def send_to_mcp(self, message: dict) -> dict:
        """Send message to stdio MCP server and get response"""
        try:
            # Start fresh process for each request
            self.process = subprocess.Popen(
                ['/home/hub/public_html/gads/scripts/mcp-google-ads/.venv/bin/python', 'google_ads_server.py'],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd='/home/hub/public_html/gads/scripts/mcp-google-ads',
                text=True
            )
            
            # Send JSON-RPC message
            input_data = json.dumps(message) + '\n'
            stdout, stderr = self.process.communicate(input=input_data, timeout=30)
            
            if stderr:
                logger.error(f"MCP server stderr: {stderr}")
            
            # Parse response
            if stdout.strip():
                return json.loads(stdout.strip())
            else:
                raise Exception("No response from MCP server")
                
        except subprocess.TimeoutExpired:
            if self.process:
                self.process.kill()
            raise HTTPException(status_code=408, detail="MCP server timeout")
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"Invalid JSON response: {e}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"MCP server error: {str(e)}")

bridge = MCPBridge()

@app.post("/")
async def mcp_root(request: Request):
    """MCP HTTP root endpoint"""
    try:
        body = await request.json()
        logger.info(f"Received MCP request: {body}")
        
        response = await bridge.send_to_mcp(body)
        logger.info(f"MCP response: {response}")
        
        return response
    except Exception as e:
        logger.error(f"Error in root endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok", 
        "service": "MCP HTTP Bridge",
        "mcp_server": "Google Ads MCP Server"
    }

if __name__ == "__main__":
    logger.info("Starting MCP HTTP Bridge on port 8080")
    uvicorn.run(app, host="0.0.0.0", port=8080)