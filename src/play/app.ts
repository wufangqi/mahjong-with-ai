import { FULL_SET_SIZE, PLAYER_SEAT, totalTileCount, type Seat } from '../core';
import { PlaySession } from '../game/session';
import { TableView } from './tableView';
import { formatTileCodes } from './tileLabels';

function mustEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

const DEFAULT_SEED = 42;
const SEAT_NAMES: Record<Seat, string> = {
  0: '玩家',
  1: '下家',
  2: '对家',
  3: '上家',
};

export function bootPlayApp(): void {
  const canvas = mustEl<HTMLCanvasElement>('c');
  const seedInput = mustEl<HTMLInputElement>('seed');
  const statusEl = mustEl<HTMLElement>('status');
  const metaEl = mustEl<HTMLElement>('meta');
  const startBtn = mustEl<HTMLButtonElement>('start');
  const responseBar = mustEl<HTMLElement>('response-bar');
  const claimWinBtn = mustEl<HTMLButtonElement>('claim-win');
  const passWinBtn = mustEl<HTMLButtonElement>('pass-win');
  const drawPanel = mustEl<HTMLElement>('draw-panel');
  const drawSeats = mustEl<HTMLElement>('draw-seats');
  const nextHandBtn = mustEl<HTMLButtonElement>('next-hand');

  seedInput.value = String(DEFAULT_SEED);

  const session = new PlaySession();
  const table = new TableView(canvas);

  const renderDrawPanel = (): void => {
    const snap = session.snapshot();
    if (snap.status !== 'exhaustive_draw' || !snap.settlement) {
      drawPanel.hidden = true;
      drawSeats.replaceChildren();
      return;
    }

    drawPanel.hidden = false;
    drawSeats.replaceChildren();
    for (const info of snap.settlement.seats) {
      const row = document.createElement('div');
      row.className = 'draw-seat';
      row.dataset.seat = String(info.seat);

      const head = document.createElement('div');
      head.className = 'draw-seat-head';
      const name = document.createElement('span');
      const dealerMark = snap.state?.dealer === info.seat ? ' · 庄' : '';
      name.textContent = `${SEAT_NAMES[info.seat]}${dealerMark}`;
      const ready = document.createElement('span');
      ready.className = info.ready ? 'ready' : 'not-ready';
      ready.textContent = info.ready ? '听牌' : '未听';
      head.append(name, ready);

      const hand = document.createElement('div');
      hand.className = 'draw-hand';
      hand.textContent = `手牌 ${formatTileCodes(info.hand.map((t) => t.code))}`;

      const waiting = document.createElement('div');
      waiting.className = 'draw-waiting';
      waiting.textContent = info.ready
        ? `可胡 ${formatTileCodes(info.waitingTiles)}`
        : '可胡 —';

      row.append(head, hand, waiting);
      drawSeats.append(row);
    }
  };

  const refresh = (): void => {
    const snap = session.snapshot();
    table.sync(snap.state, snap.selectedTileId);

    if (!snap.state) {
      statusEl.textContent = '输入种子并开始一局';
      metaEl.textContent = '';
      responseBar.hidden = true;
      drawPanel.hidden = true;
      return;
    }

    const dealerLabel = snap.state.dealer === PLAYER_SEAT ? '玩家' : `座位 ${snap.state.dealer}`;
    metaEl.textContent = [
      `种子 ${snap.seed}`,
      `庄家 ${dealerLabel}`,
      `牌墙 ${snap.state.wall.length}`,
      `实体牌 ${totalTileCount(snap.state)}/${FULL_SET_SIZE}`,
    ].join(' · ');

    responseBar.hidden = snap.status !== 'awaiting_player_win_response';
    claimWinBtn.hidden = !snap.playerCanWin;

    if (snap.status === 'awaiting_player_discard') {
      statusEl.textContent = snap.selectedTileId
        ? '再次点击同一张牌确认出牌，或拖入牌河'
        : '轮到你出牌：点击选牌';
    } else if (snap.status === 'awaiting_player_win_response') {
      statusEl.textContent = snap.playerCanWin ? '最后一巡：可胡或过' : '最后一巡：请选择过';
    } else if (snap.status === 'exhaustive_draw') {
      statusEl.textContent = '流局 · 不计番 · 庄家不变';
    } else if (snap.status === 'hand_won') {
      statusEl.textContent = '有人胡牌（本切片以流局演示为主）';
    } else {
      statusEl.textContent = '准备中…';
    }

    renderDrawPanel();
  };

  session.subscribe(refresh);

  startBtn.addEventListener('click', () => {
    const seed = Number.parseInt(seedInput.value, 10);
    if (!Number.isFinite(seed)) {
      statusEl.textContent = '请输入有效数字种子';
      return;
    }
    session.start(seed);
  });

  claimWinBtn.addEventListener('click', () => session.claimWin());
  passWinBtn.addEventListener('click', () => session.passWin());
  nextHandBtn.addEventListener('click', () => {
    const nextSeed = (session.snapshot().seed ?? DEFAULT_SEED) + 1;
    seedInput.value = String(nextSeed);
    session.startNextHand(nextSeed);
  });

  let pointerDownAt: { x: number; y: number; tileId: string } | null = null;
  let dragging = false;

  canvas.addEventListener('pointerdown', (e) => {
    if (session.snapshot().status !== 'awaiting_player_discard') return;
    const tileId = table.pickPlayerTile(e.clientX, e.clientY);
    if (!tileId) return;
    pointerDownAt = { x: e.clientX, y: e.clientY, tileId };
    dragging = false;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointerDownAt) return;
    const dx = e.clientX - pointerDownAt.x;
    const dy = e.clientY - pointerDownAt.y;
    if (!dragging && dx * dx + dy * dy > 36) {
      dragging = true;
      table.beginDrag(pointerDownAt.tileId);
      session.selectTile(pointerDownAt.tileId);
    }
    if (dragging) table.moveDrag(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!pointerDownAt) return;
    if (dragging) {
      const result = table.endDrag(e.clientX, e.clientY);
      if (result?.intoRiver) session.discardByDrag(result.tileId);
      else refresh();
    } else {
      session.clickTile(pointerDownAt.tileId);
    }
    pointerDownAt = null;
    dragging = false;
  });

  canvas.addEventListener('pointercancel', () => {
    pointerDownAt = null;
    dragging = false;
    refresh();
  });

  const frame = (): void => {
    requestAnimationFrame(frame);
    table.render();
  };
  frame();

  window.__play = {
    ready: true,
    start: (seed: number) => session.start(seed),
    snapshot: () => session.snapshot(),
    clickTile: (tileId: string) => session.clickTile(tileId),
    discardByDrag: (tileId: string) => session.discardByDrag(tileId),
    autoPlayToDraw: () => session.autoPlayPlayerFirstLegal(),
    claimWin: () => session.claimWin(),
    passWin: () => session.passWin(),
    startNextHand: (seed: number) => session.startNextHand(seed),
  };

  document.body.classList.add('ready');
  session.start(DEFAULT_SEED);
}
