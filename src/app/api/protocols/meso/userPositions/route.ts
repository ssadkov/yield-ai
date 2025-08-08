import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/utils/http';
import { getMesoTokenByAddress } from '@/lib/protocols/meso/tokens';

interface ViewKeyValue {
  key: string;
  value: string;
}

interface MesoPositionItem {
  assetName: string; // token address or type (as returned by view)
  balance: string; // raw base units from asset_amounts
  amount: number; // normalized by token decimals
  usdValue: number; // normalized by 1e16 from asset_values
  type: 'deposit';
  assetInfo: {
    symbol: string;
    name: string;
    decimals: number;
    logoUrl?: string;
  };
}

async function callView(functionFullname: string, args: any[]): Promise<any> {
  const url = 'https://fullnode.mainnet.aptoslabs.com/v1/view';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      function: functionFullname,
      type_arguments: [],
      arguments: args
    })
  });

  if (!res.ok) {
    throw new Error(`View call failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        createErrorResponse(new Error('Address parameter is required')),
        { status: 400 }
      );
    }

    // Call Meso view functions in parallel
    const packageAddr = '0x68476f9d437e3f32fd262ba898b5e3ee0a23a1d586a6cf29a28add35f253f6f7';
    const fnAmounts = `${packageAddr}::meso::asset_amounts`;
    const fnValues = `${packageAddr}::meso::asset_values`;

    const [amountsResp, valuesResp] = await Promise.all([
      callView(fnAmounts, [address]),
      callView(fnValues, [address])
    ]);

    // Normalize shapes from view result
    const normalize = (resp: any): ViewKeyValue[] => {
      if (!resp) return [];
      // Case 1: direct array of {key, value}
      if (Array.isArray(resp) && resp.length > 0 && typeof resp[0] === 'object' && 'key' in resp[0] && 'value' in resp[0]) {
        return resp as ViewKeyValue[];
      }
      // Case 2: array with single object containing data
      if (Array.isArray(resp) && resp[0] && Array.isArray(resp[0].data)) {
        return resp[0].data as ViewKeyValue[];
      }
      // Case 3: object with data field
      if (!Array.isArray(resp) && resp.data && Array.isArray(resp.data)) {
        return resp.data as ViewKeyValue[];
      }
      return [];
    };

    const amounts: ViewKeyValue[] = normalize(amountsResp);
    const values: ViewKeyValue[] = normalize(valuesResp);

    const keyToAmount = new Map<string, string>();
    for (const item of amounts) {
      if (item && typeof item.key === 'string' && typeof item.value === 'string') {
        keyToAmount.set(item.key, item.value);
      }
    }

    const keyToUsd = new Map<string, string>();
    for (const item of values) {
      if (item && typeof item.key === 'string' && typeof item.value === 'string') {
        keyToUsd.set(item.key, item.value);
      }
    }

    const uniqueKeys = new Set<string>([
      ...Array.from(keyToAmount.keys()),
      ...Array.from(keyToUsd.keys())
    ]);

    const data: MesoPositionItem[] = Array.from(uniqueKeys).map((key) => {
      const rawAmount = keyToAmount.get(key) || '0';
      const rawUsd = keyToUsd.get(key) || '0';

      const mapping = getMesoTokenByAddress(key);
      const decimals = mapping?.decimals ?? 8;

      const amount = Number(BigInt(rawAmount)) / Math.pow(10, decimals);
      const usdValue = Number(BigInt(rawUsd)) / Math.pow(10, 16);

      return {
        assetName: key,
        balance: rawAmount,
        amount,
        usdValue,
        type: 'deposit',
        assetInfo: {
          symbol: mapping?.symbol || (key.split('::').pop() || 'UNKNOWN'),
          name: mapping?.name || key,
          decimals,
          logoUrl: mapping?.logoUrl
        }
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in Meso userPositions route:', error);
    if (error instanceof Error) {
      return NextResponse.json(createErrorResponse(error), { status: 500 });
    }
    return NextResponse.json(createErrorResponse(new Error('Internal server error')), { status: 500 });
  }
}


