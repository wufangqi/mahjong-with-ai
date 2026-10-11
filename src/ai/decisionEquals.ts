import type { DecisionAction } from './types';

/** Exact legal-list match for a DecisionProvider result. */
export function decisionEquals(a: DecisionAction, b: DecisionAction): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'Discard':
      return b.type === 'Discard' && a.tileId === b.tileId;
    case 'DeclareConcealedKong':
    case 'DeclareAddedKong':
      return (
        (b.type === 'DeclareConcealedKong' || b.type === 'DeclareAddedKong') &&
        b.type === a.type &&
        a.code === b.code
      );
    case 'ClaimChow':
      return (
        b.type === 'ClaimChow' && a.tileIds[0] === b.tileIds[0] && a.tileIds[1] === b.tileIds[1]
      );
    default:
      return true;
  }
}
