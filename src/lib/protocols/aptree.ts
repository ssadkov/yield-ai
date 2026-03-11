import { BaseProtocol } from "./BaseProtocol";

export class AptreeProtocol implements BaseProtocol {
  name = "Aptree";

  async buildDeposit(): Promise<{
    type: "entry_function_payload";
    function: string;
    type_arguments: string[];
    arguments: string[];
  }> {
    // Aptree is currently integrated as external-only flow.
    throw new Error("Aptree deposit transaction is not implemented for native flow");
  }
}
