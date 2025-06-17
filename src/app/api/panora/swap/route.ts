import { NextResponse } from 'next/server';
import { PanoraSwapService } from '@/lib/services/panora/swap';

export async function POST(request: Request) {
  try {
    const params = await request.json();
    const result = await PanoraSwapService.getInstance().swap(params);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 