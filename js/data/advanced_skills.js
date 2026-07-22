// js/data/advanced_skills.js — 高级技巧数据配置（Phase 11 新增）
// 定义简易领域、落花之情、弥虚葛笼等高级技巧的解锁条件与效果

export const ADVANCED_SKILLS = {
  // ================================================================
  //  简易领域 (Simple Domain)
  // ================================================================
  simple_domain: {
    id: "simple_domain",
    name: "简易领域",
    category: "domain_counter",
    description: "中和敌方领域必中效果的防御性高级技巧。张开一个弱化的领域外壳，以自身咒力抵消敌方领域的必中效果。虽然无法与真正的领域抗衡，但可以为战斗争取时间。",
    flavorText: "「新·阴流——简易领域。」——日下部笃也",
    buffId: "simple_domain",
    buffEffect: {
      shield_hp: 200,
      negate_domain_special: true,
      domain_damage_reduction: 0.0,
      mp_drain_per_10av: 2
    },
    requirements: {
      prerequisite: "simple_domain_basics",  // 必须向日下部请教的解锁基础
      inspiration: 1,
      cursed_energy_control: 30
    }
  },

  // ================================================================
  //  落花之情 (Falling Blossom Emotion)
  // ================================================================
  falling_blossom: {
    id: "falling_blossom",
    name: "落花之情",
    category: "domain_counter",
    description: "御三家咒术师代代相传的秘术。在敌方领域展开的瞬间，以自身咒力创造出自动反击术式，将涌来的必中效果全部打散。代价是消耗大量咒力。",
    flavorText: "「落花之情——以花为盾，以意为刃。」——禅院家秘传",
    buffId: "falling_blossom",
    buffEffect: {
      shield_hp: 0,
      negate_domain_special: true,
      domain_damage_reduction: 1.0,
      mp_drain_per_10av: 5,
      extra_mp_drain_on_hit: true
    },
    requirements: {
      prerequisite: null,                    // 落花之情不需要请教基础（御三家相传）
      inspiration: 2,
      cursed_energy_control: 40,
      talent: 35
    }
  },

  // ================================================================
  //  弥虚葛笼 (Hollow Wicker Basket)
  // ================================================================
  hollow_wicker: {
    id: "hollow_wicker",
    name: "弥虚葛笼",
    category: "domain_counter",
    description: "编织结界术创造出一个高度压缩的防御空间。虽然无法完全抹除领域的必中效果，但可以大幅削减领域带来的伤害。代价是极高的咒力消耗。",
    flavorText: "「结界术的最高秘义——弥虚葛笼。在笼中，对手的领域不过是一阵微风。」",
    buffId: "hollow_wicker",
    buffEffect: {
      shield_hp: 0,
      negate_domain_special: true,
      domain_damage_reduction: 0.8,
      mp_drain_per_10av: 8
    },
    requirements: {
      prerequisite: null,                    // 弥虚葛笼不需要请教基础
      inspiration: 2,
      cursed_energy_control: 45,
      constitution: 35
    }
  }
};

/**
 * 检查高级技巧是否已解锁
 * @param {string} skillId — 高级技巧 ID
 * @param {object} characterState — 玩家存档状态
 * @returns {{ unlocked: boolean, reason?: string }}
 */
export function checkAdvancedSkillUnlocked(skillId, characterState) {
  const skillDef = ADVANCED_SKILLS[skillId];
  if (!skillDef) {
    return { unlocked: false, reason: '未知的高级技巧。' };
  }

  const req = skillDef.requirements;
  const attrs = characterState.attributes || {};
  const inspiration = characterState.inspiration || 0;
  const unlockedPrereqs = characterState.advanced_skills_unlocked || [];

  // 检查前置请教基础
  if (req.prerequisite && !unlockedPrereqs.includes(req.prerequisite)) {
    return { unlocked: false, reason: `需要通过请教获得「${req.prerequisite}」基础。` };
  }

  // 检查灵感
  if (req.inspiration && inspiration < req.inspiration) {
    return { unlocked: false, reason: `灵感不足！需要 ${req.inspiration} 点灵感，当前 ${inspiration}。` };
  }

  // 检查咒力操控
  if (req.cursed_energy_control && (attrs.cursedEnergyControl || 0) < req.cursed_energy_control) {
    return { unlocked: false, reason: `咒力操控不足！需要 ${req.cursed_energy_control}，当前 ${attrs.cursedEnergyControl || 0}。` };
  }

  // 检查天赋
  if (req.talent && (attrs.talent || 0) < req.talent) {
    return { unlocked: false, reason: `天赋不足！需要 ${req.talent}，当前 ${attrs.talent || 0}。` };
  }

  // 检查体质
  if (req.constitution && (attrs.constitution || 0) < req.constitution) {
    return { unlocked: false, reason: `体质不足！需要 ${req.constitution}，当前 ${attrs.constitution || 0}。` };
  }

  return { unlocked: true };
}
