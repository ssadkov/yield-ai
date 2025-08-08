import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/utils/http';
import { getMesoTokenByAddress } from '@/lib/protocols/meso/tokens';
import tokenList from '@/lib/data/tokenList.json';

interface ViewKeyValue {
  key: string;
  value: string;
}

interface MesoPositionItem {
  assetName: string; // token address or type (as returned by view)
  balance: string; // raw base units from asset_amounts
  amount: number; // normalized by token decimals
  usdValue: number; // normalized by 1e16 from asset_values
  type: 'deposit' | 'debt';
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

    const [amountsResp, valuesResp, debtAmountsResp, debtValuesResp] = await Promise.all([
      callView(fnAmounts, [address]),
      callView(fnValues, [address]),
      callView(`${packageAddr}::lending_pool::debt_amounts`, [address]),
      callView(`${packageAddr}::lending_pool::debt_values`, [address])
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

    // Allow non-uniform shapes for debt responses
    const normalizeAny = (resp: any): any[] => {
      if (!resp) return [];
      if (Array.isArray(resp)) {
        if (resp[0] && Array.isArray(resp[0].data)) return resp[0].data;
        return resp;
      }
      if (resp.data && Array.isArray(resp.data)) return resp.data;
      return [];
    };

    const debtAmountsAny: any[] = normalizeAny(debtAmountsResp);
    const debtValuesAny: any[] = normalizeAny(debtValuesResp);

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
      // fallback to token list
      const token = (tokenList as any).data?.data?.find((t: any) => t.tokenAddress === key || t.faAddress === key);
      const decimals = mapping?.decimals ?? token?.decimals ?? 8;

      const amount = Number(BigInt(rawAmount)) / Math.pow(10, decimals);
      const usdValue = Number(BigInt(rawUsd)) / Math.pow(10, 16);

      return {
        assetName: key,
        balance: rawAmount,
        amount,
        usdValue,
        type: 'deposit',
        assetInfo: {
          symbol: mapping?.symbol || token?.symbol || (key.split('::').pop() || 'UNKNOWN'),
          name: mapping?.name || token?.name || key,
          decimals,
          logoUrl: mapping?.logoUrl || token?.logoUrl
        }
      };
    });

    // Build debt positions: keys are pool inners, need to resolve token via meso::get_token
    const poolInners = new Set<string>();
    for (const item of debtAmountsAny) {
      const inner = typeof item?.key === 'string' ? item.key : item?.key?.inner;
      if (inner) poolInners.add(inner);
    }
    for (const item of debtValuesAny) {
      const inner = typeof item?.key === 'string' ? item.key : item?.key?.inner;
      if (inner) poolInners.add(inner);
    }

    const tokenAddressByPool: Record<string, string> = {};
    await Promise.all(Array.from(poolInners).map(async (inner) => {
      try {
        const resp = await callView(`${packageAddr}::meso::get_token`, [inner]);
        let tokenAddr: string | undefined;
        if (typeof resp === 'string') tokenAddr = resp;
        else if (Array.isArray(resp) && typeof resp[0] === 'string') tokenAddr = resp[0];
        else if (resp && typeof resp.result === 'string') tokenAddr = resp.result;
        if (tokenAddr) tokenAddressByPool[inner] = tokenAddr;
      } catch {}
    }));

    const debtPositions: MesoPositionItem[] = Array.from(poolInners).map((inner) => {
      const tokenAddr = tokenAddressByPool[inner] || inner;
      const mapping = getMesoTokenByAddress(tokenAddr);
      const token = (tokenList as any).data?.data?.find((t: any) => t.tokenAddress === tokenAddr || t.faAddress === tokenAddr);
      const decimals = mapping?.decimals ?? token?.decimals ?? 8;

      const amountItem = debtAmountsAny.find((it) => (typeof it?.key === 'string' ? it.key : it?.key?.inner) === inner);
      const valueItem = debtValuesAny.find((it) => (typeof it?.key === 'string' ? it.key : it?.key?.inner) === inner);
      const rawAmount = amountItem?.value || '0';
      const rawUsd = valueItem?.value || '0';

      const amount = Number(BigInt(rawAmount)) / Math.pow(10, decimals);
      const usdValue = Number(BigInt(rawUsd)) / Math.pow(10, 16);

      return {
        assetName: tokenAddr,
        balance: rawAmount,
        amount,
        usdValue,
        type: 'debt',
        assetInfo: {
          symbol: mapping?.symbol || token?.symbol || (tokenAddr.split('::').pop() || 'UNKNOWN'),
          name: mapping?.name || token?.name || tokenAddr,
          decimals,
          logoUrl: mapping?.logoUrl || token?.logoUrl
        }
      };
    });

    const all = [...data, ...debtPositions];
    return NextResponse.json({ success: true, data: all });
  } catch (error) {
    console.error('Error in Meso userPositions route:', error);
    if (error instanceof Error) {
      return NextResponse.json(createErrorResponse(error), { status: 500 });
    }
    return NextResponse.json(createErrorResponse(new Error('Internal server error')), { status: 500 });
  }
}


