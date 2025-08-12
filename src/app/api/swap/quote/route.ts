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
      amount, // human-readable string for panora; number of minimal units for hyperion if decimals provided below
      decimals, // optional, used to convert for hyperion preview
      slippagePercentage = '1',
    } = body || {};

    if (!provider || !['panora', 'hyperion'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid or missing provider' }, { status: 400 });
    }

    if (!fromTokenAddress || !toTokenAddress || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: fromTokenAddress, toTokenAddress, amount' },
        { status: 400 }
      );
    }

    if (provider === 'panora') {
      const swapService = PanoraSwapService.getInstance();
      const resp = await swapService.getSwapQuote({
        fromToken: fromTokenAddress,
        toToken: toTokenAddress,
        amount, // human-readable
        slippage: parseFloat(slippagePercentage) / 100,
      });
      if (!resp.success) {
        return NextResponse.json({ error: resp.error || 'Failed to get quote' }, { status: 400 });
      }
      return NextResponse.json(resp.data);
    }

    // hyperion
    const hyperion = HyperionSwapService.getInstance();
    const fromDecimals = typeof decimals === 'number' && decimals >= 0 ? decimals : 8;
    const amountInMinimalUnits = Math.floor(parseFloat(String(amount)) * Math.pow(10, fromDecimals));
    if (!isFinite(amountInMinimalUnits) || amountInMinimalUnits <= 0) {
      return NextResponse.json({ error: 'Invalid amount value' }, { status: 400 });
    }

    const est = await hyperion.estToAmount({
      amount: amountInMinimalUnits,
      from: fromTokenAddress,
      to: toTokenAddress,
      safeMode: true,
    });

    if (!est?.amountOut) {
      return NextResponse.json({ error: 'No liquidity available' }, { status: 400 });
    }

    return NextResponse.json({
      provider: 'hyperion',
      amountIn: String(amountInMinimalUnits),
      amountOut: est.amountOut,
      path: est.path || [],
      slippage: parseFloat(slippagePercentage) / 100,
    });
  } catch (error: any) {
    console.error('Error in unified swap quote route:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


