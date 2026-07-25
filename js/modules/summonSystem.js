// js/modules/summonSystem.js — 召唤系统纯逻辑层（Phase 9）
// 提供召唤物相关的纯函数工具，不包含任何 DOM 操作

/**
 * 校验召唤技能是否可用
 * @param {object} summoner — 召唤者 Unit
 * @param {object} skill — 技能定义（含 summonConfig）
 * @param {object[]} units — 当前 units 数组
 * @returns {object}
 */
export function validateSummon(summoner, skill, units) {
  if (!skill || skill.type !== 'summon') {
    return { valid: false, error: '该技能不是召唤技能。' };
  }
  if (!skill.summonConfig) {
    return { valid: false, error: '技能缺少 summonConfig 配置。' };
  }
  const cost = skill.cost || 0;
  if (summoner.mp < cost) {
    return { valid: false, error: `咒力不足！需要 ${cost} MP，当前 ${summoner.mp} MP。` };
  }
  // 检查同名式神是否已存在
  const existing = units.filter(u =>
    u.unit_type === 'shikigami' && u.owner === summoner.id && u.is_alive
  );
  if (existing.length > 0) {
    return { valid: false, error: `式神 ${existing[0].name} 仍在场，无法重复召唤。` };
  }
  return { valid: true };
}

/**
 * 构建召唤物 Unit 数据
 * @param {object} summoner — 召唤者 Unit
 * @param {object} skill — 技能定义（含 summonConfig）
 * @param {number} timestamp — 时间戳（用于生成唯一 ID）
 * @returns {object} 召唤物 Unit 数据
 */
export function buildSummonUnit(summoner, skill, timestamp) {
  const sc = skill.summonConfig;
  const st = sc.baseStats || {};
  return {
    id: `shikigami_${summoner.id}_${sc.name}_${timestamp}`,
    name: sc.name || '召唤物',
    unit_type: sc.unitType || 'shikigami',
    owner: summoner.id,
    hp: st.hp || 80,
    max_hp: st.max_hp || st.hp || 80,
    mp: st.mp || 20,
    max_mp: st.max_mp || st.mp || 20,
    atb: 0,
    speed: st.speed || 15,
    constitution: st.constitution || 10,
    martial_arts: st.martialArts || 20,
    cursed_energy: st.cursedEnergy || 5,
    cursed_energy_control: st.cursedEnergyControl || 5,
    cursed_energy_efficiency: st.cursedEnergyEfficiency || 5,
    talent: st.talent || 8,
    skills: (sc.skills || []).map(sk => ({
      id: sk.id || '',
      name: sk.name || '',
      cost: sk.cost || 0,
      type: sk.type || 'martial',
      damage_multiplier: sk.damageMultiplier || 1.0,
      cast_time: sk.castTime || 10,
      base_recovery_speed: sk.baseRecoverySpeed || 25,
      min_distance: sk.minDistance || 0,
      max_distance: sk.maxDistance || 0
    })),
    is_alive: true,
    distance: summoner.distance,
    recovery_speed: st.speed || 15,
    summon_duration: sc.duration || 300
  };
}

/**
 * 获取场上所有召唤物的摘要信息（用于 UI 渲染）
 * @param {object[]} units
 * @returns {object[]}
 */
export function getActiveSummons(units) {
  if (!units || !Array.isArray(units)) return [];
  return units.filter(u =>
    u.unit_type === 'shikigami' && u.is_alive
  );
}

/**
 * 获取指定召唤者的所有召唤物
 * @param {object[]} units
 * @param {string} ownerId
 * @returns {object[]}
 */
export function getSummonsByOwner(units, ownerId) {
  if (!units || !Array.isArray(units)) return [];
  return units.filter(u =>
    u.unit_type === 'shikigami' && u.owner === ownerId && u.is_alive
  );
}

/**
 * 获取友方单位列表（玩家 + 召唤物 + ally）
 * @param {object[]} units
 * @returns {object[]}
 */
export function getFriendlyUnits(units) {
  if (!units || !Array.isArray(units)) return [];
  return units.filter(u =>
    (u.unit_type === 'player' || u.unit_type === 'shikigami' || u.unit_type === 'ally') &&
    u.is_alive
  );
}

/**
 * 获取敌对单位列表
 * @param {object[]} units
 * @returns {object[]}
 */
export function getHostileUnits(units) {
  if (!units || !Array.isArray(units)) return [];
  return units.filter(u =>
    u.unit_type === 'enemy' && u.is_alive
  );
}

// ===== Phase 9: 仇恨机制（纯函数） =====

/**
 * 计算仇恨增量
 * @param {number} damage — 造成的伤害/治疗量
 * @param {string} actionType — "damage" | "heal"
 * @returns {number} 仇恨增量
 */
export function calculateAggro(damage, actionType) {
  const multiplier = actionType === 'heal' ? 0.5 : 1.0;
  return Math.floor(damage * multiplier);
}

/**
 * 从友方单位中选择仇恨最高的作为敌人的攻击目标
 * @param {object[]} units
 * @returns {object|null}
 */
export function selectTargetByAggro(units) {
  if (!units || !Array.isArray(units)) return null;
  const friendlies = units.filter(u =>
    (u.unit_type === 'player' || u.unit_type === 'shikigami' || u.unit_type === 'ally') &&
    u.is_alive
  );
  if (friendlies.length === 0) return null;
  // 选 aggro 最高的；同值优先 player
  return friendlies.reduce((best, u) =>
    (u.aggro || 0) > (best.aggro || 0) ? u : best, friendlies[0]);
}

/**
 * 获取场上仇恨排序列表（用于 UI 显示仇恨热力图）
 * @param {object[]} units
 * @returns {object[]} 按 aggro 降序排列的友方单位
 */
export function getAggroRanking(units) {
  if (!units || !Array.isArray(units)) return [];
  return units
    .filter(u => (u.unit_type === 'player' || u.unit_type === 'shikigami' || u.unit_type === 'ally') && u.is_alive)
    .sort((a, b) => (b.aggro || 0) - (a.aggro || 0));
}

// ===== Phase 9: 友方 NPC 助战 =====

/**
 * 构建友方 NPC Unit 数据（纯数据，由 Python 引擎 create_ally_unit 处理）
 * @param {object} allyConfig — 来自 NPC_ALLY_CONFIGS 的配置
 * @returns {object} 可序列化为 JSON 传给 Python 的 ally Unit 数据
 */
export function buildAllyUnit(allyConfig) {
  if (!allyConfig) return null;
  const st = allyConfig.baseStats || {};
  return {
    id: `ally_${allyConfig.unitType || 'npc'}_${allyConfig.name || 'NPC'}`,
    name: allyConfig.name || '友方NPC',
    unit_type: 'ally',
    hp: st.hp || 200,
    max_hp: st.max_hp || st.hp || 200,
    mp: st.mp || 60,
    max_mp: st.max_mp || st.mp || 60,
    atb: 300, // ally 加入时 ATB 满，可立即行动
    speed: st.speed || 14,
    constitution: st.constitution || 18,
    martial_arts: st.martialArts || 20,
    cursed_energy: st.cursedEnergy || 14,
    cursed_energy_control: st.cursedEnergyControl || 14,
    cursed_energy_efficiency: st.cursedEnergyEfficiency || 12,
    talent: st.talent || 14,
    skills: (allyConfig.skills || []).map(sk => ({
      id: sk.id || '',
      name: sk.name || '',
      cost: sk.cost || 0,
      type: sk.type || 'martial',
      damage_multiplier: sk.damageMultiplier || 1.0,
      cast_time: sk.castTime || 10,
      base_recovery_speed: sk.baseRecoverySpeed || 25,
      min_distance: sk.minDistance || 0,
      max_distance: sk.maxDistance || 0
    })),
    is_alive: true,
    distance: 2, // 中距离
    owner: null,
    recovery_speed: st.speed || 14,
    summon_duration: 0, // ally 无时间限制
    aggro: 0,
    aiBehavior: allyConfig.aiBehavior || 'balanced'
  };
}

/**
 * 获取场上所有 ally 单位
 * @param {object[]} units
 * @returns {object[]}
 */
export function getActiveAllies(units) {
  if (!units || !Array.isArray(units)) return [];
  return units.filter(u => u.unit_type === 'ally' && u.is_alive);
}
