const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  for (const p of [envLocalPath, envPath]) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      content.split('\n').forEach((line) => {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      });
      return;
    }
  }
}

async function fetchFromLocalApi() {
  const response = await fetch('http://localhost:3000/api/panora/tokenList?chainId=1');
  if (!response.ok) throw new Error(`API returned status ${response.status}`);
  const json = await response.json();
  const tokens = json?.data?.data ?? json?.data?.tokens;
  const status = json?.data?.status ?? 200;
  if (!Array.isArray(tokens)) throw new Error('Unexpected API response shape');
  return { status, tokens };
}

async function fetchFromPanoraDirect() {
  const apiKey = process.env.PANORA_API_KEY;
  if (!apiKey) throw new Error('PANORA_API_KEY is not set in .env or .env.local');
  const baseUrl = process.env.PANORA_API_URL || 'https://api.panora.exchange';
  const response = await fetch(`${baseUrl}/tokenlist`, {
    headers: { 'x-api-key': apiKey, Accept: 'application/json' },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Panora API returned ${response.status}`);
  }
  const json = await response.json();
  const tokens = Array.isArray(json?.data) ? json.data : (json?.tokens ?? []);
  const status = json?.status ?? 200;
  if (!tokens.length) throw new Error('No tokens in Panora response');
  return { status, tokens };
}

async function updateTokenList() {
  try {
    loadEnv();
    console.log('🔄 Fetching latest token list from Panora API...');

    let status;
    let tokens;
    try {
      ({ status, tokens } = await fetchFromLocalApi());
      console.log('   (via local API)');
    } catch (e) {
      if (e.cause?.code === 'ECONNREFUSED' || e.message?.includes('fetch failed')) {
        console.log('   (local API not available, calling Panora directly)');
        ({ status, tokens } = await fetchFromPanoraDirect());
      } else {
        throw e;
      }
    }

    console.log(`✅ Received ${tokens.length} tokens from API`);

    const filePath = path.join(__dirname, '..', 'src', 'lib', 'data', 'tokenList.json');
    const tokenListData = {
      data: { status, data: tokens },
    };
    fs.writeFileSync(filePath, JSON.stringify(tokenListData, null, 2));

    console.log(`✅ Token list updated successfully!`);
    console.log(`📁 File saved to: ${filePath}`);
    console.log(`📊 Total tokens: ${tokens.length}`);

    console.log('\n📋 Sample tokens:');
    tokens.slice(0, 5).forEach((token) => {
      console.log(`  - ${token.symbol} (${token.name})`);
    });
  } catch (error) {
    console.error('❌ Error updating token list:', error.message);
    process.exit(1);
  }
}

updateTokenList(); 