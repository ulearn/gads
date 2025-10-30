/**
 * Google Ads Customer Match List Manager
 * /scripts/google/match-list/match-list-sync.js
 *
 * One-time setup + ongoing hourly sync for Customer Match lists
 *
 * Usage:
 *   node scripts/google/match-list/match-list-sync.js --create          # ONE-TIME: Create list
 *   node scripts/google/match-list/match-list-sync.js --initial         # ONE-TIME: Initial upload
 *   node scripts/google/match-list/match-list-sync.js                   # CRON: Hourly incremental sync
 */

const { GoogleAdsApi } = require('google-ads-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const {
  queryEligibleContacts,
  formatForGoogleAds,
  hashEmail
} = require('./match-list-data.js');

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// Configuration
const ACCOUNT_ID = process.env.GADS_ACCOUNT_ID || '1051706978';
const USER_LIST_ID = process.env.CUSTOMER_MATCH_LIST_ID;
const CACHE_FILE = path.join(__dirname, '../../../.cache/customer-match-sync.json');
const BATCH_SIZE = 5000; // Google Ads API max: 10,000 per job

/**
 * Initialize Google Ads API client
 */
function getGoogleAdsClient() {
  const client = new GoogleAdsApi({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    developer_token: process.env.GAdsAPI
  });

  const customer = client.Customer({
    customer_id: ACCOUNT_ID,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    login_customer_id: process.env.GADS_LIVE_MCC_ID
  });

  return { client, customer };
}

/**
 * Get OAuth2 access token from refresh token
 * Required for direct REST API calls
 */
async function getAccessToken() {
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Error refreshing access token:', error.message);
    throw error;
  }
}

/**
 * Make authenticated Google Ads REST API call
 */
async function googleAdsApiCall(method, url, data = null) {
  const accessToken = await getAccessToken();

  const config = {
    method,
    url,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': process.env.GAdsAPI,
      'login-customer-id': process.env.GADS_LIVE_MCC_ID,
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('API Error Response:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Load/save sync cache
 */
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('Warning: Could not load cache file:', error.message);
  }
  return { last_sync: null, contact_emails: [] };
}

function saveCache(data) {
  try {
    const cacheDir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Warning: Could not save cache file:', error.message);
  }
}

/**
 * ONE-TIME: Create Customer Match user list
 *
 * Based on official Google Ads API docs:
 * https://developers.google.com/google-ads/api/docs/remarketing/audience-segments/customer-match/get-started
 */
async function createCustomerMatchList() {
  console.log('='.repeat(70));
  console.log('CREATE CUSTOMER MATCH LIST (ONE-TIME SETUP)');
  console.log('='.repeat(70));
  console.log();

  const { customer } = getGoogleAdsClient();

  try {
    // Create the user list with CRM-based configuration
    // Per Google Ads API TypeScript definitions: must specify type: 'CRM_BASED'
    const userListOperation = {
      create: {
        name: 'SQL Pipeline Contacts - Dynamic',
        description: 'Dynamically synced contacts from HubSpot pipeline (INBOX → LOST, <500 days)',
        membership_status: 'OPEN', // Allows additions and removals
        membership_life_span: 540, // 18 months (backstop for GDPR compliance)
        type: 'CRM_BASED', // Required: explicitly declare this as a CRM-based user list
        crm_based_user_list: {
          upload_key_type: 'CONTACT_INFO' // Email and/or phone
        }
      }
    };

    console.log('Creating user list with configuration:');
    console.log(`  Name: ${userListOperation.create.name}`);
    console.log(`  Description: ${userListOperation.create.description}`);
    console.log(`  Membership Life Span: ${userListOperation.create.membership_life_span} days (18 months)`);
    console.log(`  Status: ${userListOperation.create.membership_status} (allows add/remove)`);
    console.log(`  Upload Key Type: ${userListOperation.create.crm_based_user_list.upload_key_type}\n`);

    const response = await customer.userLists.create([userListOperation]);

    // Extract the user list ID from the resource name
    // Format: customers/{customer_id}/userLists/{user_list_id}
    const resourceName = response.results[0];
    const userListId = resourceName.split('/').pop();

    console.log('✅ Customer Match list created successfully!\n');
    console.log(`Resource Name: ${resourceName}`);
    console.log(`User List ID: ${userListId}\n`);

    console.log('NEXT STEPS:');
    console.log('1. Add this to your .env file:');
    console.log(`   CUSTOMER_MATCH_LIST_ID=${userListId}`);
    console.log('2. Run initial upload:');
    console.log('   node scripts/google/match-list/match-list-sync.js --initial');
    console.log('3. Setup hourly cron job:');
    console.log('   15 * * * * cd /home/hub/public_html/gads && /usr/bin/node scripts/google/match-list/match-list-sync.js\n');

    return {
      resourceName,
      userListId
    };

  } catch (error) {
    console.error('❌ Error creating Customer Match list:');
    console.error(error.message);

    if (error.errors) {
      error.errors.forEach((err, i) => {
        console.error(`\nError ${i + 1}:`);
        console.error(`  Message: ${err.message}`);
        console.error(`  Error Code: ${JSON.stringify(err.error_code)}`);
      });
    }

    throw error;
  }
}

/**
 * Upload contacts to Google Ads Customer Match list via OfflineUserDataJob
 * Uses Python helper script (google-ads-api Node library doesn't support this service)
 */
async function uploadContacts(customer, userListResourceName, operations, isRemoval = false) {
  if (operations.length === 0) {
    return { success: true, count: 0 };
  }

  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  try {
    // Write operations to JSON file for Python script
    const jsonFile = path.join(__dirname, '../../../.cache/customer-match-upload.json');
    const jsonData = {
      operations: operations,
      action: isRemoval ? 'remove' : 'create'
    };

    fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2), 'utf8');
    console.log(`Wrote ${operations.length} operations to ${jsonFile}`);

    // Call Python helper script
    const pythonScript = path.join(__dirname, 'upload-customer-match.py');
    const action = isRemoval ? 'remove' : 'create';
    const command = `python3 ${pythonScript} ${jsonFile} ${action}`;

    console.log(`Calling Python helper: ${command}\n`);

    const { stdout, stderr } = await execAsync(command, {
      env: process.env,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer for output
    });

    if (stdout) {
      console.log(stdout);
    }

    if (stderr && stderr.trim()) {
      console.error('Python stderr:', stderr);
    }

    // Clean up JSON file
    fs.unlinkSync(jsonFile);

    console.log(`✅ ${isRemoval ? 'Removal' : 'Upload'} completed successfully (${operations.length} contacts)`);

    return { success: true, count: operations.length };

  } catch (error) {
    console.error(`❌ Error during ${isRemoval ? 'removal' : 'upload'}:`);
    console.error(error.message);

    if (error.stdout) {
      console.error('\nPython stdout:', error.stdout);
    }

    if (error.stderr) {
      console.error('\nPython stderr:', error.stderr);
    }

    return { success: false, count: 0, error: error.message };
  }
}

/**
 * Main sync function - handles both initial upload and incremental sync
 */
async function syncCustomerMatch(isInitial = false) {
  console.log('='.repeat(70));
  console.log('CUSTOMER MATCH SYNC');
  console.log('='.repeat(70));
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Mode: ${isInitial ? 'INITIAL UPLOAD (all contacts)' : 'INCREMENTAL SYNC'}\n`);

  // Validate configuration
  if (!USER_LIST_ID) {
    throw new Error(
      'CUSTOMER_MATCH_LIST_ID not set in .env file.\n' +
      'Run with --create flag first to create the list.'
    );
  }

  const { customer } = getGoogleAdsClient();
  const userListResourceName = `customers/${ACCOUNT_ID}/userLists/${USER_LIST_ID}`;

  console.log(`Account ID: ${ACCOUNT_ID}`);
  console.log(`User List ID: ${USER_LIST_ID}\n`);

  try {
    // Step 1: Query eligible contacts from MySQL
    console.log('Step 1: Querying eligible contacts from MySQL...');
    const contacts = await queryEligibleContacts({ includePhone: true, verbose: true });

    const currentEmails = new Set(contacts.map(c => c.email.toLowerCase().trim()));
    console.log(`Found ${currentEmails.size} unique eligible contacts\n`);

    // Step 2: Load previous sync cache
    console.log('Step 2: Loading previous sync cache...');
    const cache = loadCache();
    const previousEmails = new Set(cache.contact_emails || []);
    console.log(`Previous sync: ${previousEmails.size} contacts`);
    console.log(`Last sync: ${cache.last_sync || 'Never'}\n`);

    // Step 3: Calculate changes
    console.log('Step 3: Calculating changes...');
    const toAdd = isInitial
      ? [...currentEmails] // Initial: add all
      : [...currentEmails].filter(email => !previousEmails.has(email)); // Incremental: only new

    const toRemove = isInitial
      ? [] // Initial: don't remove anything
      : [...previousEmails].filter(email => !currentEmails.has(email)); // Incremental: remove old

    console.log(`To Add: ${toAdd.length}`);
    console.log(`To Remove: ${toRemove.length}\n`);

    // Step 4: Upload additions
    if (toAdd.length > 0) {
      console.log(`Step 4: Adding ${toAdd.length} new contacts...`);
      const addContacts = contacts.filter(c =>
        toAdd.includes(c.email.toLowerCase().trim())
      );
      const addOperations = formatForGoogleAds(addContacts);

      const addResult = await uploadContacts(customer, userListResourceName, addOperations, false);
      if (!addResult.success) {
        console.error('Warning: Addition partially failed, continuing...\n');
      }
    } else {
      console.log('Step 4: No new contacts to add\n');
    }

    // Step 5: Upload removals
    if (toRemove.length > 0) {
      console.log(`Step 5: Removing ${toRemove.length} old contacts...`);
      const removeOperations = toRemove.map(email => ({
        user_identifiers: [{
          hashed_email: hashEmail(email)
        }]
      }));

      const removeResult = await uploadContacts(customer, userListResourceName, removeOperations, true);
      if (!removeResult.success) {
        console.error('Warning: Removal partially failed, continuing...\n');
      }
    } else {
      console.log('Step 5: No old contacts to remove\n');
    }

    // Step 6: Save cache
    console.log('Step 6: Saving sync cache...');
    saveCache({
      last_sync: new Date().toISOString(),
      contact_emails: [...currentEmails]
    });
    console.log('Cache saved\n');

    // Summary
    console.log('='.repeat(70));
    console.log('SYNC COMPLETE');
    console.log('='.repeat(70));
    console.log(`Total contacts in list: ${currentEmails.size}`);
    console.log(`Added: ${toAdd.length}`);
    console.log(`Removed: ${toRemove.length}`);
    console.log(`Completed: ${new Date().toISOString()}\n`);

    console.log('NOTE: Changes may take 12-48 hours to populate in Google Ads');
    console.log('Minimum list size for targeting: 1,000 contacts\n');

  } catch (error) {
    console.error('='.repeat(70));
    console.error('SYNC FAILED');
    console.error('='.repeat(70));
    console.error(error.message);
    throw error;
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const isCreate = args.includes('--create');
  const isInitial = args.includes('--initial');

  if (isCreate) {
    // ONE-TIME: Create the list
    createCustomerMatchList()
      .then(() => {
        console.log('Setup complete!');
        process.exit(0);
      })
      .catch(error => {
        console.error('Setup failed:', error.message);
        process.exit(1);
      });
  } else {
    // SYNC: Initial or incremental
    syncCustomerMatch(isInitial)
      .then(() => {
        console.log('Sync completed successfully!');
        process.exit(0);
      })
      .catch(error => {
        console.error('Sync failed:', error.message);
        process.exit(1);
      });
  }
}

module.exports = { createCustomerMatchList, syncCustomerMatch };
