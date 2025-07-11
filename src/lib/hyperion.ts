import { Network } from "@aptos-labs/ts-sdk";
import { initHyperionSDK } from '@hyperionxyz/sdk';

// Инициализируем SDK с основными параметрами
export const sdk = initHyperionSDK({
  network: Network.MAINNET,
  APTOS_API_KEY: process.env.APTOS_API_KEY || "",
}); 