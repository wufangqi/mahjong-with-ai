import { FULL_SET_SIZE, PLAYER_SEAT, totalTileCount } from '../core';
import { PlaySession } from '../game/session';
import { TableView } from './tableView';

function mustEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

const DEFAULT_SEED = 42;

export function bootPlayApp(): void {
  const canvas = mustEl<HTMLCanvasElement>('c');
  const seedInput = mustEl<HTMLInputElement>('seed');
  const statusEl = mustEl<HTMLElement>('status');
  const metaEl = mustEl<HTMLElement>('meta');
  const startBtn = mustEl<HTMLButtonElement>('start');

  seedInput.value = String(DEFAULT_SEED);

  const session = new PlaySession();
  const table = new TableView(canvas);

  const refresh = (): void => {
    const snap = session.snapshot();
    table.sync(snap.state, snap.selectedTileId);

    if (!snap.state) {
      statusEl.textContent = '输入种子并开始一局';
      metaEl.textContent = '';
      return;
    }

    const dealerLabel = snap.state.dealer === PLAYER_SEAT ? '玩家' : `座位 ${snap.state.dealer}`;
    metaEl.textContent = [
      `种子 ${snap.seed}`,
      `庄家 ${dealerLabel}`,
      `牌墙 ${snap.state.wall.length}`,
      `实体牌 ${totalTileCount(snap.state)}/${FULL_SET_SIZE}`,
    ].join(' · ');

    if (snap.status === 'awaiting_player_discard') {
      statusEl.textContent = snap.selectedTileId
        ? '再次点击同一张牌确认出牌，或拖入牌河'
        : '轮到你出牌：点击选牌';
    } else if (snap.status === 'complete') {
      statusEl.textContent = '出牌已确认（不可撤销）';
    } else {
      statusEl.textContent = '准备中…';
    }
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

  let pointerDownAt: { x: number; y: number; tileId: string } | null = null;
  let dragging = false;

  canvas.addEventListener('pointerdown', (e) => {
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
  };

  document.body.classList.add('ready');
  session.start(DEFAULT_SEED);
}
