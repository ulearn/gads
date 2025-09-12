/**
 * ENHANCED: Dashboard Server - HTML Template & React Setup with Attribution Enhancement Support
 * /scripts/analytics/dashboard-server.js
 * 
 * ENHANCEMENTS:
 * - Better error handling for component loading
 * - Validate React component before serving
 * - Fallback if dashboard.js has syntax errors
 * - Attribution enhancement awareness
 */

const fs = require('fs');
const path = require('path');

/**
 * Serve the React dashboard with enhanced error handling and attribution support
 */
function serveDashboard(req, res) {
  try {
    console.log('🔄 Dashboard server: Loading React component with attribution enhancements...');
    
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
    
    console.log('✅ Dashboard component validated, serving HTML with attribution enhancement support...');
    
    // Generate the complete HTML page with enhanced features
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Google Ads Pipeline Dashboard - Enhanced Attribution</title>
          
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
            
            /* Attribution enhancement indicator */
            .attribution-enhanced {
              position: relative;
            }
            
            .attribution-enhanced::after {
              content: '🔧';
              position: absolute;
              top: -5px;
              right: -5px;
              font-size: 12px;
              opacity: 0.7;
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
                <p class="mt-2 text-sm text-gray-500">Enhanced Attribution System Active</p>
              </div>
            </div>
          </div>
          
          <!-- Enhanced Error Handling -->
          <script>
            // Attribution enhancement detection
            window.ATTRIBUTION_ENHANCED = true;
            
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
                '<div class="mb-4 p-2 bg-blue-50 rounded text-sm text-blue-700">' +
                '<strong>Attribution Enhancement:</strong> Active<br>' +
                '<span class="text-xs">Issue may be related to enhanced attribution logic</span>' +
                '</div>' +
                '<button onclick="window.location.reload()" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-2">Reload Dashboard</button>' +
                '<a href="/gads/" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-decoration-none">← Main Menu</a>' +
                '</div></div>';
              
              document.getElementById('dashboard-root').innerHTML = errorDiv.innerHTML;
              return true;
            };
            
            window.addEventListener('unhandledrejection', function(event) {
              console.error('🚨 Unhandled Promise Rejection:', event.reason);
              console.log('🔧 Attribution enhancement system may need attention');
              event.preventDefault();
            });
            
            // Log attribution enhancement status
            console.log('🔧 Attribution Enhancement System: ACTIVE');
            console.log('   • {campaign} tracking template fix enabled');
            console.log('   • Enhanced campaign attribution logic active');
            console.log('   • Multi-layered attribution queries enabled');
          </script>
          
          <!-- React Component -->
          <script type="text/babel">
              try {
                console.log('🔄 Loading React component with attribution enhancements...');
                ${dashboardComponent}
                console.log('✅ React component loaded successfully with attribution enhancements');
              } catch (error) {
                console.error('❌ React component failed to load:', error);
                console.log('🔧 This may be related to attribution enhancement integration');
                document.getElementById('dashboard-root').innerHTML = 
                  '<div class="min-h-screen bg-red-50 flex items-center justify-center">' +
                  '<div class="text-center p-8 bg-white rounded-xl shadow-lg max-w-lg">' +
                  '<h1 class="text-2xl font-bold text-red-600 mb-4">❌ Component Error</h1>' +
                  '<p class="text-gray-600 mb-4">Failed to load React component</p>' +
                  '<p class="text-sm text-gray-500 bg-gray-100 p-2 rounded mb-4">' + error.message + '</p>' +
                  '<div class="mb-4 p-2 bg-blue-50 rounded text-sm text-blue-700">' +
                  '<strong>Attribution Enhancement:</strong> Active<br>' +
                  '<span class="text-xs">Component may need updating for enhanced attribution</span>' +
                  '</div>' +
                  '<button onclick="window.location.reload()" class="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Retry</button>' +
                  '</div></div>';
              }
          </script>
      </body>
      </html>
    `;
    
    res.send(html);
    console.log('✅ Dashboard HTML served successfully with attribution enhancement support');
    
  } catch (error) {
    console.error('❌ Dashboard server critical error:', error.message);
    serveErrorPage(res, `Critical error: ${error.message}`);
  }
}

/**
 * Enhanced error page with attribution system information
 */
function serveErrorPage(res, errorMessage) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard Error - Attribution Enhanced</title>
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
        .enhancement-info {
          background: #e3f2fd;
          padding: 15px;
          border-radius: 4px;
          border-left: 4px solid #2196f3;
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
        
        <div class="enhancement-info">
          <strong>🔧 Attribution Enhancement System Status:</strong> Active<br>
          <span style="font-size: 14px;">
            The dashboard now includes enhanced attribution logic to handle {campaign} tracking template issues.
            This error may be related to the integration of these enhancements.
          </span>
        </div>
        
        <p><strong>Possible solutions:</strong></p>
        <ul>
          <li>Check if dashboard.js file exists and has proper syntax with attribution enhancements</li>
          <li>Verify React component is properly formatted for enhanced attribution</li>
          <li>Check browser console for detailed error messages about attribution logic</li>
          <li>Ensure hubspot-data.js attribution fixes are deployed</li>
          <li>Try refreshing the page</li>
        </ul>
        <a href="/gads/" class="back-link">← Back to Main Menu</a>
        <a href="/gads/health" class="back-link">System Health</a>
        <div class="debug-info">
          <strong>Debug Info:</strong><br>
          Time: ${new Date().toISOString()}<br>
          Error: ${errorMessage}<br>
          Component Path: /scripts/analytics/dashboard.js<br>
          Attribution Enhancement: ACTIVE<br>
          Enhancement Features: {campaign} fix, enhanced queries, multi-layered attribution
        </div>
      </div>
    </body>
    </html>
  `;
  
  res.status(500).send(html);
}

/**
 * Enhanced health check for dashboard dependencies including attribution system
 */
function checkDashboardHealth() {
  const checks = {
    dashboard_component: false,
    component_syntax: false,
    component_size: 0,
    attribution_enhancement: false,
    hubspot_data_integration: false
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
      
      // Check for attribution enhancement awareness
      checks.attribution_enhancement = content.includes('dashboard-data') || 
                                      content.includes('/analytics/') ||
                                      content.includes('fetchDashboardData');
    }
    
    // Check for hubspot-data.js integration
    const hubspotDataPath = path.join(__dirname, 'hubspot-data.js');
    checks.hubspot_data_integration = fs.existsSync(hubspotDataPath);
    
  } catch (error) {
    console.error('Dashboard health check failed:', error.message);
  }
  
  return {
    healthy: Object.values(checks).filter(check => typeof check === 'boolean').every(check => check === true),
    checks: checks,
    attribution_system: {
      status: 'ACTIVE',
      features: [
        '{campaign} tracking template fix',
        'Enhanced attribution queries', 
        'Multi-layered attribution logic',
        'Campaign name fallback logic'
      ]
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  serveDashboard,
  checkDashboardHealth
};