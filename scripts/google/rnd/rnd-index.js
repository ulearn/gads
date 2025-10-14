/**
 * RND Module Index - Research & Development for Keywords
 * Path: /home/hub/public_html/gads/scripts/google/rnd/rnd-index.js
 * 
 * Single line integration in main index.js:
 * require('./scripts/google/rnd/rnd-index')(app, googleOAuth, getDbConnection);
 */

const express = require('express');

module.exports = function initRND(mainRouter, googleOAuth, getDbConnection, googleAdsCustomer) {
  const router = express.Router();
  
  // Load RND modules
  const TrawlManager = require('./trawl');
  const CompetitorAnalyzer = require('./competitors');
  const GoogleAdsIntel = require('./gads-intel');
  const config = require('./trawl-config');
  
  // Initialize services
  const trawlManager = new TrawlManager(googleOAuth, getDbConnection, config);
  const competitorAnalyzer = new CompetitorAnalyzer(getDbConnection, config);
  const gadsIntel = new GoogleAdsIntel(googleAdsCustomer, getDbConnection, config);
  
  console.log('🔬 RND Module initializing...');
  
  // === STATUS & INFO ROUTES ===
  
  router.get('/status', (req, res) => {
    res.json({
      module: 'RND - Keywords Trawl & Test',
      version: '1.1.0',
      status: 'experimental',
      endpoints: {
        trawl: [
          'GET  /gads/rnd/trawl/test - Test Search Console connection',
          'POST /gads/rnd/trawl/run - Run keyword trawl',
          'GET  /gads/rnd/trawl/keywords - Get keywords for testing'
        ],
        competitors: [
          'POST /gads/rnd/competitors - Analyze competitor URLs',
          'GET  /gads/rnd/competitors/mei - Get MEI schools list'
        ],
        gads: [
          'POST /gads/rnd/gads/domain - Analyze competitor domain via Keyword Planner',
          'GET  /gads/rnd/gads/auction - Get auction insights',
          'GET  /gads/rnd/gads/gaps - Mine search query competitive gaps',
          'POST /gads/rnd/gads/mei - Batch analyze MEI competitors'
        ]
      }
    });
  });
  
  // === SEARCH CONSOLE TRAWL ROUTES ===
  
  router.get('/trawl/test', async (req, res) => {
    try {
      const result = await trawlManager.testConnection();
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/trawl/run', async (req, res) => {
    try {
      const result = await trawlManager.trawl(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/trawl/keywords', async (req, res) => {
    try {
      const keywords = await trawlManager.getKeywords(req.query);
      res.json({ success: true, keywords });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // === COMPETITOR ANALYSIS ROUTES ===
  
  router.post('/competitors', async (req, res) => {
    try {
      const result = await competitorAnalyzer.analyze(req.body);
      res.json(result);
    } catch (error) {
      console.error('RND competitors error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  router.get('/competitors/mei', async (req, res) => {
    try {
      const result = await competitorAnalyzer.getMEISchools();
      res.json(result);
    } catch (error) {
      console.error('RND MEI error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // === GOOGLE ADS COMPETITIVE INTELLIGENCE ROUTES ===
  
  // Analyze single domain via Keyword Planner
  router.post('/gads/domain', async (req, res) => {
    try {
      const { domain, country = 'ALL' } = req.body;
      
      if (!domain) {
        return res.status(400).json({
          success: false,
          error: 'Domain required'
        });
      }
      
      const result = await gadsIntel.analyzeCompetitorDomain(domain, country);
      res.json(result);
    } catch (error) {
      console.error('Domain analysis error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Get auction insights
  router.get('/gads/auction', async (req, res) => {
    try {
      const { campaignId } = req.query;
      const result = await gadsIntel.getAuctionInsights(campaignId);
      res.json(result);
    } catch (error) {
      console.error('Auction insights error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Mine search queries for competitive gaps
  router.get('/gads/gaps', async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 30;
      const result = await gadsIntel.mineSearchQueries(days);
      res.json(result);
    } catch (error) {
      console.error('Search query mining error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Batch analyze MEI competitors
  router.post('/gads/mei', async (req, res) => {
    try {
      const limit = parseInt(req.body.limit) || 5;
      
      // Return immediately, run in background
      res.json({
        success: true,
        message: `Analyzing top ${limit} MEI competitors`,
        status: 'running',
        note: 'This will take several minutes. Check database for results.'
      });
      
      // Run analysis in background
      gadsIntel.analyzeMEICompetitors(limit).then(result => {
        console.log('MEI analysis complete:', result);
      }).catch(error => {
        console.error('MEI analysis failed:', error);
      });
      
    } catch (error) {
      console.error('MEI batch error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Mount to the main router at /rnd (which becomes /gads/rnd via main router)
  mainRouter.use('/rnd', router);
  
  console.log('✅ RND Module ready at /gads/rnd/* (v1.1.0 with Google Ads Competitive Intelligence)');
};