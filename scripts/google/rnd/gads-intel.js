/**
 * Google Ads Competitive Intelligence
 * Path: /home/hub/public_html/gads/scripts/google/rnd/gads-competitive.js
 * 
 * Extracts competitive intelligence from Google Ads API
 */

class GoogleAdsIntel {
  constructor(customer, getDbConnection, config) {
    this.customer = customer;
    this.getDbConnection = getDbConnection;
    this.config = config;
  }

  /**
   * 1. Keyword Planner Domain Seeding
   * Feed competitor domains to get suggested keywords
   */
  async analyzeCompetitorDomain(domain, country = 'ALL') {
    console.log(`🎯 Analyzing competitor domain: ${domain} for ${country}`);
    
    try {
      // Clean domain
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      // Build request for keyword ideas from domain
      const request = {
        customer_id: this.customer.credentials.customer_id,
        page_url: cleanDomain,
        language: this.getLanguageCode(country),
        geo_target_constants: this.getGeoTargets(country),
        keyword_plan_network: 'GOOGLE_SEARCH',
        include_adult_keywords: false
      };

      // Use generateKeywordIdeas endpoint
      const keywordIdeas = await this.customer.keywordPlanIdeas.generateKeywordIdeas(request);
      
      const keywords = [];
      for (const idea of keywordIdeas) {
        if (idea.text) {
          keywords.push({
            keyword: idea.text,
            domain: cleanDomain,
            country_code: country,
            avg_monthly_searches: idea.keyword_idea_metrics?.avg_monthly_searches || 0,
            competition: idea.keyword_idea_metrics?.competition || 'UNKNOWN',
            competition_index: idea.keyword_idea_metrics?.competition_index || 0,
            low_cpc: (idea.keyword_idea_metrics?.low_top_of_page_bid_micros || 0) / 1000000,
            high_cpc: (idea.keyword_idea_metrics?.high_top_of_page_bid_micros || 0) / 1000000,
            source: 'keyword_planner_domain'
          });
        }
      }

      // Save to database
      await this.saveCompetitorKeywords(keywords, domain, country);
      
      return {
        success: true,
        domain: cleanDomain,
        country,
        keywords_found: keywords.length,
        top_keywords: keywords.slice(0, 20)
      };

    } catch (error) {
      console.error(`Domain analysis failed for ${domain}:`, error);
      return {
        success: false,
        domain,
        error: error.message
      };
    }
  }

  /**
   * 2. Auction Insights - See who you're competing against
   */
  async getAuctionInsights(campaignId = null) {
    console.log(`🏆 Getting auction insights${campaignId ? ` for campaign ${campaignId}` : ''}`);
    
    try {
      let query;
      
      if (campaignId) {
        query = `
          SELECT 
            campaign.id,
            campaign.name,
            campaign_auction_insight.domain,
            campaign_auction_insight.impression_share,
            campaign_auction_insight.overlap_rate,
            campaign_auction_insight.position_above_rate,
            campaign_auction_insight.top_of_page_rate,
            campaign_auction_insight.absolute_top_of_page_rate,
            campaign_auction_insight.outranking_share
          FROM campaign_auction_insight
          WHERE campaign.id = ${campaignId}
          AND segments.date DURING LAST_30_DAYS
        `;
      } else {
        query = `
          SELECT 
            campaign.id,
            campaign.name,
            campaign_auction_insight.domain,
            campaign_auction_insight.impression_share,
            campaign_auction_insight.overlap_rate,
            campaign_auction_insight.position_above_rate
          FROM campaign_auction_insight
          WHERE segments.date DURING LAST_30_DAYS
          ORDER BY campaign_auction_insight.impression_share DESC
          LIMIT 100
        `;
      }

      const results = await this.customer.query(query);
      
      // Process results
      const insights = {};
      for (const row of results) {
        const campaignName = row.campaign.name;
        if (!insights[campaignName]) {
          insights[campaignName] = [];
        }
        
        insights[campaignName].push({
          domain: row.campaign_auction_insight.domain,
          impression_share: row.campaign_auction_insight.impression_share,
          overlap_rate: row.campaign_auction_insight.overlap_rate,
          position_above_rate: row.campaign_auction_insight.position_above_rate,
          outranking_share: row.campaign_auction_insight.outranking_share
        });
      }

      // Save to database
      await this.saveAuctionInsights(insights);
      
      return {
        success: true,
        campaigns_analyzed: Object.keys(insights).length,
        total_competitors: this.countUniqueCompetitors(insights),
        insights
      };

    } catch (error) {
      console.error('Auction insights failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 3. Search Query Mining - Find queries where you lose to competitors
   */
  async mineSearchQueries(days = 30) {
    console.log(`⛏️ Mining search queries for competitive gaps (last ${days} days)`);
    
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const query = `
        SELECT 
          campaign.id,
          campaign.name,
          ad_group.id,
          ad_group.name,
          search_term_view.search_term,
          search_term_view.status,
          metrics.clicks,
          metrics.impressions,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.search_impression_share,
          metrics.search_top_impression_share,
          metrics.search_absolute_top_impression_share,
          metrics.search_impression_share_lost_to_rank,
          metrics.search_impression_share_lost_to_budget
        FROM search_term_view
        WHERE segments.date BETWEEN '${this.formatDate(startDate)}' AND '${this.formatDate(endDate)}'
        AND metrics.impressions > 10
        ORDER BY metrics.search_impression_share_lost_to_rank DESC
        LIMIT 500
      `;

      const results = await this.customer.query(query);
      
      const competitiveGaps = [];
      
      for (const row of results) {
        const lostToRank = row.metrics.search_impression_share_lost_to_rank || 0;
        const lostToBudget = row.metrics.search_impression_share_lost_to_budget || 0;
        
        // High loss to rank means competitors are beating you
        if (lostToRank > 0.3) {
          competitiveGaps.push({
            search_term: row.search_term_view.search_term,
            campaign: row.campaign.name,
            ad_group: row.ad_group.name,
            impressions: row.metrics.impressions,
            clicks: row.metrics.clicks,
            impression_share: row.metrics.search_impression_share || 0,
            lost_to_rank: lostToRank,
            lost_to_budget: lostToBudget,
            avg_cpc: row.metrics.average_cpc || 0,
            competitive_intensity: this.calculateCompetitiveIntensity(lostToRank, lostToBudget)
          });
        }
      }

      // Save to database
      await this.saveCompetitiveGaps(competitiveGaps);
      
      return {
        success: true,
        queries_analyzed: results.length,
        competitive_gaps_found: competitiveGaps.length,
        top_gaps: competitiveGaps.slice(0, 20),
        summary: this.summarizeGaps(competitiveGaps)
      };

    } catch (error) {
      console.error('Search query mining failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze all MEI competitors
   */
  async analyzeMEICompetitors(limit = 5) {
    const results = {
      success: true,
      competitors_analyzed: [],
      total_keywords_found: 0,
      errors: []
    };

    const competitors = Object.keys(this.config.meiSchools).slice(0, limit);
    
    for (const domain of competitors) {
      try {
        console.log(`Analyzing ${domain}...`);
        const result = await this.analyzeCompetitorDomain(domain, 'ALL');
        
        if (result.success) {
          results.competitors_analyzed.push(domain);
          results.total_keywords_found += result.keywords_found;
        } else {
          results.errors.push({ domain, error: result.error });
        }
        
        // Delay to avoid rate limits
        await this.delay(2000);
        
      } catch (error) {
        results.errors.push({ domain, error: error.message });
      }
    }

    return results;
  }

  // ========== HELPER METHODS ==========

  calculateCompetitiveIntensity(lostToRank, lostToBudget) {
    // High loss to rank = strong competitors
    // High loss to budget = you're being outspent
    return Math.round((lostToRank * 0.7 + lostToBudget * 0.3) * 100);
  }

  summarizeGaps(gaps) {
    const totalLostImpressions = gaps.reduce((sum, gap) => {
      return sum + (gap.impressions * gap.lost_to_rank);
    }, 0);

    const avgCompetitiveIntensity = gaps.reduce((sum, gap) => {
      return sum + gap.competitive_intensity;
    }, 0) / gaps.length;

    return {
      total_gaps: gaps.length,
      estimated_lost_impressions: Math.round(totalLostImpressions),
      avg_competitive_intensity: Math.round(avgCompetitiveIntensity),
      top_competitive_terms: gaps.slice(0, 5).map(g => g.search_term)
    };
  }

  countUniqueCompetitors(insights) {
    const domains = new Set();
    Object.values(insights).forEach(campaignCompetitors => {
      campaignCompetitors.forEach(c => domains.add(c.domain));
    });
    return domains.size;
  }

  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  getLanguageCode(country) {
    const languages = {
      'ARG': '1003', // Spanish
      'BRA': '1014', // Portuguese
      'MEX': '1003', // Spanish
      'ESP': '1003', // Spanish
      'ITA': '1004', // Italian
      'FRA': '1002', // French
      'ALL': '1000'  // English
    };
    return languages[country] || '1000';
  }

  getGeoTargets(country) {
    const targets = {
      'ARG': ['geoTargetConstants/2032'],
      'BRA': ['geoTargetConstants/2076'],
      'MEX': ['geoTargetConstants/2484'],
      'ESP': ['geoTargetConstants/2724'],
      'ITA': ['geoTargetConstants/2380'],
      'FRA': ['geoTargetConstants/2250']
    };
    return targets[country] || [];
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========== DATABASE METHODS ==========

  async saveCompetitorKeywords(keywords, domain, country) {
    const conn = await this.getDbConnection();
    
    try {
      for (const kw of keywords) {
        await conn.execute(`
          INSERT INTO competitor_keywords 
          (keyword, domain, country_code, avg_monthly_searches, 
           competition, low_cpc, high_cpc, source, analyzed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            avg_monthly_searches = VALUES(avg_monthly_searches),
            competition = VALUES(competition),
            low_cpc = VALUES(low_cpc),
            high_cpc = VALUES(high_cpc),
            analyzed_at = NOW()
        `, [
          kw.keyword,
          domain,
          country,
          kw.avg_monthly_searches,
          kw.competition,
          kw.low_cpc,
          kw.high_cpc,
          kw.source
        ]);
      }
      console.log(`✅ Saved ${keywords.length} keywords for ${domain}`);
    } finally {
      await conn.end();
    }
  }

  async saveAuctionInsights(insights) {
    const conn = await this.getDbConnection();
    
    try {
      for (const [campaign, competitors] of Object.entries(insights)) {
        for (const competitor of competitors) {
          await conn.execute(`
            INSERT INTO auction_insights 
            (campaign_name, competitor_domain, impression_share, 
             overlap_rate, position_above_rate, analyzed_at)
            VALUES (?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
              impression_share = VALUES(impression_share),
              overlap_rate = VALUES(overlap_rate),
              position_above_rate = VALUES(position_above_rate),
              analyzed_at = NOW()
          `, [
            campaign,
            competitor.domain,
            competitor.impression_share,
            competitor.overlap_rate,
            competitor.position_above_rate
          ]);
        }
      }
    } finally {
      await conn.end();
    }
  }

  async saveCompetitiveGaps(gaps) {
    const conn = await this.getDbConnection();
    
    try {
      for (const gap of gaps) {
        await conn.execute(`
          INSERT INTO competitive_gaps 
          (search_term, campaign, ad_group, impressions, 
           lost_to_rank, competitive_intensity, analyzed_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            impressions = VALUES(impressions),
            lost_to_rank = VALUES(lost_to_rank),
            competitive_intensity = VALUES(competitive_intensity),
            analyzed_at = NOW()
        `, [
          gap.search_term,
          gap.campaign,
          gap.ad_group,
          gap.impressions,
          gap.lost_to_rank,
          gap.competitive_intensity
        ]);
      }
    } finally {
      await conn.end();
    }
  }
}

module.exports = GoogleAdsIntel;