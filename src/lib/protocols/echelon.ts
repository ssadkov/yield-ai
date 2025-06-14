import { BaseProtocol } from "./BaseProtocol";
import { TransactionPayload } from "@aptos-labs/ts-sdk";

export class EchelonProtocol implements BaseProtocol {
  name = "Echelon";

  buildDeposit(amountOctas: bigint, token: string) {
    return {
      type: "entry_function_payload" as const,
      function: "0x8f396e4246b2ba87b51c0739ef5ea4f26515a98375308c31ac2ec1e42142a57f::lending::deposit",
      type_arguments: [token],
      arguments: [amountOctas.toString()]
    };
  }
} 