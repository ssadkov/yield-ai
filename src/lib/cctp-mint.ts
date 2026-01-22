// CCTP Minting logic extracted from minting-solana page
// This module contains the minting logic that can be reused

import bs58 from "bs58";

export interface AttestationData {
  messages?: Array<{
    attestation?: string;
    message?: string;
    eventNonce?: string;
  }>;
}

// Helper: Convert hex string to Uint8Array
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    const byte = parseInt(cleanHex.substr(i, 2), 16);
    bytes.push(byte);
  }
  return new Uint8Array(bytes);
}

// Helper: Convert hex address (32 bytes, 64 hex chars) to Solana base58 address
export function hexToSolanaBase58(hex: string): string {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (cleanHex.length !== 64) {
    throw new Error(`Hex address must be 64 characters (32 bytes), got ${cleanHex.length}`);
  }
  const bytes = hexToBytes(cleanHex);
  return bs58.encode(bytes);
}

// Helper: Fetch attestation from Circle Iris API with polling
export async function fetchAttestation(
  sourceDomain: number,
  signature: string,
  onProgress?: (attempt: number, maxAttempts: number) => void
): Promise<AttestationData> {
  const irisApiUrl = process.env.NEXT_PUBLIC_CIRCLE_CCTP_ATTESTATION_URL;
  
  if (!irisApiUrl) {
    throw new Error('NEXT_PUBLIC_CIRCLE_CCTP_ATTESTATION_URL environment variable is not set');
  }

  const maxAttempts = 15;
  const initialDelay = 10000; // 10 seconds
  const maxDelay = 60000; // 60 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (onProgress) {
      onProgress(attempt, maxAttempts);
    }

    const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
    if (attempt > 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      const url = `${irisApiUrl}/${sourceDomain}/${signature.trim()}`;
      console.log(`[CCTP Mint] Fetching attestation, attempt ${attempt}/${maxAttempts}:`, url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`[CCTP Mint] Attestation not ready yet (404), attempt ${attempt}/${maxAttempts}`);
          if (attempt === maxAttempts) {
            throw new Error(`Attestation not ready after ${maxAttempts} attempts. Please wait and try again.`);
          }
          continue;
        }

        const errorText = await response.text();
        console.error('[CCTP Mint] Circle API error:', response.status, errorText);
        throw new Error(`Circle API error: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const attestationData: AttestationData = await response.json();

      // Validate attestation data
      if (!attestationData.messages || attestationData.messages.length === 0) {
        throw new Error('Invalid attestation data: no messages found');
      }

      const firstMessage = attestationData.messages[0];
      if (!firstMessage.attestation || !firstMessage.message) {
        throw new Error('Invalid attestation data: missing attestation or message');
      }

      console.log('[CCTP Mint] Attestation received successfully:', {
        messageLength: firstMessage.message.length / 2, // hex string, so divide by 2 for bytes
        attestationLength: firstMessage.attestation.length / 2,
        eventNonce: firstMessage.eventNonce,
      });

      return attestationData;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      console.warn(`[CCTP Mint] Attempt ${attempt} failed:`, error);
    }
  }

  throw new Error('Failed to fetch attestation after all attempts');
}

// Main minting function - this will be a large function that performs the mint
// For now, exporting the helper functions. The full minting logic will be added in the next step.
export async function performMintOnSolana(
  sourceDomain: number,
  signature: string,
  recipient: string,
  solanaConnection: any,
  solanaPublicKey: any,
  solanaWallet: any,
  signTransaction: any,
  onStatusUpdate?: (status: string) => void
): Promise<string> {
  // This is a placeholder - the full implementation will be added
  // The full logic from minting-solana/page.tsx handleMint function needs to be extracted here
  throw new Error("Minting logic needs to be fully implemented");
}
