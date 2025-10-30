const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const { universalGoogleAdsWrite } = require('../mcp-api-full.js');

const ACCOUNT_ID = '1051706978';

// 15 Additional Portuguese Sitelinks for Brazil Market
const SITELINKS = [
  {
    link_text: 'Cursos de 2025',
    description1: 'Início em Janeiro, Março e Maio',
    description2: 'Reserve com antecedência',
    final_url: 'https://www.ulearnschool.com/pt/cursos-2025/'
  },
  {
    link_text: 'Preparação para Exames',
    description1: 'FCE, CAE e cursos oficiais',
    description2: 'Certificados reconhecidos',
    final_url: 'https://www.ulearnschool.com/pt/preparacao-exames/'
  },
  {
    link_text: 'Localização Central',
    description1: 'No coração de Dublin',
    description2: 'Perto de Temple Bar',
    final_url: 'https://www.ulearnschool.com/pt/localizacao-dublin/'
  },
  {
    link_text: 'Eventos Sociais',
    description1: 'Atividades semanais',
    description2: 'Conheça novos amigos',
    final_url: 'https://www.ulearnschool.com/pt/eventos-sociais/'
  },
  {
    link_text: 'Turmas Pequenas',
    description1: 'Máximo 15 alunos por turma',
    description2: 'Atenção personalizada',
    final_url: 'https://www.ulearnschool.com/pt/turmas-pequenas/'
  },
  {
    link_text: 'WiFi Grátis',
    description1: 'Internet de alta velocidade',
    description2: 'Estude e conecte-se',
    final_url: 'https://www.ulearnschool.com/pt/instalacoes/'
  },
  {
    link_text: 'Experiência de 35 Anos',
    description1: 'Desde 1988',
    description2: 'Escola credenciada e confiável',
    final_url: 'https://www.ulearnschool.com/pt/sobre-nos/'
  },
  {
    link_text: 'Suporte em Português',
    description1: 'Equipe que fala português',
    description2: 'Ajuda quando você precisa',
    final_url: 'https://www.ulearnschool.com/pt/suporte-portugues/'
  },
  {
    link_text: 'Casas de Família',
    description1: 'Hospedagem com irlandeses',
    description2: 'Imersão cultural total',
    final_url: 'https://www.ulearnschool.com/pt/casas-familia/'
  },
  {
    link_text: 'Apartamentos Estudantis',
    description1: 'Compartilhados ou individuais',
    description2: 'Perto da escola',
    final_url: 'https://www.ulearnschool.com/pt/apartamentos/'
  },
  {
    link_text: 'Inglês para Negócios',
    description1: 'Cursos profissionais',
    description2: 'Acelere sua carreira',
    final_url: 'https://www.ulearnschool.com/pt/ingles-negocios/'
  },
  {
    link_text: 'Todos os Níveis',
    description1: 'Do A2 ao C1',
    description2: 'Teste de nível grátis',
    final_url: 'https://www.ulearnschool.com/pt/niveis/'
  },
  {
    link_text: 'Depoimentos',
    description1: 'O que dizem nossos alunos',
    description2: 'Histórias de sucesso',
    final_url: 'https://www.ulearnschool.com/pt/depoimentos/'
  },
  {
    link_text: 'Vida em Dublin',
    description1: 'Guia para brasileiros',
    description2: 'Cultura, clima e mais',
    final_url: 'https://www.ulearnschool.com/pt/vida-dublin/'
  },
  {
    link_text: 'Fale Conosco',
    description1: 'WhatsApp e email',
    description2: 'Resposta em 24 horas',
    final_url: 'https://www.ulearnschool.com/pt/contato/'
  }
];

async function createSitelinks() {
  console.log('=== CREATING 15 ADDITIONAL PORTUGUESE SITELINKS ===\n');
  console.log('Completing full localization for Brazil market\n');

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
          text: sitelink.link_text
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
  console.log('CREATE REMAINING 15 PORTUGUESE SITELINKS');
  console.log('Total after: 20/20 Portuguese sitelinks');
  console.log('=========================================================\n');

  const sitelinks = await createSitelinks();

  if (sitelinks.length === SITELINKS.length) {
    console.log('\n✅ All 15 sitelinks created successfully!');
    console.log('\nNext step: Swap remaining 15 non-Portuguese sitelinks');
  } else {
    console.log(`\n⚠️  Created ${sitelinks.length}/${SITELINKS.length}. Review errors above.`);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
