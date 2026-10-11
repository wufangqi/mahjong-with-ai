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
import {
  AudioController,
  playSynthesized,
  sfxForDomainEvent,
  sfxForSceneTier,
} from '../audio';
import { FULL_SET_SIZE, PLAYER_SEAT, totalTileCount, type Command, type Seat } from '../core';
import { MatchSession } from '../game/match';
import { isReducedMotionMode, ReducedMotionController } from '../motion';
import { PersistStore, replayCommands, type ActiveSave, type LoggedCommand } from '../persist';
import { probeFromRenderer } from '../particles/probe';
import { QualityController } from '../quality/qualityController';
import {
  isQualityTier,
  QUALITY_MODE_STORAGE_KEY,
  QUALITY_STORAGE_KEY,
  type QualityTier,
} from '../quality/types';
import { listThemeOptions, loadTheme } from '../theme/catalog';
import { ThemeManager } from '../theme/themeManager';
import { isThemeId } from '../theme/schema';
import { THEME_STORAGE_KEY, type ThemeId } from '../theme/types';
import { TableView } from './tableView';
import { formatTileCodes } from './tileLabels';
import { patternLabels, WinSceneScheduler, type WinScenePlan } from './winPresentation';

const AUTO_SKIP_STORAGE_KEY = 'mahjong.scene.autoSkipOpponent';

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
  const continueMatchBtn = mustEl<HTMLButtonElement>('continue-match');
  const startBtn = mustEl<HTMLButtonElement>('start');
  const saveNotice = mustEl<HTMLElement>('save-notice');
  const saveNoticeText = mustEl<HTMLElement>('save-notice-text');
  const exportIncompatibleBtn = mustEl<HTMLButtonElement>('export-incompatible');
  const dismissIncompatibleBtn = mustEl<HTMLButtonElement>('dismiss-incompatible');
  const exportDataBtn = mustEl<HTMLButtonElement>('export-data');
  const clearDataBtn = mustEl<HTMLButtonElement>('clear-data');
  const replayLogInput = mustEl<HTMLTextAreaElement>('replay-log-input');
  const devReplayBtn = mustEl<HTMLButtonElement>('dev-replay');
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
  const masterVolumeInput = mustEl<HTMLInputElement>('master-volume');
  const sfxVolumeInput = mustEl<HTMLInputElement>('sfx-volume');
  const reducedMotionSelect = mustEl<HTMLSelectElement>('reduced-motion');
  const autoSkipOpponentInput = mustEl<HTMLInputElement>('auto-skip-opponent');
  const sceneBar = mustEl<HTMLElement>('scene-bar');
  const skipSceneBtn = mustEl<HTMLButtonElement>('skip-scene');

  seedInput.value = String(DEFAULT_SEED);

  const match = new MatchSession();
  const session = match.hand;
  const table = new TableView(canvas);
  const storage = browserStorage();
  const persist = new PersistStore();
  let cachedActiveSave: ActiveSave | null = null;
  let persistChain: Promise<void> = Promise.resolve();
  let incompatibleReason: string | null = null;
  /** Developer replay must not write IndexedDB activeSave (AC2 continue). */
  let persistPausedForDevReplay = false;
  let persistDebounceTimer: number | null = null;
  const scenes = new WinSceneScheduler({
    now: () => performance.now(),
    defer: (fn, ms) => window.setTimeout(fn, ms),
    cancelDefer: (h) => window.clearTimeout(h as number),
  });
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
  const audio = new AudioController({ storage, play: playSynthesized });
  audio.restore();
  const reducedMotion = new ReducedMotionController({ storage });
  reducedMotion.restore();
  scenes.setAutoSkipOpponent(storage.getItem(AUTO_SKIP_STORAGE_KEY) === '1');
  const gpuProbe = probeFromRenderer(table.renderer);
  let lastHandWonEventCount = 0;
  let lastEventCount = 0;
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

  const syncAudioChrome = (): void => {
    masterVolumeInput.value = String(audio.getMasterVolume());
    sfxVolumeInput.value = String(audio.getSfxVolume());
  };

  const syncMotionChrome = (): void => {
    reducedMotionSelect.value = reducedMotion.getMode();
    document.body.dataset.reducedMotion = reducedMotion.isEnabled() ? 'on' : 'off';
    autoSkipOpponentInput.checked = scenes.getAutoSkipOpponent();
  };

  const setSceneChrome = (playing: boolean): void => {
    document.body.classList.toggle('scene-playing', playing);
    sceneBar.hidden = !playing;
    if (playing) {
      winPanel.hidden = true;
      responseBar.hidden = true;
      selfBar.hidden = true;
    }
  };

  const showScene = (plan: WinScenePlan): void => {
    const palette = themes.captureScenePalette();
    document.documentElement.style.setProperty('--banner-basic', palette.bannerBasic);
    bannerMain.textContent = plan.bannerMain;
    bannerSub.textContent = plan.bannerSub;
    banner.className = `show ${plan.tier}`;
    banner.style.setProperty('--delay', '0s');
    audio.play(sfxForSceneTier(plan.tier));
    if (sceneReleaseTimer !== null) window.clearTimeout(sceneReleaseTimer);
    sceneReleaseTimer = window.setTimeout(() => {
      themes.releaseScenePalette();
      syncThemeChrome();
      if (banner.classList.contains('show')) banner.className = '';
      sceneReleaseTimer = null;
    }, 2400);
  };

  scenes.onPlay(() => {
    setSceneChrome(true);
  });
  scenes.onScene((plan) => {
    setSceneChrome(true);
    showScene(plan);
  });
  scenes.onIdle(() => {
    setSceneChrome(false);
    refresh();
  });

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
    if (snap.status !== 'hand_won' || !snap.winSettlement || scenes.isPlaying()) {
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
      const actions = document.createElement('div');
      actions.className = 'win-seat-actions';
      const replayOne = document.createElement('button');
      replayOne.type = 'button';
      replayOne.dataset.testid = `replay-seat-${winner.seat}`;
      replayOne.textContent = '单独重播';
      replayOne.addEventListener('click', () => scenes.replaySeat(winner.seat));
      actions.append(replayOne);
      row.append(actions);
      winSummary.append(row);
    }
  };

  const playNewEventSfx = (): void => {
    const events = session.snapshot().events;
    if (events.length < lastEventCount) lastEventCount = 0;
    for (let i = lastEventCount; i < events.length; i++) {
      const id = sfxForDomainEvent(events[i]!);
      if (id) audio.play(id);
    }
    lastEventCount = events.length;
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
    playNewEventSfx();
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

    const scenePlaying = scenes.isPlaying();
    setSceneChrome(scenePlaying);

    const responding =
      !scenePlaying &&
      (snap.status === 'awaiting_player_win_response' ||
        snap.status === 'awaiting_player_claim_response');
    responseBar.hidden = !responding;
    claimWinBtn.hidden = responding ? !snap.playerCanWin : true;
    claimKongBtn.hidden = snap.status !== 'awaiting_player_claim_response' || !snap.playerCanKong || scenePlaying;
    claimPungBtn.hidden = snap.status !== 'awaiting_player_claim_response' || !snap.playerCanPung || scenePlaying;
    renderChowOptions();

    const selfActions =
      !scenePlaying &&
      snap.status === 'awaiting_player_discard' &&
      (snap.playerCanWin ||
        snap.playerConcealedKongCodes.length > 0 ||
        snap.playerAddedKongCodes.length > 0);
    selfBar.hidden = !selfActions;
    declareWinBtn.hidden = !snap.playerCanWin || snap.status !== 'awaiting_player_discard' || scenePlaying;
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

  const syncMenuPersistUi = (): void => {
    continueMatchBtn.hidden = cachedActiveSave === null;
    if (incompatibleReason) {
      saveNotice.hidden = false;
      saveNoticeText.textContent = `无法加载旧存档：${incompatibleReason}。可导出后重新开始。`;
    } else {
      saveNotice.hidden = true;
      saveNoticeText.textContent = '';
    }
  };

  const flushPersist = (): void => {
    if (persistDebounceTimer !== null) {
      window.clearTimeout(persistDebounceTimer);
      persistDebounceTimer = null;
    }
    if (persistPausedForDevReplay) return;
    persistChain = persistChain
      .then(async () => {
        if (persistPausedForDevReplay) return;
        const save = match.toActiveSave();
        if (!save) return;
        cachedActiveSave = await persist.saveActive(save);
      })
      .catch((err) => {
        console.error('persist save failed', err);
      });
  };

  /** Debounce IndexedDB writes so rapid autoplay does not serialize hundreds of puts. */
  const queuePersist = (): void => {
    if (persistPausedForDevReplay) return;
    if (persistDebounceTimer !== null) window.clearTimeout(persistDebounceTimer);
    persistDebounceTimer = window.setTimeout(() => {
      persistDebounceTimer = null;
      flushPersist();
    }, 40);
  };

  const waitPersistIdle = async (): Promise<void> => {
    flushPersist();
    await persistChain;
  };

  const downloadText = (filename: string, text: string): void => {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const refreshPersistMenu = async (): Promise<void> => {
    const loaded = await persist.loadActive();
    if (loaded.status === 'ok') {
      cachedActiveSave = loaded.save;
      incompatibleReason = null;
    } else if (loaded.status === 'incompatible') {
      cachedActiveSave = null;
      incompatibleReason = loaded.reason;
    } else {
      cachedActiveSave = null;
      incompatibleReason = null;
    }
    syncMenuPersistUi();
  };

  match.subscribe(() => {
    refresh();
    if (match.snapshot().status !== 'menu') {
      queuePersist();
    }
  });

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
    lastEventCount = 0;
    persistPausedForDevReplay = false;
    quality.endGame();
    if (quality.getMode() === 'auto') {
      quality.selectInitial(gpuProbe, fpsEma);
      applyQualityToTable();
      syncQualityChrome();
    }
    quality.beginGame();
    rebuildDecisionProvider();
    cachedActiveSave = null;
    incompatibleReason = null;
    syncMenuPersistUi();
    await match.startMatch(seed);
  };

  const continueMatch = (): void => {
    if (!cachedActiveSave) return;
    lastHandWonEventCount = 0;
    lastEventCount = 0;
    persistPausedForDevReplay = false;
    quality.endGame();
    if (quality.getMode() === 'auto') {
      quality.selectInitial(gpuProbe, fpsEma);
      applyQualityToTable();
      syncQualityChrome();
    }
    quality.beginGame();
    rebuildDecisionProvider();
    match.restoreFromSave(cachedActiveSave);
    seedInput.value = String(cachedActiveSave.handState.seed);
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
  continueMatchBtn.addEventListener('click', () => continueMatch());

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
    lastEventCount = 0;
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
    lastEventCount = 0;
    quality.endGame();

    if (persistPausedForDevReplay) {
      // Leave IndexedDB activeSave untouched; reload continue target from store.
      persistPausedForDevReplay = false;
      match.endMatch();
      table.sync(null, null);
      void refreshPersistMenu();
      return;
    }

    const meta = match.archiveMeta();
    cachedActiveSave = null;
    incompatibleReason = null;
    syncMenuPersistUi();
    persistChain = persistChain
      .then(async () => {
        if (meta && meta.actionLog.length > 0) {
          await persist.archiveGameLog({
            matchSeed: meta.matchSeed,
            handCount: meta.handCount,
            actionLog: [...meta.actionLog],
            finalHandState: meta.finalHandState,
          });
        }
        await persist.clearActive();
      })
      .catch((err) => console.error('persist end failed', err));
    match.endMatch();
    table.sync(null, null);
  };
  endMatchDrawBtn.addEventListener('click', endCurrentMatch);
  endMatchWinBtn.addEventListener('click', endCurrentMatch);
  replaySceneBtn.addEventListener('click', () => scenes.replayAll());
  skipSceneBtn.addEventListener('click', () => scenes.skip());

  exportDataBtn.addEventListener('click', () => {
    void persist.exportJson().then((json) => {
      downloadText(`mahjong-export-${Date.now()}.json`, json);
    });
  });

  exportIncompatibleBtn.addEventListener('click', () => {
    void persist.exportJson().then((json) => {
      downloadText(`mahjong-incompatible-save-${Date.now()}.json`, json);
    });
  });

  dismissIncompatibleBtn.addEventListener('click', () => {
    incompatibleReason = null;
    syncMenuPersistUi();
  });

  clearDataBtn.addEventListener('click', () => {
    const ok = window.confirm('清除本地存档、动作日志、主题与画质设置？此操作不可撤销。');
    if (!ok) return;
    void (async () => {
      await persist.clearAllGameData();
      storage.removeItem(THEME_STORAGE_KEY);
      storage.removeItem(QUALITY_STORAGE_KEY);
      storage.removeItem(QUALITY_MODE_STORAGE_KEY);
      cachedActiveSave = null;
      incompatibleReason = null;
      persistPausedForDevReplay = false;
      syncMenuPersistUi();
      await themes.select('classic-green');
      applyActiveTheme();
      quality.setAuto();
      quality.selectInitial(gpuProbe, fpsEma);
      applyQualityToTable();
      syncQualityChrome();
    })();
  });

  const runDevReplay = (commands: LoggedCommand[]): void => {
    // Pause before restore so subscribe → queuePersist cannot clobber activeSave.
    persistPausedForDevReplay = true;
    const result = replayCommands(commands);
    lastHandWonEventCount = 0;
    lastEventCount = 0;
    quality.endGame();
    quality.beginGame();
    const status =
      result.state.phase === 'exhaustive_draw'
        ? ('exhaustive_draw' as const)
        : result.state.phase === 'hand_won'
          ? ('hand_won' as const)
          : result.state.phase === 'awaiting_win_response'
            ? ('awaiting_player_win_response' as const)
            : result.state.phase === 'awaiting_claim_response'
              ? ('awaiting_player_claim_response' as const)
              : result.state.phase === 'awaiting_discard' && result.state.turn === PLAYER_SEAT
                ? ('awaiting_player_discard' as const)
                : ('idle' as const);
    match.restoreFromSave({
      schemaVersion: 1,
      kind: 'active_save',
      savedAt: Date.now(),
      match: {
        status:
          status === 'exhaustive_draw' || status === 'hand_won' ? 'hand_settled' : 'in_hand',
        handIndex: Math.max(1, commands.filter((c) => c.type === 'StartHand').length),
        matchSeed: result.state.seed,
      },
      sessionStatus: status,
      handState: result.state,
      selectedTileId: null,
      actionLog: commands,
    });
    seedInput.value = String(result.state.seed);
  };

  devReplayBtn.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(replayLogInput.value) as unknown;
      const commands = extractActionLog(parsed);
      runDevReplay(commands);
    } catch (err) {
      statusEl.hidden = false;
      statusEl.textContent = `回放失败：${err instanceof Error ? err.message : String(err)}`;
    }
  });

  masterVolumeInput.addEventListener('input', () => {
    audio.setMasterVolume(Number.parseFloat(masterVolumeInput.value));
  });
  sfxVolumeInput.addEventListener('input', () => {
    audio.setSfxVolume(Number.parseFloat(sfxVolumeInput.value));
  });
  reducedMotionSelect.addEventListener('change', () => {
    const value = reducedMotionSelect.value;
    if (!isReducedMotionMode(value)) {
      reducedMotionSelect.value = reducedMotion.getMode();
      return;
    }
    reducedMotion.setMode(value);
    syncMotionChrome();
  });
  autoSkipOpponentInput.addEventListener('change', () => {
    scenes.setAutoSkipOpponent(autoSkipOpponentInput.checked);
    storage.setItem(AUTO_SKIP_STORAGE_KEY, autoSkipOpponentInput.checked ? '1' : '0');
  });

  let pointerDownAt: { x: number; y: number; tileId: string } | null = null;
  let dragging = false;

  canvas.addEventListener('pointerdown', (e) => {
    if (scenes.isPlaying()) return;
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
    continueMatch: () => {
      continueMatch();
    },
    endMatch: () => {
      endCurrentMatch();
    },
    matchSnapshot: () => match.snapshot(),
    snapshot: () => session.snapshot(),
    actionLog: () => [...session.getActionLog()],
    exportJson: () => persist.exportJson(),
    clearLocalData: async () => {
      await persist.clearAllGameData();
      storage.removeItem(THEME_STORAGE_KEY);
      storage.removeItem(QUALITY_STORAGE_KEY);
      storage.removeItem(QUALITY_MODE_STORAGE_KEY);
      cachedActiveSave = null;
      incompatibleReason = null;
      persistPausedForDevReplay = false;
      syncMenuPersistUi();
    },
    refreshPersistMenu: () => refreshPersistMenu(),
    hasContinue: () => cachedActiveSave !== null,
    incompatibleReason: () => incompatibleReason,
    replayActionLog: (commands: Command[]) => {
      runDevReplay(commands);
    },
    waitPersist: () => waitPersistIdle(),
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
      lastEventCount = 0;
      persistPausedForDevReplay = false;
      if (match.snapshot().status === 'menu') {
        await startNewMatch(DEFAULT_SEED);
      }
      session.loadPinghuWinDemo();
      // Demo settles as an in-match hand for settlement / end UI.
      refresh();
    },
    replayScene: () => scenes.replayAll(),
    replaySeat: (seat: Seat) => scenes.replaySeat(seat),
    skipScene: () => scenes.skip(),
    isScenePlaying: () => scenes.isPlaying(),
    lastScenePlans: () => scenes.getLastPlans(),
    setMasterVolume: (v: number) => {
      audio.setMasterVolume(v);
      syncAudioChrome();
    },
    setSfxVolume: (v: number) => {
      audio.setSfxVolume(v);
      syncAudioChrome();
    },
    masterVolume: () => audio.getMasterVolume(),
    sfxVolume: () => audio.getSfxVolume(),
    setReducedMotion: (mode: 'system' | 'on' | 'off') => {
      reducedMotion.setMode(mode);
      syncMotionChrome();
    },
    reducedMotionMode: () => reducedMotion.getMode(),
    reducedMotionEnabled: () => reducedMotion.isEnabled(),
    setAutoSkipOpponent: (enabled: boolean) => {
      scenes.setAutoSkipOpponent(enabled);
      storage.setItem(AUTO_SKIP_STORAGE_KEY, enabled ? '1' : '0');
      syncMotionChrome();
    },
    autoSkipOpponent: () => scenes.getAutoSkipOpponent(),
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
    syncAudioChrome();
    syncMotionChrome();
    await refreshPersistMenu();
    showMenu();
    document.body.classList.add('ready');
    if (window.__play) window.__play.ready = true;
    refresh();
  });
}

function extractActionLog(parsed: unknown): LoggedCommand[] {
  if (Array.isArray(parsed)) {
    return parsed as LoggedCommand[];
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as {
      actionLog?: LoggedCommand[];
      activeSave?: { actionLog?: LoggedCommand[] };
      gameLogs?: { actionLog?: LoggedCommand[] }[];
    };
    if (Array.isArray(obj.actionLog)) return obj.actionLog;
    if (obj.activeSave && Array.isArray(obj.activeSave.actionLog)) {
      return obj.activeSave.actionLog;
    }
    if (Array.isArray(obj.gameLogs) && obj.gameLogs[0] && Array.isArray(obj.gameLogs[0].actionLog)) {
      return obj.gameLogs[0].actionLog;
    }
  }
  throw new Error('需要动作日志数组，或含 actionLog 的导出包');
}
