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
  //  Tier 2 Bonus: 更多普通咒具（无主动效果，增加商店多样性）
  // ================================================================

  cursedDagger: {
    id: "cursedDagger",
    name: "咒力短刀",
    type: "weapon",
    slot: "mainHand",
    tier: 2,
    price: 950,
    description: "轻巧的短刀，咒力传导性优秀。小幅提升体术和咒力操控。",
    flavorText: "「快而锋利——实战中比看起来更危险。」",
    statsBonus: { martialArts: 7, cursedEnergyControl: 6 }
  },

  ironFan: {
    id: "ironFan",
    name: "铁扇",
    type: "weapon",
    slot: "offHand",
    tier: 2,
    price: 850,
    description: "铁制战斗扇，可攻可守。提升防御和咒力效率。",
    flavorText: "「优雅而致命——铁扇之下不留活口。」",
    statsBonus: { constitution: 6, cursedEnergyEfficiency: 5 }
  },

  shadowCloak: {
    id: "shadowCloak",
    name: "影之外套",
    type: "armor",
    slot: "offHand",
    tier: 2,
    price: 1100,
    description: "以咒灵残影编织的外套。提升体质和才能感知。",
    flavorText: "「穿上去之后似乎能隐约看到诅咒的轮廓。」",
    statsBonus: { constitution: 8, talent: 5 }
  },

  focusBand: {
    id: "focusBand",
    name: "专注头带",
    type: "accessory",
    slot: "accessory",
    tier: 2,
    price: 750,
    description: "咒术师修行用的头带，提升专注力和咒力操控。",
    flavorText: "「束起头发，聚焦咒力——真正的战斗现在开始。」",
    statsBonus: { cursedEnergyControl: 7, cursedEnergy: 4 }
  },

  // ================================================================
  //  Tier 3 Bonus: 高级咒具（无主动效果，黑市可刷）
  // ================================================================

  dragonBoneBlade: {
    id: "dragonBoneBlade",
    name: "龙骨刀",
    type: "weapon",
    slot: "mainHand",
    tier: 3,
    price: 3000,
    description: "以远古龙种骨头制成的咒具，沉重但威力惊人。",
    flavorText: "「这骨头里还残留着龙的诅咒——每一刀都仿佛龙之咆哮。」",
    statsBonus: { martialArts: 18, constitution: 5 }
  },

  cursedEnergyGauntlet: {
    id: "cursedEnergyGauntlet",
    name: "咒力护手",
    type: "armor",
    slot: "offHand",
    tier: 3,
    price: 2800,
    description: "刻满防御符文的金属护手，大幅提升防御与咒力效率。",
    flavorText: "「五指上刻着五重结界——这护手本身就是一座移动的堡垒。」",
    statsBonus: { constitution: 14, cursedEnergyEfficiency: 8 }
  },

  splitSoulKatana: {
    id: "splitSoulKatana",
    name: "伏魔刀",
    type: "weapon",
    slot: "mainHand",
    tier: 3,
    price: 3800,
    description: "传说能斩断诅咒的太刀，接近特级咒具的品质。",
    flavorText: "「刀锋薄如纸，却能斩断一切不净。」",
    statsBonus: { martialArts: 16, cursedEnergy: 6, talent: 4 }
  },

  cursedWardingBeads: {
    id: "cursedWardingBeads",
    name: "咒封念珠",
    type: "accessory",
    slot: "accessory",
    tier: 3,
    price: 3200,
    description: "108颗咒力封入的念珠，全面强化咒术三围。",
    flavorText: "「每一颗念珠都封印着一条诅咒——佩戴者等于背负着108条诅咒。」",
    statsBonus: { cursedEnergy: 10, cursedEnergyControl: 8, cursedEnergyEfficiency: 6 }
  },

  // ================================================================
  //  Tier 3: 特效咒具（含主动 Buff）
  // ================================================================
  soulLiberationBlade: {
    id: "soulLiberationBlade",
    name: "释魂刀",
    type: "weapon",
    slot: "mainHand",
    tier: 3,
    price: 3500,
    description: "能直接攻击灵魂的咒具，对咒灵尤为致命——无视目标部分防御。",
    flavorText: "「斩的不是肉体，是灵魂。」——伏黑甚尔",
    statsBonus: { martialArts: 12, cursedEnergyControl: 8 },
    passiveEffect: { type: "ignore_defense", value: 0.30 }
  },

  invertedSpearOfHeaven: {
    id: "invertedSpearOfHeaven",
    name: "天逆鉾",
    type: "weapon",
    slot: "mainHand",
    tier: 3,
    price: 6000,
    description: "传说中能强制解除一切术式的特级咒具。攻击时无视对方的咒术防御和屏障。",
    flavorText: "「唯一的缺点——它不分敌我。」",
    statsBonus: { martialArts: 15, cursedEnergy: -5 },
    // Phase 18: 被动效果 — 攻击时无视术式防御
    passiveEffect: { type: "nullify_technique_defense", value: 1.0 }
  },

  rottenLifeBlade: {
    id: "rottenLifeBlade",
    name: "爛生刀",
    type: "weapon",
    slot: "mainHand",
    tier: 4,
    price: 8000,
    description: "特级咒具。击中后附带腐败诅咒——每20AV造成DOT伤害，伤害随触发逐渐衰减。",
    flavorText: "「腐败从不停止。它会一直侵蚀，直到什么都不剩。」",
    statsBonus: { martialArts: 14, cursedEnergy: 8 },
    // Phase 18: 主动效果 — 给对方挂腐败 DOT debuff
    activeEffect: {
      id: "rotten_life_dot",
      name: "爛生刀·腐败",
      type: "dot",
      initialDamage: 35,       // 首次 DOT 35 点
      decayPerTick: 5,         // 每触发一次 DOT 伤害 -5
      tickInterval: 20,        // 每 20 AV 触发
      duration: 200            // 持续 200 AV
    }
  },

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
