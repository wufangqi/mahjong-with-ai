/** MVP 1.0 performance / resource budgets (需求文档 §11.4 / AC14–AC17). */

export const FIRST_SCREEN_TRANSFER_BUDGET_BYTES = 3 * 1024 * 1024;
export const THEME_ON_DEMAND_BUDGET_BYTES = 1 * 1024 * 1024;
export const STATIC_SCENE_DRAW_CALL_BUDGET = 100;
export const COLD_START_MENU_BUDGET_MS = 3000;
export const MID_GAMEPLAY_FPS_TARGET = 60;
export const TOP_SCENE_FPS_FLOOR = 30;

/** Stability soak sizes from acceptance criteria. */
export const STABILITY_HAND_COUNT = 50;
export const STABILITY_SCENE_COUNT = 100;
export const STABILITY_THEME_SWITCH_COUNT = 20;
