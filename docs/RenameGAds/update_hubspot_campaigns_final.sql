-- Campaign Name Standardization SQL Updates (FINAL VERSION)
-- Run these AFTER renaming campaigns in Google Ads to canonical 2022 names
-- Corrected: "spain - en" and "germany - de" (not "spanish - en", "german - de")

-- 1. spanish - es (ID: 32907697) - 146 contacts in 2022
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'spanish - es'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('spain & latam - es - leads', '32907697', '1. search - spain - es', '1_search.spain-latam_es', '1.search-spain_es')
    OR LOWER(google_ads_campaign) = LOWER('1. Search - Spain - ES')
  );

-- 2. dp:remarketing (ID: 239036407) - 129 contacts in 2022
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'dp:remarketing'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('04. display - remarketing', '239036407', '2dsply-rmrktng--obs placmnts')
    OR LOWER(google_ads_campaign) = LOWER('2. Display - Remarketing (Observation + Placements)')
  );

-- 3. dp:smart campaign (ID: 1051942797) - 108 contacts in 2022
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'dp:smart campaign'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('04. display - smart targeting: intl-dp')
    OR LOWER(google_ads_campaign) = LOWER('2. Display - Smart targeting: Intl-DP')
  );

-- 4. ireland - en - gnrl terms (ID: 35203507) - 68 contacts in 2022
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

-- 5. ireland - es (ID: 35127547) - 66 contacts in 2022
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'ireland - es'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('02. search - ireland - es', '35127547')
    OR LOWER(google_ads_campaign) = LOWER('1. Search - Ireland - ES')
  );

-- 6. intrnl-discovery-leads (ID: 17486528534) - 44 contacts in 2022
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'intrnl-discovery-leads'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('dgen-int-dscvry-leads', 'intrnl-discovery-leads', '17486528534')
    OR LOWER(google_ads_campaign) = LOWER('4. Demand Gen - INTRNL-Discovery-Leads')
  );

-- 7. dp:influence (ID: 682598152) - 43 contacts in 2022
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'dp:influence'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('04. display - awareness: intl - in-market - dp')
    OR LOWER(google_ads_campaign) = LOWER('2. Display - In-Market - INTRNTL')
  );

-- 8. france - fr (ID: 20774719371) - 29 contacts in 2022
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'france - fr'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('02. search - france - fr')
    OR LOWER(google_ads_campaign) = LOWER('1. Search - France - FR')
  );

-- 9. germany - de (ID: 20884739698) - 27 contacts in 2022 (CORRECTED NAME)
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'germany - de'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('german - de')  -- Update old name
    OR LOWER(google_ads_campaign) = LOWER('1. Search - German - DE')
  );

-- 10. spain - en (ID: 35203687) - 27 contacts in 2022 (CORRECTED NAME)
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'spain - en'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('spanish - en')  -- Update old name
    OR LOWER(google_ads_campaign) = LOWER('1. Search - Spain - EN')
  );

-- 11. irl-perfom-max (ID: 17440682130) - 22 contacts in 2022
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'irl-perfom-max'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('17440682130', '3pmax', '3.pmax(new)-ireland_es')
    OR LOWER(google_ads_campaign) = LOWER('3. Perfomance Max')
  );

-- 12. dublin - dynamic search (ID: 695837889) - 8 contacts in 2022
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'dublin - dynamic search'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 IN ('02. search - dublin - dsas - dynamic search', '695837889', '1_searchdublin.dynamic')
    OR LOWER(google_ads_campaign) = LOWER('1. Search - Dublin - DSAs - Dynamic Search')
  );

-- 13. ireland - en - exam courses (ID: 70252567) - 7 contacts in 2022
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'ireland - en - exam courses'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND LOWER(google_ads_campaign) = LOWER('02. Search - Dublin - Exam Courses - EN');

-- 14. ireland - it (ID: 35127997) - 1 contact in 2022
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'ireland - it'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND LOWER(google_ads_campaign) = LOWER('Ireland - IT');

-- 15. brazil - por - gnrl terms (ID: 149491087) - Started 2023
UPDATE hub_contacts
SET hs_analytics_source_data_1 = 'brazil - por - gnrl terms'
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND (
    hs_analytics_source_data_1 = '149491087'
    OR LOWER(google_ads_campaign) = LOWER('1. Search - Brazil (POR) - Gnrl Terms')
  );

-- Verification Query
SELECT
  hs_analytics_source_data_1 as campaign_name,
  COUNT(*) as contact_count,
  MIN(YEAR(createdate)) as first_year,
  MAX(YEAR(createdate)) as last_year
FROM hub_contacts
WHERE hs_analytics_source = 'PAID_SEARCH'
  AND hs_analytics_source_data_1 IN (
    'spanish - es',
    'dp:remarketing',
    'dp:smart campaign',
    'ireland - en - gnrl terms',
    'ireland - es',
    'intrnl-discovery-leads',
    'dp:influence',
    'france - fr',
    'germany - de',
    'spain - en',
    'irl-perfom-max',
    'ww:remarketing',
    'dublin - dynamic search',
    'ireland - en - exam courses',
    'ireland - it',
    'brazil - por - gnrl terms'
  )
GROUP BY hs_analytics_source_data_1
ORDER BY contact_count DESC;
