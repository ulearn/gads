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
  google_ads_account_overview: {
    name: 'google_ads_account_overview',
    description: 'Get comprehensive Google Ads account overview with campaign performance data',
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

  google_ads_campaign_analysis: {
    name: 'google_ads_campaign_analysis',
    description: 'Analyze campaign settings, bidding strategies, targeting, and optimization configurations',
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
  summary: {
    name: 'summary',
    description: 'Get comprehensive Google Ads dashboard summary with MQLs, SQLs, deals, and revenue metrics using proven analytics logic',
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

  pipeline: {
    name: 'pipeline',
    description: 'Comprehensive pipeline analysis showing Google Ads MQL stages and HubSpot SQL deal stages with proven analytics logic',
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

  burn: {
    name: 'burn',
    description: 'Advanced burn rate analysis with timeseries data and nationality breakdown using proven analytics logic',
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

  campaign: {
    name: 'campaign',
    description: 'Detailed campaign performance analysis with contacts, deals, revenue, and conversion rates',
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

  territory: {
    name: 'territory',
    description: 'Territory performance analysis showing supported vs unsupported territories with burn rate insights',
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

  budget: {
    name: 'budget',
    description: 'Budget analysis and ROI insights (requires Google Ads API integration)',
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