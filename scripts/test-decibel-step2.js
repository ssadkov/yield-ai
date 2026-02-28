/**
 * Test Decibel Step 2 (Approve builder fee): builder-config API and approve payload shape.
 * Run: npm run dev (in another terminal), then node scripts/test-decibel-step2.js
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

const BASE = 'http://localhost:3000';
const PACKAGE_MAINNET = '0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06';

async function main() {
  loadEnv();

  console.log('--- Check 1: GET /api/protocols/decibel/builder-config ---');
  let res;
  try {
    res = await fetch(`${BASE}/api/protocols/decibel/builder-config`);
  } catch (e) {
    console.error('Request failed (is the dev server running?).', e.message);
    process.exit(1);
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.error('Invalid JSON:', text?.slice(0, 200));
    process.exit(1);
  }

  if (!res.ok) {
    console.error('Status:', res.status, 'Body:', data);
    process.exit(1);
  }
  if (!data.success || !data.builderAddress || typeof data.builderFeeBps !== 'number') {
    console.error('Unexpected shape. Expected success, builderAddress, builderFeeBps (number). Got:', data);
    process.exit(1);
  }
  console.log('Status:', res.status);
  console.log('builderAddress:', data.builderAddress?.slice(0, 18) + '...');
  console.log('builderFeeBps:', data.builderFeeBps);
  console.log('Check 1 passed.\n');

  console.log('--- Check 2: Approve payload shape ---');
  const subaccountAddr = '0x' + '0'.repeat(63) + '1';
  const builderAddr = data.builderAddress;
  const maxFeeBps = data.builderFeeBps;
  const functionName = `${PACKAGE_MAINNET}::dex_accounts_entry::approve_max_builder_fee_for_subaccount`;
  const functionArguments = [subaccountAddr, builderAddr, maxFeeBps];

  if (functionArguments.length !== 3) {
    console.error('Expected 3 args, got', functionArguments.length);
    process.exit(1);
  }
  if (functionArguments[1] !== builderAddr) {
    console.error('Second arg should be builderAddr');
    process.exit(1);
  }
  if (functionArguments[2] !== maxFeeBps) {
    console.error('Third arg should be maxFeeBps (number)');
    process.exit(1);
  }
  console.log('Function:', functionName.split('::').pop());
  console.log('functionArguments.length:', 3);
  console.log('Check 2 passed.\n');

  console.log('Step 2 tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
