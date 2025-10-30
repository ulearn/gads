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

// Portuguese headlines to replace the English ones (max 30 chars)
const PORTUGUESE_HEADLINES = [
  "Escola Inglês ULearn Dublin",      // 27 chars - ULearn English School Dublin
  "Escola de Idiomas Boutique",       // 26 chars - Boutique Language School
  "Melhor Escola Inglês Dublin",      // 27 chars - Best English School Dublin
  "Cursos de Inglês Excelentes",      // 27 chars - Outstanding English Courses
  "Aprenda Inglês em Dublin",         // 24 chars - Learn English in Dublin
  "Escola Inglês Centro Dublin",      // 27 chars - English School Dublin Center
  "Professores Qualificados",         // 24 chars - Qualified Teachers
  "Aulas de Inglês Dublin",           // 22 chars - English Classes Dublin
  "Estude Inglês na Irlanda",         // 24 chars - Study English in Ireland
  "Cursos Inglês para Brasileiros",   // 30 chars - English Courses for Brazilians
  "Escola Inglês Experiência",        // 25 chars - English School Experience
  "Inglês com Nativos Dublin"         // 25 chars - English with Natives Dublin
];

async function createHeadlineAssets() {
  console.log('\n' + '='.repeat(70));
  console.log('CREATING PORTUGUESE HEADLINE ASSETS (30 char max)');
  console.log('='.repeat(70));

  const operations = PORTUGUESE_HEADLINES.map(text => ({
    text_asset: {
      text: text
    }
  }));

  try {
    const response = await customer.assets.create(operations);

    console.log(`\n✅ Created ${response.length} Portuguese headline assets:\n`);

    const assetIds = [];

    response.forEach((result, i) => {
      const assetId = result.resource_name.split('/')[3];
      assetIds.push(assetId);
      console.log(`${i + 1}. "${PORTUGUESE_HEADLINES[i]}"`);
      console.log(`   Asset ID: ${assetId}`);
      console.log(`   Length: ${PORTUGUESE_HEADLINES[i].length} chars`);
      console.log('');
    });

    console.log('='.repeat(70));
    console.log('ASSET IDS FOR SWAP SCRIPT');
    console.log('='.repeat(70));
    console.log(JSON.stringify(assetIds, null, 2));

    return assetIds;

  } catch (error) {
    console.error('\n❌ ERROR creating assets:', error.message);
    if (error.errors) {
      error.errors.forEach((err, i) => {
        console.error(`  Error ${i + 1}:`, err.message || err);
      });
    }
    throw error;
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('CREATE PORTUGUESE HEADLINES FOR BRAZIL CAMPAIGN');
  console.log('Target: Replace English headlines in Asset Groups #2 & #3');
  console.log('='.repeat(70));

  await createHeadlineAssets();
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
