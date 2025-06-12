import { NextResponse } from 'next/server';
import { panoraOpenApi } from '@/lib/swagger/panora';

export async function GET() {
  return NextResponse.json(panoraOpenApi);
} 