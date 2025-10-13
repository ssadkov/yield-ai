import { BaseProtocol } from '../protocols/BaseProtocol';
import { WalletContextState } from '@aptos-labs/wallet-adapter-react';

interface ExecuteDepositParams {
  protocol: BaseProtocol;
  token: string;
  amount: bigint;
  wallet: WalletContextState;
}

export async function executeDeposit(
  protocol: BaseProtocol,
  token: string,
  amount: bigint,
  wallet: WalletContextState
) {
  console.log('Executing deposit with:', {
    protocol,
    protocolType: typeof protocol,
    protocolKeys: Object.keys(protocol),
    token,
    amount
  });

  if (!protocol || typeof protocol !== 'object') {
    throw new Error('Invalid protocol instance');
  }

  console.log('Protocol methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(protocol)));

  if (typeof protocol.buildDeposit !== 'function') {
    throw new Error('Protocol does not have buildDeposit method');
  }

  // Special handling for Amnis protocol with APT and amAPT tokens
  if (protocol.name === 'Amnis Finance' && 
      (token === '0x1::aptos_coin::AptosCoin' || 
       token === '0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::amapt_token::AmnisApt')) {
    console.log('Using custom Amnis deposit logic for token:', token);
    
    // Convert Uint8Array address to hex string if needed
    let walletAddress: string;
    if (wallet.account?.address?.data && Array.isArray(wallet.account.address.data)) {
      walletAddress = '0x' + Array.from(wallet.account.address.data)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } else {
      walletAddress = wallet.account?.address?.toString() || "0x56ff2fc971deecd286314fe99b8ffd6a5e72e62eacdc46ae9b234c5282985f97";
    }
    
    console.log('Wallet address for Amnis:', walletAddress);
    
    // Choose function based on token type
    const functionName = token === '0x1::aptos_coin::AptosCoin' 
      ? "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::router::deposit_and_stake_entry"
      : "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::router::stake_entry";
    
    const payload = {
      type: "entry_function_payload" as const,
      function: functionName,
      type_arguments: [],
      arguments: [
        amount.toString(), // Amount as string
        walletAddress // Wallet address as string
      ]
    };
    
    console.log('Generated Amnis payload:', payload);
    console.log('Arguments types:', payload.arguments.map(arg => ({ value: arg, type: typeof arg })));
    return payload;
  }

  // Special handling for Auro Finance - need pool address for deposit to position
  if (protocol.name === 'Auro Finance') {
    console.log('Using custom Auro deposit logic for token:', token);
    
    // For Auro Finance, we need to get the pool address from the context
    // Since we don't have it here, we'll use a fallback approach
    // The actual pool address should be passed from the UI component
    
    // For now, we'll use the standard buildDeposit method
    // In the future, we might need to extend this to support poolAddress parameter
    console.log('Using standard Auro buildDeposit method');
  }

  // Standard protocol handling
  const payload = await protocol.buildDeposit(amount, token, wallet.account?.address?.toString());
  console.log('Generated payload:', payload);

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload generated');
  }

  return payload;
} 