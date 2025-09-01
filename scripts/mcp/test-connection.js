#!/usr/bin/env node
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/home/hub/public_html/gads/.env' });

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME || 'hub_gads',
      user: process.env.DB_USER || 'hub_admin',
      password: process.env.DB_PASSWORD,
      timeout: 10000
    });
    
    const [results] = await connection.execute('SELECT COUNT(*) as contact_count FROM hub_contacts LIMIT 1');
    console.log(`✅ Database connection successful. Found ${results[0].contact_count} contacts.`);
    
    const [campaigns] = await connection.execute('SELECT COUNT(*) as campaign_count FROM gads_campaigns LIMIT 1');
    console.log(`✅ Found ${campaigns[0].campaign_count} campaigns in sync database.`);
    
    await connection.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
