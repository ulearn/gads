/**
 * MCP Tool Definitions and Registry
 * Contains all tool schemas, descriptions, and metadata
 */

const toolDefinitions = {
  // Google Ads API Tools - Direct API Access
  GAds_Account_API: {
    name: 'GAds_Account_API',
    description: 'Get Google Ads account-level settings and basic information (Direct API)',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Google Ads account ID (default: live account)'
        }
      }
    }
  },

  GAds_Campaign_API: {
    name: 'GAds_Campaign_API',
    description: 'Comprehensive campaign analysis including settings, performance, ad groups, keywords, and ads (Direct API)',
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
        date_range_days: {
          type: 'number',
          description: 'Number of days for performance metrics',
          default: 30
        },
        include_ad_groups: {
          type: 'boolean',
          description: 'Include ad group settings and targeting',
          default: true
        },
        include_keywords: {
          type: 'boolean',
          description: 'Include keywords and match types',
          default: true
        },
        include_ads: {
          type: 'boolean',
          description: 'Include ad content and performance',
          default: true
        }
      }
    }
  },

  GAds_Create_API: {
    name: 'GAds_Create_API',
    description: 'Create new Google Ads campaigns based on existing successful campaigns with country/language targeting (Mutate API)',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Google Ads account ID (default: live account)'
        },
        template_campaign_id: {
          type: 'string',
          description: 'ID of the existing successful campaign to copy from',
          required: true
        },
        new_campaign_name: {
          type: 'string',
          description: 'Name for the new campaign',
          required: true
        },
        target_country_code: {
          type: 'string',
          description: 'Target country code (e.g., IT for Italy, ES for Spain, FR for France)',
          required: true
        },
        target_language_code: {
          type: 'string',
          description: 'Target language code (e.g., en, es, it, fr, de)',
          default: 'en'
        },
        daily_budget_micros: {
          type: 'number',
          description: 'Daily budget in micros (e.g., 50000000 = $50/day)',
          default: 50000000
        },
        copy_ad_groups: {
          type: 'boolean',
          description: 'Copy ad groups from template campaign',
          default: true
        },
        copy_keywords: {
          type: 'boolean',
          description: 'Copy keywords from template campaign',
          default: true
        },
        copy_ads: {
          type: 'boolean',
          description: 'Copy ads from template campaign',
          default: true
        }
      },
      required: ['template_campaign_id', 'new_campaign_name', 'target_country_code']
    }
  },

  GAds_UpdateBudget_API: {
    name: 'GAds_UpdateBudget_API',
    description: 'Update the daily budget of an existing Google Ads campaign (Mutate API)',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Google Ads account ID (default: live account)'
        },
        campaign_id: {
          type: 'string',
          description: 'ID of the campaign to update budget for',
          required: true
        },
        daily_budget_micros: {
          type: 'number',
          description: 'New daily budget in micros (e.g., 1000000 = €1/day, 50000000 = €50/day)',
          required: true
        }
      },
      required: ['campaign_id', 'daily_budget_micros']
    }
  },

  GAds_UpdateStatus_API: {
    name: 'GAds_UpdateStatus_API',
    description: 'Update the status of an existing Google Ads campaign (enable/pause/remove) (Mutate API)',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Google Ads account ID (default: live account)'
        },
        campaign_id: {
          type: 'string',
          description: 'ID of the campaign to update status for',
          required: true
        },
        status: {
          type: 'string',
          description: 'New campaign status',
          enum: ['ENABLED', 'PAUSED', 'REMOVED'],
          required: true
        }
      },
      required: ['campaign_id', 'status']
    }
  },

  GAds_Audience_API: {
    name: 'GAds_Audience_API',
    description: 'Audience Manager access for segments, custom audiences, targeting insights, and demographic data (Direct API)',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Google Ads account ID (default: live account)'
        },
        include_segments: {
          type: 'boolean',
          description: 'Include audience segments and custom segments',
          default: true
        },
        include_demographics: {
          type: 'boolean',
          description: 'Include demographic targeting data',
          default: true
        },
        include_insights: {
          type: 'boolean',
          description: 'Include audience insights and performance data',
          default: true
        }
      }
    }
  },

  // MySQL Database Tools - Historical Data Analysis
  Summary_MySql: {
    name: 'Summary_MySql',
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

  Campaign_MySql: {
    name: 'Campaign_MySql',
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

  Budget_MySql: {
    name: 'Budget_MySql',
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
  },

  Pipeline_MySql: {
    name: 'Pipeline_MySql',
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

  Territory_MySql: {
    name: 'Territory_MySql',
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

  Burn_MySql: {
    name: 'Burn_MySql',
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
  }

  // Basic echo tool for testing - COMMENTED OUT
  /*
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
  }
  */
};

/**
 * Get all available tools for MCP tools/list response
 */
function getAllTools() {
  return Object.values(toolDefinitions);
}

/**
 * Get tool by name
 */
function getToolByName(name) {
  // Check by object key first (for compatibility)
  const toolByKey = Object.values(toolDefinitions).find(tool => 
    Object.keys(toolDefinitions).includes(name) && toolDefinitions[name] === tool
  );
  
  if (toolByKey) return toolByKey;
  
  // Check by display name
  return Object.values(toolDefinitions).find(tool => tool.name === name);
}

/**
 * Check if tool exists
 */
function toolExists(name) {
  return getToolByName(name) !== undefined;
}

module.exports = {
  toolDefinitions,
  getAllTools,
  getToolByName,
  toolExists
};