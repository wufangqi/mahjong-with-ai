import {
  buildExternalAiDisclosure,
  createEasyDecisionProvider,
  createExternalDecisionProvider,
  createSeatRoutedDecisionProvider,
  defaultExternalAiConfig,
  isAllowedProxyUrl,
  loadExternalAiConfig,
  loadProxyToken,
  saveExternalAiConfig,
  saveProxyToken,
  type ExternalAiPersistedConfig,
  type OpponentSource,
} from '../ai';
import { FULL_SET_SIZE, PLAYER_SEAT, totalTileCount, type Seat } from '../core';
import { MatchSession } from '../game/match';
import { probeFromRenderer } from '../particles/probe';
import { QualityController } from '../quality/qualityController';
import { isQualityTier, type QualityTier } from '../quality/types';
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

function memoryStorage(): Storage {
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

function browserStorage(): Storage {
  try {
    return window.localStorage;
  } catch {
    return memoryStorage();
  }
}

function browserSessionStorage(): Storage {
  try {
    return window.sessionStorage;
  } catch {
    return memoryStorage();
  }
}

export function bootPlayApp(): void {
  const canvas = mustEl<HTMLCanvasElement>('c');
  const seedInput = mustEl<HTMLInputElement>('seed');
  const statusEl = mustEl<HTMLElement>('status');
  const metaEl = mustEl<HTMLElement>('meta');
  const mainMenu = mustEl<HTMLElement>('main-menu');
  const hud = mustEl<HTMLElement>('hud');
  const handIndexEl = mustEl<HTMLElement>('hand-index');
  const startMatchBtn = mustEl<HTMLButtonElement>('start-match');
  const startBtn = mustEl<HTMLButtonElement>('start');
  const openAiSettingsBtn = mustEl<HTMLButtonElement>('open-ai-settings');
  const aiSettingsPanel = mustEl<HTMLElement>('ai-settings');
  const aiSource1 = mustEl<HTMLSelectElement>('ai-source-1');
  const aiSource2 = mustEl<HTMLSelectElement>('ai-source-2');
  const aiSource3 = mustEl<HTMLSelectElement>('ai-source-3');
  const aiProxyUrl = mustEl<HTMLInputElement>('ai-proxy-url');
  const aiModel = mustEl<HTMLInputElement>('ai-model');
  const aiProxyToken = mustEl<HTMLInputElement>('ai-proxy-token');
  const aiSettingsError = mustEl<HTMLElement>('ai-settings-error');
  const aiSettingsSave = mustEl<HTMLButtonElement>('ai-settings-save');
  const aiSettingsCancel = mustEl<HTMLButtonElement>('ai-settings-cancel');
  const aiDisclosure = mustEl<HTMLElement>('ai-disclosure');
  const aiDisclosureIntro = mustEl<HTMLElement>('ai-disclosure-intro');
  const aiDisclosureProxy = mustEl<HTMLElement>('ai-disclosure-proxy');
  const aiDisclosureSent = mustEl<HTMLElement>('ai-disclosure-sent');
  const aiDisclosureWithheld = mustEl<HTMLElement>('ai-disclosure-withheld');
  const aiDisclosureConfirm = mustEl<HTMLButtonElement>('ai-disclosure-confirm');
  const aiDisclosureCancel = mustEl<HTMLButtonElement>('ai-disclosure-cancel');
  const themeSelect = mustEl<HTMLSelectElement>('theme-select');
  const qualitySelect = mustEl<HTMLSelectElement>('quality-select');
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
  const endMatchDrawBtn = mustEl<HTMLButtonElement>('end-match-draw');
  const winPanel = mustEl<HTMLElement>('win-panel');
  const winSummary = mustEl<HTMLElement>('win-summary');
  const winNextHandBtn = mustEl<HTMLButtonElement>('win-next-hand');
  const endMatchWinBtn = mustEl<HTMLButtonElement>('end-match-win');
  const replaySceneBtn = mustEl<HTMLButtonElement>('replay-scene');
  const banner = mustEl<HTMLElement>('banner');
  const bannerMain = mustEl<HTMLElement>('banner-main');
  const bannerSub = mustEl<HTMLElement>('banner-sub');

  seedInput.value = String(DEFAULT_SEED);

  const match = new MatchSession();
  const session = match.hand;
  const table = new TableView(canvas);
  const scenes = new WinSceneScheduler();
  const storage = browserStorage();
  const sessionStore = browserSessionStorage();
  let aiConfig = loadExternalAiConfig(storage);
  let proxyToken = loadProxyToken(sessionStore);
  let pendingDisclosureSources: ExternalAiPersistedConfig['seatSources'] | null = null;

  const allowHttpLocalhost = Boolean(import.meta.env.DEV);

  const rebuildDecisionProvider = (): void => {
    const anyExternal =
      aiConfig.seatSources[1] === 'external' ||
      aiConfig.seatSources[2] === 'external' ||
      aiConfig.seatSources[3] === 'external';
    const easy = createEasyDecisionProvider();
    if (!anyExternal) {
      session.setDecisionProvider(easy);
      return;
    }
    const external = createExternalDecisionProvider({
      proxyUrl: aiConfig.proxyUrl,
      model: aiConfig.model,
      proxyToken,
      fallback: easy,
    });
    session.setDecisionProvider(
      createSeatRoutedDecisionProvider({
        seatSources: aiConfig.seatSources,
        easy,
        external,
      }),
    );
  };
  rebuildDecisionProvider();

  const fillList = (el: HTMLElement, items: string[]): void => {
    el.replaceChildren();
    for (const text of items) {
      const li = document.createElement('li');
      li.textContent = text;
      el.append(li);
    }
  };

  const syncAiSettingsForm = (): void => {
    aiSource1.value = aiConfig.seatSources[1];
    aiSource2.value = aiConfig.seatSources[2];
    aiSource3.value = aiConfig.seatSources[3];
    aiProxyUrl.value = aiConfig.proxyUrl;
    aiModel.value = aiConfig.model;
    aiProxyToken.value = proxyToken;
    aiSettingsError.hidden = true;
    aiSettingsError.textContent = '';
  };

  const showAiDisclosure = (sources: ExternalAiPersistedConfig['seatSources']): void => {
    const copy = buildExternalAiDisclosure(aiProxyUrl.value.trim() || aiConfig.proxyUrl);
    aiDisclosureIntro.textContent = copy.intro;
    aiDisclosureProxy.textContent = copy.proxyUrl;
    fillList(aiDisclosureSent, copy.sentFields);
    fillList(aiDisclosureWithheld, copy.withheldFields);
    pendingDisclosureSources = sources;
    aiDisclosure.hidden = false;
  };

  const readSourcesFromForm = (): ExternalAiPersistedConfig['seatSources'] => ({
    1: (aiSource1.value === 'external' ? 'external' : 'easy') as OpponentSource,
    2: (aiSource2.value === 'external' ? 'external' : 'easy') as OpponentSource,
    3: (aiSource3.value === 'external' ? 'external' : 'easy') as OpponentSource,
  });

  const commitAiSettings = (sources: ExternalAiPersistedConfig['seatSources']): boolean => {
    const next: ExternalAiPersistedConfig = {
      ...defaultExternalAiConfig(),
      proxyUrl: aiProxyUrl.value.trim(),
      model: aiModel.value.trim(),
      seatSources: sources,
      disclosureAccepted: aiConfig.disclosureAccepted,
    };
    const wantsExternal =
      sources[1] === 'external' || sources[2] === 'external' || sources[3] === 'external';
    if (wantsExternal) {
      if (!next.disclosureAccepted) {
        showAiDisclosure(sources);
        return false;
      }
      if (!isAllowedProxyUrl(next.proxyUrl, { allowHttpLocalhost })) {
        aiSettingsError.hidden = false;
        aiSettingsError.textContent = allowHttpLocalhost
          ? '请填写 HTTPS 代理，或本机开发用的 http://localhost / http://127.0.0.1'
          : '生产环境仅接受 HTTPS 代理地址';
        return false;
      }
      if (!next.model) {
        aiSettingsError.hidden = false;
        aiSettingsError.textContent = '请填写模型名';
        return false;
      }
    }
    aiConfig = next;
    proxyToken = aiProxyToken.value;
    saveExternalAiConfig(storage, aiConfig);
    saveProxyToken(sessionStore, proxyToken);
    rebuildDecisionProvider();
    aiSettingsPanel.hidden = true;
    aiDisclosure.hidden = true;
    pendingDisclosureSources = null;
    return true;
  };
  const themes = new ThemeManager({
    storage,
    now: () => performance.now(),
    schedule: (fn, ms) => {
      window.setTimeout(fn, ms);
    },
    loadTheme,
  });
  const quality = new QualityController({ storage });
  quality.restore();
  const gpuProbe = probeFromRenderer(table.renderer);
  let lastHandWonEventCount = 0;
  let sceneReleaseTimer: number | null = null;
  let lastFrameAt = performance.now();
  let fpsEma = 60;

  const applyQualityToTable = (): void => {
    table.applyQuality(quality.getSettings(), {
      gpuParticlesAvailable: gpuProbe.gpuParticlesAvailable,
    });
  };

  const syncQualityChrome = (): void => {
    qualitySelect.value = quality.getMode() === 'manual' ? quality.getTier() : 'auto';
    document.body.dataset.quality = quality.getTier();
  };

  const measureInitialFps = (): Promise<number> =>
    new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const sample = (now: number): void => {
        frames += 1;
        if (now - start >= 400) {
          resolve((frames * 1000) / Math.max(1, now - start));
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

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

  const showMenu = (): void => {
    document.body.classList.add('menu');
    mainMenu.hidden = false;
    hud.hidden = true;
    statusEl.hidden = true;
    metaEl.hidden = true;
    responseBar.hidden = true;
    selfBar.hidden = true;
    drawPanel.hidden = true;
    winPanel.hidden = true;
  };

  const showTableChrome = (): void => {
    document.body.classList.remove('menu');
    mainMenu.hidden = true;
    hud.hidden = false;
    statusEl.hidden = false;
    metaEl.hidden = false;
  };

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
      btn.addEventListener('click', () => {
        void session.claimChow(option.tileIds);
      });
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
      btn.addEventListener('click', () => {
        void session.declareConcealedKong(code);
      });
      kongOptionsEl.append(btn);
    }
    for (const code of snap.playerAddedKongCodes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.testid = 'declare-added-kong';
      btn.textContent = `加杠 ${formatTileCodes([code])}`;
      btn.addEventListener('click', () => {
        void session.declareAddedKong(code);
      });
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
    const matchSnap = match.snapshot();
    const snap = matchSnap.hand;
    table.sync(snap.state, snap.selectedTileId);
    maybeScheduleWinScene();

    if (matchSnap.status === 'menu' || !snap.state) {
      showMenu();
      statusEl.textContent = '从主菜单开始一场';
      metaEl.textContent = '';
      handIndexEl.textContent = '';
      return;
    }

    showTableChrome();
    handIndexEl.textContent = `第 ${matchSnap.handIndex} 局 · 无整场总分`;

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
    } else if (snap.status === 'awaiting_ai') {
      statusEl.textContent = '对手思考中…';
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

  match.subscribe(refresh);

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

  const startNewMatch = async (seed: number): Promise<void> => {
    lastHandWonEventCount = 0;
    quality.endGame();
    if (quality.getMode() === 'auto') {
      quality.selectInitial(gpuProbe, fpsEma);
      applyQualityToTable();
      syncQualityChrome();
    }
    quality.beginGame();
    rebuildDecisionProvider();
    await match.startMatch(seed);
  };

  const onStartMatchClick = (): void => {
    const seed = Number.parseInt(seedInput.value, 10);
    if (!Number.isFinite(seed)) {
      statusEl.hidden = false;
      statusEl.textContent = '请输入有效数字种子';
      return;
    }
    void startNewMatch(seed);
  };

  startMatchBtn.addEventListener('click', onStartMatchClick);
  startBtn.addEventListener('click', onStartMatchClick);

  openAiSettingsBtn.addEventListener('click', () => {
    syncAiSettingsForm();
    aiSettingsPanel.hidden = false;
  });
  aiSettingsCancel.addEventListener('click', () => {
    aiSettingsPanel.hidden = true;
    aiDisclosure.hidden = true;
    pendingDisclosureSources = null;
  });
  aiSettingsSave.addEventListener('click', () => {
    commitAiSettings(readSourcesFromForm());
  });
  aiDisclosureCancel.addEventListener('click', () => {
    aiDisclosure.hidden = true;
    pendingDisclosureSources = null;
    // Revert external selections until confirmed.
    syncAiSettingsForm();
  });
  aiDisclosureConfirm.addEventListener('click', () => {
    if (!pendingDisclosureSources) return;
    aiConfig = { ...aiConfig, disclosureAccepted: true };
    commitAiSettings(pendingDisclosureSources);
  });

  claimWinBtn.addEventListener('click', () => {
    void session.claimWin();
  });
  claimKongBtn.addEventListener('click', () => {
    void session.claimKong();
  });
  claimPungBtn.addEventListener('click', () => {
    void session.claimPung();
  });
  declareWinBtn.addEventListener('click', () => {
    void session.claimWin();
  });
  passBtn.addEventListener('click', () => {
    void session.passResponse();
  });
  const goNextHand = async (): Promise<void> => {
    lastHandWonEventCount = 0;
    await match.nextHand();
    const nextSeed = session.snapshot().seed;
    if (nextSeed !== null) seedInput.value = String(nextSeed);
  };
  nextHandBtn.addEventListener('click', () => {
    void goNextHand();
  });
  winNextHandBtn.addEventListener('click', () => {
    void goNextHand();
  });
  const endCurrentMatch = (): void => {
    lastHandWonEventCount = 0;
    quality.endGame();
    match.endMatch();
    table.sync(null, null);
  };
  endMatchDrawBtn.addEventListener('click', endCurrentMatch);
  endMatchWinBtn.addEventListener('click', endCurrentMatch);
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
      if (result?.intoRiver) void session.discardByDrag(result.tileId);
      else refresh();
    } else {
      void session.clickTile(pointerDownAt.tileId);
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
    const now = performance.now();
    const dt = Math.min(100, now - lastFrameAt);
    lastFrameAt = now;
    const fps = dt > 0 ? 1000 / dt : fpsEma;
    fpsEma = fpsEma * 0.9 + fps * 0.1;
    const changed = quality.recordFrame(dt, fpsEma);
    if (changed) {
      applyQualityToTable();
      syncQualityChrome();
    }
    table.render();
  };
  frame();

  qualitySelect.addEventListener('change', () => {
    const value = qualitySelect.value;
    if (value === 'auto') {
      quality.setAuto();
      void measureInitialFps().then((measured) => {
        quality.selectInitial(gpuProbe, measured);
        applyQualityToTable();
        syncQualityChrome();
      });
      return;
    }
    if (isQualityTier(value)) {
      quality.setManual(value);
      applyQualityToTable();
      syncQualityChrome();
    }
  });

  window.__play = {
    ready: false,
    start: (seed: number) => startNewMatch(seed),
    startMatch: (seed: number) => startNewMatch(seed),
    endMatch: () => {
      endCurrentMatch();
    },
    matchSnapshot: () => match.snapshot(),
    snapshot: () => session.snapshot(),
    clickTile: (tileId: string) => session.clickTile(tileId),
    discardByDrag: (tileId: string) => session.discardByDrag(tileId),
    autoPlayToDraw: () => session.autoPlayPlayerFirstLegal(),
    claimWin: () => session.claimWin(),
    claimPung: () => session.claimPung(),
    claimChow: (tileIds: [string, string]) => session.claimChow(tileIds),
    passWin: () => session.passResponse(),
    passResponse: () => session.passResponse(),
    startNextHand: (_seed?: number) => goNextHand(),
    loadPinghuWinDemo: async () => {
      lastHandWonEventCount = 0;
      if (match.snapshot().status === 'menu') {
        await startNewMatch(DEFAULT_SEED);
      }
      session.loadPinghuWinDemo();
      // Demo settles as an in-match hand for settlement / end UI.
      refresh();
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
    ambientParticleBackend: () => table.ambientParticleBackend(),
    tileBackPattern: () => table.tileBackPattern(),
    qualityTier: () => quality.getTier(),
    qualityMode: () => quality.getMode(),
    qualitySettings: () => table.qualitySettings(),
    setQuality: (tier: QualityTier | 'auto') => {
      if (tier === 'auto') {
        quality.setAuto();
        quality.selectInitial(gpuProbe, fpsEma);
      } else {
        quality.setManual(tier);
      }
      applyQualityToTable();
      syncQualityChrome();
      return quality.getTier();
    },
    pinAutoQuality: (tier: QualityTier) => {
      quality.pinAutoTier(tier);
      applyQualityToTable();
      syncQualityChrome();
      return quality.getTier();
    },
    beginQualityGame: () => {
      quality.beginGame();
    },
    endQualityGame: () => {
      quality.endGame();
    },
    injectFpsSample: (dtMs: number, fps: number) => {
      const changed = quality.recordFrame(dtMs, fps);
      if (changed) applyQualityToTable();
      syncQualityChrome();
      return changed;
    },
    gpuProbe: () => ({ ...gpuProbe }),
  };

  void themes.start().then(async () => {
    applyActiveTheme();
    const measured = await measureInitialFps();
    if (quality.getMode() === 'auto') {
      quality.selectInitial(gpuProbe, measured);
    }
    applyQualityToTable();
    syncQualityChrome();
    showMenu();
    document.body.classList.add('ready');
    if (window.__play) window.__play.ready = true;
    refresh();
  });
}
