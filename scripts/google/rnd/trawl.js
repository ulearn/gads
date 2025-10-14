/**
 * Trawl Manager - Google Search Console Integration
 * Path: /home/hub/public_html/gads/rnd/trawl.js
 * 
 * ALL business logic for Search Console keyword trawling
 */

const { google } = require('googleapis');

class TrawlManager {
  constructor(googleOAuth, getDbConnection, config) {
    this.googleOAuth = googleOAuth;
    this.getDbConnection = getDbConnection;
    this.config = config;
    this.searchConsole = google.searchconsole({
      version: 'v1',
      auth: googleOAuth
    });
  }

  /**
   * Test Search Console connection
   */
  async testConnection() {
    try {
      const response = await this.searchConsole.sites.list();
      return {
        success: true,
        message: 'Search Console connection successful',
        sites: response.data.siteEntry || []
      };
    } catch (error) {
      return {
        success: false,
        message: 'Search Console connection failed',
        error: error.message
      };
    }
  }

  /**
   * Main trawl function - handles all sources
   */
  async trawl(options = {}) {
    const {
      country = 'ALL',
      days = this.config.searchConsole.defaultDays,
      sources = ['search_console'],
      maxResults = this.config.searchConsole.maxResults,
      saveToDatabase = true
    } = options;

    console.log(`🎣 RND Trawl: ${country}, ${days} days, sources: ${sources.join(', ')}`);
    
    const results = {
      success: true,
      country,
      total_keywords: 0,
      education_keywords: 0,
      keywords: [],
      date_range: {
        startDate: this.getDateDaysAgo(days),
        endDate: this.getDateDaysAgo(0)
      },
      trawled_at: new Date().toISOString()
    };

    // Search Console trawl
    if (sources.includes('search_console')) {
      try {
        const scKeywords = await this.trawlSearchConsole({
          country,
          days,
          maxResults
        });
        results.keywords.push(...scKeywords);
      } catch (error) {
        console.error('Search Console trawl failed:', error);
        results.errors = results.errors || [];
        results.errors.push(error.message);
      }
    }

    // Process and score keywords
    results.keywords = this.processKeywords(results.keywords, country);
    results.total_keywords = results.keywords.length;
    
    // Count education keywords
    results.education_keywords = results.keywords.filter(kw => 
      this.isEducationKeyword(kw.keyword)
    ).length;

    // Save to database
    if (saveToDatabase && results.keywords.length > 0) {
      await this.saveToDatabase(results.keywords, country);
    }

    return results;
  }

  /**
   * Trawl from Google Search Console
   */
  async trawlSearchConsole(options) {
    const {
      country,
      days,
      maxResults
    } = options;

    const siteUrl = this.config.searchConsole.siteUrl;
    const startDate = this.getDateDaysAgo(days);
    const endDate = this.getDateDaysAgo(0);

    console.log(`📊 Trawling Search Console: ${siteUrl} from ${startDate} to ${endDate}`);

    const request = {
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query', 'country', 'device'],
        rowLimit: maxResults,
        dimensionFilterGroups: country !== 'ALL' ? [{
          filters: [{
            dimension: 'country',
            expression: country
          }]
        }] : undefined
      }
    };

    try {
      const response = await this.searchConsole.searchanalytics.query(request);
      const rows = response.data.rows || [];
      
      console.log(`Found ${rows.length} keywords from Search Console`);
      
      return rows.map(row => ({
        keyword: row.keys[0], // query
        country_code: row.keys[1], // country
        device_type: row.keys[2], // device
        source: 'search_console',
        organic_impressions: Math.round(row.impressions || 0),
        organic_clicks: Math.round(row.clicks || 0),
        organic_ctr: row.ctr || 0,
        organic_position: row.position || 0,
        intent_score: this.calculateIntentScore(row)
      }));
    } catch (error) {
      console.error('Search Console API error:', error);
      throw error;
    }
  }

  /**
   * Get keywords ready for testing
   */
  async getKeywords(params = {}) {
    const {
      country = 'ALL',
      minIntentScore = 40,
      limit = 50,
      excludeTested = true
    } = params;

    const conn = await this.getDbConnection();
    
    try {
      let query = `
        SELECT 
          keyword,
          country_code,
          source,
          intent_score,
          organic_impressions,
          organic_clicks,
          organic_ctr,
          organic_position,
          tested_in_campaign,
          trawled_at
        FROM trawled_keywords
        WHERE intent_score >= ?
      `;
      
      const queryParams = [minIntentScore];
      
      if (country !== 'ALL') {
        query += ' AND country_code = ?';
        queryParams.push(country);
      }
      
      if (excludeTested) {
        query += ' AND (tested_in_campaign = 0 OR tested_in_campaign IS NULL)';
      }
      
      query += ' ORDER BY intent_score DESC LIMIT ?';
      queryParams.push(limit);
      
      const [rows] = await conn.execute(query, queryParams);
      
      return {
        success: true,
        country,
        total: rows.length,
        keywords: rows
      };
      
    } finally {
      await conn.end();
    }
  }

  /**
   * Calculate intent score based on Search Console metrics
   */
  calculateIntentScore(row) {
    let score = 50; // Base score
    
    const weights = this.config.scoring.weights.searchConsole;
    
    // Impressions factor
    if (row.impressions > 100) score += weights.impressions * 10;
    else if (row.impressions > 50) score += weights.impressions * 5;
    else if (row.impressions > 10) score += weights.impressions * 2;
    
    // Clicks factor
    if (row.clicks > 10) score += weights.clicks * 3;
    else if (row.clicks > 5) score += weights.clicks * 2;
    else if (row.clicks > 0) score += weights.clicks;
    
    // Position factor (lower is better)
    if (row.position <= 3) score += weights.position * 4;
    else if (row.position <= 10) score += weights.position * 2;
    else if (row.position <= 20) score += weights.position;
    else score -= weights.position;
    
    // CTR factor
    if (row.ctr > 0.1) score += 10;
    else if (row.ctr > 0.05) score += 5;
    
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Process and deduplicate keywords
   */
  processKeywords(keywords, country) {
    const keywordMap = new Map();
    
    keywords.forEach(kw => {
      const key = kw.keyword.toLowerCase().trim();
      
      if (!keywordMap.has(key) || keywordMap.get(key).intent_score < kw.intent_score) {
        keywordMap.set(key, {
          ...kw,
          keyword: key,
          country_code: country !== 'ALL' ? country : kw.country_code
        });
      }
    });
    
    return Array.from(keywordMap.values())
      .sort((a, b) => b.intent_score - a.intent_score);
  }

  /**
   * Check if keyword is education-related
   */
  isEducationKeyword(keyword) {
    const educationTerms = [
      'english', 'course', 'school', 'study', 'learn',
      'education', 'student', 'visa', 'dublin', 'ireland',
      'ielts', 'cambridge', 'exam', 'work', 'inglés', 
      'inglês', 'école', 'scuola'
    ];
    
    const lowerKeyword = keyword.toLowerCase();
    return educationTerms.some(term => lowerKeyword.includes(term));
  }

  /**
   * Save keywords to database
   */
  async saveToDatabase(keywords, country) {
    const conn = await this.getDbConnection();
    
    try {
      // Create table if not exists
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS trawled_keywords (
          id INT AUTO_INCREMENT PRIMARY KEY,
          keyword VARCHAR(255) NOT NULL,
          country_code VARCHAR(3),
          source VARCHAR(50),
          intent_score INT DEFAULT 0,
          organic_impressions INT,
          organic_clicks INT,
          organic_ctr DECIMAL(5,2),
          organic_position DECIMAL(5,2),
          device_type VARCHAR(20),
          tested_in_campaign BOOLEAN DEFAULT FALSE,
          campaign_id VARCHAR(50),
          trawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_keyword_country (keyword, country_code),
          INDEX idx_intent (intent_score),
          INDEX idx_country (country_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Insert keywords
      for (const kw of keywords) {
        await conn.execute(`
          INSERT INTO trawled_keywords 
          (keyword, country_code, source, intent_score, 
           organic_impressions, organic_clicks, organic_ctr, 
           organic_position, device_type, trawled_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            intent_score = GREATEST(intent_score, VALUES(intent_score)),
            organic_impressions = VALUES(organic_impressions),
            organic_clicks = VALUES(organic_clicks),
            organic_ctr = VALUES(organic_ctr),
            organic_position = VALUES(organic_position),
            trawled_at = NOW()
        `, [
          kw.keyword,
          kw.country_code || country,
          kw.source,
          kw.intent_score,
          kw.organic_impressions,
          kw.organic_clicks,
          kw.organic_ctr,
          kw.organic_position,
          kw.device_type || null
        ]);
      }
      
      console.log(`✅ Saved ${keywords.length} keywords to database`);
    } catch (error) {
      console.error('Database save error:', error);
    } finally {
      await conn.end();
    }
  }

  /**
   * Helper: Get date X days ago
   */
  getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
}

module.exports = TrawlManager;