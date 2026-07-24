// js/modules/statusSystem.js — 状态系统规范层（Phase 12）
// 纯逻辑模块，严禁任何 DOM 操作
// 定义标准 Buff/Debuff 数据结构与辅助函数

/**
 * 标准状态效果对象规范：
 * {
 *   id: string,          // 唯一标识（如 "domain_burnout"）
 *   name: string,        // 显示名称（如 "领域熔断"）
 *   type: "buff" | "debuff",
 *   duration: number,    // 剩余持续行动值 (Action Value)，单位同 global_action_time
 *   description: string, // 人类可读的效果描述
 *   icon: string,        // emoji 图标或 CSS 类名
 *   effects: object|null // 逻辑层使用的数值效果（可选）
 * }
 */

// ================================================================
//  标准状态效果定义注册表
// ================================================================

export const STATUS_DEFS = {
  // Phase 7 / Phase 12: 领域熔断
  domain_burnout: {
    id: "domain_burnout",
    name: "领域熔断",
    type: "debuff",
    duration: 60,           // 默认 60 AV（由引擎动态设置）
    description: "禁用所有咒术技能，体术补偿速度 -30%。",
    icon: "🔥",
    effects: {
      forbid_cursed_skills: true,    // 禁止使用咒术技能
      recovery_speed_penalty: 0.30,  // 补偿速度 -30%
    }
  },

  // Phase 12: 简易领域（Buff 态）
  simple_domain_active: {
    id: "simple_domain_active",
    name: "简易领域",
    type: "buff",
    duration: 0,            // 无固定持续时间，与 domain_counter_buffs 同步
    description: "护盾中和敌方领域必中效果。每 10 AV 消耗咒力。",
    icon: "🗡️",
    effects: {
      negate_domain_special: true,
      shield_hp: 200,
      mp_drain_per_10av: 2,
    }
  },

  // Phase 12: 落花之情（Buff 态）
  falling_blossom_active: {
    id: "falling_blossom_active",
    name: "落花之情",
    type: "buff",
    duration: 0,
    description: "以咒力将敌方领域必中效果全部打散，100% 免伤。每 10 AV 消耗咒力。",
    icon: "🌸",
    effects: {
      negate_domain_special: true,
      domain_damage_reduction: 1.0,
      mp_drain_per_10av: 5,
    }
  },

  // Phase 12: 弥虚葛笼（Buff 态）
  hollow_wicker_active: {
    id: "hollow_wicker_active",
    name: "弥虚葛笼",
    type: "buff",
    duration: 0,
    description: "编织结界术防御空间，大幅削减领域伤害（80%）。每 10 AV 消耗咒力。",
    icon: "🏺",
    effects: {
      negate_domain_special: true,
      domain_damage_reduction: 0.8,
      mp_drain_per_10av: 8,
    }
  },

  // Phase 12: 攻击强化之缚（Buff 态）
  offense_boost_active: {
    id: "offense_boost_active",
    name: "攻击强化之缚",
    type: "buff",
    duration: 0,            // 持续至解除
    description: "攻击伤害 +50%，承受伤害 +30%。",
    icon: "⚡",
    effects: {
      bonus_damage_pct: 0.50,
      penalty_dmg_taken_pct: 0.30,
    }
  },

  // Phase 12: 禁咒加速之缚（Buff 态）
  no_cursed_speed_active: {
    id: "no_cursed_speed_active",
    name: "禁咒加速之缚",
    type: "buff",
    duration: 0,
    description: "禁用咒术，体术速度 +30%，补偿速度 +30%。违规则扣除 20% HP。",
    icon: "⚡",
    effects: {
      forbid_cursed_skills: true,
      speed_bonus: 0.30,
      recovery_bonus: 0.30,
    }
  },

  // Phase 12: 反转术式冷却（Debuff）
  rct_cooldown: {
    id: "rct_cooldown",
    name: "反转术式冷却",
    type: "debuff",
    duration: 60,
    description: "反转术式使用后的咒力调整期，无法再次使用反转术式。",
    icon: "💚",
    effects: {
      forbid_rct: true,
    }
  },

  // Phase 12: 防御强化（通用 Buff 模板）
  defense_boost: {
    id: "defense_boost",
    name: "防御强化",
    type: "buff",
    duration: 90,
    description: "体质临时提升，受到的伤害减少。",
    icon: "🛡️",
    effects: {
      damage_reduction_pct: 0.15,
    }
  },

  // Phase 12: 攻击强化（通用 Buff 模板）
  attack_boost: {
    id: "attack_boost",
    name: "攻击强化",
    type: "buff",
    duration: 90,
    description: "体术水平临时提升，造成的伤害增加。",
    icon: "⚔️",
    effects: {
      damage_boost_pct: 0.15,
    }
  },

  // Phase 12: 速度低下（通用 Debuff 模板）
  speed_down: {
    id: "speed_down",
    name: "速度低下",
    type: "debuff",
    duration: 60,
    description: "速度降低 20%，ATB 累积变慢。",
    icon: "🐌",
    effects: {
      speed_penalty: 0.20,
    }
  },

  // Phase 12: 咒力封印（Debuff 模板，供未来领域效果使用）
  curse_seal: {
    id: "curse_seal",
    name: "咒力封印",
    type: "debuff",
    duration: 90,
    description: "咒力被封，无法使用任何咒术技能。",
    icon: "🔒",
    effects: {
      forbid_cursed_skills: true,
    }
  },

  // Phase 12: 反转术式冷却（Debuff）
  rct_cooldown: {
    id: "rct_cooldown",
    name: "反转术式冷却",
    type: "debuff",
    duration: 60,
    description: "反转术式使用后的咒力调整期，无法再次使用反转术式。",
    icon: "💚",
    effects: {
      forbid_rct: true,
    }
  },
};

// ================================================================
//  Phase 12: 反转术式效率计算（纯函数）
// ================================================================

/**
 * 计算反转术式回复效率（分段线性函数，严格连续无跳变）
 * @param {number} cursedEnergyEfficiency - 玩家的咒力效率属性
 * @returns {number} 回复效率倍率
 *
 * 分段规则:
 *   cee < 20:  固定 0.5
 *   20 <= cee <= 40: 0.5 + (cee - 20) * 0.01   (线性上升至 0.7)
 *   40 < cee <= 60:  0.7 + (cee - 40) * 0.015  (线性上升至 1.0)
 *   cee > 60:  1.0 + (cee - 60) * 0.02
 *
 * 边界验证:
 *   cee=19 -> 0.5; cee=20 -> 0.5 ✓ 连续无跳变
 *   cee=40 -> 0.7 ✓ 两段公式结果一致
 *   cee=60 -> 1.0 ✓ 两段公式结果一致
 */
export function calculateRCTEfficiency(cursedEnergyEfficiency) {
  if (cursedEnergyEfficiency < 20) return 0.5;
  if (cursedEnergyEfficiency <= 40) return 0.5 + (cursedEnergyEfficiency - 20) * 0.01;
  if (cursedEnergyEfficiency <= 60) return 0.7 + (cursedEnergyEfficiency - 40) * 0.015;
  return 1.0 + (cursedEnergyEfficiency - 60) * 0.02;
}

/**
 * 计算反转术式回复量（纯函数，不修改任何状态）
 * @param {number} consumeAmount - 消耗的咒力量
 * @param {number} cursedEnergyEfficiency - 咒力效率属性
 * @returns {{ healAmount: number, efficiency: number }} 回复量和效率
 */
export function calcRCTHeal(consumeAmount, cursedEnergyEfficiency) {
  const efficiency = calculateRCTEfficiency(cursedEnergyEfficiency);
  const healAmount = Math.floor(consumeAmount * efficiency);
  return { healAmount, efficiency };
}

// ================================================================
//  纯函数工具：创建 / 查询 / 清理状态效果
// ================================================================

/**
 * 根据标准定义创建一个新的状态效果实例（深拷贝以防止变量共享）
 * @param {string} statusId — STATUS_DEFS 中的 key
 * @param {number} [durationOverride] — 自定义持续时间（AV），不传则使用默认值
 * @returns {object|null} 状态效果对象，或 null
 */
export function createStatusEffect(statusId, durationOverride) {
  const def = STATUS_DEFS[statusId];
  if (!def) return null;

  return {
    id: def.id,
    name: def.name,
    type: def.type,
    duration: durationOverride !== undefined ? durationOverride : def.duration,
    description: def.description,
    icon: def.icon,
    effects: def.effects ? { ...def.effects } : null,
  };
}

/**
 * 向单位的 status_effects 数组添加状态效果
 * 如果同 id 已存在，则刷新持续时间（取更长者）
 * @param {object} unit — 战斗单位对象（含 status_effects 数组）
 * @param {object} statusEffect — 状态效果对象
 * @returns {boolean} 是否成功添加
 */
export function addStatusEffect(unit, statusEffect) {
  if (!unit || !statusEffect) return false;
  if (!Array.isArray(unit.status_effects)) {
    unit.status_effects = [];
  }
  const existing = unit.status_effects.find(s => s.id === statusEffect.id);
  if (existing) {
    // 刷新持续时间：取更长者
    existing.duration = Math.max(existing.duration, statusEffect.duration);
    return true;
  }
  unit.status_effects.push(statusEffect);
  return true;
}

/**
 * 移除单位的指定状态效果
 * @param {object} unit
 * @param {string} statusId
 * @returns {boolean} 是否成功移除
 */
export function removeStatusEffect(unit, statusId) {
  if (!unit || !Array.isArray(unit.status_effects)) return false;
  const idx = unit.status_effects.findIndex(s => s.id === statusId);
  if (idx >= 0) {
    unit.status_effects.splice(idx, 1);
    return true;
  }
  return false;
}

/**
 * 检查单位是否拥有指定状态效果
 * @param {object} unit
 * @param {string} statusId
 * @returns {object|null} 状态效果对象或 null
 */
export function hasStatusEffect(unit, statusId) {
  if (!unit || !Array.isArray(unit.status_effects)) return null;
  return unit.status_effects.find(s => s.id === statusId && s.duration > 0) || null;
}

/**
 * 推进所有状态效果的持续时间，移除已过期的
 * 纯函数 — 直接修改传入的 units 数组中的 status_effects
 * @param {object[]} units — 战斗单位数组
 * @param {number} tick — 推进的帧数（通常为 1）
 * @returns {Array<{unitName: string, expiredName: string}>} 过期日志
 */
export function tickStatusEffects(units, tick = 1) {
  const expiredLog = [];
  if (!units || !Array.isArray(units)) return expiredLog;

  for (const unit of units) {
    if (!unit.is_alive || !Array.isArray(unit.status_effects) || unit.status_effects.length === 0) continue;
    // 仅对有持续时间的 Buff/Debuff 进行倒计时（duration=0 表示永久）
    const unfinished = [];
    for (const se of unit.status_effects) {
      if (se.duration > 0) {
        se.duration = Math.max(0, se.duration - tick);
        if (se.duration <= 0) {
          expiredLog.push({ unitName: unit.name, expiredName: se.name });
          continue; // 不保留
        }
      }
      unfinished.push(se);
    }
    unit.status_effects = unfinished;
  }
  return expiredLog;
}

/**
 * 清理单位所有非永久的状态效果（战斗结束或角色死亡时使用）
 * @param {object} unit
 */
export function clearAllStatusEffects(unit) {
  if (!unit || !Array.isArray(unit.status_effects)) return;
  unit.status_effects = unit.status_effects.filter(s => s.duration <= 0);
}

/**
 * 获取单位所有状态效果的摘要（用于 UI 渲染）
 * @param {object} unit
 * @returns {{ buffs: object[], debuffs: object[] }}
 */
export function getStatusSummary(unit) {
  const buffs = [];
  const debuffs = [];
  if (!unit || !Array.isArray(unit.status_effects)) return { buffs, debuffs };

  for (const se of unit.status_effects) {
    if (se.type === 'buff') buffs.push(se);
    else if (se.type === 'debuff') debuffs.push(se);
  }
  return { buffs, debuffs };
}

/**
 * 根据 domain_counter_buffs 同步生成对应的 status_effects
 * 用于将旧架构中的 domain_counter_buffs 映射为标准化 status_effects
 * @param {object[]} domainCounterBuffs — unit.domain_counter_buffs 数组
 * @returns {object[]} 对应的 status_effects 数组
 */
export function domainCounterBuffsToStatuses(domainCounterBuffs) {
  if (!domainCounterBuffs || !Array.isArray(domainCounterBuffs)) return [];
  const map = {
    simple_domain: "simple_domain_active",
    falling_blossom: "falling_blossom_active",
    hollow_wicker: "hollow_wicker_active",
  };
  const result = [];
  for (const buf of domainCounterBuffs) {
    const statusId = map[buf.id];
    if (statusId) {
      const se = createStatusEffect(statusId, 0);
      if (se) result.push(se);
    }
  }
  return result;
}
