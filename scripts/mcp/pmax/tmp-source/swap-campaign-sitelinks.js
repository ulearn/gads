const { GoogleAdsApi } = require('google-ads-api');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const googleAdsClient = new GoogleAdsApi({
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  developer_token: process.env.GAdsAPI
});

const account_id = '1051706978';
const customer = googleAdsClient.Customer({
  customer_id: account_id,
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  login_customer_id: process.env.GADS_LIVE_MCC_ID
});

const CAMPAIGN_ID = '23202585091'; // PMax-Brazil-POR

// Portuguese sitelinks to add
const PORTUGUESE_SITELINKS = [
  '303989862357', // "Preços e Cursos"
  '303989859696', // "Trabalhe e Estude"
  '303989848446', // "Visto para Irlanda"
  '303880758608', // "Inscreva-se Agora"
  '303880738943'  // "Acomodação Garantida"
];

async function querySitelinks() {
  const query = `
    SELECT
      campaign.id,
      campaign_asset.resource_name,
      campaign_asset.status,
      asset.id,
      asset.sitelink_asset.link_text
    FROM campaign_asset
    WHERE campaign.id = ${CAMPAIGN_ID}
    AND campaign_asset.field_type = SITELINK
    AND campaign_asset.status = ENABLED
  `;

  return await customer.query(query);
}

async function swapSitelinks() {
  console.log('\n' + '='.repeat(70));
  console.log('SEQUENTIAL SITELINK SWAP - PMax-Brazil-POR');
  console.log('='.repeat(70));

  // Step 1: Query current sitelinks
  const currentSitelinks = await querySitelinks();
  console.log(`\nCurrent state: ${currentSitelinks.length}/20 sitelinks (at max)`);

  // Identify non-Portuguese sitelinks to remove
  const nonPortugueseSitelinks = currentSitelinks.filter(s =>
    !PORTUGUESE_SITELINKS.includes(s.asset.id.toString())
  );

  const portuguesePresent = currentSitelinks.filter(s =>
    PORTUGUESE_SITELINKS.includes(s.asset.id.toString())
  );

  console.log(`  Portuguese present: ${portuguesePresent.length}`);
  console.log(`  Non-Portuguese: ${nonPortugueseSitelinks.length}`);
  console.log(`  Portuguese to add: ${PORTUGUESE_SITELINKS.length - portuguesePresent.length}`);

  if (nonPortugueseSitelinks.length === 0) {
    console.log('\n✅ All sitelinks are already Portuguese!');
    return true;
  }

  // Step 2: Sequential swap (1-for-1 to maintain 20/20)
  console.log(`\n${'='.repeat(70)}`);
  console.log('PERFORMING 1-FOR-1 SWAPS');
  console.log('='.repeat(70));

  const swapCount = Math.min(PORTUGUESE_SITELINKS.length, nonPortugueseSitelinks.length);

  for (let i = 0; i < swapCount; i++) {
    const oldSitelink = nonPortugueseSitelinks[i];
    const newAssetId = PORTUGUESE_SITELINKS[i];

    console.log(`\nSwap ${i + 1}/${swapCount}:`);
    console.log(`  Remove: ${oldSitelink.asset.id} - "${oldSitelink.asset.sitelink_asset.link_text}"`);
    console.log(`  Add: ${newAssetId}`);

    // Remove old sitelink
    try {
      await customer.campaignAssets.remove([oldSitelink.campaign_asset.resource_name]);
      console.log(`  ✅ Removed`);
    } catch (error) {
      console.error(`  ❌ Remove failed:`, error.message);
      if (error.errors) {
        error.errors.forEach(err => console.error(`     ${err.message}`));
      }
      continue;
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    // Add Portuguese sitelink
    const createOp = {
      campaign: `customers/${account_id}/campaigns/${CAMPAIGN_ID}`,
      asset: `customers/${account_id}/assets/${newAssetId}`,
      field_type: 'SITELINK'
    };

    try {
      await customer.campaignAssets.create([createOp]);
      console.log(`  ✅ Added`);
    } catch (error) {
      console.error(`  ❌ Add failed:`, error.message);
      if (error.errors) {
        error.errors.forEach(err => console.error(`     ${err.message}`));
      }

      // Try to roll back - add old one back
      const rollback = {
        campaign: `customers/${account_id}/campaigns/${CAMPAIGN_ID}`,
        asset: `customers/${account_id}/assets/${oldSitelink.asset.id}`,
        field_type: 'SITELINK'
      };

      try {
        await customer.campaignAssets.create([rollback]);
        console.log(`  ⚠️  Rolled back`);
      } catch (rollbackError) {
        console.error(`  ❌ Rollback also failed!`);
      }

      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n✅ Sequential swap completed!`);
  return true;
}

async function verifyFinal() {
  console.log('\n' + '='.repeat(70));
  console.log('FINAL VERIFICATION');
  console.log('='.repeat(70));

  const finalSitelinks = await querySitelinks();
  console.log(`\nTotal sitelinks: ${finalSitelinks.length}/20\n`);

  const portugueseSitelinks = finalSitelinks.filter(s =>
    PORTUGUESE_SITELINKS.includes(s.asset.id.toString())
  );

  const nonPortugueseSitelinks = finalSitelinks.filter(s =>
    !PORTUGUESE_SITELINKS.includes(s.asset.id.toString())
  );

  console.log('Portuguese sitelinks:');
  portugueseSitelinks.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.asset.id} - "${s.asset.sitelink_asset.link_text}"`);
  });

  if (nonPortugueseSitelinks.length > 0) {
    console.log(`\nRemaining non-Portuguese: ${nonPortugueseSitelinks.length}`);
    nonPortugueseSitelinks.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.asset.id} - "${s.asset.sitelink_asset.link_text}"`);
    });
  }

  console.log('\n' + '='.repeat(70));
  if (portugueseSitelinks.length === PORTUGUESE_SITELINKS.length) {
    console.log(`✅ SUCCESS: ${portugueseSitelinks.length}/${PORTUGUESE_SITELINKS.length} Portuguese sitelinks active!`);
  } else {
    console.log(`⚠️  ${portugueseSitelinks.length}/${PORTUGUESE_SITELINKS.length} Portuguese sitelinks (partial)`);
  }
  console.log('='.repeat(70));
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('SWAP CAMPAIGN SITELINKS TO PORTUGUESE');
  console.log('Strategy: 1-for-1 swap to maintain 20/20 limit');
  console.log('='.repeat(70));

  const success = await swapSitelinks();

  if (success) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    await verifyFinal();
  }
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
