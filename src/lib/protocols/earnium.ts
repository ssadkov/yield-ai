import { BaseProtocol } from "./BaseProtocol";

export class EarniumProtocol implements BaseProtocol {
  name = "Earnium";

  async buildDeposit(amountOctas: bigint, token: string) {
    // Placeholder payload; replace with real Earnium entry function when available
    return {
      type: 'entry_function_payload' as const,
      function: "0xearnium::module::deposit",
      type_arguments: [],
      arguments: [amountOctas.toString(), token]
    };
  }
}


