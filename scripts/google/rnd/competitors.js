/**
 * Competitor Analyzer
 * Path: /home/hub/public_html/gads/rnd/competitors.js
 * 
 * ALL business logic for competitor keyword extraction
 */

const axios = require('axios');
const cheerio = require('cheerio');

class CompetitorAnalyzer {
  constructor(getDbConnection, config) {
    this.getDbConnection = getDbConnection;
    this.config = config;
    this.allCompetitors = {
      ...config.meiSchools,
      ...config.additionalCompetitors
    };
  }

  /**
   * Analyze competitor URLs
   */
  async analyze(options = {}) {
    const {
      urls = [],
      country = 'ALL',
      saveToDatabase = true
    } = options;

    // If no URLs provided, use all competitors
    const urlsToProcess = urls.length > 0 
      ? urls 
      : Object.keys(this.allCompetitors).map(domain => `https://${domain}`);

    console.log(`🎯 RND Competitor Analysis: ${urlsToProcess.length} URLs for ${country}`);

    const results = {
      success: true,
      country,
      urls_processed: 0,
      urls_failed: 0,
      keywords: [],
      timestamp: new Date().toISOString()
    };

    // Process each URL
    for (const url of urlsToProcess) {
      try {
        const keywords = await this.extractKeywordsFromUrl(url);
        results.keywords.push(...keywords);
        results.urls_processed++;
        
        // Small delay to be polite
        await this.delay(500);
      } catch (error) {
        console.error(`Failed to process ${url}: ${error.message}`);
        results.urls_failed++;
      }
    }

    // Process and score keywords
    results.keywords = this.processCompetitorKeywords(results.keywords, country);
    
    // Save to database if configured
    if (saveToDatabase && results.keywords.length > 0) {
      await this.saveCompetitorKeywords(results.keywords, country);
    }

    // Return top keywords
    results.keywords = results.keywords.slice(0, 100);
    
    return results;
  }

  /**
   * Extract keywords from a single URL
   */
  async extractKeywordsFromUrl(url) {
    const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
    console.log(`📄 Fetching: ${cleanUrl}`);

    const response = await axios.get(cleanUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ULearnBot/1.0; +https://ulearn.ie)'
      }
    });

    const $ = cheerio.load(response.data);
    const keywords = [];

    // Extract from meta tags
    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc) {
      keywords.push(...this.extractPhrases(metaDesc, 'meta', 5));
    }

    const metaKeywords = $('meta[name="keywords"]').attr('content');
    if (metaKeywords) {
      metaKeywords.split(',').forEach(kw => {
        const cleaned = kw.trim().toLowerCase();
        if (cleaned.length > 2 && cleaned.length < 50) {
          keywords.push({ keyword: cleaned, source: 'meta', weight: 5 });
        }
      });
    }

    // Extract from headers
    $('h1').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text && text.length < 100) {
        keywords.push(...this.extractPhrases(text, 'h1', 8));
      }
    });

    $('h2').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text && text.length < 100) {
        keywords.push(...this.extractPhrases(text, 'h2', 5));
      }
    });

    // Extract from navigation
    $('nav a, .menu a, header a').each((i, elem) => {
      const text = $(elem).text().trim();
      const href = $(elem).attr('href');
      
      if (text && text.length > 2 && text.length < 50) {
        if (href && (href.includes('course') || href.includes('program') || href.includes('english'))) {
          keywords.push({ keyword: text.toLowerCase(), source: 'navigation', weight: 4 });
        }
      }
    });

    // Extract CTAs
    $('button, .btn, .button, a.cta').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text && text.length > 2 && text.length < 50) {
        keywords.push({ keyword: text.toLowerCase(), source: 'cta', weight: 6 });
      }
    });

    return keywords;
  }

  /**
   * Extract phrases from text
   */
  extractPhrases(text, source, weight) {
    const phrases = [];
    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    
    // Single words
    words.forEach(word => {
      if (word.length > 3 && !this.isStopWord(word)) {
        phrases.push({ keyword: word, source, weight });
      }
    });
    
    // 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      if (!this.isStopPhrase(phrase)) {
        phrases.push({ keyword: phrase, source, weight: weight * 1.5 });
      }
    }
    
    // 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (!this.isStopPhrase(phrase)) {
        phrases.push({ keyword: phrase, source, weight: weight * 2 });
      }
    }
    
    return phrases;
  }

  /**
   * Process and score competitor keywords
   */
  processCompetitorKeywords(keywords, country) {
    const keywordMap = new Map();
    
    // Aggregate keywords
    keywords.forEach(kw => {
      const key = kw.keyword.toLowerCase().trim();
      
      if (!keywordMap.has(key)) {
        keywordMap.set(key, {
          keyword: key,
          sources: new Set(),
          weight: 0,
          count: 0
        });
      }
      
      const data = keywordMap.get(key);
      data.sources.add(kw.source);
      data.weight += kw.weight;
      data.count++;
    });
    
    // Convert to array and calculate intent scores
    const processedKeywords = [];
    keywordMap.forEach((data, keyword) => {
      const intentScore = Math.min(100, Math.round(
        (data.weight * 2) + 
        (data.sources.size * 10) +
        (data.count * 3)
      ));
      
      processedKeywords.push({
        keyword,
        country_code: country,
        source: 'competitor',
        intent_score: intentScore,
        occurrences: data.count,
        weight: data.weight
      });
    });
    
    return processedKeywords.sort((a, b) => b.intent_score - a.intent_score);
  }

  /**
   * Save competitor keywords to database
   */
  async saveCompetitorKeywords(keywords, country) {
    const conn = await this.getDbConnection();
    
    try {
      for (const kw of keywords.slice(0, 200)) {
        await conn.execute(`
          INSERT INTO trawled_keywords 
          (keyword, country_code, source, intent_score, trawled_at)
          VALUES (?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            intent_score = GREATEST(intent_score, VALUES(intent_score)),
            trawled_at = NOW()
        `, [
          kw.keyword,
          country,
          'competitor',
          kw.intent_score
        ]);
      }
      
      console.log(`✅ Saved ${keywords.length} competitor keywords`);
    } catch (error) {
      console.error('Database save error:', error);
    } finally {
      await conn.end();
    }
  }

  /**
   * Get MEI schools list
   */
  async getMEISchools() {
    const meiSchools = Object.entries(this.config.meiSchools).map(([domain, name]) => ({
      domain,
      name,
      url: `https://${domain}`,
      association: 'MEI'
    }));

    return {
      success: true,
      source: 'MEI (English Education Ireland)',
      total: meiSchools.length,
      schools: meiSchools
    };
  }

  /**
   * Helper: Check stop words
   */
  isStopWord(word) {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were',
      'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did'
    ]);
    return stopWords.has(word.toLowerCase());
  }

  /**
   * Helper: Check stop phrases
   */
  isStopPhrase(phrase) {
    const stopPhrases = [
      'click here', 'learn more', 'read more', 'find out',
      'contact us', 'get in', 'in touch'
    ];
    return stopPhrases.some(stop => phrase.includes(stop));
  }

  /**
   * Helper: Delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CompetitorAnalyzer;