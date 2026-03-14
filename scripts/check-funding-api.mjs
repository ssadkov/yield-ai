/**
 * Check /api/protocols/decibel/funding response: list markets and verify BTC.
 * Run: node scripts/check-funding-api.mjs
 * Or with dev server: node scripts/check-funding-api.mjs http://localhost:3000
 */
const base = process.argv[2] || 'http://localhost:3000';
const url = `${base}/api/protocols/decibel/funding`;

async function main() {
  console.log('Fetching', url);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    console.error('Error', res.status, json);
    return;
  }
  const data = json.data ?? json;
  if (!Array.isArray(data)) {
    console.log('Response is not array. Keys:', Object.keys(json));
    console.log('data sample:', JSON.stringify(data).slice(0, 500));
    return;
  }
  const byMarket = {};
  data.forEach((row) => {
    const name = row.market_name ?? '?';
    byMarket[name] = (byMarket[name] || 0) + 1;
  });
  console.log('Total records:', data.length);
  console.log('Unique market_name values:', Object.keys(byMarket).sort().join(', '));
  console.log('Count per market:', JSON.stringify(byMarket, null, 2));
  const btcRows = data.filter((r) => (r.market_name || '').toUpperCase().includes('BTC'));
  console.log('BTC-related records:', btcRows.length);
  if (btcRows.length > 0) {
    console.log('Sample BTC row:', JSON.stringify(btcRows[0], null, 2));
  }
  // Simulate normalizeMarketKey
  const normalized = {};
  for (const name of Object.keys(byMarket)) {
    let key = name.trim().replace(/-/g, '/');
    if (key.toUpperCase().includes('USDC')) key = key.replace(/USDC/gi, 'USD');
    normalized[key] = (normalized[key] || 0) + byMarket[name];
  }
  console.log('After normalizeMarketKey (chart keys):', JSON.stringify(normalized, null, 2));
}

main().catch((e) => console.error(e));
