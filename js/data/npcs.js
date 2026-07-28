// js/data/npcs.js — NPC 数据配置（Phase 5 新增 / Phase 9 扩展 / Phase 11 重构）
// 多功能 NPC 框架：支持请教(consult)、赠礼(gift)、任务(quest)、切磋(spar)
// 人情 (relationships) 按 NPC ID 独立存储

export const NPCS = [
  {
    id: "shoko",
    name: "家入硝子",
    description: "罕见的反转术式使用者，可以治疗伤势和清除残秽。",
    actions: [
      {
        id: "heal",
        type: "special",
        name: "治疗",
        description: "接受反转术式治疗。",
        cost: { money: 50, ap: 10 },
        effect: {
          type: "heal",
          hpRestore: "max",
          residualClearPct: 0.50,
        }
      },
      // Phase 12: 反转术式基础
      {
        id: "learn_rct_basics",
        type: "consult",
        name: "请教反转术式基础",
        description: "家入硝子是咒术界少有的反转术式输出者，向她请教反转术式的入门知识。解锁反转术式的前置条件。",
        cost: { ap: 30, relationship: 4 },
        effect: {
          type: "unlock_prerequisite",
          unlockKey: "rct_basics",
          description: "获得了反转术式的基础知识"
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
        type: "consult",
        name: "请教战斗技巧",
        description: "向七海请教战斗经验，提升体术相关熟练度。",
        cost: { ap: 20, relationship: 1 },
        effect: {
          type: "learn",
          targetSkills: ["attack"],
          proficiencyGain: 15,
          inspirationChance: 0.20
        }
      },
      {
        id: "learn_overtime_essence",
        type: "consult",
        name: "请教十划咒法精髓",
        description: "七海传授十划咒法的核心——7:3弱点制造。提升瓦解和比例打击的熟练度。",
        cost: { ap: 25, relationship: 2 },
        effect: {
          type: "learn",
          targetSkills: ["ratio_strike", "collapse"],
          proficiencyGain: 20,
          inspirationChance: 0.25,
          requireTechnique: "overtime"
        }
      },
      {
        id: "gift",
        type: "gift",
        name: "赠送礼物",
        description: "送一份体面的伴手礼，增加人情。",
        cost: { money: 100 },
        effect: { type: "gift", relationship: 2 }
      },
      {
        id: "spar",
        type: "spar",
        name: "切磋",
        description: "与七海进行模拟对战，测试你的实战能力。",
        cost: { ap: 20 },
        effect: { type: "spar", allyId: "nanami" }
      }
    ],
    battleAlly: {
      unitType: "ally",
      name: "七海建人",
      baseStats: { hp: 200, max_hp: 200, mp: 60, max_mp: 60, speed: 14, constitution: 18, martialArts: 28, cursedEnergy: 16, cursedEnergyControl: 18, cursedEnergyEfficiency: 14, talent: 16 },
      skills: [
        { id: "npc_nanami_attack", name: "体术打击", type: "martial", damageMultiplier: 1.8, cost: 0, castTime: 8, baseRecoverySpeed: 26, minDistance: 0, maxDistance: 0, description: "精准的体术攻击" },
        { id: "npc_nanami_overtime", name: "十划咒法", type: "cursed", damageMultiplier: 2.8, cost: 18, castTime: 20, baseRecoverySpeed: 20, minDistance: 0, maxDistance: 1, description: "7:3弱点打击" }
      ],
      aiBehavior: "balanced"
    }
  },
  {
    id: "gojo",
    name: "五条悟",
    description: "现代最强咒术师。虽然平时吊儿郎当，但偶尔会给出出人意料的指点。",
    actions: [
      {
        id: "learn_limitless",
        type: "consult",
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
      },
      // Phase 12: 五条悟也能教导反转术式（但要求最高人情）
      {
        id: "learn_rct_basics",
        type: "consult",
        name: "请教反转术式基础",
        description: "向五条悟请教反转术式的奥秘。五条老师本人也是反转术式的大师。",
        cost: { ap: 35, relationship: 5 },
        effect: {
          type: "unlock_prerequisite",
          unlockKey: "rct_basics",
          description: "获得了反转术式的基础知识"
        }
      },
      {
        id: "gift",
        type: "gift",
        name: "送甜食",
        description: "给五条老师买他最喜欢的甜食。",
        cost: { money: 150 },
        effect: { type: "gift", relationship: 2 }
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
        type: "consult",
        name: "请教基本功",
        description: "向日下部请教基础体术和咒力操控。",
        cost: { ap: 15, relationship: 1 },
        effect: {
          type: "learn",
          targetSkills: ["attack"],
          proficiencyGain: 10,
          inspirationChance: 0.10
        }
      },
      {
        id: "learn_simple_domain_basics",
        type: "consult",
        name: "请教简易领域基础",
        description: "日下部传授简易领域的入门知识。解锁简易领域的前置条件。",
        cost: { ap: 25, relationship: 3 },
        effect: {
          type: "unlock_prerequisite",
          unlockKey: "simple_domain_basics",
          description: "获得了简易领域的基础知识"
        }
      },
      {
        id: "gift",
        type: "gift",
        name: "赠送礼物",
        description: "给日下部带一份伴手礼。",
        cost: { money: 80 },
        effect: { type: "gift", relationship: 2 }
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
        type: "consult",
        name: "请教咒力理论",
        description: "与九十九由基探讨咒力本质，可能获得灵感。",
        cost: { ap: 20, relationship: 1 },
        effect: {
          type: "learn",
          targetSkills: ["cursed_boost", "boogie_punch"],
          proficiencyGain: 12,
          inspirationChance: 0.25
        }
      },
      {
        id: "gift",
        type: "gift",
        name: "赠送研究资料",
        description: "给由基送去珍贵的咒灵研究资料。",
        cost: { money: 120 },
        effect: { type: "gift", relationship: 2 }
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
        type: "consult",
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
      },
      {
        id: "spar",
        type: "spar",
        name: "切磋",
        description: "东堂最喜欢的方式——用拳头交流。",
        cost: { ap: 25 },
        effect: { type: "spar", allyId: "todo" }
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
        type: "consult",
        name: "请教速度",
        description: "向直毘人请教以速度取胜的战术。",
        cost: { ap: 20, relationship: 1 },
        effect: {
          type: "learn",
          targetSkills: ["attack", "advance", "retreat"],
          proficiencyGain: 12,
          inspirationChance: 0.15
        }
      },
      {
        id: "learn_falling_blossom_basics",
        type: "consult",
        name: "请教落花之情基础",
        description: "直毘人传授禅院家秘传——落花之情的入门知识。解锁落花之情的前置条件。",
        cost: { ap: 30, relationship: 3 },
        effect: {
          type: "unlock_prerequisite",
          unlockKey: "falling_blossom_basics",
          description: "获得了落花之情的基础知识"
        }
      },
      {
        id: "gift",
        type: "gift",
        name: "赠送清酒",
        description: "给直毘人送上他最喜欢的清酒。",
        cost: { money: 120 },
        effect: { type: "gift", relationship: 2 }
      }
    ]
  },
  {
    id: "kashimo",
    name: "鹿紫云一",
    description: "四百年前的最强咒术师。虽然看起来冷漠，但对强者愿意交流心得。",
    actions: [
      {
        id: "learn_hollow_wicker_basics",
        type: "consult",
        name: "请教弥虚葛笼基础",
        description: "鹿紫云一传授结界术最高秘义——弥虚葛笼的入门知识。解锁弥虚葛笼的前置条件。",
        cost: { ap: 35, relationship: 4 },
        effect: {
          type: "unlock_prerequisite",
          unlockKey: "hollow_wicker_basics",
          description: "获得了弥虚葛笼的基础知识"
        }
      },
      {
        id: "gift",
        type: "gift",
        name: "赠送珍稀咒物",
        description: "将你祓除咒灵获得的稀有咒物赠给鹿紫云一。",
        cost: { money: 200 },
        effect: { type: "gift", relationship: 3 }
      }
    ]
  },
  {
    id: "mei_mei",
    name: "冥冥",
    description: "自由咒术师，以金钱衡量一切。可以用金钱换取她的人脉与情报。",
    actions: [
      {
        id: "learn_intel",
        type: "consult",
        name: "情报交换",
        description: "用金钱向冥冥购买咒术界的情报，可能获得灵感。",
        cost: { ap: 15, money: 200 },
        effect: {
          type: "learn",
          targetSkills: ["cursed_boost"],
          proficiencyGain: 8,
          inspirationChance: 0.35
        }
      },
      {
        id: "gift",
        type: "gift",
        name: "直接给钱",
        description: "冥冥对金钱从不拒绝。",
        cost: { money: 300 },
        effect: { type: "gift", relationship: 3 }
      }
    ]
  },
  {
    id: "geto",
    name: "夏油杰",
    description: "咒灵操术的使用者。虽已叛离咒术界，但仍可在暗中找到他。",
    actions: [
      {
        id: "learn_curse_manipulation",
        type: "consult",
        name: "请教咒灵操术",
        description: "向夏油请教咒灵操术的奥秘。仅限咒灵操术持有者。",
        cost: { ap: 25, relationship: 2 },
        effect: {
          type: "learn",
          targetSkills: ["curse_absorb", "curse_sphere", "uzumaki_pseudo"],
          proficiencyGain: 18,
          inspirationChance: 0.25,
          requireTechnique: "curseManipulation"
        }
      }
    ]
  },
  // Phase 12: 乙骨忧太 — 反转术式入门导师
  {
    id: "yuta",
    name: "乙骨忧太",
    description: "特级咒术师，反转术式的天赋使用者。在战斗中受伤时能瞬间以反转术式愈合。",
    actions: [
      {
        id: "learn_rct_basics",
        type: "consult",
        name: "请教反转术式基础",
        description: "向乙骨忧太请教反转术式的入门知识。他是最擅长教导反转术式的咒术师之一。解锁反转术式的前置条件。",
        cost: { ap: 25, relationship: 3 },
        effect: {
          type: "unlock_prerequisite",
          unlockKey: "rct_basics",
          description: "获得了反转术式的基础知识"
        }
      },
      {
        id: "gift",
        type: "gift",
        name: "赠送咒物",
        description: "将你在祓除咒灵中获得的稀有咒物赠给乙骨。",
        cost: { money: 150 },
        effect: { type: "gift", relationship: 2 }
      }
    ]
  },
  // Phase 18: 秤金次 — 黑市解锁 NPC
  {
    id: "hakari",
    name: "秤金次",
    description: "东京校三年生，坐杀博徒的持有者。拥有独特的地下咒具交易渠道——黑市的看门人。",
    actions: [
      {
        id: "learn_gambling_lore",
        type: "consult",
        name: "请教坐杀博徒奥义",
        description: "向秤金次请教坐杀博徒的进阶技巧。仅限坐杀博徒术式持有者。",
        cost: { ap: 25, relationship: 2 },
        effect: {
          type: "learn",
          targetSkills: ["steel_ball", "gambling_door"],
          proficiencyGain: 18,
          inspirationChance: 0.20,
          requireTechnique: "hakariGambling"
        }
      },
      {
        id: "gift",
        type: "gift",
        name: "下注（送礼）",
        description: "陪秤金次玩一把。赌注越大，人情越深。",
        cost: { money: 200 },
        effect: { type: "gift", relationship: 3 }
      },
      {
        id: "unlock_black_market",
        type: "consult",
        name: "打听地下渠道",
        description: "和秤金次混熟了以后，他会透露一些地下咒具交易的情报……解锁黑市系统。",
        cost: { ap: 20, relationship: 10 },
        effect: {
          type: "unlock_prerequisite",
          unlockKey: "black_market",
          description: "获得了黑市的入口"
        }
      }
    ]
  }
];

// ================================================================
//  Phase 9: 友方 NPC 战斗助战配置
// ================================================================

export const NPC_ALLY_CONFIGS = {
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
    aiBehavior: "balanced",
    joinCondition: null
  },

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
    joinCondition: null
  },

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
