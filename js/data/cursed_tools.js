// js/data/cursed_tools.js — 咒具数据配置（Phase 13）
// 定义咒具（装备）的数据结构和配置
// 严禁包含任何 DOM 操作或 UI 逻辑

/**
 * 咒具数据结构:
 * {
 *   id: string,
 *   name: string,
 *   type: "weapon" | "armor" | "accessory",
 *   slot: "mainHand" | "offHand" | "accessory",
 *   price: number,
 *   description: string,
 *   flavorText: string,
 *   statsBonus: { [statName]: number },  // 属性加成，key 对应 attributes 中的 key
 *   tier: number  // 1-5 等级，影响价格和加成幅度
 * }
 *
 * 槽位说明:
 * - mainHand: 主手武器（weapon 类的主要承载槽位）
 * - offHand: 副手武器/盾（weapon/armor 均可）
 * - accessory: 饰品/戒指/护符
 *
 * 装备上限: 每个槽位只能装备一件
 *
 * Phase 13 基础咒具（Tier 1-2）:
 * - 本期只做基础属性加成，不实现主动特效
 * - 每级 Tier 提供约 5-10 点总属性加成
 */

export const CURSED_TOOLS = {
  // ================================================================
  //  Tier 1: 基础咒具（便宜、低属性加成）
  // ================================================================

  normalCursedBlade: {
    id: "normalCursedBlade",
    name: "普通咒具刀",
    type: "weapon",
    slot: "mainHand",
    tier: 1,
    price: 500,
    description: "刻有简单咒术符文的太刀，能增强体术攻击力。",
    flavorText: "「最低限度的咒具——但足够祓除低级咒灵了。」",
    statsBonus: { martialArts: 5, cursedEnergyControl: 2 }
  },

  ironBracers: {
    id: "ironBracers",
    name: "铁制护腕",
    type: "armor",
    slot: "offHand",
    tier: 1,
    price: 400,
    description: "锻铁制成的护腕，提供基础防御力。",
    flavorText: "「不是咒具，但总比什么都没有好。」",
    statsBonus: { constitution: 5 }
  },

  cursedRing: {
    id: "cursedRing",
    name: "咒力戒指",
    type: "accessory",
    slot: "accessory",
    tier: 1,
    price: 600,
    description: "注入微量咒力的戒指，提升咒术效率。",
    flavorText: "「戒指上的咒力在低语——使用者要小心。」",
    statsBonus: { cursedEnergyEfficiency: 4, cursedEnergy: 3 }
  },

  woodenTalisman: {
    id: "woodenTalisman",
    name: "木质护符",
    type: "accessory",
    slot: "accessory",
    tier: 1,
    price: 350,
    description: "简单的木制护符，略微增强咒力操控。",
    flavorText: "「初学者最好的朋友。」——日下部推荐",
    statsBonus: { cursedEnergyControl: 3, talent: 2 }
  },

  // ================================================================
  //  Tier 2: 进阶咒具（中等价格、中等属性加成）
  // ================================================================

  reinforcedBlade: {
    id: "reinforcedBlade",
    name: "强化咒具刀",
    type: "weapon",
    slot: "mainHand",
    tier: 2,
    price: 1200,
    description: "咒力强化过的太刀，显著的攻击力提升。",
    flavorText: "「咒术师有了趁手的家伙，效率翻倍。」",
    statsBonus: { martialArts: 10, cursedEnergyControl: 4 }
  },

  dragonScaleBracer: {
    id: "dragonScaleBracer",
    name: "龙鳞护腕",
    type: "armor",
    slot: "offHand",
    tier: 2,
    price: 1000,
    description: "以远古龙种诅咒锻造的护腕，大幅提升体质。",
    flavorText: "「这东西的原料至今还在微微颤动。」",
    statsBonus: { constitution: 10, cursedEnergy: 3 }
  },

  jadePendant: {
    id: "jadePendant",
    name: "翡翠挂坠",
    type: "accessory",
    slot: "accessory",
    tier: 2,
    price: 1500,
    description: "极品翡翠雕琢的挂坠，全面增强咒术能力。",
    flavorText: "「翠绿的光泽中蕴含着上百年的咒力积淀。」",
    statsBonus: { cursedEnergy: 6, cursedEnergyControl: 5, cursedEnergyEfficiency: 4 }
  },

  combatGloves: {
    id: "combatGloves",
    name: "战斗手套",
    type: "weapon",
    slot: "mainHand",
    tier: 2,
    price: 800,
    description: "咒力编织的战斗手套，提升体术和速度感。",
    flavorText: "「戴上它，你能感觉到拳风更快了。」",
    statsBonus: { martialArts: 8, talent: 4 }
  },

  spiritCharm: {
    id: "spiritCharm",
    name: "灵力符咒",
    type: "accessory",
    slot: "accessory",
    tier: 2,
    price: 900,
    description: "写满符文的和纸符咒，增强咒力总量。",
    flavorText: "「符纸虽薄，其力不可轻。」",
    statsBonus: { cursedEnergy: 8, cursedEnergyEfficiency: 3 }
  },

  // ================================================================
  //  Tier 3: 特效咒具（含主动 Buff）
  // ================================================================
  playfulCloud: {
    id: "playfulCloud",
    name: "游云",
    type: "weapon",
    slot: "mainHand",
    tier: 3,
    price: 5000,
    description: "东堂葵爱用的特级咒具，可随使用者心意变幻形态。",
    flavorText: "「游云——随心而动，无拘无束。」",
    statsBonus: { martialArts: 15 },
    // Phase 14: 主动特效 Buff
    activeBuff: {
      id: "playful_cloud_buff",
      name: "游云·重击",
      type: "buff",
      duration: 1, // 触发一次后消失
      description: "下一次体术攻击倍率 +2.0，但扣除 10% 当前 HP。",
      icon: "☁️",
      effects: { nextMartialMultiplier: 2.0, hpCostRatio: 0.1 }
    }
  },

  blackRope: {
    id: "blackRope",
    name: "黑绳",
    type: "weapon",
    slot: "mainHand",
    tier: 3,
    price: 4500,
    description: "传说中能束缚一切诅咒的漆黑绳索，极强的防御性能但会侵蚀咒力。",
    flavorText: "「黑绳——缚咒之力，以咒换体。」",
    statsBonus: { constitution: 20, cursedEnergyEfficiency: -10 },
    // Phase 14: 主动特效 Buff
    activeBuff: {
      id: "black_rope_buff",
      name: "黑绳·缚咒",
      type: "buff",
      duration: 0, // 永久持续，直到卸下或战斗结束
      description: "体质 +20，咒力效率 -10%。",
      icon: "🪢",
      effects: { constitutionBonus: 20, cursedEnergyEfficiencyPenalty: -10 }
    }
  }
};

// ================================================================
//  装备槽位配置
// ================================================================

export const EQUIPMENT_SLOTS = {
  mainHand: {
    id: "mainHand",
    name: "主手武器",
    acceptedTypes: ["weapon"],
    description: "主要攻击武器"
  },
  offHand: {
    id: "offHand",
    name: "副手装备",
    acceptedTypes: ["weapon", "armor"],
    description: "副手武器或防具"
  },
  accessory: {
    id: "accessory",
    name: "饰品",
    acceptedTypes: ["accessory"],
    description: "戒指、挂坠或护符"
  }
};

// ================================================================
//  辅助函数（纯函数，无 DOM 依赖）
// ================================================================

/**
 * 获取咒具配置
 * @param {string} toolId
 * @returns {object|null}
 */
export function getCursedTool(toolId) {
  return CURSED_TOOLS[toolId] || null;
}

/**
 * 获取指定槽位可装备的咒具列表
 * @param {string} slotId — "mainHand" | "offHand" | "accessory"
 * @returns {object[]}
 */
export function getToolsForSlot(slotId) {
  const slot = EQUIPMENT_SLOTS[slotId];
  if (!slot) return [];
  return Object.values(CURSED_TOOLS).filter(tool =>
    slot.acceptedTypes.includes(tool.type)
  );
}

/**
 * 检查咒具是否可以装备到指定槽位
 * @param {string} toolId
 * @param {string} slotId
 * @returns {boolean}
 */
export function canEquipToSlot(toolId, slotId) {
  const tool = CURSED_TOOLS[toolId];
  const slot = EQUIPMENT_SLOTS[slotId];
  if (!tool || !slot) return false;
  return slot.acceptedTypes.includes(tool.type);
}
