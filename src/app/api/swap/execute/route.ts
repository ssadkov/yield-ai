import { NextRequest, NextResponse } from 'next/server';
import { PanoraSwapService } from '@/lib/services/panora/swap';
import { HyperionSwapService } from '@/lib/services/protocols/hyperion/swap';

type Provider = 'panora' | 'hyperion';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      provider,
      fromTokenAddress,
      toTokenAddress,
      amount, // human-readable string (e.g., "1.23")
      decimals, // number of decimals for fromToken
      slippagePercentage = '1', // as percent string (e.g., '1' for 1%)
      walletAddress,
    } = body || {};

    if (!provider || !['panora', 'hyperion'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid or missing provider' }, { status: 400 });
    }

    if (!fromTokenAddress || !toTokenAddress || !amount || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: fromTokenAddress, toTokenAddress, amount, walletAddress' },
        { status: 400 }
      );
    }

    if (provider === 'panora') {
      // 1) Get quote via Panora using human-readable amount
      const swapService = PanoraSwapService.getInstance();
      const quoteResp = await swapService.getSwapQuote({
        fromToken: fromTokenAddress,
        toToken: toTokenAddress,
        amount, // Panora expects human-readable amount
        slippage: parseFloat(slippagePercentage) / 100,
      });

      if (!quoteResp.success) {
        return NextResponse.json(
          { error: quoteResp.error || 'Failed to get Panora quote' },
          { status: 400 }
        );
      }

      // 2) Build transaction payload via Panora service
      const execResp = await swapService.executeSwap(quoteResp.data, walletAddress);
      if (!execResp.success) {
        return NextResponse.json(
          { error: execResp.error || 'Failed to build Panora swap payload' },
          { status: 400 }
        );
      }

      const payload = execResp.data;
      if (!payload || !payload.function || !Array.isArray(payload.type_arguments) || !Array.isArray(payload.arguments)) {
        return NextResponse.json(
          { error: 'Invalid Panora payload structure' },
          { status: 400 }
        );
      }

      return NextResponse.json(payload);
    }

    // provider === 'hyperion'
    const hyperion = HyperionSwapService.getInstance();

    // Convert human amount to minimal units using provided decimals (defaults to 8 if not provided)
    const fromDecimals = typeof decimals === 'number' && decimals >= 0 ? decimals : 8;
    const amountInMinimalUnits = Math.floor(parseFloat(String(amount)) * Math.pow(10, fromDecimals));
    if (!isFinite(amountInMinimalUnits) || amountInMinimalUnits <= 0) {
      return NextResponse.json({ error: 'Invalid amount value' }, { status: 400 });
    }

    // Estimate to amount and route
    const estToAmount = await hyperion.estToAmount({
      amount: amountInMinimalUnits,
      from: fromTokenAddress,
      to: toTokenAddress,
      safeMode: true,
    });

    if (!estToAmount?.amountOut) {
      return NextResponse.json({ error: 'No liquidity available for this swap' }, { status: 400 });
    }

    const path: string[] = Array.isArray(estToAmount.path) ? estToAmount.path : [];
    if (path.length === 0) {
      return NextResponse.json({ error: 'No valid swap path found' }, { status: 400 });
    }

    const normalizedPath = path.map((addr: string) =>
      addr === '0xa' ? '0x000000000000000000000000000000000000000000000000000000000000000a' : addr
    );

    const hyperionPayload = await hyperion.getSwapPayload({
      currencyA: fromTokenAddress,
      currencyB: toTokenAddress,
      currencyAAmount: String(amountInMinimalUnits),
      currencyBAmount: estToAmount.amountOut,
      slippage: parseFloat(slippagePercentage) / 100, // e.g. 1% → 0.01
      poolRoute: normalizedPath,
      recipient: walletAddress,
    });

    const payload = {
      ...hyperionPayload,
      // Keep explicit type_arguments to match current client expectations
      type_arguments: ['0x1::aptos_coin::AptosCoin'],
    };

    if (!payload || !payload.function || !Array.isArray(payload.type_arguments) || !Array.isArray(payload.arguments)) {
      return NextResponse.json(
        { error: 'Invalid Hyperion payload structure' },
        { status: 400 }
      );
    }

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error('Error in unified swap execute route:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


