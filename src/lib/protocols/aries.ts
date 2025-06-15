import { BaseProtocol } from "./BaseProtocol";
import { TransactionPayload } from "@aptos-labs/ts-sdk";

export class AriesProtocol implements BaseProtocol {
  name = "Aries";

  async buildDeposit(amountOctas: bigint, token: string) {
    return {
      type: "entry_function_payload" as const,
      function: "0x9770fa9c725cbd97eb50b2be5f0366fd55a3f90c9b6f8c425c5d6c2d6f3f3f3f::lending::deposit",
      type_arguments: [token],
      arguments: [amountOctas.toString()]
    };
  }
} 