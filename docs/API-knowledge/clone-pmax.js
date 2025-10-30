// Clone a Performance-Max campaign (minimal pattern)
// Requires: axios, ./API-knowledge/google-ads.json, ./API-knowledge/google-ads-pmax.json

import fs from "fs";
import axios from "axios";

const ads = JSON.parse(fs.readFileSync("./API-knowledge/google-ads.json","utf8"));
const pmax = JSON.parse(fs.readFileSync("./API-knowledge/google-ads-pmax.json","utf8"));
const base  = ads.meta.base;
const headers = {
  ...ads.meta.headers,
  "Content-Type": "application/json"
};

/**
 * clonePMax
 * @param {string} customerId
 * @param {string} sourceCampaignId
 * @param {string} newName
 */
export async function clonePMax(customerId, sourceCampaignId, newName) {
  const cid = `customers/${customerId}`;

  // 1️⃣ Get original campaign metrics + fields
  const query = `SELECT campaign.id, campaign.name, campaign_budget.amount_micros, campaign.resource_name FROM campaign WHERE campaign.id = ${sourceCampaignId}`;
  const { data: stream } = await axios.post(
    `${base}/${cid}/googleAds:searchStream`,
    { query },
    { headers }
  );
  const original = stream.results?.[0]?.campaign || stream[0]?.results[0]?.campaign;
  if (!original) throw new Error("Source campaign not found");

  // 2️⃣ Create new campaign (copying basic properties)
  const createCampaignReq = {
    operations: [{
      create: {
        name: newName,
        advertisingChannelType: "PERFORMANCE_MAX",
        status: "PAUSED",
        campaignBudget: original.campaignBudget,
        biddingStrategyType: "MAXIMIZE_CONVERSIONS"
      }
    }]
  };
  const campRes = await axios.post(`${base}/${cid}/campaigns:mutate`, createCampaignReq, { headers });
  const newCampaign = campRes.data.results[0].resourceName;
  console.log("✅ New campaign:", newCampaign);

  // 3️⃣ Get AssetGroups from old campaign
  const agQuery = `SELECT asset_group.id, asset_group.resource_name, asset_group.name, asset_group.final_urls FROM asset_group WHERE asset_group.campaign.id = ${sourceCampaignId}`;
  const { data: agStream } = await axios.post(`${base}/${cid}/googleAds:searchStream`, { query: agQuery }, { headers });
  const groups = agStream.flatMap(c => c.results.map(r => r.assetGroup));
  console.log(`Found ${groups.length} asset groups`);

  for (const g of groups) {
    // 4️⃣ Create new AssetGroup under new campaign
    const agReq = {
      operations: [{
        create: {
          campaign: newCampaign,
          name: `${g.name} copy`,
          finalUrls: g.finalUrls,
          path1: "learn",
          path2: "english"
        }
      }]
    };
    const { data: agRes } = await axios.post(`${base}/${cid}/assetGroups:mutate`, agReq, { headers });
    const newAg = agRes.results[0].resourceName;
    console.log("  ↳ new AssetGroup:", newAg);

    // 5️⃣ Copy creative assets (headlines, images, etc.)
    const assetQuery = `SELECT asset_group_asset.asset, asset_group_asset.field_type FROM asset_group_asset WHERE asset_group.id = ${g.id}`;
    const { data: assetStream } = await axios.post(`${base}/${cid}/googleAds:searchStream`, { query: assetQuery }, { headers });
    const assets = assetStream.flatMap(c => c.results.map(r => r.assetGroupAsset));
    for (const a of assets) {
      const req = {
        operations: [{
          create: {
            assetGroup: newAg,
            asset: a.asset,
            fieldType: a.fieldType
          }
        }]
      };
      await axios.post(`${base}/${cid}/assetGroupAssets:mutate`, req, { headers });
    }
  }

  // 6️⃣ Copy Site-links (AssetSetAssets)
  const slQuery = `SELECT asset_set_asset.asset, asset_set_asset.asset_set FROM asset_set_asset WHERE asset_set.type = SITE_LINK`;
  const { data: slStream } = await axios.post(`${base}/${cid}/googleAds:searchStream`, { query: slQuery }, { headers });
  const siteLinks = slStream.flatMap(c => c.results.map(r => r.assetSetAsset));
  for (const s of siteLinks) {
    const req = {
      operations: [{
        create: {
          asset: s.asset,
          assetSet: s.assetSet
        }
      }]
    };
    await axios.post(`${base}/${cid}/assetSetAssets:mutate`, req, { headers });
  }

  console.log("✅ Clone complete");
}
