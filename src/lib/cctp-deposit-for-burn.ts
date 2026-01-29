/**
 * Server-safe CCTP depositForBurn instruction builder.
 * No "use client" — safe to import from API routes and lib.
 */

import { createHash } from "crypto";
import {
  PublicKey,
  TransactionInstruction,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

function findProgramAddress(
  label: string,
  programId: PublicKey,
  extraSeeds?: (string | Buffer | PublicKey | Uint8Array)[]
): { publicKey: PublicKey; bump: number } {
  const seeds: Buffer[] = [Buffer.from(label, "utf8")];
  if (extraSeeds) {
    for (const extraSeed of extraSeeds) {
      if (typeof extraSeed === "string") {
        seeds.push(Buffer.from(extraSeed, "utf8"));
      } else if (Buffer.isBuffer(extraSeed)) {
        seeds.push(extraSeed);
      } else if (extraSeed instanceof PublicKey) {
        seeds.push(extraSeed.toBuffer());
      } else if (extraSeed instanceof Uint8Array) {
        seeds.push(Buffer.from(extraSeed));
      }
    }
  }
  const [publicKey, bump] = PublicKey.findProgramAddressSync(seeds, programId);
  return { publicKey, bump };
}

/** Anchor discriminator = first 8 bytes of SHA256("global:instruction_name"). Node crypto. */
function computeDiscriminator(instructionName: string): Buffer {
  const data = Buffer.from(`global:${instructionName}`, "utf8");
  const hash = createHash("sha256").update(data).digest();
  return Buffer.from(hash.slice(0, 8));
}

/**
 * Creates depositForBurn instruction (Circle CCTP TokenMessengerMinter).
 * Safe to call from server (API routes) and client.
 */
export async function createDepositForBurnInstructionManual(
  tokenMessengerProgramId: PublicKey,
  messageTransmitterProgramId: PublicKey,
  tokenMint: PublicKey,
  destinationDomain: number,
  senderAddress: PublicKey,
  eventRentPayerAddress: PublicKey,
  senderAssociatedTokenAccountAddress: PublicKey,
  mintRecipientBytes: Uint8Array,
  amount: bigint,
  messageSendEventData: PublicKey,
  messageSendEventDataKeypair: Keypair
): Promise<{ instruction: TransactionInstruction; messageSendEventDataKeypair: Keypair }> {
  const messageTransmitterAccount = findProgramAddress(
    "message_transmitter",
    messageTransmitterProgramId
  );
  const tokenMessenger = findProgramAddress(
    "token_messenger",
    tokenMessengerProgramId
  );
  const tokenMinter = findProgramAddress(
    "token_minter",
    tokenMessengerProgramId
  );
  const localToken = findProgramAddress("local_token", tokenMessengerProgramId, [
    tokenMint,
  ]);
  const remoteTokenMessengerKey = findProgramAddress(
    "remote_token_messenger",
    tokenMessengerProgramId,
    [destinationDomain.toString()]
  );
  const authorityPda = findProgramAddress(
    "sender_authority",
    tokenMessengerProgramId
  );
  const eventAuthority = findProgramAddress(
    "__event_authority",
    tokenMessengerProgramId
  );

  const discriminator = computeDiscriminator("deposit_for_burn");

  const amountBuffer = Buffer.allocUnsafe(8);
  let amountValue = amount;
  for (let i = 0; i < 8; i++) {
    amountBuffer[i] = Number(amountValue & BigInt(0xff));
    amountValue = amountValue >> BigInt(8);
  }

  const domainBuffer = Buffer.allocUnsafe(4);
  domainBuffer[0] = destinationDomain & 0xff;
  domainBuffer[1] = (destinationDomain >> 8) & 0xff;
  domainBuffer[2] = (destinationDomain >> 16) & 0xff;
  domainBuffer[3] = (destinationDomain >> 24) & 0xff;

  const instructionData = Buffer.concat([
    discriminator,
    amountBuffer,
    domainBuffer,
    Buffer.from(mintRecipientBytes),
  ]);

  const instructionKeys = [
    { pubkey: senderAddress, isSigner: true, isWritable: false },
    { pubkey: eventRentPayerAddress, isSigner: true, isWritable: true },
    { pubkey: authorityPda.publicKey, isSigner: false, isWritable: false },
    {
      pubkey: senderAssociatedTokenAccountAddress,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: messageTransmitterAccount.publicKey,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: tokenMessenger.publicKey, isSigner: false, isWritable: false },
    {
      pubkey: remoteTokenMessengerKey.publicKey,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: tokenMinter.publicKey, isSigner: false, isWritable: false },
    { pubkey: localToken.publicKey, isSigner: false, isWritable: true },
    { pubkey: tokenMint, isSigner: false, isWritable: true },
    { pubkey: messageSendEventData, isSigner: true, isWritable: true },
    {
      pubkey: messageTransmitterProgramId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: tokenMessengerProgramId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: eventAuthority.publicKey, isSigner: false, isWritable: false },
    {
      pubkey: tokenMessengerProgramId,
      isSigner: false,
      isWritable: false,
    },
  ];

  return {
    instruction: new TransactionInstruction({
      programId: tokenMessengerProgramId,
      keys: instructionKeys,
      data: instructionData,
    }),
    messageSendEventDataKeypair,
  };
}
