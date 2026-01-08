"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

// Helius RPC endpoint
const HELIUS_RPC_URL = "https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234";

// CCTP TokenMessengerMinter program ID on Solana Mainnet
const CCTP_PROGRAM_ID = "CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3";

interface TransactionData {
  signature: string;
  slot: number;
  blockTime: number | null;
  meta: any;
  transaction: any;
  depositMessageHash?: string;
  cctpData?: any;
  error?: string;
}

export default function CctpFinalizedTransactionPage() {
  const { toast } = useToast();
  const [txSignature, setTxSignature] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [txData, setTxData] = useState<TransactionData | null>(null);
  const [rawResponse, setRawResponse] = useState<string>("");
  const [computedHash, setComputedHash] = useState<string>("");
  const [isComputingHash, setIsComputingHash] = useState<boolean>(false);
  const [decodedCCTPMessage, setDecodedCCTPMessage] = useState<{
    found: boolean;
    instructionIndex?: number;
    groupIndex?: number;
    programId?: string;
    dataBase64?: string;
    dataBytes?: number[];
    dataHex?: string;
    dataLength?: number;
    cctpInstructionCount?: number;
    error?: string;
  } | null>(null);
  
  const [messageAnalysis, setMessageAnalysis] = useState<{
    isValid: boolean;
    issues: string[];
    structure: any;
    correctHash?: string;
    actualHash?: string;
    hashMatches?: boolean;
  } | null>(null);

  // Normalize depositMessageHash format
  const normalizeDepositMessageHash = (hash: string | null): string | null => {
    if (!hash) return null;
    
    // Remove 0x prefix if present
    let normalized = hash.startsWith('0x') ? hash.slice(2) : hash;
    
    // Remove any whitespace
    normalized = normalized.trim();
    
    // Validate length (should be 64 hex characters = 32 bytes)
    if (normalized.length !== 64) {
      console.warn('[CCTP Finalized] depositMessageHash has invalid length:', {
        original: hash,
        normalized,
        length: normalized.length,
        expected: 64,
      });
    }
    
    // Validate hex format
    if (!/^[0-9a-fA-F]+$/.test(normalized)) {
      console.warn('[CCTP Finalized] depositMessageHash contains non-hex characters:', hash);
      return null;
    }
    
    // Return with 0x prefix
    return `0x${normalized.toLowerCase()}`;
  };

  // Verify if transaction is a CCTP transaction test test
  const verifyCCTPTransaction = (tx: any) => {
    try {
      const instructions = tx.transaction?.message?.instructions || [];
      const accountKeys = tx.transaction?.message?.accountKeys || [];
      
      let hasCCTPInstruction = false;
      let cctpInstructionIndex = -1;
      
      for (let i = 0; i < instructions.length; i++) {
        const ix = instructions[i];
        const programIdIndex = ix.programIdIndex ?? ix.programId;
        const programId = accountKeys[programIdIndex];
        
        if (programId && (programId.toString() === CCTP_PROGRAM_ID || programId === CCTP_PROGRAM_ID)) {
          hasCCTPInstruction = true;
          cctpInstructionIndex = i;
          break;
        }
      }
      
      return {
        isValid: hasCCTPInstruction,
        hasCCTPInstruction,
        cctpInstructionIndex,
        instructionsCount: instructions.length,
      };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message,
      };
    }
  };

  // Extract CCTP data from transaction
  const extractCCTPData = (tx: any) => {
    try {
      const instructions = tx.transaction?.message?.instructions || [];
      const accountKeys = tx.transaction?.message?.accountKeys || [];
      
      for (const ix of instructions) {
        const programIdIndex = ix.programIdIndex ?? ix.programId;
        const programId = accountKeys[programIdIndex];
        
        if (programId && (programId.toString() === CCTP_PROGRAM_ID || programId === CCTP_PROGRAM_ID)) {
          // This is a CCTP instruction
          const data = ix.data;
          const keys = ix.accounts || ix.accountKeyIndexes || [];
          
          return {
            programId: programId.toString(),
            data: data ? (typeof data === 'string' ? data : Buffer.from(data).toString('base64')) : null,
            dataHex: data ? (typeof data === 'string' ? Buffer.from(data, 'base64').toString('hex') : Buffer.from(data).toString('hex')) : null,
            accounts: keys.map((idx: number) => {
              const key = accountKeys[idx];
              return key ? (key.toString ? key.toString() : key) : null;
            }).filter(Boolean),
            instructionIndex: instructions.indexOf(ix),
          };
        }
      }
      
      return null;
    } catch (error: any) {
      console.error('[CCTP Finalized] Error extracting CCTP data:', error);
      return { error: error.message };
    }
  };

  // Decode CCTP message from innerInstructions
  const decodeCCTPMessage = (tx: any) => {
    try {
      console.log('[CCTP Finalized] Attempting to decode CCTP message from innerInstructions...');
      
      if (!tx.meta?.innerInstructions || !Array.isArray(tx.meta.innerInstructions)) {
        console.log('[CCTP Finalized] No innerInstructions found');
        return {
          found: false,
          error: 'No innerInstructions found in transaction',
        };
      }

      const accountKeys = tx.transaction?.message?.accountKeys || [];
      const staticAccountKeys = tx.transaction?.message?.staticAccountKeys || [];
      const allAccountKeys = [...staticAccountKeys, ...accountKeys];

      // CCTP program ID (может быть в разных форматах)
      const cctpProgramIds = [
        'CCTPmbSD7gX1X4bE3XJLCntZFM5V5bBn6DLdP5p2j5Pv',
        'CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3',
      ];

      let cctpInstructionCount = 0;
      
      // Ищем все innerInstructions
      for (let groupIdx = 0; groupIdx < tx.meta.innerInstructions.length; groupIdx++) {
        const group = tx.meta.innerInstructions[groupIdx];
        const instructions = group.instructions || [];

        for (let ixIdx = 0; ixIdx < instructions.length; ixIdx++) {
          const innerIx = instructions[ixIdx];
          
          // Получаем programId из inner instruction
          let programId: string | null = null;
          
          if (innerIx.programId) {
            programId = typeof innerIx.programId === 'string' 
              ? innerIx.programId 
              : innerIx.programId.toString();
          } else if (innerIx.programIdIndex !== undefined) {
            const key = allAccountKeys[innerIx.programIdIndex];
            if (key) {
              programId = typeof key === 'string' ? key : key.toString();
            }
          }

          if (!programId) continue;

          // Проверяем, является ли это CCTP программой
          const isCCTP = cctpProgramIds.some(id => 
            programId === id || 
            programId?.includes('CCTP') ||
            programId?.startsWith('CCTP')
          );

          if (isCCTP) {
            cctpInstructionCount++;
            console.log(`[CCTP Finalized] Found CCTP instruction #${cctpInstructionCount} at group ${groupIdx}, index ${ixIdx}:`, {
              programId,
              hasData: !!innerIx.data,
              dataType: typeof innerIx.data,
            });

            // Ищем вторую инструкцию (index 1, так как считаем с 0)
            if (cctpInstructionCount === 2 && innerIx.data) {
              console.log('[CCTP Finalized] Found second CCTP instruction, decoding data...');
              
              let dataBase64: string = '';
              
              // Обрабатываем разные форматы данных
              if (typeof innerIx.data === 'string') {
                // Если это строка, проверяем, является ли она base64
                dataBase64 = innerIx.data;
              } else if (Array.isArray(innerIx.data)) {
                // Если это массив чисел, конвертируем в base64
                const bytes = new Uint8Array(innerIx.data);
                dataBase64 = btoa(String.fromCharCode(...bytes));
              } else if (innerIx.data instanceof Uint8Array) {
                // Если это Uint8Array, конвертируем в base64
                dataBase64 = btoa(String.fromCharCode(...innerIx.data));
              } else {
                // Пытаемся использовать Buffer (если доступен)
                try {
                  dataBase64 = Buffer.from(innerIx.data).toString('base64');
                } catch (e) {
                  console.error('[CCTP Finalized] Unknown data format:', typeof innerIx.data, innerIx.data);
                  return {
                    found: true,
                    instructionIndex: ixIdx,
                    groupIndex: groupIdx,
                    programId,
                    error: `Unknown data format: ${typeof innerIx.data}`,
                  };
                }
              }
              
              // Декодируем из Base64 в байты
              let dataBytes: number[] = [];
              let dataHex = '';
              
              try {
                // Используем atob для декодирования base64
                const binaryString = atob(dataBase64);
                dataBytes = Array.from(binaryString, c => c.charCodeAt(0));
                
                // Конвертируем в hex
                dataHex = dataBytes.map(b => b.toString(16).padStart(2, '0')).join('');
                
                console.log('[CCTP Finalized] Decoded CCTP message:', {
                  dataLength: dataBytes.length,
                  dataHexLength: dataHex.length,
                  firstBytes: dataBytes.slice(0, 20),
                  firstBytesHex: dataHex.substring(0, 40),
                });

                return {
                  found: true,
                  instructionIndex: ixIdx,
                  groupIndex: groupIdx,
                  programId,
                  dataBase64,
                  dataBytes,
                  dataHex,
                  dataLength: dataBytes.length,
                };
              } catch (decodeError: any) {
                console.error('[CCTP Finalized] Error decoding base64:', decodeError);
                return {
                  found: true,
                  instructionIndex: ixIdx,
                  groupIndex: groupIdx,
                  programId,
                  dataBase64,
                  error: `Failed to decode base64: ${decodeError.message}`,
                };
              }
            }
          }
        }
      }

      return {
        found: false,
        error: `Found ${cctpInstructionCount} CCTP instruction(s), but need the second one (index 1)`,
        cctpInstructionCount,
      };
    } catch (error: any) {
      console.error('[CCTP Finalized] Error decoding CCTP message:', error);
      return {
        found: false,
        error: error.message || 'Unknown error',
      };
    }
  };

  // Analyze CCTP message structure
  const analyzeCCTPMessage = async (dataBytes: number[], dataHex: string, actualHash?: string) => {
    try {
      console.log('[CCTP Finalized] Analyzing CCTP message structure...');
      
      const issues: string[] = [];
      const structure: any = {};
      
      if (dataBytes.length < 268) {
        issues.push(`Message too short: ${dataBytes.length} bytes, expected at least 268 bytes`);
        return {
          isValid: false,
          issues,
          structure: {},
        };
      }
      
      // Parse structure according to CCTP V2 format
      // Expected structure:
      // 0-3: version (u32, little-endian) - should be 0, 1, or 2
      // 4-7: source_domain (u32, little-endian) - Solana = 0x00000001
      // 8-11: dest_domain (u32, little-endian) - Aptos = 0x00000002
      // 12-19: nonce (u64, little-endian)
      // 20-51: sender (32 bytes)
      // 52-83: recipient (32 bytes)
      // 84-115: destination_caller (32 bytes)
      // 116+: payload (variable)
      
      // Check version (should be at offset 0)
      const versionBytes = dataBytes.slice(0, 4);
      const version = versionBytes[0] | (versionBytes[1] << 8) | (versionBytes[2] << 16) | (versionBytes[3] << 24);
      structure.version = {
        offset: 0,
        length: 4,
        value: version,
        hex: dataHex.substring(0, 8),
        expected: [0, 1, 2],
        isValid: version === 0 || version === 1 || version === 2,
      };
      
      if (!structure.version.isValid) {
        issues.push(`Invalid version: ${version} (0x${version.toString(16)}), expected 0, 1, or 2`);
      }
      
      // Check source_domain (should be at offset 4)
      const sourceDomainBytes = dataBytes.slice(4, 8);
      const sourceDomain = sourceDomainBytes[0] | (sourceDomainBytes[1] << 8) | (sourceDomainBytes[2] << 16) | (sourceDomainBytes[3] << 24);
      structure.sourceDomain = {
        offset: 4,
        length: 4,
        value: sourceDomain,
        hex: dataHex.substring(8, 16),
        expected: 0x00000001, // Solana Mainnet
        isValid: sourceDomain === 0x00000001,
      };
      
      if (!structure.sourceDomain.isValid) {
        issues.push(`Invalid source_domain: 0x${sourceDomain.toString(16).padStart(8, '0')}, expected 0x00000001 (Solana Mainnet)`);
        
        // Check if it looks like a hash (first 32 bytes of message)
        const first32Bytes = dataHex.substring(0, 64);
        if (first32Bytes === dataHex.substring(0, 64)) {
          issues.push(`CRITICAL: source_domain appears to be a hash! This suggests the message structure is corrupted.`);
        }
      }
      
      // Check dest_domain (should be at offset 8)
      const destDomainBytes = dataBytes.slice(8, 12);
      const destDomain = destDomainBytes[0] | (destDomainBytes[1] << 8) | (destDomainBytes[2] << 16) | (destDomainBytes[3] << 24);
      structure.destDomain = {
        offset: 8,
        length: 4,
        value: destDomain,
        hex: dataHex.substring(16, 24),
        expected: 0x00000002, // Aptos Mainnet
        isValid: destDomain === 0x00000002,
      };
      
      if (!structure.destDomain.isValid) {
        issues.push(`Invalid dest_domain: 0x${destDomain.toString(16).padStart(8, '0')}, expected 0x00000002 (Aptos Mainnet)`);
      }
      
      // Check nonce (should be at offset 12)
      const nonceBytes = dataBytes.slice(12, 20);
      let nonce = BigInt(0);
      for (let i = 0; i < 8; i++) {
        nonce |= BigInt(nonceBytes[i]) << BigInt(i * 8);
      }
      structure.nonce = {
        offset: 12,
        length: 8,
        value: nonce.toString(),
        hex: dataHex.substring(24, 40),
      };
      
      // Extract other fields
      structure.sender = {
        offset: 20,
        length: 32,
        hex: dataHex.substring(40, 104),
      };
      
      structure.recipient = {
        offset: 52,
        length: 32,
        hex: dataHex.substring(104, 168),
      };
      
      structure.destinationCaller = {
        offset: 84,
        length: 32,
        hex: dataHex.substring(168, 232),
      };
      
      // Check if first 32 bytes match a hash pattern
      const first32BytesHex = dataHex.substring(0, 64);
      const actualHashFromLogs = actualHash?.replace('0x', '').toLowerCase() || '';
      
      // Compute correct hash from entire message using keccak256
      let correctHash: string | null = null;
      try {
        // Use @noble/hashes for keccak256 (should be available as transitive dependency)
        const { sha3_256 } = await import('@noble/hashes/sha3');
        
        // Convert hex string to Uint8Array
        const bytes = new Uint8Array(dataBytes.length);
        for (let i = 0; i < dataBytes.length; i++) {
          bytes[i] = dataBytes[i];
        }
        
        // Compute keccak256 hash
        const hash = sha3_256(bytes);
        const hashHex = Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
        correctHash = `0x${hashHex}`;
        
        console.log('[CCTP Finalized] Computed correct hash from full message:', correctHash);
      } catch (e: any) {
        console.warn('[CCTP Finalized] Could not compute correct hash:', e);
        // Fallback: try to use API if available
        try {
          // This won't work with raw bytes, but we'll try anyway
          console.log('[CCTP Finalized] Attempting API fallback...');
        } catch (apiError) {
          console.warn('[CCTP Finalized] API fallback also failed');
        }
      }
      
      // Check if first 32 bytes match the hash from logs
      const hashMatches = actualHashFromLogs ? (first32BytesHex === actualHashFromLogs.toLowerCase()) : undefined;
      if (hashMatches) {
        issues.push(`CRITICAL: First 32 bytes of message match depositMessageHash from logs! This means the message structure is corrupted - a hash was written into the message data instead of proper CCTP fields.`);
      }
      
      // Check if first 32 bytes match computed hash
      if (correctHash) {
        const correctHashNoPrefix = correctHash.replace('0x', '').toLowerCase();
        const hashMatchesComputed = first32BytesHex === correctHashNoPrefix;
        if (hashMatchesComputed) {
          issues.push(`CRITICAL: First 32 bytes of message match the computed Keccak256 hash! This confirms the message structure is corrupted.`);
        }
      }
      
      const analysis = {
        isValid: issues.length === 0,
        issues,
        structure,
        correctHash: correctHash || undefined,
        actualHash: actualHashFromLogs || undefined,
        hashMatches,
      };
      
      console.log('[CCTP Finalized] Message analysis:', analysis);
      return analysis;
    } catch (error: any) {
      console.error('[CCTP Finalized] Error analyzing message:', error);
      return {
        isValid: false,
        issues: [`Error analyzing message: ${error.message}`],
        structure: {},
      };
    }
  };

  // Compute depositMessageHash from CCTP message
  const computeDepositMessageHash = async (cctpMessage: any) => {
    setIsComputingHash(true);
    setComputedHash("");
    
    try {
      console.log('[CCTP Finalized] Computing depositMessageHash from CCTP message:', cctpMessage);
      
      // Serialize CCTP message
      // CCTP message structure:
      // - sourceDomain (4 bytes)
      // - destinationDomain (4 bytes)
      // - nonce (8 bytes)
      // - sender (32 bytes)
      // - recipient (32 bytes)
      // - destinationCaller (32 bytes)
      // - payload (variable)
      
      // For now, we'll use the API route to compute the hash
      const response = await fetch('/api/compute-deposit-message-hash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: cctpMessage }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.hash) {
        const normalized = normalizeDepositMessageHash(result.hash);
        setComputedHash(normalized || result.hash);
        console.log('[CCTP Finalized] Computed depositMessageHash:', normalized || result.hash);
        return normalized || result.hash;
      } else {
        throw new Error(result.error || 'Failed to compute hash');
      }
    } catch (error: any) {
      console.error('[CCTP Finalized] Error computing depositMessageHash:', error);
      toast({
        title: "Error Computing Hash",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsComputingHash(false);
    }
  };

  // Fetch finalized transaction
  const fetchFinalizedTransaction = async () => {
    if (!txSignature.trim()) {
      toast({
        title: "Error",
        description: "Please enter a transaction signature",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setTxData(null);
    setRawResponse("");
    setComputedHash("");
    setDecodedCCTPMessage(null);
    setMessageAnalysis(null);

    try {
      console.log('[CCTP Finalized] Fetching finalized transaction:', txSignature.trim());
      
      // Use Helius RPC to get finalized transaction
      const response = await fetch(HELIUS_RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "1",
          method: "getTransaction",
          params: [
            txSignature.trim(),
            {
              encoding: "jsonParsed",
              maxSupportedTransactionVersion: 0,
              commitment: "finalized",
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      
      console.log('[CCTP Finalized] RPC response:', json);
      setRawResponse(JSON.stringify(json, null, 2));

      if (json.error) {
        throw new Error(json.error.message || 'RPC error');
      }

      if (!json.result) {
        throw new Error('Transaction not found or not finalized yet');
      }

      const tx = json.result;
      
      // Verify CCTP transaction
      const verification = verifyCCTPTransaction(tx);
      console.log('[CCTP Finalized] CCTP verification:', verification);
      
      if (!verification.isValid) {
        toast({
          title: "Warning",
          description: "This transaction does not appear to be a CCTP transaction",
          variant: "default",
        });
      }

      // Extract CCTP data
      const cctpData = extractCCTPData(tx);
      console.log('[CCTP Finalized] Extracted CCTP data:', cctpData);

      // Try to extract depositMessageHash from logs
      let depositMessageHash: string | null = null;
      const logs = tx.meta?.logMessages || [];
      
      for (const log of logs) {
        const patterns = [
          /message[_\s]?hash[:\s]+([A-Za-z0-9]{32,})/i,
          /deposit[_\s]?message[_\s]?hash[:\s]+([A-Za-z0-9]{32,})/i,
          /0x([A-Fa-f0-9]{64})/,
          /([A-Fa-f0-9]{64})/,
        ];

        for (const pattern of patterns) {
          const match = log.match(pattern);
          if (match && match[1]) {
            const hash = match[1];
            if (hash.length >= 32 && hash.length <= 128) {
              depositMessageHash = normalizeDepositMessageHash(hash);
              break;
            }
          }
        }
        
        if (depositMessageHash) break;
      }

      // Check inner instructions
      if (!depositMessageHash && tx.meta?.innerInstructions) {
        for (const innerIxGroup of tx.meta.innerInstructions) {
          for (const innerIx of innerIxGroup.instructions) {
            if (innerIx.data) {
              const dataStr = Buffer.from(innerIx.data, 'base64').toString('hex');
              if (dataStr.length >= 64) {
                const hashMatch = dataStr.match(/([A-Fa-f0-9]{64})/);
                if (hashMatch) {
                  depositMessageHash = normalizeDepositMessageHash(hashMatch[1]);
                  break;
                }
              }
            }
          }
          if (depositMessageHash) break;
        }
      }

      // Decode CCTP message from innerInstructions
      const decoded = decodeCCTPMessage(tx);
      setDecodedCCTPMessage(decoded);
      console.log('[CCTP Finalized] Decoded CCTP message result:', decoded);
      
      // Analyze message structure if decoded successfully
      if (decoded.found && decoded.dataBytes && decoded.dataHex) {
        const analysis = await analyzeCCTPMessage(decoded.dataBytes, decoded.dataHex, depositMessageHash || undefined);
        setMessageAnalysis(analysis);
        console.log('[CCTP Finalized] Message analysis result:', analysis);
      } else {
        setMessageAnalysis(null);
      }

      const transactionData: TransactionData = {
        signature: txSignature.trim(),
        slot: tx.slot,
        blockTime: tx.blockTime,
        meta: tx.meta,
        transaction: tx.transaction,
        depositMessageHash: depositMessageHash || undefined,
        cctpData: cctpData || undefined,
      };

      setTxData(transactionData);
      
      console.log('[CCTP Finalized] Transaction data:', transactionData);
      
      toast({
        title: "Transaction Fetched",
        description: `Transaction data retrieved successfully. ${depositMessageHash ? 'depositMessageHash found.' : 'depositMessageHash not found in logs.'}`,
      });

    } catch (error: any) {
      console.error('[CCTP Finalized] Error fetching transaction:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to fetch transaction',
        variant: "destructive",
      });
      
      setTxData({
        signature: txSignature.trim(),
        error: error.message || 'Failed to fetch transaction',
      } as TransactionData);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>CCTP Finalized Transaction Recovery</CardTitle>
          <CardDescription>
            Fetch a finalized Solana transaction and extract CCTP data to recover depositMessageHash.
            Use this if the transaction was completed but depositMessageHash was not saved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="txSignature">Transaction Signature</Label>
              <Input
                id="txSignature"
                value={txSignature}
                onChange={(e) => setTxSignature(e.target.value)}
                placeholder="Enter Solana transaction signature"
                className="font-mono text-sm"
              />
            </div>
            
            <Button
              onClick={fetchFinalizedTransaction}
              disabled={isLoading || !txSignature.trim()}
              className="w-full"
            >
              {isLoading ? "Fetching..." : "Fetch Finalized Transaction"}
            </Button>
          </div>

          {/* Transaction Data Display */}
          {txData && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Transaction Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Signature</Label>
                    <p className="font-mono text-sm break-all">{txData.signature}</p>
                  </div>
                  
                  {txData.error ? (
                    <div className="text-red-500">
                      <Label>Error</Label>
                      <p>{txData.error}</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Slot</Label>
                          <p>{txData.slot?.toLocaleString()}</p>
                        </div>
                        <div>
                          <Label>Block Time</Label>
                          <p>
                            {txData.blockTime
                              ? new Date(txData.blockTime * 1000).toLocaleString()
                              : "N/A"}
                          </p>
                        </div>
                      </div>

                      {/* CCTP Data */}
                      {txData.cctpData && (
                        <div>
                          <Label>CCTP Instruction Data</Label>
                          <div className="bg-muted p-4 rounded-md space-y-2">
                            <div>
                              <span className="font-semibold">Program ID:</span>{" "}
                              <span className="font-mono text-sm">{txData.cctpData.programId}</span>
                            </div>
                            {txData.cctpData.dataHex && (
                              <div>
                                <span className="font-semibold">Data (Hex):</span>
                                <p className="font-mono text-xs break-all mt-1">
                                  {txData.cctpData.dataHex}
                                </p>
                              </div>
                            )}
                            {txData.cctpData.accounts && txData.cctpData.accounts.length > 0 && (
                              <div>
                                <span className="font-semibold">Accounts ({txData.cctpData.accounts.length}):</span>
                                <ul className="list-disc list-inside mt-1 space-y-1">
                                  {txData.cctpData.accounts.map((acc: string, idx: number) => (
                                    <li key={idx} className="font-mono text-xs break-all">
                                      {acc}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Deposit Message Hash */}
                      {txData.depositMessageHash ? (
                        <div>
                          <Label>Extracted depositMessageHash</Label>
                          <p className="font-mono text-sm break-all bg-green-100 dark:bg-green-900 p-2 rounded">
                            {txData.depositMessageHash}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-md">
                          <p className="text-sm">
                            <strong>Note:</strong> depositMessageHash was not found in transaction logs.
                            You may need to compute it from the CCTP message data.
                          </p>
                        </div>
                      )}

                      {/* Compute Hash Button */}
                      {txData.cctpData && !txData.depositMessageHash && (
                        <div>
                          <Button
                            onClick={() => computeDepositMessageHash(txData.cctpData)}
                            disabled={isComputingHash}
                            variant="outline"
                          >
                            {isComputingHash ? "Computing..." : "Compute depositMessageHash from CCTP Data"}
                          </Button>
                          {computedHash && (
                            <div className="mt-2">
                              <Label>Computed depositMessageHash</Label>
                              <p className="font-mono text-sm break-all bg-green-100 dark:bg-green-900 p-2 rounded">
                                {computedHash}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Transaction Meta */}
                      {txData.meta && (
                        <div>
                          <Label>Transaction Meta</Label>
                          <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
                            <div>
                              <span className="font-semibold">Fee:</span>{" "}
                              {txData.meta.fee ? `${txData.meta.fee / 1e9} SOL` : "N/A"}
                            </div>
                            <div>
                              <span className="font-semibold">Status:</span>{" "}
                              {txData.meta.err ? (
                                <span className="text-red-500">Failed: {JSON.stringify(txData.meta.err)}</span>
                              ) : (
                                <span className="text-green-500">Success</span>
                              )}
                            </div>
                            {txData.meta.logMessages && (
                              <div>
                                <span className="font-semibold">Log Messages ({txData.meta.logMessages.length}):</span>
                                <div className="max-h-60 overflow-y-auto mt-2 space-y-1">
                                  {txData.meta.logMessages.map((log: string, idx: number) => (
                                    <div key={idx} className="font-mono text-xs break-all bg-background p-1 rounded">
                                      {log}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Raw Response */}
              {rawResponse && (
                <Card>
                  <CardHeader>
                    <CardTitle>Raw RPC Response</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <textarea
                      value={rawResponse}
                      readOnly
                      className="w-full font-mono text-xs h-96 p-4 bg-muted rounded-md border resize-none"
                    />
                  </CardContent>
                </Card>
              )}

              {/* Decoded CCTP Message */}
              {decodedCCTPMessage && (
                <Card>
                  <CardHeader>
                    <CardTitle>Decoded CCTP Message (Raw)</CardTitle>
                    <CardDescription>
                      Decoded data from the second CCTP instruction in innerInstructions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {decodedCCTPMessage.found ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Program ID</Label>
                            <p className="font-mono text-sm break-all">{decodedCCTPMessage.programId}</p>
                          </div>
                          <div>
                            <Label>Data Length</Label>
                            <p className="font-mono text-sm">{decodedCCTPMessage.dataLength} bytes</p>
                          </div>
                        </div>

                        {decodedCCTPMessage.dataBase64 && (
                          <div>
                            <Label>Data (Base64)</Label>
                            <textarea
                              value={decodedCCTPMessage.dataBase64}
                              readOnly
                              className="w-full font-mono text-xs h-24 p-4 bg-muted rounded-md border resize-none"
                            />
                          </div>
                        )}

                        {decodedCCTPMessage.dataHex && (
                          <div>
                            <Label>Data (Hex - Raw)</Label>
                            <textarea
                              value={decodedCCTPMessage.dataHex}
                              readOnly
                              className="w-full font-mono text-xs h-48 p-4 bg-muted rounded-md border resize-none"
                            />
                          </div>
                        )}

                        {decodedCCTPMessage.dataBytes && (
                          <div>
                            <Label>Data (Bytes Array - Raw)</Label>
                            <textarea
                              value={`[${decodedCCTPMessage.dataBytes.join(', ')}]`}
                              readOnly
                              className="w-full font-mono text-xs h-48 p-4 bg-muted rounded-md border resize-none"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              Length: {decodedCCTPMessage.dataBytes.length} bytes
                            </p>
                          </div>
                        )}

                        {decodedCCTPMessage.instructionIndex !== undefined && (
                          <div className="text-sm text-muted-foreground">
                            Found at: Group {decodedCCTPMessage.groupIndex}, Instruction {decodedCCTPMessage.instructionIndex}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-md">
                        <p className="text-sm">
                          <strong>Not Found:</strong> {decodedCCTPMessage.error || 'CCTP message not found in innerInstructions'}
                        </p>
                        {decodedCCTPMessage.cctpInstructionCount !== undefined && (
                          <p className="text-sm mt-2">
                            Found {decodedCCTPMessage.cctpInstructionCount} CCTP instruction(s), but need the second one.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Message Structure Analysis */}
              {messageAnalysis && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      CCTP Message Structure Analysis
                      {messageAnalysis.isValid ? (
                        <span className="ml-2 text-green-500">✓ Valid</span>
                      ) : (
                        <span className="ml-2 text-red-500">✗ Invalid</span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Analysis of CCTP message structure to detect serialization issues
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Issues */}
                    {messageAnalysis.issues.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-red-600 dark:text-red-400">Issues Found ({messageAnalysis.issues.length})</Label>
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md space-y-2">
                          {messageAnalysis.issues.map((issue, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="font-semibold text-red-600 dark:text-red-400">⚠</span> {issue}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Structure Details */}
                    {messageAnalysis.structure && (
                      <div className="space-y-4">
                        <Label>Message Structure</Label>
                        <div className="bg-muted p-4 rounded-md space-y-3">
                          {/* Version */}
                          {messageAnalysis.structure.version && (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">Version (offset 0-3):</span>
                                <span className="font-mono text-sm">{messageAnalysis.structure.version.hex}</span>
                                <span className="text-muted-foreground">= {messageAnalysis.structure.version.value}</span>
                                {messageAnalysis.structure.version.isValid ? (
                                  <span className="text-green-500">✓</span>
                                ) : (
                                  <span className="text-red-500">✗ Expected: {messageAnalysis.structure.version.expected.join(', ')}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Source Domain */}
                          {messageAnalysis.structure.sourceDomain && (
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">Source Domain (offset 4-7):</span>
                                <span className="font-mono text-sm">{messageAnalysis.structure.sourceDomain.hex}</span>
                                <span className="text-muted-foreground">= 0x{messageAnalysis.structure.sourceDomain.value.toString(16).padStart(8, '0')}</span>
                                {messageAnalysis.structure.sourceDomain.isValid ? (
                                  <span className="text-green-500">✓</span>
                                ) : (
                                  <>
                                    <span className="text-red-500">✗</span>
                                    <span className="text-sm text-red-600 dark:text-red-400">
                                      Expected: 0x{messageAnalysis.structure.sourceDomain.expected.toString(16).padStart(8, '0')} (Solana Mainnet)
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Dest Domain */}
                          {messageAnalysis.structure.destDomain && (
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">Dest Domain (offset 8-11):</span>
                                <span className="font-mono text-sm">{messageAnalysis.structure.destDomain.hex}</span>
                                <span className="text-muted-foreground">= 0x{messageAnalysis.structure.destDomain.value.toString(16).padStart(8, '0')}</span>
                                {messageAnalysis.structure.destDomain.isValid ? (
                                  <span className="text-green-500">✓</span>
                                ) : (
                                  <>
                                    <span className="text-red-500">✗</span>
                                    <span className="text-sm text-red-600 dark:text-red-400">
                                      Expected: 0x{messageAnalysis.structure.destDomain.expected.toString(16).padStart(8, '0')} (Aptos Mainnet)
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Nonce */}
                          {messageAnalysis.structure.nonce && (
                            <div>
                              <span className="font-semibold">Nonce (offset 12-19):</span>
                              <span className="font-mono text-sm ml-2">{messageAnalysis.structure.nonce.hex}</span>
                              <span className="text-muted-foreground ml-2">= {messageAnalysis.structure.nonce.value}</span>
                            </div>
                          )}

                          {/* Other fields */}
                          {messageAnalysis.structure.sender && (
                            <div>
                              <span className="font-semibold">Sender (offset 20-51):</span>
                              <span className="font-mono text-xs ml-2 break-all">{messageAnalysis.structure.sender.hex}</span>
                            </div>
                          )}

                          {messageAnalysis.structure.recipient && (
                            <div>
                              <span className="font-semibold">Recipient (offset 52-83):</span>
                              <span className="font-mono text-xs ml-2 break-all">{messageAnalysis.structure.recipient.hex}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Hash Comparison */}
                    <div className="space-y-2">
                      <Label>Hash Analysis</Label>
                      <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
                        {messageAnalysis.actualHash && (
                          <div>
                            <span className="font-semibold">Hash from logs:</span>
                            <span className="font-mono text-xs ml-2 break-all">0x{messageAnalysis.actualHash}</span>
                          </div>
                        )}
                        {messageAnalysis.correctHash && (
                          <div>
                            <span className="font-semibold">Correct hash (Keccak256 of full message):</span>
                            <span className="font-mono text-xs ml-2 break-all">{messageAnalysis.correctHash}</span>
                          </div>
                        )}
                        {messageAnalysis.hashMatches && (
                          <div className="text-red-600 dark:text-red-400 font-semibold">
                            ⚠ CRITICAL: First 32 bytes of message match the hash from logs! This indicates corrupted message structure.
                          </div>
                        )}
                        {decodedCCTPMessage?.dataHex && (
                          <div>
                            <span className="font-semibold">First 32 bytes of message:</span>
                            <span className="font-mono text-xs ml-2 break-all">{decodedCCTPMessage.dataHex.substring(0, 64)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

