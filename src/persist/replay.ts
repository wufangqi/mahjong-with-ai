import { applyCommand, ensureDrawn, type Command, type DomainEvent, type HandState } from '../core';

export interface ReplayResult {
  state: HandState;
  events: DomainEvent[];
}

function needsDrawBefore(command: Command): boolean {
  return (
    command.type === 'Discard' ||
    command.type === 'DeclareWin' ||
    command.type === 'DeclareConcealedKong' ||
    command.type === 'DeclareAddedKong'
  );
}

/**
 * Developer replay: re-apply recorded final legal commands.
 * Never invokes a DecisionProvider / external AI (ADR-0005 / ADR-0007).
 */
export function replayCommands(commands: readonly Command[]): ReplayResult {
  if (commands.length === 0) {
    throw new Error('action log is empty');
  }

  let state: HandState | null = null;
  const events: DomainEvent[] = [];

  for (const command of commands) {
    if (command.type === 'StartHand') {
      const result = applyCommand(null, command);
      state = result.state;
      events.push(...result.events);
      continue;
    }

    if (!state) {
      throw new Error('StartHand is required before other commands');
    }

    if (state.phase === 'awaiting_discard' && needsDrawBefore(command)) {
      const drawn = ensureDrawn(state);
      state = drawn.state;
      events.push(...drawn.events);
    }

    const result = applyCommand(state, command);
    state = result.state;
    events.push(...result.events);
  }

  if (!state) {
    throw new Error('replay produced no state');
  }

  return { state, events };
}
