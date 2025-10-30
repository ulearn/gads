That frustration makes perfect sense.
You’re trying to get to the point where your code-gen assistant behaves like an **engineer that “auto-reads the manual”** for any API before touching it — not a parrot that guesses syntax from old memory.

Here’s how you can actually build that capacity in a reusable way 👇

---

## 🧩 1. Separate “API learning” from “API doing”

Give the assistant a **two-step protocol**:

1️⃣ *Discovery / Schema phase* – it asks:

> “What endpoints, methods, and field names exist here?”

2️⃣ *Execution phase* – only after it knows the vocabulary.

That mirrors how humans code: you don’t write calls until you’ve looked at the OpenAPI spec or introspected the client library.

---

## ⚙️ 2. Implement a “Universal API Introspector”

Create a script that can automatically *inspect* any modern API before you use it.

```js
// introspect-api.js
import axios from "axios";

export async function getApiSpec(urlOrBase) {
  const candidates = [
    `${urlOrBase}/openapi.json`,
    `${urlOrBase}/swagger.json`,
    `${urlOrBase}/openapi.yaml`,
  ];
  for (const u of candidates) {
    try {
      const res = await axios.get(u, { timeout: 8000 });
      return { source: u, spec: res.data };
    } catch {}
  }
  return null;
}
```

If that returns something, you now have the entire **OpenAPI schema** — method names, paths, request/response types — as JSON.
Store it locally (e.g., `/flawed-cache/googleads-openapi.json`) and let your generator read from that instead of hallucinating.

---

## 🔍 3. For APIs without schemas (like Google Ads)

Some APIs don’t expose OpenAPI specs; they publish **client stubs and protobufs** instead.
You can still auto-map them:

1. Clone their official client library (e.g. `google-ads-node`).

2. Parse its TypeScript definitions or `.proto` files.

   ```bash
   npm install ts-morph
   ```

   Then read exported service names and methods — your “schema”.

3. Cache that vocabulary.
   Claude Code (or any generator) can now query your local cache:

   ```json
   {
     "AssetService": ["mutateAssets", "listAssets"],
     "CampaignService": ["mutateCampaigns", "getCampaign"]
   }
   ```

Now the model can see *valid field names, camelCase keys,* etc.

---

## 🧠 4. Teach the assistant the **heuristic**

Add a Markdown boilerplate (the “RTFM protocol”) that every generated environment includes:

> ### API Access Protocol
>
> 1. Run `/introspect` on the base URL or local schema.
> 2. Cache discovered endpoints + parameters.
> 3. When coding, autocomplete only from cached schema.
> 4. On 4XX errors, retry with camelCase and snake_case variations before failing.
> 5. Log successful mutations to `/api-success.log`.

That gives it a **reflex** — always learn before doing, always retry format variations.

---

## 🧩 5. Optionally: central “Knowledge registry”

Host a small JSON registry like:

```
/API-knowledge/google-ads.json
/API-knowledge/hubspot.json
/API-knowledge/xero.json
```

Each file contains the known quirks:

```json
{
  "base": "https://googleads.googleapis.com/v15",
  "auth": "OAuth2",
  "camelCase": true,
  "deleteMethod": "mutate<AssetType>",
  "docs": "https://developers.google.com/google-ads/api/reference/rpc"
}
```

When the generator detects `Google Ads`, it loads this “profile” first.

---

## 🪄 6. Use `axios` + schema + type generator

If you feed an OpenAPI JSON into [openapi-typescript](https://github.com/drwpow/openapi-typescript):

```bash
npx openapi-typescript googleads-openapi.json -o googleads.d.ts
```

Now your environment has **strong types + autocomplete**, which stops 90% of “fail, fail, fail” issues like the camelCase one.

---

## 🔁 7. Loop this into Claude Code

* Put the introspector + registry + fetcher utilities in the “flawed docs” folder.
* Add one Markdown file that literally says:

> “Before calling any API, run `introspect-api` or load `/API-knowledge/<api>.json`. Use those results to construct valid requests.”

Now every time you prompt it to “interact with API X”, it executes the same discovery logic first.

---

## ⚙️ 8. Bonus: sandbox fallback

If the environment has no outbound access, pre-populate the `/API-knowledge` folder with downloaded docs/specs so the assistant can still reason offline.

---

### 🧭 TL;DR

You can make Claude Code (or any generator) “clever with APIs” by giving it:

1. A **universal introspector** (fetches OpenAPI/specs).
2. A **registry of known quirks** for key APIs (Google Ads, HubSpot, Xero).
3. A **boilerplate heuristic**: *learn schema → cache → call → retry → log.*

That way, it stops guessing field names and starts reasoning like a seasoned API client.

---

If you want, I can give you a ready-to-drop `/flawed-api-utils/` bundle that includes:

* `fetcher.js`
* `introspect-api.js`
* sample `/API-knowledge/google-ads.json`
* Markdown “RTFM Protocol”

Would you like me to output that package next?
