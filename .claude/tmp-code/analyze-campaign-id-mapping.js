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

  console.log('\n🔍 CAMPAIGN ID TO NAME MAPPING ANALYSIS\n');
  console.log('='.repeat(80));

  // Get all unique campaign IDs from tracking URLs
  const [urlCampaigns] = await conn.execute(`
    SELECT DISTINCT
      SUBSTRING_INDEX(SUBSTRING_INDEX(hs_analytics_first_url, 'hsa_cam=', -1), '&', 1) as campaign_id,
      COUNT(*) as contact_count
    FROM hub_contacts
    WHERE hs_analytics_first_url LIKE '%hsa_cam=%'
      AND hs_analytics_source = 'PAID_SEARCH'
    GROUP BY campaign_id
    ORDER BY contact_count DESC
  `);

  console.log('\n📊 Campaign IDs found in tracking URLs (with contact counts):\n');

  for (const row of urlCampaigns) {
    const campaignId = row.campaign_id;
    const contactCount = row.contact_count;

    // Skip malformed IDs
    if (!campaignId || campaignId.length > 15 || campaignId.includes('http')) continue;

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`Campaign ID: ${campaignId} (${contactCount} contacts)`);

    // Get current name in Google Ads
    const [gadsName] = await conn.execute(`
      SELECT campaign_name, status
      FROM gads_campaigns
      WHERE google_campaign_id = ?
    `, [campaignId]);

    if (gadsName.length > 0) {
      const statusLabel = gadsName[0].status === 2 ? 'ACTIVE' : gadsName[0].status === 3 ? 'PAUSED' : 'OTHER';
      console.log(`   Google Ads Name: "${gadsName[0].campaign_name}" [${statusLabel}]`);
    } else {
      console.log(`   ⚠️  NOT FOUND in gads_campaigns table`);
    }

    // Get what names contacts have been assigned
    const [contactNames] = await conn.execute(`
      SELECT google_ads_campaign, COUNT(*) as count
      FROM hub_contacts
      WHERE hs_analytics_first_url LIKE CONCAT('%hsa_cam=', ?, '%')
      GROUP BY google_ads_campaign
      ORDER BY count DESC
      LIMIT 5
    `, [campaignId]);

    console.log(`   Contact Assignments:`);
    contactNames.forEach(c => {
      console.log(`      "${c.google_ads_campaign || 'NULL'}" - ${c.count} contacts`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n💡 MISMATCHES: Where Google Ads name ≠ Contact assignments\n');

  await conn.end();
})();
