/**
 * ENHANCED: Google Ads Dashboard - Pipeline vs Revenue Analysis with Attribution Enhancements
 * /scripts/analytics/dashboard.js
 * 
 * ENHANCEMENTS:
 * - Attribution fix awareness and reporting
 * - Enhanced debug logging for attribution issues
 * - Better error handling for attribution-related problems
 * - Visual indicators for enhanced attribution data
 * - Improved API parameter handling
 */

const GoogleAdsDashboard = () => {
  const [dateRange, setDateRange] = React.useState('7');
  const [analysisMode, setAnalysisMode] = React.useState('pipeline');
  const [selectedCampaign, setSelectedCampaign] = React.useState('all');
  const [isLoading, setIsLoading] = React.useState(true);
  const [dashboardData, setDashboardData] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [attributionEnhancement, setAttributionEnhancement] = React.useState(null);

  // Fetch dashboard data when parameters change
  React.useEffect(() => {
    fetchDashboardData();
  }, [dateRange, analysisMode, selectedCampaign]);

  // Initialize attribution enhancement detection
  React.useEffect(() => {
    console.log('🔧 Attribution Enhancement System: Initializing...');
    if (window.ATTRIBUTION_ENHANCED) {
      setAttributionEnhancement({
        status: 'ACTIVE',
        features: ['Campaign fix', 'Enhanced queries', 'Multi-layer attribution']
      });
      console.log('✅ Attribution Enhancement System: DETECTED');
    } else {
      console.log('⚠️ Attribution Enhancement System: Not detected');
    }
  }, []);

  // Enhanced data fetching with attribution awareness
  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🔄 DASHBOARD FETCH START: ${dateRange} days, ${analysisMode} mode (Enhanced Attribution)`);
      
      // CORRECTED: Use proper parameter names that match index.js
      const baseParams = `days=${dateRange}&mode=${analysisMode}`;
      
      console.log(`📡 Fetching from enhanced attribution endpoints:`, {
        params: baseParams,
        endpoints: [
          `/gads/analytics/dashboard-data?${baseParams}`,
          `/gads/analytics/campaigns?${baseParams}`,
          `/gads/analytics/territories?${baseParams}`
        ]
      });
      
      // Fetch data in parallel with enhanced error handling
      const [summaryRes, campaignsRes, territoriesRes] = await Promise.all([
        fetch(`/gads/analytics/dashboard-data?${baseParams}`),
        fetch(`/gads/analytics/campaigns?${baseParams}`),
        fetch(`/gads/analytics/territories?${baseParams}`)
      ]);

      console.log('📊 Enhanced attribution API response status:', {
        summary: `${summaryRes.status} ${summaryRes.statusText}`,
        campaigns: `${campaignsRes.status} ${campaignsRes.statusText}`,
        territories: `${territoriesRes.status} ${territoriesRes.statusText}`
      });

      // Enhanced error checking with attribution context
      if (!summaryRes.ok) {
        const errorText = await summaryRes.text();
        console.error('❌ Summary API error (Attribution Enhanced):', errorText);
        throw new Error(`Summary API failed: ${summaryRes.status} - ${errorText}`);
      }
      if (!campaignsRes.ok) {
        const errorText = await campaignsRes.text();
        console.error('❌ Campaigns API error (Attribution Enhanced):', errorText);
        throw new Error(`Campaigns API failed: ${campaignsRes.status} - ${errorText}`);
      }
      if (!territoriesRes.ok) {
        const errorText = await territoriesRes.text();
        console.error('❌ Territories API error (Attribution Enhanced):', errorText);
        throw new Error(`Territories API failed: ${territoriesRes.status} - ${errorText}`);
      }

      console.log('✅ All enhanced attribution APIs OK, parsing JSON...');

      const [summaryData, campaignsData, territoriesData] = await Promise.all([
        summaryRes.json(),
        campaignsRes.json(),
        territoriesRes.json()
      ]);

      console.log('📊 ENHANCED ATTRIBUTION API RESPONSES:', {
        summaryData,
        campaignsData,
        territoriesData
      });

      // Enhanced debugging for attribution data
      console.log('🔧 ATTRIBUTION ENHANCEMENT DATA ANALYSIS:', {
        summary: {
          success: summaryData.success,
          enhancement: summaryData.attribution_enhancement,
          summary_keys: summaryData.summary ? Object.keys(summaryData.summary) : 'NO SUMMARY',
          analysis_mode: summaryData.analysisMode,
          deal_logic: summaryData.dealLogic,
          error: summaryData.error
        },
        campaigns: {
          success: campaignsData.success,
          enhancement: campaignsData.attribution_enhancement,
          count: campaignsData.campaigns?.length || 0,
          sample: campaignsData.campaigns?.slice(0, 2),
          analysis_mode: campaignsData.analysisMode,
          error: campaignsData.error
        },
        territories: {
          success: territoriesData.success,
          enhancement: territoriesData.attribution_enhancement,
          count: territoriesData.territories?.length || 0,
          sample: territoriesData.territories?.slice(0, 2),
          analysis_mode: territoriesData.analysisMode,
          error: territoriesData.error
        }
      });

      // Enhanced success checking with attribution validation
      if (!summaryData.success) {
        console.error('❌ Enhanced attribution summary error:', summaryData.error);
        throw new Error(`Summary API error: ${summaryData.error || 'Unknown error'}`);
      }
      if (!campaignsData.success) {
        console.error('❌ Enhanced attribution campaigns error:', campaignsData.error);
        throw new Error(`Campaigns API error: ${campaignsData.error || 'Unknown error'}`);
      }
      if (!territoriesData.success) {
        console.error('❌ Enhanced attribution territories error:', territoriesData.error);
        throw new Error(`Territories API error: ${territoriesData.error || 'Unknown error'}`);
      }

      // Combine data with enhanced attribution metadata
      const combinedData = {
        summary: summaryData.summary || {},
        campaigns: campaignsData.campaigns || [],
        territories: territoriesData.territories || [],
        mqlValidation: summaryData.mql_validation_details || null,
        period: summaryData.period || `Last ${dateRange} days`,
        analysisMode: analysisMode,
        backendMode: summaryData.analysisMode || 'unknown',
        dealLogic: summaryData.dealLogic || 'unknown',
        
        // Enhanced attribution metadata
        attributionEnhancement: {
          summary: summaryData.attribution_enhancement || null,
          campaigns: campaignsData.attribution_enhancement || null,
          territories: territoriesData.attribution_enhancement || null,
          active: !!(summaryData.attribution_enhancement || campaignsData.attribution_enhancement || territoriesData.attribution_enhancement)
        }
      };

      console.log('✅ ENHANCED ATTRIBUTION DASHBOARD FETCH SUCCESS:', {
        summary_keys: Object.keys(combinedData.summary),
        campaigns_count: combinedData.campaigns.length,
        territories_count: combinedData.territories.length,
        period: combinedData.period,
        frontend_mode: combinedData.analysisMode,
        backend_mode: combinedData.backendMode,
        deal_logic: combinedData.dealLogic,
        attribution_active: combinedData.attributionEnhancement.active
      });

      // 🚨 ENHANCED DEBUG: Show attribution-enhanced card values
      console.log('🔧 ENHANCED ATTRIBUTION CARD VALUES:', {
        'MQLs Created (Enhanced)': combinedData.summary?.totalContacts,
        'MQLs Failed (Enhanced)': combinedData.summary?.failed_validation,
        'Burn Rate (Enhanced)': combinedData.summary?.burn_rate,
        'SQLs Passed (Enhanced)': combinedData.summary?.contactsWithDeals,
        'Conversion Rate (Enhanced)': combinedData.summary?.conversionRate,
        'Total Deals (Enhanced)': combinedData.summary?.totalDeals,
        'WON Deals (Enhanced)': combinedData.summary?.wonDeals,
        'LOST Deals (Enhanced)': combinedData.summary?.lostDeals,
        'Total Revenue (Enhanced)': combinedData.summary?.totalRevenue,
        'Avg Deal Value (Enhanced)': combinedData.summary?.avgDealValue,
        'Unique Campaigns (Enhanced)': combinedData.summary?.uniqueCampaigns,
        'Attribution Enhancement Status': combinedData.attributionEnhancement.active ? 'ACTIVE' : 'INACTIVE'
      });
      
      setDashboardData(combinedData);

    } catch (err) {
      console.error('❌ ENHANCED ATTRIBUTION DASHBOARD FETCH FAILED:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        attribution_context: 'Error occurred in enhanced attribution system'
      });
      setError(`Attribution Enhanced Error: ${err.message}`);
    }
    
    setIsLoading(false);
  };

  // Enhanced formatting functions
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

  // Enhanced event handlers with attribution logging
  const handleDateRangeChange = (newRange) => {
    console.log(`📅 Date range changed (Enhanced Attribution): ${newRange} days`);
    setDateRange(newRange);
  };

  const handleAnalysisModeChange = (newMode) => {
    console.log(`🔄 Analysis mode changed (Enhanced Attribution): ${newMode}`);
    setAnalysisMode(newMode);
  };

  const handleCampaignChange = (newCampaign) => {
    console.log(`🎯 Campaign filter changed (Enhanced Attribution): ${newCampaign}`);
    setSelectedCampaign(newCampaign);
  };

  // Enhanced loading state with attribution info
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
        }, 'Loading enhanced attribution dashboard...'),
        React.createElement('p', {
          className: 'text-sm text-gray-500 mt-2',
          key: 'loading-subtitle'
        }, `${dateRange} days (${analysisMode} mode)`),
        attributionEnhancement && React.createElement('p', {
          className: 'text-xs text-blue-600 mt-2',
          key: 'attribution-status'
        }, '🔧 Attribution Enhancement: ACTIVE')
      ])
    ]);
  }

  // Enhanced error state with attribution context
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
        }, '❌ Enhanced Attribution Dashboard Error'),
        React.createElement('div', {
          className: 'text-left bg-gray-100 p-4 rounded mb-4',
          key: 'error-details'
        }, [
          React.createElement('p', {
            className: 'text-red-700 font-mono text-sm',
            key: 'error-message'
          }, error)
        ]),
        attributionEnhancement && React.createElement('div', {
          className: 'mb-4 p-2 bg-blue-50 rounded text-sm text-blue-700',
          key: 'attribution-info'
        }, [
          React.createElement('strong', { key: 'attribution-title' }, 'Attribution Enhancement Status: '),
          React.createElement('span', { key: 'attribution-status' }, attributionEnhancement.status || 'ACTIVE'),
          React.createElement('br', { key: 'br' }),
          React.createElement('span', { 
            key: 'attribution-note',
            className: 'text-xs'
          }, 'Error may be related to enhanced attribution integration')
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

  // Enhanced metric card creation with attribution indicators
  const createMetricCard = (title, value, trend, icon, color = 'blue', isEnhanced = false) => {
    return React.createElement('div', {
      className: `bg-white rounded-lg shadow p-6 ${isEnhanced ? 'attribution-enhanced border border-blue-200' : ''}`,
      key: `card-${title.replace(/\\s+/g, '-').toLowerCase()}`
    }, [
      React.createElement('div', {
        className: 'flex items-center justify-between',
        key: 'card-header'
      }, [
        React.createElement('div', { key: 'card-content' }, [
          React.createElement('p', {
            className: 'text-sm font-medium text-gray-600 flex items-center',
            key: 'card-title'
          }, [
            title,
            isEnhanced && React.createElement('span', {
              key: 'enhanced-indicator',
              className: 'ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded',
              title: 'Enhanced Attribution Active'
            }, '🔧')
          ]),
          React.createElement('p', {
            className: `text-2xl font-bold text-${color}-600`,
            key: 'card-value'
          }, value),
          // Enhanced debug with attribution info
          React.createElement('p', {
            className: 'text-xs text-gray-400 mt-1',
            key: 'card-debug'
          }, `Raw: ${typeof value === 'string' ? value : JSON.stringify(value)} ${isEnhanced ? '(Enhanced)' : ''}`)
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

  const { summary, campaigns, territories, mqlValidation, attributionEnhancement: attrEnhancement } = dashboardData;
  const isAttributionEnhanced = attrEnhancement?.active || false;

  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6'
  }, [
    // Enhanced Header with Attribution Status
    React.createElement('div', {
      className: 'mb-8',
      key: 'header'
    }, [
      React.createElement('div', {
        className: 'flex flex-col lg:flex-row lg:items-center lg:justify-between',
        key: 'header-content'
      }, [
        // Logo and Title Section with Attribution Badge
        React.createElement('div', { 
          key: 'header-text',
          className: 'flex items-center space-x-4'
        }, [
          // ULearn Logo
          React.createElement('img', {
            src: 'https://ulearnschool.com/sites/default/files/images/logos/ulearn-trans.png',
            alt: 'ULearn School Logo',
            className: 'h-12 w-auto',
            key: 'ulearn-logo'
          }),
          
          // Title and Subtitle with Attribution Badge
          React.createElement('div', { key: 'title-section' }, [
            React.createElement('div', { 
              key: 'title-row',
              className: 'flex items-center space-x-3'
            }, [
              React.createElement('h1', {
                className: 'text-3xl font-bold text-gray-900',
                key: 'title'
              }, 'Google Ads Pipeline Dashboard'),
              isAttributionEnhanced && React.createElement('span', {
                key: 'attribution-badge',
                className: 'bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full',
                title: 'Enhanced Attribution System Active'
              }, '🔧 Enhanced')
            ]),
            React.createElement('p', {
              className: 'text-gray-600 mt-2',
              key: 'subtitle'
            }, [
              `Real Google Ads + HubSpot data from MySQL (${dashboardData.period})`,
              isAttributionEnhanced && React.createElement('span', {
                key: 'attribution-note',
                className: 'text-blue-600 ml-2'
              }, '• Attribution Enhanced')
            ])
          ])
        ]),
            
        // Controls Panel (unchanged)
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

      // Enhanced Mode Explanation with Attribution Info
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
              `Frontend: ${dashboardData.analysisMode} | Backend: ${dashboardData.backendMode} | Deal Logic: ${dashboardData.dealLogic}`,
              isAttributionEnhanced && React.createElement('span', {
                key: 'attribution-indicator',
                className: 'ml-2 font-semibold'
              }, '| 🔧 Attribution Enhanced')
            ])
          ])
        ])
      ])
    ]),

    // Enhanced Key Metrics Summary - 6-CARD GOOGLE ADS FUNNEL with Attribution Indicators
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
        'blue',
        false
      ),
      
      // 2. GAd CTAs (TODO: Get from pipeline data)
      createMetricCard(
        'GAd CTAs',
        formatNumber(summary.gad_ctas || 0),
        'Form submissions',
        '🎯',
        'indigo',
        false
      ),
      
      // 3. MQLs Created (Google Ads contacts) - ENHANCED
      createMetricCard(
        'MQLs Created',
        formatNumber(summary.totalContacts || 0),
        'B2C Contacts (Enhanced)',
        '👥',
        'purple',
        true
      ),
      
      // 4. MQLs Failed (territory validation failures) - ENHANCED
      createMetricCard(
        'MQLs Failed',
        formatNumber(summary.failed_validation || 0),
        `${summary.burn_rate || 0}% burn rate (Enhanced)`,
        '❌',
        'red',
        true
      ),
      
      // 5. SQLs → Deals Created (MERGED: contacts who became deals) - ENHANCED
      createMetricCard(
        'SQLs → Deals',
        `${formatNumber(summary.contactsWithDeals || 0)} → ${formatNumber(summary.totalDeals || 0)}`,
        `${summary.conversionRate || 0}% SQL rate (Enhanced)`,
        '✅',
        'green',
        true
      ),
      
      // 6. Deals WON (with lost subtitle) - ENHANCED
      createMetricCard(
        `Deals WON ${analysisMode === 'revenue' ? '🏆' : '⏳'}`,
        formatNumber(summary.wonDeals || 0),
        `Lost: ${formatNumber(summary.lostDeals || 0)} | Enhanced Mode: ${analysisMode}`,
        analysisMode === 'revenue' ? '🏆' : '⏳',
        analysisMode === 'revenue' ? 'green' : 'yellow',
        true
      )
    ]),

    // Enhanced Territory and Campaign Analysis
    React.createElement('div', {
      className: 'grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8',
      key: 'analysis-section'
    }, [
      // Enhanced Territory Performance
      React.createElement('div', {
        className: `bg-white rounded-lg shadow p-6 ${isAttributionEnhanced ? 'border-l-4 border-blue-500' : ''}`,
        key: 'territory-performance'
      }, [
        React.createElement('h3', {
          className: 'text-lg font-semibold text-gray-900 mb-4 flex items-center',
          key: 'territory-title'
        }, [
          '🌍 Territory Performance',
          isAttributionEnhanced && React.createElement('span', {
            key: 'territory-enhanced',
            className: 'ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded'
          }, 'Enhanced')
        ]),
        
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

      // Enhanced Campaign Performance
      React.createElement('div', {
        className: `bg-white rounded-lg shadow p-6 ${isAttributionEnhanced ? 'border-l-4 border-green-500' : ''}`,
        key: 'campaign-performance'
      }, [
        React.createElement('h3', {
          className: 'text-lg font-semibold text-gray-900 mb-4 flex items-center',
          key: 'campaign-title'
        }, [
          '🎯 Campaign Performance',
          isAttributionEnhanced && React.createElement('span', {
            key: 'campaign-enhanced',
            className: 'ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded'
          }, 'Enhanced')
        ]),
        
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

    // Enhanced Debug Panel with Attribution Info
    React.createElement('div', {
      className: `mt-8 ${isAttributionEnhanced ? 'bg-blue-50 border border-blue-200' : 'bg-gray-100'} p-4 rounded-lg text-xs text-gray-600`,
      key: 'debug-panel'
    }, [
      React.createElement('h4', {
        className: 'font-bold mb-2',
        key: 'debug-title'
      }, isAttributionEnhanced ? '🔧 Enhanced Attribution Debug Info' : '🔧 Debug Info'),
      React.createElement('div', {
        className: 'grid grid-cols-1 md:grid-cols-4 gap-4',
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
        ]),
        React.createElement('div', { key: 'debug-attribution' }, [
          React.createElement('strong', { key: 'attribution-title' }, 'Attribution: '),
          React.createElement('code', { 
            key: 'attribution-status',
            className: isAttributionEnhanced ? 'text-blue-600 font-semibold' : ''
          }, isAttributionEnhanced ? 'ENHANCED ✓' : 'Standard')
        ])
      ])
    ]),

    // Enhanced Footer with Attribution Info
    React.createElement('div', {
      className: 'mt-8 text-center text-sm text-gray-500',
      key: 'footer'
    }, [
      React.createElement('p', { key: 'footer-text' }, 
        `Dashboard updated: ${new Date().toLocaleString()} | ` +
        `Mode: ${analysisMode === 'pipeline' ? 'Pipeline Analysis' : 'Revenue Analysis'} | ` +
        `Campaign: ${selectedCampaign === 'all' ? 'All Campaigns' : selectedCampaign}`
      ),
      React.createElement('p', { key: 'footer-note', className: 'mt-2' }, [
        'Data source: Real HubSpot CRM data synchronized to MySQL | Enhanced with Pipeline vs Revenue analysis',
        isAttributionEnhanced && React.createElement('span', {
          key: 'attribution-footer',
          className: 'text-blue-600 font-medium ml-2'
        }, '| 🔧 Attribution Enhanced')
      ])
    ])
  ]);
};

// Render the enhanced dashboard
const container = document.getElementById('dashboard-root');
const root = ReactDOM.createRoot(container);
root.render(React.createElement(GoogleAdsDashboard));