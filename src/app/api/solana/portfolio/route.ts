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
    const portfolioService = SolanaPortfolioService.getInstance();
    const portfolio = await portfolioService.getPortfolio(address);
    return NextResponse.json(portfolio);
  } catch (error) {
    console.error("Failed to load Solana portfolio:", error);
    return NextResponse.json(
      { error: "Failed to load Solana portfolio" },
      { status: 500 },
    );
  }
}

