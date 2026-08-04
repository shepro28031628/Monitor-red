import "dotenv/config";
import * as https from "https";

const auth = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
const data = JSON.stringify({
  qlQuery: 'label LIKE "REN-LT-099"',
  includeAttributes: true
});

const req = https.request({
  hostname: 'api.atlassian.com',
  path: `/jsm/assets/workspace/${process.env.JIRA_WORKSPACE_ID}/v1/object/aql?maxResults=50`,
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let resData = '';
  res.on('data', (chunk) => resData += chunk);
  res.on('end', () => {
    const parsed = JSON.parse(resData);
    const items = parsed.values || [];
    console.log(`Found ${items.length} items`);
    for (const item of items) {
      console.log(`Label: ${item.label}, ObjectType: ${item.objectType?.name}`);
      for (const attr of (item.attributes || [])) {
        const vals = attr.objectAttributeValues?.map((v) => v.displayValue).join(', ') || '(empty)';
        console.log(`  Attr ${attr.objectTypeAttributeId} (${attr.objectTypeAttribute?.name || 'unknown'}): ${vals}`);
      }
    }
  });
});
req.on('error', console.error);
req.write(data);
req.end();
