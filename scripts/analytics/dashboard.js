/**
 * FINAL FIXED: Google Ads Dashboard - Pipeline vs Revenue Analysis
 * /scripts/analytics/dashboard.js
 * 
 * FIXED:
 * - Enhanced debug logging to see exactly what backend returns
 * - Proper analysis mode parameter passing
 * - Better error handling for missing data
 * - Visual indicators for analysis mode differences
 */

const GoogleAdsDashboard = () => {
  const [dateRange, setDateRange] = React.useState('7');
  const [analysisMode, setAnalysisMode] = React.useState('pipeline');
  const [selectedCampaign, setSelectedCampaign] = React.useState('all');
  const [isLoading, setIsLoading] = React.useState(true);
  const [dashboardData, setDashboardData] = React.useState(null);
  const [error, setError] = React.useState(null);

  // Fetch dashboard data when parameters change
  React.useEffect(() => {
    fetchDashboardData();
  }, [dateRange, analysisMode, selectedCampaign]);

  // Fetch data from APIs - ENHANCED DEBUG LOGGING
  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🔄 DASHBOARD FETCH START: ${dateRange} days, ${analysisMode} mode`);
      
      // CORRECTED: Use proper parameter names that match index.js
      const baseParams = `days=${dateRange}&mode=${analysisMode}`;
      
      console.log(`📡 Fetching from endpoints with params: ${baseParams}`);
      console.log(`   • /gads/analytics/dashboard-data?${baseParams}`);
      console.log(`   • /gads/analytics/campaigns?${baseParams}`);
      console.log(`   • /gads/analytics/territories?${baseParams}`);
      
      // Fetch data in parallel
      const [summaryRes, campaignsRes, territoriesRes] = await Promise.all([
        fetch(`/gads/analytics/dashboard-data?${baseParams}`),
        fetch(`/gads/analytics/campaigns?${baseParams}`),
        fetch(`/gads/analytics/territories?${baseParams}`)
      ]);

      console.log('📊 Raw response status:', {
        summary: `${summaryRes.status} ${summaryRes.statusText}`,
        campaigns: `${campaignsRes.status} ${campaignsRes.statusText}`,
        territories: `${territoriesRes.status} ${territoriesRes.statusText}`
      });

      // Check for errors with detailed reporting
      if (!summaryRes.ok) {
        const errorText = await summaryRes.text();
        console.error('❌ Summary API error:', errorText);
        throw new Error(`Summary API failed: ${summaryRes.status} - ${errorText}`);
      }
      if (!campaignsRes.ok) {
        const errorText = await campaignsRes.text();
        console.error('❌ Campaigns API error:', errorText);
        throw new Error(`Campaigns API failed: ${campaignsRes.status} - ${errorText}`);
      }
      if (!territoriesRes.ok) {
        const errorText = await territoriesRes.text();
        console.error('❌ Territories API error:', errorText);
        throw new Error(`Territories API failed: ${territoriesRes.status} - ${errorText}`);
      }

      console.log('✅ All API responses OK, parsing JSON...');

      const [summaryData, campaignsData, territoriesData] = await Promise.all([
        summaryRes.json(),
        campaignsRes.json(),
        territoriesRes.json()
      ]);

      console.log('📊 RAW API RESPONSES:', {
        summaryData,
        campaignsData,
        territoriesData
      });

      // CRITICAL DEBUG: Log exactly what each API returns
      console.log('🔍 SUMMARY DATA STRUCTURE:', {
        success: summaryData.success,
        summary_keys: summaryData.summary ? Object.keys(summaryData.summary) : 'NO SUMMARY',
        summary_content: summaryData.summary,
        analysis_mode: summaryData.analysisMode,
        deal_logic: summaryData.dealLogic,
        error: summaryData.error
      });

      console.log('🔍 CAMPAIGNS DATA STRUCTURE:', {
        success: campaignsData.success,
        campaigns_count: campaignsData.campaigns?.length || 0,
        campaigns_sample: campaignsData.campaigns?.slice(0, 2),
        analysis_mode: campaignsData.analysisMode,
        error: campaignsData.error
      });

      console.log('🔍 TERRITORIES DATA STRUCTURE:', {
        success: territoriesData.success,
        territories_count: territoriesData.territories?.length || 0,
        territories_sample: territoriesData.territories?.slice(0, 2),
        analysis_mode: territoriesData.analysisMode,
        error: territoriesData.error
      });

      // Check API success with detailed error reporting
      if (!summaryData.success) {
        console.error('❌ Summary data error:', summaryData.error);
        throw new Error(`Summary API error: ${summaryData.error || 'Unknown error'}`);
      }
      if (!campaignsData.success) {
        console.error('❌ Campaigns data error:', campaignsData.error);
        throw new Error(`Campaigns API error: ${campaignsData.error || 'Unknown error'}`);
      }
      if (!territoriesData.success) {
        console.error('❌ Territories data error:', territoriesData.error);
        throw new Error(`Territories API error: ${territoriesData.error || 'Unknown error'}`);
      }

      // Combine data with enhanced debugging
      const combinedData = {
        summary: summaryData.summary || {},
        campaigns: campaignsData.campaigns || [],
        territories: territoriesData.territories || [],
        mqlValidation: summaryData.mql_validation_details || null,
        period: summaryData.period || `Last ${dateRange} days`,
        analysisMode: analysisMode,
        backendMode: summaryData.analysisMode || 'unknown',
        dealLogic: summaryData.dealLogic || 'unknown'
      };

      console.log('✅ DASHBOARD FETCH SUCCESS - FINAL COMBINED DATA:', {
        summary_keys: Object.keys(combinedData.summary),
        campaigns_count: combinedData.campaigns.length,
        territories_count: combinedData.territories.length,
        period: combinedData.period,
        frontend_mode: combinedData.analysisMode,
        backend_mode: combinedData.backendMode,
        deal_logic: combinedData.dealLogic
      });

      // 🚨 CRITICAL DEBUG: Show exactly what's in the summary for the dashboard cards
      console.log('🎯 DASHBOARD CARD VALUES DEBUG:', {
        'MQLs Created (totalContacts)': combinedData.summary?.totalContacts,
        'MQLs Failed (failed_validation)': combinedData.summary?.failed_validation,
        'Burn Rate': combinedData.summary?.burn_rate,
        'SQLs Passed (contactsWithDeals)': combinedData.summary?.contactsWithDeals,
        'Conversion Rate': combinedData.summary?.conversionRate,
        'Total Deals': combinedData.summary?.totalDeals,
        'WON Deals': combinedData.summary?.wonDeals,
        'LOST Deals': combinedData.summary?.lostDeals,
        'Total Revenue': combinedData.summary?.totalRevenue,
        'Avg Deal Value': combinedData.summary?.avgDealValue,
        'Unique Campaigns': combinedData.summary?.uniqueCampaigns
      });
      
      setDashboardData(combinedData);

    } catch (err) {
      console.error('❌ DASHBOARD FETCH FAILED:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack
      });
      setError(err.message);
    }
    
    setIsLoading(false);
  };

  // Format functions
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat().format(value || 0);
  };

  // Event handlers
  const handleDateRangeChange = (newRange) => {
    console.log(`📅 Date range changed: ${newRange} days`);
    setDateRange(newRange);
  };

  const handleAnalysisModeChange = (newMode) => {
    console.log(`🔄 Analysis mode changed: ${newMode}`);
    setAnalysisMode(newMode);
  };

  const handleCampaignChange = (newCampaign) => {
    console.log(`🎯 Campaign filter changed: ${newCampaign}`);
    setSelectedCampaign(newCampaign);
  };

  // Loading state
  if (isLoading || !dashboardData) {
    return React.createElement('div', {
      className: 'min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center'
    }, [
      React.createElement('div', {
        className: 'text-center',
        key: 'loading'
      }, [
        React.createElement('div', {
          className: 'text-4xl mb-4',
          key: 'spinner'
        }, '🔄'),
        React.createElement('p', {
          className: 'text-lg text-gray-600',
          key: 'loading-text'
        }, 'Loading dashboard data...'),
        React.createElement('p', {
          className: 'text-sm text-gray-500 mt-2',
          key: 'loading-subtitle'
        }, `${dateRange} days (${analysisMode} mode)`)
      ])
    ]);
  }

  // Error state
  if (error) {
    return React.createElement('div', {
      className: 'min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center'
    }, [
      React.createElement('div', {
        className: 'text-center bg-white p-8 rounded-xl shadow-lg max-w-lg',
        key: 'error'
      }, [
        React.createElement('h2', {
          className: 'text-xl font-bold text-red-600 mb-4',
          key: 'error-title'
        }, '❌ Dashboard Error'),
        React.createElement('div', {
          className: 'text-left bg-gray-100 p-4 rounded mb-4',
          key: 'error-details'
        }, [
          React.createElement('p', {
            className: 'text-red-700 font-mono text-sm',
            key: 'error-message'
          }, error)
        ]),
        React.createElement('button', {
          className: 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-2',
          onClick: () => window.location.reload(),
          key: 'reload-btn'
        }, 'Reload Dashboard'),
        React.createElement('button', {
          className: 'bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600',
          onClick: fetchDashboardData,
          key: 'retry-btn'
        }, 'Retry')
      ])
    ]);
  }

  // Helper function to create metric cards with enhanced debugging
  const createMetricCard = (title, value, trend, icon, color = 'blue') => {
    return React.createElement('div', {
      className: 'bg-white rounded-lg shadow p-6',
      key: `card-${title.replace(/\\s+/g, '-').toLowerCase()}`
    }, [
      React.createElement('div', {
        className: 'flex items-center justify-between',
        key: 'card-header'
      }, [
        React.createElement('div', { key: 'card-content' }, [
          React.createElement('p', {
            className: 'text-sm font-medium text-gray-600',
            key: 'card-title'
          }, title),
          React.createElement('p', {
            className: `text-2xl font-bold text-${color}-600`,
            key: 'card-value'
          }, value),
          // DEBUG: Show raw value in small text
          React.createElement('p', {
            className: 'text-xs text-gray-400 mt-1',
            key: 'card-debug'
          }, `Raw: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
        ]),
        React.createElement('div', {
          className: `text-${color}-600`,
          key: 'card-icon'
        }, icon)
      ]),
      trend && React.createElement('div', {
        className: 'text-sm text-green-600 mt-2',
        key: 'card-trend'
      }, trend)
    ]);
  };

  const { summary, campaigns, territories, mqlValidation } = dashboardData;

  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6'
  }, [
    // Header
    React.createElement('div', {
      className: 'mb-8',
      key: 'header'
    }, [
      React.createElement('div', {
        className: 'flex flex-col lg:flex-row lg:items-center lg:justify-between',
        key: 'header-content'
      }, [
        React.createElement('div', { key: 'header-text' }, [
          React.createElement('h1', {
            className: 'text-3xl font-bold text-gray-900 mb-2',
            key: 'title'
          }, 'Google Ads Pipeline Dashboard'),
          React.createElement('p', {
            className: 'text-gray-600',
            key: 'subtitle'
          }, `Real HubSpot data from MySQL (${dashboardData.period})`)
        ]),
        
        // Controls Panel
        React.createElement('div', {
          className: 'mt-4 lg:mt-0 grid grid-cols-1 md:grid-cols-3 gap-4',
          key: 'controls-panel'
        }, [
          // Date Range
          React.createElement('div', {
            className: 'flex flex-col',
            key: 'date-selector'
          }, [
            React.createElement('label', {
              className: 'text-sm font-medium text-gray-700 mb-1',
              key: 'date-label'
            }, 'Date Range'),
            React.createElement('select', {
              value: dateRange,
              onChange: (e) => handleDateRangeChange(e.target.value),
              className: 'bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500',
              key: 'date-select'
            }, [
              React.createElement('option', { value: '7', key: '7' }, 'Last 7 days'),
              React.createElement('option', { value: '14', key: '14' }, 'Last 14 days'),
              React.createElement('option', { value: '30', key: '30' }, 'Last 30 days'),
              React.createElement('option', { value: '60', key: '60' }, 'Last 60 days'),
              React.createElement('option', { value: '90', key: '90' }, 'Last 90 days')
            ])
          ]),

          // Analysis Mode
          React.createElement('div', {
            className: 'flex flex-col',
            key: 'analysis-mode-selector'
          }, [
            React.createElement('label', {
              className: 'text-sm font-medium text-gray-700 mb-1',
              key: 'mode-label'
            }, 'Analysis Mode'),
            React.createElement('select', {
              value: analysisMode,
              onChange: (e) => handleAnalysisModeChange(e.target.value),
              className: 'bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500',
              key: 'mode-select'
            }, [
              React.createElement('option', { value: 'pipeline', key: 'pipeline' }, 'Pipeline Analysis'),
              React.createElement('option', { value: 'revenue', key: 'revenue' }, 'Revenue Analysis')
            ])
          ]),

          // Campaign Filter
          React.createElement('div', {
            className: 'flex flex-col',
            key: 'campaign-selector'
          }, [
            React.createElement('label', {
              className: 'text-sm font-medium text-gray-700 mb-1',
              key: 'campaign-label'
            }, 'Campaign Filter'),
            React.createElement('select', {
              value: selectedCampaign,
              onChange: (e) => handleCampaignChange(e.target.value),
              className: 'bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500',
              key: 'campaign-select'
            }, [
              React.createElement('option', { value: 'all', key: 'all' }, 'All Campaigns'),
              ...campaigns.slice(0, 10).map((campaign, index) => 
                React.createElement('option', { 
                  value: campaign.campaignName || campaign.name || `campaign-${index}`, 
                  key: `campaign-${index}` 
                }, campaign.campaignName || campaign.name || `Campaign ${index + 1}`)
              )
            ])
          ])
        ])
      ]),

      // Mode Explanation with Debug Info
      React.createElement('div', {
        className: 'mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200',
        key: 'mode-explanation'
      }, [
        React.createElement('div', {
          className: 'flex items-start space-x-2',
          key: 'explanation-content'
        }, [
          React.createElement('div', {
            className: 'text-blue-600',
            key: 'info-icon'
          }, 'ℹ️'),
          React.createElement('div', {
            className: 'text-sm text-blue-800',
            key: 'explanation-text'
          }, [
            React.createElement('strong', { key: 'mode-title' }, 
              analysisMode === 'pipeline' ? 'Pipeline Analysis Mode' : 'Revenue Analysis Mode'
            ),
            React.createElement('span', { key: 'mode-desc' }, 
              analysisMode === 'pipeline' 
                ? ' - Shows deals created in date range (up-to-the-minute pipeline data)'
                : ' - Shows deals closed in date range (revenue focus, excludes active pipeline)'
            ),
            React.createElement('div', { 
              key: 'debug-info',
              className: 'mt-2 text-xs text-blue-600'
            }, [
              `Frontend Mode: ${dashboardData.analysisMode} | `,
              `Backend Mode: ${dashboardData.backendMode} | `,
              `Deal Logic: ${dashboardData.dealLogic}`
            ])
          ])
        ])
      ])
    ]),

    // Key Metrics Summary - 6-CARD GOOGLE ADS FUNNEL
    React.createElement('div', {
      className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8',
      key: 'metrics-grid'
    }, [
      // 1. GAd Clicks (TODO: Get from Google Ads API)
      createMetricCard(
        'GAd Clicks',
        formatNumber(summary.gad_clicks || 0),
        'From Google Ads',
        '👆',
        'blue'
      ),
      
      // 2. GAd CTAs (TODO: Get from pipeline data)
      createMetricCard(
        'GAd CTAs',
        formatNumber(summary.gad_ctas || 0),
        'Form submissions',
        '🎯',
        'indigo'
      ),
      
      // 3. MQLs Created (Google Ads contacts)
      createMetricCard(
        'MQLs Created',
        formatNumber(summary.totalContacts || 0),
        'B2C Contacts',
        '👥',
        'purple'
      ),
      
      // 4. MQLs Failed (territory validation failures)
      createMetricCard(
        'MQLs Failed',
        formatNumber(summary.failed_validation || 0),
        `${summary.burn_rate || 0}% burn rate`,
        '❌',
        'red'
      ),
      
      // 5. SQLs → Deals Created (MERGED: contacts who became deals)
      createMetricCard(
        'SQLs → Deals',
        `${formatNumber(summary.contactsWithDeals || 0)} → ${formatNumber(summary.totalDeals || 0)}`,
        `${summary.conversionRate || 0}% SQL rate`,
        '✅',
        'green'
      ),
      
      // 6. Deals WON (with lost subtitle) - CRITICAL CARD FOR TESTING
      createMetricCard(
        `Deals WON ${analysisMode === 'revenue' ? '🏆' : '⏳'}`,
        formatNumber(summary.wonDeals || 0),
        `Lost: ${formatNumber(summary.lostDeals || 0)} | Mode: ${analysisMode}`,
        analysisMode === 'revenue' ? '🏆' : '⏳',
        analysisMode === 'revenue' ? 'green' : 'yellow'
      )
    ]),

    // Territory and Campaign Analysis
    React.createElement('div', {
      className: 'grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8',
      key: 'analysis-section'
    }, [
      // Territory Performance
      React.createElement('div', {
        className: 'bg-white rounded-lg shadow p-6',
        key: 'territory-performance'
      }, [
        React.createElement('h3', {
          className: 'text-lg font-semibold text-gray-900 mb-4',
          key: 'territory-title'
        }, '🌍 Territory Performance'),
        
        React.createElement('div', {
          className: 'space-y-4',
          key: 'territory-list'
        }, territories.slice(0, 8).map((territory, index) => 
          React.createElement('div', {
            className: `p-4 rounded-lg border ${
              territory.name === 'Unsupported Territory' ? 
              'cursor-pointer hover:bg-red-50 border border-red-200 bg-red-25' : 
              'border-gray-200'
            }`,
            onClick: territory.name === 'Unsupported Territory' ? 
              () => window.open('/gads/scripts/analytics/burn-rate.html', '_blank') : 
              undefined,
            key: `territory-${index}`
          }, [
            React.createElement('div', {
              className: 'flex items-center justify-between mb-2',
              key: 'territory-header'
            }, [
              React.createElement('h4', {
                className: 'font-medium text-gray-900',
                key: 'territory-name'
              }, territory.name),
              React.createElement('div', {
                className: 'w-3 h-3 rounded-full',
                style: { backgroundColor: territory.color },
                key: 'territory-color'
              })
            ]),
            React.createElement('div', {
              className: 'space-y-1 text-sm text-gray-600',
              key: 'territory-stats'
            }, [
              React.createElement('div', {
                key: 'contacts-stat'
              }, `👥 ${formatNumber(territory.contacts)} contacts`),
              React.createElement('div', {
                key: 'deals-stat'
              }, `🎯 ${formatNumber(territory.dealsCreated || 0)} deals`),
              React.createElement('div', {
                key: 'conversion-stat'
              }, `📊 ${territory.conversionRate || 0}% conversion`),
              territory.name === 'Unsupported Territory' && React.createElement('div', {
                className: 'text-red-600 font-medium',
                key: 'burn-indicator'
              }, '🔥 BURN RATE ALERT - Click for details')
            ])
          ])
        ))
      ]),

      // Campaign Performance
      React.createElement('div', {
        className: 'bg-white rounded-lg shadow p-6',
        key: 'campaign-performance'
      }, [
        React.createElement('h3', {
          className: 'text-lg font-semibold text-gray-900 mb-4',
          key: 'campaign-title'
        }, '🎯 Campaign Performance'),
        
        React.createElement('div', {
          className: 'space-y-4',
          key: 'campaign-list'
        }, campaigns.slice(0, 8).map((campaign, index) => 
          React.createElement('div', {
            className: 'p-4 border border-gray-200 rounded-lg',
            key: `campaign-${index}`
          }, [
            React.createElement('div', {
              className: 'flex items-center justify-between mb-2',
              key: 'campaign-header'
            }, [
              React.createElement('h4', {
                className: 'font-medium text-gray-900 truncate',
                key: 'campaign-name'
              }, campaign.campaignName || campaign.name || 'Unknown Campaign'),
              React.createElement('span', {
                className: 'text-sm text-green-600 font-medium',
                key: 'campaign-won'
              }, `${formatNumber(campaign.wonDeals || 0)} won`)
            ]),
            React.createElement('div', {
              className: 'grid grid-cols-2 gap-4 text-sm text-gray-600',
              key: 'campaign-stats'
            }, [
              React.createElement('div', { key: 'contacts' }, `👥 ${formatNumber(campaign.contacts || 0)} contacts`),
              React.createElement('div', { key: 'deals' }, `🎯 ${formatNumber(campaign.totalDeals || 0)} deals`),
              React.createElement('div', { key: 'revenue' }, `💰 ${formatCurrency(campaign.revenue || 0)}`),
              React.createElement('div', { key: 'rate' }, `📊 ${campaign.conversionRate || 0}%`)
            ])
          ])
        ))
      ])
    ]),

    // Debug Panel (only show in development)
    React.createElement('div', {
      className: 'mt-8 bg-gray-100 p-4 rounded-lg text-xs text-gray-600',
      key: 'debug-panel'
    }, [
      React.createElement('h4', {
        className: 'font-bold mb-2',
        key: 'debug-title'
      }, '🔧 Debug Info'),
      React.createElement('div', {
        className: 'grid grid-cols-1 md:grid-cols-3 gap-4',
        key: 'debug-content'
      }, [
        React.createElement('div', { key: 'debug-summary' }, [
          React.createElement('strong', { key: 'summary-title' }, 'Summary Keys: '),
          React.createElement('code', { key: 'summary-keys' }, Object.keys(summary).join(', '))
        ]),
        React.createElement('div', { key: 'debug-campaigns' }, [
          React.createElement('strong', { key: 'campaigns-title' }, 'Campaigns: '),
          React.createElement('code', { key: 'campaigns-count' }, `${campaigns.length} found`)
        ]),
        React.createElement('div', { key: 'debug-territories' }, [
          React.createElement('strong', { key: 'territories-title' }, 'Territories: '),
          React.createElement('code', { key: 'territories-count' }, `${territories.length} found`)
        ])
      ])
    ]),

    // Footer
    React.createElement('div', {
      className: 'mt-8 text-center text-sm text-gray-500',
      key: 'footer'
    }, [
      React.createElement('p', { key: 'footer-text' }, 
        `Dashboard updated: ${new Date().toLocaleString()} | ` +
        `Mode: ${analysisMode === 'pipeline' ? 'Pipeline Analysis' : 'Revenue Analysis'} | ` +
        `Campaign: ${selectedCampaign === 'all' ? 'All Campaigns' : selectedCampaign}`
      ),
      React.createElement('p', { key: 'footer-note', className: 'mt-2' }, 
        'Data source: Real HubSpot CRM data synchronized to MySQL | Enhanced with Pipeline vs Revenue analysis'
      )
    ])
  ]);
};

// Render the dashboard
const container = document.getElementById('dashboard-root');
const root = ReactDOM.createRoot(container);
root.render(React.createElement(GoogleAdsDashboard));