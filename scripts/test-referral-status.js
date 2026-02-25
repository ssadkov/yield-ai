/**
 * Test Decibel referral code check (same logic as GET /api/protocols/decibel/referral-status).
 * Run: node scripts/test-referral-status.js
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

async function main() {
  loadEnv();
  const code = process.env.DECIBEL_BUILDER_CODE;
  const base = (process.env.DECIBEL_API_BASE_URL || 'https://api.testnet.aptoslabs.com/decibel').replace(/\/$/, '');
  const key = process.env.DECIBEL_API_KEY;
  if (!code || !key) {
    console.error('Need DECIBEL_BUILDER_CODE and DECIBEL_API_KEY in .env.local');
    process.exit(1);
  }
  const url = `${base}/api/v1/referrals/code/${encodeURIComponent(code)}`;
  console.log('GET', url);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.log('Status:', res.status, 'Body:', text.slice(0, 300));
    process.exit(1);
  }
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  const is_valid = Boolean(data?.is_valid);
  const is_active = Boolean(data?.is_active);
  const canRegister = is_valid && is_active;
  console.log('canRegister:', canRegister, '(is_valid:', is_valid, ', is_active:', is_active, ')');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
