

//==================================================================//
//============ PIPELINE - PRE-PROJECT ANALYSIS  ====================//
//==================================================================//
When a Deal moves from Sequenced to Engaging a weighted signal (Average Spend X Stage Completion Probability) is sent via API in respect of that GCLID. 

1️⃣ Pre Rollout Estimates 
Estimated Average Deal Size =    €1,200
Value = Deal Size × Probability of Closing            

SAMPLE PROBABILITIES & GOOGLE CONVERSION VALUES             
Stage    Probability    Google Conversion Value    When to Send/Adjust in Ads
SQL (Inbox)    10%    €120    Initial import when vetted
Engaging    25%    €300    Triggered on first open/click
Responsive    50%    €600    Big jump — send adjustment ASAP
Advising    60%    €720    Optional mid-stage update
Negotiation    75%    €900    Optional
Contact (Deposit/Quote accepted)    90%    €1,080    Major update
Won    100%    €1,200    Final update




//==================================================================//
//============ DASHBORDS ===========================================//
//==================================================================//

//============ HUBSPOT =================//
/home/hub/public_html/gads/scripts/hubspot/hubspot-sync.js: 
* Pulls HubSpot data. We experimented with models to map the HubSpot fields to MySql but it proved ineffective and instead devised a system to dynamically create any populated fields that was missing in the respective MySql table. 
* We ran into row size limits and did everything possible to change VARCHAR fields to TEXT but even then the limits of MySql caused some issues which meant that not every single HubSpot field (350-400) is mapped but most ~95% are.
* Now captures the association data between contacts and deals using Associations API v4

/home/hub/public_html/gads/scripts/hubspot/fieldmap.js: Utility file that helps create MySql fields for hubspot-sync.js
 * Dynamic Field Mapping Module - Production Version
 * Creates every HubSpot field in MySQL with exact field names
 * Minimal logging for production use

//============ GOOGLE ADS =================//
/home/hub/public_html/gads/scripts/google/gads-sync.js: 
* Pulls Google Ads API data to MySql. As above this is mostly done. It will fire frequently ongoing via cron or similar to bring in new data.

/home/hub/public_html/gads/scripts/google/campaign.js
*  * Handles all Google Ads campaign types with adaptive queries:
 * - Performance Max: Basic data only (limited API access)
 * - Search: Full targeting, keywords, demographics
 * - Display: Targeting and audience data
 * - Video: YouTube targeting
 * - Shopping: Product targeting

//============ FOR ANALYTICS =================//
Where the magic starts to happen. The goals of the project are to merge the 2 separate environments of Google Ads (where prospective audiences become MQLs by clicking an Ad) and HubSpot where MQL's can become SQLs if they pass initial validation based on whether their nationality is Sales Accepted or and Unsupported Territory. Unsupported Territory MQLs are immediately filtered and no Deal is ever created for them in HubSpot. (NOTE: The MQLs that are lost prior to ever enter the SQL Pipeline are referred to here collectively as "Burn Rate" & explored in more detail in /home/hub/public_html/gads/scripts/analytics/burn-rate.html)

/home/hub/public_html/gads/scripts/analytics/dashboard-server.js:  Dashboard Server - HTML Template & React Setup

/home/hub/public_html/gads/scripts/analytics/dashboard.js
- Google Ads Dashboard - Real HubSpot Data from MySQL
 * UPDATED: Now displays Campaign ID, Campaign Name, and AdGroup

/home/hub/public_html/gads/scripts/analytics/hubspot-data.js
 * HubSpot Dashboard Data API
 * Pulls real data from synced MySQL HubSpot tables
 * Uses country reference file for territory classifications

/home/hub/public_html/gads/scripts/analytics/pipeline-probs.js
* Pulls data & calculates 2 pipeline probabilities
1) "Stage Loss": what is the probability that Deal will NOT progress beyond Stage 'x'
2) "Completion Probability": At any given stage what is the probability of that Deal of successful pipeline completion, ie: WON 

/home/hub/public_html/gads/scripts/analytics/pipeline-server.js
 * Fast Pipeline Data API - MySQL Powered
 * /scripts/analytics/fast-pipeline-data.js
 * Lightning-fast queries using your Google Ads records + HubSpot data

/home/hub/public_html/gads/scripts/analytics/pipeline-analysis.html
* REACT Dashboard showing both MQL & SQL pathways as one complete pipeline
* "Refresh Probabilities" button calls pipeline-probs.js when needed (significant data crunching & marginal differences over time meant it was not required to run that every time the Pipeline Dashboard loaded

/home/hub/public_html/gads/scripts/analytics/burn-rate.html
* Measures the number & percentage of Unsupported Territory Contacts (ie: those MQLs who clicked and Ad, performed the CTA (Webform Submission / Live Chat Click etc) but failed SQL validation due in the main to their passport nationality not being an Unsupported Territory

NOTE: /home/hub/public_html/gads/scripts/country/load-countries.js calls upon /home/hub/public_html/gads/scripts/country/load-countries.js which houses a complete list of countries and their corresponding Territory. 
Territories are categorized thus: EU / NonEU(Visa on Arrival) / Non-EU(VisaBeforeDeparture) / Unsupported Territory