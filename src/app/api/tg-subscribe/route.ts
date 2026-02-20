import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function formatPemPublicKey(base64Key: string): string {
  // Remove any whitespace/newlines from the raw key
  const clean = base64Key.replace(/\s/g, '');
  // Split into 64-character lines as required by PEM format
  const lines = clean.match(/.{1,64}/g) || [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}

export async function POST(req: NextRequest) {
  try {
    const { solana, aptos } = await req.json();

    if (!solana && !aptos) {
      return NextResponse.json(
        { error: 'At least one wallet address is required' },
        { status: 400 }
      );
    }

    const publicKeyBase64 = process.env.RSA_PUBLIC_KEY;
    const tgApiEndpoint = process.env.TG_API_ENDPOINT;
    const tgBotName = process.env.TG_BOT_NAME;

    if (!publicKeyBase64 || !tgBotName) {
      console.error('Missing env vars:', {
        hasPublicKey: !!publicKeyBase64,
        hasTgApi: !!tgApiEndpoint,
        hasTgBot: !!tgBotName,
      });
      return NextResponse.json(
        { error: 'Server configuration error: missing env vars', details: {
          RSA_PUBLIC_KEY: !!publicKeyBase64,
          TG_API_ENDPOINT: !!tgApiEndpoint,
          TG_BOT_NAME: !!tgBotName,
        }},
        { status: 500 }
      );
    }

    const walletData = JSON.stringify({
      solana: solana || '',
      aptos: aptos || '',
    });

    // Format public key in proper PEM format with 64-char lines
    const publicKeyPem = formatPemPublicKey(publicKeyBase64);

    // Encrypt with RSA-OAEP SHA-256
    let encryptedBase64: string;
    try {
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKeyPem,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(walletData, 'utf-8')
      );
      encryptedBase64 = encrypted.toString('base64url');
    } catch (cryptoError) {
      console.error('RSA encryption failed:', cryptoError);
      return NextResponse.json(
        { error: 'Encryption failed', details: String(cryptoError) },
        { status: 500 }
      );
    }

    // Generate short unique token for Telegram deep link (max 64 chars)
    const token = crypto.randomUUID().replace(/-/g, '');

    // Send encrypted data + token to TG API server
    if (!tgApiEndpoint) {
      return NextResponse.json(
        { error: 'TG_API_ENDPOINT is not configured' },
        { status: 500 }
      );
    }

    const apiUrl = tgApiEndpoint.replace(/\/+$/, '');
    console.log('[TG Subscribe] Sending to:', apiUrl);

    let apiData: { error: number; message: string };
    try {
      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, encryptedData: encryptedBase64, tgBotName }),
      });

      console.log('[TG Subscribe] Response status:', apiResponse.status);
      apiData = await apiResponse.json();
      console.log('[TG Subscribe] Response body:', JSON.stringify(apiData));
    } catch (fetchError) {
      console.error('[TG Subscribe] Fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to connect to TG API server' },
        { status: 502 }
      );
    }

    // Check TG API response: error 0 = success, error 1 = show message to user
    if (apiData.error !== 0) {
      return NextResponse.json(
        { error: apiData.message || 'Subscription failed' },
        { status: 400 }
      );
    }

    const tgLink = `https://t.me/${tgBotName}?start=${token}`;

    return NextResponse.json({ link: tgLink });
  } catch (error) {
    console.error('TG subscribe error:', error);
    return NextResponse.json(
      { error: 'Failed to process subscription', details: String(error) },
      { status: 500 }
    );
  }
}
