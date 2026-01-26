import { NextRequest, NextResponse } from 'next/server';
import { Aptos, AptosConfig, Network, AccountAddress, Account, Ed25519PrivateKey, MoveVector, U32, U64 } from '@aptos-labs/ts-sdk';

const aptosConfig = new AptosConfig({
  network: Network.MAINNET,
});

const aptosClient = new Aptos(aptosConfig);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      sender, 
      bytecode, 
      functionArguments, 
      maxGasAmount = 100000, 
      gasUnitPrice = 100,
      feePayerAddress 
    } = body;

    if (!sender || !bytecode || !functionArguments) {
      return NextResponse.json(
        { error: 'Missing required fields: sender, bytecode, functionArguments' },
        { status: 400 }
      );
    }

    console.log('[Get Signing Message API] Building transaction:', {
      sender,
      bytecodeLength: bytecode.length,
      functionArgumentsCount: functionArguments.length,
      feePayerAddress,
    });

    // For bytecode Script payloads, TS-SDK expects ScriptFunctionArgumentTypes (BCS objects).
    // This endpoint is currently tailored for Circle CCTP `deposit_for_burn` args:
    // [amount(u64), destination_domain(u32), mint_recipient(vector<u8>), burn_token(address)]
    let processedFunctionArguments: any[] = [];
    try {
      const amount = typeof functionArguments?.[0] === "string" ? BigInt(functionArguments[0]) : BigInt(functionArguments?.[0]);
      const destinationDomain = Number(functionArguments?.[1]);
      const recipientBytes = functionArguments?.[2] as number[];
      const burnToken = functionArguments?.[3] as string;

      processedFunctionArguments = [
        new U64(amount),
        new U32(destinationDomain),
        MoveVector.U8(recipientBytes),
        AccountAddress.fromString(burnToken),
      ];
    } catch (e) {
      // Fallback: keep original args (may fail serialization, but gives a clearer error)
      processedFunctionArguments = functionArguments;
    }

    // Get fee payer address from environment variables (required for bytecode transactions)
    // SDK requires feePayerAddress even when building transaction for signing message
    let feePayerAccountAddress: AccountAddress | undefined;
    const feePayerAddressEnv = process.env.NEXT_PUBLIC_APTOS_PAYER_WALLET_ADDRESS;
    const feePayerPrivateKeyEnv = process.env.NEXT_PUBLIC_APTOS_PAYER_WALLET_PRIVATE_KEY;
    
    if (feePayerAddressEnv) {
      feePayerAccountAddress = AccountAddress.fromString(feePayerAddressEnv);
    } else if (feePayerPrivateKeyEnv) {
      // Create account from private key to get address
      const feePayerAccount = Account.fromPrivateKey({
        privateKey: new Ed25519PrivateKey(feePayerPrivateKeyEnv),
      });
      feePayerAccountAddress = feePayerAccount.accountAddress;
    } else if (feePayerAddress) {
      // Use feePayerAddress from request if env vars not available
      feePayerAccountAddress = AccountAddress.fromString(feePayerAddress);
    } else {
      // Fallback: use sender as fee payer (just for getting signing message)
      feePayerAccountAddress = AccountAddress.fromString(sender);
    }

    try {
      console.log('[Get Signing Message API] Attempting to build transaction WITH fee payer (required for bytecode):', {
        sender,
        feePayerAddress: feePayerAccountAddress.toString(),
        withFeePayer: true,
      });

      // For bytecode transactions, SDK requires withFeePayer: true
      // feePayerAddress should be set after building the transaction
      const transaction = await aptosClient.transaction.build.simple({
        sender,
        withFeePayer: true, // Required for bytecode transactions
        data: {
          bytecode: new Uint8Array(bytecode),
          typeArguments: [],
          functionArguments: processedFunctionArguments,
        },
        options: {
          maxGasAmount,
          gasUnitPrice,
        },
      });

      // Set feePayerAddress immediately after building, before getSigningMessage
      // This is required even if we passed it in options
      transaction.feePayerAddress = feePayerAccountAddress;
      if (transaction.rawTransaction) {
        (transaction.rawTransaction as any).feePayerAddress = feePayerAccountAddress;
      }

      console.log('[Get Signing Message API] Transaction built successfully with fee payer');

      // Get signing message from transaction
      // The signing message for the sender is the same whether or not there's a fee payer
      const signingMessage = aptosClient.transaction.getSigningMessage({ transaction });
      
      console.log('[Get Signing Message API] Signing message obtained, length:', signingMessage.length);
      
      return NextResponse.json({
        signingMessage: Array.from(signingMessage),
      });
    } catch (buildError: any) {
      console.error('[Get Signing Message API] Build error details:', {
        message: buildError.message,
        stack: buildError.stack,
        name: buildError.name,
      });
      throw new Error(`Failed to build transaction: ${buildError.message}`);
    }
  } catch (error: any) {
    console.error('[Get Signing Message API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get signing message' },
      { status: 500 }
    );
  }
}
