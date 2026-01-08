import { NextRequest, NextResponse } from 'next/server';
import { sha3_256 } from '@noble/hashes/sha3';

/**
 * Compute keccak256 hash using @noble/hashes
 * @noble/hashes is already installed as a transitive dependency
 */
function keccak256(data: Uint8Array): string {
  const hash = sha3_256(data);
  return Buffer.from(hash).toString('hex');
}

/**
 * API endpoint to compute depositMessageHash from CCTP message
 * This is a server-side endpoint that can use keccak256 library
 * 
 * POST /api/compute-deposit-message-hash
 * Body: { message: CCTPMessage }
 * Returns: { depositMessageHash: string }
 */

interface CCTPAddress {
  address: {
    [key: string]: number;
  };
}

interface CCTPPayload {
  burnToken?: CCTPAddress;
  mintRecipient?: CCTPAddress;
  amount?: string;
  messageSender?: CCTPAddress;
}

interface CCTPMessage {
  sourceDomain: number;
  destinationDomain: number;
  nonce: string | number;
  sender: CCTPAddress;
  recipient: CCTPAddress;
  destinationCaller: CCTPAddress;
  payload: CCTPPayload;
}

/**
 * Convert address object to bytes array
 */
function addressToBytes(addressObj: any): Uint8Array {
  if (!addressObj || typeof addressObj !== 'object') {
    return new Uint8Array(32).fill(0);
  }
  
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = addressObj[i] || 0;
  }
  return bytes;
}

/**
 * Serialize CCTP payload
 */
function serializePayload(payload: CCTPPayload): Uint8Array {
  if (!payload) {
    return new Uint8Array(0);
  }
  
  // CCTP payload format:
  // - burnToken address (32 bytes)
  // - mintRecipient address (32 bytes)
  // - amount (uint256, 32 bytes, big-endian)
  // - messageSender address (32 bytes)
  
  const buffer = new Uint8Array(32 + 32 + 32 + 32); // 128 bytes total
  let offset = 0;
  
  // burnToken address
  const burnTokenBytes = addressToBytes(payload.burnToken?.address);
  buffer.set(burnTokenBytes, offset);
  offset += 32;
  
  // mintRecipient address
  const mintRecipientBytes = addressToBytes(payload.mintRecipient?.address);
  buffer.set(mintRecipientBytes, offset);
  offset += 32;
  
  // amount (uint256, big-endian)
  const amount = BigInt(payload.amount || 0);
  const amountBytes = new Uint8Array(32);
  // Write as big-endian uint256
  for (let i = 0; i < 32; i++) {
    const shift = BigInt(8 * (31 - i));
    amountBytes[i] = Number((amount >> shift) & BigInt(0xff));
  }
  buffer.set(amountBytes, offset);
  offset += 32;
  
  // messageSender address
  const messageSenderBytes = addressToBytes(payload.messageSender?.address);
  buffer.set(messageSenderBytes, offset);
  
  return buffer;
}

/**
 * Serialize CCTP message to bytes
 * Format: version(1) + sourceDomain(4) + destinationDomain(4) + nonce(8) + 
 *         sender(32) + recipient(32) + destinationCaller(32) + payload
 */
function serializeCCTPMessage(message: CCTPMessage): Uint8Array {
  const version = 0; // CCTP v1 uses version 0
  const sourceDomain = message.sourceDomain || 0;
  const destinationDomain = message.destinationDomain || 0;
  const nonce = BigInt(message.nonce || 0);
  
  // Convert addresses from object format to bytes
  const senderBytes = addressToBytes(message.sender?.address);
  const recipientBytes = addressToBytes(message.recipient?.address);
  const destinationCallerBytes = addressToBytes(message.destinationCaller?.address);
  
  // Serialize payload
  const payloadBytes = serializePayload(message.payload);
  
  // Combine all parts
  const buffer = new Uint8Array(
    1 + // version
    4 + // sourceDomain
    4 + // destinationDomain
    8 + // nonce
    32 + // sender
    32 + // recipient
    32 + // destinationCaller
    payloadBytes.length // payload
  );
  
  let offset = 0;
  buffer[offset++] = version;
  
  // Write sourceDomain (uint32, little-endian)
  const sourceDomainView = new DataView(buffer.buffer, offset, 4);
  sourceDomainView.setUint32(0, sourceDomain, true);
  offset += 4;
  
  // Write destinationDomain (uint32, little-endian)
  const destDomainView = new DataView(buffer.buffer, offset, 4);
  destDomainView.setUint32(0, destinationDomain, true);
  offset += 4;
  
  // Write nonce (uint64, little-endian)
  const nonceView = new DataView(buffer.buffer, offset, 8);
  nonceView.setBigUint64(0, nonce, true);
  offset += 8;
  
  // Write addresses (32 bytes each)
  buffer.set(senderBytes, offset);
  offset += 32;
  buffer.set(recipientBytes, offset);
  offset += 32;
  buffer.set(destinationCallerBytes, offset);
  offset += 32;
  
  // Write payload
  buffer.set(payloadBytes, offset);
  
  return buffer;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'CCTP message is required' },
        { status: 400 }
      );
    }

    // Validate message structure
    if (!message.sourceDomain || !message.destinationDomain || !message.nonce) {
      return NextResponse.json(
        { error: 'Invalid CCTP message structure' },
        { status: 400 }
      );
    }

    // Serialize CCTP message
    const serializedMessage = serializeCCTPMessage(message as CCTPMessage);

    // Compute keccak256 hash using @noble/hashes (already installed)
    const hash = keccak256(serializedMessage);
    const depositMessageHash = `0x${hash}`;

    return NextResponse.json({
      depositMessageHash,
      messageHash: hash, // Without 0x prefix
    });
  } catch (error: any) {
    console.error('[API] Error computing depositMessageHash:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compute depositMessageHash' },
      { status: 500 }
    );
  }
}

