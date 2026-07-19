// js/data/enemies.js — 敌人数据配置（Phase 4 新增）
// 定义敌人属性和战后奖励

/**
 * 敌人数据结构：
 * {
 *   id: string,
 *   name: string,
 *   tier: "normal"|"elite"|"boss",
 *   baseStats: { hp, speed, constitution, martialArts, ... },
 *   skills: Array<{ id, name, cost, type, damageMultiplier, ... }>,
 *   rewards: {
 *     money: { min: number, max: number },
 *     skillPoints: number,
 *     inspirationChance: number  // 0.0 ~ 1.0
 *   }
 * }
 */

export const ENEMIES = {
  normal: [
    {
      id: "enemy_flyhead",
      name: "蛸头",
      tier: "normal",
      baseStats: {
        hp: 60, max_hp: 60,
        mp: 0, max_mp: 0,
        speed: 7,
        constitution: 8,
        martial_arts: 10,
        cursed_energy: 0,
        cursed_energy_control: 0,
        cursed_energy_efficiency: 0,
        talent: 5
      },
      skills: [
        {
          id: "enemy_attack",
          name: "撞击",
          cost: 0,
          type: "martial",
          damageMultiplier: 1.0,
          castTime: 8,
          baseRecoverySpeed: 28,
          minDistance: 0,
          maxDistance: 0
        }
      ],
      rewards: {
        money: { min: 20, max: 50 },
        skillPoints: 1,
        inspirationChance: 0.05
      }
    },
    {
      id: "enemy_cursespirit_lv1",
      name: "低级咒灵",
      tier: "normal",
      baseStats: {
        hp: 80, max_hp: 80,
        mp: 10, max_mp: 10,
        speed: 8,
        constitution: 10,
        martial_arts: 12,
        cursed_energy: 5,
        cursed_energy_control: 5,
        cursed_energy_efficiency: 5,
        talent: 8
      },
      skills: [
        {
          id: "enemy_attack",
          name: "撞击",
          cost: 0,
          type: "martial",
          damageMultiplier: 1.0,
          castTime: 8,
          baseRecoverySpeed: 28,
          minDistance: 0,
          maxDistance: 0
        },
        {
          id: "enemy_cursed_blast",
          name: "诅咒弹",
          cost: 5,
          type: "cursed",
          damageMultiplier: 1.3,
          castTime: 18,
          baseRecoverySpeed: 22,
          minDistance: 1,
          maxDistance: 3
        }
      ],
      rewards: {
        money: { min: 40, max: 80 },
        skillPoints: 2,
        inspirationChance: 0.10
      }
    }
  ],

  elite: [
    {
      id: "enemy_cursespirit_lv3",
      name: "咒胎",
      tier: "elite",
      baseStats: {
        hp: 150, max_hp: 150,
        mp: 30, max_mp: 30,
        speed: 10,
        constitution: 16,
        martial_arts: 18,
        cursed_energy: 12,
        cursed_energy_control: 10,
        cursed_energy_efficiency: 8,
        talent: 12
      },
      skills: [
        {
          id: "enemy_heavy_strike",
          name: "重击",
          cost: 0,
          type: "martial",
          damageMultiplier: 1.5,
          castTime: 10,
          baseRecoverySpeed: 24,
          minDistance: 0,
          maxDistance: 0
        },
        {
          id: "enemy_dark_bolt",
          name: "暗黑咒弹",
          cost: 12,
          type: "cursed",
          damageMultiplier: 2.0,
          castTime: 22,
          baseRecoverySpeed: 18,
          minDistance: 0,
          maxDistance: 3
        }
      ],
      rewards: {
        money: { min: 100, max: 200 },
        skillPoints: 4,
        inspirationChance: 0.20
      }
    }
  ],

  boss: [
    {
      id: "enemy_special_grade",
      name: "特级咒灵",
      tier: "boss",
      baseStats: {
        hp: 400, max_hp: 400,
        mp: 100, max_mp: 100,
        speed: 14,
        constitution: 25,
        martial_arts: 28,
        cursed_energy: 25,
        cursed_energy_control: 22,
        cursed_energy_efficiency: 18,
        talent: 20
      },
      skills: [
        {
          id: "boss_physical",
          name: "领域之拳",
          cost: 0,
          type: "martial",
          damageMultiplier: 2.0,
          castTime: 12,
          baseRecoverySpeed: 22,
          minDistance: 0,
          maxDistance: 1
        },
        {
          id: "boss_cursed_beam",
          name: "咒力光束",
          cost: 20,
          type: "cursed",
          damageMultiplier: 3.5,
          castTime: 30,
          baseRecoverySpeed: 15,
          minDistance: 0,
          maxDistance: 3
        }
      ],
      rewards: {
        money: { min: 500, max: 1000 },
        skillPoints: 8,
        inspirationChance: 0.50
      }
    }
  ]
};

// ================================================================
//  辅助函数
// ================================================================

/**
 * 根据 tier 随机获取一个敌人
 * @param {string} tier — "normal"|"elite"|"boss"
 * @returns {object} 敌人配置对象
 */
export function getRandomEnemy(tier = "normal") {
  const pool = ENEMIES[tier] || ENEMIES.normal;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

/**
 * 计算奖励（基础值 + 随机浮动）
 * @param {object} rewardConfig — 敌人的 rewards 字段
 * @returns {{ money: number, skillPoints: number, inspirationGained: boolean }}
 */
export function calculateRewards(rewardConfig) {
  const money = rewardConfig.money.min
    + Math.floor(Math.random() * (rewardConfig.money.max - rewardConfig.money.min + 1));
  const skillPoints = rewardConfig.skillPoints || 0;
  const inspirationGained = Math.random() < (rewardConfig.inspirationChance || 0);

  return { money, skillPoints, inspirationGained };
}
