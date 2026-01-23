import { NextRequest, NextResponse } from "next/server";
import { SolanaPortfolioService } from "@/lib/services/solana/portfolio";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Missing address parameter" },
      { status: 400 },
    );
  }

  try {
    console.log(`[API /api/solana/portfolio] 📡 Request received for address: ${address}`);
    const portfolioService = SolanaPortfolioService.getInstance();
    const portfolio = await portfolioService.getPortfolio(address);
    
    console.log(`[API /api/solana/portfolio] ✅ Portfolio fetched successfully:`, {
      tokensCount: portfolio.tokens.length,
      totalValueUsd: portfolio.totalValueUsd,
      tokens: portfolio.tokens.map(t => ({
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        price: t.price,
        value: t.value,
        hasLogoUrl: !!t.logoUrl,
        logoUrl: t.logoUrl,
      })),
    });
    
    return NextResponse.json(portfolio);
  } catch (error: any) {
    console.error("Failed to load Solana portfolio:", error);
    console.error("Error details:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    
    // Return more detailed error information
    const errorMessage = error?.message || "Failed to load Solana portfolio";
    return NextResponse.json(
      { 
        error: errorMessage,
        tokens: [], // Return empty tokens array instead of failing completely
        totalValueUsd: 0,
      },
      { status: 500 },
    );
  }
}

