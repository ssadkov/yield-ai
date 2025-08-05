import { NextRequest, NextResponse } from 'next/server';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

// Auro Finance contract address (mainnet)
const AURO_ADDRESS = "0x50a340a19e6ada1be07192c042786ca6a9651d5c845acc8727e8c6416a56a32c";

const APTOS_API_KEY = process.env.APTOS_API_KEY;

// Initialize Aptos client with API key
const config = new AptosConfig({
  network: Network.MAINNET,
  ...(APTOS_API_KEY && {
    fullnode: `https://fullnode.mainnet.aptoslabs.com/v1`,
    headers: {
      'Authorization': `Bearer ${APTOS_API_KEY}`,
    },
  }),
});
const aptos = new Aptos(config);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ 
      success: false, 
      error: 'Address parameter is required' 
    }, { status: 400 });
  }

  if (!APTOS_API_KEY) {
    return NextResponse.json({ 
      success: false, 
      error: 'APTOS_API_KEY is not configured' 
    }, { status: 500 });
  }

  try {
    console.log('=== Auro Rewards GET API Route Started ===');
    console.log('Address:', address);

    // Fetch positions for the address
    const positionsResponse = await fetch(`${request.nextUrl.origin}/api/protocols/auro/userPositions?address=${encodeURIComponent(address)}`);
    const positionsData = await positionsResponse.json();
    
    if (!positionsResponse.ok || !positionsData.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch positions' 
      }, { status: 500 });
    }

    // Fetch pools data
    const poolsResponse = await fetch(`${request.nextUrl.origin}/api/protocols/auro/pools`);
    const poolsData = await poolsResponse.json();
    
    if (!poolsResponse.ok || !poolsData.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch pools' 
      }, { status: 500 });
    }

    const positionsInfo = positionsData.positionInfo || [];
    const pools = poolsData.data || [];

    if (positionsInfo.length === 0) {
      return NextResponse.json({
        success: true,
        data: {},
        message: 'No positions found for this address'
      });
    }

    // Format positions info
    const formattedPositionsInfo = positionsInfo.map((pos: any) => ({
      address: pos.address,
      poolAddress: pos.poolAddress,
      debtAmount: pos.debtAmount
    }));

    // Format pools data
    const formattedPoolsData = pools.map((pool: any) => ({
      type: pool.type,
      poolAddress: pool.poolAddress,
      rewardPoolAddress: pool.rewardPoolAddress,
      borrowRewardsPoolAddress: pool.borrowRewardsPoolAddress
    }));

    // Now call the same logic as POST
    const body = {
      positionsInfo: formattedPositionsInfo,
      poolsData: formattedPoolsData
    };

    // Call the POST logic
    return await POST(new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }));

  } catch (error) {
    console.error('=== Auro Rewards GET API Route Error ===');
    console.error('Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch rewards data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== Auro Rewards API Route Started ===');
    console.log('🔑 APTOS_API_KEY exists:', !!APTOS_API_KEY);
    
    // Получаем данные из запроса
    const body = await request.json();
    const { positionsInfo, poolsData } = body;

    if (!positionsInfo || !Array.isArray(positionsInfo) || positionsInfo.length === 0) {
      return NextResponse.json({ success: false, error: 'positionsInfo is required' }, { status: 400 });
    }
    if (!poolsData || !Array.isArray(poolsData) || poolsData.length === 0) {
      return NextResponse.json({ success: false, error: 'poolsData is required' }, { status: 400 });
    }

    // Формируем пары (позиция, collateral reward pool) и (позиция, borrow reward pool)
    const pairs: Array<{ position: string, pool: string }> = [];
    // console.log('=== Начинаем формирование пар ===');
    // console.log('Количество позиций:', positionsInfo.length);
    // console.log('Количество пулов:', poolsData.length);
    
    for (const pos of positionsInfo) {
      console.log('Обрабатываем позицию:', {
        address: pos.address,
        poolAddress: pos.poolAddress,
        debtAmount: pos.debtAmount,
        hasDebt: pos.debtAmount && parseFloat(pos.debtAmount) > 0
      });
      
      if (!pos.address || !pos.poolAddress) {
        console.log('Пропускаем позицию - нет address или poolAddress');
        continue;
      }
      
      // Находим collateral pool
      const collateralPool = poolsData.find(p => p.poolAddress === pos.poolAddress);
      console.log('Найденный collateral pool:', collateralPool ? {
        type: collateralPool.type,
        poolAddress: collateralPool.poolAddress,
        rewardPoolAddress: collateralPool.rewardPoolAddress
      } : 'НЕ НАЙДЕН');
      
      if (collateralPool && collateralPool.rewardPoolAddress) {
        pairs.push({ position: pos.address, pool: collateralPool.rewardPoolAddress });
        console.log('Добавлена collateral пара:', { position: pos.address, pool: collateralPool.rewardPoolAddress });
      }
      
      // Проверяем, есть ли долг у позиции
      const hasDebt = pos.debtAmount && parseFloat(pos.debtAmount) > 0;
      console.log('Проверка долга:', { debtAmount: pos.debtAmount, hasDebt });
      
      if (hasDebt) {
        // Ищем borrow pool (пул типа BORROW) - он один для всех позиций
        const borrowPool = poolsData.find(p => p.type === 'BORROW');
        console.log('Найденный borrow pool:', borrowPool ? {
          type: borrowPool.type,
          poolAddress: borrowPool.poolAddress,
          borrowRewardsPoolAddress: borrowPool.borrowRewardsPoolAddress
        } : 'НЕ НАЙДЕН');
        
        if (borrowPool && borrowPool.borrowRewardsPoolAddress) {
          pairs.push({ position: pos.address, pool: borrowPool.borrowRewardsPoolAddress });
          console.log('Добавлена borrow пара:', { position: pos.address, pool: borrowPool.borrowRewardsPoolAddress });
        } else {
          console.log('Borrow пара НЕ добавлена - нет borrowPool или borrowRewardsPoolAddress');
        }
      } else {
        console.log('Долга нет - borrow пара не нужна');
      }
    }
    
    // console.log('=== Итоговые пары ===');
    // console.log('Всего пар:', pairs.length);
    // console.log('Пары:', pairs);

    if (pairs.length === 0) {
      return NextResponse.json({ success: true, data: [], message: 'No valid pairs found' });
    }
    // console.log('Пары для одиночных вызовов:', pairs);

    // Для каждой пары делаем отдельный вызов claimable_rewards
    const rewardsData: any[] = [];
    const positionRewardsMap: { [positionAddress: string]: { collateral: any[], borrow: any[] } } = {};
    
    // Инициализируем map для всех позиций
    for (const pos of positionsInfo) {
      if (pos.address) {
        positionRewardsMap[pos.address] = { collateral: [], borrow: [] };
      }
    }
    
    for (const { position, pool } of pairs) {
      try {
        console.log('Вызов claimable_rewards:', { position, pool });
        const single = await aptos.view({
          payload: {
            function: `${AURO_ADDRESS}::rewards_pool::claimable_rewards`,
            typeArguments: [],
            functionArguments: [position, pool]
          }
        });
        console.log('Ответ claimable_rewards:', single);
        if (single && Array.isArray(single) && single.length > 0) {
          const s0 = single[0];
          let result;
          if (s0 && typeof s0 === 'object' && 'data' in s0 && Array.isArray(s0.data) && s0.data.length > 0) {
            result = s0.data[0];
          } else {
            result = s0;
          }
          rewardsData.push(result);
          
          // Определяем тип награды (collateral или borrow) и добавляем в соответствующую категорию
          const positionData = positionRewardsMap[position];
          if (positionData) {
            // Проверяем, является ли это borrow pool
            const isBorrowPool = poolsData.find(p => p.borrowRewardsPoolAddress === pool);
            if (isBorrowPool) {
              positionData.borrow.push(result);
            } else {
              positionData.collateral.push(result);
            }
          }
        } else {
          rewardsData.push({ key: '', value: '0' });
        }
      } catch (e) {
        console.error('Single reward error:', e);
        rewardsData.push({ key: '', value: '0' });
      }
    }

    // Приводим к единому виду и группируем по позициям
    const processedPositionRewards: { [positionAddress: string]: { collateral: any[], borrow: any[] } } = {};
    
    for (const [positionAddress, rewards] of Object.entries(positionRewardsMap)) {
      processedPositionRewards[positionAddress] = {
        collateral: rewards.collateral
          .map((reward: any) => {
            if (!reward || typeof reward !== 'object') return null;
            return {
              key: reward.key || reward.token || '',
              value: reward.value || reward.amount || '0',
            };
          })
          .filter(Boolean),
        borrow: rewards.borrow
          .map((reward: any) => {
            if (!reward || typeof reward !== 'object') return null;
            return {
              key: reward.key || reward.token || '',
              value: reward.value || reward.amount || '0',
            };
          })
          .filter(Boolean)
      };
    }

    const result = {
      success: true,
      data: processedPositionRewards,
      message: "Rewards data retrieved successfully",
      debug: {
        pairs
      }
    };

    console.log('=== Auro Rewards API Route Completed ===');
    return NextResponse.json(result);

  } catch (error) {
    console.error('=== Auro Rewards API Route Error ===');
    console.error('Error fetching rewards:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch rewards data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 