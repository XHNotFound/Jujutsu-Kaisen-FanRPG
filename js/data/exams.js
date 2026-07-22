// js/data/exams.js — 职级考核任务数据（Phase 11 新增）
// 定义准三级到特级的考核任务，含强制怪物和失败冷却

export const EXAMS = {
  // ================================================================
  //  升职考核列表
  //  每个考核包含：目标职级、硬性属性要求、指定考核怪物、失败冷却天数
  // ================================================================
  promotions: [
    {
      id: "exam_semi_grade3",
      target_rank: "准三级",
      name: "准三级咒术师考核",
      description: "证明你已具备处理准三级咒灵的能力。",
      requirements: {
        attributes: { cursedEnergy: 18, martialArts: 18 }
      },
      enemy_id: "enemy_centipede",       // 指定考核怪物：百足咒灵
      enemy_name: "百足咒灵",
      cooldown_days: 3,
      cost: { ap: 30 },
      reward: {
        money: 80,
        skillPoints: 2,
        newRank: "准三级"
      },
      storyText: "「考核内容：祓除指定区域内的百足咒灵。这是你迈向正式咒术师的第一步。」"
    },
    {
      id: "exam_grade3",
      target_rank: "三级",
      name: "三级咒术师考核",
      description: "晋升三级咒术师的考核，需要更强的综合实力。",
      requirements: {
        attributes: { cursedEnergy: 20, martialArts: 20, cursedEnergyControl: 20 }
      },
      enemy_id: "enemy_shadow_beast",    // 指定考核怪物：影兽
      enemy_name: "影兽",
      cooldown_days: 3,
      cost: { ap: 30 },
      reward: {
        money: 150,
        skillPoints: 3,
        newRank: "三级"
      },
      storyText: "「你将在指定区域内解决一只影兽。这种咒灵擅长远程攻击，注意保持距离。」"
    },
    {
      id: "exam_semi_grade2",
      target_rank: "准二级",
      name: "准二级咒术师考核",
      description: "向准二级迈进，面对更强的诅咒。",
      requirements: {
        attributes: { cursedEnergy: 24, martialArts: 24, cursedEnergyControl: 22 }
      },
      enemy_id: "enemy_blood_ghost",     // 指定考核怪物：血涂灵
      enemy_name: "血涂灵",
      cooldown_days: 3,
      cost: { ap: 30 },
      reward: {
        money: 250,
        skillPoints: 4,
        newRank: "准二级"
      },
      storyText: "「这次的目标是血涂灵。它拥有远程血矛攻击，请做好防护准备。」"
    },
    {
      id: "exam_grade2",
      target_rank: "二级",
      name: "二级咒术师考核",
      description: "晋升二级的考核。你需要面对真正的恐怖。",
      requirements: {
        attributes: { cursedEnergy: 28, martialArts: 28, cursedEnergyControl: 26, constitution: 26 }
      },
      enemy_id: "enemy_kuchisake",       // 指定考核怪物：裂口女
      enemy_name: "裂口女",
      cooldown_days: 3,
      cost: { ap: 30 },
      reward: {
        money: 400,
        skillPoints: 5,
        newRank: "二级"
      },
      storyText: "「裂口女——都市传说中的诅咒。她的剪刀曾夺走无数人的生命。活着回来，咒术师。」"
    },
    {
      id: "exam_semi_grade1",
      target_rank: "准一级",
      name: "准一级咒术师考核",
      description: "通往一级的大门。你需要独自面对准一级咒灵的威胁。",
      requirements: {
        attributes: { cursedEnergy: 32, martialArts: 32, cursedEnergyControl: 30, talent: 28 }
      },
      enemy_id: "enemy_rokurokubi",      // 指定考核怪物：辘轳首
      enemy_name: "辘轳首",
      cooldown_days: 3,
      cost: { ap: 35 },
      reward: {
        money: 600,
        skillPoints: 7,
        newRank: "准一级"
      },
      storyText: "「辘轳首——长颈的诅咒。它的凝视可以直接侵蚀你的精神。不要直视它的眼睛。」"
    },
    {
      id: "exam_grade1",
      target_rank: "一级",
      name: "一级咒术师考核",
      description: "晋升一级的考核。只有真正的强者才能通过。",
      requirements: {
        attributes: { cursedEnergy: 36, martialArts: 36, cursedEnergyControl: 34, talent: 32, constitution: 32 }
      },
      enemy_id: "enemy_nurarihyon",      // 指定考核怪物：滑瓢
      enemy_name: "滑瓢",
      cooldown_days: 3,
      cost: { ap: 35 },
      reward: {
        money: 800,
        skillPoints: 8,
        newRank: "一级"
      },
      storyText: "「滑瓢——传说中的妖怪总大将。即使在咒术界也是极为危险的存在。让我看看你的觉悟。」"
    },
    {
      id: "exam_special_grade",
      target_rank: "特级",
      name: "特级咒术师考核",
      description: "最终考核。面对特级咒灵，证明你有资格被称为'特级'。",
      requirements: {
        attributes: { cursedEnergy: 48, martialArts: 44, cursedEnergyControl: 42, talent: 40, constitution: 40 }
      },
      enemy_id: "enemy_special_grade",   // 指定考核怪物：特级咒灵
      enemy_name: "特级咒灵",
      cooldown_days: 3,
      cost: { ap: 40 },
      reward: {
        money: 1500,
        skillPoints: 12,
        newRank: "特级"
      },
      storyText: "「特级咒灵——咒术界的最高威胁等级。如果你能独自祓除它，你就是特级。」"
    }
  ]
};

/**
 * 获取比当前职级高一级的考核
 * @param {string} currentRank — 玩家当前职级
 * @returns {object|null} 考核配置，或 null（如果没有更高考核）
 */
export function getNextExam(currentRank) {
  const RANK_ORDER = ["不入流", "四级", "准三级", "三级", "准二级", "二级", "准一级", "一级", "特级", "现代最强"];
  const currentIdx = RANK_ORDER.indexOf(currentRank);
  if (currentIdx < 0) return null;

  const nextRank = RANK_ORDER[currentIdx + 1];
  if (!nextRank || nextRank === "现代最强") return null;

  const exam = EXAMS.promotions.find(e => e.target_rank === nextRank);
  return exam || null;
}

/**
 * 根据 enemy_id 获取考核怪物配置
 * @param {string} enemyId — 考核中指定的 enemy_id（如 "enemy_kuchisake"）
 * @returns {object|null} 怪物完整配置，或 null
 */
export async function getExamEnemy(enemyId) {
  // 动态导入 enemies.js 避免循环依赖
  const { ENEMIES } = await import('./enemies.js');
  for (const tier of Object.values(ENEMIES)) {
    const found = tier.find(e => e.id === enemyId);
    if (found) return found;
  }
  return null;
}
