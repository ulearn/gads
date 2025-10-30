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

async function queryAllHeadlineAssets() {
  console.log('\n' + '='.repeat(70));
  console.log('QUERY ALL HEADLINE ASSETS IN ACCOUNT');
  console.log('='.repeat(70));

  const query = `
    SELECT
      asset.id,
      asset.text_asset.text,
      asset.type
    FROM asset
    WHERE asset.type = TEXT
  `;

  try {
    const assets = await customer.query(query);

    console.log(`\nFound ${assets.length} text assets in account\n`);

    // Filter for headlines (max 30 chars) and detect language
    const headlines = assets.filter(a => {
      const text = a.asset.text_asset?.text || '';
      return text.length <= 30;
    });

    console.log(`Text assets with length ≤30 chars (potential headlines): ${headlines.length}\n`);

    const portugueseHeadlines = [];
    const englishHeadlines = [];
    const otherHeadlines = [];

    headlines.forEach(asset => {
      const text = asset.text_asset.text;
      const isEnglish = /\b(school|learn|english|study|dublin|courses?|work|the|and|our|for|with|your|free|wifi|guarantee|central|location|teachers|teaching|business|small|class|events|accommodation|family|contact|testimonials|life)\b/i.test(text);
      const isPortuguese = /\b(escola|inglês|inglesa|curso|cursos|estudar|aprender|dublin|irlanda|trabalho|anos|professores|ensino|aulas|preços|visto|native|speaker|boutique|leading|edge|excellence)\b/i.test(text);

      if (isPortuguese && !isEnglish) {
        portugueseHeadlines.push(asset);
      } else if (isEnglish) {
        englishHeadlines.push(asset);
      } else {
        otherHeadlines.push(asset);
      }
    });

    console.log('='.repeat(70));
    console.log(`PORTUGUESE HEADLINES (${portugueseHeadlines.length})`);
    console.log('='.repeat(70));
    portugueseHeadlines.forEach((asset, i) => {
      console.log(`${i + 1}. [${asset.asset.id}] "${asset.asset.text_asset.text}" (${asset.asset.text_asset.text.length} chars)`);
    });

    console.log('\n' + '='.repeat(70));
    console.log(`ENGLISH HEADLINES (${englishHeadlines.length})`);
    console.log('='.repeat(70));
    englishHeadlines.slice(0, 20).forEach((asset, i) => {
      console.log(`${i + 1}. [${asset.asset.id}] "${asset.asset.text_asset.text}" (${asset.asset.text_asset.text.length} chars)`);
    });
    if (englishHeadlines.length > 20) {
      console.log(`... and ${englishHeadlines.length - 20} more`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('PORTUGUESE HEADLINE ASSET IDS FOR SWAP');
    console.log('='.repeat(70));
    const portugueseIds = portugueseHeadlines.map(a => a.asset.id.toString());
    console.log(JSON.stringify(portugueseIds, null, 2));

    return {
      portugueseHeadlines,
      englishHeadlines,
      otherHeadlines
    };

  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.errors) {
      error.errors.forEach(err => console.error('  ', err.message || err));
    }
    throw error;
  }
}

async function main() {
  await queryAllHeadlineAssets();
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
