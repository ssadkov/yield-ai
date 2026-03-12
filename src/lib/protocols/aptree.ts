import { BaseProtocol } from "./BaseProtocol";

export class AptreeProtocol implements BaseProtocol {
  name = "APTree";

  async buildDeposit(): Promise<{
    type: "entry_function_payload";
    function: string;
    type_arguments: string[];
    arguments: string[];
  }> {
    // APTree is currently integrated as external-only flow.
    throw new Error("APTree deposit transaction is not implemented for native flow");
  }
}
