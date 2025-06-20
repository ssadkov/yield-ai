"use client";

import { useState } from 'react';
import { PositionCard } from "@/components/protocols/tapp/PositionCard";
import { InvestmentsDashboard } from "@/components/InvestmentsDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TappPositions } from '@/components/protocols/manage-positions/protocols/TappPositions';

// Моковые данные для тестирования Tapp Exchange (2 позиции)
const mockTappData = {
  data: [
    {
      positionAddr: "0x3b2fd3ec31346fdc15f4876378968e88ac30af2e33cf1dfef43a88d4bcd1e3aa",
      poolId: "0x82e0b52f95ae57b35220726a32c3415919389aa5b8baa33a058d7125797535cc",
      poolType: "STABLE",
      feeTier: "0.0100",
      tvl: "984061.65099400",
      volume24h: "1613.9300",
      shareOfPool: "0.000004877869652868134103",
      positionIdx: "93",
      apr: {
        totalAprPercentage: "46.761529",
        feeAprPercentage: "0.00598625552987423298",
        boostedAprPercentage: "46.753504",
        campaignAprs: [
          {
            aprPercentage: "46.753504",
            campaignIdx: "0",
            token: {
              addr: "0x000000000000000000000000000000000000000000000000000000000000000a",
              decimals: 8,
              img: "https://raw.githubusercontent.com/PanoraExchange/Aptos-Tokens/main/logos/APT.svg",
              symbol: "APT",
              verified: true
            }
          }
        ]
      },
      initialDeposits: [
        {
          addr: "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b",
          amount: "2.70000000000000017763568394002504646778106689453125",
          decimals: 6,
          idx: 0,
          img: "https://assets.panora.exchange/tokens/aptos/USDT.svg",
          symbol: "USDT",
          usd: "2.70000000000000017763568394002504646778106689453125",
          verified: true
        },
        {
          addr: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
          amount: "2.100000000000000088817841970012523233890533447265625",
          decimals: 6,
          idx: 1,
          img: "https://assets.panora.exchange/tokens/aptos/USDC.svg",
          symbol: "USDC",
          usd: "2.100000000000000088817841970012523233890533447265625",
          verified: true
        }
      ],
      estimatedWithdrawals: [
        {
          addr: "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b",
          amount: "2.060248636736776124517002218857",
          decimals: 6,
          idx: 0,
          img: "https://assets.panora.exchange/tokens/aptos/USDT.svg",
          symbol: "USDT",
          usd: "2.060248636736776124517002218857",
          verified: true
        },
        {
          addr: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
          amount: "2.739875827198169588253373029525",
          decimals: 6,
          idx: 1,
          img: "https://assets.panora.exchange/tokens/aptos/USDC.svg",
          symbol: "USDC",
          usd: "2.739875827198169588253373029525",
          verified: true
        }
      ],
      totalEarnings: [
        {
          addr: "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b",
          amount: "-0.63975136326322405311868172116804646778106689453125",
          decimals: 6,
          idx: 0,
          img: "https://assets.panora.exchange/tokens/aptos/USDT.svg",
          symbol: "USDT",
          usd: "-0.63975136326322405311868172116804646778106689453125",
          verified: true
        },
        {
          addr: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
          amount: "0.639875827198169499435531059512476766109466552734375",
          decimals: 6,
          idx: 1,
          img: "https://assets.panora.exchange/tokens/aptos/USDC.svg",
          symbol: "USDC",
          usd: "0.639875827198169499435531059512476766109466552734375",
          verified: true
        }
      ],
      estimatedIncentives: [
        {
          addr: "0x000000000000000000000000000000000000000000000000000000000000000a",
          amount: "0.00012743",
          decimals: 8,
          idx: -1,
          img: "https://raw.githubusercontent.com/PanoraExchange/Aptos-Tokens/main/logos/APT.svg",
          symbol: "APT",
          usd: "0.000546674700",
          verified: true
        }
      ]
    },
    {
      positionAddr: "0x0a572b549269c81cfba55532aad17eebeb9eee7ab974e3b58eaf727387151935",
      poolId: "0x82e0b52f95ae57b35220726a32c3415919389aa5b8baa33a058d7125797535cc",
      poolType: "STABLE",
      feeTier: "0.0100",
      tvl: "984061.65099400",
      volume24h: "1613.9300",
      shareOfPool: "2.03246872200799420E-7",
      positionIdx: "26",
      apr: {
        totalAprPercentage: "46.761529",
        feeAprPercentage: "0.00598625552987423298",
        boostedAprPercentage: "46.753504",
        campaignAprs: [
          {
            aprPercentage: "46.753504",
            campaignIdx: "0",
            token: {
              addr: "0x000000000000000000000000000000000000000000000000000000000000000a",
              decimals: 8,
              img: "https://raw.githubusercontent.com/PanoraExchange/Aptos-Tokens/main/logos/APT.svg",
              symbol: "APT",
              verified: true
            }
          }
        ]
      },
      initialDeposits: [
        {
          addr: "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b",
          amount: "0.1000000000000000055511151231257827021181583404541015625",
          decimals: 6,
          idx: 0,
          img: "https://assets.panora.exchange/tokens/aptos/USDT.svg",
          symbol: "USDT",
          usd: "0.1000000000000000055511151231257827021181583404541015625",
          verified: true
        },
        {
          addr: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
          amount: "0.1000000000000000055511151231257827021181583404541015625",
          decimals: 6,
          idx: 1,
          img: "https://assets.panora.exchange/tokens/aptos/USDC.svg",
          symbol: "USDC",
          usd: "0.1000000000000000055511151231257827021181583404541015625",
          verified: true
        }
      ],
      estimatedWithdrawals: [
        {
          addr: "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b",
          amount: "0.08584466604729725644349661498",
          decimals: 6,
          idx: 0,
          img: "https://assets.panora.exchange/tokens/aptos/USDT.svg",
          symbol: "USDT",
          usd: "0.08584466604729725644349661498",
          verified: true
        },
        {
          addr: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
          amount: "0.1141627865699879430883410085",
          decimals: 6,
          idx: 1,
          img: "https://assets.panora.exchange/tokens/aptos/USDC.svg",
          symbol: "USDC",
          usd: "0.1141627865699879430883410085",
          verified: true
        }
      ],
      totalEarnings: [
        {
          addr: "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b",
          amount: "-0.0141553339527027491076185081457827021181583404541015625",
          decimals: 6,
          idx: 0,
          img: "https://assets.panora.exchange/tokens/aptos/USDT.svg",
          symbol: "USDT",
          usd: "-0.0141553339527027491076185081457827021181583404541015625",
          verified: true
        },
        {
          addr: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
          amount: "0.0141627865699879375372258853742172978818416595458984375",
          decimals: 6,
          idx: 1,
          img: "https://assets.panora.exchange/tokens/aptos/USDC.svg",
          symbol: "USDC",
          usd: "0.0141627865699879375372258853742172978818416595458984375",
          verified: true
        }
      ],
      estimatedIncentives: [
        {
          addr: "0x000000000000000000000000000000000000000000000000000000000000000a",
          amount: "0.00015072",
          decimals: 8,
          idx: -1,
          img: "https://raw.githubusercontent.com/PanoraExchange/Aptos-Tokens/main/logos/APT.svg",
          symbol: "APT",
          usd: "0.000646588800",
          verified: true
        }
      ]
    }
  ]
};

export default function TappTestPage() {
  const [showManagePositions, setShowManagePositions] = useState(false);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Tapp Exchange Test Page</h1>
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Test Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button 
                onClick={() => setShowManagePositions(!showManagePositions)}
                variant="outline"
              >
                {showManagePositions ? 'Hide' : 'Show'} Manage Positions
              </Button>
            </div>
          </CardContent>
        </Card>

        {showManagePositions && (
          <Card>
            <CardHeader>
              <CardTitle>Tapp Manage Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <TappPositions />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 