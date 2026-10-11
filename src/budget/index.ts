/** Browser-safe budget helpers. Node transfer measurement lives in `firstScreen.ts` (tests / CLI only). */
export {
  FIRST_SCREEN_TRANSFER_BUDGET_BYTES,
  THEME_ON_DEMAND_BUDGET_BYTES,
  STATIC_SCENE_DRAW_CALL_BUDGET,
  COLD_START_MENU_BUDGET_MS,
  MID_GAMEPLAY_FPS_TARGET,
  TOP_SCENE_FPS_FLOOR,
  STABILITY_HAND_COUNT,
  STABILITY_SCENE_COUNT,
  STABILITY_THEME_SWITCH_COUNT,
} from './limits';
export {
  LoadProgressTracker,
  LOAD_STAGES,
  type LoadStageId,
  type LoadProgressSnapshot,
} from './loadProgress';
export { hasSustainedGrowth, type StabilityReport } from './stability';
