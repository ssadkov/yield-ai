import { BaseProtocol } from "./BaseProtocol";
import { TransactionPayload } from "@aptos-labs/ts-sdk";

export class MesoProtocol implements BaseProtocol {
  name = "Meso Finance";

  async buildDeposit(amountOctas: bigint, token: string) {
    return {
      type: "entry_function_payload" as const,
      function: "0x68476f9d437e3f32fd262ba898b5e3ee0a23a1d586a6cf29a28add35f253f6f7::lending_pool::deposit",
      type_arguments: [token],
      arguments: [amountOctas.toString()]
    };
  }
} 