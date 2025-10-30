/**
 * Customer Match Data Layer
 * /scripts/google/match-list/match-list-data.js
 *
 * MySQL queries and data utilities for Google Ads Customer Match lists
 * Based on HubSpot filters:
 * 1. Deal stage is any of: INBOX, SEQUENCED, RESPONSIVE, ADVISING, ENGAGING, NEGOTIATION, TRIAL, CONTRACT, or LOST (Direct Sales)
 * 2. Closed lost reason is NONE of: Unsupported Territory, Unqualified Lead, or Spam
 * 3. Close date is less than 500 days ago
 * 4. GDPR: Excludes hs_email_optout = 1
 *
 * Target: ~4,580 contacts
 */

const mysql = require('mysql2/promise');
const crypto = require('crypto');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// Pipeline stages to include in Customer Match list
// Based on /scripts/analytics/stage-map.json and HubSpot filters
const TARGET_STAGES = [
  'appointmentscheduled',  // INBOX (Direct Sales)
  '113151423',             // SEQUENCED (Direct Sales)
  'qualifiedtobuy',        // ENGAGING (Direct Sales)
  '767120827',             // RESPONSIVE (Direct Sales)
  'presentationscheduled', // ADVISING (Direct Sales)
  'decisionmakerboughtin', // NEGOTIATION (Direct Sales)
  '111070952',             // TRIAL (Direct Sales)
  'contractsent',          // CONTRACT (Direct Sales)
  'closedlost'             // LOST (Direct Sales) - filtered by reason and closedate
];

// Closed lost reasons to EXCLUDE from Customer Match list
// Note: Database uses mixed case formats - match exactly as stored
const EXCLUDED_LOST_REASONS = [
  'unsupported_territory',  // snake_case in database
  'Unqualified Lead',        // Title Case in database
  'Spam'                     // Not currently in data, but included for future-proofing
];

// Data retention: deals with closedate < 500 days ago
const RETENTION_DAYS = 500;

/**
 * Get database connection from env config
 */
async function getDbConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
}

/**
 * Query ALL eligible contacts for Customer Match list
 *
 * Matches HubSpot filters exactly:
 * - Deal stage is any of: INBOX, SEQUENCED, ENGAGING, RESPONSIVE, ADVISING, NEGOTIATION, TRIAL, CONTRACT, or LOST
 * - Closed lost reason is NONE of: Unsupported Territory, Unqualified Lead, Spam
 * - Close date is less than 500 days ago
 * - Excludes opted-out contacts (hs_email_optout = 1)
 *
 * @param {Object} options - Query options
 * @param {boolean} options.includePhone - Include phone numbers (default: true)
 * @param {boolean} options.verbose - Verbose logging (default: false)
 * @returns {Promise<Array>} Array of contact objects {email, phone, firstName, lastName}
 */
async function queryEligibleContacts(options = {}) {
  const { includePhone = true, verbose = false } = options;

  const conn = await getDbConnection();

  try {
    // Build the SQL query matching HubSpot filters exactly
    const query = `
      SELECT DISTINCT
        c.email,
        ${includePhone ? 'c.phone,' : ''}
        c.firstname as firstName,
        c.lastname as lastName,
        d.dealstage,
        d.closed_lost_reason as lostReason,
        d.closedate
      FROM hub_contacts c
      INNER JOIN hub_contact_deal_associations cda ON c.hubspot_id = cda.contact_hubspot_id
      INNER JOIN hub_deals d ON cda.deal_hubspot_id = d.hubspot_deal_id
      WHERE d.dealstage IN (${TARGET_STAGES.map(s => `'${s}'`).join(', ')})
      AND (
        d.dealstage != 'closedlost'
        OR d.closed_lost_reason NOT IN (${EXCLUDED_LOST_REASONS.map(r => `'${r}'`).join(', ')})
      )
      AND (
        d.closedate IS NULL
        OR d.closedate >= DATE_SUB(NOW(), INTERVAL ${RETENTION_DAYS} DAY)
      )
      AND (c.hs_email_optout = 0 OR c.hs_email_optout IS NULL)
      AND c.email IS NOT NULL
      AND c.email != ''
    `;

    if (verbose) {
      console.log(`Querying eligible Customer Match contacts...`);
      console.log(`Target stages: ${TARGET_STAGES.join(', ')}`);
      console.log(`Excluded lost reasons: ${EXCLUDED_LOST_REASONS.join(', ')}`);
      console.log(`Retention: ${RETENTION_DAYS} days`);
    }

    const [rows] = await conn.execute(query);

    if (verbose) {
      console.log(`Found ${rows.length} eligible contacts`);

      // Breakdown by category
      const active = rows.filter(r => r.dealstage !== 'closedlost').length;
      const lost = rows.filter(r => r.dealstage === 'closedlost').length;
      console.log(`  Active pipeline: ${active}`);
      console.log(`  Lost (valid reasons, <${RETENTION_DAYS}d): ${lost}`);
    }

    return rows;

  } finally {
    await conn.end();
  }
}

/**
 * Get statistics for Customer Match list
 *
 * Returns counts and breakdowns for monitoring
 *
 * @returns {Promise<Object>} Statistics object
 */
async function getCustomerMatchStats() {
  const conn = await getDbConnection();

  try {
    const stats = {};

    // Total eligible contacts (matching HubSpot filters)
    const [total] = await conn.execute(`
      SELECT COUNT(DISTINCT c.email) as count
      FROM hub_contacts c
      INNER JOIN hub_contact_deal_associations cda ON c.hubspot_id = cda.contact_hubspot_id
      INNER JOIN hub_deals d ON cda.deal_hubspot_id = d.hubspot_deal_id
      WHERE d.dealstage IN (${TARGET_STAGES.map(s => `'${s}'`).join(', ')})
      AND (
        d.dealstage != 'closedlost'
        OR d.closed_lost_reason NOT IN (${EXCLUDED_LOST_REASONS.map(r => `'${r}'`).join(', ')})
      )
      AND (
        d.closedate IS NULL
        OR d.closedate >= DATE_SUB(NOW(), INTERVAL ${RETENTION_DAYS} DAY)
      )
      AND (c.hs_email_optout = 0 OR c.hs_email_optout IS NULL)
      AND c.email IS NOT NULL
      AND c.email != ''
    `);
    stats.total_eligible = total[0].count;

    return stats;

  } finally {
    await conn.end();
  }
}

/**
 * Hash email for Google Ads Customer Match
 * Must be lowercase, trimmed, then SHA256 hashed
 *
 * @param {string} email - Email address to hash
 * @returns {string} SHA256 hash of normalized email
 */
function hashEmail(email) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Hash phone for Google Ads Customer Match
 * Must be digits only (no spaces, dashes, etc.), then SHA256 hashed
 *
 * @param {string} phone - Phone number to hash
 * @returns {string} SHA256 hash of normalized phone
 */
function hashPhone(phone) {
  if (!phone) return null;
  const normalized = phone.replace(/\D/g, ''); // Remove all non-digits
  if (normalized.length === 0) return null;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Format contacts for Google Ads Customer Match API
 *
 * Converts contact objects to Google Ads API format with hashed emails/phones
 *
 * @param {Array} contacts - Array of contact objects from queryEligibleContacts
 * @returns {Array} Array of operations for Google Ads API
 */
function formatForGoogleAds(contacts) {
  return contacts.map(contact => {
    const userIdentifiers = [];

    // Add hashed email (required)
    if (contact.email) {
      userIdentifiers.push({
        hashed_email: hashEmail(contact.email)
      });
    }

    // Add hashed phone (optional, improves match rate)
    if (contact.phone) {
      const hashedPhone = hashPhone(contact.phone);
      if (hashedPhone) {
        userIdentifiers.push({
          hashed_phone_number: hashedPhone
        });
      }
    }

    return {
      user_identifiers: userIdentifiers
    };
  }).filter(op => op.user_identifiers.length > 0); // Only include contacts with at least one identifier
}

module.exports = {
  // Query functions
  queryEligibleContacts,
  getCustomerMatchStats,

  // Hashing utilities
  hashEmail,
  hashPhone,
  formatForGoogleAds,

  // Constants for reference
  TARGET_STAGES,
  EXCLUDED_LOST_REASONS,
  RETENTION_DAYS
};
