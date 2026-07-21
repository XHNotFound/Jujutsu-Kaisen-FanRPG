// js/data/npcs.js — NPC 数据配置（Phase 5 新增 / Phase 9 扩展）
// 定义可请教的 NPC 及其行为、主线助战配置

export const NPCS = [
  {
    id: "shoko",
    name: "家入硝子",
    description: "罕见的反转术式使用者，可以治疗伤势和清除残秽。",
    actions: [
      {
        id: "heal",
        name: "治疗",
        description: "接受反转术式治疗。",
        cost: { money: 50, ap: 10 },
        effect: {
          type: "heal",
          hpRestore: "max",          // 恢复至满
          residualClearPct: 0.50,     // 清除 50% 残秽
        }
      }
    ]
  },
  {
    id: "nanami",
    name: "七海建人",
    description: "一级咒术师，战斗经验丰富，可以请教实战技巧。",
    actions: [
      {
        id: "learn_combat",
        name: "请教战斗",
        description: "向七海请教战斗经验，提升体术相关熟练度。",
        cost: { ap: 20, relationship: 1 },
        effect: {
          type: "learn",
          targetSkills: ["attack"],
          proficiencyGain: 15,
          inspirationChance: 0.20
        }
      }
    ],
    // Phase 9: 战斗助战配置（主线任务 NPC 加入队伍）
    battleAlly: {
      unitType: "ally",
      name: "七海建人",
      baseStats: { hp: 200, max_hp: 200, mp: 60, max_mp: 60, speed: 14, constitution: 18, martialArts: 28, cursedEnergy: 16, cursedEnergyControl: 18, cursedEnergyEfficiency: 14, talent: 16 },
      skills: [
        { id: "npc_nanami_attack", name: "体术打击", type: "martial", damageMultiplier: 1.8, cost: 0, castTime: 8, baseRecoverySpeed: 26, minDistance: 0, maxDistance: 0, description: "精准的体术攻击" },
        { id: "npc_nanami_overtime", name: "十划咒法", type: "cursed", damageMultiplier: 2.8, cost: 18, castTime: 20, baseRecoverySpeed: 20, minDistance: 0, maxDistance: 1, description: "7:3弱点打击" }
      ],
      aiBehavior: "balanced"  // "aggressive" | "defensive" | "balanced" | "support"
    }
  },
  {
    id: "gojo",
    name: "五条悟",
    description: "现代最强咒术师。虽然平时吊儿郎当，但偶尔会给出出人意料的指点。",
    actions: [
      {
        id: "learn_limitless",
        name: "请教无下限",
        description: "向五条悟请教无下限术式的精髓。仅限无下限术式持有者。",
        cost: { ap: 25, relationship: 2 },
        effect: {
          type: "learn",
          targetSkills: ["aoi", "aka"],
          proficiencyGain: 20,
          inspirationChance: 0.30,
          requireTechnique: "limitless"
        }
      }
    ]
  },
  {
    id: "kusakabe",
    name: "日下部",
    description: "新·阴流的高手，擅长简易领域和基本功。",
    actions: [
      {
        id: "learn_basics",
        name: "请教基本功",
        description: "向日下部请教基础体术和咒力操控。",
        cost: { ap: 15, relationship: 1 },
        effect: {
          type: "learn",
          targetSkills: ["attack"],
          proficiencyGain: 10,
          inspirationChance: 0.10
        }
      }
    ]
  },
  {
    id: "yuki",
    name: "九十九由基",
    description: "特级咒术师之一，对咒力的本质有独特见解。",
    actions: [
      {
        id: "learn_theory",
        name: "请教咒力理论",
        description: "与九十九由基探讨咒力本质，可能获得灵感。",
        cost: { ap: 20, relationship: 1 },
        effect: {
          type: "learn",
          targetSkills: ["cursed_boost", "boogie_punch"],
          proficiencyGain: 12,
          inspirationChance: 0.25
        }
      }
    ]
  },
  {
    id: "todo",
    name: "东堂葵",
    description: "京都校三年生，不义游戏的持有者，狂热的高田粉丝。",
    actions: [
      {
        id: "learn_boogie",
        name: "请教不义游戏",
        description: "向东堂请教不义游戏的使用技巧。",
        cost: { ap: 20, relationship: 1 },
        effect: {
          type: "learn",
          targetSkills: ["boogie_punch"],
          proficiencyGain: 18,
          inspirationChance: 0.15,
          requireTechnique: "boogieWoogie"
        }
      }
    ]
  },
  {
    id: "naobito",
    name: "禅院直毘人",
    description: "禅院家当主，投射咒法的使用者，速度是其最大的武器。",
    actions: [
      {
        id: "learn_speed",
        name: "请教速度",
        description: "向直毘人请教以速度取胜的战术。",
        cost: { ap: 20, relationship: 1 },
        effect: {
          type: "learn",
          targetSkills: ["attack", "advance", "retreat"],
          proficiencyGain: 12,
          inspirationChance: 0.15
        }
      }
    ]
  }
];

// ================================================================
//  Phase 9: 友方 NPC 战斗助战配置
//  主线任务中 NPC 临时加入队伍时的战斗 Unit 配置
//  注意：这些是数据配置，不包含任何战斗逻辑，逻辑在 Python 引擎中
// ================================================================

export const NPC_ALLY_CONFIGS = {
  // 七海建人助战
  nanami: {
    unitType: "ally",
    name: "七海建人",
    portrait: "nanami",
    baseStats: {
      hp: 200, max_hp: 200,
      mp: 60, max_mp: 60,
      speed: 14,
      constitution: 18,
      martialArts: 28,
      cursedEnergy: 16,
      cursedEnergyControl: 18,
      cursedEnergyEfficiency: 14,
      talent: 16
    },
    skills: [
      {
        id: "npc_nanami_attack", name: "体术打击", type: "martial",
        damageMultiplier: 1.8, cost: 0, castTime: 8, baseRecoverySpeed: 26,
        minDistance: 0, maxDistance: 0,
        description: "精准的体术攻击"
      },
      {
        id: "npc_nanami_overtime", name: "十划咒法", type: "cursed",
        damageMultiplier: 2.8, cost: 18, castTime: 20, baseRecoverySpeed: 20,
        minDistance: 0, maxDistance: 1,
        description: "以7:3的比例强制制造弱点进行打击"
      }
    ],
    aiBehavior: "balanced",   // aggressive / defensive / balanced / support
    joinCondition: null       // 暂不实现具体触发条件，预留给主线系统
  },

  // 五条悟（极少数剧情战斗助战）
  gojo: {
    unitType: "ally",
    name: "五条悟",
    portrait: "gojo",
    baseStats: {
      hp: 500, max_hp: 500,
      mp: 200, max_mp: 200,
      speed: 20,
      constitution: 30,
      martialArts: 40,
      cursedEnergy: 35,
      cursedEnergyControl: 40,
      cursedEnergyEfficiency: 30,
      talent: 35
    },
    skills: [
      {
        id: "npc_gojo_attack", name: "苍", type: "cursed",
        damageMultiplier: 4.0, cost: 15, castTime: 15, baseRecoverySpeed: 24,
        minDistance: 0, maxDistance: 3,
        description: "术式顺转·苍"
      },
      {
        id: "npc_gojo_aka", name: "赫", type: "cursed",
        damageMultiplier: 5.0, cost: 25, castTime: 22, baseRecoverySpeed: 18,
        minDistance: 1, maxDistance: 3,
        description: "术式反转·赫"
      },
      {
        id: "npc_gojo_punch", name: "近身体术", type: "martial",
        damageMultiplier: 2.5, cost: 0, castTime: 5, baseRecoverySpeed: 28,
        minDistance: 0, maxDistance: 0,
        description: "六眼加持下的精准体术"
      }
    ],
    aiBehavior: "aggressive",
    joinCondition: null       // 预留给关键剧情战斗
  },

  // 东堂葵助战
  todo: {
    unitType: "ally",
    name: "东堂葵",
    portrait: "todo",
    baseStats: {
      hp: 250, max_hp: 250,
      mp: 50, max_mp: 50,
      speed: 16,
      constitution: 22,
      martialArts: 32,
      cursedEnergy: 14,
      cursedEnergyControl: 16,
      cursedEnergyEfficiency: 12,
      talent: 18
    },
    skills: [
      {
        id: "npc_todo_punch", name: "重拳", type: "martial",
        damageMultiplier: 2.2, cost: 0, castTime: 8, baseRecoverySpeed: 26,
        minDistance: 0, maxDistance: 0,
        description: "以一力降十会的重拳"
      },
      {
        id: "npc_todo_swap", name: "拍手换位", type: "cursed",
        damageMultiplier: 1.5, cost: 6, castTime: 6, baseRecoverySpeed: 30,
        minDistance: 0, maxDistance: 3,
        description: "拍手交换位置，扰乱敌阵"
      }
    ],
    aiBehavior: "aggressive",
    joinCondition: null
  }
};

/**
 * 根据 NPC ID 获取助战 Unit 配置（纯数据，不涉及 DOM/逻辑）
 * @param {string} npcId
 * @returns {object|null}
 */
export function getNPCAllyConfig(npcId) {
  return NPC_ALLY_CONFIGS[npcId] || null;
}

/**
 * 获取所有可助战的 NPC ID 列表
 * @returns {string[]}
 */
export function getAvailableAllyIds() {
  return Object.keys(NPC_ALLY_CONFIGS);
}
