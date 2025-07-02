import { NextResponse } from 'next/server';

/**
 * @swagger
 * /api/protocols/echelon/vault:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get user vault data from Echelon protocol
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: User wallet address
 *     responses:
 *       200:
 *         description: Vault data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     collaterals:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           key:
 *                             type: object
 *                             properties:
 *                               inner:
 *                                 type: string
 *                           value:
 *                             type: string
 *       400:
 *         description: Invalid address
 *       500:
 *         description: Internal server error
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    // Получаем данные Vault из Aptos blockchain
    const vaultUrl = `https://mainnet.aptoslabs.com/v1/accounts/${address}/resource/0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::lending::Vault`;
    console.log('Fetching vault data from:', vaultUrl);
    
    const response = await fetch(vaultUrl);
    console.log('Vault API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vault API error response:', errorText);
      return NextResponse.json(
        {
          success: true,
          data: {
            collaterals: {
              data: []
            }
          }
        },
        { status: 200 }
      );
    }

    const vaultData = await response.json();
    console.log('Vault data:', vaultData);

    return NextResponse.json({
      success: true,
      data: vaultData
    });
  } catch (error) {
    console.error("Error fetching Echelon vault data:", error);
    return NextResponse.json(
      {
        success: true,
        data: {
          collaterals: {
            data: []
          }
        }
      },
      { status: 200 }
    );
  }
} 