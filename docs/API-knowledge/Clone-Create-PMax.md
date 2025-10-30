# New PMax Campaign Creation Plan

**Source Template:** PMax-Ireland (17440682130)  
**Account:** 1051706978  
**Status:** All campaigns will be created as PAUSED  
**Budget:** €10/day each = €70/day total  
**Location Setting:** LOCATION_OF_PRESENCE (people physically in location)

---

## Campaign #1: PMax-LATAM-ES

**Targeting:**
- **Countries:** Argentina, Uruguay, Chile
- **Specific Locations:** High-GDP cities from LATAM-ES campaign
  - Argentina: Buenos Aires, Córdoba, Rosario, Mendoza, La Plata
  - Uruguay: Montevideo, Salto, Ciudad de la Costa
  - Chile: Santiago, Valparaíso, Concepción, La Serena, Antofagasta

**Exclusions:** Brazil (plus standard)

**Settings:**
- Language: Spanish
- Budget: €10/day
- Bidding: Maximize Conversions
- Location Option: PRESENCE only

**Geo Target Constants Needed:**
- Argentina: 2032
- Uruguay: 2858
- Chile: 2152
- (Plus city-level targeting)

---

## Campaign #2: PMax-Brazil-PT

**Targeting:**
- **States:** São Paulo, Rio Grande do Sul, Santa Catarina, Paraná, Rio de Janeiro
- **Cities:** (From Brazil-GnrlTerms-POR campaign)
  - São Paulo (city), Rio de Janeiro (city), Brasília
  - Porto Alegre, Curitiba, Florianópolis
  - Campinas, Santos, São José dos Campos

**Exclusions:** Argentina, Uruguay, Chile

**Settings:**
- Language: Portuguese (Brazil)
- Budget: €10/day
- Bidding: Maximize Conversions
- Location Option: PRESENCE only

**Geo Target Constants Needed:**
- Brazil: 2076
- São Paulo State: 1001773
- (Plus city-level targeting)

---

## Campaign #3: PMax-Mexico-ES

**Targeting:**
- **Cities:** Mexico City, Monterrey, Guadalajara

**Exclusions:** None specified (standard exclusions)

**Settings:**
- Language: Spanish
- Budget: €10/day
- Bidding: Maximize Conversions
- Location Option: PRESENCE only

**Geo Target Constants Needed:**
- Mexico City: 1010012
- Monterrey: 1010144
- Guadalajara: 1010024

---

## Campaign #4: PMax-CNTRLAM-ES

**Targeting:**
- **Countries:** Panama, Costa Rica

**Exclusions:** All other Central American countries + Mexico:
- Guatemala, Belize, Honduras, El Salvador, Nicaragua, Mexico

**Settings:**
- Language: Spanish
- Budget: €10/day
- Bidding: Maximize Conversions
- Location Option: PRESENCE only

**Geo Target Constants Needed:**
- Panama: 2591
- Costa Rica: 2188

**Exclusion Geo Target Constants:**
- Guatemala: 2320
- Belize: 2084
- Honduras: 2340
- El Salvador: 2222
- Nicaragua: 2558
- Mexico: 2484

---

## Campaign #5: PMax-Spain-ES

**Targeting:**
- **Country:** Spain

**Exclusions:** France, Portugal

**Settings:**
- Language: Spanish
- Budget: €10/day
- Bidding: Maximize Conversions
- Location Option: PRESENCE only

**Geo Target Constants Needed:**
- Spain: 2724

**Exclusion Geo Target Constants:**
- France: 2250
- Portugal: 2620

---

## Campaign #6: PMax-France-FR

**Targeting:**
- **Countries:** France, Belgium, Switzerland

**Exclusions:** Spain, Germany

**Settings:**
- Language: French
- Budget: €10/day
- Bidding: Maximize Conversions
- Location Option: PRESENCE only

**Geo Target Constants Needed:**
- France: 2250
- Belgium: 2056
- Switzerland: 2756

**Exclusion Geo Target Constants:**
- Spain: 2724
- Germany: 2276

---

## Campaign #7: PMax-Italy-IT

**Targeting:**
- **Country:** Italy

**Exclusions:** Spain, Germany, France, Belgium, Switzerland

**Settings:**
- Language: Italian
- Budget: €10/day
- Bidding: Maximize Conversions
- Location Option: PRESENCE only

**Geo Target Constants Needed:**
- Italy: 2380

**Exclusion Geo Target Constants:**
- Spain: 2724
- Germany: 2276
- France: 2250
- Belgium: 2056
- Switzerland: 2756

---

## Campaign Creation Summary

**Total Campaigns:** 7  
**Total Daily Budget:** €70 (€10 x 7)  
**Total Monthly Budget:** ~€2,100

**All campaigns will:**
- Clone settings from PMax-Ireland (17440682130)
- Use LOCATION_OF_PRESENCE targeting (not interest)
- Start in PAUSED status
- Use Maximize Conversions bidding strategy
- Include appropriate language targeting
- Have proper geographic exclusions

**Asset Groups:**
Each campaign will need asset groups created separately with:
- Headlines (15 max)
- Long headlines (5 max)
- Descriptions (4 max)
- Images
- Logos
- Business name: "ULearn English School"

**Note:** Asset groups cannot be cloned via API - they'll need to be created manually or via separate API calls after campaign creation.

---

## Geo Target Constants Reference

Common geo target constants for Google Ads:

**Countries:**
- Argentina: 2032
- Brazil: 2076
- Chile: 2152
- Uruguay: 2858
- Mexico: 2484
- Panama: 2591
- Costa Rica: 2188
- Spain: 2724
- France: 2250
- Italy: 2380
- Belgium: 2056
- Switzerland: 2756
- Germany: 2276
- Portugal: 2620

**Central America (Exclusions):**
- Guatemala: 2320
- Belize: 2084
- Honduras: 2340
- El Salvador: 2222
- Nicaragua: 2558

---

## CRITICAL: What Happens After Creation

After campaigns are created as PAUSED:

1. **Asset Groups Must Be Created**
   - Each PMax campaign needs at least one asset group
   - Cannot run without assets
   - Will need headlines, descriptions, images, logos

2. **Review Location Targeting**
   - Verify each campaign's locations in Google Ads UI
   - Confirm PRESENCE setting is correct
   - Check that exclusions applied correctly

3. **Test Budget**
   - Start with €10/day as specified
   - Monitor for 7-14 days
   - Scale winners, pause losers

4. **Learning Period**
   - Each new PMax campaign needs 2-4 weeks learning period
   - Don't judge performance in first 14 days
   - Let Google's algorithm optimize

5. **Conversion Tracking**
   - Verify ECL is tracking properly
   - Check GCLID parameter is present
   - Monitor True ROAS in MySQL database

---

## 🤖 AUTOMATED CAMPAIGN CREATION VIA CLAUDE DESKTOP

### Complete Workflow for Cloning Performance Max Campaigns

**NEW: Asset group cloning is now fully automated via MCP API!**

The MCP server now has two new tools:
- `GAds_AssetGroup_Query` - Query asset groups from existing PMax campaigns
- `GAds_AssetGroup_Clone` - Clone asset groups between PMax campaigns

### Step-by-Step Process for Claude Desktop:

#### STEP 1: Create the Campaign Structure

Use `GAds_Universal_Write_API` to create the new Performance Max campaign:

```
Create a new Performance Max campaign with these settings:

Parameters:
- resource_type: "campaigns"
- operation_type: "create"
- confirm_danger: true

Campaign Settings:
- Name: "PMax-LATAM-ES"
- Status: PAUSED
- Budget: €10/day
- Bidding: Maximize Conversions
- Campaign type: PERFORMANCE_MAX (10)

Targeting:
- Countries: Argentina (2032), Uruguay (2858), Chile (2152)
- Language: Spanish
- Location Setting: LOCATION_OF_PRESENCE

Use GAds_Universal_Write_API with confirm_danger: true
```

#### STEP 2: Query Source Campaign Asset Groups

After the campaign is created, get the new campaign ID and query the source asset groups:

```
Use GAds_AssetGroup_Query to query asset groups from the source campaign:

Parameters:
- campaign_id: "17440682130"  (PMax-Ireland source campaign)

This will return all asset groups with their:
- Headlines, long headlines, descriptions
- Images and logos
- Final URLs
- Asset group structure
```

#### STEP 3: Clone Asset Groups to New Campaign

Use the new asset group cloning tool:

```
Use GAds_AssetGroup_Clone to clone asset groups:

Parameters:
- source_campaign_id: "17440682130"
- target_campaign_id: "[NEW_CAMPAIGN_ID_FROM_STEP_1]"
- status: "PAUSED"
- confirm_danger: true

Optional:
- new_final_urls: ["https://ulearnschool.com/es/latam"] (if different URL needed)

This will:
1. Query all asset groups from source campaign
2. Create identical asset groups in target campaign
3. Link all assets (headlines, descriptions, images, logos)
4. Return summary of created asset groups
```

#### STEP 4: Verify Creation

Verify the campaign and asset groups were created:

```
1. Use GAds_Campaign_API to verify the new campaign exists and is configured correctly

2. Use GAds_AssetGroup_Query on the new campaign to confirm asset groups were cloned

3. Check that all assets are present:
   - Headlines (should match source)
   - Descriptions (should match source)
   - Images (should match source)
   - Logos (should match source)
```

#### STEP 5: Apply Location Targeting

Use `GAds_Universal_Write_API` to add location criteria:

```
Add location targeting using campaignCriteria:

resource_type: "campaignCriteria"
operation_type: "create"
confirm_danger: true

Operations for each location:
{
  campaign: "customers/[ACCOUNT_ID]/campaigns/[CAMPAIGN_ID]",
  location: {
    geo_target_constant: "geoTargetConstants/2032"  // Argentina
  }
}

Repeat for Uruguay (2858) and Chile (2152)
```

#### STEP 6: Add Negative Locations (if needed)

```
Add negative location criteria:

{
  campaign: "customers/[ACCOUNT_ID]/campaigns/[CAMPAIGN_ID]",
  negative: true,
  location: {
    geo_target_constant: "geoTargetConstants/2076"  // Brazil (excluded)
  }
}
```

### Complete Example Prompt for Claude Desktop:

```
Hi Claude! I need to clone the PMax-Ireland campaign (17440682130) to create 7 new Performance Max campaigns for different regions.

STEP 1 - CREATE CAMPAIGN #1: PMax-LATAM-ES

Use GAds_Universal_Write_API to create a new Performance Max campaign:
- Name: "PMax-LATAM-ES"
- Budget: €10/day (10000000 micros)
- Status: PAUSED
- Campaign Type: PERFORMANCE_MAX (10)
- Bidding: Maximize Conversions

Settings:
- resource_type: "campaigns"
- operation_type: "create"
- confirm_danger: true

STEP 2 - CLONE ASSET GROUPS

After campaign creation, use GAds_AssetGroup_Clone:
- source_campaign_id: "17440682130"
- target_campaign_id: [ID from step 1]
- status: "PAUSED"
- confirm_danger: true

STEP 3 - ADD LOCATION TARGETING

Use GAds_Universal_Write_API with campaignCriteria to add:
- Argentina (2032)
- Uruguay (2858)
- Chile (2152)

And exclude:
- Brazil (2076)

STEP 4 - VERIFY

Use GAds_AssetGroup_Query to verify asset groups were cloned successfully.

Please proceed step-by-step and show results after each step.
```

### Important Notes:

1. **Asset Groups are Now Automated**: The previous manual requirement has been eliminated with the new MCP tools

2. **Always Use PAUSED**: Create all campaigns and asset groups in PAUSED status for review before activation

3. **Verify Each Step**: Check results after each operation before proceeding

4. **Learning Period**: Allow 2-4 weeks after enabling for PMax to optimize

5. **Budget Management**: Monitor spend daily in first week, adjust as needed

---

**Ready to proceed with campaign creation?**