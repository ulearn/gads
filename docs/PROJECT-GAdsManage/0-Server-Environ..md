//==================================================================//
//============ SERVER & ENVIRONMENTS ===============================//
//==================================================================//

ENVIRONMENT: Shared VPS (no root & no sudo) | NodeJS environments on Phusion Passenger | Extensive use of HubSpot & Google Ads APIs | Local MySql storage of both HubSpot & Google Ads data | REACT used for dashboard displays

READ ONLY!!! DO NOT WRITE TO THE GITHUB REPO!!
Read Only GitHub Repo: https://github.com/ulearn/gads
- You will only review the branch "claude"
- During testing & patching you will output all code updates only to the Artifacts
- You can view the Repo as required - DO NOT COMMIT OR EDIT THE GITHUB REPOSITORY unless explicitly instructed to do so
- Never access the master branch - only the claude branch 
- AND TO BE EXPLICIT - NEVER OVERWRITE OR PUSH CHANGE TO MASTER (again unless there's some VERY UNUSUAL SITUATION and I explicitly tell you to do so)


INDEX & .ENV VARIABLES
Index: /home/hub/public_html/gads/index.js
- Stores routes/endpoints/authorization
- No business logic in the index!! 
- All business logic is stored in the script files stored in: /home/hub/public_html/gads/scripts/

.env FILE: /home/hub/public_html/gads/.env

MySql Database
See Schema: hub-gads-structure_09.08.2025.sql

APIs & MySql
Although API access to both platforms is extensive Reporting over flexible date ranges proved slow & inefficient. A decision was reached to create a local MySql database (hub_gads) with its schema echoing HubSpot CRM data objects and fields, with nearly all Contacts and Deals fields synced to hub_contacts and hub_deals. Tables were likewise created to store the significant historical Google Ads API data (nearly 20 years with data from 2015 currently in MySql storage)  

Business Logic 
Project is assembled by platform and function in /home/hub/public_html/gads/scripts subfolders (see architecture). I'll outline some of the key files here.


Folder Architecture: 
[hub@server gads]$ find /home/hub/public_html/gads -not -path "/.git" -not -path "/node_modules" | sed -e 's|[^/]*/|- |g' -e 's|^- ||'
- - - gads
- - - - index.js
- - - - logger.js
- - - - gads.log
- - - - tmp
- - - - - restart.txt
- - - - gads_history.log
- - - - package-lock.json
- - - - db-test.js
- - - - scripts
- - - - - google
- - - - - - gads-sync.js
- - - - - - budget.js
- - - - - - debug-account.js
- - - - - - gads-test.js
- - - - - - campaign.js
- - - - - update-mysql-campaigns.js
- - - - - country
- - - - - - country-codes.json
- - - - - - load-countries.js
- - - - - analytics
- - - - - - pipeline-probs.js
- - - - - - pipeline-server.js
- - - - - - budget.js
- - - - - - territory.js.bak
- - - - - - burn.js
- - - - - - dashboard.js
- - - - - - dashboard-server.js
- - - - - - pipeline-analysis.html
- - - - - - burn-rate.html
- - - - - - hubspot-data.js
- - - - - hubspot
- - - - - - samples
- - - - - - - contact-347587358941-export.json
- - - - - - - contact-159714487541-export.json
- - - - - - - new-sample.json
- - - - - - - contact-393847317739-export.json
- - - - - - - contact-394450632948-export.json
- - - - - - hubspot-sync.js
- - - - - - fieldmap.js
- - - - - - status.js
- - - - - - hubspot-test.js
- - - - - models
- - - - - - hub-contact.js
- - - - - - hub-country.js
- - - - - - hub-deal.js
- - - - - - hub-pipeline.js
- - - - - campaigns.json
- - - - .env
- - - - public
- - - - .htaccess
- - - - package.json