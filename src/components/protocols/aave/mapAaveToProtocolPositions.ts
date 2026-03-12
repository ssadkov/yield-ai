import type { ProtocolPosition } from '@/shared/ProtocolCard/types';
import { PositionBadge } from '@/shared/ProtocolCard/types';
import type { AavePosition } from '@/lib/query/hooks/protocols/aave';
import tokenList from '@/lib/data/tokenList.json';
import { formatNumber } from '@/lib/utils/numberFormat';

function trimTrailingZeros(value: string): string {
  if (!value.includes('.')) return value;
  const trimmed = value.replace(/\.?0+$/, '');
  return trimmed === '' ? '0' : trimmed;
}

function normalizeAptosAddress(addr: string): string {
  if (!addr) return addr;
  let a = addr;
  if (a.startsWith('@')) a = a.slice(1);
  if (!a.startsWith('0x')) a = `0x${a}`;
  const body = a.slice(2).toLowerCase().replace(/^0+/, '');
  return `0x${body === '' ? '0' : body}`;
}

function getTokenLogoUrl(coinAddress: string): string | undefined {
  const normalized = normalizeAptosAddress(coinAddress);
  const token = tokenList.data.data.find((t) => {
    const fa = t.faAddress ? normalizeAptosAddress(t.faAddress) : '';
    const ta = t.tokenAddress ? normalizeAptosAddress(t.tokenAddress) : '';
    return fa === normalized || ta === normalized;
  });
  return token?.logoUrl || undefined;
}

function toSinglePositions(position: AavePosition): ProtocolPosition[] {
  const out: ProtocolPosition[] = [];

  if (position.deposit_amount > 0) {
    const value = Number(position.deposit_value_usd || 0);
    const amount = Number(position.deposit_amount || 0);
    const price = amount > 0 ? value / amount : undefined;
    out.push({
      id: `aave-${position.underlying_asset}-supply`,
      label: position.symbol || '—',
      value,
      logoUrl: getTokenLogoUrl(position.underlying_asset),
      badge: PositionBadge.Supply,
      subLabel: trimTrailingZeros(formatNumber(amount, 4)),
      price,
      isCollateral: Boolean(position.usage_as_collateral_enabled),
    });
  }

  if (position.borrow_amount > 0) {
    const value = Number(position.borrow_value_usd || 0);
    const amount = Number(position.borrow_amount || 0);
    const price = amount > 0 ? value / amount : undefined;
    out.push({
      id: `aave-${position.underlying_asset}-borrow`,
      label: position.symbol || '—',
      value,
      logoUrl: getTokenLogoUrl(position.underlying_asset),
      badge: PositionBadge.Borrow,
      subLabel: trimTrailingZeros(formatNumber(amount, 4)),
      price,
    });
  }

  return out;
}

export function mapAavePositionsToProtocolPositions(
  positions: AavePosition[]
): ProtocolPosition[] {
  return positions.flatMap(toSinglePositions).sort((a, b) => b.value - a.value);
}

