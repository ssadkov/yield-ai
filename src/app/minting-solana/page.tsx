"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useWallet as useSolanaWallet, useConnection } from "@solana/wallet-adapter-react";
import { SolanaWalletProviderWrapper } from "../bridge3/SolanaWalletProvider";
import { SolanaWalletSelector } from "@/components/SolanaWalletSelector";
import bs58 from "bs58";

interface AttestationData {
  messages?: Array<{
    attestation?: string;
    message?: string;
    eventNonce?: string;
  }>;
}

// Circle CCTP TokenMessengerMinter program ID on Solana Mainnet
// const TOKEN_MESSENGER_MINTER_PROGRAM_ID = "CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3";
// const MESSAGE_TRANSMITTER_PROGRAM_ID = "CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd";

// Helper: Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    const byte = parseInt(cleanHex.substr(i, 2), 16);
    bytes.push(byte);
  }
  return new Uint8Array(bytes);
}

// Helper: Convert hex address (32 bytes, 64 hex chars) to Solana base58 address
function hexToSolanaBase58(hex: string): string {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (cleanHex.length !== 64) {
    throw new Error(`Hex address must be 64 characters (32 bytes), got ${cleanHex.length}`);
  }
  const bytes = hexToBytes(cleanHex);
  return bs58.encode(bytes);
}

// Helper: Fetch attestation from Circle Iris API with polling
async function fetchAttestation(
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
      console.log(`[Minting Solana] Fetching attestation, attempt ${attempt}/${maxAttempts}:`, url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`[Minting Solana] Attestation not ready yet (404), attempt ${attempt}/${maxAttempts}`);
          if (attempt === maxAttempts) {
            throw new Error(`Attestation not ready after ${maxAttempts} attempts. Please wait and try again.`);
          }
          continue;
        }

        const errorText = await response.text();
        console.error('[Minting Solana] Circle API error:', response.status, errorText);
        throw new Error(`Circle API error: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const attestationData: AttestationData = await response.json();

      // Validate attestation data
      if (!attestationData.messages || attestationData.messages.length === 0) {
        throw new Error('No messages found in attestation data');
      }

      const firstMessage = attestationData.messages[0];
      
      if (!firstMessage.message) {
        throw new Error('Message field is missing');
      }
      
      if (!firstMessage.attestation) {
        throw new Error('Attestation field is missing');
      }

      // Simplified check: only verify attestation is not explicitly "PENDING"
      // Don't validate format/length as it works on Aptos without these checks
      const attestationValue = firstMessage.attestation;
      if (typeof attestationValue === 'string') {
        const upperAttestation = attestationValue.toUpperCase().trim();
        if (upperAttestation === 'PENDING' || upperAttestation === 'PENDING...') {
          console.log('[Minting Solana] Attestation still pending:', {
            attestationValue: attestationValue.substring(0, 50),
          });
          if (attempt === maxAttempts) {
            throw new Error(`Attestation not ready yet. Status: ${attestationValue.substring(0, 50)}`);
          }
          continue;
        }
      }

      console.log('[Minting Solana] Attestation received successfully:', {
        messageLength: firstMessage.message.length,
        attestationLength: firstMessage.attestation.length,
        eventNonce: firstMessage.eventNonce,
      });

      return attestationData;
    } catch (error: any) {
      if (attempt === maxAttempts) {
        throw error;
      }
      // Continue retrying for network errors
      if (error.message?.includes('Attestation not ready')) {
        continue;
      }
      // For other errors, wait a bit and retry
      console.warn(`[Minting Solana] Error on attempt ${attempt}, retrying:`, error.message);
    }
  }

  throw new Error(`Failed to fetch attestation after ${maxAttempts} attempts`);
}

function MintingSolanaPageContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { publicKey: solanaPublicKey, wallet: solanaWallet, signTransaction } = useSolanaWallet();
  const { connection: solanaConnection } = useConnection();
  
  const SOURCE_DOMAIN_APTOS = 9;
  const [signature, setSignature] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");
  const [attestationProgress, setAttestationProgress] = useState<{ attempt: number; maxAttempts: number } | null>(null);

  useEffect(() => {
    const sig = searchParams.get("signature");
    if (sig) setSignature(sig);
  }, [searchParams]);

  const solanaAddress = solanaPublicKey?.toBase58() || null;

  const handleMint = async () => {
    if (!signature.trim()) {
      toast({
        title: "Error",
        description: "Please enter Aptos transaction signature",
        variant: "destructive",
      });
      return;
    }

    if (!solanaWallet || !solanaPublicKey || !signTransaction) {
      toast({
        title: "Error",
        description: "Please connect a Solana wallet (e.g. Trust Wallet)",
        variant: "destructive",
      });
      return;
    }

    const formRecipientFromWallet = solanaPublicKey.toBase58();

    setIsProcessing(true);
    setStatus("");
    setAttestationProgress(null);

    try {
      console.log('[Minting Solana] Starting mint process:', {
        sourceDomain: SOURCE_DOMAIN_APTOS,
        signature: signature.substring(0, 20) + '...',
        solanaWallet: solanaWallet.adapter?.name,
        solanaAddress: formRecipientFromWallet,
      });

      setStatus("Fetching attestation from Circle Iris API...");
      const attestationData = await fetchAttestation(
        SOURCE_DOMAIN_APTOS,
        signature.trim(),
        (attempt, maxAttempts) => {
          setAttestationProgress({ attempt, maxAttempts });
          setStatus(`Waiting for attestation... (attempt ${attempt}/${maxAttempts})`);
        }
      );

      setAttestationProgress(null);
      const firstMessage = attestationData.messages![0];
      
      // Step 2: Validate attestation data
      setStatus("Validating attestation data...");
      
      const messageBytes = hexToBytes(firstMessage.message!);
      const attestationBytes = hexToBytes(firstMessage.attestation!);

      console.log('[Minting Solana] Attestation validated:', {
        messageLength: messageBytes.length,
        attestationLength: attestationBytes.length,
        eventNonce: firstMessage.eventNonce,
      });

      // Decode CCTP message to extract mint_recipient and validate against form input
      // CCTP V1 message format (according to https://developers.circle.com/cctp/v1/message-format):
      // Header:
      // - version (4 bytes, uint32, offset 0) - use 0 for CCTP V1
      // - sourceDomain (4 bytes, uint32, offset 4)
      // - destinationDomain (4 bytes, uint32, offset 8)
      // - nonce (8 bytes, uint64, offset 12)
      // - sender (32 bytes, bytes32, offset 20)
      // - recipient (32 bytes, bytes32, offset 52)
      // - destinationCaller (32 bytes, bytes32, offset 84)
      // - messageBody (dynamic, offset 116)
      // Message Body (for TokenMessenger):
      //   - version (4 bytes, uint32, offset 0 in body)
      //   - burnToken (32 bytes, bytes32, offset 4 in body)
      //   - mintRecipient (32 bytes, bytes32, offset 36 in body) <- это нам нужно для проверки
      //   - amount (32 bytes, uint256, offset 68 in body)
      //   - messageSender (32 bytes, bytes32, offset 100 in body)
      //
      // Примечание: адрес может быть в hex формате (для Aptos) или уже в base58 (для Solana)
      // Если destinationDomain = 5 (Solana), адрес нужно преобразовать из hex в base58
      
      const formRecipient = formRecipientFromWallet;
      let mintRecipientFromMessage: string | null = null;
      
      // Преобразуем messageBytes в hex строку для поиска паттернов
      const messageHex = Array.from(messageBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      console.log('[Minting Solana] CCTP message hex (full):', messageHex);
      console.log('[Minting Solana] CCTP message length:', messageBytes.length, 'bytes');
      console.log('[Minting Solana] Recipient from form:', formRecipient);
      
      
      // Пытаемся найти mint_recipient в сообщении
      // Согласно пользователю, адрес находится после burnToken
      // burnToken известен: bae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b
      // После него должен быть mint_recipient: 7ea27ec6482a552f5ec5c9fc869dc351958971df0bfd181c5cc14b963700a119
      
      const knownBurnToken = 'bae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b';
      const expectedMintRecipientHex = '7ea27ec6482a552f5ec5c9fc869dc351958971df0bfd181c5cc14b963700a119';
      
      // Ищем burnToken в сообщении
      const burnTokenIndex = messageHex.indexOf(knownBurnToken);
      let mintRecipientHex: string | null = null;
      let mintRecipientOffset: number | null = null;
      
      if (burnTokenIndex !== -1) {
        // burnToken найден, mint_recipient должен быть сразу после него (64 hex символа = 32 байта)
        const mintRecipientStartIndex = burnTokenIndex + knownBurnToken.length;
        if (mintRecipientStartIndex + 64 <= messageHex.length) {
          mintRecipientHex = messageHex.substring(mintRecipientStartIndex, mintRecipientStartIndex + 64);
          // Вычисляем смещение в байтах
          mintRecipientOffset = mintRecipientStartIndex / 2; // каждый hex символ = 0.5 байта
          
          console.log('[Minting Solana] Found burnToken at hex index:', burnTokenIndex);
          console.log('[Minting Solana] mint_recipient hex index:', mintRecipientStartIndex);
          console.log('[Minting Solana] mint_recipient offset (bytes):', mintRecipientOffset);
          console.log('[Minting Solana] Extracted mint_recipient hex from message:', mintRecipientHex);
          console.log('[Minting Solana] Expected mint_recipient hex:', expectedMintRecipientHex);
          console.log('[Minting Solana] Hex addresses match:', mintRecipientHex === expectedMintRecipientHex);
        } else {
          console.error('[Minting Solana] ERROR: mint_recipient would be out of bounds. Message length:', messageHex.length, 'needed index:', mintRecipientStartIndex + 64);
        }
      } else {
        console.warn('[Minting Solana] WARNING: burnToken not found in message. Trying fallback method...');
        // Fallback: используем теоретическое смещение согласно CCTP V1 format
        // Header: version(4) + sourceDomain(4) + destinationDomain(4) + nonce(8) + sender(32) + recipient(32) + destinationCaller(32) = 116 bytes
        // Body: version(4) + burnToken(32) = 36 bytes
        // mintRecipient offset = 116 + 36 = 152 bytes
        const expectedMintRecipientOffset = 116 + 36; // 152 bytes (header + body version + burnToken)
        if (messageBytes.length >= expectedMintRecipientOffset + 32) {
          mintRecipientOffset = expectedMintRecipientOffset;
          const mintRecipientBytes = messageBytes.slice(expectedMintRecipientOffset, expectedMintRecipientOffset + 32);
          mintRecipientHex = Array.from(mintRecipientBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          console.log('[Minting Solana] Using fallback offset:', expectedMintRecipientOffset, '(header 116 + body version 4 + burnToken 32)');
          console.log('[Minting Solana] Extracted mint_recipient hex (fallback):', mintRecipientHex);
        }
      }
      
      if (mintRecipientHex && mintRecipientOffset !== null) {
        try {
          const mintRecipientBytes = messageBytes.slice(mintRecipientOffset, mintRecipientOffset + 32);
          
          console.log('[Minting Solana] Extracted mint_recipient from CCTP message:', {
            hex: mintRecipientHex,
            offset: mintRecipientOffset,
            bytes: Array.from(mintRecipientBytes),
          });
          
          const isAllZeros = mintRecipientBytes.every(b => b === 0);
          
          if (!isAllZeros && mintRecipientHex) {
            // Для этого скрипта жестко прописываем:
            // sourceDomain = 9 (Aptos) - отправитель
            // destinationDomain = 5 (Solana) - получатель
            // Это всегда Aptos -> Solana минтинг, поэтому адрес всегда нужно преобразовать из hex в base58
            
            const SOURCE_DOMAIN = 9; // Aptos
            const DESTINATION_DOMAIN = 5; // Solana
            
            // Проверяем структуру сообщения для отладки (опционально)
            // CCTP V1 message format: version(4 bytes, uint32) + sourceDomain(4 bytes, uint32) + destinationDomain(4 bytes, uint32) + ...
            // According to https://developers.circle.com/cctp/v1/message-format
            const versionBytes = messageBytes.slice(0, 4);
            const sourceDomainBytes = messageBytes.slice(4, 8);  // offset 4
            const destinationDomainBytes = messageBytes.slice(8, 12);  // offset 8
            // Little-endian uint32 parsing - создаем новый ArrayBuffer для DataView
            const versionBuffer = new Uint8Array(versionBytes).buffer;
            const sourceDomainBuffer = new Uint8Array(sourceDomainBytes).buffer;
            const destinationDomainBuffer = new Uint8Array(destinationDomainBytes).buffer;
            const versionFromBytes = new DataView(versionBuffer).getUint32(0, true);
            const sourceDomainFromBytes = new DataView(sourceDomainBuffer).getUint32(0, true);
            const destinationDomainFromBytes = new DataView(destinationDomainBuffer).getUint32(0, true);
            
            console.log('[Minting Solana] Message structure check (CCTP V1 format):');
            console.log('[Minting Solana] - Version (uint32, 4 bytes):', versionFromBytes, '(expected: 0 for CCTP V1)');
            console.log('[Minting Solana] - Source domain bytes (hex, offset 4):', Array.from(sourceDomainBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
            console.log('[Minting Solana] - Source domain (Aptos):', sourceDomainFromBytes, '(expected:', SOURCE_DOMAIN, ')');
            console.log('[Minting Solana] - Destination domain bytes (hex, offset 8):', Array.from(destinationDomainBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
            console.log('[Minting Solana] - Destination domain (Solana):', destinationDomainFromBytes, '(expected:', DESTINATION_DOMAIN, ')');
            
            // Всегда преобразуем hex адрес в base58 для Solana
            // Это Aptos -> Solana минтинг, адрес всегда в hex формате и нужно преобразовать
            {
              // Это Solana - преобразуем hex адрес в base58
              try {
                mintRecipientFromMessage = hexToSolanaBase58(mintRecipientHex);
                console.log('[Minting Solana] Converted mint_recipient from hex to Solana base58:', mintRecipientFromMessage);
                
                // Проверяем, что это валидный Solana адрес (может быть как публичный ключ, так и ATA)
                const { PublicKey: PublicKeyTemp } = await import("@solana/web3.js");
                const mintRecipientPubkey = new PublicKeyTemp(mintRecipientFromMessage);
                
                // ВАЖНО: Теперь в messageBody mint_recipient - это ATA адрес, а не публичный ключ
                // Поэтому мы НЕ сравниваем formRecipient с mintRecipientFromMessage
                // Транзакция упадет, если подключенный кошелек не является владельцем ATA
                console.log('[Minting Solana] mint_recipient from messageBody (ATA address):', mintRecipientFromMessage);
                console.log('[Minting Solana] formRecipient (connected wallet public key):', formRecipient);
                console.log('[Minting Solana] Note: mint_recipient is now ATA address, not public key. Transaction will fail if wallet is not the owner of this ATA.');
              } catch (conversionError: any) {
                // Если ошибка преобразования, но это не ошибка несовпадения адресов
                if (conversionError.message?.includes('не совпадают')) {
                  throw conversionError; // Пробрасываем ошибку несовпадения адресов
                }
                console.error('[Minting Solana] Failed to convert hex to Solana base58:', conversionError);
                throw new Error(`Не удалось преобразовать адрес получателя из CCTP сообщения: ${conversionError.message}`);
              }
            }
          } else {
            console.warn('[Minting Solana] mint_recipient is all zeros in CCTP message');
            throw new Error('Адрес получателя в CCTP сообщении пустой (все нули). Проверьте транзакцию сжигания.');
          }
        } catch (decodeError: any) {
          // Если это ошибка несовпадения адресов, пробрасываем её дальше
          if (decodeError.message?.includes('не совпадают') || decodeError.message?.includes('пустой')) {
            throw decodeError;
          }
          console.error('[Minting Solana] Failed to decode mint_recipient from CCTP message:', decodeError);
          throw new Error(`Не удалось извлечь адрес получателя из CCTP сообщения: ${decodeError.message}`);
        }
      } else {
        const errorMsg = `Не удалось найти адрес получателя в CCTP сообщении. Длина сообщения: ${messageBytes.length} байт`;
        console.error('[Minting Solana] ERROR:', errorMsg);
        console.error('[Minting Solana] Full message hex:', messageHex);
        throw new Error(errorMsg);
      }

      // Step 3: Create mint transaction on Solana (manual CCTP v1 implementation)
      setStatus("Creating mint transaction (manual CCTP v1 implementation)...");
      
      if (!solanaConnection) {
        throw new Error('Solana connection not available');
      }

      // Dynamically import Solana web3.js and SPL Token
      const { 
        PublicKey, 
        Transaction, 
        TransactionInstruction,
        SystemProgram,
        SYSVAR_RENT_PUBKEY,
      } = await import("@solana/web3.js");
      
      const { 
        getAssociatedTokenAddress,
        createAssociatedTokenAccountInstruction,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      } = await import("@solana/spl-token");

      // Circle CCTP v1 program IDs on Solana Mainnet
      const TOKEN_MESSENGER_MINTER_PROGRAM_ID = new PublicKey("CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3"); // V1
      const MESSAGE_TRANSMITTER_PROGRAM_ID = new PublicKey("CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd"); // V1
      
      console.log('[Minting Solana] Using CCTP version: V1');
      console.log('[Minting Solana] MessageTransmitter Program ID:', MESSAGE_TRANSMITTER_PROGRAM_ID.toBase58());
      console.log('[Minting Solana] TokenMessengerMinter Program ID:', TOKEN_MESSENGER_MINTER_PROGRAM_ID.toBase58());
      
      // USDC mint on Solana
      const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
      
      // ВАЖНО: Теперь mintRecipientFromMessage - это ATA адрес, а не публичный ключ
      // Используем подключенный кошелек как recipientPubkey (владелец ATA)
      // Транзакция упадет, если подключенный кошелек не является владельцем ATA из messageBody
      const recipientPubkey = new PublicKey(formRecipient);
      
      console.log('[Minting Solana] recipientPubkey (connected wallet - owner of ATA):', recipientPubkey.toBase58());
      console.log('[Minting Solana] mintRecipientFromMessage (ATA address from messageBody):', mintRecipientFromMessage);
      console.log('[Minting Solana] formRecipient (connected wallet):', formRecipient);
      console.log('[Minting Solana] Note: mint_recipient in messageBody is now ATA address, not public key. Transaction will fail if wallet is not the owner of this ATA.');
      
      // Circle CCTP: receiveMessage remaining account "user_token_account" must match mint_recipient from source chain.
      // When source is Aptos (mint on Solana): mint_recipient must be Solana USDC token account (ATA), not wallet.
      // https://developers.circle.com/cctp/v1/solana-programs
      setStatus("Checking token account from messageBody...");
      const recipientTokenAccount = new PublicKey(mintRecipientFromMessage);

      // Если в сообщении в mint_recipient передан адрес кошелька, а не ATA — источник (burn на Aptos) указан неверно
      const expectedATA = await getAssociatedTokenAddress(
        USDC_MINT,
        recipientPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      if (mintRecipientFromMessage === formRecipient) {
        throw new Error(
          `В сообщении CCTP в mint_recipient указан адрес кошелька, а не токен-счёт USDC (ATA). ` +
          `При burn на Aptos с направлением в Solana в mint_recipient должен быть адрес ATA. ` +
          `Ожидаемый ATA для вашего кошелька: ${expectedATA.toBase58()}. ` +
          `Используйте бридж, который при отправке в Solana подставляет ATA (см. https://developers.circle.com/cctp/v1/solana-programs).`
        );
      }

      console.log('[Minting Solana] recipientTokenAccount (ATA from messageBody):', recipientTokenAccount.toBase58());
      console.log('[Minting Solana] Connected wallet (should be owner of ATA):', recipientPubkey.toBase58());

      // Check if token account exists
      const tokenAccountInfo = await solanaConnection.getAccountInfo(recipientTokenAccount);
      const needsTokenAccount = !tokenAccountInfo;
      
      // Verify that recipientTokenAccount belongs to recipientPubkey (mintRecipient)
      if (tokenAccountInfo) {
        try {
          const { unpackAccount } = await import("@solana/spl-token");
          const parsedTokenAccount = unpackAccount(recipientTokenAccount, tokenAccountInfo);
          console.log('[Minting Solana] Token account owner verification:', {
            recipientTokenAccount: recipientTokenAccount.toBase58(),
            tokenAccountOwner: parsedTokenAccount.owner.toBase58(),
            recipientPubkey: recipientPubkey.toBase58(),
            mintRecipientFromMessage,
            ownersMatch: parsedTokenAccount.owner.equals(recipientPubkey),
            mintMatches: recipientPubkey.toBase58() === mintRecipientFromMessage,
            mint: parsedTokenAccount.mint.toBase58(),
            expectedMint: USDC_MINT.toBase58(),
            mintMatchesExpected: parsedTokenAccount.mint.equals(USDC_MINT)
          });
          
          // Проверяем, что подключенный кошелек является владельцем ATA из messageBody
          // Если нет - транзакция упадет на Solana, поэтому просто логируем
          if (!parsedTokenAccount.owner.equals(recipientPubkey)) {
            console.warn('[Minting Solana] ⚠️ WARNING: Token account owner does not match connected wallet!');
            console.warn('[Minting Solana]   Token account owner:', parsedTokenAccount.owner.toBase58());
            console.warn('[Minting Solana]   Connected wallet:', recipientPubkey.toBase58());
            console.warn('[Minting Solana]   Transaction will fail if wallet is not the owner of this ATA');
            // Не бросаем ошибку - пусть транзакция упадет на Solana
          }
          
          if (!parsedTokenAccount.mint.equals(USDC_MINT)) {
            throw new Error(`Token account mint (${parsedTokenAccount.mint.toBase58()}) does not match USDC_MINT (${USDC_MINT.toBase58()})`);
          }
        } catch (e) {
          console.error('[Minting Solana] Error verifying token account owner:', e);
          // Continue anyway, as the account might not exist yet
        }
      } else {
        console.log('[Minting Solana] Token account does not exist yet, will be created in transaction');
      }

      // Create transaction
      const transaction = new Transaction();

      // ВАЖНО: ATA адрес уже указан в messageBody, поэтому не создаем его заново
      // Если ATA не существует, транзакция упадет на Solana
      // Это нормально, так как ATA должен быть создан заранее или программой на Solana
      if (needsTokenAccount) {
        console.warn('[Minting Solana] ⚠️ WARNING: Token account from messageBody does not exist yet');
        console.warn('[Minting Solana]   ATA address from messageBody:', recipientTokenAccount.toBase58());
        console.warn('[Minting Solana]   Transaction may fail if ATA is not created by the program');
        // Не создаем ATA - пусть программа на Solana создаст его или транзакция упадет
      }

      // Create CCTP receiveMessage instruction
      // For Circle CCTP v1, the receiveMessage is typically called on TokenMessengerMinter
      // but it needs proper discriminator and account structure
      
      setStatus("Building CCTP receiveMessage instruction...");
      
      // Try using known Circle CCTP v1 instruction discriminator
      // Based on common Anchor patterns and Circle CCTP structure
      // The discriminator for "receive_message" method in Anchor is typically:
      // sha256("global:receive_message")[0:8] or sha256("receive_message")[0:8]
      
      const encoder = new TextEncoder();
      
      // Try different possible discriminator seeds
      // Circle CCTP v1 might use different naming conventions
      // We'll try them one by one until we find the correct one
      const possibleSeeds = [
        "global:receive_message",    // Standard Anchor (try this first)
        "receive_message",           // Without global prefix
        "handle_receive_message",    // Alternative naming
        "global:handle_receive_message",
        "receive",                   // Short form
        "global:receive",
      ];
      
      // Try different discriminator seeds and data formats
      // Circle CCTP v1 might use different patterns
      let instructionDiscriminator: Buffer | null = null;
      let discriminatorSeed: string = "";
      
      // Generate discriminators for all possible seeds
      const discriminators: Array<{ seed: string; discriminator: Buffer }> = [];
      for (const seed of possibleSeeds) {
        const seedBytes = encoder.encode(seed);
        // Convert Uint8Array to ArrayBuffer for crypto.subtle.digest
        // Create a new ArrayBuffer to avoid SharedArrayBuffer issues
        const seedArray = new Uint8Array(seedBytes);
        const hashBuffer = await crypto.subtle.digest("SHA-256", seedArray);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const discriminator = Buffer.from(hashArray.slice(0, 8));
        discriminators.push({ seed, discriminator });
        console.log(`[Minting Solana] Discriminator for "${seed}":`, 
          Array.from(discriminator).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      }
      
      // Use the first one (standard Anchor) for now
      // If it fails, user can manually try others or we can implement retry logic
      instructionDiscriminator = discriminators[0].discriminator;
      discriminatorSeed = discriminators[0].seed;
      
      console.log('[Minting Solana] Using discriminator seed:', discriminatorSeed);
      console.log('[Minting Solana] Discriminator bytes (hex):', 
        Array.from(instructionDiscriminator).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      console.log('[Minting Solana] Alternative discriminators available:', discriminators.slice(1).map(d => d.seed));
      
      // Try building instruction data without length prefixes first
      // Format: discriminator (8) + message + attestation
      const instructionData = Buffer.concat([
        instructionDiscriminator,
        Buffer.from(messageBytes),
        Buffer.from(attestationBytes),
      ]);
      
      console.log('[Minting Solana] Instruction data built (no length prefixes):', {
        discriminatorLength: instructionDiscriminator.length,
        messageLength: messageBytes.length,
        attestationLength: attestationBytes.length,
        totalLength: instructionData.length,
      });

      // According to Circle CCTP documentation:
      // receiveMessage is called on MessageTransmitter, not TokenMessengerMinter
      // MessageTransmitter then calls TokenMessengerMinter via CPI (Cross-Program Invocation)
      
      // ============================================
      // Генерация PDAs для Circle CCTP v1 программ
      // ============================================
      
      // MessageTransmitter state account PDA
      // Circle mainnet может использовать seed "state". Пробуем "state" первым.
      let messageTransmitterStateAccount: any;
      let messageTransmitterBump: number = 0;
      let messageTransmitterAccountInfo: any = null;

      const possiblePdaSeeds = [
        [Buffer.from("state")],
        [Buffer.from("message_transmitter")],
        [Buffer.from("message_transmitter_state")],
      ];
      
      let foundAccount = false;
      for (const seeds of possiblePdaSeeds) {
        try {
          const [pda, bump] = PublicKey.findProgramAddressSync(
            seeds,
            MESSAGE_TRANSMITTER_PROGRAM_ID
          );
          
          try {
            const accountInfo = await solanaConnection.getAccountInfo(pda);
            if (accountInfo && accountInfo.owner.equals(MESSAGE_TRANSMITTER_PROGRAM_ID)) {
              messageTransmitterStateAccount = pda;
              messageTransmitterBump = bump;
              messageTransmitterAccountInfo = accountInfo;
              foundAccount = true;
              console.log('[Minting Solana] Found message_transmitter state account:', {
                address: pda.toBase58(),
                seeds: seeds.map(s => s.toString()),
                bump,
                owner: accountInfo.owner.toBase58(),
                dataLength: accountInfo.data.length,
              });
              break;
            }
          } catch (fetchError: any) {
            // Продолжаем поиск, если аккаунт не найден или ошибка сети
            console.log('[Minting Solana] Account not found or network error for seeds:', seeds.map(s => s.toString()), fetchError.message);
          }
        } catch (error) {
          // Продолжаем поиск
          continue;
        }
      }
      
      // Если не нашли PDA, используем сам program ID (как fallback)
      if (!foundAccount) {
        console.warn('[Minting Solana] WARNING: Could not find message_transmitter state PDA, using program ID as fallback');
        messageTransmitterStateAccount = MESSAGE_TRANSMITTER_PROGRAM_ID;
        messageTransmitterBump = 0; // Нет bump для program ID
        try {
          messageTransmitterAccountInfo = await solanaConnection.getAccountInfo(MESSAGE_TRANSMITTER_PROGRAM_ID);
        } catch (error) {
          console.warn('[Minting Solana] Could not fetch program ID account info, continuing anyway');
        }
      }

      // MessageTransmitter authority PDA for TokenMessengerMinter CPI
      // Ожидаемый PDA из успешной транзакции: CFtn7PC5NsaFAuG65LwvhcGVD2MiqSpMJ7yvpyhsgJwW
      const EXPECTED_AUTHORITY_PDA = 'CFtn7PC5NsaFAuG65LwvhcGVD2MiqSpMJ7yvpyhsgJwW';
      
      // Пробуем разные варианты seeds для authority PDA
      const possibleAuthoritySeeds = [
        { name: '["authority"]', seeds: [Buffer.from("authority")] },
        { name: '["authority_pda"]', seeds: [Buffer.from("authority_pda")] },
        { name: '["authority_pda", message_transmitter_state]', seeds: [Buffer.from("authority_pda"), messageTransmitterStateAccount.toBuffer()] },
        { name: '["authority", message_transmitter_state]', seeds: [Buffer.from("authority"), messageTransmitterStateAccount.toBuffer()] },
      ];
      
      let messageTransmitterAuthorityPDA: any = null;
      let authoritySeedsName = '';
      
      for (const variant of possibleAuthoritySeeds) {
        const [pda] = PublicKey.findProgramAddressSync(
          variant.seeds,
          MESSAGE_TRANSMITTER_PROGRAM_ID
        );
        
        if (pda.toBase58() === EXPECTED_AUTHORITY_PDA) {
          messageTransmitterAuthorityPDA = pda;
          authoritySeedsName = variant.name;
          console.log('[Minting Solana] ✅ Found correct authority PDA:', pda.toBase58());
          console.log('[Minting Solana] ✅ Using seeds:', variant.name);
          break;
        }
      }
      
      // Если не нашли, используем хардкоженное значение
      if (!messageTransmitterAuthorityPDA) {
        console.warn('[Minting Solana] ⚠️ Could not find expected authority PDA with any seed variant');
        console.warn('[Minting Solana] Expected:', EXPECTED_AUTHORITY_PDA);
        for (const variant of possibleAuthoritySeeds) {
          const [pda] = PublicKey.findProgramAddressSync(
            variant.seeds,
            MESSAGE_TRANSMITTER_PROGRAM_ID
          );
          console.warn(`[Minting Solana]   ${variant.name}: ${pda.toBase58()}`);
        }
        messageTransmitterAuthorityPDA = new PublicKey(EXPECTED_AUTHORITY_PDA);
        authoritySeedsName = 'hardcoded_from_successful_tx';
        console.warn('[Minting Solana] Using hardcoded authority PDA from successful transaction:', messageTransmitterAuthorityPDA.toBase58());
      }
      
      console.log('[Minting Solana] Final authority PDA:', messageTransmitterAuthorityPDA.toBase58());
      console.log('[Minting Solana] Authority seeds variant used:', authoritySeedsName);

      // TokenMessenger PDA
      // Seeds: ["token_messenger"]
      const [tokenMessengerPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_messenger")],
        TOKEN_MESSENGER_MINTER_PROGRAM_ID
      );
      
      // Event authority PDA
      // Ожидаемый PDA из успешной транзакции: 6mH8scevHQJsyyp1qxu8kyAapHuzEE67mtjFDJZjSbQW
      // Это используется в MessageTransmitter программе, поэтому используем MESSAGE_TRANSMITTER_PROGRAM_ID
      const EXPECTED_EVENT_AUTHORITY_PDA = '6mH8scevHQJsyyp1qxu8kyAapHuzEE67mtjFDJZjSbQW';
      
      // Пробуем разные варианты seeds для event_authority PDA
      const possibleEventAuthoritySeeds = [
        { name: '["__event_authority"]', seeds: [Buffer.from("__event_authority")] },
        { name: '["event_authority"]', seeds: [Buffer.from("event_authority")] },
        { name: '["event"]', seeds: [Buffer.from("event")] },
        { name: '["__event_authority", message_transmitter_state]', seeds: [Buffer.from("__event_authority"), messageTransmitterStateAccount.toBuffer()] },
        { name: '["event_authority", message_transmitter_state]', seeds: [Buffer.from("event_authority"), messageTransmitterStateAccount.toBuffer()] },
      ];

      let eventAuthorityPDA: any = null;
      let eventAuthoritySeedsName = '';

      // Пробуем с MESSAGE_TRANSMITTER_PROGRAM_ID (так как ошибка приходит от MessageTransmitter)
      for (const variant of possibleEventAuthoritySeeds) {
        const [pda] = PublicKey.findProgramAddressSync(
          variant.seeds,
          MESSAGE_TRANSMITTER_PROGRAM_ID
        );

        if (pda.toBase58() === EXPECTED_EVENT_AUTHORITY_PDA) {
          eventAuthorityPDA = pda;
          eventAuthoritySeedsName = variant.name;
          console.log('[Minting Solana] ✅ Found correct event_authority PDA:', pda.toBase58());
          console.log('[Minting Solana] ✅ Using seeds:', variant.name);
          break;
        }
      }

      // Если не нашли с MESSAGE_TRANSMITTER_PROGRAM_ID, пробуем с TOKEN_MESSENGER_MINTER_PROGRAM_ID
      if (!eventAuthorityPDA) {
        for (const variant of possibleEventAuthoritySeeds) {
          const [pda] = PublicKey.findProgramAddressSync(
            variant.seeds,
            TOKEN_MESSENGER_MINTER_PROGRAM_ID
          );

          if (pda.toBase58() === EXPECTED_EVENT_AUTHORITY_PDA) {
            eventAuthorityPDA = pda;
            eventAuthoritySeedsName = variant.name;
            console.log('[Minting Solana] ✅ Found correct event_authority PDA with TokenMessengerMinter program:', pda.toBase58());
            console.log('[Minting Solana] ✅ Using seeds:', variant.name);
            break;
          }
        }
      }

      // Если не нашли, используем хардкоженное значение
      if (!eventAuthorityPDA) {
        console.warn('[Minting Solana] ⚠️ Could not find expected event_authority PDA with any seed variant');
        console.warn('[Minting Solana] Expected:', EXPECTED_EVENT_AUTHORITY_PDA);
        for (const variant of possibleEventAuthoritySeeds) {
          const [pda1] = PublicKey.findProgramAddressSync(
            variant.seeds,
            MESSAGE_TRANSMITTER_PROGRAM_ID
          );
          const [pda2] = PublicKey.findProgramAddressSync(
            variant.seeds,
            TOKEN_MESSENGER_MINTER_PROGRAM_ID
          );
          console.warn(`[Minting Solana]   ${variant.name} (MessageTransmitter): ${pda1.toBase58()}`);
          console.warn(`[Minting Solana]   ${variant.name} (TokenMessengerMinter): ${pda2.toBase58()}`);
        }
        eventAuthorityPDA = new PublicKey(EXPECTED_EVENT_AUTHORITY_PDA);
        eventAuthoritySeedsName = 'hardcoded_from_successful_tx';
        console.warn('[Minting Solana] Using hardcoded event_authority PDA from successful transaction:', eventAuthorityPDA.toBase58());
      }

      console.log('[Minting Solana] Final event_authority PDA:', eventAuthorityPDA.toBase58());
      console.log('[Minting Solana] Event authority seeds variant used:', eventAuthoritySeedsName);
      console.log('[Minting Solana] Generated token_messenger PDA:', tokenMessengerPDA.toBase58());
      
      // Проверяем, существует ли аккаунт token_messenger
      const tokenMessengerAccountInfo = await solanaConnection.getAccountInfo(tokenMessengerPDA);
      if (tokenMessengerAccountInfo) {
        console.log('[Minting Solana] token_messenger account exists:', {
          address: tokenMessengerPDA.toBase58(),
          owner: tokenMessengerAccountInfo.owner.toBase58(),
          dataLength: tokenMessengerAccountInfo.data.length,
          discriminator: Array.from(tokenMessengerAccountInfo.data.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '),
        });
      } else {
        console.warn('[Minting Solana] WARNING: token_messenger account does not exist at PDA:', tokenMessengerPDA.toBase58());
      }

      // Source domain = 9 (Aptos) - константа для minting на Solana
      // В форме sourceDomain нужен только для получения attestation из Circle API
      // Для всех PDA используется константа SOURCE_DOMAIN = 9
      const SOURCE_DOMAIN = 9; // Aptos - источник сообщения при minting на Solana
      
      console.log('[Minting Solana] Using source domain (constant):', SOURCE_DOMAIN, '(Aptos)');
      
      // Remote token messenger PDA
      // Ожидаемый PDA из успешной транзакции: 3CTbq3SF9gekPHiJwLsyivfVbuaRFAQwQ6eQgtNy8nP1
      const EXPECTED_REMOTE_TOKEN_MESSENGER_PDA = '3CTbq3SF9gekPHiJwLsyivfVbuaRFAQwQ6eQgtNy8nP1';
      
      // Пробуем разные варианты кодирования source_domain
      const sourceDomainBufferLE = Buffer.allocUnsafe(4);
      sourceDomainBufferLE.writeUInt32LE(SOURCE_DOMAIN, 0);
      
      const sourceDomainBufferBE = Buffer.allocUnsafe(4);
      sourceDomainBufferBE.writeUInt32BE(SOURCE_DOMAIN, 0);
      
      // Также пробуем как u8 array напрямую
      const sourceDomainU8Array = new Uint8Array([SOURCE_DOMAIN, 0, 0, 0]);
      const sourceDomainU8ArrayBE = new Uint8Array([0, 0, 0, SOURCE_DOMAIN]);
      
      const possibleRemoteTokenMessengerSeeds = [
        { name: '["remote_token_messenger", source_domain (u32 LE)]', seeds: [Buffer.from("remote_token_messenger"), sourceDomainBufferLE] },
        { name: '["remote_token_messenger", source_domain (u32 BE)]', seeds: [Buffer.from("remote_token_messenger"), sourceDomainBufferBE] },
        { name: '["remote_token_messenger", source_domain (u8 array)]', seeds: [Buffer.from("remote_token_messenger"), Buffer.from(sourceDomainU8Array)] },
        { name: '["remote_token_messenger", source_domain (u8 array BE)]', seeds: [Buffer.from("remote_token_messenger"), Buffer.from(sourceDomainU8ArrayBE)] },
        { name: '["remote_token_messenger", source_domain (as string)]', seeds: [Buffer.from("remote_token_messenger"), Buffer.from(SOURCE_DOMAIN.toString())] },
        { name: '["remote_token_messenger", source_domain (as u8)]', seeds: [Buffer.from("remote_token_messenger"), Buffer.from([SOURCE_DOMAIN])] },
      ];

      let remoteTokenMessengerPDA: any = null;
      let remoteTokenMessengerSeedsName = '';

      for (const variant of possibleRemoteTokenMessengerSeeds) {
        const [pda] = PublicKey.findProgramAddressSync(
          variant.seeds,
          TOKEN_MESSENGER_MINTER_PROGRAM_ID
        );

        if (pda.toBase58() === EXPECTED_REMOTE_TOKEN_MESSENGER_PDA) {
          remoteTokenMessengerPDA = pda;
          remoteTokenMessengerSeedsName = variant.name;
          console.log('[Minting Solana] ✅ Found correct remote_token_messenger PDA:', pda.toBase58());
          console.log('[Minting Solana] ✅ Using seeds:', variant.name);
          break;
        }
      }

      // Если не нашли, используем хардкоженное значение
      if (!remoteTokenMessengerPDA) {
        console.warn('[Minting Solana] ⚠️ Could not find expected remote_token_messenger PDA with any seed variant');
        console.warn('[Minting Solana] Expected:', EXPECTED_REMOTE_TOKEN_MESSENGER_PDA);
        for (const variant of possibleRemoteTokenMessengerSeeds) {
          const [pda] = PublicKey.findProgramAddressSync(
            variant.seeds,
            TOKEN_MESSENGER_MINTER_PROGRAM_ID
          );
          console.warn(`[Minting Solana]   ${variant.name}: ${pda.toBase58()}`);
        }
        remoteTokenMessengerPDA = new PublicKey(EXPECTED_REMOTE_TOKEN_MESSENGER_PDA);
        remoteTokenMessengerSeedsName = 'hardcoded_from_successful_tx';
        console.warn('[Minting Solana] Using hardcoded remote_token_messenger PDA from successful transaction:', remoteTokenMessengerPDA.toBase58());
      }

      console.log('[Minting Solana] Final remote_token_messenger PDA:', remoteTokenMessengerPDA.toBase58());
      console.log('[Minting Solana] Remote token messenger seeds variant used:', remoteTokenMessengerSeedsName);
      
      // Проверяем, существует ли аккаунт remote_token_messenger
      // ВАЖНО: Этот аккаунт может не существовать для некоторых source domains
      // Если аккаунт не существует, программа может инициализировать его автоматически
      // или это может быть нормально для некоторых доменов
      const remoteTokenMessengerAccountInfo = await solanaConnection.getAccountInfo(remoteTokenMessengerPDA);
      if (!remoteTokenMessengerAccountInfo) {
        console.warn('[Minting Solana] WARNING: remote_token_messenger account does not exist for source domain', SOURCE_DOMAIN);
        console.warn('[Minting Solana] PDA:', remoteTokenMessengerPDA.toBase58());
        console.warn('[Minting Solana] Seeds used:', ['remote_token_messenger', `sourceDomain=${SOURCE_DOMAIN}`]);
        console.warn('[Minting Solana] Continuing anyway - the program may handle this or the account may be initialized automatically.');
        // НЕ выбрасываем ошибку - продолжаем выполнение
        // Программа может обработать отсутствие аккаунта или инициализировать его
      } else {
        console.log('[Minting Solana] remote_token_messenger account exists:', {
          address: remoteTokenMessengerPDA.toBase58(),
          owner: remoteTokenMessengerAccountInfo.owner.toBase58(),
          dataLength: remoteTokenMessengerAccountInfo.data.length,
          sourceDomain: SOURCE_DOMAIN,
        });
      }

      // Token minter PDA: seeds = ["token_minter"]
      const [tokenMinterPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_minter")],
        TOKEN_MESSENGER_MINTER_PROGRAM_ID
      );
      console.log('[Minting Solana] Generated token_minter PDA:', tokenMinterPDA.toBase58());

      // Local token PDA
      // Seeds: ["local_token", localTokenMint.publicKey]
      // localTokenMint = USDC_MINT on Solana
      const [localTokenPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("local_token"), USDC_MINT.toBuffer()],
        TOKEN_MESSENGER_MINTER_PROGRAM_ID
      );
      console.log('[Minting Solana] Generated local_token PDA:', localTokenPDA.toBase58());
      console.log('[Minting Solana] Using seeds: ["local_token", USDC_MINT]');
      console.log('[Minting Solana] USDC_MINT:', USDC_MINT.toBase58());
      
      // Проверяем, существует ли аккаунт local_token
      const localTokenAccountInfo = await solanaConnection.getAccountInfo(localTokenPDA);
      if (!localTokenAccountInfo) {
        console.warn('[Minting Solana] ⚠️ WARNING: local_token account does not exist');
        console.warn('[Minting Solana] PDA:', localTokenPDA.toBase58());
        console.warn('[Minting Solana] Seeds used: ["local_token", USDC_MINT]');
        console.warn('[Minting Solana] The program expects this account to be already initialized.');
        console.warn('[Minting Solana] This account may need to be initialized before minting can proceed.');
      } else {
        console.log('[Minting Solana] ✅ local_token account exists:', {
          address: localTokenPDA.toBase58(),
          owner: localTokenAccountInfo.owner.toBase58(),
          dataLength: localTokenAccountInfo.data.length,
        });
      }

      // SOURCE_DOMAIN уже объявлен выше (9 = Aptos)

      // Used nonce PDA - для отслеживания использованных nonce (защита от replay атак)
      // Для CCTP V1, used_nonces PDA имеет сложную структуру:
      // seeds = ["used_nonces", message_transmitter.key(), remote_domain.to_le_bytes(), (nonce / 6400).to_le_bytes()]
      // где:
      // - message_transmitter.key() - это сам program ID или PDA аккаунта message_transmitter
      // - remote_domain - source domain (9 для Aptos)
      // - nonce / 6400 - номер блока nonce (каждый блок содержит 6400 nonce)
      
      // Используем nonce из attestation - он уже проверен и правильный
      // eventNonce из attestation - это правильный nonce, который был использован при создании сообщения
      if (!firstMessage.eventNonce) {
        throw new Error('eventNonce not found in attestation - cannot compute used_nonces PDA');
      }
      
      const finalNonce = BigInt(firstMessage.eventNonce);
      // Circle UsedNonces::first_nonce(nonce) = ((nonce - 1) / 6400) * 6400 + 1 (см. state.rs)
      const firstNonce = (finalNonce - BigInt(1)) / BigInt(6400) * BigInt(6400) + BigInt(1);
      const finalNonceBlock = Number(finalNonce / BigInt(6400));

      console.log('[Minting Solana] Using nonce from attestation (eventNonce):', finalNonce.toString());
      console.log('[Minting Solana] first_nonce (Circle formula):', firstNonce.toString());

      // Подготовим buffers: first_nonce (u64 LE) — как в Circle state.rs
      const firstNonceBuffer = Buffer.allocUnsafe(8);
      let firstNonceVal = firstNonce;
      for (let i = 0; i < 8; i++) {
        firstNonceBuffer[i] = Number(firstNonceVal & BigInt(0xff));
        firstNonceVal = firstNonceVal >> BigInt(8);
      }

      const nonceBlockBuffer = Buffer.allocUnsafe(8);
      let nonceBlockValue = BigInt(finalNonceBlock);
      for (let i = 0; i < 8; i++) {
        nonceBlockBuffer[i] = Number(nonceBlockValue & BigInt(0xff));
        nonceBlockValue = nonceBlockValue >> BigInt(8);
      }

      const fullNonceBuffer = Buffer.allocUnsafe(8);
      let fullNonceValue = finalNonce;
      for (let i = 0; i < 8; i++) {
        fullNonceBuffer[i] = Number(fullNonceValue & BigInt(0xff));
        fullNonceValue = fullNonceValue >> BigInt(8);
      }

      // Circle receive_message.rs: seeds = [b"used_nonces", source_domain.to_string(), delimiter?, first_nonce.to_string()]
      // НЕ message_transmitter и НЕ u32/u64 bytes — именно строки "9" и "89601"
      const usedNoncesDelimiter = SOURCE_DOMAIN >= 11 ? Buffer.from("-") : Buffer.allocUnsafe(0);
      const usedNoncesSeedsBase: Buffer[] = [
        Buffer.from("used_nonces"),
        Buffer.from(SOURCE_DOMAIN.toString(), "utf8"),
      ];
      if (usedNoncesDelimiter.length > 0) usedNoncesSeedsBase.push(usedNoncesDelimiter);
      usedNoncesSeedsBase.push(Buffer.from(firstNonce.toString(), "utf8"));

      const possibleUsedNoncesSeeds = [
        {
          name: 'Circle: used_nonces + source_domain_str + delimiter + first_nonce_str',
          seeds: usedNoncesSeedsBase,
        },
        {
          name: 'state_account + nonce_block',
          seeds: [
            Buffer.from("used_nonces"),
            messageTransmitterStateAccount.toBuffer(),
            sourceDomainBufferLE,
            nonceBlockBuffer,
          ],
        },
        {
          name: 'state_account + full_nonce',
          seeds: [
            Buffer.from("used_nonces"),
            messageTransmitterStateAccount.toBuffer(),
            sourceDomainBufferLE,
            fullNonceBuffer,
          ],
        },
        {
          name: 'program_id + first_nonce',
          seeds: [
            Buffer.from("used_nonces"),
            MESSAGE_TRANSMITTER_PROGRAM_ID.toBuffer(),
            sourceDomainBufferLE,
            firstNonceBuffer,
          ],
        },
        {
          name: 'program_id + nonce_block',
          seeds: [
            Buffer.from("used_nonces"),
            MESSAGE_TRANSMITTER_PROGRAM_ID.toBuffer(),
            sourceDomainBufferLE,
            nonceBlockBuffer,
          ],
        },
        {
          name: 'program_id + full_nonce',
          seeds: [
            Buffer.from("used_nonces"),
            MESSAGE_TRANSMITTER_PROGRAM_ID.toBuffer(),
            sourceDomainBufferLE,
            fullNonceBuffer,
          ],
        },
        {
          name: 'state_account + first_nonce (reversed order)',
          seeds: [
            Buffer.from("used_nonces"),
            sourceDomainBufferLE,
            messageTransmitterStateAccount.toBuffer(),
            firstNonceBuffer,
          ],
        },
      ];

      // Используем PDA из первого варианта (Circle formula) — для каждого nonce свой PDA, без хардкода
      const [usedNoncesPDA] = PublicKey.findProgramAddressSync(
        possibleUsedNoncesSeeds[0].seeds,
        MESSAGE_TRANSMITTER_PROGRAM_ID
      );
      const usedSeedsName = possibleUsedNoncesSeeds[0].name;
      console.log('[Minting Solana] used_nonces PDA (Circle first_nonce seeds):', usedNoncesPDA.toBase58());
      
      console.log('[Minting Solana] Final used_nonces PDA:', usedNoncesPDA.toBase58());
      console.log('[Minting Solana] Seeds variant used:', usedSeedsName);
      
      // Проверяем, существует ли аккаунт used_nonces
      const usedNoncesAccountInfo = await solanaConnection.getAccountInfo(usedNoncesPDA);
      if (!usedNoncesAccountInfo) {
        console.warn('[Minting Solana] WARNING: used_nonces account does not exist at PDA:', usedNoncesPDA.toBase58());
        console.warn('[Minting Solana] This account should be initialized by Circle. Proceeding anyway...');
      } else {
        console.log('[Minting Solana] used_nonces account exists:', {
          address: usedNoncesPDA.toBase58(),
          owner: usedNoncesAccountInfo.owner.toBase58(),
          dataLength: usedNoncesAccountInfo.data.length,
        });
      }

      console.log('[Minting Solana] PDAs:', {
        messageTransmitterStateAccount: messageTransmitterStateAccount.toBase58(),
        messageTransmitterBump: messageTransmitterBump,
        messageTransmitterAuthorityPDA: messageTransmitterAuthorityPDA.toBase58(),
        tokenMessengerPDA: tokenMessengerPDA.toBase58(),
        remoteTokenMessengerPDA: remoteTokenMessengerPDA.toBase58(),
        tokenMinterPDA: tokenMinterPDA.toBase58(),
        localTokenPDA: localTokenPDA.toBase58(),
        usedNoncesPDA: usedNoncesPDA.toBase58(),
        nonce: finalNonce.toString(),
      });

      // Create receiveMessage instruction on MessageTransmitter
      // According to Circle docs, receiveMessage is on MessageTransmitter
      // It takes message and attestation, then calls TokenMessengerMinter via CPI
      // For CCTP v1, пробуем разные discriminators
      // Попробуем сначала "global:receive_message" (стандартный Anchor формат)
      const messageTransmitterDiscriminatorSeeds = [
        "global:receive_message",     // С global: префиксом (стандартный Anchor, попробуем сначала)
        "receive_message",           // Без global: префикса
      ];
      
      let messageTransmitterDiscriminator: Buffer | null = null;
      let messageTransmitterDiscriminatorSeed: string = "";
      
      for (const seed of messageTransmitterDiscriminatorSeeds) {
        const mtSeedBytes = encoder.encode(seed);
      const mtSeedArray = new Uint8Array(mtSeedBytes);
      const mtHashBuffer = await crypto.subtle.digest("SHA-256", mtSeedArray);
      const mtHashArray = Array.from(new Uint8Array(mtHashBuffer));
        const discriminator = Buffer.from(mtHashArray.slice(0, 8));
        
        console.log(`[Minting Solana] Testing discriminator for "${seed}":`, 
          Array.from(discriminator).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        
        // Используем первый (попробуем без global: префикса)
        if (!messageTransmitterDiscriminator) {
          messageTransmitterDiscriminator = discriminator;
          messageTransmitterDiscriminatorSeed = seed;
        }
      }
      
      if (!messageTransmitterDiscriminator) {
        throw new Error("Failed to generate message transmitter discriminator");
      }
      
      console.log('[Minting Solana] Using message transmitter discriminator seed:', messageTransmitterDiscriminatorSeed);
      
      // MessageTransmitter receiveMessage data format for Anchor:
      // Попробуем формат С length prefixes (Anchor Vec<u8> format)
      // Discriminator правильный (global:receive_message), но формат данных может требовать length prefixes
      const messageLengthBuffer = Buffer.allocUnsafe(4);
      messageLengthBuffer.writeUInt32LE(messageBytes.length, 0);
      const attestationLengthBuffer = Buffer.allocUnsafe(4);
      attestationLengthBuffer.writeUInt32LE(attestationBytes.length, 0);
      
      const messageTransmitterData = Buffer.concat([
        messageTransmitterDiscriminator,
        messageLengthBuffer,
        Buffer.from(messageBytes),
        attestationLengthBuffer,
        Buffer.from(attestationBytes),
      ]);
      
      console.log('[Minting Solana] MessageTransmitter data format (WITH length prefixes):', {
        discriminatorLength: messageTransmitterDiscriminator.length,
        messageLength: messageBytes.length,
        attestationLength: attestationBytes.length,
        totalLength: messageTransmitterData.length,
      });

      // Create receiveMessage instruction on MessageTransmitter
      // Согласно ошибке "AccountNotInitialized", возможно используется неправильный аккаунт message_transmitter
      // Попробуем использовать сам program ID как аккаунт состояния, или проверим правильность PDA
      // 
      // Возможные варианты структуры аккаунтов для receiveMessage:
      // Вариант 1: caller, payer, message_transmitter (PDA), остальные аккаунты
      // Вариант 2: payer, message_transmitter (PDA), остальные аккаунты (без caller)
      // Вариант 3: message_transmitter должен быть самим program ID
      
      // Логируем все аккаунты для диагностики
      console.log('[Minting Solana] Instruction accounts structure:');
      console.log('[Minting Solana] - caller:', solanaPublicKey.toBase58(), '(signer, not writable)');
      console.log('[Minting Solana] - payer:', solanaPublicKey.toBase58(), '(signer, writable)');
      console.log('[Minting Solana] - message_transmitter PDA:', messageTransmitterStateAccount.toBase58(), '(not signer, writable)');
      console.log('[Minting Solana] - message_transmitter program ID:', MESSAGE_TRANSMITTER_PROGRAM_ID.toBase58());
      console.log('[Minting Solana] - Are they the same?', messageTransmitterStateAccount.equals(MESSAGE_TRANSMITTER_PROGRAM_ID));
      
      // Ошибка "AccountNotInitialized" для message_transmitter
      // Согласно документации, message_transmitter - это state account
      // Проверяем существование PDA для логирования
      console.log('[Minting Solana] message_transmitter PDA:', messageTransmitterStateAccount.toBase58());
      console.log('[Minting Solana] Account exists:', !!messageTransmitterAccountInfo);
      if (messageTransmitterAccountInfo) {
        console.log('[Minting Solana] Account owner:', messageTransmitterAccountInfo.owner.toBase58());
        console.log('[Minting Solana] Expected owner:', MESSAGE_TRANSMITTER_PROGRAM_ID.toBase58());
        console.log('[Minting Solana] Owner matches:', messageTransmitterAccountInfo.owner.equals(MESSAGE_TRANSMITTER_PROGRAM_ID));
      }
      
      // Согласно документации Circle CCTP v1, для receiveMessage нужны:
      // 1. payer (signer, writable) - платит за транзакцию
      // 2. caller (signer) - инициатор транзакции
      // 3. message_transmitter (state account) - может быть program ID или PDA
      // 4. authority_pda (для CPI в TokenMessengerMinter)
      // 5. used_nonces (PDA для replay protection) - с правильными seeds
      // 6. receiver (program account) - TokenMessengerMinter для burn/mint сообщений
      // 7. system_program
      // 8. Remaining accounts для TokenMessengerMinter CPI
      //
      // Используем PDA для message_transmitter (как в документации CCTP v1)
      // Program ID не работает - получаем ошибку AccountNotInitialized
      const messageTransmitterAccountToUse = messageTransmitterStateAccount;
      
      console.log('[Minting Solana] Using message_transmitter PDA:', messageTransmitterAccountToUse.toBase58());
      console.log('[Minting Solana] Account exists:', !!messageTransmitterAccountInfo);
      console.log('[Minting Solana] Account owner matches:', messageTransmitterAccountInfo?.owner.equals(MESSAGE_TRANSMITTER_PROGRAM_ID));
      
      // Порядок аккаунтов для receiveMessage согласно IDL MessageTransmitter:
      // 1. payer (isMut: true, isSigner: true)
      // 2. caller (isMut: false, isSigner: true)
      // 3. authorityPda (isMut: false, isSigner: false)
      // 4. messageTransmitter (isMut: false, isSigner: false) - НЕ writable!
      // 5. usedNonces (isMut: true, isSigner: false)
      // 6. receiver (isMut: false, isSigner: false)
      // 7. systemProgram (isMut: false, isSigner: false)
      // 8. eventAuthority (isMut: false, isSigner: false) - В ОСНОВНЫХ АККАУНТАХ!
      // 9. program (isMut: false, isSigner: false) - В ОСНОВНЫХ АККАУНТАХ!
      // 
      // Remaining accounts (для CPI в TokenMessengerMinter):
      // token_messenger, remote_token_messenger, token_minter, local_token, token_pair,
      // user_token_account, custody_token_account, token_program
      const instructionKeys = [
        // 1. Payer (must be signer and writable - pays for transaction fees)
        { pubkey: solanaPublicKey, isSigner: true, isWritable: true },
        // 2. Caller (must be signer - the account calling receiveMessage)
        { pubkey: solanaPublicKey, isSigner: true, isWritable: false },
        // 3. Authority PDA для CPI
          { pubkey: messageTransmitterAuthorityPDA, isSigner: false, isWritable: false },
        // 4. MessageTransmitter state account (writable согласно реальной транзакции!)
        { pubkey: messageTransmitterAccountToUse, isSigner: false, isWritable: true },
        // 5. Used nonce(s) PDA (writable) - для replay protection
        { pubkey: usedNoncesPDA, isSigner: false, isWritable: true },
        // 6. Receiver - TokenMessengerMinter program для обработки burn/mint сообщений
          { pubkey: TOKEN_MESSENGER_MINTER_PROGRAM_ID, isSigner: false, isWritable: false },
        // 7. System program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        // 8. eventAuthority - В ОСНОВНЫХ АККАУНТАХ согласно IDL!
        { pubkey: eventAuthorityPDA, isSigner: false, isWritable: false },
        // 9. program - В ОСНОВНЫХ АККАУНТАХ согласно IDL! (это MessageTransmitter program ID)
        { pubkey: MESSAGE_TRANSMITTER_PROGRAM_ID, isSigner: false, isWritable: false },
      ];
      
      // CCTP v1 порядок remaining accounts для CPI в TokenMessengerMinter:
      // event_authority и program уже в основных аккаунтах (позиции 8 и 9)
      // Remaining accounts содержат только аккаунты для TokenMessengerMinter CPI
      console.log('[Minting Solana] Adding remaining accounts for CCTP v1 CPI...');
      
      // Для v1 также нужны token_pair и custody_token_account
      // Извлекаем burnToken из сообщения для token_pair
      // burnToken находится в payload: offset 116 + 4 (version) = 120, или 116 + 36 (version + burnToken offset в body)
      // Согласно структуре: payload version(4) + burnToken(32) = offset 120-151
      const burnTokenOffset = 116 + 4; // header(116) + body version(4)
      const burnTokenBytes = messageBytes.slice(burnTokenOffset, burnTokenOffset + 32);
      const burnTokenHex = Array.from(burnTokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Token pair PDA
      // Seeds: ["token_pair", sourceDomainId, sourceTokenInBase58]
      // sourceTokenInBase58 - это burnToken в формате base58, а не 32 байта
      // Ожидаемый PDA из успешной транзакции: C7XDQkHdr7omXt3Z4u3AuwQx9Za4AswzifnmKaoRhvLp
      const EXPECTED_TOKEN_PAIR_PDA = 'C7XDQkHdr7omXt3Z4u3AuwQx9Za4AswzifnmKaoRhvLp';
      
      // Конвертируем burnTokenBytes (32 байта) в base58 формат для логирования
      const burnTokenBase58 = bs58.encode(burnTokenBytes);
      console.log('[Minting Solana] burnToken (32 bytes):', burnTokenHex);
      console.log('[Minting Solana] burnToken (base58):', burnTokenBase58);
      
      // Для seeds используем PublicKey из base58, который даст нам 32 байта
      // Или используем оригинальные burnTokenBytes
      const burnTokenPublicKey = new PublicKey(burnTokenBase58);
      const burnTokenFromBase58 = burnTokenPublicKey.toBuffer();
      
      // Пробуем разные варианты кодирования source_domain и burn_token
      const possibleTokenPairSeeds = [
        { name: '["token_pair", source_domain (u32 LE), burn_token (from base58 PublicKey)]', seeds: [Buffer.from("token_pair"), sourceDomainBufferLE, burnTokenFromBase58] },
        { name: '["token_pair", source_domain (u32 BE), burn_token (from base58 PublicKey)]', seeds: [Buffer.from("token_pair"), sourceDomainBufferBE, burnTokenFromBase58] },
        { name: '["token_pair", source_domain (as string), burn_token (from base58 PublicKey)]', seeds: [Buffer.from("token_pair"), Buffer.from(SOURCE_DOMAIN.toString()), burnTokenFromBase58] },
        { name: '["token_pair", source_domain (u8 array), burn_token (from base58 PublicKey)]', seeds: [Buffer.from("token_pair"), Buffer.from(sourceDomainU8Array), burnTokenFromBase58] },
        { name: '["token_pair", source_domain (u8 array BE), burn_token (from base58 PublicKey)]', seeds: [Buffer.from("token_pair"), Buffer.from(sourceDomainU8ArrayBE), burnTokenFromBase58] },
        { name: '["token_pair", source_domain (as u8), burn_token (from base58 PublicKey)]', seeds: [Buffer.from("token_pair"), Buffer.from([SOURCE_DOMAIN]), burnTokenFromBase58] },
        // Также пробуем с оригинальными 32 байтами
        { name: '["token_pair", source_domain (u32 LE), burn_token (32 bytes)]', seeds: [Buffer.from("token_pair"), sourceDomainBufferLE, Buffer.from(burnTokenBytes)] },
        { name: '["token_pair", source_domain (as string), burn_token (32 bytes)]', seeds: [Buffer.from("token_pair"), Buffer.from(SOURCE_DOMAIN.toString()), Buffer.from(burnTokenBytes)] },
      ];
      
      let tokenPairPDA: any = null;
      let tokenPairSeedsName = '';
      
      // Ищем правильный вариант
      for (const variant of possibleTokenPairSeeds) {
        const [pda] = PublicKey.findProgramAddressSync(
          variant.seeds,
          TOKEN_MESSENGER_MINTER_PROGRAM_ID
        );
        
        if (pda.toBase58() === EXPECTED_TOKEN_PAIR_PDA) {
          tokenPairPDA = pda;
          tokenPairSeedsName = variant.name;
          console.log('[Minting Solana] ✅ Found correct token_pair PDA:', pda.toBase58());
          console.log('[Minting Solana] ✅ Using seeds:', variant.name);
          break;
        }
      }
      
      // Если не нашли, используем хардкоженное значение
      if (!tokenPairPDA) {
        console.warn('[Minting Solana] ⚠️ Could not find expected token_pair PDA with any seed variant');
        console.warn('[Minting Solana] Expected:', EXPECTED_TOKEN_PAIR_PDA);
        console.warn('[Minting Solana] Trying all variants:');
        for (const variant of possibleTokenPairSeeds) {
          const [pda] = PublicKey.findProgramAddressSync(
            variant.seeds,
            TOKEN_MESSENGER_MINTER_PROGRAM_ID
          );
          console.warn(`[Minting Solana]   ${variant.name}: ${pda.toBase58()}`);
        }
        tokenPairPDA = new PublicKey(EXPECTED_TOKEN_PAIR_PDA);
        tokenPairSeedsName = 'hardcoded_from_successful_tx';
        console.warn('[Minting Solana] Using hardcoded token_pair PDA from successful transaction:', tokenPairPDA.toBase58());
      }
      
      console.log('[Minting Solana] Final token_pair PDA:', tokenPairPDA.toBase58());
      console.log('[Minting Solana] Token pair seeds variant used:', tokenPairSeedsName);
      
      // Custody token account PDA
      // Seeds: ["custody", localTokenMint.publicKey]
      // localTokenMint = USDC_MINT on Solana
      // Ожидаемый PDA из успешной транзакции: FSxJ85FXVsXSr51SeWf9ciJWTcRnqKFSmBgRDeL3KyWw
      const EXPECTED_CUSTODY_TOKEN_ACCOUNT_PDA = 'FSxJ85FXVsXSr51SeWf9ciJWTcRnqKFSmBgRDeL3KyWw';
      
      const [custodyTokenAccountPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("custody"),
          USDC_MINT.toBuffer(),
        ],
        TOKEN_MESSENGER_MINTER_PROGRAM_ID
      );
      
      console.log('[Minting Solana] Generated custody_token_account PDA:', custodyTokenAccountPDA.toBase58());
      console.log('[Minting Solana] Using seeds: ["custody", USDC_MINT]');
      console.log('[Minting Solana] USDC_MINT:', USDC_MINT.toBase58());
      
      // Проверяем, соответствует ли сгенерированный PDA ожидаемому
      if (custodyTokenAccountPDA.toBase58() === EXPECTED_CUSTODY_TOKEN_ACCOUNT_PDA) {
        console.log('[Minting Solana] ✅ custody_token_account PDA matches expected:', custodyTokenAccountPDA.toBase58());
      } else {
        console.warn('[Minting Solana] ⚠️ custody_token_account PDA mismatch:');
        console.warn('[Minting Solana]   Generated:', custodyTokenAccountPDA.toBase58());
        console.warn('[Minting Solana]   Expected:', EXPECTED_CUSTODY_TOKEN_ACCOUNT_PDA);
      }
      
      // Проверяем, существует ли аккаунт custody_token_account
      const custodyTokenAccountInfo = await solanaConnection.getAccountInfo(custodyTokenAccountPDA);
      if (!custodyTokenAccountInfo) {
        console.warn('[Minting Solana] ⚠️ WARNING: custody_token_account does not exist');
        console.warn('[Minting Solana] PDA:', custodyTokenAccountPDA.toBase58());
        console.warn('[Minting Solana] Seeds used: ["custody", USDC_MINT]');
        console.warn('[Minting Solana] The program expects this account to be already initialized.');
      } else {
        console.log('[Minting Solana] ✅ custody_token_account exists:', {
          address: custodyTokenAccountPDA.toBase58(),
          owner: custodyTokenAccountInfo.owner.toBase58(),
          dataLength: custodyTokenAccountInfo.data.length,
        });
      }
      
      // Token program event authority PDA (для CPI в TokenMessengerMinter)
      // Seeds: ["__event_authority"]
      // ProgramId: tokenMessengerMinter
      // Ожидаемый PDA из успешной транзакции: CNfZLeeL4RUxwfPnjA3tLiQt4y43jp4V7bMpga673jf9
      const EXPECTED_EVENT_AUTHORITY_FOR_CPI = 'CNfZLeeL4RUxwfPnjA3tLiQt4y43jp4V7bMpga673jf9';
      
      const [eventAuthorityForCPI] = PublicKey.findProgramAddressSync(
        [Buffer.from("__event_authority")],
        TOKEN_MESSENGER_MINTER_PROGRAM_ID
      );
      
      console.log('[Minting Solana] Generated token_program_event_authority PDA:', eventAuthorityForCPI.toBase58());
      console.log('[Minting Solana] Using seeds: ["__event_authority"]');
      console.log('[Minting Solana] Program ID: TOKEN_MESSENGER_MINTER_PROGRAM_ID');
      
      // Проверяем, соответствует ли сгенерированный PDA ожидаемому
      if (eventAuthorityForCPI.toBase58() === EXPECTED_EVENT_AUTHORITY_FOR_CPI) {
        console.log('[Minting Solana] ✅ token_program_event_authority PDA matches expected:', eventAuthorityForCPI.toBase58());
      } else {
        console.warn('[Minting Solana] ⚠️ token_program_event_authority PDA mismatch:');
        console.warn('[Minting Solana]   Generated:', eventAuthorityForCPI.toBase58());
        console.warn('[Minting Solana]   Expected:', EXPECTED_EVENT_AUTHORITY_FOR_CPI);
      }
      
      // Circle CCTP: user_token_account must match mint_recipient from source chain depositForBurn.
      // When source is Aptos (mint on Solana), mint_recipient must be Solana USDC ATA. https://developers.circle.com/cctp/v1/solana-programs
      console.log('[Minting Solana] Program validation: user_token_account must match mint_recipient from message');
      console.log('[Minting Solana]   user_token_account (recipientTokenAccount):', recipientTokenAccount.toBase58());
      console.log('[Minting Solana]   mint_recipient from messageBody:', mintRecipientFromMessage);
      
      instructionKeys.push(
        { pubkey: tokenMessengerPDA, isSigner: false, isWritable: false }, // 1. token_messenger
        { pubkey: remoteTokenMessengerPDA, isSigner: false, isWritable: false }, // 2. remote_token_messenger
        { pubkey: tokenMinterPDA, isSigner: false, isWritable: true }, // 3. token_minter
        { pubkey: localTokenPDA, isSigner: false, isWritable: true }, // 4. local_token
        { pubkey: tokenPairPDA, isSigner: false, isWritable: false }, // 5. token_pair
        { pubkey: recipientTokenAccount, isSigner: false, isWritable: true }, // 6. user_token_account (recipientTokenAccount)
        { pubkey: custodyTokenAccountPDA, isSigner: false, isWritable: true }, // 7. custody_token_account
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 8. SPL.token_program_id
        { pubkey: eventAuthorityForCPI, isSigner: false, isWritable: false }, // 9. event_authority (для CPI)
        { pubkey: TOKEN_MESSENGER_MINTER_PROGRAM_ID, isSigner: false, isWritable: false }, // 10. program (TokenMessengerMinter)
      );
      
      console.log('[Minting Solana] CCTP v1: Remaining accounts order:');
      console.log('[Minting Solana]   [0] token_messenger:', tokenMessengerPDA.toBase58());
      console.log('[Minting Solana]   [1] remote_token_messenger:', remoteTokenMessengerPDA.toBase58());
      console.log('[Minting Solana]   [2] token_minter:', tokenMinterPDA.toBase58());
      console.log('[Minting Solana]   [3] local_token:', localTokenPDA.toBase58());
      console.log('[Minting Solana]   [4] token_pair:', tokenPairPDA.toBase58());
      console.log('[Minting Solana]   [5] user_token_account:', recipientTokenAccount.toBase58());
      console.log('[Minting Solana]   [6] custody_token_account:', custodyTokenAccountPDA.toBase58());
      console.log('[Minting Solana]   [7] token_program:', TOKEN_PROGRAM_ID.toBase58());
      console.log('[Minting Solana]   [8] event_authority (для CPI):', eventAuthorityForCPI.toBase58());
      console.log('[Minting Solana]   [9] program (TokenMessengerMinter):', TOKEN_MESSENGER_MINTER_PROGRAM_ID.toBase58());
      
      const receiveMessageIx = new TransactionInstruction({
        programId: MESSAGE_TRANSMITTER_PROGRAM_ID,
        keys: instructionKeys,
        data: messageTransmitterData,
      });
      
      console.log('[Minting Solana] Instruction account order:');
      console.log('[Minting Solana]   [0] payer:', solanaPublicKey.toBase58(), '(signer: true, writable: true)');
      console.log('[Minting Solana]   [1] caller:', solanaPublicKey.toBase58(), '(signer: true, writable: false)');
      console.log('[Minting Solana]   [2] message_transmitter:', messageTransmitterAccountToUse.toBase58(), '(signer: false, writable: true)');
      console.log('[Minting Solana] Payer and caller are the same account:', solanaPublicKey.equals(solanaPublicKey));
      
      // Логируем все аккаунты инструкции
      console.log('[Minting Solana] Instruction keys (all accounts):');
      receiveMessageIx.keys.forEach((key, index) => {
        console.log(`[Minting Solana]   [${index}] ${key.pubkey.toBase58()} - signer: ${key.isSigner}, writable: ${key.isWritable}`);
      });
      
      console.log('[Minting Solana] Instruction created with MessageTransmitter program (will CPI to TokenMessengerMinter)');

      transaction.add(receiveMessageIx);
      transaction.feePayer = solanaPublicKey;

      console.log('[Minting Solana] Transaction prepared:', {
        recipient: recipientPubkey.toBase58(),
        recipientValidated: mintRecipientFromMessage ? `✅ ATA адрес из CCTP message (${mintRecipientFromMessage})` : '⚠️ не удалось проверить',
        tokenAccount: recipientTokenAccount.toBase58(),
        needsTokenAccount,
        messageLength: messageBytes.length,
        attestationLength: attestationBytes.length,
        instructionDataLength: messageTransmitterData.length,
      });

      // Step 4: Sign and submit transaction
      setStatus("Please approve the transaction in your wallet...");
      
      if (!signTransaction) {
        throw new Error('Wallet does not support signTransaction');
      }

      // Get fresh blockhash right before signing to avoid "Blockhash not found" error
      // This ensures the blockhash is as fresh as possible
      const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      
      // ВАЖНО: Убеждаемся, что feePayer установлен и является подписантом
      transaction.feePayer = solanaPublicKey;
      
      // Проверяем, что все аккаунты с isSigner: true будут подписаны
      const signers = new Set<string>();
      receiveMessageIx.keys.forEach(key => {
        if (key.isSigner) {
          signers.add(key.pubkey.toBase58());
        }
      });
      console.log('[Minting Solana] Accounts that need to sign:', Array.from(signers));
      console.log('[Minting Solana] Fee payer:', transaction.feePayer.toBase58());
      console.log('[Minting Solana] Fee payer is in signers:', signers.has(transaction.feePayer.toBase58()));

      const signedTransaction = await signTransaction(transaction);
      console.log('[Minting Solana] Transaction signed');
      // Проверяем подписи транзакции
      try {
        const accountKeys = (signedTransaction as any).message?.accountKeys || (signedTransaction as any).message?.staticAccountKeys || [];
        console.log('[Minting Solana] Signed transaction signatures:', signedTransaction.signatures.map((sig, idx) => ({
          index: idx,
          publicKey: accountKeys[idx]?.toBase58() || 'unknown',
          signature: sig.signature ? 'present' : 'missing',
        })));
        console.log('[Minting Solana] Total signatures:', signedTransaction.signatures.length);
        console.log('[Minting Solana] Signatures present:', signedTransaction.signatures.filter(s => s.signature).length);
      } catch (sigError: any) {
        console.warn('[Minting Solana] Could not log signature details:', sigError.message);
      }

      setStatus("Submitting transaction to Solana...");
      
      // Try to submit with preflight first to catch errors early
      let txSignature: string;
      try {
        txSignature = await solanaConnection.sendRawTransaction(
          signedTransaction.serialize(),
          {
            skipPreflight: false,
            maxRetries: 3,
          }
        );
      } catch (sendError: any) {
        // Check for different error types
        const errorMessage = sendError?.message || '';
        const errorLogs = sendError?.logs || [];
        const hasMemoryError = errorMessage.includes('memory allocation') || 
                               errorMessage.includes('out of memory') ||
                               errorLogs.some((log: string) => log.includes('memory allocation') || log.includes('out of memory'));
        const hasInstructionError = errorMessage.includes('InstructionFallbackNotFound') || 
                                    errorMessage.includes('0x65') ||
                                    errorLogs.some((log: string) => log.includes('InstructionFallbackNotFound'));
        
        if (hasMemoryError) {
          console.error('[Minting Solana] Memory allocation error - data format might be incorrect');
          console.error('[Minting Solana] Tried format: discriminator + message + attestation (WITHOUT length prefixes)');
          console.error('[Minting Solana] Error details:', {
            message: errorMessage,
            logs: errorLogs,
          });
          
          throw new Error(
            `Data format error: The instruction data format might be incorrect. ` +
            `Tried format WITHOUT length prefixes (discriminator + message + attestation). ` +
            `Possible issues: 1) Wrong data format (maybe need WITH length prefixes?), ` +
            `2) Wrong account order, 3) Wrong PDA seeds, 4) Wrong discriminator. ` +
            `Error: ${errorMessage}`
          );
        }
        
        if (hasInstructionError) {
          console.error('[Minting Solana] InstructionFallbackNotFound - discriminator is incorrect');
          console.error('[Minting Solana] Tried discriminator seed:', messageTransmitterDiscriminatorSeed);
          
          throw new Error(
            `Instruction discriminator incorrect. Tried "${messageTransmitterDiscriminatorSeed}". ` +
            `This likely means Circle CCTP v1 uses a different instruction format. ` +
            `Possible solutions: 1) Check Circle CCTP IDL for correct instruction format, ` +
            `2) Find correct discriminator from Circle CCTP IDL, ` +
            `3) Check if instruction should be called on TokenMessengerMinter instead of MessageTransmitter. ` +
            `Error: ${errorMessage}`
          );
        }
        throw sendError;
      }

      console.log('[Minting Solana] Transaction submitted:', txSignature);
      setStatus(`Transaction submitted: ${txSignature}`);

      // Wait for confirmation
      setStatus("Waiting for transaction confirmation...");
      const confirmation = await solanaConnection.confirmTransaction({
        signature: txSignature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('[Minting Solana] Transaction confirmed:', confirmation);
      
      toast({
        title: "Mint Successful!",
        description: `USDC minted successfully! Transaction: ${txSignature.slice(0, 8)}...${txSignature.slice(-8)}. View on Solscan: https://solscan.io/tx/${txSignature}`,
      });

      setStatus(`✅ Mint completed! Transaction: ${txSignature}`);

    } catch (error: any) {
      console.error("[Minting Solana] Error:", error);
      setStatus(`Error: ${error.message}`);
      toast({
        title: "Error",
        description: error.message || "Failed to process minting request",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setAttestationProgress(null);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>Solana CCTP Minting</CardTitle>
          <CardDescription>
            Enter Aptos burn transaction signature. Connect a Solana wallet — attestation is fetched and USDC is minted to the ATA from the message (your connected wallet must own that ATA).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Solana wallet connect */}
          <SolanaWalletSelector onWalletChange={() => {}} />

          {/* Wallet Connection Status */}
          {solanaAddress ? (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✓ Solana wallet connected: {solanaAddress.substring(0, 8)}...{solanaAddress.slice(-8)}
              </p>
            </div>
          ) : (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠ Please connect a Solana wallet (e.g. Trust Wallet) to proceed
              </p>
            </div>
          )}

          {/* Status Display */}
          {status && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <p className="text-sm text-blue-800 dark:text-blue-200">{status}</p>
              {attestationProgress && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(attestationProgress.attempt / attestationProgress.maxAttempts) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Attempt {attestationProgress.attempt} of {attestationProgress.maxAttempts}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="signature">Aptos transaction signature</Label>
              <Input
                id="signature"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="0x... (Aptos burn tx hash)"
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Transaction hash from Aptos burn. USDC will be minted to the ATA from the message (connected wallet must own it).</p>
            </div>

            <Button
              onClick={handleMint}
              disabled={
                isProcessing ||
                !signature.trim() ||
                !solanaWallet ||
                !signTransaction
              }
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? "Processing..." : "Mint USDC on Solana"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MintingSolanaPage() {
  return (
    <SolanaWalletProviderWrapper>
      <Suspense fallback={<div className="container mx-auto p-6 max-w-6xl">Loading...</div>}>
        <MintingSolanaPageContent />
      </Suspense>
    </SolanaWalletProviderWrapper>
  );
}

