export interface FungibleAssetBalance {
  asset_type: string;
  amount: string;
  last_transaction_timestamp: string;
}
 
export interface WalletBalances {
  balances: FungibleAssetBalance[];
} 