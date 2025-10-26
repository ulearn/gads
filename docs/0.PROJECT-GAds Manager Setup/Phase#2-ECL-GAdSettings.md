We now have the above component parts functioning (points 1-5 above). 

Detail...

CONVERSIONS
"Submit Lead Form" 
* Goal Type: Submit Lead Form (Web Conversion) 
* CTA - Webform Submission
* Currently Primary with a value of €22.40
* Graduated shift to lower value and then Secondary

"ECL-UT"
* Goal Type: Contact
* Type: Secondary 
* Value = 0

"ECL - SQL" 
* Goal Type: Qualified Lead 
* Type: Primary
* Value = dynamically set (by pipeline stage/€amount)

"ECL - WON"
* Goal Type: Converted Lead 
* Type: Primary
* Value = Dynamically set (by €amount)

REPORTING
* MySql DB synced to HubSpot & Google Ads 
* Dashboards
   * Main: https://hub.ulearnschool.com/gads/dashboard
   * Pipeline: https://hub.ulearnschool.com/gads/scripts/analytics/pipeline-analysis.html
   * BurnRate: https://hub.ulearnschool.com/gads/scripts/analytics/burn-rate.html

===================================================

Connecting Ai to Google Ads 
We now need to move on to "plugging Claude in" to Google Ads API so you can bring analysis to 

Audience Manager:
* Your data segments
* Audiences
* Custom Segments
* Combined Segments
* Your data insights
* Your data sources 
* Settings 

NOTE: We are targeting students in our target countries. Normally they are 18-35 from affluent locations (cities/towns/neighbourhoods), high income families, high education families interested in studying English in Dublin/Ireland. We are seeking "in market" leads who are specifically looking to travel to Dublin to study English. 

We are not really interested in general tourism to Ireland. We are not trying to drive "brand awareness" per se - we are trying to target people who are already pretty far down the decision tree:
1) They want to travel abroad
2) They want/need to study English (for career/further studies/personal growth)
3) They want to go to Ireland (and even more specifically Dublin but being the Capital most will choose that location) and not the UK or Canada or Australia or USA or any other native English speaking country - they have definitively chosen Ireland already 
4) If they are non-EU (especially LATAM) they are likely to be interested in our Work&Study Programme which allows them work part/full time during their stay
5) They have often (but not always) been or will be searching for and visited competitor schools (delfinschool.ie, Atlas Language School, ISI, SEDA, ELI, CES and so on - we have lists of EEI schools & their domains as reference)

We can also you Customer Lists - ULearn is 40 years old but we have customer lists going back nearly 2 decades so plenty of customer data available some of which is already uploaded to Google Ads 

Campaign Settings:
* Optimization Score 
* Budget
* Customer Acquisition
* Bid Strategy 
* Campaign Type
* Ad Rotation
* Languages (Important! - English language school targeting non-English speakers) 
* Locations (Important!)
* Targeting Method (Important!- usually "people in targeted locations")
* Targeting Settings (Important! Observation Vs Targeting)
* Asset Optimization 
* Tracking Template (already set up IMO)

Ad Group Settings:
* Default max. CPC
* Max CPM 
* Target CPA 
* Target CPV
* Target CPM
* Target ROAS (Now that we have actual sales values I believe we will be using tROAS)
* Desktop Bid Adjust
* Mobile Bid Adjust 
* Tablet Bid Adjust 
* Display Network custom bid type (usually "none" - honestly no idea)
* Ad Rotation 
* Location Targeting (should following the Campaign I suppose)
* Settings for AI Max 
* Targeting Settings
   * Placements
   * Topics
   * Audience Segments
   * Genders
   * Ages 
   * Parental Status
   * Household Incomes
* Tracking Template (should follow Campaign I suppose) 

ASSET GROUPS
* Headlines
* Long Headlines
* Descriptions
* Call-to-Action
* Business Name: "ULearn English School"
* Images (we upload but would be good to get insight on how each performs - discard/replace poor performing images etc) 
* Logos
* Videos (as images- performance insights would be useful if they can be gleaned)
* Audience Signal (I see one here says "Students F" - no idea what this does)

KEYWORDS
* Keyword
* Match Type (Exact/Phrase/Broad) - needs review to align with campaign/bidding etc
* Max CPC / CPM / CPV
* Negative Keywords (we have a long list already - we add to them as required)
* Search Themes
* Brand List 
* Negative Brand List 
* Locations & Locations Negative (again should align with Campaign settings I suppose) 
* Placements & Placements negative
* Negative Placement Lists
* Mobile App Categories & Negatives
* YouTube Videos  & Negatives
* YouTube Channels & Negatives
* Topics & Topics Negatives
* Audience Segments & Negatives
* Genders
* Ages
* Parental Status
* Household Income 

Ads
* Responsive Search 
* Expanded text ads
* Text ads
* Expanded dynamic search ads
* Dynamic search ads 
* Product Ads
* Image Ads 
* App install
* Image App Install
* Video 
* Skippable Instream 
* In-feed video
* Bumper 
* non-skippable in-stream
* Responsive video 
* Masthead Ads
* Audio
* Responsive display
* Responsive
* Display 
* Gmail multi-product template
* App ads for installs
* Demand Gen
   * Image
   * Carousel
   * Prodcut
   * Video

Experiments
* Performance Max experiments (0) - not sure but curious what this is

Ad Assets 
* Sitelinks 
* Callouts
* Structured snippets
* Images
* Business Logos
* Business Names
* Call assets 
* Lead forms
* Locations
* Price Assets
* App Assets
* Promotions
* Hotel callouts (N/A I guess) 

Recommendations
Tons of subcategory items (which we will see as we connect the API) but the main categories are:
* Summary 
* Auto-Apply
* Repairs
* Bidding & Budgets
* Keywords & Targeting
* Ads & Assets 
* Automated Campaigns
* Try new Google Ads mobile app
* Other

Shared Library 
* Audeineces
* Negative keywords
* negative placemnts
* Brand list
* Shared budgets
* Location groups
* Conversion goals
* Labels
* Asset Library

Advanced Tools 
* other items