/**
 * FIXED: Google Ads Dashboard - With Committed Date Pattern (like roas-revenue)
 * Only fetches data when a complete date is selected, not during navigation
 */

const GoogleAdsDashboard = () => {
  // Initialize with today and 30 days ago
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const defaultStartDate = thirtyDaysAgo.toISOString().split('T')[0];
  
  // Current date inputs (what's shown in the inputs)
  const [startDate, setStartDate] = React.useState(defaultStartDate);
  const [endDate, setEndDate] = React.useState(today);
  
  // COMMITTED dates (what triggers the API call) - like roas-revenue
  const [committedStartDate, setCommittedStartDate] = React.useState(defaultStartDate);
  const [committedEndDate, setCommittedEndDate] = React.useState(today);
  
  const [analysisMode, setAnalysisMode] = React.useState('pipeline');
  const [isLoading, setIsLoading] = React.useState(true);
  const [dashboardData, setDashboardData] = React.useState(null);
  const [error, setError] = React.useState(null);

  // Smart date change handlers - only commit when it's a real date selection
  const handleStartDateChange = (e) => {
    const newDate = e.target.value;
    setStartDate(newDate);
    
    // Only commit if it's a valid complete date (YYYY-MM-DD format)
    if (newDate && newDate.length === 10 && newDate !== committedStartDate) {
      // Check if this is just navigation or actual selection
      // In HTML date inputs, the value is only set when user selects a specific day
      setCommittedStartDate(newDate);
    }
  };
  
  const handleEndDateChange = (e) => {
    const newDate = e.target.value;
    setEndDate(newDate);
    
    // Only commit if it's a valid complete date
    if (newDate && newDate.length === 10 && newDate !== committedEndDate) {
      setCommittedEndDate(newDate);
    }
  };

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🔄 Fetching dashboard data: ${committedStartDate} to ${committedEndDate}, ${analysisMode} mode`);
      
      // Validate dates
      if (!committedStartDate || !committedEndDate) {
        throw new Error('Please select both start and end dates');
      }
      
      if (new Date(committedStartDate) > new Date(committedEndDate)) {
        throw new Error('Start date must be before end date');
      }
      
      // Build parameters with committed dates
      const baseParams = `mode=${analysisMode}&startDate=${committedStartDate}&endDate=${committedEndDate}`;
      
      console.log(`📡 Fetching with params: ${baseParams}`);
      
      // Fetch data in parallel
      const [summaryRes, campaignsRes, territoriesRes] = await Promise.all([
        fetch(`/gads/analytics/dashboard-data?${baseParams}`),
        fetch(`/gads/analytics/campaigns?${baseParams}`),
        fetch(`/gads/analytics/territories?${baseParams}`)
      ]);

      // Check responses
      if (!summaryRes.ok) throw new Error(`Summary API failed: ${summaryRes.status}`);
      if (!campaignsRes.ok) throw new Error(`Campaigns API failed: ${campaignsRes.status}`);
      if (!territoriesRes.ok) throw new Error(`Territories API failed: ${territoriesRes.status}`);

      const [summaryData, campaignsData, territoriesData] = await Promise.all([
        summaryRes.json(),
        campaignsRes.json(),
        territoriesRes.json()
      ]);

      // Check for errors in responses
      if (!summaryData.success) throw new Error(`Summary error: ${summaryData.error}`);
      if (!campaignsData.success) throw new Error(`Campaigns error: ${campaignsData.error}`);
      if (!territoriesData.success) throw new Error(`Territories error: ${territoriesData.error}`);

      // Calculate period description
      const start = new Date(committedStartDate);
      const end = new Date(committedEndDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const periodDescription = `${committedStartDate} to ${committedEndDate} (${daysDiff} days)`;

      // Combine data
      const combinedData = {
        summary: summaryData.summary || {},
        campaigns: campaignsData.campaigns || [],
        territories: territoriesData.territories || [],
        period: periodDescription,
        analysisMode: analysisMode
      };

      console.log('✅ Dashboard data loaded:', {
        period: periodDescription,
        mode: analysisMode,
        campaigns: combinedData.campaigns.length,
        territories: combinedData.territories.length
      });
      
      setDashboardData(combinedData);

    } catch (err) {
      console.error('❌ Dashboard fetch failed:', err);
      setError(err.message);
    }
    
    setIsLoading(false);
  };

  // Fetch data when COMMITTED dates or mode change (not on every input change)
  React.useEffect(() => {
    if (committedStartDate && committedEndDate) {
      fetchDashboardData();
    }
  }, [committedStartDate, committedEndDate, analysisMode]);

  // Quick date range setters
  const setDateRange = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    
    // Set both display and committed dates
    setStartDate(startStr);
    setEndDate(endStr);
    setCommittedStartDate(startStr);
    setCommittedEndDate(endStr);
  };

  // Apply button for manual date selection
  const applyCustomDates = () => {
    if (startDate && endDate) {
      setCommittedStartDate(startDate);
      setCommittedEndDate(endDate);
    }
  };

  // Format helpers
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
        }, 'Loading dashboard...'),
        React.createElement('p', {
          className: 'text-sm text-gray-500 mt-2',
          key: 'loading-subtitle'
        }, `${committedStartDate} to ${committedEndDate} (${analysisMode} mode)`)
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
        React.createElement('p', {
          className: 'text-red-700 mb-4',
          key: 'error-message'
        }, error),
        React.createElement('button', {
          className: 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600',
          onClick: fetchDashboardData,
          key: 'retry-btn'
        }, 'Retry')
      ])
    ]);
  }

  const { summary, campaigns, territories } = dashboardData;

  // Metric card component
  const createMetricCard = (title, value, subtitle, icon, color = 'blue') => {
    return React.createElement('div', {
      className: 'bg-white rounded-lg shadow p-6',
      key: `card-${title.replace(/\s+/g, '-').toLowerCase()}`
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
          subtitle && React.createElement('p', {
            className: 'text-xs text-gray-500 mt-1',
            key: 'card-subtitle'
          }, subtitle)
        ]),
        React.createElement('div', {
          className: `text-${color}-600`,
          key: 'card-icon'
        }, icon)
      ])
    ]);
  };

  // Check if dates have changed but not committed
  const hasUncommittedChanges = (startDate !== committedStartDate) || (endDate !== committedEndDate);

  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6'
  }, [
    // Header with controls
    React.createElement('div', {
      className: 'mb-8',
      key: 'header'
    }, [
      React.createElement('div', {
        className: 'flex flex-col lg:flex-row lg:items-center lg:justify-between',
        key: 'header-content'
      }, [
        // Title
        React.createElement('div', { 
          key: 'header-text',
          className: 'mb-4 lg:mb-0'
        }, [
          React.createElement('h1', {
            className: 'text-3xl font-bold text-gray-900',
            key: 'title'
          }, 'Google Ads Pipeline Dashboard'),
          React.createElement('p', {
            className: 'text-gray-600 mt-2',
            key: 'subtitle'
          }, `${dashboardData.period}`)
        ]),
            
        // Controls
        React.createElement('div', {
          className: 'space-y-4',
          key: 'controls'
        }, [
          // Date controls row
          React.createElement('div', {
            className: 'flex items-center gap-4',
            key: 'date-row'
          }, [
            // Date inputs
            React.createElement('div', {
              className: 'flex items-center gap-2',
              key: 'date-inputs'
            }, [
              React.createElement('input', {
                type: 'date',
                className: 'bg-white border border-gray-300 rounded px-3 py-2 text-sm',
                value: startDate,
                onChange: handleStartDateChange,
                key: 'start-date'
              }),
              React.createElement('span', {
                className: 'text-gray-500',
                key: 'to'
              }, 'to'),
              React.createElement('input', {
                type: 'date',
                className: 'bg-white border border-gray-300 rounded px-3 py-2 text-sm',
                value: endDate,
                onChange: handleEndDateChange,
                key: 'end-date'
              }),
              // Apply button (shows when dates change)
              hasUncommittedChanges && React.createElement('button', {
                className: 'px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600',
                onClick: applyCustomDates,
                key: 'apply-btn'
              }, 'Apply')
            ]),

            // Analysis Mode
            React.createElement('select', {
              value: analysisMode,
              onChange: (e) => setAnalysisMode(e.target.value),
              className: 'bg-white border border-gray-300 rounded px-3 py-2 text-sm',
              key: 'mode-select'
            }, [
              React.createElement('option', { value: 'pipeline', key: 'pipeline' }, 'Pipeline'),
              React.createElement('option', { value: 'revenue', key: 'revenue' }, 'Revenue')
            ])
          ]),

          // Quick select buttons
          React.createElement('div', {
            className: 'flex gap-2',
            key: 'quick-buttons'
          }, [
            React.createElement('button', {
              className: 'px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded',
              onClick: () => setDateRange(7),
              key: 'btn-7'
            }, 'Last 7 days'),
            React.createElement('button', {
              className: 'px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded',
              onClick: () => setDateRange(30),
              key: 'btn-30'
            }, 'Last 30 days'),
            React.createElement('button', {
              className: 'px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded',
              onClick: () => setDateRange(60),
              key: 'btn-60'
            }, 'Last 60 days'),
            React.createElement('button', {
              className: 'px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded',
              onClick: () => setDateRange(90),
              key: 'btn-90'
            }, 'Last 90 days')
          ])
        ])
      ]),

      // Mode explanation
      React.createElement('div', {
        className: 'mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200',
        key: 'mode-explanation'
      }, [
        React.createElement('span', {
          className: 'text-sm text-blue-800',
          key: 'explanation'
        }, analysisMode === 'pipeline' 
          ? '📊 Pipeline Mode: Shows deals from contacts created in date range'
          : '💰 Revenue Mode: Shows deals that closed in date range')
      ])
    ]),

    // Metrics Grid
    React.createElement('div', {
      className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8',
      key: 'metrics'
    }, [
      createMetricCard('GAd Clicks', formatNumber(summary.gad_clicks || 0), 'From Google Ads', '👆', 'blue'),
      createMetricCard('GAd CTAs', formatNumber(summary.gad_ctas || 0), 'Form submissions', '🎯', 'indigo'),
      createMetricCard('MQLs Created', formatNumber(summary.totalContacts || 0), 'B2C Contacts', '👥', 'purple'),
      createMetricCard('MQLs Failed', formatNumber(summary.failed_validation || 0), `${summary.burn_rate || 0}% burn rate`, '❌', 'red'),
      createMetricCard('SQLs → Deals', `${formatNumber(summary.contactsWithDeals || 0)} → ${formatNumber(summary.totalDeals || 0)}`, `${summary.conversionRate || 0}% SQL rate`, '✅', 'green'),
      createMetricCard('Deals WON', formatNumber(summary.wonDeals || 0), `Lost: ${formatNumber(summary.lostDeals || 0)}`, '🏆', 'green')
    ]),

    // Campaign Cards
    React.createElement('div', {
      className: 'mb-8',
      key: 'campaigns-section'
    }, [
      React.createElement('h3', {
        className: 'text-lg font-semibold text-gray-900 mb-4',
        key: 'campaigns-title'
      }, `🎯 Campaign Performance (${campaigns.length} campaigns)`),
      React.createElement('div', {
        className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
        key: 'campaign-cards'
      }, campaigns.slice(0, 9).map((campaign, index) => 
        React.createElement('div', {
          className: 'bg-white p-4 rounded-lg shadow',
          key: `campaign-${index}`
        }, [
          React.createElement('h4', {
            className: 'font-medium text-gray-900 truncate mb-2',
            key: 'name'
          }, campaign.campaignName || 'Unknown'),
          React.createElement('div', {
            className: 'grid grid-cols-2 gap-2 text-sm',
            key: 'stats'
          }, [
            React.createElement('div', { key: 'won' }, `🏆 ${campaign.wonDeals || 0} won`),
            React.createElement('div', { key: 'revenue' }, `💰 ${formatCurrency(campaign.revenue || 0)}`),
            React.createElement('div', { key: 'contacts' }, `👥 ${campaign.contacts || 0} contacts`),
            React.createElement('div', { key: 'rate' }, `📊 ${campaign.conversionRate || 0}%`)
          ])
        ])
      ))
    ])
  ]);
};

// Render
const container = document.getElementById('dashboard-root');
const root = ReactDOM.createRoot(container);
root.render(React.createElement(GoogleAdsDashboard));