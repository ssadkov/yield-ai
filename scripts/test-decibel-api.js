/**
 * Run from project root: node scripts/test-decibel-api.js
 * Loads .env.local; set DECIBEL_API_KEY there.
 * Hits Decibel testnet only (no mainnet). Tests all proxy routes via direct Decibel API.
 */
const address = process.argv[2] || '0x56ff2fc971deecd286314fe99b8ffd6a5e72e62eacdc46ae9b234c5282985f97';
const base = 'https://api.testnet.aptoslabs.com/decibel';

async function loadEnv() {
  try {
    const fs = require('fs');
    const path = require('path');
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
  } catch (_) {}
}

async function get(key) {
  const url = `${base}/api/v1/${key}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.DECIBEL_API_KEY}` },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    return { status: res.status, raw: text.slice(0, 200) };
  }
  return { status: res.status, data };
}

async function main() {
  await loadEnv();
  const key = process.env.DECIBEL_API_KEY;
  if (!key) {
    console.error('DECIBEL_API_KEY not set. Add it to .env.local');
    process.exit(1);
  }

  const tests = [
    { name: 'account_positions', url: `${base}/api/v1/account_positions?account=${encodeURIComponent(address)}` },
    { name: 'account_overviews', url: `${base}/api/v1/account_overviews?account=${encodeURIComponent(address)}` },
    { name: 'subaccounts', url: `${base}/api/v1/subaccounts?owner=${encodeURIComponent(address)}` },
    { name: 'open_orders', url: `${base}/api/v1/open_orders?account=${encodeURIComponent(address)}` },
    { name: 'trade_history', url: `${base}/api/v1/trade_history?account=${encodeURIComponent(address)}` },
    { name: 'funding_rate_history', url: `${base}/api/v1/funding_rate_history?account=${encodeURIComponent(address)}` },
    { name: 'account_vault_performance', url: `${base}/api/v1/account_vault_performance?account=${encodeURIComponent(address)}` },
    { name: 'account_owned_vaults', url: `${base}/api/v1/account_owned_vaults?account=${encodeURIComponent(address)}` },
  ];

  console.log('Decibel testnet – testing with address:', address);
  console.log('');

  for (const t of tests) {
    process.stdout.write(t.name + ' ... ');
    try {
      const res = await fetch(t.url, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        console.log('status', res.status, 'body:', text.slice(0, 80));
        continue;
      }
      if (!res.ok) {
        console.log('status', res.status, data?.message || data);
        continue;
      }
      if (Array.isArray(data)) {
        console.log('status', res.status, 'count', data.length);
        if (data.length > 0) console.log('  sample:', JSON.stringify(data[0]).slice(0, 120) + '...');
      } else if (data && typeof data === 'object' && (data.items || data.total_count !== undefined)) {
        const items = data.items || [];
        const total = data.total_count ?? items.length;
        console.log('status', res.status, 'items', items.length, 'total_count', total);
        if (items.length > 0) console.log('  sample:', JSON.stringify(items[0]).slice(0, 120) + '...');
      } else if (data && typeof data === 'object' && (data.perp_equity_balance !== undefined || data.usdc_cross_withdrawable_balance !== undefined)) {
        console.log('status', res.status, 'perp_equity', data.perp_equity_balance, 'withdrawable', data.usdc_cross_withdrawable_balance);
      } else {
        console.log('status', res.status, JSON.stringify(data).slice(0, 100));
      }
    } catch (e) {
      console.log('error', e.message);
    }
  }

  const subRes = await fetch(`${base}/api/v1/subaccounts?owner=${encodeURIComponent(address)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const subData = subRes.ok ? JSON.parse(await subRes.text()) : [];
  if (Array.isArray(subData) && subData.length > 0) {
    const sub = subData[0];
    const primary = sub.primary_account_address;
    const subAddr = sub.subaccount_address;
    console.log('');
    console.log('Subaccount: primary=', primary, 'subaccount=', subAddr);
    if (subAddr) {
      process.stdout.write('account_positions (subaccount) ... ');
      const posRes = await fetch(`${base}/api/v1/account_positions?account=${encodeURIComponent(subAddr)}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const posText = await posRes.text();
      const posArr = posText ? JSON.parse(posText) : [];
      console.log('status', posRes.status, 'count', Array.isArray(posArr) ? posArr.length : 0);
    }
    const overviewAddr = subAddr || primary;
    if (overviewAddr) {
      process.stdout.write('account_overviews (primary/sub) ... ');
      const ovRes = await fetch(`${base}/api/v1/account_overviews?account=${encodeURIComponent(overviewAddr)}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const ovText = await ovRes.text();
      let ovData;
      try {
        ovData = ovText ? JSON.parse(ovText) : null;
      } catch {
        ovData = null;
      }
      console.log('status', ovRes.status, ovData?.perp_equity_balance != null ? 'perp_equity=' + ovData.perp_equity_balance : ovText?.slice(0, 60));
    }
  }

  console.log('');
  console.log('Done. Use local routes e.g.:');
  console.log('  GET /api/protocols/decibel/userPositions?address=' + address);
  console.log('  GET /api/protocols/decibel/accountOverview?address=' + address);
  console.log('  GET /api/protocols/decibel/subaccounts?address=' + address);
  console.log('  GET /api/protocols/decibel/openOrders?address=' + address);
  console.log('  GET /api/protocols/decibel/tradeHistory?address=' + address);
  console.log('  GET /api/protocols/decibel/fundingRateHistory?address=' + address);
  console.log('  GET /api/protocols/decibel/accountVaultPerformance?address=' + address);
}

main();
