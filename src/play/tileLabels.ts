import type { TileCode } from '../core';

const HONOR_LABELS: Record<string, string> = {
  E: '东',
  S: '南',
  W: '西',
  N: '北',
  C: '中',
  F: '发',
  P: '白',
};

const SUIT_LABELS: Record<string, string> = {
  m: '万',
  p: '筒',
  s: '索',
};

export function formatTileCode(code: TileCode): string {
  const honor = HONOR_LABELS[code];
  if (honor) return honor;
  const suit = code[0]!;
  const rank = code.slice(1);
  return `${rank}${SUIT_LABELS[suit] ?? suit}`;
}

export function formatTileCodes(codes: readonly TileCode[]): string {
  return codes.map(formatTileCode).join(' ');
}
