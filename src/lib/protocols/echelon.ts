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

    // Special handling for APT token address mapping
    let searchToken = token;
    if (token === '0xa') {
      // If token is faAddress (0xa), search for the full tokenAddress
      searchToken = '0x1::aptos_coin::AptosCoin';
    } else if (token === '0x1::aptos_coin::AptosCoin') {
      // If token is full tokenAddress, also try faAddress as fallback
      searchToken = '0xa';
    }

    let market = data.marketData.find((m: any) => m.coin === token);
    
    // If not found with original token, try with mapped token
    if (!market && searchToken !== token) {
      market = data.marketData.find((m: any) => m.coin === searchToken);
    }
    
    if (!market) {
      throw new Error(`Market not found for token ${token}`);
    }

    return market.market;
  }

  async buildDeposit(amountOctas: bigint, token: string, userAddress?: string) {
    console.log('Building deposit for:', { amountOctas, token, userAddress });

    const tokenInfo = await getTokenInfo(token);
    console.log('Token info:', tokenInfo);

    const marketAddress = await this.getMarketAddress(token);
    console.log('Market address:', marketAddress);

    const functionName = tokenInfo.isFungible 
      ? "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::scripts::supply_fa"
      : "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::scripts::supply";

    // For non-fungible tokens, use the full token type instead of faAddress
    const typeArgument = tokenInfo.isFungible ? [] : [tokenInfo.tokenAddress || token];
    
    return {
      type: "entry_function_payload" as const,
      function: functionName,
      type_arguments: typeArgument,
      arguments: [marketAddress, amountOctas.toString()]
    };
  }

  async buildWithdraw(marketAddress: string, amountOctas: bigint, token: string, userAddress?: string) {
    console.log('Building withdraw for:', { marketAddress, amountOctas, token, userAddress });

    const tokenInfo = await getTokenInfo(token);
    console.log('Token info:', tokenInfo);

    // Check if this is 100% withdraw by analyzing amount
    // Since withdraw amount comes directly from slider, check if it matches full available
    const isFullyWithdraw = await this.isFullWithdraw(marketAddress, amountOctas, userAddress);
    
    let functionName: string;
    let argumentsToPass: any[];

    if (isFullyWithdraw) {
      // Use withdraw_all functions for 100% withdraw (no amount needed)
      functionName = tokenInfo.isFungible 
        ? "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::scripts::withdraw_all_fa"
        : "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::scripts::withdraw_all";
      
      argumentsToPass = [marketAddress]; // For withdraw_all functions, just pass marketAddress directly as string
      console.log('Using withdraw_all functions for 100% withdraw:', functionName);
    } else {
      // Use regular withdraw functions for partial withdraw (specify amount)
      functionName = tokenInfo.isFungible 
        ? "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::scripts::withdraw_fa"
        : "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::scripts::withdraw";
      
      argumentsToPass = [marketAddress, amountOctas.toString()];
      console.log('Using regular withdraw functions for partial withdraw:', functionName);
    }

    // For non-fungible tokens, use the full token type instead of faAddress
    const typeArgument = tokenInfo.isFungible ? [] : [tokenInfo.tokenAddress || token];

    return {
      type: "entry_function_payload" as const,
      function: functionName,
      type_arguments: typeArgument,
      arguments: argumentsToPass
    };
  }

  /**
   * Helper method to determine if this is a full withdraw by checking:
   * 1. If amountOctas equals user's total available balance in market 
   * 2. Account for small rounding differences that can occur in calculations
   */
  private async isFullWithdraw(marketAddress: string, amountOctas: bigint, userAddress?: string): Promise<boolean> {
    if (!userAddress) return false;
    
    try {
      // Get user's position from the API to check total available
      const response = await fetch(`/api/protocols/echelon/userPositions?address=${userAddress}`);
      const positions = await response.json();
      
      if (positions.success && positions.data) {
        const userPosition = positions.data.find((pos: any) => pos.market === marketAddress && pos.type === 'supply');
        if (userPosition) {
          const userTotalBalance = BigInt(userPosition.amount || 0); // raw balance in octas
          // Check if amount equals total balance (allow small rounding difference)
          const diff = amountOctas > userTotalBalance ? amountOctas - userTotalBalance : userTotalBalance - amountOctas;
          const isFullWithdrawResult = diff <= BigInt(1000); // Allow up to 1000 octas difference for rounding
          
          console.log('Full withdraw check:', {
            amountOctas: amountOctas.toString(),
            userTotalBalance: userTotalBalance.toString(),
            diff: diff.toString(),
            isFullWithdraw: isFullWithdrawResult
          });
          
          return isFullWithdrawResult;
        }
      }
    } catch (error) {
      console.warn('Failed to check full withdraw status:', error);
    }
    
    return false;
  }

  async buildClaimRewards(positionIds: string[], tokenTypes: string[], userAddress?: string) {
    console.log('Building claim rewards for:', { positionIds, tokenTypes, userAddress });

    // Для Echelon используем API endpoint напрямую, как в рабочем компоненте
    if (!userAddress) {
      throw new Error('User address is required for Echelon claims');
    }

    if (positionIds.length === 0 || tokenTypes.length === 0) {
      throw new Error('No position IDs or token types provided');
    }

    const farmingId = positionIds[0];
    const tokenType = tokenTypes[0];

    // Map token types back to reward names
    const TOKEN_TYPE_TO_REWARD_NAME: { [key: string]: string } = {
      "0x1::aptos_coin::AptosCoin": "Aptos Coin",
      "0xfaf4e633ae9eb31366c9ca24214231760926576c7b625313b3688b5e900731f6::staking::ThalaAPT": "Thala APT",
      "0xfaf4e633ae9eb31366c9ca24214231760926576c7b625313b3688b5e900731f6::staking::StakedThalaAPT": "StakedThalaAPT",
      "0xb2c7780f0a255a6137e5b39733f5a4c85fe093c549de5c359c1232deef57d1b7": "ECHO",
      "0x5ae6789dd2fec1a9ec9cccfb3acaf12e93d432f0a3a42c92fe1a9d490b7bbc06::mkl_token::MKL": "MKL",
      "0xb36527754eb54d7ff55daf13bcb54b42b88ec484bd6f0e3b2e0d1db169de6451": "AMI",
      "0x53a30a6e5936c0a4c5140daed34de39d17ca7fcae08f947c02e979cef98a3719::coin::LSD": "LSD",
      "0x7fd500c11216f0fe3095d0c4b8aa4d64a4e2e04f83758462f2b127255643615::thl_coin::THL": "THL",
      "0x2ebb2ccac5e027a87fa0e2e5f656a3a4238d6a48d93ec9b610d570fc0aa0df12": "CELL",
      "0xeedba439a4ab8987a995cf5cfefebd713000b3365718a29dfbc36bc214445fb8": "VIBE",
    };

    const rewardName = TOKEN_TYPE_TO_REWARD_NAME[tokenType];
    // if (!rewardName) {
      // throw new Error(`Unknown token type for Echelon: ${tokenType}`);
    // }

    // Используем API endpoint для получения правильного payload
    const response = await fetch('/api/protocols/echelon/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userAddress: userAddress,
        rewardName: rewardName,
        farmingId: farmingId
      })
    });

    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to create claim payload');
    }

    return data.data.transactionPayload;
  }
} 