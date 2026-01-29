/**
 * Privacy Cash Bridge Module
 * 
 * Специализированный модуль для построения транзакций CCTP burn
 * из временного кошелька (tmp wallet) в Privacy Cash flow.
 * 
 * Этот модуль предназначен для работы ТОЛЬКО с tmp wallet и Privacy Cash,
 * чтобы не затрагивать отлаженный код основного бриджа.
 */

import {
  PublicKey,
  Transaction,
  Connection,
  Keypair,
} from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  USDC_MINT,
  TOKEN_MESSENGER_MINTER_PROGRAM_ID,
  MESSAGE_TRANSMITTER_PROGRAM_ID,
} from "./cctp-mint-pdas";
import { createDepositForBurnInstructionManual } from "./cctp-deposit-for-burn";

const DOMAIN_APTOS = 9;

/**
 * Конвертирует Aptos адрес в 32 байта для mint_recipient.
 * Доки Circle: https://developers.circle.com/cctp/v1/solana-programs
 * Mint Recipient for Solana as SOURCE: при burn на Solana (mint на Aptos)
 * mint_recipient = адрес получателя на destination chain (Aptos) — 32 байта, base58 как Pubkey.
 */
function aptosAddressToBytes(aptosAddress: string): Uint8Array {
  const cleanAddress = aptosAddress.startsWith("0x")
    ? aptosAddress.slice(2)
    : aptosAddress;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(cleanAddress.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export interface PrivacyCashBridgeParams {
  /** Временный кошелек (tmp wallet) - откуда будет происходить burn */
  tmpKeypair: Keypair;
  /** Кошелек для оплаты комиссии (fee payer) */
  feePayerKeypair: Keypair;
  /** Solana connection */
  solanaConnection: Connection;
  /** Aptos адрес получателя */
  aptosRecipient: string;
  /** Callback для обновления статуса */
  onStatusUpdate?: (status: string) => void;
  /** 
   * Опционально: реальный token account адрес (если Privacy Cash использует нестандартный ATA)
   * Если не указан, будет вычислен стандартный ATA или найден автоматически
   */
  tokenAccountAddress?: PublicKey;
}

/**
 * Выполняет CCTP burn из временного кошелька Privacy Cash в Aptos
 * 
 * Использует полный баланс USDC с tmp wallet для burn транзакции.
 * Работает ТОЛЬКО с tmp wallet (не требует wallet adapter).
 * 
 * @returns Signature транзакции на Solana
 */
export async function executePrivacyCashBridge(
  params: PrivacyCashBridgeParams
): Promise<string> {
  const {
    tmpKeypair,
    feePayerKeypair,
    solanaConnection,
    aptosRecipient,
    onStatusUpdate,
    tokenAccountAddress,
  } = params;

  const log = (s: string) => onStatusUpdate?.(s);

  log("Preparing Privacy Cash bridge transaction (tmp wallet mode)...");
  log(`Tmp wallet address: ${tmpKeypair.publicKey.toBase58()}`);
  log(`Fee payer address: ${feePayerKeypair.publicKey.toBase58()}`);
  log(`USDC mint address: ${USDC_MINT.toBase58()}`);

  // Проверяем баланс SOL у fee payer (tmp wallet не имеет SOL — для этого и используется fee payer)
  try {
    const feePayerBalance = await solanaConnection.getBalance(feePayerKeypair.publicKey);
    const feePayerBalanceSol = feePayerBalance / 1e9;
    log(`Fee payer SOL balance: ${feePayerBalanceSol.toFixed(4)} SOL (address: ${feePayerKeypair.publicKey.toBase58()})`);
    if (feePayerBalanceSol < 0.001) {
      throw new Error(
        `Fee payer has insufficient SOL (${feePayerBalanceSol.toFixed(4)} SOL). Need at least 0.001 SOL. ` +
        `Check that SOLANA_PAYER_WALLET_PRIVATE_KEY corresponds to SOLANA_PAYER_WALLET_ADDRESS and the wallet is funded.`
      );
    }
  } catch (e: any) {
    if (e.message?.includes("Fee payer") || e.message?.includes("insufficient SOL")) {
      throw e;
    }
    log(`Could not check fee payer balance: ${e.message}`);
  }

  let ownerTokenAccount: PublicKey;
  let rawAmount: string;

  if (tokenAccountAddress) {
    log(`Using provided token account address: ${tokenAccountAddress.toBase58()}`);
    ownerTokenAccount = tokenAccountAddress;
    const balanceInfo = await solanaConnection.getTokenAccountBalance(ownerTokenAccount);
    rawAmount = balanceInfo?.value?.amount ?? "";
    if (!rawAmount) {
      throw new Error(`No balance on provided token account ${tokenAccountAddress.toBase58()}`);
    }
  } else {
    // Ищем USDC token account по владельцу (Privacy Cash может создавать не ATA)
    log("Searching for USDC token account by owner...");
    const tokenAccounts = await solanaConnection.getParsedTokenAccountsByOwner(
      tmpKeypair.publicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    log(`Found ${tokenAccounts.value.length} token account(s) for tmp wallet`);
    const usdcAccounts = tokenAccounts.value.filter(
      (ta) => ta.account.data.parsed.info.mint === USDC_MINT.toBase58()
    );

    if (usdcAccounts.length === 0) {
      throw new Error(
        `USDC token account not found for tmp wallet. Mint: ${USDC_MINT.toBase58()}. Found ${tokenAccounts.value.length} other token account(s).`
      );
    }

    // Берём первый USDC-аккаунт с ненулевым балансом, иначе первый USDC
    const withBalance = usdcAccounts.filter(
      (ta) => Number(ta.account.data.parsed.info.tokenAmount.amount) > 0
    );
    const chosen = withBalance.length > 0 ? withBalance[0] : usdcAccounts[0];
    ownerTokenAccount = chosen.pubkey;
    rawAmount = chosen.account.data.parsed.info.tokenAmount.amount;

    // Проверяем owner token account
    const tokenAccountOwner = new PublicKey(chosen.account.data.parsed.info.owner);
    log(`Token account owner: ${tokenAccountOwner.toBase58()}`);
    log(`Tmp wallet address: ${tmpKeypair.publicKey.toBase58()}`);
    
    if (!tokenAccountOwner.equals(tmpKeypair.publicKey)) {
      log(`⚠️ WARNING: Token account owner (${tokenAccountOwner.toBase58()}) differs from tmp wallet (${tmpKeypair.publicKey.toBase58()})`);
      log(`This might cause transaction failure. Token account may belong to a different owner.`);
    }

    const calculatedAta = await getAssociatedTokenAddress(
      USDC_MINT,
      tmpKeypair.publicKey
    );
    if (!ownerTokenAccount.equals(calculatedAta)) {
      log(`Using on-chain token account: ${ownerTokenAccount.toBase58()} (differs from ATA: ${calculatedAta.toBase58()})`);
    } else {
      log(`Using token account: ${ownerTokenAccount.toBase58()}`);
    }
  }

  const amountInBaseUnits = BigInt(rawAmount);
  if (amountInBaseUnits <= BigInt(0)) {
    throw new Error("USDC balance on tmp wallet is zero");
  }

  const amountUsdc = Number(amountInBaseUnits) / 1_000_000;
  log(`Found ${amountUsdc.toFixed(6)} USDC on tmp wallet. Building CCTP burn transaction...`);

  // Проверяем owner token account (если мы его получили из parsed data)
  let actualOwner: PublicKey = tmpKeypair.publicKey;
  if (!tokenAccountAddress) {
    // Если мы искали token account, проверим его owner
    try {
      const accountInfo = await solanaConnection.getAccountInfo(ownerTokenAccount);
      if (accountInfo) {
        // Парсим owner из token account data (первые 32 байта после discriminator)
        // Token account layout: mint (32) + owner (32) + amount (8) + ...
        const ownerBytes = accountInfo.data.slice(32, 64);
        const parsedOwner = new PublicKey(ownerBytes);
        
        if (!parsedOwner.equals(tmpKeypair.publicKey)) {
          log(`⚠️ Token account owner mismatch! Account owner: ${parsedOwner.toBase58()}, Tmp wallet: ${tmpKeypair.publicKey.toBase58()}`);
          log(`Using token account owner (${parsedOwner.toBase58()}) for instruction, but transaction must be signed by tmp wallet.`);
          // ВАЖНО: owner в инструкции должен быть тем, кто подписывает транзакцию
          // Если owner token account != tmpKeypair, то инструкция не пройдёт
          // Но мы всё равно используем tmpKeypair как owner, потому что он подписывает
          actualOwner = tmpKeypair.publicKey;
        } else {
          log(`✅ Token account owner matches tmp wallet: ${parsedOwner.toBase58()}`);
        }
      }
    } catch (e: any) {
      log(`Could not verify token account owner: ${e.message}`);
    }
  }

  // mint_recipient при burn на Solana (destination Aptos) = Aptos-адрес получателя (32 байта)
  const mintRecipientBytes = aptosAddressToBytes(aptosRecipient);

  // Генерируем keypair для messageSendEventData account
  log("Generating messageSendEventData keypair...");
  const messageSendEventDataKeypair = Keypair.generate();
  const messageSendEventData = messageSendEventDataKeypair.publicKey;

  // Создаём depositForBurn instruction
  // ВАЖНО: senderAddress должен быть тем, кто подписывает транзакцию (tmpKeypair.publicKey)
  log(`Building depositForBurn instruction with owner: ${actualOwner.toBase58()}`);
  const { instruction } = await createDepositForBurnInstructionManual(
    TOKEN_MESSENGER_MINTER_PROGRAM_ID,
    MESSAGE_TRANSMITTER_PROGRAM_ID,
    USDC_MINT,
    DOMAIN_APTOS,
    actualOwner, // owner, который подписывает транзакцию
    feePayerKeypair.publicKey, // event_rent_payer: сервисный кошелёк с SOL
    ownerTokenAccount, // token account адрес
    mintRecipientBytes,
    amountInBaseUnits,
    messageSendEventData,
    messageSendEventDataKeypair
  );

  // Создаём транзакцию (fee payer — только переданный кошелёк, tmp wallet SOL не используется)
  const tx = new Transaction();
  tx.add(instruction);
  tx.feePayer = feePayerKeypair.publicKey;

  // Получаем свежий blockhash
  log("Getting fresh blockhash...");
  const { blockhash } = await solanaConnection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;

  // Подписываем транзакцию: tmp wallet (owner), messageSendEventData, fee payer
  log("Signing transaction with tmp wallet and fee payer...");
  tx.partialSign(tmpKeypair, messageSendEventDataKeypair, feePayerKeypair);

  // Отправляем транзакцию
  log("Sending transaction to Solana...");
  const signature = await solanaConnection.sendRawTransaction(
    tx.serialize(),
    {
      skipPreflight: false,
      maxRetries: 3,
    }
  );

  log(`✅ Burn transaction submitted: ${signature}`);
  return signature;
}
