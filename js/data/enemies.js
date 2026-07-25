// js/data/enemies.js — 敌人数据配置（Phase 8 扩展）
// 定义中低级咒灵属性和战后奖励

/**
 * 敌人数据结构：
 * {
 *   id, name, rank(评定等级), tier("normal"|"elite"|"boss"),
 *   baseStats: { hp, max_hp, mp, max_mp, speed, constitution, martialArts, cursed_energy, cursed_energy_control, cursed_energy_efficiency, talent },
 *   skills: Array<{ id, name, cost, type, damageMultiplier, castTime, baseRecoverySpeed, minDistance, maxDistance }>,
 *   rewards: { money: {min,max}, skillExp: number, skillPoints: number, inspirationChance: number }
 * }
 */

export const ENEMIES = {
  normal: [
    {
      id: "enemy_flyhead",
      name: "蛸头",
      rank: "不入流",
      tier: "normal",
      baseStats: { hp: 50, max_hp: 50, mp: 0, max_mp: 0, speed: 7, constitution: 6, martial_arts: 8, cursed_energy: 0, cursed_energy_control: 0, cursed_energy_efficiency: 0, talent: 3 },
      skills: [{ id: "enemy_bite", name: "撕咬", cost: 0, type: "martial", damageMultiplier: 1.0, castTime: 8, baseRecoverySpeed: 28, minDistance: 0, maxDistance: 0 }],
      // Phase 14: 逃跑基础概率 (0-100)
        basic: { name: "初级情报", price: 30, description: "显示蛸头的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 60, description: "显示蛸头的技能列表及伤害倍率。" },
        advanced: { name: "高级情报", price: 150, description: "蛸头没有高级技巧——它太低级了。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 80,
      rewards: { money: { min: 10, max: 30 }, skillExp: 3, skillPoints: 1, inspirationChance: 0.05 }
    },
    {
      id: "enemy_cursed_doll",
      name: "咒骸",
      rank: "四级",
      tier: "normal",
      baseStats: { hp: 80, max_hp: 80, mp: 15, max_mp: 15, speed: 8, constitution: 10, martial_arts: 12, cursed_energy: 6, cursed_energy_control: 5, cursed_energy_efficiency: 5, talent: 5 },
      skills: [
        { id: "enemy_punch", name: "重拳", cost: 0, type: "martial", damageMultiplier: 1.0, castTime: 8, baseRecoverySpeed: 28, minDistance: 0, maxDistance: 0 },
        { id: "enemy_cursed_bolt", name: "诅咒弹", cost: 6, type: "cursed", damageMultiplier: 1.3, castTime: 16, baseRecoverySpeed: 22, minDistance: 1, maxDistance: 3 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 35, description: "显示咒骸的基础属性。" },
        skill: { name: "技能情报", price: 70, description: "显示咒骸的技能：重拳和诅咒弹。" },
        advanced: { name: "高级情报", price: 120, description: "咒骸为四级诅咒人偶，无高级技巧。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 70,
      rewards: { money: { min: 30, max: 60 }, skillExp: 5, skillPoints: 1, inspirationChance: 0.08 }
    },
    {
      id: "enemy_centipede",
      name: "百足咒灵",
      rank: "准三级",
      tier: "normal",
      baseStats: { hp: 100, max_hp: 100, mp: 20, max_mp: 20, speed: 9, constitution: 12, martial_arts: 14, cursed_energy: 8, cursed_energy_control: 8, cursed_energy_efficiency: 6, talent: 8 },
      skills: [
        { id: "enemy_swipe", name: "横扫", cost: 0, type: "martial", damageMultiplier: 1.0, castTime: 6, baseRecoverySpeed: 30, minDistance: 0, maxDistance: 1 },
        { id: "enemy_poison_spit", name: "毒液喷射", cost: 8, type: "cursed", damageMultiplier: 1.5, castTime: 18, baseRecoverySpeed: 20, minDistance: 1, maxDistance: 3 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 40, description: "显示百足咒灵的基础属性。" },
        skill: { name: "技能情报", price: 80, description: "显示百足咒灵的技能：横扫和毒液喷射。" },
        advanced: { name: "高级情报", price: 130, description: "百足咒灵为准三级，拥有远程毒液攻击。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 70,
      rewards: { money: { min: 40, max: 80 }, skillExp: 8, skillPoints: 2, inspirationChance: 0.10 }
    },
    {
      id: "enemy_shadow_beast",
      name: "影兽",
      rank: "三级",
      tier: "normal",
      baseStats: { hp: 130, max_hp: 130, mp: 30, max_mp: 30, speed: 10, constitution: 14, martial_arts: 16, cursed_energy: 10, cursed_energy_control: 10, cursed_energy_efficiency: 8, talent: 10 },
      skills: [
        { id: "enemy_claw", name: "影爪", cost: 0, type: "martial", damageMultiplier: 1.2, castTime: 5, baseRecoverySpeed: 30, minDistance: 0, maxDistance: 0 },
        { id: "enemy_shadow_bolt", name: "暗影弹", cost: 12, type: "cursed", damageMultiplier: 1.8, castTime: 20, baseRecoverySpeed: 18, minDistance: 0, maxDistance: 3 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 40, description: "显示影兽的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 80, description: "显示影兽的技能：影爪和暗影弹。" },
        advanced: { name: "高级情报", price: 140, description: "影兽为三级咒灵，善用暗影系攻击。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 60,
      rewards: { money: { min: 60, max: 120 }, skillExp: 12, skillPoints: 2, inspirationChance: 0.12 }
    },
    {
      id: "enemy_blood_ghost",
      name: "血涂灵",
      rank: "准二级",
      tier: "normal",
      baseStats: { hp: 160, max_hp: 160, mp: 40, max_mp: 40, speed: 11, constitution: 16, martial_arts: 18, cursed_energy: 12, cursed_energy_control: 12, cursed_energy_efficiency: 10, talent: 12 },
      skills: [
        { id: "enemy_blood_strike", name: "血击", cost: 0, type: "martial", damageMultiplier: 1.1, castTime: 6, baseRecoverySpeed: 28, minDistance: 0, maxDistance: 1 },
        { id: "enemy_blood_spear", name: "血矛", cost: 15, type: "cursed", damageMultiplier: 2.0, castTime: 22, baseRecoverySpeed: 16, minDistance: 0, maxDistance: 3 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 42, description: "显示血涂灵的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 85, description: "显示血涂灵的技能：血击和血矛。" },
        advanced: { name: "高级情报", price: 140, description: "血涂灵为准二级咒灵，血系攻击伤害较高。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 60,
      rewards: { money: { min: 80, max: 150 }, skillExp: 15, skillPoints: 2, inspirationChance: 0.15 }
    },
    {
      id: "enemy_iron_curse",
      name: "铁甲咒灵",
      rank: "二级",
      tier: "normal",
      baseStats: { hp: 200, max_hp: 200, mp: 50, max_mp: 50, speed: 12, constitution: 20, martial_arts: 20, cursed_energy: 14, cursed_energy_control: 14, cursed_energy_efficiency: 12, talent: 14 },
      skills: [
        { id: "enemy_iron_fist", name: "铁拳", cost: 0, type: "martial", damageMultiplier: 1.3, castTime: 7, baseRecoverySpeed: 26, minDistance: 0, maxDistance: 0 },
        { id: "enemy_iron_cannon", name: "铁甲炮", cost: 20, type: "cursed", damageMultiplier: 2.2, castTime: 25, baseRecoverySpeed: 14, minDistance: 0, maxDistance: 3 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 45, description: "显示铁甲咒灵的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 90, description: "显示铁甲咒灵的技能：铁拳和铁甲炮。" },
        advanced: { name: "高级情报", price: 150, description: "铁甲咒灵为二级咒灵，防御较高且伤害可观。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 50,
      rewards: { money: { min: 100, max: 200 }, skillExp: 20, skillPoints: 3, inspirationChance: 0.18 }
    },
    // ================================================================
    //  Phase 11: 新增三级到一级普通咒灵（8种，不含领域）
    // ================================================================
    {
      id: "enemy_kuchisake",
      name: "裂口女",
      rank: "二级",
      tier: "normal",
      baseStats: { hp: 220, max_hp: 220, mp: 40, max_mp: 40, speed: 13, constitution: 18, martial_arts: 22, cursed_energy: 16, cursed_energy_control: 14, cursed_energy_efficiency: 12, talent: 15 },
      skills: [
        { id: "enemy_scissor_slash", name: "剪刀斩", cost: 0, type: "martial", damageMultiplier: 1.5, castTime: 6, baseRecoverySpeed: 28, minDistance: 0, maxDistance: 0 },
        { id: "enemy_kuchisake_question", name: "裂口质问", cost: 15, type: "cursed", damageMultiplier: 2.0, castTime: 18, baseRecoverySpeed: 20, minDistance: 0, maxDistance: 2 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 45, description: "显示裂口女的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 90, description: "显示裂口女的技能：剪刀斩和裂口质问。" },
        advanced: { name: "高级情报", price: 150, description: "裂口女为二级咒灵，伤害极高但防御偏弱。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 50,
      rewards: { money: { min: 120, max: 220 }, skillExp: 22, skillPoints: 3, inspirationChance: 0.20 }
    },
    {
      id: "enemy_hanako",
      name: "花子",
      rank: "二级",
      tier: "normal",
      baseStats: { hp: 190, max_hp: 190, mp: 60, max_mp: 60, speed: 15, constitution: 16, martial_arts: 18, cursed_energy: 20, cursed_energy_control: 18, cursed_energy_efficiency: 14, talent: 16 },
      skills: [
        { id: "enemy_toilet_curse", name: "厕所诅咒", cost: 0, type: "martial", damageMultiplier: 1.2, castTime: 8, baseRecoverySpeed: 26, minDistance: 0, maxDistance: 1 },
        { id: "enemy_water_blade", name: "水刃", cost: 18, type: "cursed", damageMultiplier: 2.2, castTime: 20, baseRecoverySpeed: 18, minDistance: 1, maxDistance: 3 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 45, description: "显示花子的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 90, description: "显示花子的技能：厕所诅咒和水刃。" },
        advanced: { name: "高级情报", price: 150, description: "花子为二级咒灵，诅咒能量较高，善用水系攻击。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 50,
      rewards: { money: { min: 110, max: 210 }, skillExp: 20, skillPoints: 3, inspirationChance: 0.18 }
    },
    {
      id: "enemy_rokurokubi",
      name: "辘轳首",
      rank: "准一级",
      tier: "normal",
      baseStats: { hp: 260, max_hp: 260, mp: 70, max_mp: 70, speed: 14, constitution: 20, martial_arts: 24, cursed_energy: 20, cursed_energy_control: 18, cursed_energy_efficiency: 14, talent: 17 },
      skills: [
        { id: "enemy_neck_whip", name: "长颈鞭", cost: 0, type: "martial", damageMultiplier: 1.4, castTime: 7, baseRecoverySpeed: 28, minDistance: 0, maxDistance: 2 },
        { id: "enemy_gaze_curse", name: "凝视诅咒", cost: 20, type: "cursed", damageMultiplier: 2.5, castTime: 22, baseRecoverySpeed: 16, minDistance: 1, maxDistance: 3 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 46, description: "显示辘轳首的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 92, description: "显示辘轳首的技能：长颈鞭和凝视诅咒。" },
        advanced: { name: "高级情报", price: 150, description: "辘轳首为准一级咒灵，攻击范围大且伤害较高。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 40,
      rewards: { money: { min: 150, max: 280 }, skillExp: 28, skillPoints: 4, inspirationChance: 0.22 }
    },
    {
      id: "enemy_jorogumo",
      name: "络新妇",
      rank: "准一级",
      tier: "normal",
      baseStats: { hp: 240, max_hp: 240, mp: 80, max_mp: 80, speed: 16, constitution: 18, martial_arts: 22, cursed_energy: 22, cursed_energy_control: 20, cursed_energy_efficiency: 16, talent: 18 },
      skills: [
        { id: "enemy_web_trap", name: "蛛网陷阱", cost: 0, type: "martial", damageMultiplier: 1.3, castTime: 8, baseRecoverySpeed: 26, minDistance: 0, maxDistance: 2 },
        { id: "enemy_venom_string", name: "毒丝", cost: 22, type: "cursed", damageMultiplier: 2.8, castTime: 24, baseRecoverySpeed: 14, minDistance: 0, maxDistance: 3 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 46, description: "显示络新妇的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 92, description: "显示络新妇的技能：蛛网陷阱和毒丝。" },
        advanced: { name: "高级情报", price: 155, description: "络新妇为准一级咒灵，善用毒素和远程攻击。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 40,
      rewards: { money: { min: 160, max: 300 }, skillExp: 30, skillPoints: 4, inspirationChance: 0.24 }
    },
    {
      id: "enemy_ubume",
      name: "姑获鸟",
      rank: "一级",
      tier: "normal",
      baseStats: { hp: 300, max_hp: 300, mp: 90, max_mp: 90, speed: 17, constitution: 22, martial_arts: 26, cursed_energy: 24, cursed_energy_control: 22, cursed_energy_efficiency: 18, talent: 20 },
      skills: [
        { id: "enemy_bird_talon", name: "利爪", cost: 0, type: "martial", damageMultiplier: 1.6, castTime: 6, baseRecoverySpeed: 28, minDistance: 0, maxDistance: 1 },
        { id: "enemy_screech", name: "啼鸣诅咒", cost: 25, type: "cursed", damageMultiplier: 3.0, castTime: 26, baseRecoverySpeed: 14, minDistance: 0, maxDistance: 3 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 48, description: "显示姑获鸟的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 95, description: "显示姑获鸟的技能：利爪和啼鸣诅咒。" },
        advanced: { name: "高级情报", price: 155, description: "姑获鸟为一级咒灵，速度和攻击力均为上乘。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 40,
      rewards: { money: { min: 200, max: 380 }, skillExp: 35, skillPoints: 5, inspirationChance: 0.26 }
    },
    {
      id: "enemy_nurarihyon",
      name: "滑瓢",
      rank: "一级",
      tier: "normal",
      baseStats: { hp: 320, max_hp: 320, mp: 85, max_mp: 85, speed: 16, constitution: 24, martial_arts: 28, cursed_energy: 22, cursed_energy_control: 24, cursed_energy_efficiency: 20, talent: 19 },
      skills: [
        { id: "enemy_sneak_strike", name: "潜行一击", cost: 0, type: "martial", damageMultiplier: 1.7, castTime: 7, baseRecoverySpeed: 28, minDistance: 0, maxDistance: 0 },
        { id: "enemy_dark_mist", name: "黑雾侵蚀", cost: 28, type: "cursed", damageMultiplier: 3.2, castTime: 28, baseRecoverySpeed: 12, minDistance: 0, maxDistance: 3 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 48, description: "显示滑瓢的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 95, description: "显示滑瓢的技能：潜行一击和黑雾侵蚀。" },
        advanced: { name: "高级情报", price: 155, description: "滑瓢为一级咒灵，伤害极高，拥有暗属性攻击。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 40,
      rewards: { money: { min: 220, max: 400 }, skillExp: 38, skillPoints: 5, inspirationChance: 0.28 }
    },
    {
      id: "enemy_gyuki",
      name: "牛鬼",
      rank: "一级",
      tier: "normal",
      baseStats: { hp: 350, max_hp: 350, mp: 70, max_mp: 70, speed: 13, constitution: 28, martial_arts: 30, cursed_energy: 20, cursed_energy_control: 20, cursed_energy_efficiency: 16, talent: 17 },
      skills: [
        { id: "enemy_horn_charge", name: "牛角冲撞", cost: 0, type: "martial", damageMultiplier: 1.8, castTime: 10, baseRecoverySpeed: 24, minDistance: 0, maxDistance: 2 },
        { id: "enemy_breath_fire", name: "鬼火吐息", cost: 30, type: "cursed", damageMultiplier: 3.5, castTime: 30, baseRecoverySpeed: 10, minDistance: 0, maxDistance: 3 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 48, description: "显示牛鬼的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 95, description: "显示牛鬼的技能：牛角冲撞和鬼火吐息。" },
        advanced: { name: "高级情报", price: 155, description: "牛鬼为一级咒灵，血厚攻高但速度偏慢。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 40,
      rewards: { money: { min: 250, max: 450 }, skillExp: 40, skillPoints: 5, inspirationChance: 0.30 }
    },
    {
      id: "enemy_gashadokuro",
      name: "饿者骷髅",
      rank: "一级",
      tier: "normal",
      baseStats: { hp: 380, max_hp: 380, mp: 100, max_mp: 100, speed: 11, constitution: 30, martial_arts: 26, cursed_energy: 26, cursed_energy_control: 22, cursed_energy_efficiency: 18, talent: 18 },
      skills: [
        { id: "enemy_bone_crush", name: "骨碎", cost: 0, type: "martial", damageMultiplier: 1.9, castTime: 12, baseRecoverySpeed: 22, minDistance: 0, maxDistance: 1 },
        { id: "enemy_grave_wind", name: "墓场阴风", cost: 35, type: "cursed", damageMultiplier: 3.8, castTime: 32, baseRecoverySpeed: 10, minDistance: 0, maxDistance: 3 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 50, description: "显示饿者骷髅的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 100, description: "显示饿者骷髅的技能：骨碎和墓场阴风。" },
        advanced: { name: "高级情报", price: 160, description: "饿者骷髅为一级咒灵，HP极高且伤害恐怖。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 40,
      rewards: { money: { min: 280, max: 500 }, skillExp: 45, skillPoints: 6, inspirationChance: 0.32 }
    }
  ],

  elite: [
    {
      id: "enemy_cursed_womb",
      name: "咒胎",
      rank: "准一级",
      tier: "elite",
      baseStats: { hp: 300, max_hp: 300, mp: 80, max_mp: 80, speed: 14, constitution: 22, martial_arts: 24, cursed_energy: 18, cursed_energy_control: 18, cursed_energy_efficiency: 14, talent: 16 },
      skills: [
        { id: "enemy_womb_slam", name: "重压", cost: 0, type: "martial", damageMultiplier: 1.5, castTime: 10, baseRecoverySpeed: 24, minDistance: 0, maxDistance: 1 },
        { id: "enemy_womb_beam", name: "咒胎光束", cost: 20, type: "cursed", damageMultiplier: 2.5, castTime: 28, baseRecoverySpeed: 14, minDistance: 0, maxDistance: 3 },
        { id: "enemy_womb_roar", name: "咒胎咆哮", cost: 15, type: "cursed", damageMultiplier: 2.0, castTime: 22, baseRecoverySpeed: 16, minDistance: 1, maxDistance: 2 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 80, description: "显示咒胎的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 150, description: "显示咒胎的技能：重压、咒胎光束和咒胎咆哮。" },
        advanced: { name: "高级情报", price: 300, description: "咒胎为准一级精英咒灵，拥有三种技能，伤害不俗。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 30,
      rewards: { money: { min: 200, max: 400 }, skillExp: 30, skillPoints: 4, inspirationChance: 0.25 }
    },
    {
      id: "enemy_vengeful_spirit",
      name: "怨灵",
      rank: "一级",
      tier: "elite",
      baseStats: { hp: 400, max_hp: 400, mp: 100, max_mp: 100, speed: 16, constitution: 25, martial_arts: 26, cursed_energy: 22, cursed_energy_control: 22, cursed_energy_efficiency: 16, talent: 18 },
      skills: [
        { id: "enemy_vengeful_strike", name: "怨念击", cost: 0, type: "martial", damageMultiplier: 1.6, castTime: 8, baseRecoverySpeed: 24, minDistance: 0, maxDistance: 0 },
        { id: "enemy_vengeful_blast", name: "怨念爆破", cost: 25, type: "cursed", damageMultiplier: 3.0, castTime: 30, baseRecoverySpeed: 12, minDistance: 0, maxDistance: 3 },
        { id: "enemy_vengeful_curse", name: "深层诅咒", cost: 18, type: "cursed", damageMultiplier: 2.2, castTime: 24, baseRecoverySpeed: 14, minDistance: 0, maxDistance: 2 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 80, description: "显示怨灵的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 150, description: "显示怨灵的技能：怨念击、怨念爆破和深层诅咒。" },
        advanced: { name: "高级情报", price: 300, description: "怨灵为一级精英咒灵，怨念深厚，伤害极高。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 30,
      rewards: { money: { min: 300, max: 600 }, skillExp: 40, skillPoints: 5, inspirationChance: 0.30 }
    }
  ],

  boss: [
    {
      id: "enemy_special_grade",
      name: "特级咒灵",
      rank: "准特级",
      tier: "boss",
      baseStats: { hp: 600, max_hp: 600, mp: 200, max_mp: 200, speed: 18, constitution: 30, martial_arts: 32, cursed_energy: 28, cursed_energy_control: 28, cursed_energy_efficiency: 20, talent: 22 },
      skills: [
        { id: "boss_domain_fist", name: "领域之拳", cost: 0, type: "martial", damageMultiplier: 2.0, castTime: 12, baseRecoverySpeed: 22, minDistance: 0, maxDistance: 1 },
        { id: "boss_cursed_beam", name: "咒力光束", cost: 30, type: "cursed", damageMultiplier: 3.5, castTime: 30, baseRecoverySpeed: 12, minDistance: 0, maxDistance: 3 },
        { id: "boss_catastrophe", name: "灾厄降临", cost: 50, type: "cursed", damageMultiplier: 4.5, castTime: 40, baseRecoverySpeed: 8, minDistance: 0, maxDistance: 3 }
      ],
      intelData: {
        basic: { name: "初级情报", price: 150, description: "显示特级咒灵的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 300, description: "显示特级咒灵的技能：领域之拳、咒力光束和灾厄降临。" },
        advanced: { name: "高级情报", price: 500, description: "准特级BOSS，拥有领域级别的破坏力，灾厄降临伤害极高。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 15,
      rewards: { money: { min: 500, max: 1000 }, skillExp: 60, skillPoints: 8, inspirationChance: 0.50 }
    },
    // ================================================================
    //  Phase 10: 高阶具名咒灵
    //  技能通过 refId 引用 data/skills.js 中的玩家技能树
    //  level 表示等效等级，由引擎根据 levelEffects 换算实际数值
    //  领域配置 domainId 映射 data/domains.js
    // ================================================================
    {
      id: "boss_jogo",
      name: "漏瑚",
      rank: "特级",
      tier: "boss",
      baseStats: { hp: 700, max_hp: 700, mp: 250, max_mp: 250, speed: 20, constitution: 28, martial_arts: 30, cursed_energy: 32, cursed_energy_control: 30, cursed_energy_efficiency: 22, talent: 25 },
      skills: [
        { id: "boss_jogo_volcano", name: "火山弹", cost: 25, type: "cursed", damageMultiplier: 4.5, castTime: 24, baseRecoverySpeed: 14, minDistance: 0, maxDistance: 3 },
        { id: "boss_jogo_fire_eruption", name: "火炎柱", cost: 30, type: "cursed", damageMultiplier: 5.0, castTime: 28, baseRecoverySpeed: 12, minDistance: 0, maxDistance: 2 },
        { id: "boss_jogo_insect", name: "火虫", cost: 18, type: "cursed", damageMultiplier: 3.0, castTime: 16, baseRecoverySpeed: 18, minDistance: 1, maxDistance: 2 },
        { id: "boss_jogo_meteor", name: "极之番·陨", cost: 60, type: "cursed", damageMultiplier: 8.0, castTime: 50, baseRecoverySpeed: 6, minDistance: 0, maxDistance: 3 },
        { id: "boss_jogo_ember_slash", name: "灼烧击", cost: 0, type: "martial", damageMultiplier: 1.8, castTime: 8, baseRecoverySpeed: 24, minDistance: 0, maxDistance: 0 }
      ],
      domainId: "jogo_coffin",
      domainName: "盖棺铁围山",
      domainHp: 800,
      intelData: {
        basic: { name: "初级情报", price: 150, description: "显示漏瑚的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 300, description: "显示漏瑚的技能：火山弹、火炎柱、火虫、极之番·陨、灼烧击。" },
        advanced: { name: "高级情报", price: 500, description: "漏瑚拥有领域「盖棺铁围山」(HP 800)，掌握极之番·陨，火系咒术特化。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 10,
      rewards: { money: { min: 800, max: 1500 }, skillExp: 80, skillPoints: 10, inspirationChance: 0.60 }
    },
    {
      id: "boss_mahito",
      name: "真人",
      rank: "特级",
      tier: "boss",
      baseStats: { hp: 650, max_hp: 650, mp: 280, max_mp: 280, speed: 22, constitution: 24, martial_arts: 32, cursed_energy: 30, cursed_energy_control: 28, cursed_energy_efficiency: 24, talent: 28 },
      skills: [
        { id: "boss_mahito_touch", name: "无为转变", cost: 30, type: "cursed", damageMultiplier: 3.5, castTime: 22, baseRecoverySpeed: 16, minDistance: 0, maxDistance: 0 },
        { id: "boss_mahito_morph", name: "肉体变形", cost: 15, type: "cursed", damageMultiplier: 2.5, castTime: 15, baseRecoverySpeed: 22, minDistance: 0, maxDistance: 1 },
        { id: "boss_mahito_dolls", name: "改造人偶", cost: 25, type: "cursed", damageMultiplier: 2.8, castTime: 20, baseRecoverySpeed: 18, minDistance: 0, maxDistance: 3 }
      ],
      domainId: "mahito_self_embodiment",
      domainName: "自闭圆顿裹",
      domainHp: 700,
      intelData: {
        basic: { name: "初级情报", price: 150, description: "显示真人的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 300, description: "显示真人的技能：无为转变、肉体变形和改造人偶。" },
        advanced: { name: "高级情报", price: 500, description: "真人拥有领域「自闭圆顿裹」(HP 700)，可通过无为转变改变灵魂形态。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 10,
      rewards: { money: { min: 800, max: 1500 }, skillExp: 80, skillPoints: 10, inspirationChance: 0.60 }
    },
    {
      id: "boss_dagon",
      name: "陀艮",
      rank: "准特级",
      tier: "boss",
      baseStats: { hp: 550, max_hp: 550, mp: 200, max_mp: 200, speed: 16, constitution: 25, martial_arts: 26, cursed_energy: 26, cursed_energy_control: 24, cursed_energy_efficiency: 20, talent: 22 },
      skills: [
        { id: "boss_dagon_water", name: "水流弹", cost: 20, type: "cursed", damageMultiplier: 3.0, castTime: 18, baseRecoverySpeed: 20, minDistance: 0, maxDistance: 3 },
        { id: "boss_dagon_shikigami", name: "鱼形式神", cost: 30, type: "cursed", damageMultiplier: 3.5, castTime: 24, baseRecoverySpeed: 16, minDistance: 0, maxDistance: 3 },
        { id: "boss_dagon_swarm", name: "鱼群吞噬", cost: 40, type: "cursed", damageMultiplier: 4.0, castTime: 30, baseRecoverySpeed: 12, minDistance: 0, maxDistance: 2 }
      ],
      domainId: "dagon_horizon",
      domainName: "荡蕴平线",
      domainHp: 600,
      intelData: {
        basic: { name: "初级情报", price: 150, description: "显示陀艮的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 300, description: "显示陀艮的技能：水流弹、鱼形式神和鱼群吞噬。" },
        advanced: { name: "高级情报", price: 500, description: "陀艮拥有领域「荡蕴平线」(HP 600)，善用式神和水系攻击。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 15,
      rewards: { money: { min: 600, max: 1200 }, skillExp: 60, skillPoints: 8, inspirationChance: 0.50 }
    },
    {
      id: "boss_sukuna_3f",
      name: "两面宿傩（三指）",
      rank: "特级",
      tier: "boss",
      baseStats: { hp: 900, max_hp: 900, mp: 300, max_mp: 300, speed: 25, constitution: 35, martial_arts: 38, cursed_energy: 36, cursed_energy_control: 35, cursed_energy_efficiency: 30, talent: 35 },
      skills: [
        { id: "boss_sukuna_cleave", name: "解", cost: 15, type: "cursed", damageMultiplier: 4.0, castTime: 12, baseRecoverySpeed: 22, minDistance: 0, maxDistance: 1 },
        { id: "boss_sukuna_dismantle", name: "捌", cost: 20, type: "cursed", damageMultiplier: 4.5, castTime: 15, baseRecoverySpeed: 20, minDistance: 0, maxDistance: 3 },
        { id: "boss_sukuna_cleave_net", name: "解·网", cost: 35, type: "cursed", damageMultiplier: 5.5, castTime: 22, baseRecoverySpeed: 14, minDistance: 0, maxDistance: 2 },
        { id: "boss_sukuna_slash", name: "袈裟斩", cost: 0, type: "martial", damageMultiplier: 3.0, castTime: 8, baseRecoverySpeed: 26, minDistance: 0, maxDistance: 0 }
      ],
      domainId: "sukuna_shrine",
      domainName: "伏魔御厨子",
      domainHp: 1000,
      intelData: {
        basic: { name: "初级情报", price: 150, description: "显示两面宿傩（三指）的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 300, description: "显示宿傩的技能：解、捌、解·网和袈裟斩。" },
        advanced: { name: "高级情报", price: 500, description: "宿傩拥有领域「伏魔御厨子」(HP 1000)，可同时发动解与捌进行全方位斩击。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 10,
      rewards: { money: { min: 1500, max: 3000 }, skillExp: 120, skillPoints: 15, inspirationChance: 0.80 }
    },
    {
      id: "boss_choso",
      name: "胀相",
      rank: "准特级",
      tier: "boss",
      baseStats: { hp: 500, max_hp: 500, mp: 220, max_mp: 220, speed: 18, constitution: 22, martial_arts: 28, cursed_energy: 24, cursed_energy_control: 22, cursed_energy_efficiency: 18, talent: 20 },
      skills: [
        { refId: "piercing_blood", level: 4 },           // 引用穿血 (Lv.4)
        { refId: "supernova", level: 3 },                 // 引用超新星 (Lv.3)
        { refId: "blood_blade", level: 4 },               // 引用血刃 (Lv.4)
        { id: "boss_choso_convergence", name: "百敛·穿血", cost: 35, type: "cursed", damageMultiplier: 5.0, castTime: 25, baseRecoverySpeed: 14, minDistance: 0, maxDistance: 3 },
        { id: "boss_choso_slicing", name: "血星弹", cost: 15, type: "cursed", damageMultiplier: 2.2, castTime: 12, baseRecoverySpeed: 22, minDistance: 1, maxDistance: 3 }
      ],
      domainId: "choso_nineblood",
      domainName: "九血之狱（未完成）",
      domainHp: 500,
      intelData: {
        basic: { name: "初级情报", price: 150, description: "显示胀相的基础属性（HP/MP/等阶）。" },
        skill: { name: "技能情报", price: 300, description: "显示胀相的技能：穿血、超新星、血刃、百敛·穿血和血星弹。" },
        advanced: { name: "高级情报", price: 500, description: "胀相拥有领域「九血之狱（未完成）」(HP 500)，赤血操术使用者，善用血系攻击。" }
      },
      // Phase 14: 逃跑基础概率 (0-100)
      escapeBaseChance: 15,
      rewards: { money: { min: 600, max: 1200 }, skillExp: 60, skillPoints: 8, inspirationChance: 0.50 }
    }
  ]
};

// ================================================================
//  RANK_RANKS: 评定等级排序映射（用于等级差计算）
// ================================================================
const RANK_ORDER = ["不入流", "四级", "准三级", "三级", "准二级", "二级", "准一级", "一级", "准特级", "特级", "现代最强"];

export function rankIndex(rankName) {
  const idx = RANK_ORDER.indexOf(rankName);
  return idx >= 0 ? idx : 0;
}

// ================================================================
//  getRandomEnemy: 根据玩家评定动态选择敌人
//  70%: 相当±1级, 20%: 高1-2级, 10%: 低2级以上
//  Phase 10: 扩展至 boss/elite 全池
// ================================================================
export function getRandomEnemy(playerRank, tier) {
  if (tier && ENEMIES[tier]) {
    const pool = ENEMIES[tier];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  // 动态选择
  const allNormals = ENEMIES.normal || [];
  const allElites = ENEMIES.elite || [];
  const allBosses = ENEMIES.boss || [];
  const playerIdx = rankIndex(playerRank);
  const roll = Math.random();
  let candidates;
  if (roll < 0.60) {
    // 60%: ±1级 (normal)
    candidates = allNormals.filter(e => Math.abs(rankIndex(e.rank) - playerIdx) <= 1);
  } else if (roll < 0.80) {
    // 20%: 高1~2级 elite
    candidates = allElites.filter(e => {
      const eIdx = rankIndex(e.rank);
      return eIdx - playerIdx >= 1 && eIdx - playerIdx <= 2;
    });
    if (!candidates || candidates.length === 0) candidates = allNormals;
  } else if (roll < 0.95) {
    // 15%: boss (准特级以上)
    candidates = allBosses.filter(e => {
      const eIdx = rankIndex(e.rank);
      return eIdx - playerIdx >= 2;
    });
    if (!candidates || candidates.length === 0) {
      candidates = allBosses;
    }
  } else {
    // 5%: 低2级以上
    candidates = allNormals.filter(e => playerIdx - rankIndex(e.rank) >= 2);
  }
  if (!candidates || candidates.length === 0) candidates = allNormals;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ================================================================
//  calculateRewards: 奖励计算 + 等级差缩放 + 跨级加成
// ================================================================
export function calculateRewards(rewardConfig, playerRank, enemyRank, isLowHp) {
  const moneyBase = rewardConfig.money.min + Math.floor(Math.random() * (rewardConfig.money.max - rewardConfig.money.min + 1));
  const pIdx = rankIndex(playerRank);
  const eIdx = rankIndex(enemyRank);
  const levelDiff = eIdx - pIdx;
  // 等级差缩放: max(0.1, 1 - levelDiff * 0.2)
  const scale = Math.max(0.1, 1 - levelDiff * 0.2);
  const money = Math.floor(moneyBase * scale);
  const skillPoints = rewardConfig.skillPoints || 1;
  const skillExp = (rewardConfig.skillExp || 5);
  // 灵感概率: 基础 + 跨级30% + 残血翻倍
  let inspChance = rewardConfig.inspirationChance || 0.05;
  if (levelDiff > 0) inspChance += 0.30;
  if (isLowHp) inspChance *= 2;
  const inspirationGained = Math.random() < Math.min(1.0, inspChance);

  return { money, skillPoints, skillExp, inspirationGained };
}
