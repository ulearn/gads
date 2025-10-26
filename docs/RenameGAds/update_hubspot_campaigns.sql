-- Campaign Name Standardization SQL Updates
-- Run these after renaming campaigns in Google Ads
-- This updates all historical HubSpot contact records to use canonical 2022 names

-- Campaign: spanish - es (ID: 32907697)
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'spanish - es'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('spain & latam - es - leads', '32907697', '1. search - spain - es', '1_search.spain-latam_es', '1.search-spain_es')
    OR LOWER(google_ads_campaign) = LOWER('1. Search - Spain - ES')
  );
-- Expected: ~1000+ contacts

-- Campaign: dp:remarketing (ID: 239036407)
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'dp:remarketing'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('04. display - remarketing', '239036407', '2dsply-rmrktng--obs placmnts')
    OR LOWER(google_ads_campaign) = LOWER('2. Display - Remarketing (Observation + Placements)')
  );
-- Expected: ~800+ contacts

-- Campaign: ireland - en - gnrl terms (ID: 35203507)
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'ireland - en - gnrl terms'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN (
      'dublin - en - gnrl terms',
      '35203507',
      'ireland - en - gnrl terms "ireland/dublin"',
      '1.search-ireland-gnrlterms "ireland/dublin"_en',
      'searchdublin-gnrlterms_en',
      'gnrltermsen'
    )
    OR LOWER(google_ads_campaign) = LOWER('1. Search - Ireland - Gnrl Terms "Ireland/Dublin" - EN')
  );
-- Expected: ~400+ contacts

-- Campaign: ireland - es (ID: 35127547)
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'ireland - es'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('02. search - ireland - es')
    OR LOWER(google_ads_campaign) = LOWER('1. Search - Ireland - ES')
  );
-- Expected: ~400+ contacts

-- Campaign: intrnl-discovery-leads (ID: 17486528534)
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'intrnl-discovery-leads'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('dgen-int-dscvry-leads', 'intrnl-discovery-leads')
    OR LOWER(google_ads_campaign) = LOWER('4. Demand Gen - INTRNL-Discovery-Leads')
  );
-- Expected: ~300+ contacts

-- Campaign: dp:influence (ID: 682598152)
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'dp:influence'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('04. display - awareness: intl - in-market - dp')
    OR LOWER(google_ads_campaign) = LOWER('2. Display - In-Market - INTRNTL')
  );
-- Expected: ~200+ contacts

-- Campaign: france - fr (ID: 20774719371)
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'france - fr'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('02. search - france - fr')
    OR LOWER(google_ads_campaign) = LOWER('1. Search - France - FR')
  );
-- Expected: ~300+ contacts

-- Campaign: german - de (ID: 20884739698)
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'german - de'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND LOWER(google_ads_campaign) = LOWER('1. Search - German - DE');
-- Expected: ~100+ contacts

-- Campaign: irl-perfom-max (ID: 17440682130)
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'irl-perfom-max'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('17440682130', '3pmax', '3.pmax(new)-ireland_es')
    OR LOWER(google_ads_campaign) = LOWER('3. Perfomance Max')
  );
-- Expected: ~800+ contacts

-- Campaign: dublin - dynamic search (ID: 695837889)
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'dublin - dynamic search'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('02. search - dublin - dsas - dynamic search', '695837889', '1_searchdublin.dynamic')
    OR LOWER(google_ads_campaign) = LOWER('1. Search - Dublin - DSAs - Dynamic Search')
  );
-- Expected: ~200+ contacts

-- Campaign: brazil - por - gnrl terms (ID: 149491087)
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'brazil - por - gnrl terms'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 = '149491087'
    OR LOWER(google_ads_campaign) = LOWER('1. Search - Brazil (POR) - Gnrl Terms')
  );
-- Expected: ~100+ contacts

-- Campaign: dp:smart campaign (ID: 1051942797)
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'dp:smart campaign'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('04. display - smart targeting: intl-dp')
    OR LOWER(google_ads_campaign) = LOWER('2. Display - Smart targeting: Intl-DP')
  );
-- Expected: ~1000+ contacts

-- Verify updates
SELECT
  hs_analytics_source_data_1 as campaign_name,
  COUNT(*) as contact_count
FROM hub_contacts
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND hs_analytics_source_data_1 IN (
    'spanish - es',
    'dp:remarketing',
    'ireland - en - gnrl terms',
    'ireland - es',
    'intrnl-discovery-leads',
    'dp:influence',
    'france - fr',
    'german - de',
    'irl-perfom-max',
    'dublin - dynamic search',
    'brazil - por - gnrl terms',
    'dp:smart campaign'
  )
GROUP BY hs_analytics_source_data_1
ORDER BY contact_count DESC;
