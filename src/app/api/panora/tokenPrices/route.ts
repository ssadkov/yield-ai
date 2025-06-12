import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // TODO: Implement Panora token prices logic
    return NextResponse.json({ message: 'Panora token prices endpoint' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 