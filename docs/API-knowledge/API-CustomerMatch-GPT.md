🧩 Step-by-step endpoint chain
1️⃣ Create an Offline User Data Job

Endpoint:

POST https://googleads.googleapis.com/v16/customers/{CUSTOMER_ID}/offlineUserDataJobs


Body:

{
  "type": "CUSTOMER_MATCH_USER_LIST",
  "customerMatchUserListMetadata": {
    "userList": "customers/{CUSTOMER_ID}/userLists/{USER_LIST_ID}"
  }
}


This returns a resourceName such as:

"customers/1234567890/offlineUserDataJobs/999999999"

2️⃣ Add members (hashed emails, phones, etc.)

Endpoint:

POST https://googleads.googleapis.com/v16/{OFFLINE_USER_DATA_JOB_RESOURCE}:addOperations


(Replace {OFFLINE_USER_DATA_JOB_RESOURCE} with the full path returned above.)

Body:

{
  "enablePartialFailure": true,
  "operations": [
    {
      "create": {
        "userIdentifiers": [
          { "hashedEmail": "5f2e4e5b8c..." },
          { "hashedPhoneNumber": "9c9ad3f45a..." }
        ]
      }
    }
  ]
}


Headers:

Authorization: Bearer {ACCESS_TOKEN}
developer-token: {DEV_TOKEN}
Content-Type: application/json

3️⃣ Run the job

Endpoint:

POST https://googleads.googleapis.com/v16/{OFFLINE_USER_DATA_JOB_RESOURCE}:run


Body can be empty ({}).

This starts processing the upload asynchronously.
You can then check job status (optional):

GET https://googleads.googleapis.com/v16/{OFFLINE_USER_DATA_JOB_RESOURCE}

⚙️ Required headers for every call
Authorization: Bearer {ACCESS_TOKEN}
developer-token: {DEV_TOKEN}
login-customer-id: {MCC_ID_IF_APPLICABLE}
Content-Type: application/json

🧭 Typical resource example

If your customer ID is 1234567890 and your user list ID is 9242598255, your calls would look like:

POST https://googleads.googleapis.com/v16/customers/1234567890/offlineUserDataJobs
→ returns "customers/1234567890/offlineUserDataJobs/111111111"

POST https://googleads.googleapis.com/v16/customers/1234567890/offlineUserDataJobs/111111111:addOperations
POST https://googleads.googleapis.com/v16/customers/1234567890/offlineUserDataJobs/111111111:run


Would you like me to show you the exact Node.js REST script (axios-based) that performs those three steps automatically — using your .env values for credentials and hashing emails before upload?