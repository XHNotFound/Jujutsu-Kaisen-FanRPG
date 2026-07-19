// js/data/skills.js — 技能树数据配置（Phase 4 新增）
// 定义每项术式的技能树：包含节点、castTime、recoverySpeed、升级消耗与效果

/**
 * 技能树数据结构：
 * {
 *   id: string,              // 技能唯一 ID
 *   name: string,            // 技能名称
 *   description: string,     // 技能描述
 *   type: "martial"|"cursed"|"movement",
 *   cost: number,            // 基础咒力消耗
 *   damageMultiplier: number,// 基础伤害倍率
 *   castTime: number,        // 咏唱时间（帧/tick）
 *   baseRecoverySpeed: number, // 基础补偿速度
 *   minDistance: number,     // 最低适用距离 (0-3)
 *   maxDistance: number,     // 最高适用距离 (0-3)
 *   isDefault: boolean,      // 是否初始解锁（true=自动获得）
 *   requires: string|null,   // 前置技能 ID（null=无条件）
 *   levelUpCosts: {          // 升级消耗
 *     level: number,         // 目标等级 (1-based)
 *     skillPoints: number,   // 技能点消耗
 *     proficiency: number    // 熟练度门槛
 *   }[],
 *   levelEffects: {          // 每级效果
 *     level: number,         // 等级 (1-based)
 *     damageMultiplier: number,
 *     cost: number,
 *     bonus: string          // 效果描述
 *   }[]
 * }
 */

export const SKILL_TREES = {
  // ================================================================
  //  无下限术式 (Limitless)
  // ================================================================
  limitless: [
    {
      id: "aoi",
      name: "苍",
      description: "术式顺转「苍」。操纵空间产生强大的吸引力，将一切卷入空之涡。",
      type: "cursed",
      cost: 15,
      damageMultiplier: 2.2,
      castTime: 20,
      baseRecoverySpeed: 25,
      minDistance: 0,   // 贴身
      maxDistance: 3,   // 远
      isDefault: true,  // 初始自动解锁
      requires: null,
      levelUpCosts: [
        { level: 2, skillPoints: 2, proficiency: 30 },
        { level: 3, skillPoints: 3, proficiency: 80 },
        { level: 4, skillPoints: 4, proficiency: 150 },
        { level: 5, skillPoints: 5, proficiency: 250 }
      ],
      levelEffects: [
        { level: 1, damageMultiplier: 2.2, cost: 15, bonus: "基础苍" },
        { level: 2, damageMultiplier: 2.5, cost: 14, bonus: "伤害 +0.3，消耗 -1" },
        { level: 3, damageMultiplier: 2.8, cost: 13, bonus: "伤害 +0.3，消耗 -1" },
        { level: 4, damageMultiplier: 3.2, cost: 12, bonus: "伤害 +0.4，消耗 -1" },
        { level: 5, damageMultiplier: 3.6, cost: 10, bonus: "伤害 +0.4，消耗 -2" }
      ]
    },
    {
      id: "aoi_strike",
      name: "苍·打击",
      description: "将「苍」凝缩至拳上，近身释放。威力集中但消耗更大。",
      type: "cursed",
      cost: 22,
      damageMultiplier: 3.0,
      castTime: 25,
      baseRecoverySpeed: 20,
      minDistance: 0,   // 贴身
      maxDistance: 0,   // 贴身
      isDefault: false,
      requires: "aoi",  // 需要「苍」解锁后
      levelUpCosts: [
        { level: 2, skillPoints: 3, proficiency: 40 },
        { level: 3, skillPoints: 4, proficiency: 100 },
        { level: 4, skillPoints: 5, proficiency: 180 }
      ],
      levelEffects: [
        { level: 1, damageMultiplier: 3.0, cost: 22, bonus: "基础苍·打击" },
        { level: 2, damageMultiplier: 3.5, cost: 20, bonus: "伤害 +0.5，消耗 -2" },
        { level: 3, damageMultiplier: 4.0, cost: 18, bonus: "伤害 +0.5，消耗 -2" },
        { level: 4, damageMultiplier: 4.6, cost: 16, bonus: "伤害 +0.6，消耗 -2" }
      ]
    },
    {
      id: "aka",
      name: "赫",
      description: "术式反转「赫」。排斥一切的术式，远程大范围攻击。",
      type: "cursed",
      cost: 25,
      damageMultiplier: 3.0,
      castTime: 30,
      baseRecoverySpeed: 18,
      minDistance: 1,   // 近
      maxDistance: 3,   // 远
      isDefault: false,
      requires: "aoi",  // 需要「苍」解锁后
      levelUpCosts: [
        { level: 2, skillPoints: 3, proficiency: 50 },
        { level: 3, skillPoints: 4, proficiency: 120 },
        { level: 4, skillPoints: 5, proficiency: 200 }
      ],
      levelEffects: [
        { level: 1, damageMultiplier: 3.0, cost: 25, bonus: "基础赫" },
        { level: 2, damageMultiplier: 3.4, cost: 23, bonus: "伤害 +0.4，消耗 -2" },
        { level: 3, damageMultiplier: 3.9, cost: 21, bonus: "伤害 +0.5，消耗 -2" },
        { level: 4, damageMultiplier: 4.5, cost: 19, bonus: "伤害 +0.6，消耗 -2" }
      ]
    }
  ],

  // ================================================================
  //  十种影法术 (Ten Shadows)
  // ================================================================
  tenShadows: [
    {
      id: "gyokuken",
      name: "玉犬",
      description: "召唤黑白玉犬撕咬目标。式神不会受伤，但需要持续的咒力维持。",
      type: "cursed",
      cost: 12,
      damageMultiplier: 1.6,
      castTime: 15,
      baseRecoverySpeed: 28,
      minDistance: 0,
      maxDistance: 1,   // 贴身~近
      isDefault: true,
      requires: null,
      levelUpCosts: [
        { level: 2, skillPoints: 2, proficiency: 25 },
        { level: 3, skillPoints: 3, proficiency: 70 },
        { level: 4, skillPoints: 4, proficiency: 140 },
        { level: 5, skillPoints: 5, proficiency: 220 }
      ],
      levelEffects: [
        { level: 1, damageMultiplier: 1.6, cost: 12, bonus: "基础玉犬" },
        { level: 2, damageMultiplier: 1.9, cost: 11, bonus: "伤害 +0.3，消耗 -1" },
        { level: 3, damageMultiplier: 2.2, cost: 10, bonus: "伤害 +0.3，消耗 -1" },
        { level: 4, damageMultiplier: 2.5, cost: 9,  bonus: "伤害 +0.3，消耗 -1" },
        { level: 5, damageMultiplier: 2.9, cost: 8,  bonus: "伤害 +0.4，消耗 -1" }
      ]
    },
    {
      id: "nue",
      name: "鵺",
      description: "召唤鵺从空中俯冲攻击。无视距离限制，附带麻痹效果（Phase 5+）。",
      type: "cursed",
      cost: 18,
      damageMultiplier: 2.0,
      castTime: 22,
      baseRecoverySpeed: 22,
      minDistance: 0,
      maxDistance: 3,   // 全距离
      isDefault: false,
      requires: "gyokuken",
      levelUpCosts: [
        { level: 2, skillPoints: 3, proficiency: 40 },
        { level: 3, skillPoints: 4, proficiency: 100 }
      ],
      levelEffects: [
        { level: 1, damageMultiplier: 2.0, cost: 18, bonus: "基础鵺" },
        { level: 2, damageMultiplier: 2.4, cost: 16, bonus: "伤害 +0.4，消耗 -2" },
        { level: 3, damageMultiplier: 2.8, cost: 14, bonus: "伤害 +0.4，消耗 -2" }
      ]
    }
  ],

  // ================================================================
  //  咒力强化术 (默认术式) — 简单技能树
  // ================================================================
  cursedEnergyBoost: [
    {
      id: "cursed_boost",
      name: "咒力强化拳",
      description: "以咒力强化拳击，朴实但有效。消耗咒力换取更高的近战伤害。",
      type: "cursed",
      cost: 10,
      damageMultiplier: 1.8,
      castTime: 12,
      baseRecoverySpeed: 28,
      minDistance: 0,
      maxDistance: 0,   // 贴身
      isDefault: true,
      requires: null,
      levelUpCosts: [
        { level: 2, skillPoints: 1, proficiency: 20 },
        { level: 3, skillPoints: 2, proficiency: 60 },
        { level: 4, skillPoints: 3, proficiency: 120 },
        { level: 5, skillPoints: 4, proficiency: 200 }
      ],
      levelEffects: [
        { level: 1, damageMultiplier: 1.8, cost: 10, bonus: "基础咒力强化拳" },
        { level: 2, damageMultiplier: 2.1, cost: 9,  bonus: "伤害 +0.3，消耗 -1" },
        { level: 3, damageMultiplier: 2.4, cost: 8,  bonus: "伤害 +0.3，消耗 -1" },
        { level: 4, damageMultiplier: 2.7, cost: 7,  bonus: "伤害 +0.3，消耗 -1" },
        { level: 5, damageMultiplier: 3.1, cost: 6,  bonus: "伤害 +0.4，消耗 -1" }
      ]
    }
  ]
};

// ================================================================
//  通用基础技能（不属于任何术式树，所有角色共用）
// ================================================================
export const BASE_SKILLS = {
  attack: {
    id: "attack",
    name: "体术平A",
    description: "基础体术攻击，不消耗咒力。所有咒术师的基本功。",
    type: "martial",
    cost: 0,
    damageMultiplier: 1.0,
    castTime: 5,
    baseRecoverySpeed: 30,
    minDistance: 0,
    maxDistance: 0,
    isDefault: true,
    requires: null,
    levelUpCosts: [
      { level: 2, skillPoints: 1, proficiency: 30 },
      { level: 3, skillPoints: 2, proficiency: 80 },
      { level: 4, skillPoints: 3, proficiency: 150 }
    ],
    levelEffects: [
      { level: 1, damageMultiplier: 1.0, cost: 0, bonus: "基础体术" },
      { level: 2, damageMultiplier: 1.2, cost: 0, bonus: "伤害 +0.2" },
      { level: 3, damageMultiplier: 1.4, cost: 0, bonus: "伤害 +0.2" },
      { level: 4, damageMultiplier: 1.7, cost: 0, bonus: "伤害 +0.3" }
    ]
  },
  advance: {
    id: "advance",
    name: "逼近",
    description: "向敌人逼近 1 档距离。",
    type: "movement",
    cost: 0,
    damageMultiplier: 0,
    castTime: 3,
    baseRecoverySpeed: 35,
    minDistance: 0,
    maxDistance: 3,
    isDefault: true,
    requires: null,
    levelUpCosts: [],
    levelEffects: [{ level: 1, damageMultiplier: 0, cost: 0, bonus: "" }]
  },
  retreat: {
    id: "retreat",
    name: "后退",
    description: "向后退开 1 档距离。",
    type: "movement",
    cost: 0,
    damageMultiplier: 0,
    castTime: 3,
    baseRecoverySpeed: 35,
    minDistance: 0,
    maxDistance: 3,
    isDefault: true,
    requires: null,
    levelUpCosts: [],
    levelEffects: [{ level: 1, damageMultiplier: 0, cost: 0, bonus: "" }]
  }
};

// ================================================================
//  辅助函数
// ================================================================

/**
 * 获取技能的当前等级数据
 * @param {string} skillId
 * @param {object} skillLevels — 存档中的技能等级映射 { "aoi": 2, "attack": 3, ... }
 * @returns {{ level: number, effect: object, nextCost: object|null }}
 */
export function getSkillLevelData(skillId, skillLevels = {}) {
  const level = skillLevels[skillId] || 1;

  // 搜索所有技能树 + 基础技能
  const allSkills = { ...BASE_SKILLS };
  for (const tree of Object.values(SKILL_TREES)) {
    for (const skill of tree) {
      allSkills[skill.id] = skill;
    }
  }

  const skillDef = allSkills[skillId];
  if (!skillDef) return { level: 1, effect: null, nextCost: null };

  const effect = skillDef.levelEffects.find(e => e.level === level) || skillDef.levelEffects[0];
  const nextCost = skillDef.levelUpCosts.find(c => c.level === level + 1) || null;

  return { level, effect, nextCost };
}

/**
 * 获取技能在当前等级下的完整配置（用于战斗系统）
 * @param {string} skillId
 * @param {object} skillLevels
 * @returns {object|null}
 */
export function getSkillConfig(skillId, skillLevels = {}) {
  const { level, effect } = getSkillLevelData(skillId, skillLevels);
  if (!effect) return null;

  const allSkills = { ...BASE_SKILLS };
  for (const tree of Object.values(SKILL_TREES)) {
    for (const skill of tree) {
      allSkills[skill.id] = skill;
    }
  }

  const def = allSkills[skillId];
  if (!def) return null;

  return {
    id: def.id,
    name: def.name,
    description: def.description,
    type: def.type,
    cost: effect.cost,
    damageMultiplier: effect.damageMultiplier,
    castTime: def.castTime,
    baseRecoverySpeed: def.baseRecoverySpeed,
    minDistance: def.minDistance,
    maxDistance: def.maxDistance,
    level
  };
}

/**
 * 获取指定术式的所有技能（基于解锁状态）
 * @param {string} techniqueId
 * @param {object} skillLevels
 * @returns {object[]}
 */
export function getAvailableSkills(techniqueId, skillLevels = {}) {
  const tree = SKILL_TREES[techniqueId] || [];
  const result = [];

  for (const skill of tree) {
    if (skill.isDefault) {
      result.push(getSkillConfig(skill.id, skillLevels));
    } else if (skill.requires && skillLevels[skill.requires]) {
      // 前置技能已解锁（至少有 1 级）
      result.push(getSkillConfig(skill.id, skillLevels));
    }
  }

  return result;
}
