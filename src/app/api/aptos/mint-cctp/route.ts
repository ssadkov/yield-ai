import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/http';
import { Account, Ed25519PrivateKey, Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

interface AttestationData {
  messages?: Array<{
    attestation?: string;
    message?: string;
    eventNonce?: string;
  }>;
}

// Convert hex string to byte array
function hexToBytes(hex: string): number[] {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    const byte = parseInt(cleanHex.substr(i, 2), 16);
    bytes.push(byte);
  }
  return bytes;
}

export async function POST(request: NextRequest) {
  try {
    const { signature, sourceDomain, finalRecipient } = await request.json();

    console.log('[Mint CCTP API] Received request:', {
      signature: signature?.substring(0, 20) + '...',
      sourceDomain,
      finalRecipient: finalRecipient?.substring(0, 20) + '...',
    });

    // Validate input
    if (!signature || !sourceDomain || !finalRecipient) {
      return NextResponse.json(
        createErrorResponse(new Error('signature, sourceDomain, and finalRecipient are required')),
        { status: 400 }
      );
    }

    // Validate sourceDomain (must be a valid number string)
    const domainStr = sourceDomain.toString().trim();
    const domain = parseInt(domainStr, 10);
    if (isNaN(domain) || (domain !== 5 && domain !== 9)) {
      return NextResponse.json(
        createErrorResponse(new Error('sourceDomain must be 5 (Solana) or 9 (Aptos)')),
        { status: 400 }
      );
    }
	
    const irisApiUrl = process.env.CIRCLE_CCTP_ATTESTATION_URL;
    if (!irisApiUrl) {
      return NextResponse.json(
        createErrorResponse(new Error('CIRCLE_CCTP_ATTESTATION_URL environment variable is not set')),
        { status: 500 }
      );
    }

    // Fetch attestation from Circle API (same format as https://iris-api.circle.com/v1/messages/5/<signature>)
    const baseUrl = irisApiUrl.replace(/\/$/, '');
    const url = `${baseUrl}/${domain}/${signature.trim()}`;
    console.log('[Mint CCTP API] Fetching attestation:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Circle 404 = attestation not ready yet — return 200 + pending so client retries without console error
      if (response.status === 404) {
        console.log('[Mint CCTP API] Attestation not ready yet (Circle 404)');
        return NextResponse.json(
          createSuccessResponse({ pending: true, message: 'Attestation not ready yet' }),
          { status: 200 }
        );
      }
      
      console.error('[Mint CCTP API] Circle API error:', response.status, errorText);
      return NextResponse.json(
        createErrorResponse(new Error(`Circle API error: ${response.status} ${response.statusText}. ${errorText}`)),
        { status: response.status }
      );
    }

    const attestationData: AttestationData = await response.json();

    if (!attestationData.messages || attestationData.messages.length === 0) {
      return NextResponse.json(
        createErrorResponse(new Error('No messages found in attestation data')),
        { status: 400 }
      );
    }

    const firstMessage = attestationData.messages[0];
    
    if (!firstMessage.message) {
      return NextResponse.json(
        createErrorResponse(new Error('Message field is missing')),
        { status: 400 }
      );
    }
    
    if (!firstMessage.attestation) {
      return NextResponse.json(
        createErrorResponse(new Error('Attestation field is missing')),
        { status: 400 }
      );
    }
    
    // Check if attestation is "PENDING" or not ready yet
    const attestationValue = firstMessage.attestation;
    if (typeof attestationValue === 'string') {
      const upperAttestation = attestationValue.toUpperCase();
      // Valid attestation should be a long hex string starting with 0x
      // "PENDING" or short strings indicate attestation is not ready
      if (upperAttestation === 'PENDING' || 
          upperAttestation === 'PENDING...' ||
          !attestationValue.startsWith('0x') ||
          attestationValue.length < 200) { // Valid attestation is typically 200+ chars
        console.log('[Mint CCTP API] Attestation not ready yet:', {
          attestationValue: attestationValue.substring(0, 50),
          length: attestationValue.length,
          isPending: upperAttestation === 'PENDING',
        });
        // 200 + pending so client retries without console 404; no thrown error
        return NextResponse.json(
          createSuccessResponse({ pending: true, message: 'Attestation not ready yet' }),
          { status: 200 }
        );
      }
    }

    console.log('[Mint CCTP API] Attestation valid, building transaction (attestation length:', firstMessage.attestation.length, ')');

    // Convert message and attestation hex strings to byte arrays
    // No parsing needed - we just pass them directly to the transaction
    // Convert to Uint8Array as required by Aptos SDK
    const messageBytesArray = hexToBytes(firstMessage.message);
    const attestationBytesArray = hexToBytes(firstMessage.attestation);
    const messageBytes = new Uint8Array(messageBytesArray);
    const attestationBytes = new Uint8Array(attestationBytesArray);

    // Generate private key from mnemonic or use private key from env
    // First, try to get private key directly from env (for testing)
    const privateKeyHex = process.env.APTOS_PAYER_WALLET_PRIVATE_KEY;
    let account: Account;

    if (privateKeyHex) {
      const keyHex = privateKeyHex.replace(/^0x/, '').trim();
      try {
        account = Account.fromPrivateKey({
          privateKey: new Ed25519PrivateKey(keyHex),
        });
      } catch (error: any) {
        console.error('[Mint CCTP API] Failed to create account from private key:', error);
        return NextResponse.json(
          createErrorResponse(new Error(`Failed to create account from private key: ${error.message}`)),
          { status: 500 }
        );
      }
    } else {
      // Try to get mnemonic from env and derive account
      const mnemonic = process.env.APTOS_PAYER_WALLET_MNEMONIC;
      if (!mnemonic) {
        return NextResponse.json(
          createErrorResponse(new Error('APTOS_PAYER_WALLET_PRIVATE_KEY or APTOS_PAYER_WALLET_MNEMONIC must be set in environment variables')),
          { status: 500 }
        );
      }

      try {
        account = Account.fromDerivationPath({
          mnemonic,
          path: "m/44'/637'/0'/0'/0'", // Standard Aptos derivation path
        });
        console.log('[Mint CCTP API] Account address from mnemonic:', account.accountAddress.toString());
      } catch (error: any) {
        console.error('[Mint CCTP API] Failed to create account from mnemonic:', error);
        return NextResponse.json(
          createErrorResponse(new Error(`Failed to create account from mnemonic: ${error.message}`)),
          { status: 500 }
        );
      }
    }

    // Get wallet address for gas drop (to parameter) - address that pays for gas
    // This is required and must be set in environment variables
    const gasDropAddress = process.env.APTOS_PAYER_WALLET_ADDRESS;
    if (!gasDropAddress) {
      return NextResponse.json(
        createErrorResponse(new Error('APTOS_PAYER_WALLET_ADDRESS must be set in environment variables (address that pays for gas)')),
        { status: 500 }
      );
    }

    // Validate gas drop address format (should start with 0x and be 66 chars)
    const trimmedGasDropAddress = gasDropAddress.trim();
    if (!trimmedGasDropAddress.startsWith('0x') || trimmedGasDropAddress.length !== 66) {
      console.warn('[Mint CCTP API] Warning: gasDropAddress format may be incorrect:', trimmedGasDropAddress);
    }

    const gasAmount = 0; // Gas amount for drop (default 0)

    // Create Aptos client
    const aptosConfig = new AptosConfig({
      network: Network.MAINNET,
    });
    const aptosClient = new Aptos(aptosConfig);

    // Get ledger info for expiration timestamp
    const aptosLabsApiUrl = process.env.APTOS_LABS_API_URL;
    if (!aptosLabsApiUrl) {
      return NextResponse.json(
        createErrorResponse(new Error('APTOS_LABS_API_URL environment variable is not set')),
        { status: 500 }
      );
    }

    const ledgerResponse = await fetch(aptosLabsApiUrl);
    if (!ledgerResponse.ok) {
      return NextResponse.json(
        createErrorResponse(new Error(`Failed to fetch ledger info: ${ledgerResponse.status} ${ledgerResponse.statusText}`)),
        { status: 500 }
      );
    }

    const ledgerInfo = await ledgerResponse.json();
    
    // Validate ledger_timestamp exists
    if (!ledgerInfo.ledger_timestamp) {
      return NextResponse.json(
        createErrorResponse(new Error('ledger_timestamp not found in ledger info')),
        { status: 500 }
      );
    }

    // ledger_timestamp is in microseconds, convert to seconds
    const ledgerTimestamp = parseInt(ledgerInfo.ledger_timestamp, 10);
    if (isNaN(ledgerTimestamp)) {
      return NextResponse.json(
        createErrorResponse(new Error(`Invalid ledger_timestamp: ${ledgerInfo.ledger_timestamp}`)),
        { status: 500 }
      );
    }

    const ledgerTimestampSecs = Math.floor(ledgerTimestamp / 1_000_000);
    // Set expiration to 30 minutes from blockchain time
    const expirationTimestampSecs = ledgerTimestampSecs + 1800; // 30 minutes = 1800 seconds

    // Module address and function
    const moduleAddress = "0xdb4058f273ce5fb86fffba7ce0436c6711a6f9997c1c4eed1a0aaccd6cd4bc6c";
    const moduleName = "cctp_v1_receive_with_gas_drop_off";
    const functionName = "handle_receive_message_entry";

    // Build transaction
    const transaction = await aptosClient.transaction.build.simple({
      sender: account.accountAddress,
      withFeePayer: false,
      data: {
        function: `${moduleAddress}::${moduleName}::${functionName}` as `${string}::${string}::${string}`,
        typeArguments: [],
        functionArguments: [
          messageBytes,
          attestationBytes,
          trimmedGasDropAddress, // to address (gas drop address)
          gasAmount.toString(),
        ],
      },
      options: {
        maxGasAmount: 100000, // Increased from 10000
        gasUnitPrice: 100,
        expireTimestamp: expirationTimestampSecs,
      },
    });

    console.log('[Mint CCTP API] Transaction built:', {
      sender: account.accountAddress.toString(),
      function: `${moduleAddress}::${moduleName}::${functionName}`,
      messageLength: messageBytes.length,
      attestationLength: attestationBytes.length,
      gasDropAddress: trimmedGasDropAddress,
      gasAmount,
    });

    // Sign transaction with private key
    const senderAuthenticator = aptosClient.transaction.sign({
      signer: account,
      transaction: transaction,
    });

    // Submit transaction with better error handling
    let result;
    try {
      result = await aptosClient.transaction.submit.simple({
        transaction: transaction,
        senderAuthenticator: senderAuthenticator,
      });
    } catch (submitError: any) {
      console.error('[Mint CCTP API] Transaction submission error:', submitError);
      console.error('[Mint CCTP API] Error details:', {
        message: submitError.message,
        stack: submitError.stack,
        errorCode: submitError.errorCode,
        vmErrorCode: submitError.vmErrorCode,
      });
      
      // Try to extract more details from the error
      let errorMessage = submitError.message || 'Unknown error';
      if (submitError.vmErrorCode !== undefined) {
        errorMessage = `VM Error Code ${submitError.vmErrorCode}: ${errorMessage}`;
      }
      
      return NextResponse.json(
        createErrorResponse(new Error(`Failed to submit transaction: ${errorMessage}`)),
        { status: 500 }
      );
    }

    console.log('[Mint CCTP API] Transaction submitted:', {
      hash: result.hash,
      sender: account.accountAddress.toString(),
      to: trimmedGasDropAddress,
      finalRecipient: finalRecipient,
    });

    // Return success response
    return NextResponse.json(
      createSuccessResponse({
        message: {
          hex: firstMessage.message.startsWith('0x') ? firstMessage.message.slice(2) : firstMessage.message,
          length: messageBytes.length,
        },
        attestation: {
          hex: firstMessage.attestation.startsWith('0x') ? firstMessage.attestation.slice(2) : firstMessage.attestation,
          length: attestationBytes.length,
        },
        accountAddress: account.accountAddress.toString(),
        eventNonce: firstMessage.eventNonce,
        transaction: {
          hash: result.hash,
          sender: account.accountAddress.toString(),
          to: trimmedGasDropAddress,
          gasAmount: gasAmount.toString(),
          expiration: expirationTimestampSecs,
          finalRecipient: finalRecipient,
        },
      })
    );
  } catch (error) {
    console.error('[Mint CCTP API] Error:', error);
    
    // Log stack trace if available
    if (error instanceof Error) {
      console.error('[Mint CCTP API] Error stack:', error.stack);
      return NextResponse.json(
        createErrorResponse(new Error(`Internal server error: ${error.message}`)),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createErrorResponse(new Error('Internal server error: Unknown error occurred')),
      { status: 500 }
    );
  }
}

