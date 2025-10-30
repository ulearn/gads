# Working with Google Ads API

Comprehensive guide for programmatic Google Ads management, built from real implementation experience.

## Table of Contents
1. [Protocol: How to Approach Any Task](#protocol)
2. [Asset Swap Procedure](#asset-swap-procedure)
3. [Asset Limits & Requirements](#asset-limits)
4. [Field Naming: snake_case Always](#field-naming)
5. [Performance Max Asset Groups](#pmax-asset-groups)
   - [Sequential Swap Pattern for Asset Group Text Assets](#sequential-swap-pattern-for-asset-group-text-assets-)
6. [Common Patterns](#common-patterns)

---

## Protocol: How to Approach Any Task

### Core Principle: APIs Don't Have Bugs

**Google Ads, HubSpot, Facebook, and other established APIs never have "bugs" in their core functionality.** If you encounter failures or errors from the API, it is due to:
- Your approach being wrong
- Invalid request structure
- A valid reason for failure (e.g., attempting to add headlines when maximum has been reached)
- Missing required fields
- Incorrect field naming (snake_case vs camelCase)

**Always report failures as:** "My code has encountered errors from the API - we must rethink our approach."

Never jump to the conclusion that the API is broken. Read the error message carefully, check the documentation, and adjust your implementation.

### Common API Errors & Solutions

**Error: "The following field must be present in SELECT clause"**
- **Cause:** Using a field in WHERE clause without including it in SELECT
- **Solution:** Always include in SELECT any field you use in WHERE
- **Example:**
  ```javascript
  // ❌ Wrong:
  SELECT asset.id FROM campaign_asset WHERE campaign.id = 123

  // ✅ Correct:
  SELECT campaign.id, asset.id FROM campaign_asset WHERE campaign.id = 123
  ```

**Error: "INVALID_TAG_IN_URL_CUSTOM_PARAMETER_VALUE"**
- **Cause:** Attempting to use ValueTrack parameters (like `{campaignname}`) inside custom parameter values
- **Solution:** Custom parameters must be static values, not dynamic ValueTrack parameters
- **Example:**
  ```javascript
  // ❌ Wrong:
  url_custom_parameters: [{ key: 'cname', value: '{campaignname}' }]

  // ✅ Correct:
  url_custom_parameters: [{ key: 'cname', value: 'PMax-LATAM-ES' }]
  ```

**Error: "NOT_ENOUGH_[ASSET_TYPE]_ASSET"**
- **Cause:** Trying to remove assets that would violate minimum requirements
- **Solution:** Use sequential 1-for-1 swap (remove one, add one, repeat)
- **Prevention:** Use `analyzeAndSwap()` utility which handles this automatically

---

## Asset Swap Procedure

### Modern Approach: Use `analyzeAndSwap()`

**Recommended:** Use the intelligent swap utility that handles all validation, language detection, and error prevention automatically.

```javascript
const { analyzeAndSwap } = require('./scripts/mcp/pmax/seq-swap.js');

const report = await analyzeAndSwap(customer, {
  accountId: '1051706978',
  assetGroupId: '6625441835',
  assetType: 'HEADLINE',
  newAssetIds: ['123', '456', '789'], // Your new asset IDs
  targetLanguage: { code: 'spanish', name: 'Spanish' },
  removeAllOtherLanguages: true, // Remove all non-Spanish assets
  verbose: true // Show detailed progress
});

// Returns comprehensive report with before/after state:
// {
//   success: true,
//   assetType: 'HEADLINE',
//   before: { total: 15, byLanguage: { english: 12, spanish: 3 } },
//   changes: { removed: 12, added: 12, errors: [] },
//   after: { total: 15, byLanguage: { spanish: 15 } }
// }
```

**What `analyzeAndSwap()` does automatically:**
1. ✅ Checks max/min limits for the asset type
2. ✅ Analyzes current content (count, language detection)
3. ✅ Plans optimal swap strategy (sequential, add-first, or remove-first)
4. ✅ Validates final state BEFORE executing (prevents mid-swap failures)
5. ✅ Executes swap with error handling and rollback
6. ✅ Reports final state with language breakdown

### Manual Approach: 5-Step Process

**Only use this if you need custom logic not covered by `analyzeAndSwap()`**

#### Step 1: Identify Current Assets
Query the asset group to identify what assets are currently in place. Capture their IDs as needed.

```javascript
const query = `
  SELECT
    asset_group_asset.resource_name,
    asset.id,
    asset.text_asset.text
  FROM asset_group_asset
  WHERE asset_group.id = ${assetGroupId}
  AND asset_group_asset.field_type = HEADLINE
`;

const currentAssets = await customer.query(query);
```

#### Step 2: Compare Against Limits
Note how many assets are in place and compare against the maximum/minimum requirements for that asset type:

- Headlines: 3-15 (max 15)
- Long Headlines: 1-5 (max 5)
- Descriptions: 2-5 (max 5)
- Images: 1-20 (max 20)
- Sitelinks (campaign): max 20
- Callouts (campaign): no strict limit

#### Step 3: Determine Swap Strategy
Depending on your requirements:

**a) Complete Replacement** (e.g., localization - all English → Portuguese)
- Remove ALL existing assets of that type
- Add ALL new localized assets

**b) Partial Replacement** (e.g., content update - "Visa Programmes" → "English Courses")
- Remove specific assets by ID
- Add new assets to fill gaps

#### Step 4: Execute Removal
Remove assets to create space for new ones. **Important:** Must maintain minimum requirements at all times.

```javascript
// For long headlines: min 1 required, max 5 allowed
// If currently at 5, remove exactly 5 to make space for 5 new ones
const resourceNames = currentAssets.slice(0, 5).map(a => a.asset_group_asset.resource_name);
await customer.assetGroupAssets.remove(resourceNames);
```

#### Step 5: Add New Assets
Add the new assets into the spaces you created:

```javascript
const operations = newAssetIds.map(assetId => ({
  asset_group: `customers/${accountId}/assetGroups/${assetGroupId}`,
  asset: `customers/${accountId}/assets/${assetId}`,
  field_type: 'LONG_HEADLINE'
}));

await customer.assetGroupAssets.create(operations);
```

### Important Constraints

1. **Cannot exceed maximum limits** - The API will reject additions that would go over max, even temporarily
2. **Must maintain minimums** - Cannot remove assets that would violate minimum requirements
3. **Atomic operations not supported** - Cannot do remove+add in single `mutateResources()` call for asset_group_asset
4. **Must use separate methods**:
   - Use `customer.assetGroupAssets.remove()` for removals
   - Use `customer.assetGroupAssets.create()` for additions
   - Do NOT use `customer.mutateResources()` for asset_group_asset operations (causes operation structure errors)

### Example: Complete Long Headline Swap

```javascript
// Current state: 5 English long headlines
// Goal: Replace with 5 Portuguese long headlines

// Step 1: Query current
const current = await customer.query(`...`);
const longHeadlines = current.filter(a => a.asset_group_asset.resource_name.includes('~LONG_HEADLINE'));

// Step 2: Remove all 5 (we're at max, must remove before adding)
await customer.assetGroupAssets.remove(
  longHeadlines.map(a => a.asset_group_asset.resource_name)
);

// Step 3: Add 5 Portuguese ones
await customer.assetGroupAssets.create(
  portugueseIds.map(id => ({
    asset_group: `customers/${accountId}/assetGroups/${assetGroupId}`,
    asset: `customers/${accountId}/assets/${id}`,
    field_type: 'LONG_HEADLINE'
  }))
);
```

---

**ALWAYS follow this sequence before writing any API code:**

### Step 1: Check the Schema
```bash
# Load API knowledge files
cat docs/API-knowledge/google-ads-schema-extracted.json
cat docs/API-knowledge/google-ads-pmax.json
```

### Step 2: Query Current State
Before adding/removing anything, query what exists:

```javascript
// Example: Check current headlines in asset group
const query = `
  SELECT
    asset_group_asset.field_type,
    asset.id,
    asset.text_asset.text
  FROM asset_group_asset
  WHERE asset_group.id = ${assetGroupId}
  AND asset_group_asset.field_type IN (3, 5, 2)
  // 3=HEADLINE, 5=LONG_HEADLINE, 2=DESCRIPTION
`;

const results = await customer.query(query);
```

### Step 3: Check Limits
**Performance Max Asset Group Limits:**
- Headlines (30 char): 3-15 required
- Long Headlines (90 char): 1-5 required
- Descriptions (90 char): 2-5 required
- Images: 1-20
- Videos: 0-5

### Step 4: Strategy
- If at max limit: REMOVE old assets first, THEN ADD new ones
- If under limit: ADD new assets first, THEN REMOVE old ones
- This maintains minimum requirements at all times

### Step 5: Execute with mutateResources()

```javascript
const operations = [
  {
    entity: 'asset_group_asset',
    operation: 'remove',  // or 'create'
    resource_name: `customers/${account_id}/assetGroupAssets/${group_id}~${asset_id}~${field_type_enum}`
  }
];

await customer.mutateResources(operations);
```

---

## Asset Limits & Requirements

### Performance Max Campaign Structure
```
Campaign
  └── AssetGroup
        ├── AssetGroupAsset (headlines, images, videos)
        │     └── field_type: HEADLINE, LONG_HEADLINE, DESCRIPTION, IMAGE, etc.
        └── AssetGroupSignal (audiences)
```

### Field Type Enums
When using resource names, use numeric enums:
- `2` = DESCRIPTION
- `3` = HEADLINE
- `5` = LONG_HEADLINE
- `7` = IMAGE
- `19` = YOUTUBE_VIDEO

When using create operations, use string constants:
- `field_type: 'HEADLINE'`
- `field_type: 'LONG_HEADLINE'`
- `field_type: 'DESCRIPTION'`

### Character Limits
- Headline: 30 characters max
- Long Headline: 90 characters max
- Description: 90 characters max
- Business Name: 25 characters max

---

## Field Naming: snake_case Always

**CRITICAL:** The google-ads-api Node.js library uses snake_case, NOT camelCase.

### ✅ Correct
```javascript
{
  asset_group: `customers/${id}/assetGroups/${group_id}`,
  asset: `customers/${id}/assets/${asset_id}`,
  field_type: 'HEADLINE',
  text_asset: {
    text: 'My headline'
  },
  final_urls: ['https://example.com']
}
```

### ❌ Wrong
```javascript
{
  assetGroup: `...`,  // WRONG
  fieldType: 'HEADLINE',  // WRONG
  textAsset: { ... },  // WRONG
  finalUrls: [...]  // WRONG
}
```

### Why?
- google-ads-api library wraps gRPC protobuf definitions
- Protobuf uses snake_case
- REST API docs may show camelCase, but the Node library requires snake_case
- **Verified from:** TypeScript definitions in google-ads-api-repo/src/protos/autogen/fields.ts

---

## Performance Max Asset Groups

### Sequential Swap Pattern for Asset Group Text Assets ✅

**Use Case:** Swapping text assets (LONG_HEADLINE, DESCRIPTION) in Performance Max asset groups when at or near maximum limits.

**Critical Discovery:** Individual `assetGroupAssets.remove()` and `assetGroupAssets.create()` methods work reliably for 1-for-1 swaps, maintaining minimum requirements at all times.

#### Step-by-Step Sequential Swap

```javascript
// 1. Query current assets (IMPORTANT: Filter by status = ENABLED)
const query = `
  SELECT
    asset.id,
    asset_group_asset.resource_name,
    asset_group_asset.status
  FROM asset_group_asset
  WHERE asset_group.id = ${assetGroupId}
  AND asset_group_asset.field_type = LONG_HEADLINE
  AND asset_group_asset.status = ENABLED
`;

const currentAssets = await customer.query(query);

// 2. For each asset to swap (1-for-1 to maintain minimums):
for (let i = 0; i < targetAssets.length; i++) {
  const oldAsset = currentAssets[i];
  const newAssetId = targetAssets[i];

  // Remove 1 old asset
  await customer.assetGroupAssets.remove([oldAsset.asset_group_asset.resource_name]);
  await delay(500); // Small delay between operations

  // Add 1 new asset
  await customer.assetGroupAssets.create([{
    asset_group: `customers/${accountId}/assetGroups/${assetGroupId}`,
    asset: `customers/${accountId}/assets/${newAssetId}`,
    field_type: 'LONG_HEADLINE'  // or 'DESCRIPTION'
  }]);
  await delay(500);
}
```

#### Critical Success Factors

1. **Use Individual Methods:**
   - ✅ `customer.assetGroupAssets.remove(resourceNames)` - Works
   - ✅ `customer.assetGroupAssets.create(operations)` - Works
   - ❌ `customer.mutateResources()` - Causes "operation structure" errors for asset_group_asset

2. **1-for-1 Swapping:**
   - Maintains minimum requirements at all times (1 for long headlines, 2 for descriptions)
   - Prevents "not enough" errors
   - Delays between operations prevent race conditions

3. **Query with Status Filter:**
   ```javascript
   AND asset_group_asset.status = ENABLED
   ```
   - Removed assets remain in queries without this filter
   - Only ENABLED assets are actually serving

4. **Asset Limits:**
   - LONG_HEADLINE: min 1, max 5
   - DESCRIPTION: min 2, max 5
   - Must stay within these bounds during entire swap process

#### Real-World Example

Successfully swapped 5 long headlines and 5 descriptions across 3 asset groups in PMax-Brazil-POR campaign:

```javascript
// Asset Group #2: Schools & Agents
// Result: 5/5 Portuguese long headlines, 5/5 Portuguese descriptions
// Script: scripts/mcp/pmax/swap-asset-group-text-assets.js
```

**Time per asset group:** ~60 seconds (with delays)
**Success rate:** 100% when using sequential pattern

---

### Creating Text Assets

```javascript
const operations = [{
  create: {
    type: 'TEXT',
    text_asset: {
      text: 'Your headline or description here'
    }
  }
}];

const response = await customer.assets.create(operations);
const assetId = response.results[0].resource_name.split('/').pop();
```

### Linking Assets to Asset Group

```javascript
const operations = [{
  entity: 'asset_group_asset',
  operation: 'create',
  resource: {
    asset_group: `customers/${account_id}/assetGroups/${asset_group_id}`,
    asset: `customers/${account_id}/assets/${asset_id}`,
    field_type: 'HEADLINE'  // or LONG_HEADLINE, DESCRIPTION
  }
}];

await customer.mutateResources(operations);
```

### Removing Assets from Asset Group

```javascript
const operations = [{
  entity: 'asset_group_asset',
  operation: 'remove',
  resource_name: `customers/${account_id}/assetGroupAssets/${asset_group_id}~${asset_id}~3`
  // Note: 3 is the enum for HEADLINE field type
}];

await customer.mutateResources(operations);
```

### Smart Swap Pattern (maintains limits)

```javascript
async function swapAssets(assetGroupId, newAssetIds, fieldType, min, max) {
  // 1. Query current assets
  const current = await queryCurrentAssets(assetGroupId, fieldType);

  // 2. Determine strategy
  if (current.length >= max) {
    // Remove first to make space
    await removeAssets(current.slice(0, current.length - max + newAssetIds.length));
    await addAssets(newAssetIds);
  } else {
    // Add first, then remove
    await addAssets(newAssetIds);
    await removeAssets(current);
  }
}
```

---

## Common Patterns

### Pattern 1: Query with Field Type Filter

```javascript
// Query all text assets in asset group
const query = `
  SELECT
    asset_group_asset.resource_name,
    asset_group_asset.field_type,
    asset.id,
    asset.text_asset.text
  FROM asset_group_asset
  WHERE asset_group.id = ${asset_group_id}
  AND asset_group_asset.field_type IN (2, 3, 5)
`;
```

### Pattern 2: Batch Operations

```javascript
const operations = [
  // Remove English assets
  ...englishIds.map(id => ({
    entity: 'asset_group_asset',
    operation: 'remove',
    resource_name: `customers/${account}/assetGroupAssets/${group}~${id}~3`
  })),
  // Add Portuguese assets
  ...portugueseIds.map(id => ({
    entity: 'asset_group_asset',
    operation: 'create',
    resource: {
      asset_group: `customers/${account}/assetGroups/${group}`,
      asset: `customers/${account}/assets/${id}`,
      field_type: 'HEADLINE'
    }
  }))
];

await customer.mutateResources(operations);
```

### Pattern 3: Error Handling

```javascript
try {
  const result = await customer.mutateResources(operations);
  console.log(`✅ Success: ${result.results.length} operations completed`);
} catch (error) {
  console.error('❌ Error:', error.message);

  if (error.errors) {
    error.errors.forEach((err, i) => {
      console.error(`  Operation ${i}: ${err.message}`);
      console.error(`  Error code: ${JSON.stringify(err.error_code)}`);
    });
  }
}
```

---

## Troubleshooting

### "undefined" errors
- Usually means query/mutation failed silently
- Check: Are you using snake_case field names?
- Check: Is the resource type correct?
- Check: Do you have proper authentication?

### RESOURCE_LIMIT errors
- Check current count vs max limit
- Remove old assets before adding new ones
- Use smart swap pattern to maintain minimums

### REQUIRED_NONEMPTY_LIST errors
- Check that required fields like `final_urls` are provided
- Ensure arrays are not empty
- Verify snake_case field names

### Field type mismatches
- Remember: Use strings in create operations (`'HEADLINE'`)
- Remember: Use enums in resource names (`~3~` for HEADLINE)

---

## Performance Max Search Themes

Search themes (audience signals) guide Google's AI on what searches to target in Performance Max campaigns. Each asset group can have multiple search theme signals.

### Querying Search Themes

```javascript
const query = `
  SELECT
    asset_group.id,
    asset_group.name,
    asset_group_signal.search_theme.text
  FROM asset_group_signal
  WHERE campaign.id = ${campaignId}
`;

const results = await customer.query(query);
```

### Swapping Search Themes (e.g., Localization)

**Strategy:** Remove all existing search themes, then add new localized ones.

```javascript
// Step 1: Query existing search themes
const query = `
  SELECT
    asset_group_signal.resource_name,
    asset_group_signal.search_theme.text
  FROM asset_group_signal
  WHERE asset_group.id = ${assetGroupId}
`;

const currentThemes = await customer.query(query);
const themeResources = currentThemes
  .filter(row => row.asset_group_signal.search_theme?.text)
  .map(row => row.asset_group_signal.resource_name);

// Step 2: Remove existing themes
await customer.assetGroupSignals.remove(themeResources);

// Step 3: Add new localized themes
const SPANISH_THEMES = [
  'trabajo y estudio irlanda',
  'estudiar y trabajar en irlanda',
  'intercambio irlanda',
  'curso de inglés en dublín',
  'visa de estudio y trabajo irlanda'
  // ... more themes
];

const operations = SPANISH_THEMES.map(theme => ({
  asset_group: `customers/${accountId}/assetGroups/${assetGroupId}`,
  search_theme: { text: theme }
}));

await customer.assetGroupSignals.create(operations);
```

### Key Points

- **No limits** on number of search themes (but keep reasonable ~15-20 per asset group)
- **Case sensitive** - keep consistent formatting
- **Language matters** - match target audience language
- **Mix is OK** - can have English + Spanish themes for bilingual targeting
- **Remove-then-add** pattern works well (no minimums to maintain)

### Real Example: Portuguese → Spanish Localization

Successfully swapped search themes across 3 asset groups in PMax-LATAM-ES campaign:
- Removed 17 Portuguese themes per asset group
- Added 17 Spanish themes per asset group
- Themes include: "estudiar y trabajar en irlanda", "visa de estudio y trabajo", "intercambio irlanda"
- Total operation time: ~30 seconds for all 3 asset groups

---

## URL Localization Pattern

**CRITICAL:** When localizing campaigns, URLs require **TWO changes** - not just the language prefix.

### The Two-Part URL Localization

1. **Language Prefix Changes:**
   - Portuguese: `/pt/`
   - Spanish: `/es/`
   - Italian: `/it/`
   - French: `/fr/`
   - German: `/de/`

2. **URL Path Translates/Transliterates:**
   - The actual page path changes based on the language
   - **You CANNOT just swap the language prefix!**

### Real-World Examples

**Contact Page:**
```
Portuguese:  https://ulearnschool.com/pt/contato
Spanish:     https://ulearnschool.com/es/contacto
Italian:     https://ulearnschool.com/it/contatti    ← Note: NOT /it/contato
French:      https://ulearnschool.com/fr/contact
German:      https://ulearnschool.com/de/kontakt
```

**Courses Page:**
```
Portuguese:  https://ulearnschool.com/pt/cursos
Spanish:     https://ulearnschool.com/es/cursos
Italian:     https://ulearnschool.com/it/corsi      ← Note: NOT /it/cursos
French:      https://ulearnschool.com/fr/cours
German:      https://ulearnschool.com/de/kurse
```

**Accommodation Page:**
```
Portuguese:  https://ulearnschool.com/pt/acomodacao
Spanish:     https://ulearnschool.com/es/alojamiento
Italian:     https://ulearnschool.com/it/alloggio
French:      https://ulearnschool.com/fr/hebergement
English:     https://ulearnschool.com/accommodation  ← Note: No language prefix
```

### Standard URL Set for Campaigns

**Recommended:** Maintain these 4 core pages across all campaign localizations:

1. **Homepage:** `https://ulearnschool.com/{lang}`
   - Portuguese: `/pt`
   - Spanish: `/es`
   - Italian: `/it`

2. **Courses:** `https://ulearnschool.com/{lang}/{courses-word}`
   - Portuguese: `/pt/cursos`
   - Spanish: `/es/cursos`
   - Italian: `/it/corsi`

3. **Accommodation:** `https://ulearnschool.com/{lang-or-en}/{accommodation-word}`
   - Portuguese: `/pt/acomodacao`
   - Spanish: `/es/alojamiento`
   - English: `/accommodation` (no prefix)

4. **Contact:** `https://ulearnschool.com/{lang}/{contact-word}`
   - Portuguese: `/pt/contato`
   - Spanish: `/es/contacto`
   - Italian: `/it/contatti`

### Pre-Localization Checklist

Before localizing a campaign to a new language:
- [ ] Verify homepage exists: `https://ulearnschool.com/{lang}`
- [ ] Verify courses page exists and get exact path
- [ ] Verify accommodation page exists and get exact path
- [ ] Verify contact page exists and get exact path
- [ ] Test all URLs in browser - **no 404s allowed**
- [ ] Document correct URL paths in assets.json or localization guide

### Common Mistakes to Avoid

❌ **Wrong:** Swapping only language prefix
```javascript
// DON'T DO THIS:
oldUrl: 'https://ulearnschool.com/pt/contato'
newUrl: 'https://ulearnschool.com/it/contato'  // Will 404!
```

✅ **Correct:** Both prefix AND path change
```javascript
// DO THIS:
oldUrl: 'https://ulearnschool.com/pt/contato'
newUrl: 'https://ulearnschool.com/it/contatti'  // Correct Italian URL
```

### Impact on Campaign Performance

- **404 errors** severely harm Quality Score
- **Broken sitelinks** reduce ad extensions eligibility
- **Invalid asset URLs** can pause asset groups
- **Always verify URLs exist** before deploying localized campaigns

---

## WhatsApp Business Message Assets

**Asset Type:** `BUSINESS_MESSAGE` (30)
**Field Type:** `BUSINESS_MESSAGE` (31) - Campaign-level asset

WhatsApp message assets allow click-to-message functionality with pre-filled starter messages. These are localizable and can be updated via API.

### Query Current WhatsApp Message Asset

```javascript
const query = `
  SELECT
    campaign.id,
    campaign_asset.field_type,
    campaign_asset.resource_name,
    asset.id,
    asset.name,
    asset.business_message_asset.starter_message,
    asset.business_message_asset.message_provider,
    asset.business_message_asset.whatsapp_info.phone_number,
    asset.business_message_asset.whatsapp_info.country_code
  FROM campaign_asset
  WHERE campaign.id = ${campaignId}
    AND campaign_asset.field_type = BUSINESS_MESSAGE
    AND campaign_asset.status = ENABLED
`;

const results = await customer.query(query);
// Returns: starter_message: "¡Hola!", message_provider: 2 (WhatsApp)
```

### Create Localized WhatsApp Message Asset

**✅ Confirmed:** Business message assets CAN be created and updated via API.

```javascript
// Create new WhatsApp message asset with localized starter message
const newAsset = {
  name: 'WhatsApp Message - Spanish LATAM',
  business_message_asset: {
    starter_message: '¡Hola! Me gustaría recibir información sobre los cursos de inglés.',
    message_provider: 2, // 2 = WhatsApp
    whatsapp_info: {
      country_code: 'IE',
      phone_number: '899750229'
    }
  }
};

const result = await customer.assets.create([newAsset]);
const newAssetId = result.results[0].resource_name.split('/').pop();
```

### Swap WhatsApp Message Asset (Campaign-Level)

```javascript
const accountId = '1051706978';
const campaignId = '23205138425';
const oldAssetId = '303896768012'; // Current asset with "¡Hola!"
const newAssetId = '304116810780'; // New asset with longer Spanish message

// Step 1: Remove old asset from campaign
const oldResourceName = `customers/${accountId}/campaignAssets/${campaignId}~${oldAssetId}~BUSINESS_MESSAGE`;
await customer.campaignAssets.remove([oldResourceName]);

// Step 2: Add new asset to campaign
await customer.campaignAssets.create([{
  campaign: `customers/${accountId}/campaigns/${campaignId}`,
  asset: `customers/${accountId}/assets/${newAssetId}`,
  field_type: 'BUSINESS_MESSAGE'
}]);
```

### Localization Examples

**Pattern:** `[Campaign-Code]: [Natural greeting]! [Conversational opener]...?`

**Portuguese (Brazil):**
```javascript
{ starter_message: 'Brasil: Olá Equipe ULearn! Conversamos...?' }
```

**Spanish (LATAM):**
```javascript
{ starter_message: 'LATAM-ES: Hola Equipo ULearn! Charlamos...?' }
```

**French:**
```javascript
{ starter_message: 'France: Bonjour Équipe ULearn! On discute...?' }
```

**Important Notes:**
- Phone number and country code typically stay the same across campaigns
- Only the `starter_message` needs localization
- Message provider: 2 = WhatsApp (always use this value)
- Character limit: ~60 characters recommended for mobile display
- The starter message appears pre-filled when user clicks WhatsApp button
- **Campaign code prefix** helps ChatAI identify source and respond in appropriate language
- Keep messages natural, conversational, and friendly

### Real Example: Current LATAM-ES Campaign

Campaign 23205138425 currently has:
- Asset ID: 303896768012
- Starter Message: "¡Hola!"
- Phone: +IE 899750229

**Updated Message Suggestion:**
```javascript
// Current: "¡Hola!"
// Updated: "LATAM-ES: Hola Equipo ULearn! Charlamos...?"
// Subtle campaign code + natural conversational tone
```

---

## Resources

### Official Google Ads API Documentation

- **Online Manual (Fields Reference):** https://developers.google.com/google-ads/api/fields/v22/overview
  - Complete field reference for all Google Ads entities
  - Shows field names, types, and relationships
  - **Read using utilities:** `/home/hub/public_html/gads/scripts/utils/fetch-docs.js` (with caching)

- **API Reference (RPC):** https://developers.google.com/google-ads/api/reference/rpc/v22/overview
  - Protocol buffer definitions and service methods
  - Complete API documentation

- **NodeJS Client Library Repository:** `/home/hub/public_html/gads/docs/google-ads-api-repo/`
  - Local clone of google-ads-node repository
  - TypeScript definitions: `src/protos/autogen/`
  - Examples and source code

### Local Resources

- **Extracted Schema:** `/home/hub/public_html/gads/docs/API-knowledge/google-ads-schema-extracted.json`
  - Pre-extracted schema from TypeScript definitions

- **PMax JSON Profile:** `/home/hub/public_html/gads/docs/API-knowledge/google-ads-pmax.json`
  - Performance Max campaign structure reference

### Utilities

- **Fetch Docs:** `/home/hub/public_html/gads/scripts/utils/fetch-docs.js`
  - Fetches and caches Google Ads API documentation
  - Automatic caching to speed up repeated requests

- **Crawl Docs:** `/home/hub/public_html/gads/scripts/utils/crawl-samples.js`
  - Crawls documentation hierarchies and extracts samples

---

## Real Example: Swap Headlines to Portuguese

See: `scripts/mcp/pmax/swap-headlines.js` for a complete working example that:
1. Queries current headlines
2. Identifies what needs to change
3. Calculates optimal swap strategy
4. Executes operations maintaining 3-15 requirement
5. Handles errors gracefully

This script successfully swapped headlines across 3 asset groups.

## Real Example: Sequential Swap for LONG_HEADLINE and DESCRIPTION

See: `scripts/mcp/pmax/swap-one-by-one.js` for the proven 1-for-1 sequential swap pattern that:
1. Queries current assets with status = ENABLED filter
2. Identifies Portuguese vs English assets
3. Performs 1-for-1 swaps maintaining minimums
4. Includes rollback on failure
5. Successfully swapped 15 long headlines + 15 descriptions across 3 asset groups

---

## Performance Max Campaign Cloning Checklist

**Goal:** Single-command localization - `"Localize PMax Campaign XXX for France"`

After cloning a Performance Max campaign, the following entities typically require review and updating for localization or targeting changes:

### 1. Campaign-Level Settings

**Basic Information:**
- [ ] **Campaign name** - Format: `[Type-Location-Language]`
  - Example: `PMax-Mexico-ES` (Type=Performance Max, Location=Mexico, Language=Spanish)
  - Example: `PMax-LATAM-POR` (Regional targeting, Portuguese)
  - Example: `PMax-Brazil-POR` (Country-level even when micro-targeting cities within)
  - Provided at start OR already set if cloned manually
- [ ] Campaign status (ENABLED, PAUSED)

**Budget & Bidding:**
- [ ] **Daily budget** (`campaign_budget`) - Set/confirm correct daily budget for region
- [ ] **Conversion goals** (`campaign_conversion_goal`) - Usually set to **"Account Default"**
- [ ] **Bidding strategy** - Currently: **"Maximize Conversion Value"**
  - Future updates may switch to Target ROAS (will be instructed when needed)
- [ ] **Customer Acquisition** - Set to: **"Bid equally for new & existing customers"**
- [ ] **Retention** - Set to: **"Do not adjust to re-engage lapsed customers"**

**Targeting:**
- [ ] **Geographic targets** (`geo_target_constant`) - MUST be set for new region
  - Location Options: **"Presence: People in or regularly in your included locations"**
- [ ] **Language targets** (`language_constant`) - Follows location convention:
  - France = French (+English)
  - Spain = Spanish (+English)
  - Mexico = Spanish (+English)
  - Brazil = Portuguese (+English)
  - **Note:** Currently including English in all locations (experimental, no metrics yet)
- [ ] Location exclusions (if any negative geo targets needed)

**Tracking & URLs (CRITICAL):**
- [ ] **Campaign URL Options - Custom Parameters:**
  - **SUPER IMPORTANT:** Tracking must align across ALL campaigns
  - Set custom parameter: `cname = [CampaignName]` (e.g., `cname = PMax-LATAM-ES`)
  - ⚠️ **Important:** Custom parameters **cannot use ValueTrack parameters** (like `{campaignname}`)
  - Each campaign must have its own static value matching its name
  - Example: PMax-LATAM-ES campaign → `cname = PMax-LATAM-ES`
  - Example: PMax-Brazil-PT campaign → `cname = PMax-Brazil-PT`
  - This ensures accurate tracking per campaign
- [ ] Final URL suffix (`final_url_suffix`) - Analytics tracking parameters (if needed)
- [ ] Tracking template (`tracking_url_template`) - Usually not needed
- [ ] URL expansion settings (`url_expansion_opt_out`) - Default settings

**Other Standard Settings:**
- [ ] **EU Political Ads:** Always **"No"** - Does not apply
- [ ] **Devices:** Show on all devices (default)
- [ ] **Brand Exclusions:** NO brand exclusions
- [ ] **Third-Party Measurement:** No third-party measurement
- [ ] Ad schedule - Default (all times) unless specified
- [ ] Campaign-level negative keywords - Usually none for PMax

### 2. Campaign-Level Assets (Extensions)

Query: `SELECT campaign_asset FROM campaign_asset WHERE campaign.id = X AND campaign_asset.status = ENABLED`

**Sitelinks** (`field_type = SITELINK`):
- [ ] Link text (25 char limit) - Translate/localize
- [ ] Description lines 1 & 2 (35 char limit each)
- [ ] **Final URLs** - CRITICAL: Two-part localization required
  - ⚠️ **Language prefix changes:** pt → es, pt → it, pt → fr, etc.
  - ⚠️ **URL path translates:** `/pt/contato` → `/it/contatti` → `/es/contacto`
  - ⚠️ **URL path translates:** `/pt/cursos` → `/it/corsi` → `/es/cursos`
  - **Must verify URLs exist before updating** - 404s will harm campaign performance
  - Recommended: Maintain standard set (homepage, courses, accommodation, contact)
- [ ] Maximum: 20 sitelinks per campaign

**Callouts** (`field_type = CALLOUT`):
- [ ] Callout text (25 char limit)
- [ ] Translate value propositions
- [ ] No strict maximum limit

**Structured Snippets** (`field_type = STRUCTURED_SNIPPET`):
- [ ] Header (e.g., "Services", "Courses", "Amenities")
- [ ] Values list - Translate snippet values
- [ ] No strict maximum limit

**Price Extensions** (`field_type = PRICE`):
- [ ] Currency (may need adjustment)
- [ ] Price descriptions and amounts
- [ ] Language/formatting of price text
- ⚠️ **Note:** Price assets may not be available via API - needs confirmation

**Promotion Extensions** (`field_type = PROMOTION`):
- [ ] Promotion text and offers
- [ ] Dates/timing (may differ by region)
- [ ] Localized promotion codes
- ⚠️ **Note:** Promotion assets may not be available via API - needs confirmation

**Current Exception:** Price and Promotion assets don't appear to be fully supported in Google Ads API mutations (as of testing). This seems unusual but working with this limitation for now. Manual updates in UI may be required.

**Business Message (WhatsApp)** (`field_type = BUSINESS_MESSAGE`):
- [ ] Starter message text - Localize for target market
- [ ] Character limit: ~60 chars recommended
- [ ] Phone number typically stays the same
- [ ] ✅ **Fully supported via API** - Can create, query, and swap
- [ ] Consider adding campaign identifier to message for ChatAI routing
- [ ] Example: "¡Hola! Consulta desde Google Ads LATAM-ES"
- [ ] Maximum: 1 per campaign (typical usage)

### 3. Asset Groups

Query: `SELECT asset_group FROM asset_group WHERE campaign.id = X`

**Asset Group Settings:**
- [ ] Asset group names - Update for clarity
- [ ] Asset group status (ENABLED, PAUSED)
- [ ] **Final URLs** - CRITICAL: Ensure correct language paths
  - ⚠️ **URLs have TWO localization components:**
    1. Language prefix changes (pt, es, it, de, fr)
    2. URL path itself translates/transliterates
  - Example: Portuguese `/pt/contato` → Italian `/it/contatti` (NOT `/it/contato`)
  - Example: Portuguese `/pt/cursos` → Spanish `/es/cursos` → Italian `/it/corsi`
  - **Must verify actual URL paths exist for target language**
- [ ] Path1 and Path2 (display path) - Localize if needed

### 4. Asset Group Text Assets

Query: `SELECT asset_group_asset FROM asset_group_asset WHERE asset_group.id = X`

Use `/home/hub/public_html/gads/scripts/mcp/pmax/seq-swap.js` utilities for intelligent swapping.

**Headlines** (`field_type = HEADLINE`):
- [ ] Translate/localize all headlines (30 char limit)
- [ ] Required: 3-15 headlines
- [ ] Consider cultural relevance and keyword targeting

**Long Headlines** (`field_type = LONG_HEADLINE`):
- [ ] Translate/localize long headlines (90 char limit)
- [ ] Required: 1-5 long headlines
- [ ] Emphasize key value propositions in target language

**Descriptions** (`field_type = DESCRIPTION`):
- [ ] Translate/localize descriptions (90 char limit)
- [ ] Required: 2-5 descriptions
- [ ] Maintain brand voice in target language

**Business Name** (`field_type = BUSINESS_NAME`):
- [ ] Usually stays the same, but check for regional variations
- [ ] Optional: 1-5 business names

### 5. Asset Group Visual Assets

**Marketing Images** (`field_type = MARKETING_IMAGE`):
- [ ] Review images for cultural appropriateness
- [ ] Check if text overlays need translation
- [ ] Recommended: 1-20 images (1.91:1 aspect ratio)

**Square Marketing Images** (`field_type = SQUARE_MARKETING_IMAGE`):
- [ ] Same considerations as marketing images
- [ ] Recommended: 1-20 images (1:1 aspect ratio)

**Logo** (`field_type = LOGO`):
- [ ] Usually universal, but check for regional brand variations
- [ ] Recommended: 1-5 logos (1:1 aspect ratio)

**Landscape Logo** (`field_type = LANDSCAPE_LOGO`):
- [ ] Check for regional logo variations
- [ ] Recommended: 1-5 logos (4:1 aspect ratio)

**YouTube Videos** (`field_type = YOUTUBE_VIDEO`):
- [ ] Check if videos have localized versions
- [ ] Verify subtitles/captions are available
- [ ] Optional: up to 5 videos

### 6. Asset Group Signals (Audience & Search Themes)

Query: `SELECT asset_group_signal FROM asset_group_signal WHERE asset_group.id = X`

**Search Themes** (`search_theme.text`):
- [ ] Translate search themes to target language
- [ ] Research local search behavior and keywords
- [ ] Recommended: 15-20 themes per asset group
- [ ] Example: "trabajo y estudio irlanda" (Spanish) vs "trabalho e estudo irlanda" (Portuguese)

**Audience Signals**:
- [ ] Demographics (age, gender, parental status, household income)
- [ ] In-market audiences - Check regional availability
- [ ] Affinity audiences - Verify exist in target region
- [ ] Custom audiences - May need regional versions
- [ ] User lists/remarketing - Consider separate lists per region

### 7. Verification & Testing

**Post-Clone Validation:**
- [ ] Run queries to verify all asset counts meet requirements
- [ ] Check that all text assets use target language
- [ ] Verify all URLs point to correct language paths
- [ ] Test that geographic/language targeting is correct
- [ ] Ensure conversion tracking is properly configured
- [ ] Review budget allocation is appropriate for new region

**Reporting Checklist:**
```javascript
// Use this pattern for comprehensive validation
const report = {
  campaign: { id, name, status, budget, targeting: { geo, language } },
  assetGroups: [
    {
      id, name, status,
      textAssets: {
        headlines: { total: 15, language: 'spanish' },
        longHeadlines: { total: 5, language: 'spanish' },
        descriptions: { total: 5, language: 'spanish' }
      },
      visualAssets: { images: 20, logos: 5 },
      signals: { searchThemes: 17, audiences: 5 }
    }
  ],
  campaignAssets: {
    sitelinks: { total: 20, language: 'spanish' },
    callouts: { total: 8, language: 'spanish' }
  }
};
```

### Real-World Example: Localizing PMax-LATAM-ES

Successfully localized campaign **PMax-LATAM-ES** (ID: 23205138425) from Portuguese to Spanish for Argentina, Uruguay, Chile:

**Campaign Details:**
- **Name Format:** `PMax-LATAM-ES` (Type=Performance Max, Location=LATAM region, Language=Spanish)
- **Target Markets:** Argentina, Uruguay, Chile
- **Languages:** Spanish (primary) + English
- **Asset Groups:** 3 (All users, Schools & Agents Brazil, InMarket: English Language Schools)

**Changes Made:**
1. ✅ Campaign name set to proper convention: `PMax-LATAM-ES`
2. ✅ 3 Asset Groups × 15 headlines = **45 headlines** swapped
3. ✅ 3 Asset Groups × 5 long headlines = **15 long headlines** swapped
4. ✅ 3 Asset Groups × 5 descriptions = **15 descriptions** swapped
5. ✅ 3 Asset Groups × 17 search themes = **51 search themes** swapped
6. ✅ 20 campaign-level sitelinks swapped
7. ⚠️  **Lesson:** One sitelink text exceeded 25 chars ("Apartamentos Estudiantiles") - shortened to "Apartamentos"

**Results:**
- **Total Assets Localized:** 146 text assets (Portuguese → Spanish)
- **Time Taken:** ~2 hours (manual process with utilities)
- **Target with Full Automation:** <5 minutes with single-command localization

**Key Learnings:**
- Pre-validation of character limits prevents API errors
- Sequential swap maintains min/max requirements throughout
- Language detection helps identify what needs updating
- Dynamic campaign name parameter (`{_cname}`) ensures proper tracking

### Tools for Automation

**Current Utilities:**
- `/home/hub/public_html/gads/scripts/mcp/pmax/query.js` - Query asset groups and assets
- `/home/hub/public_html/gads/scripts/mcp/pmax/seq-swap.js` - Intelligent sequential swap with validation
- `/home/hub/public_html/gads/scripts/mcp/pmax/assets.json` - Central storage for localized content

**Future: Single-Command Localization Script**
```javascript
// Vision: node scripts/localize-pmax.js --campaign=23205138425 --target=es-AR
//
// This script would:
// 1. Query all current assets and settings
// 2. Generate localization checklist
// 3. Prompt for confirmation of changes
// 4. Execute all swaps with error handling
// 5. Generate comprehensive before/after report
```
