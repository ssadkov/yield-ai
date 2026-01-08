import { NextRequest, NextResponse } from 'next/server';
import { Account } from '@aptos-labs/ts-sdk';

/**
 * Temporary utility endpoint to generate private key from mnemonic
 * This should be removed after private key is added to .env.local
 * 
 * Usage: GET /api/aptos/generate-private-key
 * 
 * This will:
 * 1. Read APTOS_PAYER_WALLET_MNEMONIC from environment
 * 2. Generate account from mnemonic
 * 3. Output private key to server console
 * 4. Return account address (without exposing private key in response)
 */
export async function GET(request: NextRequest) {
  try {
    const mnemonic = process.env.APTOS_PAYER_WALLET_MNEMONIC;

    if (!mnemonic) {
      return NextResponse.json(
        { error: 'APTOS_PAYER_WALLET_MNEMONIC is not set in environment variables' },
        { status: 400 }
      );
    }

    console.log('[Generate Private Key] Generating account from mnemonic...');

    // Generate account from mnemonic
    const account = Account.fromDerivationPath({
      mnemonic,
      path: "m/44'/637'/0'/0'/0'", // Standard Aptos derivation path
    });

    const privateKey = account.privateKey.toString();
    const address = account.accountAddress.toString();

    // Output private key to server console (user should copy it from server logs)
    console.log('='.repeat(80));
    console.log('[Generate Private Key] PRIVATE KEY (copy this to .env.local as APTOS_PAYER_WALLET_PRIVATE_KEY):');
    console.log(privateKey);
    console.log('='.repeat(80));
    console.log('[Generate Private Key] Account Address:', address);
    console.log('[Generate Private Key] After adding private key to .env.local, you can remove APTOS_PAYER_WALLET_MNEMONIC');
    console.log('='.repeat(80));

    // Return only address (never expose private key in API response)
    return NextResponse.json({
      success: true,
      message: 'Private key generated successfully. Check server console logs to copy the private key.',
      address: address,
      note: 'The private key has been logged to the server console. Copy it from there and add it to .env.local as APTOS_PAYER_WALLET_PRIVATE_KEY',
    });
  } catch (error) {
    console.error('[Generate Private Key] Error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate private key' },
      { status: 500 }
    );
  }
}


