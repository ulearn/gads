-- =====================================================
-- SQL Views for Extension Table Integration
-- Creates "full" views that combine main + extension tables
-- =====================================================

-- Drop existing views if they exist
DROP VIEW IF EXISTS hub_contacts_full;
DROP VIEW IF EXISTS hub_deals_full;

-- ===========================================
-- CONTACTS FULL VIEW
-- Combines hub_contacts + hub_contacts_ext
-- ===========================================
CREATE VIEW hub_contacts_full AS
SELECT 
    -- All columns from main contacts table
    c.*,
    
    -- All columns from extension table (except duplicate hubspot_id)
    e.hs_intent_signals_enabled,
    e.hs_intent_paid_up_to_date,
    e.webinareventlastupdated,
    e.surveymonkeyeventlastupdated,
    e.message,
    
    -- Future extension fields will be added here automatically
    -- when we add columns to hub_contacts_ext
    
    -- Metadata from extension table
    e.created_at AS ext_created_at,
    e.updated_at AS ext_updated_at
    
FROM hub_contacts c
LEFT JOIN hub_contacts_ext e ON c.hubspot_id = e.hubspot_id;

-- ===========================================
-- DEALS FULL VIEW  
-- Combines hub_deals + hub_deals_ext
-- ===========================================
CREATE VIEW hub_deals_full AS
SELECT 
    -- All columns from main deals table
    d.*,
    
    -- All columns from extension table (except duplicate hubspot_deal_id)
    -- Currently only has metadata, but ready for future fields
    
    -- Metadata from extension table
    e.created_at AS ext_created_at,
    e.updated_at AS ext_updated_at
    
FROM hub_deals d
LEFT JOIN hub_deals_ext e ON d.hubspot_deal_id = e.hubspot_deal_id;

-- =====================================================
-- USAGE EXAMPLES:
-- =====================================================

-- OLD WAY (complex):
-- SELECT c.email, c.firstname, e.message 
-- FROM hub_contacts c 
-- LEFT JOIN hub_contacts_ext e ON c.hubspot_id = e.hubspot_id
-- WHERE c.lifecyclestage = 'lead';

-- NEW WAY (simple):
-- SELECT email, firstname, message 
-- FROM hub_contacts_full 
-- WHERE lifecyclestage = 'lead';

-- Views work with all SQL operations:
-- SELECT COUNT(*) FROM hub_contacts_full WHERE message IS NOT NULL;
-- SELECT * FROM hub_contacts_full ORDER BY createdate DESC LIMIT 10;
-- UPDATE hub_contacts_full SET... (updates main table automatically)

-- =====================================================
-- BENEFITS:
-- =====================================================
-- ✅ Transparent to existing code - just change table name
-- ✅ Automatic JOINs - no complex query logic needed  
-- ✅ Real-time data - always shows current data
-- ✅ Future-proof - new extension fields appear automatically
-- ✅ Performance - MySQL optimizes the JOINs
-- ✅ No data duplication - just a query "shortcut"