const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const { universalGoogleAdsWrite } = require('../mcp-api-full.js');

const ACCOUNT_ID = '1051706978';

// Portuguese Long Headlines (max 90 chars)
const LONG_HEADLINES = [
  'Estude Inglês em Dublin e Trabalhe Meio Período na Irlanda',
  'Cursos de Inglês com Permissão de Trabalho - 20h por Semana',
  'Aprenda Inglês em Dublin - Escola Credenciada há 35 Anos',
  'Intercâmbio na Irlanda com Direito a Trabalhar Legalmente',
  'Curso de Inglês + Visto de Trabalho - Comece em 2025'
];

// Portuguese Descriptions (max 90 chars)
const DESCRIPTIONS = [
  'Estude inglês no centro de Dublin. Acomodação garantida e suporte em português.',
  'Cursos para todos os níveis. Certificados oficiais e turmas pequenas.',
  'Escola credenciada com 35 anos de experiência. WiFi grátis e localização central.',
  'Trabalhe meio período enquanto estuda. Permissão de 20 horas por semana.',
  'Inscreva-se agora e reserve sua vaga para 2025. Preços e datas disponíveis.'
];

async function createTextAssets() {
  console.log('=== CREATING PORTUGUESE TEXT ASSETS ===\n');

  const longHeadlineIds = [];
  const descriptionIds = [];

  // Create long headlines
  console.log('Creating Long Headlines...');
  for (const text of LONG_HEADLINES) {
    const operations = [{
      type: 'TEXT',
      text_asset: {
        text: text
      }
    }];

    try {
      const result = await universalGoogleAdsWrite({
        account_id: ACCOUNT_ID,
        resource_type: 'assets',
        operation_type: 'create',
        operations,
        confirm_danger: true
      });

      if (result.success && result.created_resources) {
        const assetId = result.created_resources[0].split('/').pop();
        longHeadlineIds.push(assetId);
        console.log(`  ✅ ${assetId} - ${text.substring(0, 50)}...`);
      } else {
        console.error(`  ❌ Failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`  ❌ Exception: ${error.message}`);
    }
  }

  // Create descriptions
  console.log('\nCreating Descriptions...');
  for (const text of DESCRIPTIONS) {
    const operations = [{
      type: 'TEXT',
      text_asset: {
        text: text
      }
    }];

    try {
      const result = await universalGoogleAdsWrite({
        account_id: ACCOUNT_ID,
        resource_type: 'assets',
        operation_type: 'create',
        operations,
        confirm_danger: true
      });

      if (result.success && result.created_resources) {
        const assetId = result.created_resources[0].split('/').pop();
        descriptionIds.push(assetId);
        console.log(`  ✅ ${assetId} - ${text.substring(0, 50)}...`);
      } else {
        console.error(`  ❌ Failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`  ❌ Exception: ${error.message}`);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Long Headlines created: ${longHeadlineIds.length}/${LONG_HEADLINES.length}`);
  console.log(`Descriptions created: ${descriptionIds.length}/${DESCRIPTIONS.length}`);

  console.log(`\n=== ASSET IDS ===`);
  console.log('Long Headlines:', longHeadlineIds);
  console.log('Descriptions:', descriptionIds);

  return { longHeadlineIds, descriptionIds };
}

async function main() {
  console.log('=========================================================');
  console.log('CREATE PORTUGUESE TEXT ASSETS');
  console.log('Using universalGoogleAdsWrite (same method that worked for sitelinks)');
  console.log('=========================================================\n');

  const { longHeadlineIds, descriptionIds } = await createTextAssets();

  if (longHeadlineIds.length > 0 || descriptionIds.length > 0) {
    console.log('\n✅ Assets created successfully!');
    console.log('\nNext step: Link these assets to asset groups with field_type LONG_HEADLINE and DESCRIPTION');
  } else {
    console.log('\n❌ No assets were created. Review errors above.');
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
