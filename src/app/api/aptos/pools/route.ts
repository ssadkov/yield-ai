import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const response = await fetch('https://yield-a.vercel.app/api/aptos/markets')
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching pools:', error)
    return NextResponse.json({ error: 'Failed to fetch pools' }, { status: 500 })
  }
} 