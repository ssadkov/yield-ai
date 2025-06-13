"use client";

import { PositionsList } from "@/components/protocols/joule/PositionsList";

// Моковые данные для тестирования
const mockData = {
  userPositions: [
    {
      positions_map: {
        data: [
          {
            key: "1",
            value: {
              borrow_positions: {
                data: [
                  {
                    key: "0x1::aptos_coin::AptosCoin",
                    value: {
                      borrow_amount: "117454059271",
                      coin_name: "0x1::aptos_coin::AptosCoin",
                      interest_accumulated: "214059271"
                    }
                  }
                ]
              },
              lend_positions: {
                data: [
                  {
                    key: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::StakedApt",
                    value: "119881806639"
                  }
                ]
              },
              position_name: "Loop-Position"
            }
          },
          {
            key: "2",
            value: {
              borrow_positions: {
                data: [
                  {
                    key: "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WBTC",
                    value: {
                      borrow_amount: "31",
                      coin_name: "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WBTC",
                      interest_accumulated: "1"
                    }
                  }
                ]
              },
              lend_positions: {
                data: [
                  {
                    key: "@bae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
                    value: "11007044"
                  },
                  {
                    key: "0x1::aptos_coin::AptosCoin",
                    value: "50000507"
                  }
                ]
              },
              position_name: "Position-2"
            }
          }
        ]
      },
      user_position_ids: ["1", "2"]
    }
  ]
};

export default function TestJoulePage() {
  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Joule Finance Test Page</h1>
      <div className="space-y-4">
        <PositionsList 
          address="0x56ff2fc971deecd286314fe99b8ffd6a5e72e62eacdc46ae9b234c5282985f97"
          onPositionsValueChange={(value) => console.log('Total value:', value)}
          mockData={mockData}
        />
      </div>
    </div>
  );
} 