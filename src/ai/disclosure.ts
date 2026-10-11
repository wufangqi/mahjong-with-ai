import { EXTERNAL_AI_SENT_FIELDS, EXTERNAL_AI_WITHHELD_FIELDS } from './payload';

/** First-use disclosure copy for enabling optional external AI. */
export interface ExternalAiDisclosure {
  title: string;
  intro: string;
  proxyLabel: string;
  proxyUrl: string;
  sentLabel: string;
  sentFields: string[];
  withheldLabel: string;
  withheldFields: string[];
  confirmLabel: string;
  cancelLabel: string;
}

const SENT_LABELS: Record<(typeof EXTERNAL_AI_SENT_FIELDS)[number], string> = {
  seat: '本座位编号',
  dealer: '庄家',
  turn: '当前轮次座位',
  phase: '当前阶段',
  wallRemaining: '牌墙剩余张数',
  hand: '本座位手牌',
  drawn: '本座位刚摸到的牌',
  publicSeats: '各家公开副露与牌河、暗牌张数',
  responseTile: '当前响应牌',
  discarder: '出牌者座位',
  legalActions: '完整合法动作列表',
};

const WITHHELD_LABELS: Record<(typeof EXTERNAL_AI_WITHHELD_FIELDS)[number], string> = {
  otherHands: '其他家隐藏手牌',
  wall: '牌墙顺序',
  wallOrder: '牌墙顺序',
  seed: '随机种子',
  rngState: '随机源状态',
  providerApiKey: '模型厂商 API Key',
};

export function buildExternalAiDisclosure(proxyUrl: string): ExternalAiDisclosure {
  return {
    title: '启用外接 AI',
    intro:
      '外接 AI 为可选决策来源。启用前请确认代理地址与数据边界。代理令牌只保存在当前浏览器会话，不会写入本地存档、日志或导出。',
    proxyLabel: '代理地址',
    proxyUrl: disclosureProxyDisplay(proxyUrl),
    sentLabel: '将发送的字段',
    sentFields: EXTERNAL_AI_SENT_FIELDS.map((k) => SENT_LABELS[k]),
    withheldLabel: '明确不发送',
    withheldFields: [
      WITHHELD_LABELS.otherHands,
      WITHHELD_LABELS.wall,
      WITHHELD_LABELS.seed,
      WITHHELD_LABELS.providerApiKey,
    ],
    confirmLabel: '确认启用',
    cancelLabel: '取消',
  };
}

/** Expose proxy URL in disclosure UI (empty string when unset). */
export function disclosureProxyDisplay(proxyUrl: string): string {
  return proxyUrl.trim() || '（尚未填写）';
}
