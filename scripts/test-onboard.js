/**
 * Test Decibel onboard (redeem referral code) - same logic as POST /api/protocols/decibel/onboard.
 * Run: node scripts/test-onboard.js <wallet_address>
 * WARNING: Redeeming consumes a use of the referral code; use a test wallet or expect 409 if already onboarded.
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

function to64Hex(addr) {
  const s = addr.startsWith('0x') ? addr.slice(2) : addr;
  const hex = s.replace(/^0+/, '') || '0';
  return '0x' + hex.padStart(64, '0').slice(-64);
}

async function main() {
  loadEnv();
  const address = process.argv[2];
  if (!address) {
    console.error('Usage: node scripts/test-onboard.js <wallet_address>');
    process.exit(1);
  }
  const code = process.env.DECIBEL_BUILDER_CODE;
  const base = (process.env.DECIBEL_API_BASE_URL || 'https://api.testnet.aptoslabs.com/decibel').replace(/\/$/, '');
  const key = process.env.DECIBEL_API_KEY;
  if (!code || !key) {
    console.error('Need DECIBEL_BUILDER_CODE and DECIBEL_API_KEY in .env.local');
    process.exit(1);
  }
  const account64 = to64Hex(address.trim());
  const url = `${base}/api/v1/referrals/redeem`;
  console.log('POST', url, 'body:', { referral_code: code, account: account64 });
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ referral_code: code, account: account64 }),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.log('Status:', res.status, 'Body:', text.slice(0, 400));
    process.exit(1);
  }
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  if (res.status === 409) {
    console.log('(409 = already onboarded; treat as success)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
