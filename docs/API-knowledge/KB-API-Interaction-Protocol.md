Yeah — totally get it.
Google Ads is *brutal* because it’s **not REST** like HubSpot — it’s gRPC over Protobuf, so everything is wrapped in service calls (`mutateCampaignAssets`, `searchStream`, etc.) rather than simple `GET /campaigns`. Claude keeps tripping because it expects REST semantics that just aren’t there.

Let’s answer both your points clearly 👇

---

## 🧩 1️⃣ How can such a small OpenAPI file describe everything?

That snippet I showed earlier was just an **example fragment** — a real one can be **hundreds or thousands of lines** long.

An OpenAPI file is basically a **map of the entire API** in JSON/YAML form.
Here’s how it works under the hood:

```yaml
openapi: 3.1.0
info:
  title: Example API
  version: 1.0.0
servers:
  - url: https://api.example.com/v1
paths:
  /users:
    get:
      summary: List users
      parameters:
        - name: limit
          in: query
          schema: { type: integer }
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserList"
components:
  schemas:
    UserList:
      type: array
      items:
        $ref: "#/components/schemas/User"
    User:
      type: object
      properties:
        id: { type: string }
        name: { type: string }
```

So:

* **`paths`** defines every endpoint (`/users`, `/campaigns`, `/ads`).
* **`parameters`** defines query/path fields.
* **`schemas`** defines the JSON body structure.
* **`responses`** defines what comes back.

Once that exists, any tool or LLM can *walk* the document and automatically know:

* which HTTP verbs are allowed,
* what fields to send,
* what data types to expect,
* what errors might occur.

That’s why OpenAPI specs are gold — they let code generators and models act intelligently instead of guessing.

---

## 🧠 2️⃣ Why Google Ads is so hard

Google Ads is **not an OpenAPI** — it’s a **gRPC service** defined in `.proto` files.
That means:

* Endpoints aren’t simple `/v15/campaigns`.
* You must call methods like `CampaignService.mutateCampaigns()` with encoded payloads.
* Even deleting a SiteLink is a `mutateAssetSetAssets` call with an operation `remove: "customers/.../assetSetAssets/..."` — not intuitive until you see the proto.

Claude Code isn’t great at discovering those method names or understanding that `remove` must be camelCase inside a `mutate` operation. It’s blind without the `.proto` schema.

So, the workaround is to **preload the protobuf metadata** (or a JSON summary of it) into your Claude Docs so it has the correct “vocabulary.”

---

## 🪄 3️⃣ Here’s your **Markdown preamble**

Paste this at the top of your Claude Docs (works as your universal “RTFM protocol”):

---

### 🧭 API Interaction Protocol (Claude Docs Standard)

**Goal:** Before calling any API, Claude must *learn the schema first*, not guess.

1. **Discover the Schema**

   * Try to fetch an OpenAPI spec (`/openapi.json`, `/swagger.json`, etc.).
   * If not available (e.g. Google Ads, YouTube, Gmail), load the API profile from `/API-knowledge/{service}.json` or `.proto` definitions.

2. **Cache Endpoints & Fields**

   * Record valid endpoint paths, HTTP verbs, and field names (respect camelCase).
   * Use this vocabulary for all requests.

3. **Construct Requests Intelligently**

   * Use `axios` or built-in `fetch`.
   * Send structured JSON following the cached schema.
   * Retry failed requests with alternate casing (`camelCase`, `snake_case`) if the 400 error suggests a bad field name.

4. **Handle Google Ads APIs**

   * Use service calls (e.g. `CampaignService.mutateCampaigns`).
   * Operations: `create`, `update`, `remove`.
   * Resource names follow: `customers/{customer_id}/{resource_type}/{resource_id}`.
   * Always authenticate via OAuth2; set `developer-token` header.

5. **Log Everything**

   * Log every successful mutation to `/api-success.log`.
   * Log schema and request errors separately for quick debugging.

6. **Never Guess Syntax**

   * Always derive syntax from schema or client library.
   * Use “Describe this service” pattern before writing calls.

---

Would you like me to generate the `/API-knowledge/google-ads.json` starter file next (with all the core service names, resource formats, and operation structures)? That would let Claude Code “know the language” of Google Ads before it ever tries to delete another SiteLink again.


RTFM Protocol
In your RTFM Protocol or Claude Docs intro, add:

// Load Google Ads schema profile
import fs from "fs";
const googleAds = JSON.parse(fs.readFileSync("./API-knowledge/google-ads.json", "utf8"));

// Example: delete a site link
const { services, meta } = googleAds;
const url = `${meta.base}/customers/${CUSTOMER_ID}/assetSetAssets:mutate`;
const req = { operations: [{ remove: `customers/${CUSTOMER_ID}/assetSetAssets/${ASSET_ID}` }] };

await axios.post(url, req, { headers: meta.headers });

🧭 Overview — Performance Max Object Graph
Customer
 └── Campaign  (status, name, budget, biddingStrategy)
      ├── AssetGroup
      │     ├── AssetGroupAsset        ← creatives (headlines, images, videos)
      │     ├── AssetGroupSignal       ← audiences / demographics
      │     └── AssetGroupListingGroupFilter (for Shopping)
      └── AssetSet
            └── AssetSetAsset          ← site-links, callouts, price assets


All of them are created and modified through mutate services using
create, update, or remove operations.


✅ How to use inside google-ads-pmax.json Claude Docs / Claude Code
const pmax = JSON.parse(fs.readFileSync("./API-knowledge/google-ads-pmax.json","utf8"));
const base = pmax.meta.base;

// Example: clone a P-Max Asset Group headline
const url = `${base}/customers/${CID}/assetGroupAssets:mutate`;
const req = { operations: [{ create: {
  assetGroup: `customers/${CID}/assetGroups/${AGID}`,
  asset: `customers/${CID}/assets/${ASSETID}`,
  fieldType: "HEADLINE"
}}]};
await axios.post(url, req, { headers: meta.headers });

