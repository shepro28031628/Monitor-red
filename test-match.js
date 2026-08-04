const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const res = await client.query('SELECT id, hostname FROM "DeviceInventory" WHERE hostname IS NOT NULL');
  const devices = res.rows;
  
  const jiraLabels = ["REN-LT-010", "REN-LT-011", "REN-LT-087", "MAC-C-002223", "ROBOTO-7", "ROBOTO-18"];
  
  for (const label of jiraLabels) {
    const normalizedLabel = label.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    const matches = devices.filter(d => {
      const normalizedHost = d.hostname.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return normalizedHost === normalizedLabel;
    });
    
    console.log(`Jira Label: ${label} -> Matches:`, matches.map(m => m.hostname));
  }
  await client.end();
}
run();
