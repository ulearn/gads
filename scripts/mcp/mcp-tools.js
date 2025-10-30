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

  GAds_Universal_Query_API: {
    name: 'GAds_Universal_Query_API',
    description: '📊 Universal READ-ONLY access to Google Ads using GAQL queries - SAFE for all analysis',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Google Ads account ID (default: live account)'
        },
        query: {
          type: 'string',
          description: 'Google Ads Query Language (GAQL) query - READ ONLY operations',
          required: true
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 1000)',
          default: 1000
        }
      },
      required: ['query']
    }
  },

  GAds_Universal_Write_API: {
    name: 'GAds_Universal_Write_API',
    description: '⚠️ DANGER: Universal WRITE access to Google Ads - can CREATE, UPDATE, or DELETE anything. Requires explicit confirmation!',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Google Ads account ID (default: live account)'
        },
        resource_type: {
          type: 'string',
          description: 'Resource type: adGroups, adGroupCriteria (keywords), adGroupAds (ads), campaigns, etc.',
          required: true
        },
        operation_type: {
          type: 'string',
          description: 'Operation type: create, update, remove, or mutate',
          enum: ['create', 'update', 'remove', 'mutate'],
          required: true
        },
        operations: {
          type: 'array',
          description: 'Array of operations to perform (structure depends on resource and operation type)',
          required: true
        },
        confirm_danger: {
          type: 'boolean',
          description: '⚠️ SAFETY: Must explicitly set to true to confirm this dangerous operation',
          required: true
        }
      },
      required: ['resource_type', 'operation_type', 'operations', 'confirm_danger']
    }
  },

  GAds_Keyword_Ideas_API: {
    name: 'GAds_Keyword_Ideas_API',
    description: '🔍 Generate keyword ideas using Google Ads Keyword Planner for campaign optimization',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Google Ads account ID (default: live account)'
        },
        seed_keywords: {
          type: 'array',
          description: 'Starting keywords to generate ideas from (e.g. ["english school dublin", "learn english ireland"])',
          items: { type: 'string' },
          default: []
        },
        seed_url: {
          type: 'string',
          description: 'URL to extract keyword ideas from (optional)'
        },
        language_code: {
          type: 'string',
          description: 'Language code for targeting (e.g. en, es, it, fr)',
          default: 'en'
        },
        location_codes: {
          type: 'array',
          description: 'Location codes for targeting (default: [\"2372\"] for Ireland)',
          items: { type: 'string' },
          default: ['2372']
        },
        page_size: {
          type: 'number',
          description: 'Maximum number of keyword ideas to return',
          default: 50
        }
      }
    }
  },

  GAds_Keyword_Research_API: {
    name: 'GAds_Keyword_Research_API',
    description: '📋 Comprehensive keyword research report with ideas, competition analysis, and strategic recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Google Ads account ID (default: live account)'
        },
        seed_keywords: {
          type: 'array',
          description: 'Starting keywords for research (e.g. ["english courses", "dublin language school"])',
          items: { type: 'string' },
          default: []
        },
        seed_url: {
          type: 'string',
          description: 'Website URL to analyze for keyword opportunities'
        },
        competitor_domains: {
          type: 'array',
          description: 'Competitor domains for analysis (e.g. ["delfinschool.ie", "atlasschool.ie"])',
          items: { type: 'string' },
          default: []
        },
        language_code: {
          type: 'string',
          description: 'Target language code',
          default: 'en'
        },
        location_codes: {
          type: 'array',
          description: 'Target location codes',
          items: { type: 'string' },
          default: ['2372']
        },
        max_cpc_bid_micros: {
          type: 'number',
          description: 'Maximum CPC bid in micros for budget planning (e.g. 2000000 = €2.00)',
          default: 2000000
        }
      }
    }
  },

  GAds_AssetGroup_Query: {
    name: 'GAds_AssetGroup_Query',
    description: '🔍 Query asset groups from a Performance Max campaign - Get all assets (headlines, descriptions, images, logos) for PMax campaigns',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Google Ads account ID (default: live account)'
        },
        campaign_id: {
          type: 'string',
          description: 'Performance Max campaign ID to query asset groups from',
          required: true
        }
      },
      required: ['campaign_id']
    }
  },

  GAds_AssetGroup_Clone: {
    name: 'GAds_AssetGroup_Clone',
    description: '🔄 Clone asset groups from one Performance Max campaign to another - Essential for PMax campaign cloning! Requires explicit confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Google Ads account ID (default: live account)'
        },
        source_campaign_id: {
          type: 'string',
          description: 'Source Performance Max campaign ID to clone from',
          required: true
        },
        target_campaign_id: {
          type: 'string',
          description: 'Target Performance Max campaign ID to clone to',
          required: true
        },
        new_final_urls: {
          type: 'array',
          description: 'Optional: Override final URLs for the cloned asset groups',
          items: { type: 'string' },
          default: null
        },
        status: {
          type: 'string',
          description: 'Status for cloned asset groups (default: PAUSED for safety)',
          enum: ['ENABLED', 'PAUSED', 'REMOVED'],
          default: 'PAUSED'
        },
        confirm_danger: {
          type: 'boolean',
          description: '⚠️ SAFETY: Must explicitly set to true to confirm this operation',
          required: true
        }
      },
      required: ['source_campaign_id', 'target_campaign_id', 'confirm_danger']
    }
  },

  GAds_AssetGroup_AddAssets: {
    name: 'GAds_AssetGroup_AddAssets',
    description: '➕ Add assets to a Performance Max asset group - Link headlines, descriptions, images to asset groups. Requires explicit confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Google Ads account ID (default: live account)'
        },
        asset_group_id: {
          type: 'string',
          description: 'Asset group ID to add assets to',
          required: true
        },
        assets: {
          type: 'array',
          description: 'Array of assets to add with their field types',
          items: {
            type: 'object',
            properties: {
              asset_id: {
                type: 'string',
                description: 'Asset ID to link'
              },
              field_type: {
                type: 'string',
                description: 'Field type: HEADLINE, LONG_HEADLINE, DESCRIPTION, MARKETING_IMAGE, LOGO, etc.',
                enum: ['HEADLINE', 'LONG_HEADLINE', 'DESCRIPTION', 'MARKETING_IMAGE', 'SQUARE_MARKETING_IMAGE', 'PORTRAIT_MARKETING_IMAGE', 'LOGO', 'LANDSCAPE_LOGO', 'YOUTUBE_VIDEO', 'BUSINESS_NAME', 'CALL_TO_ACTION_SELECTION']
              }
            },
            required: ['asset_id', 'field_type']
          },
          required: true
        },
        confirm_danger: {
          type: 'boolean',
          description: '⚠️ SAFETY: Must explicitly set to true to confirm this operation',
          required: true
        }
      },
      required: ['asset_group_id', 'assets', 'confirm_danger']
    }
  },

  GAds_AssetGroup_RemoveAssets: {
    name: 'GAds_AssetGroup_RemoveAssets',
    description: '➖ Remove assets from a Performance Max asset group - Unlink headlines, descriptions, images from asset groups. Requires explicit confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Google Ads account ID (default: live account)'
        },
        asset_group_id: {
          type: 'string',
          description: 'Asset group ID to remove assets from',
          required: true
        },
        assets: {
          type: 'array',
          description: 'Array of assets to remove with their field types',
          items: {
            type: 'object',
            properties: {
              asset_id: {
                type: 'string',
                description: 'Asset ID to unlink'
              },
              field_type: {
                type: 'string',
                description: 'Field type: HEADLINE, LONG_HEADLINE, DESCRIPTION, etc.'
              }
            },
            required: ['asset_id', 'field_type']
          },
          required: true
        },
        confirm_danger: {
          type: 'boolean',
          description: '⚠️ SAFETY: Must explicitly set to true to confirm this operation',
          required: true
        }
      },
      required: ['asset_group_id', 'assets', 'confirm_danger']
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