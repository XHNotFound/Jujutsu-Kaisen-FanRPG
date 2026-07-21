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
      rewards: { money: { min: 100, max: 200 }, skillExp: 20, skillPoints: 3, inspirationChance: 0.18 }
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
      rewards: { money: { min: 500, max: 1000 }, skillExp: 60, skillPoints: 8, inspirationChance: 0.50 }
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
// ================================================================
export function getRandomEnemy(playerRank, tier) {
  if (tier && ENEMIES[tier]) {
    const pool = ENEMIES[tier];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  // 动态选择
  const allNormals = ENEMIES.normal || [];
  const playerIdx = rankIndex(playerRank);
  const roll = Math.random();
  let candidates;
  if (roll < 0.70) {
    // 70%: ±1级
    candidates = allNormals.filter(e => Math.abs(rankIndex(e.rank) - playerIdx) <= 1);
  } else if (roll < 0.90) {
    // 20%: 高1-2级（精英/boss）
    const elites = (ENEMIES.elite || []).filter(e => rankIndex(e.rank) - playerIdx >= 1 && rankIndex(e.rank) - playerIdx <= 2);
    candidates = elites.length > 0 ? elites : allNormals;
  } else {
    // 10%: 低2级以上
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
