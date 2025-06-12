import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // TODO: Implement Panora token prices logic
    return NextResponse.json({ message: 'Panora token prices endpoint' });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 