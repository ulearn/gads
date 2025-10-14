# Google Ads API: Required Structure for Ads & Ad Extensions

## 1. Ads Overview
Every ad in the Google Ads API is represented by an **Ad object**.  
Ads must be associated with an **AdGroup** and contain the required fields depending on ad type.

- **Ad types commonly used:**
  - Responsive Search Ad (RSA)
  - Expanded Text Ad (deprecated, but still readable)
  - Call Ad
  - Responsive Display Ad

### Example: Responsive Search Ad (RSA)
Required fields:
- `ad_group` (AdGroup resource where the ad belongs)
- `final_urls` (landing page)
- `responsive_search_ad.headlines` (min 3, max 15)
- `responsive_search_ad.descriptions` (min 2, max 4)

---

## 2. Assets (Ad Extensions)
Ad extensions are handled through the **Asset** resource.  
You **create an Asset** (e.g., sitelink, callout, snippet), then **link it** to a campaign, ad group, or customer using an `AssetLink`.

### 2.1 SitelinkAsset
Fields:
- `link_text` (visible text)
- `description1`, `description2` (optional extra lines)
- `final_urls` (destination URL)
- Optional scheduling (`ad_schedule_targets`, `start_date`, `end_date`)

Linking:
- `CampaignAsset` or `AdGroupAsset` with `asset` = sitelink resource.

### 2.2 CalloutAsset
Fields:
- `text` (25-char limit, required)
- Optional: scheduling (`ad_schedule_targets`), start & end dates

Linking:
- Use `CampaignAsset` or `AdGroupAsset` referencing the `CalloutAsset`.

### 2.3 StructuredSnippetAsset
Fields:
- `header` (must be one of `StructuredSnippetHeaderEnum`, e.g., "Brands", "Destinations")
- `values` (list of strings, min 3 recommended)

Linking:
- Same via `CampaignAsset` or `AdGroupAsset`.

### 2.4 CallAsset (Phone Extension)
Fields:
- `phone_number` (E.164 format)
- `country_code`
- Optional: `call_tracking_enabled`, `call_conversion_action`, `ad_schedule_targets`

Linking:
- CustomerAsset, CampaignAsset, or AdGroupAsset.

---

## 3. Linking Assets
Once assets are created:
- **CustomerAsset** → applies account-wide
- **CampaignAsset** → applies to a single campaign
- **AdGroupAsset** → applies to an ad group

Each link defines:
- `asset` (resource name of created Asset)
- `field_type` (what kind of extension slot, e.g., SITELINK, CALLOUT)

---

## 4. Workflow Summary
1. **Create Ad** under an Ad Group with required fields.  
2. **Create Asset** (Sitelink, Callout, Snippet, Call, etc.) with mandatory fields.  
3. **Link Asset** to the desired level (Customer, Campaign, Ad Group).  
4. Optionally add scheduling, start/end dates, or device restrictions.

---

# Google Ads API: JSON Templates for Ads & Ad Extensions (Assets)

> Below are **schema-style JSON request templates** you can adapt for the Google Ads API (REST/gRPC). They show **the minimum structure** to: create an ad, create assets (sitelink, callout, structured snippet, call), and **link** those assets at **customer / campaign / ad group** levels.

---

## Notes & Conventions

- Replace `CUSTOMER_ID`, `AD_GROUP_ID`, `CAMPAIGN_ID` with real IDs.  
- For REST, send these in `customers/{CUSTOMER_ID}:mutate` with a `mutateOperations[]` array.  
- Fields map 1:1 to the API (gRPC proto names in camelCase).  
- Asset linking is available at **CustomerAsset**, **CampaignAsset**, and **AdGroupAsset**; supported types include **SITELINK, CALLOUT, STRUCTURED_SNIPPET, CALL**, etc.  
- Example call-asset creation + linking flow is documented in Google’s sample (“Add Call”).

---

## 1) Create a Responsive Search Ad (RSA)

```json
{
  "mutateOperations": [
    {
      "adGroupAdOperation": {
        "create": {
          "adGroup": "customers/CUSTOMER_ID/adGroups/AD_GROUP_ID",
          "status": "ENABLED",
          "ad": {
            "finalUrls": ["https://example.com/landing"],
            "responsiveSearchAd": {
              "headlines": [
                { "text": "Headline 1" },
                { "text": "Headline 2" },
                { "text": "Headline 3" }
              ],
              "descriptions": [
                { "text": "Description line 1" },
                { "text": "Description line 2" }
              ],
              "path1": "category",
              "path2": "offer"
            }
          }
        }
      }
    }
  ]
}
```

---

## 2) Create a **Sitelink** Asset

```json
{
  "mutateOperations": [
    {
      "assetOperation": {
        "create": {
          "sitelinkAsset": {
            "linkText": "Pricing",
            "finalUrls": ["https://example.com/pricing"],
            "description1": "Transparent pricing",
            "description2": "No hidden fees"
          }
        }
      }
    }
  ]
}
```

### Link the Sitelink at **Campaign** level

```json
{
  "mutateOperations": [
    {
      "campaignAssetOperation": {
        "create": {
          "campaign": "customers/CUSTOMER_ID/campaigns/CAMPAIGN_ID",
          "asset": "customers/CUSTOMER_ID/assets/ASSET_ID",
          "fieldType": "SITELINK"
        }
      }
    }
  ]
}
```

---

## 3) Create a **Callout** Asset

```json
{
  "mutateOperations": [
    {
      "assetOperation": {
        "create": {
          "calloutAsset": {
            "text": "24/7 Support"
          }
        }
      }
    }
  ]
}
```

### Link the Callout at **Customer** level

```json
{
  "mutateOperations": [
    {
      "customerAssetOperation": {
        "create": {
          "asset": "customers/CUSTOMER_ID/assets/ASSET_ID",
          "fieldType": "CALLOUT"
        }
      }
    }
  ]
}
```

---

## 4) Create a **Structured Snippet** Asset

```json
{
  "mutateOperations": [
    {
      "assetOperation": {
        "create": {
          "structuredSnippetAsset": {
            "header": "BRANDS",
            "values": ["Acme", "Contoso", "Globex"]
          }
        }
      }
    }
  ]
}
```

### Link at **Ad Group** level

```json
{
  "mutateOperations": [
    {
      "adGroupAssetOperation": {
        "create": {
          "adGroup": "customers/CUSTOMER_ID/adGroups/AD_GROUP_ID",
          "asset": "customers/CUSTOMER_ID/assets/ASSET_ID",
          "fieldType": "STRUCTURED_SNIPPET"
        }
      }
    }
  ]
}
```

---

## 5) Create a **Call** Asset (Phone)

```json
{
  "mutateOperations": [
    {
      "assetOperation": {
        "create": {
          "callAsset": {
            "countryCode": "IE",
            "phoneNumber": "+35312345678",
            "callTrackingEnabled": true
          }
        }
      }
    }
  ]
}
```

### Link the Call asset at **Customer** level

```json
{
  "mutateOperations": [
    {
      "customerAssetOperation": {
        "create": {
          "asset": "customers/CUSTOMER_ID/assets/ASSET_ID",
          "fieldType": "CALL"
        }
      }
    }
  ]
}
```

---

## 6) Quick Reference: **Where each asset can be linked**

- **Sitelink (SITELINK)** → AdGroup / Campaign / Customer  
- **Callout (CALLOUT)** → AdGroup / Campaign / Customer  
- **Structured Snippet (STRUCTURED_SNIPPET)** → AdGroup / Campaign / Customer  
- **Call (CALL)** → AdGroup / Campaign / Customer  

---

## 7) End-to-End Flow (Checklist)

1. **Create Campaign & Ad Group** (if not already).  
2. **Create Ad** (e.g., RSA) under the Ad Group.  
3. **Create Assets** (sitelink/callout/snippet/call).  
4. **Link Assets** at the desired level with the correct `fieldType`.  
5. Optionally add **schedules, start/end dates**, device preferences.
