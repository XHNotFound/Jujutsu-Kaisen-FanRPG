// js/data/npcs.js — NPC 数据配置（Phase 5 新增）
// 定义可请教的 NPC 及其行为

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
    ]
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
