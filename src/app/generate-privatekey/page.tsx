"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";

type Chain = "solana" | "aptos";

function base64ToBytes(base64: string): Uint8Array {
  // Support both plain base64 and data URLs (e.g. "data:...;base64,....")
  const trimmed = base64.trim();
  const commaIdx = trimmed.indexOf(",");
  const b64 = commaIdx >= 0 && trimmed.slice(0, commaIdx).includes("base64")
    ? trimmed.slice(commaIdx + 1).trim()
    : trimmed;

  // Remove whitespace/newlines
  const clean = b64.replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export default function GeneratePrivateKeyPage() {
  const { toast } = useToast();

  const [mnemonic, setMnemonic] = useState("");
  const [chain, setChain] = useState<Chain>("solana");
  const [isGenerating, setIsGenerating] = useState(false);
  const [targetAddress, setTargetAddress] = useState("");
  const [maxAccountIndex, setMaxAccountIndex] = useState<string>("20");
  const [result, setResult] = useState<{
    address: string;
    privateKey: string;
    derivationPath: string;
    matchedAccountIndex?: number;
    scannedUpTo?: number;
  } | null>(null);

  const [twEncoded, setTwEncoded] = useState("");
  const [twPassword, setTwPassword] = useState("");
  const [twDecoded, setTwDecoded] = useState<string | null>(null);
  const [twError, setTwError] = useState<string | null>(null);
  const [twIsDecoding, setTwIsDecoding] = useState(false);

  const handleGenerate = async () => {
    if (!mnemonic.trim()) {
      toast({
        variant: "destructive",
        title: "Seed phrase required",
        description: "Please enter a BIP39 seed phrase.",
      });
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const res = await fetch("/api/generate-privatekey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mnemonic,
          chain,
          ...(chain === "solana" && targetAddress.trim()
            ? {
                targetAddress: targetAddress.trim(),
                maxAccountIndex: Number.isFinite(Number(maxAccountIndex))
                  ? Number(maxAccountIndex)
                  : 20,
              }
            : {}),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to generate private key");
      }

      setResult({
        address: json.address,
        privateKey: json.privateKey,
        derivationPath: json.derivationPath,
        matchedAccountIndex: json.matchedAccountIndex,
        scannedUpTo: json.scannedUpTo,
      });

      toast({
        title: "Private key generated",
        description:
          "Private key and address have been derived from the seed phrase. Keep them secret.",
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: e?.message ?? "Unknown error while generating private key.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDecodeTrustWallet = async () => {
    setTwIsDecoding(true);
    setTwDecoded(null);
    setTwError(null);

    try {
      if (!twEncoded.trim()) {
        throw new Error("Paste the base64-encoded string first.");
      }
      if (!twPassword) {
        throw new Error("Enter the encryption password.");
      }

      const decoded = base64ToBytes(twEncoded);
      if (decoded.length <= 16) {
        throw new Error("Decoded data is too short (expected IV + ciphertext).");
      }

      const iv = decoded.slice(0, 16);
      const ciphertext = decoded.slice(16);

      // Key = SHA-256(password) (matches the OpenSSL guide you pasted)
      const keyMaterial = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(twPassword)
      );
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyMaterial,
        { name: "AES-CBC" },
        false,
        ["decrypt"]
      );

      const plainBuf = await crypto.subtle.decrypt(
        { name: "AES-CBC", iv },
        cryptoKey,
        ciphertext
      );

      const plainBytes = new Uint8Array(plainBuf);
      const text = bytesToUtf8(plainBytes).trim();
      setTwDecoded(text || bytesToUtf8(plainBytes));

      toast({
        title: "Decoded",
        description: "Decryption succeeded locally in your browser.",
      });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setTwError(msg);
      toast({
        variant: "destructive",
        title: "Decode failed",
        description: msg,
      });
    } finally {
      setTwIsDecoding(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <Card className="w-full max-w-2xl border-2">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold">Generate Private Key</h1>
            <p className="text-sm text-muted-foreground">
              Derive a private key and address from a BIP39 seed phrase for Solana or Aptos.
            </p>
            <p className="text-xs text-red-500">
              WARNING: Never paste your main wallet&apos;s seed phrase here in production. Use this
              only for test or temporary wallets.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Seed phrase (mnemonic)
              </label>
              <Input
                type="text"
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                placeholder="Enter 12/24-word BIP39 seed phrase"
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Chain
              </label>
              <Select
                value={chain}
                onValueChange={(v) => setChain(v as Chain)}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solana">Solana</SelectItem>
                  <SelectItem value="aptos">Aptos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {chain === "solana" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Target Solana address (optional)
                  </label>
                  <Input
                    type="text"
                    value={targetAddress}
                    onChange={(e) => setTargetAddress(e.target.value)}
                    placeholder="Paste the Solana address you want to match (e.g. 9XL5...)"
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    If provided, the backend will scan derivation paths{" "}
                    <span className="font-mono">m/44&apos;/501&apos;/i&apos;/0&apos;</span>{" "}
                    for i=0..N to find this exact address.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Max account index (N)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={maxAccountIndex}
                    onChange={(e) => setMaxAccountIndex(e.target.value)}
                    placeholder="20"
                    className="font-mono text-xs"
                  />
                </div>
              </>
            )}
          </div>

          {result && (
            <div className="p-3 bg-muted rounded text-xs space-y-1 break-all">
              <div>
                <span className="font-semibold">Derivation path:</span>{" "}
                <span>{result.derivationPath}</span>
              </div>
              <div>
                <span className="font-semibold">Address:</span>{" "}
                <span>{result.address}</span>
              </div>
              {typeof result.matchedAccountIndex === "number" && (
                <div>
                  <span className="font-semibold">Matched account index:</span>{" "}
                  <span>{result.matchedAccountIndex}</span>
                </div>
              )}
              <div>
                <span className="font-semibold">Private key:</span>{" "}
                <span>{result.privateKey}</span>
              </div>
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !mnemonic.trim()}
            className="w-full h-11 text-sm font-semibold"
          >
            {isGenerating ? "Generating..." : "Generate private key"}
          </Button>

          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <p>• For Solana, derivation path: m/44&apos;/501&apos;/0&apos;/0&apos;.</p>
            <p>• For Aptos, derivation path: m/44&apos;/637&apos;/0&apos;/0&apos;/0&apos;.</p>
            <p>• For Trust Wallet Solana, you may need a different account index: m/44&apos;/501&apos;/i&apos;/0&apos;.</p>
            <p>• Keep derived keys and seed phrases strictly confidential.</p>
          </div>

          <div className="pt-6 border-t space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Decode Trust Wallet Private Key</h2>
              <p className="text-xs text-muted-foreground">
                Decrypts Trust Wallet exported data locally (AES-256-CBC, IV=first 16 bytes, key=SHA-256(password)).
              </p>
              <p className="text-[11px] text-red-500">
                WARNING: This will handle sensitive data in your browser. Close the tab after use.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Base64-encoded payload
              </label>
              <Input
                type="text"
                value={twEncoded}
                onChange={(e) => setTwEncoded(e.target.value)}
                placeholder="Paste the base64 string (encoded.txt content)"
                className="font-mono text-xs"
              />
              {twError && <p className="text-xs text-destructive">{twError}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Encryption password
              </label>
              <Input
                type="password"
                value={twPassword}
                onChange={(e) => setTwPassword(e.target.value)}
                placeholder="Password used to encrypt the export"
                className="font-mono text-xs"
              />
            </div>

            <Button
              onClick={handleDecodeTrustWallet}
              disabled={twIsDecoding || !twEncoded.trim() || !twPassword}
              className="w-full h-11 text-sm font-semibold"
              variant="outline"
            >
              {twIsDecoding ? "Decoding..." : "Decode"}
            </Button>

            {twDecoded !== null && (
              <div className="p-3 bg-muted rounded text-xs space-y-1 break-all">
                <div className="font-semibold">Result:</div>
                <div className="font-mono whitespace-pre-wrap">{twDecoded}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

