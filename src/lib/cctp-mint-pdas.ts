// CCTP PDA generation functions
// Extracted from minting-solana page for reusability

import { PublicKey, Connection } from "@solana/web3.js";
import bs58 from "bs58";

// Circle CCTP v1 program IDs on Solana Mainnet
export const TOKEN_MESSENGER_MINTER_PROGRAM_ID = new PublicKey("CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3");
export const MESSAGE_TRANSMITTER_PROGRAM_ID = new PublicKey("CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd");
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Expected PDAs from successful transactions
const EXPECTED_AUTHORITY_PDA = 'CFtn7PC5NsaFAuG65LwvhcGVD2MiqSpMJ7yvpyhsgJwW';
const EXPECTED_EVENT_AUTHORITY_PDA = '6mH8scevHQJsyyp1qxu8kyAapHuzEE67mtjFDJZjSbQW';
const EXPECTED_REMOTE_TOKEN_MESSENGER_PDA = '3CTbq3SF9gekPHiJwLsyivfVbuaRFAQwQ6eQgtNy8nP1';
const EXPECTED_TOKEN_PAIR_PDA = 'C7XDQkHdr7omXt3Z4u3AuwQx9Za4AswzifnmKaoRhvLp';
const EXPECTED_EVENT_AUTHORITY_FOR_CPI = 'CNfZLeeL4RUxwfPnjA3tLiQt4y43jp4V7bMpga673jf9';

export interface CCTPPDAs {
  messageTransmitterStateAccount: PublicKey;
  messageTransmitterBump: number;
  messageTransmitterAuthorityPDA: PublicKey;
  tokenMessengerPDA: PublicKey;
  eventAuthorityPDA: PublicKey;
  remoteTokenMessengerPDA: PublicKey;
  tokenMinterPDA: PublicKey;
  localTokenPDA: PublicKey;
  usedNoncesPDA: PublicKey;
  tokenPairPDA: PublicKey;
  custodyTokenAccountPDA: PublicKey;
  eventAuthorityForCPI: PublicKey;
}

/**
 * Find message transmitter state account PDA
 */
export async function findMessageTransmitterStateAccount(
  connection: Connection
): Promise<{ pda: PublicKey; bump: number; accountInfo: any }> {
  // Circle mainnet может использовать seed "state" для state account — пробуем первым
  const possiblePdaSeeds = [
    [Buffer.from("state")],
    [Buffer.from("message_transmitter")],
    [Buffer.from("message_transmitter_state")],
  ];

  for (const seeds of possiblePdaSeeds) {
    try {
      const [pda, bump] = PublicKey.findProgramAddressSync(
        seeds,
        MESSAGE_TRANSMITTER_PROGRAM_ID
      );

      try {
        const accountInfo = await connection.getAccountInfo(pda);
        if (accountInfo && accountInfo.owner.equals(MESSAGE_TRANSMITTER_PROGRAM_ID)) {
          console.log('[CCTP PDAs] Found message_transmitter state account:', {
            address: pda.toBase58(),
            seeds: seeds.map(s => s.toString()),
            bump,
            owner: accountInfo.owner.toBase58(),
            dataLength: accountInfo.data.length,
          });
          return { pda, bump, accountInfo };
        }
      } catch (fetchError: any) {
        console.log('[CCTP PDAs] Account not found or network error for seeds:', seeds.map(s => s.toString()), fetchError.message);
      }
    } catch (error) {
      continue;
    }
  }

  // Fallback to program ID
  console.warn('[CCTP PDAs] WARNING: Could not find message_transmitter state PDA, using program ID as fallback');
  const pda = MESSAGE_TRANSMITTER_PROGRAM_ID;
  const bump = 0;
  let accountInfo = null;
  try {
    accountInfo = await connection.getAccountInfo(MESSAGE_TRANSMITTER_PROGRAM_ID);
  } catch (error) {
    console.warn('[CCTP PDAs] Could not fetch program ID account info, continuing anyway');
  }
  return { pda, bump, accountInfo };
}

/**
 * Find message transmitter authority PDA
 */
export function findMessageTransmitterAuthorityPDA(
  messageTransmitterStateAccount: PublicKey
): PublicKey {
  const possibleAuthoritySeeds = [
    { name: '["authority"]', seeds: [Buffer.from("authority")] },
    { name: '["authority_pda"]', seeds: [Buffer.from("authority_pda")] },
    { name: '["authority_pda", message_transmitter_state]', seeds: [Buffer.from("authority_pda"), messageTransmitterStateAccount.toBuffer()] },
    { name: '["authority", message_transmitter_state]', seeds: [Buffer.from("authority"), messageTransmitterStateAccount.toBuffer()] },
  ];

  for (const variant of possibleAuthoritySeeds) {
    const [pda] = PublicKey.findProgramAddressSync(
      variant.seeds,
      MESSAGE_TRANSMITTER_PROGRAM_ID
    );

    if (pda.toBase58() === EXPECTED_AUTHORITY_PDA) {
      console.log('[CCTP PDAs] ✅ Found correct authority PDA:', pda.toBase58());
      console.log('[CCTP PDAs] ✅ Using seeds:', variant.name);
      return pda;
    }
  }

  // Fallback to hardcoded value
  console.warn('[CCTP PDAs] ⚠️ Could not find expected authority PDA, using hardcoded value');
  return new PublicKey(EXPECTED_AUTHORITY_PDA);
}

/**
 * Find event authority PDA
 */
export function findEventAuthorityPDA(
  messageTransmitterStateAccount: PublicKey
): PublicKey {
  const possibleEventAuthoritySeeds = [
    { name: '["__event_authority"]', seeds: [Buffer.from("__event_authority")] },
    { name: '["event_authority"]', seeds: [Buffer.from("event_authority")] },
    { name: '["event"]', seeds: [Buffer.from("event")] },
    { name: '["__event_authority", message_transmitter_state]', seeds: [Buffer.from("__event_authority"), messageTransmitterStateAccount.toBuffer()] },
    { name: '["event_authority", message_transmitter_state]', seeds: [Buffer.from("event_authority"), messageTransmitterStateAccount.toBuffer()] },
  ];

  // Try with MESSAGE_TRANSMITTER_PROGRAM_ID first
  for (const variant of possibleEventAuthoritySeeds) {
    const [pda] = PublicKey.findProgramAddressSync(
      variant.seeds,
      MESSAGE_TRANSMITTER_PROGRAM_ID
    );

    if (pda.toBase58() === EXPECTED_EVENT_AUTHORITY_PDA) {
      console.log('[CCTP PDAs] ✅ Found correct event_authority PDA:', pda.toBase58());
      console.log('[CCTP PDAs] ✅ Using seeds:', variant.name);
      return pda;
    }
  }

  // Try with TOKEN_MESSENGER_MINTER_PROGRAM_ID
  for (const variant of possibleEventAuthoritySeeds) {
    const [pda] = PublicKey.findProgramAddressSync(
      variant.seeds,
      TOKEN_MESSENGER_MINTER_PROGRAM_ID
    );

    if (pda.toBase58() === EXPECTED_EVENT_AUTHORITY_PDA) {
      console.log('[CCTP PDAs] ✅ Found correct event_authority PDA with TokenMessengerMinter program:', pda.toBase58());
      console.log('[CCTP PDAs] ✅ Using seeds:', variant.name);
      return pda;
    }
  }

  // Fallback to hardcoded value
  console.warn('[CCTP PDAs] ⚠️ Could not find expected event_authority PDA, using hardcoded value');
  return new PublicKey(EXPECTED_EVENT_AUTHORITY_PDA);
}

/**
 * Find remote token messenger PDA
 */
export function findRemoteTokenMessengerPDA(sourceDomain: number): PublicKey {
  const sourceDomainBufferLE = Buffer.allocUnsafe(4);
  sourceDomainBufferLE.writeUInt32LE(sourceDomain, 0);

  const sourceDomainBufferBE = Buffer.allocUnsafe(4);
  sourceDomainBufferBE.writeUInt32BE(sourceDomain, 0);

  const sourceDomainU8Array = new Uint8Array([sourceDomain, 0, 0, 0]);
  const sourceDomainU8ArrayBE = new Uint8Array([0, 0, 0, sourceDomain]);

  const possibleRemoteTokenMessengerSeeds = [
    { name: '["remote_token_messenger", source_domain (u32 LE)]', seeds: [Buffer.from("remote_token_messenger"), sourceDomainBufferLE] },
    { name: '["remote_token_messenger", source_domain (u32 BE)]', seeds: [Buffer.from("remote_token_messenger"), sourceDomainBufferBE] },
    { name: '["remote_token_messenger", source_domain (u8 array)]', seeds: [Buffer.from("remote_token_messenger"), Buffer.from(sourceDomainU8Array)] },
    { name: '["remote_token_messenger", source_domain (u8 array BE)]', seeds: [Buffer.from("remote_token_messenger"), Buffer.from(sourceDomainU8ArrayBE)] },
    { name: '["remote_token_messenger", source_domain (as string)]', seeds: [Buffer.from("remote_token_messenger"), Buffer.from(sourceDomain.toString())] },
    { name: '["remote_token_messenger", source_domain (as u8)]', seeds: [Buffer.from("remote_token_messenger"), Buffer.from([sourceDomain])] },
  ];

  for (const variant of possibleRemoteTokenMessengerSeeds) {
    const [pda] = PublicKey.findProgramAddressSync(
      variant.seeds,
      TOKEN_MESSENGER_MINTER_PROGRAM_ID
    );

    if (pda.toBase58() === EXPECTED_REMOTE_TOKEN_MESSENGER_PDA) {
      console.log('[CCTP PDAs] ✅ Found correct remote_token_messenger PDA:', pda.toBase58());
      console.log('[CCTP PDAs] ✅ Using seeds:', variant.name);
      return pda;
    }
  }

  // Fallback to hardcoded value
  console.warn('[CCTP PDAs] ⚠️ Could not find expected remote_token_messenger PDA, using hardcoded value');
  return new PublicKey(EXPECTED_REMOTE_TOKEN_MESSENGER_PDA);
}

/**
 * Circle state.rs: UsedNonces::used_nonces_seed_delimiter(source_domain) — for domain >= 11 add b"-", else b"".
 */
function usedNoncesSeedDelimiter(sourceDomain: number): Buffer {
  return sourceDomain >= 11 ? Buffer.from("-") : Buffer.allocUnsafe(0);
}

/**
 * Find used nonces PDA
 * Circle receive_message.rs: seeds = [
 *   b"used_nonces",
 *   source_domain.to_string().as_bytes(),   // строка "9", не u32 LE
 *   used_nonces_seed_delimiter(source_domain),
 *   first_nonce.to_string().as_bytes()       // строка "89601", не u64 LE
 * ]
 */
export function findUsedNoncesPDA(
  _messageTransmitterStateAccount: PublicKey,
  sourceDomain: number,
  eventNonce: string
): PublicKey {
  const finalNonce = BigInt(eventNonce);
  const firstNonce = (finalNonce - BigInt(1)) / BigInt(6400) * BigInt(6400) + BigInt(1);

  const sourceDomainStr = Buffer.from(sourceDomain.toString(), "utf8");
  const firstNonceStr = Buffer.from(firstNonce.toString(), "utf8");
  const delimiter = usedNoncesSeedDelimiter(sourceDomain);

  const seeds: Buffer[] = [
    Buffer.from("used_nonces"),
    sourceDomainStr,
  ];
  if (delimiter.length > 0) seeds.push(delimiter);
  seeds.push(firstNonceStr);

  const [pda] = PublicKey.findProgramAddressSync(seeds, MESSAGE_TRANSMITTER_PROGRAM_ID);
  return pda;
}

/**
 * Find token pair PDA
 */
export function findTokenPairPDA(
  sourceDomain: number,
  burnTokenBytes: Uint8Array
): PublicKey {
  const sourceDomainBufferLE = Buffer.allocUnsafe(4);
  sourceDomainBufferLE.writeUInt32LE(sourceDomain, 0);

  const sourceDomainBufferBE = Buffer.allocUnsafe(4);
  sourceDomainBufferBE.writeUInt32BE(sourceDomain, 0);

  const sourceDomainU8Array = new Uint8Array([sourceDomain, 0, 0, 0]);
  const sourceDomainU8ArrayBE = new Uint8Array([0, 0, 0, sourceDomain]);

  const burnTokenBase58 = bs58.encode(burnTokenBytes);
  const burnTokenPublicKey = new PublicKey(burnTokenBase58);
  const burnTokenFromBase58 = burnTokenPublicKey.toBuffer();

  const possibleTokenPairSeeds = [
    { name: '["token_pair", source_domain (u32 LE), burn_token (from base58 PublicKey)]', seeds: [Buffer.from("token_pair"), sourceDomainBufferLE, burnTokenFromBase58] },
    { name: '["token_pair", source_domain (u32 BE), burn_token (from base58 PublicKey)]', seeds: [Buffer.from("token_pair"), sourceDomainBufferBE, burnTokenFromBase58] },
    { name: '["token_pair", source_domain (as string), burn_token (from base58 PublicKey)]', seeds: [Buffer.from("token_pair"), Buffer.from(sourceDomain.toString()), burnTokenFromBase58] },
    { name: '["token_pair", source_domain (u8 array), burn_token (from base58 PublicKey)]', seeds: [Buffer.from("token_pair"), Buffer.from(sourceDomainU8Array), burnTokenFromBase58] },
    { name: '["token_pair", source_domain (u8 array BE), burn_token (from base58 PublicKey)]', seeds: [Buffer.from("token_pair"), Buffer.from(sourceDomainU8ArrayBE), burnTokenFromBase58] },
    { name: '["token_pair", source_domain (as u8), burn_token (from base58 PublicKey)]', seeds: [Buffer.from("token_pair"), Buffer.from([sourceDomain]), burnTokenFromBase58] },
    { name: '["token_pair", source_domain (u32 LE), burn_token (32 bytes)]', seeds: [Buffer.from("token_pair"), sourceDomainBufferLE, Buffer.from(burnTokenBytes)] },
    { name: '["token_pair", source_domain (as string), burn_token (32 bytes)]', seeds: [Buffer.from("token_pair"), Buffer.from(sourceDomain.toString()), Buffer.from(burnTokenBytes)] },
  ];

  for (const variant of possibleTokenPairSeeds) {
    const [pda] = PublicKey.findProgramAddressSync(
      variant.seeds,
      TOKEN_MESSENGER_MINTER_PROGRAM_ID
    );

    if (pda.toBase58() === EXPECTED_TOKEN_PAIR_PDA) {
      console.log('[CCTP PDAs] ✅ Found correct token_pair PDA:', pda.toBase58());
      console.log('[CCTP PDAs] ✅ Using seeds:', variant.name);
      return pda;
    }
  }

  // Fallback to hardcoded value
  console.warn('[CCTP PDAs] ⚠️ Could not find expected token_pair PDA, using hardcoded value');
  return new PublicKey(EXPECTED_TOKEN_PAIR_PDA);
}

/**
 * Generate all CCTP PDAs needed for minting
 */
export async function generateAllCCTPPDAs(
  connection: Connection,
  sourceDomain: number,
  eventNonce: string,
  burnTokenBytes: Uint8Array
): Promise<CCTPPDAs> {
  // Message transmitter state account
  const { pda: messageTransmitterStateAccount, bump: messageTransmitterBump } = await findMessageTransmitterStateAccount(connection);

  // Message transmitter authority PDA
  const messageTransmitterAuthorityPDA = findMessageTransmitterAuthorityPDA(messageTransmitterStateAccount);

  // Token messenger PDA
  const [tokenMessengerPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_messenger")],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID
  );

  // Event authority PDA
  const eventAuthorityPDA = findEventAuthorityPDA(messageTransmitterStateAccount);

  // Remote token messenger PDA
  const remoteTokenMessengerPDA = findRemoteTokenMessengerPDA(sourceDomain);

  // Token minter PDA
  const [tokenMinterPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_minter")],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID
  );

  // Local token PDA
  const [localTokenPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("local_token"), USDC_MINT.toBuffer()],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID
  );

  // Used nonces PDA
  const usedNoncesPDA = findUsedNoncesPDA(messageTransmitterStateAccount, sourceDomain, eventNonce);

  // Token pair PDA
  const tokenPairPDA = findTokenPairPDA(sourceDomain, burnTokenBytes);

  // Custody token account PDA
  const [custodyTokenAccountPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("custody"), USDC_MINT.toBuffer()],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID
  );

  // Token program event authority PDA (for CPI)
  const [eventAuthorityForCPI] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    TOKEN_MESSENGER_MINTER_PROGRAM_ID
  );

  return {
    messageTransmitterStateAccount,
    messageTransmitterBump,
    messageTransmitterAuthorityPDA,
    tokenMessengerPDA,
    eventAuthorityPDA,
    remoteTokenMessengerPDA,
    tokenMinterPDA,
    localTokenPDA,
    usedNoncesPDA,
    tokenPairPDA,
    custodyTokenAccountPDA,
    eventAuthorityForCPI,
  };
}
