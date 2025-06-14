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
    protocolMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(protocol)),
    token,
    amount
  });

  if (!protocol || typeof protocol !== 'object') {
    throw new Error('Invalid protocol instance');
  }

  if (typeof protocol.buildDeposit !== 'function') {
    throw new Error('Protocol does not have buildDeposit method');
  }

  const payload = await protocol.buildDeposit(amount, token);
  console.log('Generated payload:', payload);

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload generated');
  }

  return payload;
} 