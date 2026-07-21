// js/data/attributes.js — 属性与评定阈值配置（严禁修改结构）

export const ATTRIBUTES = {
  cursedEnergy: { name: "咒力总量", base: 10 },
  cursedEnergyControl: { name: "咒力操控", base: 10 },
  cursedEnergyEfficiency: { name: "咒力效率", base: 10 },
  constitution: { name: "体质", base: 10 },
  martialArts: { name: "体术水平", base: 10 },
  talent: { name: "天赋", base: 10 }
};

export const RANK_THRESHOLDS = [
  { name: "不入流", min: 0 },
  { name: "四级", min: 16 },
  { name: "准三级", min: 20 },
  { name: "三级", min: 24 },
  { name: "准二级", min: 28 },
  { name: "二级", min: 32 },
  { name: "准一级", min: 36 },
  { name: "一级", min: 40 },
  { name: "准特级", min: 48 },
  { name: "特级", min: 56 },
  { name: "现代最强", min: 64 }
];

// ================================================================
// Phase 5: 养成系统配置
// ================================================================

/** 修炼消耗与效果 */
export const TRAIN_CONFIG = {
  apCost: 20,           // 每次修炼消耗 AP
  staminaCost: 15,      // 每次修炼消耗体力
  residualGain: 10,     // 每次修炼增加残秽
  attrGainBase: 1,      // 属性基础提升（固定 1 点）
  attrGainBonusChancePer10Talent: 0.10, // 每 10 点天赋提供 10% 概率额外 +1
  attrGainMax: 2,       // 属性最大提升（基础 1 + 天赋 1）
};

/** 请教消耗与效果 */
export const CONSULT_CONFIG = {
  apCost: 20,           // 每次请教消耗 AP
  relationshipCost: 1,   // 每次请教消耗人情
  proficiencyGain: 10,   // 基础熟练度增加
  inspirationChanceBase: 0.15, // 基础灵感概率
};

/** 休息恢复配置 */
export const REST_CONFIG = {
  apRecovery: 70,       // 休息恢复 AP
  staminaRecovery: 50,   // 休息恢复体力
  hpRecoveryPct: 0.30,   // 休息恢复 HP 百分比
  residualClearPct: 0.30, // 休息清除残秽百分比
};

/** 资源上限 */
export const RESOURCE_CAPS = {
  maxAp: 100,
  maxStamina: 100,
  maxResidual: 100,
  maxRelationship: 10
};

/** 主界面行动消耗（修炼/请教/任务/探索/休息 以外的按钮暂用此） */
export const HUB_ACTION_COSTS = {
  train: { ap: 20, stamina: 15 },
  consult: { ap: 20, relationship: 1 },
  quest: { ap: 20 },
  explore: { ap: 0 },   // 探索由战斗系统接管
  rest: { ap: 0 },      // 休息有专门逻辑
};
