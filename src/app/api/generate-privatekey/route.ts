import { NextRequest, NextResponse } from "next/server";
import { Account } from "@aptos-labs/ts-sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";

type Body = {
  mnemonic: string;
  chain: "solana" | "aptos";
  /**
   * Optional: for Solana, find the private key for this exact address by
   * scanning account indices (Trust Wallet may use a different index).
   */
  targetAddress?: string;
  /** Optional: max Solana account index to scan (inclusive). Default 20. */
  maxAccountIndex?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { mnemonic, chain, targetAddress, maxAccountIndex } = body || {};

    if (!mnemonic || typeof mnemonic !== "string") {
      return NextResponse.json(
        { error: "Mnemonic (seed phrase) is required" },
        { status: 400 }
      );
    }

    if (chain !== "solana" && chain !== "aptos") {
      return NextResponse.json(
        { error: "Invalid chain. Must be 'solana' or 'aptos'." },
        { status: 400 }
      );
    }

    // Normalize mnemonic (trim and collapse spaces)
    const normalizedMnemonic = mnemonic
      .trim()
      .split(/\s+/)
      .join(" ");

    const isValid = bip39.validateMnemonic(normalizedMnemonic);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid BIP39 mnemonic phrase" },
        { status: 400 }
      );
    }

    if (chain === "aptos") {
      const account = Account.fromDerivationPath({
        mnemonic: normalizedMnemonic,
        path: "m/44'/637'/0'/0'/0'",
      });

      return NextResponse.json({
        chain: "aptos",
        address: account.accountAddress.toString(),
        privateKey: account.privateKey.toString(),
        derivationPath: "m/44'/637'/0'/0'/0'",
      });
    }

    // Solana
    const seed = await bip39.mnemonicToSeed(normalizedMnemonic);
    const seedHex = seed.toString("hex");

    // If targetAddress is provided, scan account indices to find the exact match.
    // We keep the same structure as the original derivation path, but vary the account index:
    // m/44'/501'/{accountIndex}'/0'
    if (targetAddress && typeof targetAddress === "string" && targetAddress.trim().length > 0) {
      const cleanTarget = targetAddress.trim();
      const maxIdx =
        typeof maxAccountIndex === "number" && Number.isFinite(maxAccountIndex)
          ? Math.max(0, Math.min(10_000, Math.floor(maxAccountIndex)))
          : 20;

      // Quick sanity check: must be a valid base58 Solana public key
      try {
        // eslint-disable-next-line no-new
        new PublicKey(cleanTarget);
      } catch (e: any) {
        return NextResponse.json(
          { error: `Invalid Solana targetAddress: ${e?.message ?? "invalid base58 public key"}` },
          { status: 400 }
        );
      }

      for (let i = 0; i <= maxIdx; i++) {
        const path = `m/44'/501'/${i}'/0'`;
        const derived = derivePath(path, seedHex);
        const keypair = Keypair.fromSeed(derived.key);
        const address = keypair.publicKey.toBase58();
        if (address === cleanTarget) {
          return NextResponse.json({
            chain: "solana",
            address,
            privateKey: bs58.encode(keypair.secretKey),
            derivationPath: path,
            matchedAccountIndex: i,
            scannedUpTo: maxIdx,
          });
        }
      }

      return NextResponse.json(
        {
          error:
            `Target Solana address not found for this mnemonic within indices 0..${maxIdx}. ` +
            `Try increasing maxAccountIndex or verify the address/mnemonic.`,
        },
        { status: 404 }
      );
    }

    // Default behavior (backward compatible): original fixed derivation path
    const defaultPath = "m/44'/501'/0'/0'";
    const derived = derivePath(defaultPath, seedHex);
    const keypair = Keypair.fromSeed(derived.key);

    return NextResponse.json({
      chain: "solana",
      address: keypair.publicKey.toBase58(),
      privateKey: bs58.encode(keypair.secretKey),
      derivationPath: defaultPath,
    });
  } catch (e: any) {
    console.error("[generate-privatekey] Error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to generate private key" },
      { status: 500 }
    );
  }
}

