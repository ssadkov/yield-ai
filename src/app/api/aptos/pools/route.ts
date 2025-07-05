import { NextResponse } from 'next/server'
import { poolsService } from '@/lib/services/pools/poolsService'

export async function GET() {
  try {
    const pools = await poolsService.getAllPools()
    
    return NextResponse.json({
      data: pools,
      protocols: pools.reduce((acc, pool) => {
        acc[pool.protocol] = (acc[pool.protocol] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    })
  } catch (error) {
    console.error('Error fetching pools:', error)
    return NextResponse.json({ error: 'Failed to fetch pools' }, { status: 500 })
  }
} 