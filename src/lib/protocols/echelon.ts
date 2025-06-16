import { BaseProtocol } from "./BaseProtocol";
import { TransactionPayload } from "@aptos-labs/ts-sdk";
import { getTokenInfo } from '@/lib/tokens/tokenRegistry';

export class EchelonProtocol implements BaseProtocol {
  name = "Echelon";

  async getMarketAddress(token: string): Promise<string> {
    const response = await fetch('/api/protocols/echelon/pools');
    const data = await response.json();
    
    if (!data.success || !Array.isArray(data.marketData)) {
      throw new Error("Invalid response from Echelon API");
    }

    const market = data.marketData.find((m: any) => m.coin === token);
    if (!market) {
      throw new Error(`Market not found for token ${token}`);
    }

    return market.market;
  }

  async buildDeposit(amountOctas: bigint, token: string) {
    console.log('Building deposit for:', { amountOctas, token });

    const tokenInfo = await getTokenInfo(token);
    console.log('Token info:', tokenInfo);

    const marketAddress = await this.getMarketAddress(token);
    console.log('Market address:', marketAddress);

    const functionName = tokenInfo.isFungible 
      ? "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::scripts::supply_fa"
      : "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::scripts::supply";

    return {
      type: "entry_function_payload" as const,
      function: functionName,
      type_arguments: tokenInfo.isFungible ? [] : [token],
      arguments: [marketAddress, amountOctas.toString()]
    };
  }
} 