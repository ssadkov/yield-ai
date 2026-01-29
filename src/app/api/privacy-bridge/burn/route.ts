import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { executePrivacyCashBridge } from "@/lib/privacy-cash-bridge";

function stripEnv(s: string): string {
  return s.replace(/^["']|["']$/g, "").trim();
}

/** Server-side RPC URL. Uses full URL; if no api-key in URL, appends SOLANA_RPC_API_KEY. */
function getSolanaRpcUrl(): string {
  const fullUrl = stripEnv(process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "");
  const apiKey = stripEnv(process.env.SOLANA_RPC_API_KEY || process.env.NEXT_PUBLIC_SOLANA_RPC_API_KEY || "");

  if (fullUrl) {
    const hasKey = /[?&](api[_-]?key|token)=/i.test(fullUrl);
    if (hasKey) return fullUrl;
    if (apiKey) {
      const sep = fullUrl.includes("?") ? "&" : "?";
      return `${fullUrl}${sep}api-key=${apiKey}`;
    }
    return fullUrl;
  }

  if (apiKey) {
    return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  }
  return "https://api.mainnet-beta.solana.com";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tmpWalletPrivateKey, aptosRecipient } = body;

    if (!tmpWalletPrivateKey || typeof tmpWalletPrivateKey !== "string") {
      return NextResponse.json(
        { error: "tmpWalletPrivateKey (base58 string) is required" },
        { status: 400 }
      );
    }
    if (!aptosRecipient || typeof aptosRecipient !== "string") {
      return NextResponse.json(
        { error: "aptosRecipient (Aptos address string) is required" },
        { status: 400 }
      );
    }

    const payerPk = process.env.SOLANA_PAYER_WALLET_PRIVATE_KEY;
    const payerAddressEnv = process.env.SOLANA_PAYER_WALLET_ADDRESS;

    if (!payerPk) {
      return NextResponse.json(
        {
          error:
            "Burn API is not configured: SOLANA_PAYER_WALLET_PRIVATE_KEY is not set on the server. Add it to .env.local for local dev or to Vercel env for production.",
        },
        { status: 503 }
      );
    }

    let tmpKeypair: Keypair;
    let feePayerKeypair: Keypair;
    try {
      tmpKeypair = Keypair.fromSecretKey(bs58.decode(tmpWalletPrivateKey.trim()));
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid tmpWalletPrivateKey (base58 secret key expected)" },
        { status: 400 }
      );
    }
    try {
      feePayerKeypair = Keypair.fromSecretKey(bs58.decode(payerPk.trim()));
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid SOLANA_PAYER_WALLET_PRIVATE_KEY on the server" },
        { status: 500 }
      );
    }

    const derivedPayerAddress = feePayerKeypair.publicKey.toBase58();
    if (payerAddressEnv && derivedPayerAddress !== payerAddressEnv.trim()) {
      return NextResponse.json(
        {
          error: `Fee payer address mismatch: key derives to ${derivedPayerAddress.slice(0, 8)}..., env expects ${payerAddressEnv.slice(0, 8)}...`,
        },
        { status: 500 }
      );
    }

    const rpcUrl = getSolanaRpcUrl();
    const connection = new Connection(rpcUrl, "confirmed");

    const signature = await executePrivacyCashBridge({
      tmpKeypair,
      feePayerKeypair,
      solanaConnection: connection,
      aptosRecipient: aptosRecipient.trim(),
    });

    return NextResponse.json({ signature });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[privacy-bridge/burn]", message);
    const isRpcAuth =
      typeof message === "string" &&
      (message.includes("401") || message.toLowerCase().includes("missing api key"));
    const errorMessage = isRpcAuth
      ? message + " Set SOLANA_RPC_URL (full URL with api-key) or SOLANA_RPC_API_KEY on the server."
      : message;
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
