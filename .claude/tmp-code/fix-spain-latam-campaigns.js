const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('\n🔧 FIXING SPAIN / LATAM CAMPAIGN MISLABELING\n');
  console.log('='.repeat(80));

  // Step 1: Rename campaign 22099718382 in database
  console.log('\n📝 Step 1: Rename campaign 22099718382 in database');
  console.log('   "Spain-LATAM-ES" → "LATAM-ES"\n');

  await conn.execute(`
    UPDATE gads_campaigns
    SET campaign_name = 'LATAM-ES'
    WHERE google_campaign_id = '22099718382'
  `);

  console.log('   ✅ Database updated');

  // Step 2: Fix contacts with campaign ID 32907697 (Spain-ES)
  console.log('\n📝 Step 2: Fix contacts with hsa_cam=32907697');
  console.log('   Should be: "Spain-ES"\n');

  const [countSpain] = await conn.execute(`
    SELECT COUNT(*) as count
    FROM hub_contacts
    WHERE hs_analytics_first_url LIKE '%hsa_cam=32907697%'
      AND google_ads_campaign != 'Spain-ES'
  `);

  console.log(`   Found ${countSpain[0].count} contacts to update`);

  const [resultSpain] = await conn.execute(`
    UPDATE hub_contacts
    SET google_ads_campaign = 'Spain-ES'
    WHERE hs_analytics_first_url LIKE '%hsa_cam=32907697%'
  `);

  console.log(`   ✅ Updated ${resultSpain.affectedRows} contacts to "Spain-ES"`);

  // Step 3: Fix contacts with campaign ID 22099718382 (LATAM-ES)
  console.log('\n📝 Step 3: Fix contacts with hsa_cam=22099718382');
  console.log('   Should be: "LATAM-ES"\n');

  const [countLatam] = await conn.execute(`
    SELECT COUNT(*) as count
    FROM hub_contacts
    WHERE hs_analytics_first_url LIKE '%hsa_cam=22099718382%'
      AND google_ads_campaign != 'LATAM-ES'
  `);

  console.log(`   Found ${countLatam[0].count} contacts to update`);

  const [resultLatam] = await conn.execute(`
    UPDATE hub_contacts
    SET google_ads_campaign = 'LATAM-ES'
    WHERE hs_analytics_first_url LIKE '%hsa_cam=22099718382%'
  `);

  console.log(`   ✅ Updated ${resultLatam.affectedRows} contacts to "LATAM-ES"`);

  // Verify results
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 VERIFICATION:\n');

  const [spainVerify] = await conn.execute(`
    SELECT COUNT(*) as count
    FROM hub_contacts
    WHERE google_ads_campaign = 'Spain-ES'
  `);

  const [latamVerify] = await conn.execute(`
    SELECT COUNT(*) as count
    FROM hub_contacts
    WHERE google_ads_campaign = 'LATAM-ES'
  `);

  console.log(`   "Spain-ES" campaign: ${spainVerify[0].count} contacts`);
  console.log(`   "LATAM-ES" campaign: ${latamVerify[0].count} contacts`);

  console.log('\n' + '='.repeat(80) + '\n');

  await conn.end();
})();
