const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const { universalGoogleAdsWrite } = require('../mcp-api-full.js');

const ACCOUNT_ID = '1051706978';
const CAMPAIGN_ID = '23202585091'; // PMax-Brazil-POR

// Portuguese Sitelinks for Brazil Market
// Emphasis: Low prices, Work & Study, Non-EU flexibility
const SITELINKS = [
  {
    link_text: 'Preços e Cursos',
    description1: 'Cursos desde €150/semana',
    description2: 'Preços especiais para brasileiros',
    final_url: 'https://www.ulearnschool.com/pt/cursos-ingles-dublin/'
  },
  {
    link_text: 'Trabalhe e Estude',
    description1: 'Permissão de trabalho 20h/semana',
    description2: 'Ganhe enquanto aprende inglês',
    final_url: 'https://www.ulearnschool.com/pt/trabalhar-irlanda/'
  },
  {
    link_text: 'Visto para Irlanda',
    description1: 'Processo simplificado',
    description2: 'Suporte em português',
    final_url: 'https://www.ulearnschool.com/pt/visto-estudante-irlanda/'
  },
  {
    link_text: 'Inscreva-se Agora',
    description1: 'Vagas para 2025',
    description2: 'Reserve sua vaga hoje',
    final_url: 'https://www.ulearnschool.com/pt/inscricao/'
  },
  {
    link_text: 'Acomodação Garantida',
    description1: 'Apartamentos e casas de família',
    description2: 'Central de Dublin',
    final_url: 'https://www.ulearnschool.com/pt/acomodacao-dublin/'
  }
];

async function createSitelinks() {
  console.log('=== CREATING PORTUGUESE SITELINKS FOR BRAZIL MARKET ===\n');
  console.log('Focus: Low prices, Work & Study, Non-EU flexibility\n');

  const createdIds = [];

  for (const sitelink of SITELINKS) {
    console.log(`Creating: "${sitelink.link_text}"...`);

    const operations = [{
      type: 'SITELINK',
      name: `Sitelink: ${sitelink.link_text}`,
      final_urls: [sitelink.final_url],
      sitelink_asset: {
        link_text: sitelink.link_text,
        description1: sitelink.description1,
        description2: sitelink.description2
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
        createdIds.push({
          id: assetId,
          text: sitelink.link_text,
          url: sitelink.final_url
        });
        console.log(`  ✅ Created: ${assetId}`);
      } else {
        console.error(`  ❌ Failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`  ❌ Exception: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Created ${createdIds.length}/${SITELINKS.length} sitelinks\n`);

  if (createdIds.length > 0) {
    console.log('Asset IDs:');
    createdIds.forEach(s => {
      console.log(`  ${s.id} - "${s.text}"`);
    });
    console.log('\nCopy these IDs for the swap script:');
    console.log('[' + createdIds.map(s => `'${s.id}'`).join(', ') + ']');
  }

  return createdIds;
}

async function main() {
  console.log('=========================================================');
  console.log('CREATE PORTUGUESE SITELINKS - BRAZIL MARKET');
  console.log('=========================================================\n');

  const sitelinks = await createSitelinks();

  if (sitelinks.length === SITELINKS.length) {
    console.log('\n✅ All sitelinks created successfully!');
    console.log('\nNext step: Use swap script to replace English sitelinks');
  } else {
    console.log('\n⚠️  Some sitelinks failed. Review errors above.');
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
