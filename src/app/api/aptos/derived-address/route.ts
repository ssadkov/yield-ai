import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { SolanaDerivedPublicKey } from '@aptos-labs/derived-wallet-solana';
import { accountInfoFromPublicKey } from '@aptos-labs/derived-wallet-base';

const DEFAULT_DOMAIN = 'app.decibel.trade';
const DEFAULT_AUTHENTICATION_FUNCTION = '0x1::solana_derivable_account::authenticate';

/**
 * GET /api/aptos/derived-address
 *
 * Returns the Aptos DAA (Derivable Abstract Account) address for a Solana wallet
 * and domain. Used to get the public Aptos address that corresponds to a user's
 * Solana wallet when they would connect via derived wallet on the given domain
 * (e.g. app.decibel.trade).
 *
 * Query params:
 *   - solanaPublicKey (required): Solana public key in base58
 *   - domain (optional): dApp domain for derivation, default "app.decibel.trade"
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const solanaPublicKeyParam = searchParams.get('solanaPublicKey');
    const domain = searchParams.get('domain') ?? DEFAULT_DOMAIN;

    if (!solanaPublicKeyParam || typeof solanaPublicKeyParam !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid query parameter: solanaPublicKey (base58 string required)' },
        { status: 400 }
      );
    }

    const trimmed = solanaPublicKeyParam.trim();
    if (!trimmed) {
      return NextResponse.json(
        { error: 'solanaPublicKey cannot be empty' },
        { status: 400 }
      );
    }

    let solanaPublicKey: PublicKey;
    try {
      solanaPublicKey = new PublicKey(trimmed);
    } catch {
      return NextResponse.json(
        { error: 'Invalid Solana public key: must be a valid base58 string' },
        { status: 400 }
      );
    }

    const derivedPublicKey = new SolanaDerivedPublicKey({
      domain,
      solanaPublicKey,
      authenticationFunction: DEFAULT_AUTHENTICATION_FUNCTION,
    });

    const accountInfo = accountInfoFromPublicKey(derivedPublicKey);
    const address = accountInfo.address;

    return NextResponse.json({
      aptosAddress: typeof address === 'string' ? address : address.toString(),
      domain,
      solanaPublicKey: trimmed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/aptos/derived-address] Error:', message);
    return NextResponse.json(
      { error: 'Failed to compute derived address', details: message },
      { status: 500 }
    );
  }
}
