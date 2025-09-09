/**
 * MCP Tool Definitions and Registry
 * Contains all tool schemas, descriptions, and metadata
 */

const toolDefinitions = {
  // Basic echo tool for testing
  echo: {
    name: 'echo',
    description: 'Simple echo tool that returns whatever message you send to it',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to echo back'
        }
      },
      required: ['message']
    }
  },

  // Google Ads API Tools
  gads_account_api: {
    name: 'gads_account_api',
    description: 'Get comprehensive Google Ads account overview with campaign performance data (Direct API)',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Google Ads account ID (default: live account)'
        },
        include_campaigns: {
          type: 'boolean',
          description: 'Include detailed campaign information',
          default: true
        },
        date_range_days: {
          type: 'number',
          description: 'Number of days for performance metrics',
          default: 30
        }
      }
    }
  },

  gads_campaign_api: {
    name: 'gads_campaign_api',
    description: 'Analyze campaign settings, bidding strategies, targeting, and optimization configurations (Direct API)',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Google Ads account ID (default: live account)'
        },
        campaign_id: {
          type: 'string',
          description: 'Specific campaign ID to analyze (optional - analyzes all if not provided)'
        },
        include_targeting: {
          type: 'boolean',
          description: 'Include detailed targeting settings analysis',
          default: true
        },
        include_bidding: {
          type: 'boolean',
          description: 'Include detailed bidding strategy analysis',
          default: true
        }
      }
    }
  },

  // MySQL Database Tools - Refactored to use proven analytics modules
  summary_mysql: {
    name: 'Summary MySql',
    description: 'Get comprehensive Google Ads dashboard summary with MQLs, SQLs, deals, revenue, and monthly spend data (MySQL Database)',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to analyze',
          default: 30
        },
        mode: {
          type: 'string',
          description: 'Analysis mode: pipeline (deals from contacts in timeframe) or revenue (deals closed in timeframe)',
          enum: ['pipeline', 'revenue'],
          default: 'pipeline'
        }
      }
    }
  },

  pipeline_mysql: {
    name: 'pipeline_mysql',
    description: 'Comprehensive pipeline analysis with Google Ads costs, MQL stages, and HubSpot SQL deal stages (MySQL Database)',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to analyze',
          default: 30
        },
        campaign: {
          type: 'string',
          description: 'Campaign filter (default: all campaigns)',
          default: 'all'
        }
      }
    }
  },

  burn_mysql: {
    name: 'burn_mysql',
    description: 'Advanced burn rate analysis with timeseries data, nationality breakdown, and spend tracking (MySQL Database)',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to analyze',
          default: 30
        },
        granularity: {
          type: 'string',
          description: 'Data granularity: daily, weekly, or auto',
          enum: ['daily', 'weekly', 'auto'],
          default: 'auto'
        }
      }
    }
  },

  campaign_mysql: {
    name: 'campaign_mysql',
    description: 'Detailed campaign performance analysis with contacts, deals, revenue, monthly spend data, and conversion rates (MySQL Database)',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to analyze',
          default: 30
        },
        mode: {
          type: 'string',
          description: 'Analysis mode: pipeline or revenue',
          enum: ['pipeline', 'revenue'],
          default: 'pipeline'
        }
      }
    }
  },

  territory_mysql: {
    name: 'territory_mysql',
    description: 'Territory performance analysis showing supported vs unsupported territories with spend data and burn rate insights (MySQL Database)',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to analyze',
          default: 30
        },
        mode: {
          type: 'string',
          description: 'Analysis mode: pipeline or revenue',
          enum: ['pipeline', 'revenue'],
          default: 'pipeline'
        }
      }
    }
  },

  budget_mysql: {
    name: 'budget_mysql',
    description: 'Budget analysis and ROI insights with historical spend data (MySQL Database - Placeholder)',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to analyze',
          default: 30
        }
      }
    }
  }
};

/**
 * Get all available tools for MCP tools/list response
 */
function getAllTools() {
  return Object.values(toolDefinitions);
}

/**
 * Get tool definition by name
 */
function getToolByName(name) {
  return toolDefinitions[name] || null;
}

/**
 * Get tools by category
 */
function getToolsByCategory(category) {
  switch (category) {
    case 'api':
    case 'google_ads':
      return [
        toolDefinitions.google_ads_account_overview,
        toolDefinitions.google_ads_campaign_analysis
      ];
    
    case 'database':
    case 'mysql':
    case 'hubspot':
      return [
        toolDefinitions.summary,
        toolDefinitions.pipeline,
        toolDefinitions.burn,
        toolDefinitions.campaign,
        toolDefinitions.territory,
        toolDefinitions.budget
      ];
    
    case 'testing':
      return [toolDefinitions.echo];
    
    default:
      return getAllTools();
  }
}

/**
 * Check if a tool exists
 */
function toolExists(name) {
  return !!toolDefinitions[name];
}

module.exports = {
  toolDefinitions,
  getAllTools,
  getToolByName,
  getToolsByCategory,
  toolExists
};