import type { ProtocolPosition } from '@/shared/ProtocolCard/types';
import { PositionBadge } from '@/shared/ProtocolCard/types';
import type { MoarPosition } from '@/lib/query/hooks/protocols/moar';
import { formatNumber } from '@/lib/utils/numberFormat';

function trimTrailingZeros(value: string): string {
  if (!value.includes('.')) return value;
  const trimmed = value.replace(/\.?0+$/, '');
  return trimmed === '' ? '0' : trimmed;
}

/**
 * Maps a single Moar Market position to shared ProtocolPosition.
 * Optionally accepts APR (in percent, e.g. 8.4) to show on the badge.
 */
export function mapMoarPositionToProtocolPosition(
  position: MoarPosition,
  apr?: number
): ProtocolPosition {
  const value = parseFloat(position.value || '0');
  const amount =
    parseFloat(position.balance || '0') /
    Math.pow(10, position.assetInfo?.decimals ?? 8);
  const price = amount > 0 ? value / amount : undefined;
  const symbol = position.assetInfo?.symbol ?? position.assetName ?? '';
  const formattedAmount = trimTrailingZeros(formatNumber(amount, 4));

  return {
    id: `moar-${position.poolId}-${position.assetName}`,
    label: symbol || '—',
    value,
    logoUrl: position.assetInfo?.logoUrl ?? undefined,
    badge: PositionBadge.Supply,
    subLabel: formattedAmount,
    price,
    apr: apr != null ? apr.toFixed(2) : undefined,
  };
}

/**
 * Maps all Moar positions to ProtocolCard format.
 * aprByPoolId: poolId -> APR (percent), optional.
 */
export function mapMoarPositionsToProtocolPositions(
  positions: MoarPosition[],
  aprByPoolId?: Record<number, number>
): ProtocolPosition[] {
  return positions
    .map((position) =>
      mapMoarPositionToProtocolPosition(
        position,
        aprByPoolId ? aprByPoolId[position.poolId] : undefined
      )
    )
    .sort((a, b) => b.value - a.value);
}
