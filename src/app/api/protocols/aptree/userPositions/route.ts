import { NextRequest, NextResponse } from 'next/server';
import { AptosWalletService } from '@/lib/services/aptos/wallet';
import { normalizeAddress } from '@/lib/utils/addressNormalization';
import { FungibleAssetBalance } from '@/lib/types/aptos';

const APTREE_EARN_TOKEN_ADDRESS =
  '0x5ecc6aff1d75144990a3798c904cc7c49e5c0cc3d5a134babc5b60184012310d';
const APTREE_DECIMALS = 6;
const APTREE_PRICE_DECIMALS = 9;
const APTOS_VIEW_URL = 'https://fullnode.mainnet.aptoslabs.com/v1/view';
const APTREE_EARN_VIEW_FUNCTION =
  '0x951a31b39db54a4e32af927dce9fae7aa1ad14a1bb73318405ccf6cd5d66b3be::moneyfi_adapter::get_lp_price';
const DISPLAY_SYMBOL = 'USDT';
const DISPLAY_NAME = 'Tether USD';
const DISPLAY_LOGO_URL = 'https://assets.panora.exchange/tokens/aptos/USDT.svg';
const DISPLAY_USDT_PRICE = 1; // Display layer only. Core value still uses AET math.

/**
 * GET /api/protocols/aptree/userPositions
 * Minimal APTree positions: map wallet AET balance into protocol position format.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { success: false, error: 'Address parameter is required' },
      { status: 400 }
    );
  }

  try {
    let aptreePriceUsd = 0;
    try {
      const priceResp = await fetch(APTOS_VIEW_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          function: APTREE_EARN_VIEW_FUNCTION,
          type_arguments: [],
          arguments: [],
        }),
        cache: 'no-store',
      });
      const payload = (await priceResp.json().catch(() => null)) as unknown;
      const raw = Array.isArray(payload) && payload.length > 0 ? Number(payload[0]) : NaN;
      aptreePriceUsd = Number.isFinite(raw) ? raw / Math.pow(10, APTREE_PRICE_DECIMALS) : 0;
    } catch {
      aptreePriceUsd = 0;
    }

    const walletService = AptosWalletService.getInstance();
    const walletData = await walletService.getBalances(address);
    const balances: FungibleAssetBalance[] = Array.isArray(walletData?.balances)
      ? walletData.balances
      : [];

    const aptreeBalance = balances.find((b: FungibleAssetBalance) => {
      const assetType = typeof b?.asset_type === 'string' ? b.asset_type : '';
      return (
        normalizeAddress(assetType).toLowerCase() ===
        normalizeAddress(APTREE_EARN_TOKEN_ADDRESS).toLowerCase()
      );
    });

    const rawBalance = aptreeBalance?.amount || '0';
    const normalizedBalance = Number(rawBalance) / Math.pow(10, APTREE_DECIMALS);
    const valueUsd = normalizedBalance * aptreePriceUsd;
    const displayAmountUsdt = DISPLAY_USDT_PRICE > 0 ? valueUsd / DISPLAY_USDT_PRICE : valueUsd;

    const positions =
      Number(rawBalance) > 0
        ? [
            {
              poolId: 1,
              assetName: DISPLAY_SYMBOL,
              balance: rawBalance, // raw on-chain units
              value: valueUsd.toString(), // USD value
              displayPrice: DISPLAY_USDT_PRICE,
              displayAmount: displayAmountUsdt.toString(),
              type: 'deposit',
              assetInfo: {
                symbol: DISPLAY_SYMBOL,
                logoUrl: DISPLAY_LOGO_URL,
                decimals: APTREE_DECIMALS,
                name: DISPLAY_NAME,
              },
            },
          ]
        : [];

    return NextResponse.json({
      success: true,
      data: positions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load APTree positions',
        data: [],
      },
      { status: 500 }
    );
  }
}
