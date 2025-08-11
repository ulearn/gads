/**
 * FIXED: Dashboard Server - HTML Template & React Setup
 * /scripts/analytics/dashboard-server.js
 * 
 * FIXES:
 * - Better error handling for component loading
 * - Validate React component before serving
 * - Fallback if dashboard.js has syntax errors
 */

const fs = require('fs');
const path = require('path');

/**
 * Serve the React dashboard with enhanced error handling
 */
function serveDashboard(req, res) {
  try {
    console.log('🔄 Dashboard server: Loading React component...');
    
    // Try to read the React component
    const dashboardComponentPath = path.join(__dirname, 'dashboard.js');
    
    if (!fs.existsSync(dashboardComponentPath)) {
      console.error('❌ Dashboard component file not found:', dashboardComponentPath);
      return serveErrorPage(res, 'Dashboard component file not found');
    }
    
    let dashboardComponent;
    try {
      dashboardComponent = fs.readFileSync(dashboardComponentPath, 'utf8');
      console.log('✅ Dashboard component loaded, size:', dashboardComponent.length, 'chars');
    } catch (error) {
      console.error('❌ Failed to read dashboard component:', error.message);
      return serveErrorPage(res, `Failed to read dashboard component: ${error.message}`);
    }
    
    // Basic validation - check for required React elements
    if (!dashboardComponent.includes('GoogleAdsDashboard')) {
      console.error('❌ Dashboard component missing GoogleAdsDashboard function');
      return serveErrorPage(res, 'Dashboard component missing GoogleAdsDashboard function');
    }
    
    console.log('✅ Dashboard component validated, serving HTML...');
    
    // Generate the complete HTML page
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Google Ads Pipeline Dashboard</title>
          
          <!-- React & Dependencies -->
          <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
          <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          
          <!-- Tailwind CSS -->
          <script src="https://cdn.tailwindcss.com"></script>
          
          <!-- Custom Styles -->
          <style>
            body {
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            }
            
            /* Loading animation */
            .loading {
              display: inline-block;
              width: 20px;
              height: 20px;
              border: 3px solid #f3f3f3;
              border-top: 3px solid #3498db;
              border-radius: 50%;
              animation: spin 2s linear infinite;
            }
            
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            
            /* Card hover effects */
            .card-hover {
              transition: all 0.3s ease;
            }
            
            .card-hover:hover {
              transform: translateY(-2px);
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }
          </style>
      </head>
      <body>
          <!-- React Mount Point -->
          <div id="dashboard-root">
            <div class="min-h-screen bg-gray-100 flex items-center justify-center">
              <div class="text-center">
                <div class="loading"></div>
                <p class="mt-4 text-gray-600">Loading dashboard...</p>
              </div>
            </div>
          </div>
          
          <!-- Enhanced Error Handling -->
          <script>
            window.onerror = function(msg, url, line, col, error) {
              console.error('🚨 Dashboard Script Error:', {
                message: msg,
                source: url,
                line: line,
                column: col,
                error: error
              });
              
              const errorDiv = document.createElement('div');
              errorDiv.innerHTML = 
                '<div class="min-h-screen bg-red-50 flex items-center justify-center">' +
                '<div class="text-center p-8 bg-white rounded-xl shadow-lg max-w-lg">' +
                '<h1 class="text-2xl font-bold text-red-600 mb-4">🚨 Dashboard Error</h1>' +
                '<div class="text-left bg-gray-100 p-4 rounded mb-4">' +
                '<p class="text-red-700 font-mono text-sm">' + msg + '</p>' +
                '<p class="text-gray-600 text-xs mt-2">Line: ' + line + ', Column: ' + col + '</p>' +
                '<p class="text-gray-600 text-xs">Source: ' + url + '</p>' +
                '</div>' +
                '<button onclick="window.location.reload()" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-2">Reload Dashboard</button>' +
                '<a href="/gads/" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-decoration-none">← Main Menu</a>' +
                '</div></div>';
              
              document.getElementById('dashboard-root').innerHTML = errorDiv.innerHTML;
              return true;
            };
            
            window.addEventListener('unhandledrejection', function(event) {
              console.error('🚨 Unhandled Promise Rejection:', event.reason);
              event.preventDefault();
            });
          </script>
          
          <!-- React Component -->
          <script type="text/babel">
              try {
                console.log('🔄 Loading React component...');
                ${dashboardComponent}
                console.log('✅ React component loaded successfully');
              } catch (error) {
                console.error('❌ React component failed to load:', error);
                document.getElementById('dashboard-root').innerHTML = 
                  '<div class="min-h-screen bg-red-50 flex items-center justify-center">' +
                  '<div class="text-center p-8 bg-white rounded-xl shadow-lg max-w-lg">' +
                  '<h1 class="text-2xl font-bold text-red-600 mb-4">❌ Component Error</h1>' +
                  '<p class="text-gray-600 mb-4">Failed to load React component</p>' +
                  '<p class="text-sm text-gray-500 bg-gray-100 p-2 rounded">' + error.message + '</p>' +
                  '<button onclick="window.location.reload()" class="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Retry</button>' +
                  '</div></div>';
              }
          </script>
      </body>
      </html>
    `;
    
    res.send(html);
    console.log('✅ Dashboard HTML served successfully');
    
  } catch (error) {
    console.error('❌ Dashboard server critical error:', error.message);
    serveErrorPage(res, `Critical error: ${error.message}`);
  }
}

/**
 * Serve error page when dashboard fails
 */
function serveErrorPage(res, errorMessage) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard Error</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 40px; 
          background: #f5f5f5; 
        }
        .error-container { 
          background: white; 
          padding: 30px; 
          border-radius: 8px; 
          box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
          max-width: 600px;
          margin: 0 auto;
        }
        .error-title { 
          color: #e74c3c; 
          margin-bottom: 20px; 
        }
        .error-message { 
          background: #ffeaea; 
          padding: 15px; 
          border-radius: 4px; 
          border-left: 4px solid #e74c3c; 
          margin-bottom: 20px;
        }
        .back-link { 
          display: inline-block; 
          color: #3498db; 
          text-decoration: none; 
          padding: 10px 20px;
          background: #ecf0f1;
          border-radius: 4px;
          margin-right: 10px;
        }
        .back-link:hover { 
          text-decoration: underline; 
        }
        .debug-info {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1 class="error-title">🚨 Dashboard Loading Error</h1>
        <div class="error-message">
          <strong>Error:</strong> ${errorMessage}
        </div>
        <p><strong>Possible solutions:</strong></p>
        <ul>
          <li>Check if dashboard.js file exists and has proper syntax</li>
          <li>Verify React component is properly formatted</li>
          <li>Check browser console for detailed error messages</li>
          <li>Try refreshing the page</li>
        </ul>
        <a href="/gads/" class="back-link">← Back to Main Menu</a>
        <a href="/gads/health" class="back-link">System Health</a>
        <div class="debug-info">
          <strong>Debug Info:</strong><br>
          Time: ${new Date().toISOString()}<br>
          Error: ${errorMessage}<br>
          Component Path: /scripts/analytics/dashboard.js
        </div>
      </div>
    </body>
    </html>
  `;
  
  res.status(500).send(html);
}

/**
 * Health check for dashboard dependencies
 */
function checkDashboardHealth() {
  const checks = {
    dashboard_component: false,
    component_syntax: false,
    component_size: 0
  };
  
  try {
    // Check if dashboard component exists
    const dashboardPath = path.join(__dirname, 'dashboard.js');
    checks.dashboard_component = fs.existsSync(dashboardPath);
    
    if (checks.dashboard_component) {
      // Basic syntax check
      const content = fs.readFileSync(dashboardPath, 'utf8');
      checks.component_size = content.length;
      checks.component_syntax = content.includes('GoogleAdsDashboard') && 
                               content.includes('React') &&
                               content.length > 1000; // Basic size check
    }
    
  } catch (error) {
    console.error('Dashboard health check failed:', error.message);
  }
  
  return {
    healthy: Object.values(checks).filter(check => typeof check === 'boolean').every(check => check === true),
    checks: checks,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  serveDashboard,
  checkDashboardHealth
};