# Performance Max Asset Management - MCP Tools

## Recent Updates

**2025-10-29** - Major Error Handling Fix
- ✅ Fixed `addAssetsToAssetGroup()` and `removeAssetsFromAssetGroup()` error handling
- ✅ Tools now properly report failures instead of always returning success
- ✅ Added detailed error messages with error codes and request IDs
- ✅ Added partial failure detection
- ✅ Tested and verified: Successfully removed assets from PMax-Brazil-POR campaign
- ⚠️ Updated documentation with common gotchas (see below)

**Known Issues:**
- Removed assets may still appear in queries for 5-10 minutes (Google Ads API caching)
- Verify removals in Google Ads UI asset associations report instead

---

## Available Tools

1. **GAds_AssetGroup_Query** - View current assets in asset groups
2. **GAds_AssetGroup_Clone** - Clone entire asset groups between campaigns
3. **GAds_AssetGroup_AddAssets** - Link assets to asset groups
4. **GAds_AssetGroup_RemoveAssets** - Unlink assets from asset groups

---

## ⚠️ CRITICAL: Parameter Rules

### DO NOT Include These Parameters:
- ❌ **`account_id`** - Always omit this, uses default account
- ❌ Extra quotes around values in Claude Desktop JSON

### ALWAYS Include These:
- ✅ **`confirm_danger: true`** - Required for all write operations
- ✅ **`asset_group_id`** - The asset group ID (string)
- ✅ **`assets`** - Array of {asset_id, field_type} objects

### Correct Format Example:
```javascript
{
  asset_group_id: "6624724877",
  assets: [
    { asset_id: "303596341723", field_type: "HEADLINE" }
  ],
  confirm_danger: true
}
```

### ❌ WRONG - Don't Do This:
```javascript
{
  account_id: "1051706978",  // ← Remove this!
  asset_group_id: "6624724877",
  ...
}
```

---

## Replace Assets in Existing Campaign

### Step 1: Query Current Assets
```
Tool: GAds_AssetGroup_Query
Parameters: { campaign_id: "CAMPAIGN_ID" }
```
- Save asset group IDs (usually 3 per campaign: "Interests", "School", "All users")
- Save existing asset IDs and field types for removal
- **Note:** Do NOT include `account_id` parameter

### Step 2: Create New Text Assets
```
Tool: GAds_Universal_Write_API
Parameters: {
  resource_type: "assets",
  operation_type: "create",
  confirm_danger: true,
  operations: [{ text: "Your headline here" }, ...]
}
```
- Save returned asset IDs for linking
- Create all headlines, long headlines, and descriptions you need

### Step 3: Remove Old Assets (Do This FIRST!)
```
Tool: GAds_AssetGroup_RemoveAssets
Parameters: {
  asset_group_id: "ASSET_GROUP_ID",
  assets: [
    { asset_id: "OLD_ID", field_type: "HEADLINE" },
    { asset_id: "OLD_ID", field_type: "DESCRIPTION" }
  ],
  confirm_danger: true
}
```
- **IMPORTANT:** Remove BEFORE adding to make room (15 headline max, 5 long headline max, 4 description max)
- Only remove text assets - keep images/logos unless replacing
- If error says "already removed", that's OK - skip that asset and continue
- Repeat for each asset group
- **Do NOT include `account_id` parameter**

### Step 4: Add New Assets to Asset Groups
```
Tool: GAds_AssetGroup_AddAssets
Parameters: {
  asset_group_id: "ASSET_GROUP_ID",
  assets: [
    { asset_id: "NEW_ID", field_type: "HEADLINE" },
    { asset_id: "NEW_ID", field_type: "DESCRIPTION" }
  ],
  confirm_danger: true
}
```
- Add new assets now that there's room
- Repeat for each asset group (usually 3 per campaign)
- **Do NOT include `account_id` parameter**

### Step 5: Verify Changes
- **In Claude Desktop:** Query assets again - may still show old assets for 5-10 minutes (caching)
- **In Google Ads UI:** Go to Assets → Asset associations report
  - Filter by campaign ID
  - Removed assets will show "Removed" status immediately
  - New assets will show as "Enabled"
- URL format: `https://ads.google.com/aw/assetreport/associations?campaignId=YOUR_CAMPAIGN_ID&channel=13&ocid=YOUR_OCID&assetType=all`

---

## Clone Entire Campaign with Assets

### Step 1: Create Campaign Structure
```
Tool: GAds_Universal_Write_API
resource_type: "campaigns"
operation_type: "create"
```
Create PMax campaign (type 10), status PAUSED, save campaign ID.

### Step 2: Clone Asset Groups
```
Tool: GAds_AssetGroup_Clone
Parameters: {
  source_campaign_id: "SOURCE_ID",
  target_campaign_id: "NEW_ID",
  status: "PAUSED",
  new_final_urls: ["https://..."] (optional),
  confirm_danger: true
}
```

### Step 3: Add Location Targeting
```
Tool: GAds_Universal_Write_API
resource_type: "campaignCriteria"
```
Add geo targeting criteria.

### Step 4: Verify and Enable
Query asset groups, verify, then enable campaign when ready.

---

## Asset Requirements

**Text Assets:**
- Headlines: 3-15 required (30 chars max each)
- Long Headlines: 1-5 required (90 chars max)
- Descriptions: 2-4 required (90 chars max)

**Visual Assets:**
- Images: 1-20 (landscape 1.91:1)
- Logos: 1-5 (landscape or square)

---

## Field Types

Common field types for `GAds_AssetGroup_AddAssets` / `RemoveAssets`:
- `HEADLINE`
- `LONG_HEADLINE`
- `DESCRIPTION`
- `MARKETING_IMAGE`
- `SQUARE_MARKETING_IMAGE`
- `LOGO`
- `YOUTUBE_VIDEO`

---

## If MCP Tools Aren't Working

### 1. Restart MCP Server
```bash
touch /home/hub/public_html/gads/tmp/restart.txt
```

### 2. Disconnect & Reconnect Claude Desktop
- Settings → Model Context Protocol
- Find "Hub GAds MCP" server
- Click **Disconnect**
- Wait 5 seconds
- Click **Connect**
- Verify "Connected" status

### 3. Test Tools Are Available
Ask Claude Desktop to list all available tools. You should see:
- `GAds_AssetGroup_Query`
- `GAds_AssetGroup_Clone`
- `GAds_AssetGroup_AddAssets`
- `GAds_AssetGroup_RemoveAssets`

### 4. Test Server-Side (For Developers)
```bash
cd /home/hub/public_html/gads

# Test Add Assets
node -e "
const { addAssetsToAssetGroup } = require('./scripts/mcp/mcp-api-full');
addAssetsToAssetGroup({
  asset_group_id: 'ASSET_GROUP_ID',
  assets: [{ asset_id: 'ASSET_ID', field_type: 'HEADLINE' }],
  confirm_danger: true
}).then(r => console.log('Result:', r.success));
"

# Test Remove Assets
node -e "
const { removeAssetsFromAssetGroup } = require('./scripts/mcp/mcp-api-full');
removeAssetsFromAssetGroup({
  asset_group_id: 'ASSET_GROUP_ID',
  assets: [{ asset_id: 'ASSET_ID', field_type: 'HEADLINE' }],
  confirm_danger: true
}).then(r => console.log('Result:', r.success));
"
```

---

## Troubleshooting Error Messages

### "Tool not found" or "Tool execution failed"
**Solution:** Disconnect and reconnect Claude Desktop to MCP server (see above)

### "undefined" error with no details
**Cause:** Including `account_id` parameter in request
**Solution:** **REMOVE `account_id` from all tool calls** - it uses default account automatically

### "The operation is not allowed for removed resources"
**Cause:** Trying to remove an asset that was already removed previously
**Solution:** This is normal - the asset was already successfully removed. Skip this asset and continue with others.
**Note:** Removed assets may still appear in queries for 5-10 minutes due to API caching.

### "Resource was not found"
**Meaning:** Asset is not actually linked to that asset group
**Solution:** Query assets first to verify which are actually linked

### "Asset requirements not met"
**Meaning:** Not enough assets of required types after removal
**Solution:** Check minimum counts (3 headlines, 1 long headline, 2 descriptions). Add new assets BEFORE removing old ones.

### "Maximum number of assets reached"
**Cause:** Asset groups have limits (15 headlines max, 5 long headlines max, 4 descriptions max)
**Solution:** Remove existing assets FIRST to make room, then add new ones

### "Asset already linked"
**Meaning:** Trying to add an asset that's already in the asset group
**Solution:** Query first to check what's already linked, skip duplicates

### "Campaign not Performance Max"
**Meaning:** These tools only work with PMax campaigns
**Solution:** Verify campaign type is PERFORMANCE_MAX (type 10)

### Tool reports success but asset still appears in query
**Cause:** Google Ads API caching - removed assets can appear in queries for 5-10 minutes
**Solution:** Check the Google Ads UI asset report - removed assets will show "Removed" status there immediately

### Changes not showing in Google Ads UI
**Solution:** Wait 5-10 minutes for API propagation, then refresh. For removed assets, check the asset associations report - they'll show "Removed" status.

---

## Common Gotchas & Pitfalls

### 🚨 #1: NEVER Include `account_id` Parameter
**The Problem:** Including `account_id` causes "undefined" errors with no helpful details.
**Why:** The MCP server automatically uses the default account from environment variables.
**Solution:** ALWAYS omit `account_id` from ALL tool calls.

### 🚨 #2: Removed Assets Still Show in Queries
**The Problem:** After successfully removing an asset, it still appears when you query the asset group.
**Why:** Google Ads API caching - can take 5-10 minutes to propagate.
**How to Verify:** Check Google Ads UI → Assets → Asset associations report. Removed assets show "Removed" status immediately.
**Solution:** Don't re-attempt removal based on query results alone. Trust the success response.

### 🚨 #3: Asset Group Limits
**The Problem:** Can't add new assets even though removal reported success.
**Why:** Asset groups have maximums:
  - Headlines: 15 max
  - Long Headlines: 5 max
  - Descriptions: 4 max
**Solution:** Remove old assets FIRST to make room, THEN add new ones. Don't rely on queries to verify removal before adding (see #2).

### 🚨 #4: Error Handling Changed (Jan 2025)
**The Problem:** Previously, tools would report `success: true` even when operations failed.
**Fixed:** Tools now properly report failures with detailed error messages including:
  - Actual error message from Google Ads API
  - Error codes (e.g., "OPERATION_NOT_PERMITTED_FOR_REMOVED_RESOURCE")
  - Request IDs for debugging
  - Partial failure detection
**Impact:** If a tool reports success, it actually succeeded. If it reports an error, read the error message carefully.

### 🚨 #5: Shared Assets Between Campaigns
**The Problem:** Assets are shared across your account. Removing an asset from one campaign's asset group doesn't delete the asset itself.
**Why:** The same asset can be used in multiple campaigns and asset groups.
**Solution:** This is correct behavior. To completely delete an asset from your account, you'd need to use the Universal Write API with delete operation.

### 🚨 #6: Must Restart Server After Code Changes
**The Problem:** Code changes to MCP server don't take effect immediately.
**Solution:** ALWAYS run this after ANY code change:
```bash
touch /home/hub/public_html/gads/tmp/restart.txt
```
Then reconnect Claude Desktop to the MCP server.

### 🚨 #7: Field Type Case Sensitivity
**The Problem:** Using lowercase field types like "headline" instead of "HEADLINE"
**Why:** Google Ads API requires exact uppercase values
**Solution:** Always use: `HEADLINE`, `LONG_HEADLINE`, `DESCRIPTION`, `MARKETING_IMAGE`, etc.

### 🚨 #8: Working with Cloned Campaigns
**The Problem:** Cloned campaigns share the same assets as the source campaign initially.
**Why:** Asset groups are cloned with references to the same assets.
**Solution:** This is expected. You can remove/add assets to customize each campaign independently.

---

## Best Practices

**Safety:**
- Always use `confirm_danger: true` for write operations
- Create campaigns/assets in PAUSED status first
- Verify before enabling
- Test on one asset group before doing all

**Parameter Management:**
- **NEVER include `account_id`** - it uses default
- Always use string values for IDs
- Field types are case-sensitive

**Asset Management:**
- Keep images/logos when only updating text
- Check minimum requirements before removing
- Query assets before making changes
- Add new assets BEFORE removing old ones

**Testing:**
- Test on one asset first
- Verify in Google Ads UI before rolling out
- Allow 2-4 weeks learning period for new campaigns

---

## Quick Reference

| Task | Tool | Key Parameters |
|------|------|----------------|
| View assets | `GAds_AssetGroup_Query` | `campaign_id` |
| Add assets | `GAds_AssetGroup_AddAssets` | `asset_group_id`, `assets`, `confirm_danger` |
| Remove assets | `GAds_AssetGroup_RemoveAssets` | `asset_group_id`, `assets`, `confirm_danger` |
| Clone campaign | `GAds_AssetGroup_Clone` | `source_campaign_id`, `target_campaign_id`, `confirm_danger` |

**Remember:** Do NOT include `account_id` in any requests!

---

## Proof of Concept Results (2025-10-29)

**Test Campaign:** PMax-Brazil-POR (ID: 23202585091)
**Test Asset Group:** "Interests" (ID: 6624724877)

**Successfully Removed Assets:**
1. Asset 387422062 - "Learn English in Dublin" (HEADLINE)
2. Asset 610244015 - "Study English in Ireland" (HEADLINE)

**Results:**
- ✅ Both assets successfully removed via MCP tools
- ✅ Confirmed "Removed" status in Google Ads UI asset associations report
- ✅ Error handling correctly reported when attempting to re-remove already-removed assets
- ⚠️ Assets continued to appear in API queries for ~10 minutes after removal (expected caching behavior)

**Conclusion:** Tools are working correctly. Trust success responses, verify in Google Ads UI.

---

**Last Updated:** 2025-10-29
**Status:** Tested and working in production with improved error handling
