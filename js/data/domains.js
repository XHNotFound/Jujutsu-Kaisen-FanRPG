// js/data/domains.js — 领域数据配置（Phase 7 新增）
// 定义各术式的领域展开配置

export const DOMAINS = {
  // ================================================================
  //  无下限术式 — 无量空处
  // ================================================================
  limitless: {
    name: "无量空处",
    specialEffect: "info_overflow",
    flavorText: "将目标拉入无限的虚空之中，所有感知信息被无限放大，使其陷入完全无法行动的状态。",
    completeRequirements: {
      techniqueLevel: 8,
      barrierLevel: 8,
      inspiration: 3,
      cursedEnergyControl: 60
    },
    incompleteRequirements: {
      techniqueLevel: 5,
      barrierLevel: 5,
      inspiration: 1,
      cursedEnergyControl: 40
    },
    baseStats: {
      hpPerBarrier: 100,         // 每级结界术 +100 HP
      hpPerCEC: 5,               // 每点咒力操控 +5 HP
      intervalBase: 10,           // 基础攻击间隔（帧）
      damagePerTech: 50,          // 每级术式等级 +50 伤害
      mpCostPerTick: 5            // 每 tick 咒力消耗
    }
  },

  // ================================================================
  //  十种影法术 — 嵌合暗翳庭
  // ================================================================
  tenShadows: {
    name: "嵌合暗翳庭",
    specialEffect: "shadow_territory",
    flavorText: "影子覆盖一切，十种式神可以在领域中自由进出影子的世界。领域内的式神能力大幅提升。",
    completeRequirements: {
      techniqueLevel: 7,
      barrierLevel: 7,
      inspiration: 2,
      cursedEnergyControl: 50
    },
    incompleteRequirements: {
      techniqueLevel: 4,
      barrierLevel: 4,
      inspiration: 1,
      cursedEnergyControl: 35
    },
    baseStats: {
      hpPerBarrier: 80,
      hpPerCEC: 4,
      intervalBase: 12,
      damagePerTech: 40,
      mpCostPerTick: 4
    }
  },

  // ================================================================
  //  不义游戏 — 不义游戏·领域
  // ================================================================
  boogieWoogie: {
    name: "不义游戏·领域",
    specialEffect: "position_chaos",
    flavorText: "领域范围内的一切物体都可以被随意交换位置，形成绝对的空间控制。对手完全无法判断下一次攻击的来源。",
    completeRequirements: {
      techniqueLevel: 6,
      barrierLevel: 6,
      inspiration: 2,
      cursedEnergyControl: 45
    },
    incompleteRequirements: {
      techniqueLevel: 4,
      barrierLevel: 4,
      inspiration: 1,
      cursedEnergyControl: 30
    },
    baseStats: {
      hpPerBarrier: 70,
      hpPerCEC: 3,
      intervalBase: 8,
      damagePerTech: 35,
      mpCostPerTick: 3
    }
  },

  // ================================================================
  //  咒灵操术 — 极之番·漩涡
  // ================================================================
  curseManipulation: {
    name: "极之番·漩涡",
    specialEffect: "curse_fusion",
    flavorText: "将所有吸收的咒灵融为一体，化作毁灭性的诅咒漩涡。漩涡中心的空间都会被诅咒侵蚀。",
    completeRequirements: {
      techniqueLevel: 7,
      barrierLevel: 6,
      inspiration: 3,
      cursedEnergyControl: 55
    },
    incompleteRequirements: {
      techniqueLevel: 5,
      barrierLevel: 4,
      inspiration: 1,
      cursedEnergyControl: 40
    },
    baseStats: {
      hpPerBarrier: 90,
      hpPerCEC: 5,
      intervalBase: 15,
      damagePerTech: 55,
      mpCostPerTick: 6
    }
  },

  // ================================================================
  //  纯体术流 — 天与咒缚·体
  // ================================================================
  pureMartial: {
    name: "天与咒缚·体",
    specialEffect: "body_limit",
    flavorText: "以完全丧失咒力为代价，换取超越极限的肉体能力。这已经是另一个次元的战斗了。没有领域，只有压倒性的肉体。",
    completeRequirements: {
      techniqueLevel: 6,
      barrierLevel: 0,
      inspiration: 1,
      cursedEnergyControl: 0
    },
    incompleteRequirements: {
      techniqueLevel: 4,
      barrierLevel: 0,
      inspiration: 0,
      cursedEnergyControl: 0
    },
    baseStats: {
      hpPerBarrier: 0,
      hpPerCEC: 0,          // 纯体术流不使用领域 HP，而是直接增强本体
      intervalBase: 0,
      damagePerTech: 0,
      mpCostPerTick: 0
    }
  }
};

// ================================================================
//  Phase 7: 领域计算辅助函数
// ================================================================

/**
 * 判断领域是完全领域还是不完全领域
 * @param {string} techniqueId — 术式 ID
 * @param {object} characterState — 玩家存档状态
 * @returns {object}
 */
export function canExpandDomain(techniqueId, characterState) {
  const domainDef = DOMAINS[techniqueId];
  if (!domainDef) {
    return { canExpand: false, isComplete: false, reason: '该术式没有领域配置。' };
  }

  const attrs = characterState.attributes || {};
  const skillLevels = characterState.skillLevels || {};
  const inspiration = characterState.inspiration || 0;

  // 术式等级 = 该术式树中所有技能等级之和
  let techniqueLevel = 0;
  const tree = (characterState._techTree) ? Object.keys(characterState._techTree) : Object.keys(skillLevels);
  for (const [skillId, level] of Object.entries(skillLevels)) {
    techniqueLevel += level;
  }

  // 结界术等级（Phase 7 简化：用咒力操控替代）
  const barrierLevel = attrs.cursedEnergyControl || 0;

  // 检查完全领域条件
  const complete = domainDef.completeRequirements;
  if (techniqueLevel >= complete.techniqueLevel &&
      barrierLevel >= complete.barrierLevel &&
      inspiration >= complete.inspiration &&
      (attrs.cursedEnergyControl || 0) >= complete.cursedEnergyControl) {
    return { canExpand: true, isComplete: true, reason: '' };
  }

  // 检查不完全领域条件
  const incomplete = domainDef.incompleteRequirements;
  if (techniqueLevel >= incomplete.techniqueLevel &&
      barrierLevel >= incomplete.barrierLevel &&
      inspiration >= incomplete.inspiration &&
      (attrs.cursedEnergyControl || 0) >= incomplete.cursedEnergyControl) {
    return { canExpand: true, isComplete: false, reason: '展开不完全领域（HP/伤害 ×0.6）' };
  }

  return { canExpand: false, isComplete: false, reason: '领域展开条件不足。' };
}

/**
 * 计算领域 Unit 的数值
 * @param {string} techniqueId
 * @param {object} characterState
 * @param {boolean} isComplete — 是否完全领域
 * @returns {object}
 */
export function calculateDomainStats(techniqueId, characterState, isComplete) {
  const domainDef = DOMAINS[techniqueId];
  if (!domainDef) return null;

  const attrs = characterState.attributes || {};
  const skillLevels = characterState.skillLevels || {};

  let totalTechLevel = 0;
  for (const level of Object.values(skillLevels)) {
    totalTechLevel += level;
  }

  const barrierLevel = attrs.cursedEnergyControl || 0;
  const stats = domainDef.baseStats;

  let hp = stats.hpPerBarrier * barrierLevel + stats.hpPerCEC * (attrs.cursedEnergyControl || 0);
  let attackInterval = Math.max(5, stats.intervalBase);
  let attackDamage = stats.damagePerTech * Math.max(1, totalTechLevel);
  let mpCostPerTick = stats.mpCostPerTick;

  if (!isComplete) {
    hp = Math.floor(hp * 0.6);
    attackDamage = Math.floor(attackDamage * 0.6);
  }

  return {
    hp, maxHp: hp,
    attackInterval,
    attackDamage,
    mpCostPerTick
  };
}
