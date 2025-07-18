import { TransactionPayload } from "@aptos-labs/ts-sdk";

export interface BaseProtocol {
  name: string;
  buildDeposit(amountOctas: bigint, token: string): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: string[];
  }>;
  buildWithdraw?(marketAddress: string, amountOctas: bigint, token: string): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: string[];
  }>;
  buildClaimRewards?(positionIds: string[], tokenTypes: string[]): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: [string[], any[]];
  }>;
} 