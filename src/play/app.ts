import { FULL_SET_SIZE, PLAYER_SEAT, totalTileCount, type Seat } from '../core';
import { PlaySession } from '../game/session';
import { listThemeOptions, loadTheme } from '../theme/catalog';
import { ThemeManager } from '../theme/themeManager';
import { isThemeId } from '../theme/schema';
import type { ThemeId } from '../theme/types';
import { TableView } from './tableView';
import { formatTileCodes } from './tileLabels';
import { patternLabels, WinSceneScheduler, type WinScenePlan } from './winPresentation';

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

function browserStorage(): Storage {
  try {
    return window.localStorage;
  } catch {
    const map = new Map<string, string>();
    return {
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        map.set(k, v);
      },
      removeItem: (k) => {
        map.delete(k);
      },
      key: () => null,
    };
  }
}

export function bootPlayApp(): void {
  const canvas = mustEl<HTMLCanvasElement>('c');
  const seedInput = mustEl<HTMLInputElement>('seed');
  const statusEl = mustEl<HTMLElement>('status');
  const metaEl = mustEl<HTMLElement>('meta');
  const startBtn = mustEl<HTMLButtonElement>('start');
  const themeSelect = mustEl<HTMLSelectElement>('theme-select');
  const themeNotice = mustEl<HTMLElement>('theme-notice');
  const responseBar = mustEl<HTMLElement>('response-bar');
  const claimWinBtn = mustEl<HTMLButtonElement>('claim-win');
  const claimKongBtn = mustEl<HTMLButtonElement>('claim-kong');
  const claimPungBtn = mustEl<HTMLButtonElement>('claim-pung');
  const chowOptionsEl = mustEl<HTMLElement>('chow-options');
  const passBtn = mustEl<HTMLButtonElement>('pass-win');
  const selfBar = mustEl<HTMLElement>('self-bar');
  const declareWinBtn = mustEl<HTMLButtonElement>('declare-win');
  const kongOptionsEl = mustEl<HTMLElement>('kong-options');
  const drawPanel = mustEl<HTMLElement>('draw-panel');
  const drawSeats = mustEl<HTMLElement>('draw-seats');
  const nextHandBtn = mustEl<HTMLButtonElement>('next-hand');
  const winPanel = mustEl<HTMLElement>('win-panel');
  const winSummary = mustEl<HTMLElement>('win-summary');
  const winNextHandBtn = mustEl<HTMLButtonElement>('win-next-hand');
  const replaySceneBtn = mustEl<HTMLButtonElement>('replay-scene');
  const banner = mustEl<HTMLElement>('banner');
  const bannerMain = mustEl<HTMLElement>('banner-main');
  const bannerSub = mustEl<HTMLElement>('banner-sub');

  seedInput.value = String(DEFAULT_SEED);

  const session = new PlaySession();
  const table = new TableView(canvas);
  const scenes = new WinSceneScheduler();
  const themes = new ThemeManager({
    storage: browserStorage(),
    now: () => performance.now(),
    schedule: (fn, ms) => {
      window.setTimeout(fn, ms);
    },
    loadTheme,
  });
  let lastHandWonEventCount = 0;
  let sceneReleaseTimer: number | null = null;

  themeSelect.replaceChildren();
  for (const opt of listThemeOptions()) {
    const el = document.createElement('option');
    el.value = opt.id;
    el.textContent = opt.displayName;
    themeSelect.append(el);
  }

  const showThemeNotices = (notices: string[]): void => {
    if (notices.length === 0) {
      themeNotice.hidden = true;
      themeNotice.textContent = '';
      return;
    }
    themeNotice.hidden = false;
    themeNotice.textContent = notices.join(' · ');
    window.setTimeout(() => {
      themeNotice.hidden = true;
    }, 4200);
  };

  const syncThemeChrome = (): void => {
    const id = themes.getActiveId();
    themeSelect.value = id;
    document.body.dataset.theme = id;
    const palette = themes.getScenePalette() ?? themes.getApplied().palette;
    document.documentElement.style.setProperty('--banner-basic', palette.bannerBasic);
  };

  const applyActiveTheme = (opts?: { from?: ReturnType<ThemeManager['getApplied']>; transitionMs?: number }): void => {
    table.applyTheme(themes.getApplied(), opts);
    syncThemeChrome();
  };

  const showScene = (plans: WinScenePlan[]): void => {
    const plan = plans[0];
    if (!plan) return;
    const palette = themes.captureScenePalette();
    document.documentElement.style.setProperty('--banner-basic', palette.bannerBasic);
    bannerMain.textContent = plan.bannerMain;
    bannerSub.textContent = plan.bannerSub;
    banner.className = `show ${plan.tier}`;
    banner.style.setProperty('--delay', '0s');
    if (sceneReleaseTimer !== null) window.clearTimeout(sceneReleaseTimer);
    sceneReleaseTimer = window.setTimeout(() => {
      themes.releaseScenePalette();
      syncThemeChrome();
      if (banner.classList.contains('show')) banner.className = '';
      sceneReleaseTimer = null;
    }, 2400);
  };

  scenes.onPlay(showScene);

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

  const renderChowOptions = (): void => {
    const snap = session.snapshot();
    chowOptionsEl.replaceChildren();
    if (snap.status !== 'awaiting_player_claim_response') return;
    for (const option of snap.playerChowOptions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.testid = 'claim-chow';
      btn.textContent = `吃 ${formatTileCodes(option.codes)}`;
      btn.addEventListener('click', () => session.claimChow(option.tileIds));
      chowOptionsEl.append(btn);
    }
  };

  const renderKongOptions = (): void => {
    const snap = session.snapshot();
    kongOptionsEl.replaceChildren();
    if (snap.status !== 'awaiting_player_discard') return;
    for (const code of snap.playerConcealedKongCodes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.testid = 'declare-concealed-kong';
      btn.textContent = `暗杠 ${formatTileCodes([code])}`;
      btn.addEventListener('click', () => session.declareConcealedKong(code));
      kongOptionsEl.append(btn);
    }
    for (const code of snap.playerAddedKongCodes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.testid = 'declare-added-kong';
      btn.textContent = `加杠 ${formatTileCodes([code])}`;
      btn.addEventListener('click', () => session.declareAddedKong(code));
      kongOptionsEl.append(btn);
    }
  };

  const renderWinPanel = (): void => {
    const snap = session.snapshot();
    if (snap.status !== 'hand_won' || !snap.winSettlement) {
      winPanel.hidden = true;
      winSummary.replaceChildren();
      return;
    }

    winPanel.hidden = false;
    winSummary.replaceChildren();
    for (const winner of snap.winSettlement.winners) {
      const row = document.createElement('div');
      row.className = 'win-seat';
      row.dataset.seat = String(winner.seat);
      const labels = patternLabels(winner.patterns).join('、');
      row.innerHTML = [
        `<div class="win-seat-head"><span>${SEAT_NAMES[winner.seat]}</span><span class="win-fan">${winner.fan} 番</span></div>`,
        `<div class="win-patterns">${labels}</div>`,
        `<div class="win-hand">手牌 ${formatTileCodes(winner.hand.map((t) => t.code))}</div>`,
      ].join('');
      winSummary.append(row);
    }
  };

  const maybeScheduleWinScene = (): void => {
    const snap = session.snapshot();
    const handWonEvents = snap.events.filter((e) => e.type === 'HandWon');
    if (handWonEvents.length <= lastHandWonEventCount) return;
    lastHandWonEventCount = handWonEvents.length;
    const latest = handWonEvents[handWonEvents.length - 1]!;
    if (latest.type !== 'HandWon') return;
    scenes.scheduleWinners(latest.winners, latest.discarder);
  };

  const refresh = (): void => {
    const snap = session.snapshot();
    table.sync(snap.state, snap.selectedTileId);
    maybeScheduleWinScene();

    if (!snap.state) {
      statusEl.textContent = '输入种子并开始一局';
      metaEl.textContent = '';
      responseBar.hidden = true;
      selfBar.hidden = true;
      drawPanel.hidden = true;
      winPanel.hidden = true;
      return;
    }

    const dealerLabel = snap.state.dealer === PLAYER_SEAT ? '玩家' : `座位 ${snap.state.dealer}`;
    metaEl.textContent = [
      `种子 ${snap.seed}`,
      `庄家 ${dealerLabel}`,
      `牌墙 ${snap.state.wall.length}`,
      `实体牌 ${totalTileCount(snap.state)}/${FULL_SET_SIZE}`,
    ].join(' · ');

    const responding =
      snap.status === 'awaiting_player_win_response' ||
      snap.status === 'awaiting_player_claim_response';
    responseBar.hidden = !responding;
    claimWinBtn.hidden = responding ? !snap.playerCanWin : true;
    claimKongBtn.hidden = snap.status !== 'awaiting_player_claim_response' || !snap.playerCanKong;
    claimPungBtn.hidden = snap.status !== 'awaiting_player_claim_response' || !snap.playerCanPung;
    renderChowOptions();

    const selfActions =
      snap.status === 'awaiting_player_discard' &&
      (snap.playerCanWin ||
        snap.playerConcealedKongCodes.length > 0 ||
        snap.playerAddedKongCodes.length > 0);
    selfBar.hidden = !selfActions;
    declareWinBtn.hidden = !snap.playerCanWin || snap.status !== 'awaiting_player_discard';
    renderKongOptions();

    if (snap.status === 'awaiting_player_discard') {
      statusEl.textContent = snap.selectedTileId
        ? '再次点击同一张牌确认出牌，或拖入牌河'
        : '轮到你出牌：可杠 / 自摸 / 出牌';
    } else if (snap.status === 'awaiting_player_claim_response') {
      statusEl.textContent = '可响应：选择胡 / 杠 / 碰 / 吃 / 过（无倒计时）';
    } else if (snap.status === 'awaiting_player_win_response') {
      statusEl.textContent = snap.playerCanWin ? '可胡或过' : '请选择过';
    } else if (snap.status === 'exhaustive_draw') {
      statusEl.textContent = '流局 · 不计番 · 庄家不变';
    } else if (snap.status === 'hand_won') {
      const first = snap.winSettlement?.winners[0];
      const label = first ? patternLabels(first.patterns).join('、') : '胡';
      statusEl.textContent = `胡牌 · ${label} · ${first?.fan ?? 0} 番`;
    } else {
      statusEl.textContent = '准备中…';
    }

    renderDrawPanel();
    renderWinPanel();
  };

  session.subscribe(refresh);

  themeSelect.addEventListener('change', () => {
    const next = themeSelect.value;
    if (!isThemeId(next)) {
      themeSelect.value = themes.getActiveId();
      return;
    }
    void (async () => {
      const from = themes.getApplied();
      const result = await themes.select(next as ThemeId);
      applyActiveTheme({ from, transitionMs: result.transitionMs });
      showThemeNotices(result.notices);
      themeSelect.value = result.activeId;
    })();
  });

  startBtn.addEventListener('click', () => {
    const seed = Number.parseInt(seedInput.value, 10);
    if (!Number.isFinite(seed)) {
      statusEl.textContent = '请输入有效数字种子';
      return;
    }
    lastHandWonEventCount = 0;
    session.start(seed);
  });

  claimWinBtn.addEventListener('click', () => session.claimWin());
  claimKongBtn.addEventListener('click', () => session.claimKong());
  claimPungBtn.addEventListener('click', () => session.claimPung());
  declareWinBtn.addEventListener('click', () => session.claimWin());
  passBtn.addEventListener('click', () => session.passResponse());
  nextHandBtn.addEventListener('click', () => {
    const nextSeed = (session.snapshot().seed ?? DEFAULT_SEED) + 1;
    seedInput.value = String(nextSeed);
    lastHandWonEventCount = 0;
    session.startNextHand(nextSeed);
  });
  winNextHandBtn.addEventListener('click', () => {
    const nextSeed = (session.snapshot().seed ?? DEFAULT_SEED) + 1;
    seedInput.value = String(nextSeed);
    lastHandWonEventCount = 0;
    session.startNextHand(nextSeed);
  });
  replaySceneBtn.addEventListener('click', () => scenes.replay());

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
    ready: false,
    start: (seed: number) => {
      lastHandWonEventCount = 0;
      session.start(seed);
    },
    snapshot: () => session.snapshot(),
    clickTile: (tileId: string) => session.clickTile(tileId),
    discardByDrag: (tileId: string) => session.discardByDrag(tileId),
    autoPlayToDraw: () => session.autoPlayPlayerFirstLegal(),
    claimWin: () => session.claimWin(),
    claimPung: () => session.claimPung(),
    claimChow: (tileIds: [string, string]) => session.claimChow(tileIds),
    passWin: () => session.passResponse(),
    passResponse: () => session.passResponse(),
    startNextHand: (seed: number) => {
      lastHandWonEventCount = 0;
      session.startNextHand(seed);
    },
    loadPinghuWinDemo: () => {
      lastHandWonEventCount = 0;
      session.loadPinghuWinDemo();
    },
    replayScene: () => scenes.replay(),
    lastScenePlans: () => scenes.getLastPlans(),
    selectTheme: async (id: ThemeId) => {
      const from = themes.getApplied();
      const result = await themes.select(id);
      applyActiveTheme({ from, transitionMs: result.transitionMs });
      showThemeNotices(result.notices);
      themeSelect.value = result.activeId;
      return result;
    },
    activeThemeId: () => themes.getActiveId(),
    themeApplied: () => themes.getApplied(),
    scenePalette: () => themes.getScenePalette(),
    themeNotices: () => themes.getNotices(),
    themeRefCount: (id: ThemeId) => themes.getRefCount(id),
    themeRetained: (id: ThemeId) => themes.isRetained(id),
    ambientParticleKind: () => table.ambientParticleKind(),
    tileBackPattern: () => table.tileBackPattern(),
  };

  void themes.start().then(() => {
    applyActiveTheme();
    document.body.classList.add('ready');
    if (window.__play) window.__play.ready = true;
    session.start(DEFAULT_SEED);
  });
}
