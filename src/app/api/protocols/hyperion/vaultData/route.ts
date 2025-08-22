import { NextRequest, NextResponse } from 'next/server';
import { getVaultTokenMapping } from '@/lib/services/hyperion/vaultTokens';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vaultTokenAddress, walletAddress } = body;

    if (!vaultTokenAddress || !walletAddress) {
      return NextResponse.json(
        { error: "vaultTokenAddress and walletAddress are required" },
        { status: 400 }
      );
    }

    // console.log('🔍 Hyperion vaultData API called:', { vaultTokenAddress, walletAddress });

    // Получаем маппинг Vault токена
    const vaultMapping = getVaultTokenMapping(vaultTokenAddress);
    if (!vaultMapping) {
      return NextResponse.json(
        { error: "Invalid vault token address" },
        { status: 400 }
      );
    }

    // Делаем запрос к блокчейну
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (process.env.APTOS_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.APTOS_API_KEY}`;
    }

    const response = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        function: '0x19bcbcf8e688fd5ddf52725807bc8bf455a76d4b5a6021cfdc4b5b2652e5cd55::vaults::get_token_amount_by_address',
        type_arguments: [],
        arguments: [vaultTokenAddress, walletAddress]
      })
    });

    if (!response.ok) {
      console.error('❌ Blockchain API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Blockchain API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Blockchain response:', data);

    // Проверяем, что получили массив
    if (!Array.isArray(data)) {
      console.error('❌ Unexpected response format:', data);
      return NextResponse.json(
        { error: "Unexpected response format from blockchain" },
        { status: 500 }
      );
    }

    // Формируем результат с токенами и их количествами
    const result = {
      vaultTokenAddress,
      vaultSymbol: vaultMapping.symbol,
      tokenAmounts: data,
      tokenAddresses: vaultMapping.tokens.map(t => t.address),
      tokenSymbols: vaultMapping.tokens.map(t => t.symbol),
      tokenDecimals: vaultMapping.tokens.map(t => t.decimals)
    };

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Hyperion vault data error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
