import { NextRequest, NextResponse } from 'next/server';
import { Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

/**
 * API endpoint to get fee payer account information
 * This endpoint creates an Account from server-side env variables
 * and returns only the address (never the private key)
 */
export async function GET(request: NextRequest) {
  try {
    const privateKeyHex = process.env.APTOS_PAYER_WALLET_PRIVATE_KEY;
    const expectedAddress = process.env.APTOS_PAYER_WALLET_ADDRESS;

    if (!privateKeyHex) {
      return NextResponse.json(
        { error: 'APTOS_PAYER_WALLET_PRIVATE_KEY is not set in environment variables' },
        { status: 500 }
      );
    }

    // Create account from private key
    const account = Account.fromPrivateKey({
      privateKey: new Ed25519PrivateKey(privateKeyHex),
    });

    const address = account.accountAddress.toString();

    // Validate address if provided
    if (expectedAddress && address.toLowerCase() !== expectedAddress.toLowerCase()) {
      console.warn('[Fee Payer API] Address mismatch:', expectedAddress, address);
    }

    // Return only the address (never the private key)
    return NextResponse.json({
      success: true,
      address: address,
      matchesExpected: expectedAddress ? address.toLowerCase() === expectedAddress.toLowerCase() : null,
    });
  } catch (error: any) {
    console.error('[Fee Payer API] Error:', error);
    return NextResponse.json(
      { error: `Failed to create fee payer account: ${error.message}` },
      { status: 500 }
    );
  }
}
