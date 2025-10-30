🛠 Node.js Setup + Sample Syntax
Here’s a skeleton of how you might do this in Node.js (using the official Google Ads API client library for Node) for key asset types. You’ll need to adapt campaign/ad group linking according to your PMax setup.
Setup
// Install: npm install google-ads-api
const { GoogleAdsApi } = require('google-ads-api');

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

const customer = client.Customer({
  customer_id: '<YOUR_CUSTOMER_ID>',
  login_customer_id: '<MANAGER_ACCOUNT_ID>', // if required
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
});

Create a Text Asset (Headline or Description)
async function createTextAsset(text) {
  const assetOperation = {
    create: {
      name: `Headline or desc – ${Date.now()}`,
      type: 'TEXT',
      textAsset: {
        text: text
      }
    }
  };

  const response = await customer.assetService.mutateAssets({
    customer_id: customer.customer_id,
    operations: [assetOperation]
  });

  return response.results[0].resource_name; // e.g., "customers/123/assets/456"
}

Create an Image Asset
const fs = require('fs');
async function createImageAsset(imageFilePath) {
  const imageData = fs.readFileSync(imageFilePath).toString('base64'); // encode to base64

  const assetOperation = {
    create: {
      name: `Image Asset – ${Date.now()}`,
      type: 'IMAGE',
      imageAsset: {
        data: imageData
      }
    }
  };

  const response = await customer.assetService.mutateAssets({
    customer_id: customer.customer_id,
    operations: [assetOperation]
  });

  return response.results[0].resource_name;
}

Link an Asset to a Campaign (CampaignAsset)
async function linkAssetToCampaign(campaignId, assetResourceName) {
  const campaignAssetOperation = {
    create: {
      campaign: `customers/${customer.customer_id}/campaigns/${campaignId}`,
      asset: assetResourceName,
      field_type: 'HEADLINE', // or other, depends on how you’re using the asset
      // you could set enable/disable scheduling etc, based on support
    }
  };

  const response = await customer.campaignAssetService.mutateCampaignAssets({
    customer_id: customer.customer_id,
    operations: [campaignAssetOperation]
  });

  return response.results[0].resource_name;
}

Example: Create several assets and link to a PMax asset group
With PMax you’ll often create an “AssetGroup” (via AssetGroupService) and then link assets to it via AssetGroupAsset operations. For example:
async function createAssetGroup(campaignId, assetGroupName) {
  const op = {
    create: {
      campaign: `customers/${customer.customer_id}/campaigns/${campaignId}`,
      assetGroupName: assetGroupName,
      // set other required asset group settings: final_urls, audience signals etc.
    }
  };
  const resp = await customer.assetGroupService.mutateAssetGroups({
    customer_id: customer.customer_id,
    operations: [op]
  });
  return resp.results[0].resource_name;
}

async function linkAssetToAssetGroup(assetGroupResourceName, assetResourceName, fieldType) {
  const op = {
    create: {
      assetGroup: assetGroupResourceName,
      asset: assetResourceName,
      field_type: fieldType // e.g., HEADLINE, DESCRIPTION, IMAGE, YOUTUBE_VIDEO…
    }
  };
  const resp = await customer.assetGroupAssetService.mutateAssetGroupAssets({
    customer_id: customer.customer_id,
    operations: [op]
  });
  return resp.results[0].resource_name;
}

Example of putting it together
(async () => {
  const campaignId = 1234567890;
  const assetGroupName = 'My PMax AssetGroup – ' + Date.now();

  const assetGroup = await createAssetGroup(campaignId, assetGroupName);

  const headlineAsset = await createTextAsset('Great Deal Today');
  await linkAssetToAssetGroup(assetGroup, headlineAsset, 'HEADLINE');

  const imgAsset = await createImageAsset('./path/to/image.jpg');
  await linkAssetToAssetGroup(assetGroup, imgAsset, 'IMAGE');

  // … add description, video, price, promotion, etc likewise.

  console.log('Asset group created and assets linked:', assetGroup);
})();


📌 On your specific issue: “cannot remove existing site links”


If you’re trying to delete a site link asset completely: you can’t. The API does not support remove for the asset itself. You can only unlink it or stop using it. Google for Developers+1


If you’re using older “extension” style constructs: some linking/unlinking might still go through the older “Extension” API rather than “Asset” API. Ensure you’re using the “Asset/AssetSet/CampaignAsset/CampaignAssetSet” model.


Check you’re using the correct “field_type” when linking. If you mis-use field_type the system may reject the change.


Monitor the “source” of the asset: if it’s “AUTOMATICALLY_CREATED”, you may have less control. Google for Developers+1



🔍 Summary


Yes — you can create nearly all standard asset types via the Google Ads API for a PMax campaign.


But you cannot fully “remove” an asset once created — you must unlink/stop-serving it.


For Node.js you’ll use assetService.mutateAssets, then link via campaignAssetService or for PMax assetGroupAssetService.


Test linking/unlinking carefully for your specific asset types (sitelinks, callouts, etc) and ensure you’re using the correct services/field_types.



If you like, I can generate a full workbook of all the supported asset types (text, images, video, sitelink, price, promotion, etc) with Node.js code samples for each, tailored for Performance Max campaigns. Would you like me to do that?
