# Google Ads API Structure for Creating Ads & Ad Extensions (Assets)

## Research Summary for Italy Campaign Replication

This document provides the complete structure and requirements for creating ads and ad extensions (now called "assets") using the Google Ads API v21.

---

## 1. Campaign & Ad Hierarchy Overview

The Google Ads API follows this hierarchy:
- **Customer** (top-level)
  - **Campaign** (contains budget, bidding strategy, targeting)
    - **Ad Group** (logical grouping of ads and keywords)
      - **Ad Group Ad** (individual ads)
      - **Ad Group Criterion** (keywords, targeting)
    - **Campaign Assets** (extensions at campaign level)
  - **Customer Assets** (extensions at account level)

---

## 2. Creating Ads Structure

### 2.1 AdGroupAd Object Structure

```json
{
  "adGroup": "customers/{customer_id}/adGroups/{ad_group_id}",
  "status": "ENABLED",
  "ad": {
    "responsiveSearchAd": {
      "headlines": [
        {
          "text": "Your headline text",
          "pinnedField": "HEADLINE_1" // Optional
        }
      ],
      "descriptions": [
        {
          "text": "Your description text"
        }
      ],
      "path1": "all-inclusive",
      "path2": "deals"
    },
    "finalUrls": ["https://www.example.com"]
  }
}
```

### 2.2 Required Fields for Ad Creation

- **adGroup**: Resource name of the ad group
- **status**: ENABLED, PAUSED, or REMOVED
- **ad.responsiveSearchAd.headlines**: Minimum 3, maximum 15
- **ad.responsiveSearchAd.descriptions**: Minimum 2, maximum 4
- **ad.finalUrls**: Array of destination URLs

### 2.3 Text Asset Specifications

- **Headlines**: Maximum 30 characters each
- **Descriptions**: Maximum 90 characters each
- **Path1 & Path2**: Maximum 15 characters each
- **Final URLs**: Valid HTTP/HTTPS URLs

---

## 3. Asset Types (Ad Extensions) Structure

### 3.1 Asset Creation Flow

1. Create Asset using AssetService
2. Link Asset to Campaign/AdGroup/Customer using appropriate service:
   - CampaignAssetService
   - AdGroupAssetService
   - CustomerAssetService

### 3.2 Sitelink Assets

#### Creation Structure:
```json
{
  "sitelinkAsset": {
    "linkText": "Store Locator",
    "description1": "Get in touch",
    "description2": "Find your local store"
  },
  "finalUrls": ["http://example.com/store-finder"],
  "finalMobileUrls": ["http://example.com/mobile/store-finder"]
}
```

#### Specifications:
- **linkText**: Maximum 25 characters (12 for double-width languages)
- **description1 & description2**: Maximum 35 characters each
- **Minimum**: 2 sitelinks required for display
- **Maximum**: 20 sitelinks per extension
- **Display**: Up to 6 on desktop, 8 on mobile

#### Linking to Campaign:
```json
{
  "asset": "customers/{customer_id}/assets/{asset_id}",
  "campaign": "customers/{customer_id}/campaigns/{campaign_id}",
  "fieldType": "SITELINK"
}
```

### 3.3 Callout Assets

#### Creation Structure:
```json
{
  "calloutAsset": {
    "calloutText": "Free Shipping"
  }
}
```

#### Specifications:
- **calloutText**: Maximum 25 characters
- **Non-clickable**: Pure informational text
- **Minimum**: 2 callouts required for display
- **Maximum**: 20 callouts per extension (up to 10 display)
- **Levels**: Account, Campaign, or Ad Group

#### Linking to Campaign:
```json
{
  "asset": "customers/{customer_id}/assets/{asset_id}",
  "campaign": "customers/{customer_id}/campaigns/{campaign_id}",
  "fieldType": "CALLOUT"
}
```

### 3.4 Structured Snippet Assets

#### Creation Structure:
```json
{
  "structuredSnippetAsset": {
    "header": "SERVICES",
    "values": ["Web Design", "SEO", "Marketing"]
  }
}
```

#### Available Headers:
- AMENITIES
- BRANDS
- COURSES
- DEGREE_PROGRAMS
- DESTINATIONS
- FEATURED_HOTELS
- INSURANCE_COVERAGE
- NEIGHBORHOODS
- SERVICE_CATALOG
- SERVICES
- SHOWS
- STYLES
- TYPES

#### Specifications:
- **header**: Must be from predefined list
- **values**: Maximum 10 values, 25 characters each
- **Languages**: Support for multiple languages
- **Levels**: Account, Campaign, or Ad Group

#### Linking to Campaign:
```json
{
  "asset": "customers/{customer_id}/assets/{asset_id}",
  "campaign": "customers/{customer_id}/campaigns/{campaign_id}",
  "fieldType": "STRUCTURED_SNIPPET"
}
```

---

## 4. API Endpoints & Services

### 4.1 Core Services for Ad Creation

- **CampaignService**: Create/manage campaigns
- **AdGroupService**: Create/manage ad groups
- **AdGroupAdService**: Create/manage ads
- **AdGroupCriterionService**: Add keywords and targeting

### 4.2 Asset Services

- **AssetService**: Create assets (sitelinks, callouts, structured snippets)
- **CampaignAssetService**: Link assets to campaigns
- **AdGroupAssetService**: Link assets to ad groups
- **CustomerAssetService**: Link assets to account level

### 4.3 Base URL Structure

**gRPC**: `googleads.googleapis.com`
**REST**: `https://googleads.googleapis.com/v21/customers/{customer_id}/{service}:{method}`

---

## 5. Required Headers & Authentication

### 5.1 Required Headers

```
Authorization: Bearer {ACCESS_TOKEN}
developer-token: {DEVELOPER_TOKEN}
login-customer-id: {MANAGER_ACCOUNT_ID}
```

### 5.2 Resource Name Format

- Campaign: `customers/{customer_id}/campaigns/{campaign_id}`
- AdGroup: `customers/{customer_id}/adGroups/{ad_group_id}`
- Asset: `customers/{customer_id}/assets/{asset_id}`

---

## 6. Complete Example: Creating Ad with Extensions

### Step 1: Create Sitelink Assets
```http
POST https://googleads.googleapis.com/v21/customers/{customer_id}/assets:mutate

{
  "operations": [
    {
      "create": {
        "sitelinkAsset": {
          "linkText": "Store Locator",
          "description1": "Find stores",
          "description2": "Near you"
        },
        "finalUrls": ["https://example.com/stores"]
      }
    }
  ]
}
```

### Step 2: Create Callout Assets
```http
POST https://googleads.googleapis.com/v21/customers/{customer_id}/assets:mutate

{
  "operations": [
    {
      "create": {
        "calloutAsset": {
          "calloutText": "Free Shipping"
        }
      }
    }
  ]
}
```

### Step 3: Create Structured Snippet Assets
```http
POST https://googleads.googleapis.com/v21/customers/{customer_id}/assets:mutate

{
  "operations": [
    {
      "create": {
        "structuredSnippetAsset": {
          "header": "SERVICES",
          "values": ["Consulting", "Design", "Development"]
        }
      }
    }
  ]
}
```

### Step 4: Link Assets to Campaign
```http
POST https://googleads.googleapis.com/v21/customers/{customer_id}/campaignAssets:mutate

{
  "operations": [
    {
      "create": {
        "asset": "customers/{customer_id}/assets/{sitelink_asset_id}",
        "campaign": "customers/{customer_id}/campaigns/{campaign_id}",
        "fieldType": "SITELINK"
      }
    },
    {
      "create": {
        "asset": "customers/{customer_id}/assets/{callout_asset_id}",
        "campaign": "customers/{customer_id}/campaigns/{campaign_id}",
        "fieldType": "CALLOUT"
      }
    },
    {
      "create": {
        "asset": "customers/{customer_id}/assets/{structured_snippet_asset_id}",
        "campaign": "customers/{customer_id}/campaigns/{campaign_id}",
        "fieldType": "STRUCTURED_SNIPPET"
      }
    }
  ]
}
```

### Step 5: Create Responsive Search Ad
```http
POST https://googleads.googleapis.com/v21/customers/{customer_id}/adGroupAds:mutate

{
  "operations": [
    {
      "create": {
        "adGroup": "customers/{customer_id}/adGroups/{ad_group_id}",
        "status": "ENABLED",
        "ad": {
          "responsiveSearchAd": {
            "headlines": [
              {"text": "Best Products Online"},
              {"text": "Quality You Can Trust"},
              {"text": "Shop Now & Save"}
            ],
            "descriptions": [
              {"text": "Discover our amazing collection of products with fast delivery."},
              {"text": "Join thousands of satisfied customers worldwide."}
            ],
            "path1": "products",
            "path2": "sale"
          },
          "finalUrls": ["https://example.com"]
        }
      }
    }
  ]
}
```

---

## 7. Best Practices for Italy Campaign

### 7.1 Localization Considerations

- **Language**: Use Italian text for all assets
- **Currency**: EUR formatting for price-related callouts
- **Cultural**: Consider Italian shopping behaviors and preferences
- **Time zones**: Europe/Rome timezone for scheduling

### 7.2 Asset Hierarchy Strategy

1. **Account Level**: Universal assets (brand-wide callouts like "Spedizione Gratuita")
2. **Campaign Level**: Product category-specific assets
3. **Ad Group Level**: Highly targeted, keyword-specific assets

### 7.3 Character Limits for Italian

- Italian typically uses more characters than English
- Test headlines and descriptions for length
- Consider using abbreviations where appropriate
- Use Path1/Path2 for Italian navigation terms

---

## 8. Error Handling & Validation

### 8.1 Common Validation Errors

- **INVALID_ARGUMENT**: Missing required fields
- **POLICY_VIOLATION**: Content violates Google policies
- **RESOURCE_LIMIT_EXCEEDED**: Too many assets
- **DUPLICATE_ASSET**: Asset with same content exists

### 8.2 Testing Strategy

1. Use `validate_only: true` for testing without execution
2. Test with small batches first
3. Verify asset display using preview tools
4. Monitor policy compliance

---

## 9. Performance Optimization

### 9.1 Asset Selection Best Practices

- **Sitelinks**: Focus on most popular landing pages
- **Callouts**: Highlight unique value propositions
- **Structured Snippets**: Use relevant headers and complete value lists

### 9.2 A/B Testing Strategy

- Test different sitelink combinations
- Rotate callout messages
- Compare structured snippet headers
- Monitor click-through rates by asset type

---

## Conclusion

This structure provides the complete foundation for replicating Google Ads campaigns for Italy with proper ad creation and asset implementation. The API uses a hierarchical approach where assets are created separately and then linked to appropriate levels (account, campaign, or ad group) based on targeting needs.

Key success factors:
1. Follow the exact JSON structure for each asset type
2. Respect character limits and validation rules
3. Implement proper localization for Italian market
4. Use appropriate asset hierarchy for campaign structure
5. Test thoroughly with validate_only before deployment
