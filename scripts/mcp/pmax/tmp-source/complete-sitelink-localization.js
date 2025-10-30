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

// ALL 20 Portuguese sitelinks (first 5 already linked + 15 new)
const ALL_PORTUGUESE_SITELINKS = [
  // First 5 (already active)
  '303989862357', // "Preços e Cursos"
  '303989859696', // "Trabalhe e Estude"
  '303989848446', // "Visto para Irlanda"
  '303880758608', // "Inscreva-se Agora"
  '303880738943', // "Acomodação Garantida"

  // Next 15 (to be added)
  '303889839725', // "Cursos de 2025"
  '303889878698', // "Preparação para Exames"
  '303889878860', // "Localização Central"
  '303999778032', // "Eventos Sociais"
  '303975241903', // "Turmas Pequenas"
  '303889879856', // "WiFi Grátis"
  '303889823606', // "Experiência de 35 Anos"
  '303975238597', // "Suporte em Português"
  '303975239614', // "Casas de Família"
  '303999778635', // "Apartamentos Estudantis"
  '303889842197', // "Inglês para Negócios"
  '303889886060', // "Todos os Níveis"
  '303975254782', // "Depoimentos"
  '303889884035', // "Vida em Dublin"
  '303999822390'  // "Fale Conosco"
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

async function completeLocalization() {
  console.log('\n' + '='.repeat(70));
  console.log('COMPLETE SITELINK LOCALIZATION - 20/20 PORTUGUESE');
  console.log('='.repeat(70));

  // Step 1: Query current sitelinks
  const currentSitelinks = await querySitelinks();
  console.log(`\nCurrent state: ${currentSitelinks.length}/20 sitelinks`);

  // Identify what needs to be swapped
  const portuguesePresent = currentSitelinks.filter(s =>
    ALL_PORTUGUESE_SITELINKS.includes(s.asset.id.toString())
  );

  const nonPortuguese = currentSitelinks.filter(s =>
    !ALL_PORTUGUESE_SITELINKS.includes(s.asset.id.toString())
  );

  const portuguesePresentIds = portuguesePresent.map(s => s.asset.id.toString());
  const portugueseMissing = ALL_PORTUGUESE_SITELINKS.filter(id =>
    !portuguesePresentIds.includes(id)
  );

  console.log(`  Portuguese present: ${portuguesePresent.length}`);
  console.log(`  Non-Portuguese: ${nonPortuguese.length}`);
  console.log(`  Portuguese to add: ${portugueseMissing.length}`);

  if (nonPortuguese.length === 0) {
    console.log('\n✅ All 20 sitelinks are already Portuguese!');
    return true;
  }

  // Step 2: Sequential swap
  console.log(`\n${'='.repeat(70)}`);
  console.log('PERFORMING SEQUENTIAL SWAPS');
  console.log('='.repeat(70));

  const swapCount = Math.min(portugueseMissing.length, nonPortuguese.length);
  let successCount = 0;

  for (let i = 0; i < swapCount; i++) {
    const oldSitelink = nonPortuguese[i];
    const newAssetId = portugueseMissing[i];

    console.log(`\nSwap ${i + 1}/${swapCount}:`);
    console.log(`  Remove: ${oldSitelink.asset.id} - "${oldSitelink.asset.sitelink_asset.link_text}"`);
    console.log(`  Add: ${newAssetId}`);

    // Remove old sitelink
    try {
      await customer.campaignAssets.remove([oldSitelink.campaign_asset.resource_name]);
      console.log(`  ✅ Removed`);
    } catch (error) {
      console.error(`  ❌ Remove failed:`, error.message);
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
      successCount++;
    } catch (error) {
      console.error(`  ❌ Add failed:`, error.message);

      // Try to roll back
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
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n✅ Completed ${successCount}/${swapCount} swaps`);
  return successCount === swapCount;
}

async function verifyFinal() {
  console.log('\n' + '='.repeat(70));
  console.log('FINAL VERIFICATION');
  console.log('='.repeat(70));

  const finalSitelinks = await querySitelinks();
  console.log(`\nTotal sitelinks: ${finalSitelinks.length}/20\n`);

  const portuguese = finalSitelinks.filter(s =>
    ALL_PORTUGUESE_SITELINKS.includes(s.asset.id.toString())
  );

  const nonPortuguese = finalSitelinks.filter(s =>
    !ALL_PORTUGUESE_SITELINKS.includes(s.asset.id.toString())
  );

  console.log(`Portuguese sitelinks: ${portuguese.length}/20`);
  portuguese.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.asset.id} - "${s.asset.sitelink_asset.link_text}"`);
  });

  if (nonPortuguese.length > 0) {
    console.log(`\nRemaining non-Portuguese: ${nonPortuguese.length}`);
    nonPortuguese.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.asset.id} - "${s.asset.sitelink_asset.link_text}"`);
    });
  }

  console.log('\n' + '='.repeat(70));
  if (portuguese.length === 20 && nonPortuguese.length === 0) {
    console.log('✅ PERFECTION: 20/20 PORTUGUESE SITELINKS ACTIVE!');
    console.log('Campaign fully localized for Brazil market! 🇧🇷');
  } else {
    console.log(`⚠️  ${portuguese.length}/20 Portuguese (${nonPortuguese.length} non-Portuguese remain)`);
  }
  console.log('='.repeat(70));
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('COMPLETE SITELINK LOCALIZATION TO BRAZILIAN PORTUGUESE');
  console.log('Target: 20/20 Portuguese sitelinks');
  console.log('='.repeat(70));

  const success = await completeLocalization();

  if (success) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    await verifyFinal();
  }
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
