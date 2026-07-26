// js/data/skills.js — 完整技能树数据配置（Phase 6 扩展）
// 覆盖 8 种术式 + 领域骨架 + 分支技能系统

/**
 * 技能节点数据结构 (扩展):
 * {
 *   id, name, description, type, category, cost, damageMultiplier,
 *   castTime, baseRecoverySpeed, minDistance, maxDistance,
 *   isBaseSkill: boolean,      // 是否为术式基础技能（选择术式后自动获得 Lv.1）
 *   requires: string,          // 前置技能 ID（如"aoi"）
 *   requiresLevel: number,     // 前置技能需要达到的等级（如 3 = Lv.3 才解锁）
 *   branches: string[],        // 此技能解锁后方可解锁的分支技能 ID
 *   maxLevel: number,
 *   levelUpCosts: [{ level, skillPoints, proficiency }],
 *   levelEffects: [{ level, damageMultiplier, cost, castTime, recoverySpeed, specialEffects }]
 * }
 *
 * category 分类:
 * - martial（体术类）: 平A、黑闪等纯体术
 * - cursed_martial（咒力/体术类）: 咒力强化拳、血刃等含咒力的体术
 * - cursed_attack（咒力攻击类）: 苍、赫等远程咒术
 * - cursed_summon（咒力召唤类）: 十种影法术等召唤式神
 * - cursed_buff（咒力强化类）: 赤鳞跃动等自身buff（Phase 16 预留）
 * - cursed_control（咒力控制类）: 拍手换位等空间/操控类（Phase 16 预留）
 *
 * 领域骨架数据结构:
 * {
 *   id, name,
 *   unlockRequirements: { skillLevels: { aoi: 5, aka: 4 }, inspiration: 3 },
 *   flavorText: string
 * }
 */

// ================================================================
// 辅助函数
// ================================================================

const L = (level, dmg, cost, ct, rcv, bonus) => ({ level, damageMultiplier: dmg, cost, castTime: ct, recoverySpeed: rcv, bonus });
const C = (level, sp, prof) => ({ level, skillPoints: sp, proficiency: prof });

// ================================================================
// 完整技能树
// ================================================================

export const SKILL_TREES = {
  // ====================================================================
  //  无下限术式 (Limitless) — 五条悟系
  // ====================================================================
  limitless: {
    baseSkills: ["aoi", "aka"],
    domain: {
      id: "limitless_domain",
      name: "无量空处",
      flavorText: "将目标拉入无限的虚空之中，所有感知信息被无限放大，使其陷入完全无法行动的状态。",
      unlockRequirements: {
        skillLevels: { aoi: 6, aka: 5 },
        inspiration: 3,
        statRequirements: { cursedEnergyControl: 60, talent: 55 }
      }
    },
    nodes: [
      {
        id: "aoi", name: "苍", description: "术式顺转「苍」。产生强大的吸引力，将一切卷入空之涡。",
        type: "cursed", category: "cursed_attack", isBaseSkill: true, maxLevel: 10,
        requires: null, requiresLevel: 0, branches: ["aoi_strike", "aoi_max"],
        cost: 15, damageMultiplier: 2.2, castTime: 20, baseRecoverySpeed: 25,
        minDistance: 0, maxDistance: 3,
        // Phase 17: 完整咒词 — 吟唱更长但伤害更高
        fullChant: { castTime: 40, recoverySpeed: 15, damageMultiplier: 4.4, cursedEnergyCostMultiplier: 1.5 },
        levelUpCosts: [C(2,2,30), C(3,3,80), C(4,4,150), C(5,5,250), C(6,6,400), C(7,8,600), C(8,10,900), C(9,12,1300), C(10,15,2000)],
        levelEffects: [L(1,2.2,15,20,25,"基础苍"), L(2,2.4,14,19,26,""), L(3,2.6,13,18,27,""), L(4,2.9,12,17,28,""), L(5,3.2,11,16,29,""), L(6,3.5,10,15,30,""), L(7,3.9,9,14,31,""), L(8,4.3,8,13,32,""), L(9,4.8,7,12,33,""), L(10,5.3,6,10,35,"极致苍")]
      },
      {
        id: "aoi_strike", name: "苍·打击", description: "将「苍」凝缩至拳上，近身释放。威力集中但消耗更大。",
        type: "cursed", category: "cursed_attack", isBaseSkill: false, maxLevel: 5,
        requires: "aoi", requiresLevel: 3, branches: [],
        cost: 22, damageMultiplier: 3.0, castTime: 25, baseRecoverySpeed: 20,
        minDistance: 0, maxDistance: 0,
        levelUpCosts: [C(2,3,40), C(3,4,100), C(4,5,180), C(5,7,300)],
        levelEffects: [L(1,3.0,22,25,20,""), L(2,3.5,20,24,21,""), L(3,4.0,18,23,22,""), L(4,4.6,16,22,23,""), L(5,5.3,14,20,25,"")]
      },
      {
        id: "aoi_max", name: "苍·最大出力", description: "将苍的威力推向极致，咏唱时间长但破坏力惊人。",
        type: "cursed", category: "cursed_attack", isBaseSkill: false, maxLevel: 4,
        requires: "aoi", requiresLevel: 5, branches: [],
        cost: 30, damageMultiplier: 4.0, castTime: 35, baseRecoverySpeed: 15,
        minDistance: 0, maxDistance: 3,
        levelUpCosts: [C(2,5,80), C(3,7,150), C(4,10,250)],
        levelEffects: [L(1,4.0,30,35,15,""), L(2,4.6,28,33,16,""), L(3,5.3,26,31,17,""), L(4,6.2,24,28,18,"")]
      },
      {
        id: "aka", name: "赫", description: "术式反转「赫」。排斥一切的术式，远程大范围攻击。",
        type: "cursed", category: "cursed_attack", isBaseSkill: true, maxLevel: 8,
        requires: null, requiresLevel: 0, branches: ["aka_max"],
        // Phase 17: 反转术式前置
        unlockRequires: { advancedSkill: "rct" },
        cost: 25, damageMultiplier: 3.0, castTime: 30, baseRecoverySpeed: 18,
        minDistance: 1, maxDistance: 3,
        // Phase 17: 完整咒词
        fullChant: { castTime: 55, recoverySpeed: 10, damageMultiplier: 6.0, cursedEnergyCostMultiplier: 1.5 },
        levelUpCosts: [C(2,3,50), C(3,4,120), C(4,5,200), C(5,6,300), C(6,8,500), C(7,10,800), C(8,13,1200)],
        levelEffects: [L(1,3.0,25,30,18,""), L(2,3.3,23,29,19,""), L(3,3.7,21,28,20,""), L(4,4.2,19,26,21,""), L(5,4.8,17,24,22,""), L(6,5.5,15,22,23,""), L(7,6.3,13,20,24,""), L(8,7.3,11,18,25,"")]
      },
      {
        id: "aka_max", name: "赫·最大出力", description: "将赫的排斥力推向极致，范围与威力令人绝望。",
        type: "cursed", category: "cursed_attack", isBaseSkill: false, maxLevel: 4,
        requires: "aka", requiresLevel: 4, branches: [],
        cost: 40, damageMultiplier: 4.5, castTime: 40, baseRecoverySpeed: 12,
        minDistance: 1, maxDistance: 3,
        levelUpCosts: [C(2,5,100), C(3,8,200), C(4,12,350)],
        levelEffects: [L(1,4.5,40,40,12,""), L(2,5.2,37,38,13,""), L(3,6.0,34,35,14,""), L(4,7.0,30,32,15,"")]
      },
      {
        id: "murasaki", name: "虚式·茈", description: "苍与赫的融合——虚式「茈」。将空间本身撕裂的终极一击。",
        type: "cursed", category: "cursed_attack", isBaseSkill: false, maxLevel: 5,
        requires: "aka", requiresLevel: 5, branches: [],
        cost: 50, damageMultiplier: 6.0, castTime: 45, baseRecoverySpeed: 10,
        minDistance: 0, maxDistance: 3,
        // Phase 17: 完整咒词
        fullChant: { castTime: 80, recoverySpeed: 5, damageMultiplier: 12.0, cursedEnergyCostMultiplier: 1.8 },
        // Phase 17: Lv5 解锁无限制虚式茈
        ultimateAtLevel: 5,
        ultimateEffect: { name: "无限制虚式·茈", costRatio: 0.8, damageMultiplier: 18.0, selfHpCostRatio: 0.2 },
        levelUpCosts: [C(2,8,150), C(3,10,300), C(4,15,500), C(5,20,800)],
        levelEffects: [L(1,6.0,50,45,10,""), L(2,7.0,47,42,11,""), L(3,8.2,44,39,12,""), L(4,9.6,40,36,13,""), L(5,11.5,35,32,14,"")]
      }
    ]
  },

  // ====================================================================
  //  十划咒法 (Overtime) — 七海建人系
  // ====================================================================
  overtime: {
    baseSkills: ["weakness"],
    domain: null,
    nodes: [
      {
        id: "weakness", name: "十划咒法·基础弱点", description: "以7:3的比例强制制造弱点。攻击弱点时伤害提升。",
        type: "cursed", category: "cursed_martial", isBaseSkill: true, maxLevel: 6,
        requires: null, requiresLevel: 0, branches: ["ratio_strike", "collapse"],
        cost: 8, damageMultiplier: 1.3, castTime: 10, baseRecoverySpeed: 30,
        minDistance: 0, maxDistance: 1,
        levelUpCosts: [C(2,2,25), C(3,3,70), C(4,4,130), C(5,6,200), C(6,8,350)],
        levelEffects: [L(1,1.3,8,10,30,""), L(2,1.5,7,10,31,""), L(3,1.7,7,9,32,""), L(4,2.0,6,9,33,""), L(5,2.3,5,8,34,""), L(6,2.7,5,8,35,"")]
      },
      {
        id: "ratio_strike", name: "咒力钝器·七三", description: "以咒力包裹钝器，精准打击对手弱点部位。",
        type: "cursed", category: "cursed_martial", isBaseSkill: false, maxLevel: 5,
        requires: "weakness", requiresLevel: 2, branches: [],
        cost: 14, damageMultiplier: 2.0, castTime: 15, baseRecoverySpeed: 25,
        minDistance: 0, maxDistance: 0,
        levelUpCosts: [C(2,3,40), C(3,4,100), C(4,6,180), C(5,8,300)],
        levelEffects: [L(1,2.0,14,15,25,""), L(2,2.3,13,14,26,""), L(3,2.7,12,13,27,""), L(4,3.1,11,12,28,""), L(5,3.6,10,11,30,"")]
      },
      {
        id: "collapse", name: "咒力钝器·瓦解", description: "对弱点部位进行强力打击，大幅削弱对手防御。",
        type: "cursed", category: "cursed_martial", isBaseSkill: false, maxLevel: 4,
        requires: "weakness", requiresLevel: 3, branches: [],
        cost: 18, damageMultiplier: 2.5, castTime: 20, baseRecoverySpeed: 20,
        minDistance: 0, maxDistance: 0,
        levelUpCosts: [C(2,4,60), C(3,6,140), C(4,8,250)],
        levelEffects: [L(1,2.5,18,20,20,"无视30%防御"), L(2,2.9,16,19,21,"无视30%防御"), L(3,3.4,14,18,22,"无视40%防御"), L(4,4.0,12,16,24,"无视50%防御")]
      },
      {
        id: "overtime", name: "极之番·Overtime", description: "开启加班模式！攻击力与速度大幅提升，但持续消耗大量咒力。",
        type: "cursed", category: "cursed_buff", isBaseSkill: false, maxLevel: 4,
        requires: "weakness", requiresLevel: 5, branches: [],
        cost: 25, damageMultiplier: 3.5, castTime: 25, baseRecoverySpeed: 18,
        minDistance: 0, maxDistance: 1,
        levelUpCosts: [C(2,6,120), C(3,8,250), C(4,12,450)],
        levelEffects: [L(1,3.5,25,25,18,""), L(2,4.1,22,23,19,""), L(3,4.8,19,21,20,""), L(4,5.7,16,19,22,"")]
      }
    ]
  },

  // ====================================================================
  //  十种影法术 (Ten Shadows) — 禅院/伏黑系
  // ====================================================================
  tenShadows: {
    baseSkills: ["gyokuken"],
    domain: {
      id: "ten_shadows_domain",
      name: "嵌合暗翳庭",
      flavorText: "影子覆盖一切，十种式神可以在领域中自由进出影子的世界。",
      unlockRequirements: {
        skillLevels: { gyokuken: 5, nue: 4, max_elephant: 2 },
        inspiration: 2,
        statRequirements: { cursedEnergy: 50, cursedEnergyControl: 45 }
      }
    },
    nodes: [
      {
        id: "gyokuken", name: "玉犬", description: "召唤黑白玉犬协助战斗。玉犬会自动撕咬敌人，是最忠诚的式神伙伴。",
        type: "summon", category: "cursed_summon", isBaseSkill: true, maxLevel: 6,
        requires: null, requiresLevel: 0, branches: ["nue", "orochi"],
        cost: 30, damageMultiplier: 0, castTime: 25, baseRecoverySpeed: 20,
        minDistance: 0, maxDistance: 3,
        summonConfig: {
          unitType: "shikigami",
          name: "玉犬",
          max_count: 2, domain_boost_extra: 1,
          baseStats: { hp: 80, max_hp: 80, mp: 20, max_mp: 20, speed: 15, constitution: 12, martialArts: 25, cursedEnergy: 5, cursedEnergyControl: 5, cursedEnergyEfficiency: 5, talent: 8 },
          skills: [
            { id: "shikigami_bite", name: "撕咬", type: "martial", damageMultiplier: 1.5, cost: 0, castTime: 10, baseRecoverySpeed: 25, minDistance: 0, maxDistance: 0, description: "用利齿撕咬目标" }
          ],
          duration: 300
        },
        levelUpCosts: [C(2,2,25), C(3,3,70), C(4,4,140), C(5,6,220), C(6,8,380)],
        levelEffects: [L(1,0,30,25,20,"召唤玉犬"), L(2,0,28,23,21,"玉犬HP+10%"), L(3,0,26,21,22,"玉犬攻击+10%"), L(4,0,24,19,23,"玉犬HP+20%"), L(5,0,22,17,24,"玉犬攻击+20%"), L(6,0,20,15,25,"玉犬全属性+25%")]
      },
      {
        id: "nue", name: "鵺", description: "召唤鵺从空中俯冲攻击。鵺是具备飞行能力的式神，可全距离攻击并附带雷电。",
        type: "summon", category: "cursed_summon", isBaseSkill: false, maxLevel: 5,
        requires: "gyokuken", requiresLevel: 1, branches: ["max_elephant"],
        cost: 35, damageMultiplier: 0, castTime: 30, baseRecoverySpeed: 18,
        minDistance: 0, maxDistance: 3,
        summonConfig: {
          unitType: "shikigami",
          name: "鵺",
          max_count: 1, domain_boost_extra: 1,
          baseStats: { hp: 60, max_hp: 60, mp: 30, max_mp: 30, speed: 20, constitution: 8, martialArts: 20, cursedEnergy: 15, cursedEnergyControl: 12, cursedEnergyEfficiency: 10, talent: 12 },
          skills: [
            { id: "shikigami_dive", name: "俯冲", type: "martial", damageMultiplier: 2.0, cost: 0, castTime: 12, baseRecoverySpeed: 22, minDistance: 0, maxDistance: 3, description: "从空中俯冲攻击" },
            { id: "shikigami_shock", name: "电击", type: "cursed", damageMultiplier: 1.8, cost: 10, castTime: 16, baseRecoverySpeed: 18, minDistance: 1, maxDistance: 3, description: "释放雷电攻击远处目标" }
          ],
          duration: 300
        },
        levelUpCosts: [C(2,3,40), C(3,4,100), C(4,6,180), C(5,8,300)],
        levelEffects: [L(1,0,35,30,18,"召唤鵺"), L(2,0,33,28,19,"鵺速度+10%"), L(3,0,31,26,20,"鵺攻击+10%"), L(4,0,29,24,21,"鵺HP+15%"), L(5,0,27,22,23,"鵺电击强化+20%")]
      },
      {
        id: "orochi", name: "大蛇", description: "召唤巨蛇缠住对手，每回合造成持续伤害并限制目标移动。",
        type: "summon", category: "cursed_summon", isBaseSkill: false, maxLevel: 4,
        requires: "gyokuken", requiresLevel: 2, branches: [],
        cost: 30, damageMultiplier: 0, castTime: 25, baseRecoverySpeed: 20,
        minDistance: 0, maxDistance: 2,
        summonConfig: {
          unitType: "shikigami",
          name: "大蛇",
          baseStats: { hp: 100, max_hp: 100, mp: 15, max_mp: 15, speed: 10, constitution: 16, martialArts: 22, cursedEnergy: 8, cursedEnergyControl: 8, cursedEnergyEfficiency: 5, talent: 8 },
          skills: [
            { id: "shikigami_constrict", name: "缠绕", type: "martial", damageMultiplier: 1.5, cost: 0, castTime: 14, baseRecoverySpeed: 22, minDistance: 0, maxDistance: 1, description: "缠绕目标造成持续伤害", dotDamage: 8, dotTurns: 2 }
          ],
          duration: 350
        },
        levelUpCosts: [C(2,3,50), C(3,5,120), C(4,7,220)],
        levelEffects: [L(1,0,30,25,20,"召唤大蛇"), L(2,0,28,23,21,"大蛇缠绕伤害+20%"), L(3,0,26,21,22,"缠绕持续3回合"), L(4,0,24,19,23,"大蛇HP+20%&缠绕强化")]
      },
      {
        id: "max_elephant", name: "满象", description: "召唤满象以巨大的体重碾压对手，是十种影法术中体型最大的式神之一。",
        type: "summon", category: "cursed_summon", isBaseSkill: false, maxLevel: 4,
        requires: "nue", requiresLevel: 2, branches: ["tora_no_fun"],
        cost: 40, damageMultiplier: 0, castTime: 35, baseRecoverySpeed: 15,
        minDistance: 0, maxDistance: 2,
        summonConfig: {
          unitType: "shikigami",
          name: "满象",
          baseStats: { hp: 150, max_hp: 150, mp: 10, max_mp: 10, speed: 8, constitution: 22, martialArts: 30, cursedEnergy: 5, cursedEnergyControl: 5, cursedEnergyEfficiency: 3, talent: 6 },
          skills: [
            { id: "shikigami_crush", name: "碾压", type: "martial", damageMultiplier: 2.5, cost: 0, castTime: 18, baseRecoverySpeed: 16, minDistance: 0, maxDistance: 2, description: "以巨大身躯碾压目标，无视30%防御" }
          ],
          duration: 300
        },
        levelUpCosts: [C(2,4,80), C(3,6,160), C(4,8,280)],
        levelEffects: [L(1,0,40,35,15,"召唤满象"), L(2,0,38,33,16,"满象防御+15%"), L(3,0,36,31,17,"碾压伤害+15%"), L(4,0,34,29,18,"满象HP+20%&无视40%防御")]
      },
      {
        id: "tora_no_fun", name: "虎葬", description: "召唤虎形式神，以闪电般的速度突袭对手。虎葬是十种影法术中速度最快的式神。",
        type: "summon", category: "cursed_summon", isBaseSkill: false, maxLevel: 3,
        requires: "max_elephant", requiresLevel: 2, branches: [],
        cost: 35, damageMultiplier: 0, castTime: 25, baseRecoverySpeed: 18,
        minDistance: 0, maxDistance: 3,
        summonConfig: {
          unitType: "shikigami",
          name: "虎葬",
          baseStats: { hp: 70, max_hp: 70, mp: 20, max_mp: 20, speed: 25, constitution: 10, martialArts: 28, cursedEnergy: 10, cursedEnergyControl: 10, cursedEnergyEfficiency: 8, talent: 14 },
          skills: [
            { id: "shikigami_rush", name: "突袭", type: "martial", damageMultiplier: 2.2, cost: 0, castTime: 8, baseRecoverySpeed: 26, minDistance: 0, maxDistance: 3, description: "闪电突袭目标，先制攻击" }
          ],
          duration: 250
        },
        levelUpCosts: [C(2,5,100), C(3,8,200)],
        levelEffects: [L(1,0,35,25,18,"召唤虎葬·先制"), L(2,0,32,23,19,"虎葬速度+15%"), L(3,0,29,21,21,"突袭伤害+20%")]
      },
      {
        id: "makora", name: "魔虚罗（未降伏）", description: "十种影法术的终极式神。调伏失败——每次使用可能反噬自身。",
        type: "cursed", category: "cursed_summon", isBaseSkill: false, maxLevel: 3,
        requires: "gyokuken", requiresLevel: 6, branches: [],
        cost: 60, damageMultiplier: 8.0, castTime: 60, baseRecoverySpeed: 5,
        minDistance: 0, maxDistance: 3,
        levelUpCosts: [C(2,15,400), C(3,25,800)],
        levelEffects: [L(1,8.0,60,60,5,"50%概率反噬"), L(2,10.0,55,55,6,"40%概率反噬"), L(3,12.5,50,50,7,"30%概率反噬")]
      }
    ]
  },

  // ====================================================================
  //  赤血操术 (Blood Manipulation) — 加茂/胀相系
  // ====================================================================
  bloodManipulation: {
    baseSkills: ["blood_blade"],
    domain: null,
    nodes: [
      {
        id: "blood_blade", name: "血刃", description: "以自身血液凝结为利刃进行攻击。消耗微量HP。",
        type: "cursed", category: "cursed_martial", isBaseSkill: true, maxLevel: 6,
        requires: null, requiresLevel: 0, branches: ["slicing_exorcism", "piercing_blood"],
        cost: 8, damageMultiplier: 1.4, castTime: 12, baseRecoverySpeed: 28,
        minDistance: 0, maxDistance: 1,
        levelUpCosts: [C(2,2,25), C(3,3,70), C(4,4,140), C(5,6,220), C(6,8,380)],
        levelEffects: [L(1,1.4,8,12,28,"消耗3HP"), L(2,1.7,7,11,29,"消耗3HP"), L(3,2.0,6,11,30,"消耗2HP"), L(4,2.4,6,10,31,"消耗2HP"), L(5,2.8,5,9,32,"消耗1HP"), L(6,3.3,4,8,33,"消耗1HP")]
      },
      {
        id: "slicing_exorcism", name: "血涂", description: "将血液化作无数细线，切割接触的一切。",
        type: "cursed", category: "cursed_attack", isBaseSkill: false, maxLevel: 4,
        requires: "blood_blade", requiresLevel: 2, branches: [],
        cost: 14, damageMultiplier: 1.8, castTime: 16, baseRecoverySpeed: 24,
        minDistance: 0, maxDistance: 2,
        levelUpCosts: [C(2,3,50), C(3,5,120), C(4,7,220)],
        levelEffects: [L(1,1.8,14,16,24,"消耗5HP"), L(2,2.1,12,15,25,"消耗4HP"), L(3,2.5,10,14,26,"消耗4HP"), L(4,3.0,8,12,27,"消耗3HP")]
      },
      {
        id: "piercing_blood", name: "穿血", description: "以高压血箭贯穿目标。全距离适用，穿刺伤害。极短咏唱。",
        type: "cursed", category: "cursed_attack", isBaseSkill: false, maxLevel: 6,
        requires: "blood_blade", requiresLevel: 3, branches: ["supernova", "crimson_binding", "blood_armor"],
8221        summonConfig: {
8222          unitType: "shikigami",8221        summonConfig: {
        minDistance: 0, maxDistance: 3,
        levelUpCosts: [C(2,3,60), C(3,4,140), C(4,6,250), C(5,8,400), C(6,10,600)],
        levelEffects: [L(1,2.0,14,5,10,""), L(2,2.3,13,5,10,""), L(3,2.7,12,5,10,""), L(4,3.2,11,5,10,""), L(5,3.8,10,5,10,""), L(6,4.5,9,5,10,"")]
      },
      {
        id: "blood_armor", name: "血铠", description: "以凝固血液形成铠甲，大幅降低受到的伤害。",
        type: "cursed", category: "cursed_buff", isBaseSkill: false, maxLevel: 3,
        requires: "piercing_blood", requiresLevel: 3, branches: [],
        cost: 40, damageMultiplier: 0, castTime: 15, baseRecoverySpeed: 20,
        minDistance: 0, maxDistance: 0,
        // Phase 17: self buff — 持续 40 AV, 伤害减免 25%~40%
        buffEffect: { type: "damage_reduction", value: 0.25, duration: 40 },
        levelUpCosts: [C(2,5,100), C(3,8,200)],
        levelEffects: [L(1,0,40,15,20,"减伤25%"), L(2,0,37,14,21,"减伤33%"), L(3,0,34,13,23,"减伤40%")]
      },
      {
        id: "blood_bind", name: "血缚", description: "以血液束缚敌人的行动，降低对方 ATB 填充速度。",
        type: "cursed", category: "cursed_control", isBaseSkill: false, maxLevel: 3,
        requires: "blood_blade", requiresLevel: 2, branches: [],
        cost: 30, damageMultiplier: 0, castTime: 18, baseRecoverySpeed: 18,
        minDistance: 0, maxDistance: 2,
        // Phase 17: 对敌 debuff — 持续 60 AV, 减速 20%~40%
        debuffEffect: { type: "speed_debuff", value: 0.20, duration: 60 },
        levelUpCosts: [C(2,4,80), C(3,6,160)],
        levelEffects: [L(1,0,30,18,18,"减速20%"), L(2,0,27,16,19,"减速30%"), L(3,0,24,14,20,"减速40%")]
      },
      {
        id: "supernova", name: "超新星", description: "将凝固的血液以超高速度射出，造成毁灭性打击。",
        type: "cursed", category: "cursed_attack", isBaseSkill: false, maxLevel: 4,
        requires: "piercing_blood", requiresLevel: 3, branches: [],
        cost: 22, damageMultiplier: 3.0, castTime: 22, baseRecoverySpeed: 18,
        minDistance: 0, maxDistance: 3,
        levelUpCosts: [C(2,5,100), C(3,8,200), C(4,12,380)],
        levelEffects: [L(1,3.0,22,22,18,"消耗10HP"), L(2,3.6,20,20,19,"消耗8HP"), L(3,4.3,18,18,20,"消耗8HP"), L(4,5.2,16,16,22,"消耗6HP")]
      },
      {
        id: "crimson_binding", name: "赤鳞跃动", description: "全面强化身体机能，提升ATB填充速度与伤害输出。",
        type: "cursed", category: "cursed_buff", isBaseSkill: false, maxLevel: 3,
        requires: "piercing_blood", requiresLevel: 2, branches: [],
        cost: 20, damageMultiplier: 2.2, castTime: 18, baseRecoverySpeed: 22,
        minDistance: 0, maxDistance: 0,
        // Phase 17: speed_boost buff — 持续 100 AV, 加速 30%~50%
        buffEffect: { type: "speed_boost", value: 0.30, duration: 100 },
        levelUpCosts: [C(2,4,80), C(3,6,180)],
        levelEffects: [L(1,2.2,20,18,22,"加速30%"), L(2,2.6,18,16,23,"加速40%"), L(3,3.1,16,14,25,"加速50%")]
      },
      {
        id: "canal", name: "运河", description: "在战场上布下血液的轨迹，限制敌人移动并造成持续伤害。",
        type: "cursed", category: "cursed_control", isBaseSkill: false, maxLevel: 4,
        requires: "blood_blade", requiresLevel: 4, branches: [],
        cost: 16, damageMultiplier: 2.0, castTime: 20, baseRecoverySpeed: 20,
        minDistance: 0, maxDistance: 3,
        levelUpCosts: [C(2,3,70), C(3,5,150), C(4,8,280)],
        levelEffects: [L(1,2.0,16,20,20,"限制移动1格"), L(2,2.4,14,18,21,"限制移动1格"), L(3,2.9,12,16,22,"限制移动2格"), L(4,3.5,10,14,23,"限制移动2格")]
      }
    ]
  },

  // ====================================================================
  //  不义游戏 (Boogie Woogie) — 东堂葵系
  // ====================================================================
  boogieWoogie: {
    baseSkills: ["clap_swap"],
    domain: {
      id: "boogie_domain",
      name: "不义游戏·领域",
      flavorText: "领域范围内的一切物体都可以被随意交换位置，形成绝对的空间控制。",
      unlockRequirements: {
        skillLevels: { clap_swap: 6, tactical_combo: 4 },
        inspiration: 2,
        statRequirements: { martialArts: 50, cursedEnergyEfficiency: 45 }
      }
    },
    nodes: [
      {
        id: "clap_swap", name: "拍手换位", description: "拍手即可交换自己与目标的位置。战术灵活性极高。",
        type: "cursed", category: "cursed_control", isBaseSkill: true, maxLevel: 6,
        requires: null, requiresLevel: 0, branches: ["tactical_combo"],
        cost: 6, damageMultiplier: 1.2, castTime: 8, baseRecoverySpeed: 32,
        minDistance: 0, maxDistance: 3,
        levelUpCosts: [C(2,2,20), C(3,3,60), C(4,4,120), C(5,6,200), C(6,8,350)],
        levelEffects: [L(1,1.2,6,8,32,""), L(2,1.4,5,7,33,""), L(3,1.7,5,7,34,""), L(4,2.0,4,6,35,""), L(5,2.4,3,6,36,""), L(6,2.8,3,5,38,"")]
      },
      {
        id: "tactical_combo", name: "战术连携", description: "利用位置交换后的有利位置进行连续攻击。",
        type: "cursed", category: "cursed_martial", isBaseSkill: false, maxLevel: 5,
        requires: "clap_swap", requiresLevel: 2, branches: [],
        cost: 12, damageMultiplier: 2.0, castTime: 12, baseRecoverySpeed: 28,
        minDistance: 0, maxDistance: 0,
        levelUpCosts: [C(2,3,40), C(3,4,100), C(4,6,180), C(5,8,300)],
        levelEffects: [L(1,2.0,12,12,28,""), L(2,2.4,11,11,29,""), L(3,2.8,10,10,30,""), L(4,3.3,9,9,31,""), L(5,3.9,8,8,33,"")]
      }
    ]
  },

  // ====================================================================
  //  咒灵操术 (Curse Manipulation) — 夏油杰系
  // ====================================================================
  curseManipulation: {
    baseSkills: ["curse_absorb"],
    domain: {
      id: "curse_manip_domain",
      name: "极之番·漩涡",
      flavorText: "将所有吸收的咒灵融为一体，化作毁灭性的诅咒漩涡。",
      unlockRequirements: {
        skillLevels: { curse_absorb: 5, uzumaki_pseudo: 3 },
        inspiration: 3,
        statRequirements: { cursedEnergy: 60, cursedEnergyControl: 55 }
      }
    },
    nodes: [
      {
        id: "curse_absorb", name: "基础吞噬", description: "吞噬低级咒灵，将其转化为自身可用的咒力。",
        type: "cursed", category: "cursed_martial", isBaseSkill: true, maxLevel: 6,
        requires: null, requiresLevel: 0, branches: ["curse_sphere", "uzumaki_pseudo"],
        cost: 10, damageMultiplier: 1.2, castTime: 12, baseRecoverySpeed: 28,
        minDistance: 0, maxDistance: 2,
        levelUpCosts: [C(2,2,25), C(3,3,70), C(4,4,140), C(5,6,220), C(6,8,380)],
        levelEffects: [L(1,1.2,10,12,28,""), L(2,1.4,9,11,29,""), L(3,1.7,8,11,30,""), L(4,2.0,7,10,31,""), L(5,2.4,6,9,32,""), L(6,2.9,5,8,33,"")]
      },
      {
        id: "curse_sphere", name: "咒灵玉储存", description: "将咒灵压缩为咒灵玉储存，战斗中一次性释放大量咒力。",
        type: "cursed", category: "cursed_attack", isBaseSkill: false, maxLevel: 4,
        requires: "curse_absorb", requiresLevel: 2, branches: [],
        cost: 20, damageMultiplier: 2.5, castTime: 22, baseRecoverySpeed: 20,
        minDistance: 0, maxDistance: 3,
        levelUpCosts: [C(2,4,60), C(3,6,140), C(4,8,250)],
        levelEffects: [L(1,2.5,20,22,20,""), L(2,3.0,18,20,21,""), L(3,3.6,16,18,22,""), L(4,4.3,14,16,23,"")]
      },
      {
        id: "uzumaki_pseudo", name: "极之番·伪", description: "将吸收的咒灵全部释放为一次强力攻击。",
        type: "cursed", category: "cursed_attack", isBaseSkill: false, maxLevel: 4,
        requires: "curse_absorb", requiresLevel: 3, branches: [],
        cost: 35, damageMultiplier: 4.0, castTime: 30, baseRecoverySpeed: 14,
        minDistance: 0, maxDistance: 3,
        levelUpCosts: [C(2,6,120), C(3,8,250), C(4,12,450)],
        levelEffects: [L(1,4.0,35,30,14,""), L(2,4.8,32,28,15,""), L(3,5.7,29,26,16,""), L(4,6.8,26,24,17,"")]
      }
    ]
  },

  // ====================================================================
  //  傀儡操术 (Straw Doll) — 冥冥系
  // ====================================================================
  strawDoll: {
    baseSkills: ["doll_basic"],
    domain: null,
    nodes: [
      {
        id: "doll_basic", name: "基础操术", description: "以咒力操控人偶进行中距离攻击。",
        type: "cursed", category: "cursed_attack", isBaseSkill: true, maxLevel: 6,
        requires: null, requiresLevel: 0, branches: ["doll_scout", "doll_resonance"],
        cost: 10, damageMultiplier: 1.5, castTime: 14, baseRecoverySpeed: 26,
        minDistance: 0, maxDistance: 2,
        levelUpCosts: [C(2,2,25), C(3,3,70), C(4,4,140), C(5,6,220), C(6,8,380)],
        levelEffects: [L(1,1.5,10,14,26,""), L(2,1.8,9,13,27,""), L(3,2.1,8,13,28,""), L(4,2.5,7,12,29,""), L(5,2.9,6,11,30,""), L(6,3.4,5,10,31,"")]
      },
      {
        id: "doll_scout", name: "远程侦查", description: "操控人偶进行远程侦查，获取敌人信息并干扰其行动。",
        type: "cursed", category: "cursed_control", isBaseSkill: false, maxLevel: 4,
        requires: "doll_basic", requiresLevel: 2, branches: [],
        cost: 12, damageMultiplier: 1.6, castTime: 16, baseRecoverySpeed: 24,
        minDistance: 1, maxDistance: 3,
        levelUpCosts: [C(2,3,50), C(3,4,120), C(4,6,220)],
        levelEffects: [L(1,1.6,12,16,24,""), L(2,1.9,10,15,25,""), L(3,2.3,8,14,26,""), L(4,2.7,6,12,28,"")]
      },
      {
        id: "doll_resonance", name: "共鸣", description: "以傀儡共鸣释放远程咒力冲击，全距离适用。",
        type: "cursed", category: "cursed_attack", isBaseSkill: false, maxLevel: 5,
        requires: "doll_basic", requiresLevel: 2, branches: ["doll_overload"],
        cost: 13, damageMultiplier: 1.9, castTime: 18, baseRecoverySpeed: 22,
        minDistance: 0, maxDistance: 3,
        levelUpCosts: [C(2,3,40), C(3,4,100), C(4,6,180), C(5,8,300)],
        levelEffects: [L(1,1.9,13,18,22,""), L(2,2.2,11,17,23,""), L(3,2.6,9,16,24,""), L(4,3.1,8,14,25,""), L(5,3.7,6,13,26,"")]
      },
      {
        id: "doll_overload", name: "傀儡自爆", description: "引爆傀儡，对敌人造成巨量伤害，但傀儡损坏后需要重新制作。",
        type: "cursed", category: "cursed_attack", isBaseSkill: false, maxLevel: 3,
        requires: "doll_resonance", requiresLevel: 3, branches: [],
        cost: 30, damageMultiplier: 5.0, castTime: 30, baseRecoverySpeed: 10,
        minDistance: 1, maxDistance: 2,
        levelUpCosts: [C(2,6,150), C(3,10,300)],
        levelEffects: [L(1,5.0,30,30,10,"消耗1傀儡"), L(2,6.0,26,28,11,"消耗1傀儡"), L(3,7.3,22,25,12,"消耗1傀儡")]
      }
    ]
  },

  // ====================================================================
  //  纯体术流 (Pure Martial) — 甚尔/虎杖系
  // ====================================================================
  pureMartial: {
    baseSkills: ["martial_combo"],
    domain: {
      id: "heavenly_body",
      name: "天与咒缚·体",
      flavorText: "以完全丧失咒力为代价，换取超越极限的肉体能力。这已经是另一个次元的战斗了。",
      unlockRequirements: {
        skillLevels: { martial_combo: 6, black_flash_boost: 3 },
        inspiration: 1,
        statRequirements: { martialArts: 70, constitution: 60 }
      }
    },
    nodes: [
      {
        id: "martial_combo", name: "体术连击", description: "高速近身连击，不消耗咒力。体术流的根基。",
        type: "martial", category: "martial", isBaseSkill: true, maxLevel: 8,
        requires: null, requiresLevel: 0, branches: ["black_flash_boost", "rush_strike"],
        cost: 0, damageMultiplier: 1.2, castTime: 8, baseRecoverySpeed: 30,
        minDistance: 0, maxDistance: 0,
        levelUpCosts: [C(2,1,30), C(3,2,80), C(4,3,150), C(5,4,250), C(6,6,400), C(7,8,600), C(8,10,1000)],
        levelEffects: [L(1,1.2,0,8,30,""), L(2,1.4,0,7,31,""), L(3,1.7,0,7,32,""), L(4,2.0,0,6,33,""), L(5,2.4,0,5,34,""), L(6,2.8,0,5,35,""), L(7,3.3,0,4,36,""), L(8,3.9,0,4,38,"")]
      },
      {
        id: "black_flash_boost", name: "黑闪强化", description: "通过特训提升黑闪触发概率。被动效果，战斗中自动生效。",
        type: "martial", category: "martial", isBaseSkill: false, maxLevel: 5,
        requires: "martial_combo", requiresLevel: 2, branches: [],
        cost: 0, damageMultiplier: 1.5, castTime: 6, baseRecoverySpeed: 32,
        minDistance: 0, maxDistance: 0,
        levelUpCosts: [C(2,2,50), C(3,3,120), C(4,5,200), C(5,7,350)],
        levelEffects: [L(1,1.5,0,6,32,"黑闪率+2%"), L(2,1.8,0,5,33,"黑闪率+4%"), L(3,2.2,0,5,34,"黑闪率+6%"), L(4,2.6,0,4,35,"黑闪率+8%"), L(5,3.1,0,4,36,"黑闪率+10%")]
      },
      {
        id: "rush_strike", name: "疾风突袭", description: "以压倒性的速度进行突袭，无视部分防御。",
        type: "martial", category: "martial", isBaseSkill: false, maxLevel: 5,
        requires: "martial_combo", requiresLevel: 3, branches: [],
        cost: 0, damageMultiplier: 2.0, castTime: 10, baseRecoverySpeed: 26,
        minDistance: 0, maxDistance: 1,
        levelUpCosts: [C(2,3,60), C(3,4,140), C(4,6,250), C(5,8,400)],
        levelEffects: [L(1,2.0,0,10,26,"无视20%防御"), L(2,2.4,0,9,27,"无视25%防御"), L(3,2.9,0,8,28,"无视30%防御"), L(4,3.5,0,7,29,"无视35%防御"), L(5,4.2,0,6,30,"无视40%防御")]
      }
    ]
  },

  // ====================================================================
  //  咒力强化术 (默认术式)
  // ====================================================================
  cursedEnergyBoost: {
    baseSkills: ["cursed_boost"],
    domain: null,
    nodes: [
      {
        id: "cursed_boost", name: "咒力强化拳", description: "以咒力强化拳击，朴实但有效。",
        type: "cursed", category: "cursed_martial", isBaseSkill: true, maxLevel: 6,
        requires: null, requiresLevel: 0, branches: [],
        cost: 10, damageMultiplier: 1.8, castTime: 12, baseRecoverySpeed: 28,
        minDistance: 0, maxDistance: 0,
        levelUpCosts: [C(2,1,20), C(3,2,60), C(4,3,120), C(5,5,200), C(6,7,350)],
        levelEffects: [L(1,1.8,10,12,28,""), L(2,2.1,9,11,29,""), L(3,2.4,8,11,30,""), L(4,2.7,7,10,31,""), L(5,3.1,6,9,32,""), L(6,3.6,5,8,33,"")]
      }
    ]
  },

  // ====================================================================
  //  Phase 17: 坐杀博徒 (Hakari's Gambling) — 全新赌狗术式
  // ====================================================================
  hakariGambling: {
    baseSkills: ["steel_ball", "gambling_door"],
    domain: {
      id: "hakari_domain",
      name: "坐杀博徒",
      flavorText: "将一切赌在概率之上——中大奖则逆转战局，未中则继续押注。",
      // Phase 17: 不完全领域门槛降低 30%
      incompleteRequirements: {
        techniqueLevel: 3,
        barrierLevel: 3,
        inspiration: 1,
        cursedEnergyControl: 25
      },
      completeRequirements: {
        techniqueLevel: 5,
        barrierLevel: 5,
        inspiration: 2,
        cursedEnergyControl: 40
      },
      // 领域攻击力为 0 — 特殊效果替代伤害
      baseStats: { hpPerBarrier: 40, hpPerCEC: 3, intervalBase: 15, damagePerTech: 0, mpCostPerTick: 3 }
    },
    nodes: [
      {
        id: "steel_ball", name: "小钢珠", description: "投掷咒力凝缩的钢珠，可叠加提升后续体术伤害。",
        type: "cursed", category: "cursed_buff", isBaseSkill: true, maxLevel: 3,
        requires: null, requiresLevel: 0, branches: ["gambling_door"],
        cost: 10, damageMultiplier: 1.0, castTime: 8, baseRecoverySpeed: 30,
        minDistance: 1, maxDistance: 3,
        // Phase 17: 叠层 buff — 每层 +10% 体术伤害 (满级 +20%)
        buffEffect: { type: "steel_ball_stack", value: 0.10, maxStacks: 5 },
        levelUpCosts: [C(2,2,40), C(3,3,100)],
        levelEffects: [L(1,1.0,10,8,30,"每层+10%体术"), L(2,1.2,10,8,30,"每层+15%体术"), L(3,1.5,10,8,30,"每层+20%体术")]
      },
      {
        id: "gambling_door", name: "门", description: "以咒力击穿空间的近战一击。朴实但骰子已握在手中。",
        type: "cursed", category: "cursed_martial", isBaseSkill: false, maxLevel: 5,
        requires: "steel_ball", requiresLevel: 1, branches: [],
        cost: 15, damageMultiplier: 1.2, castTime: 10, baseRecoverySpeed: 28,
        minDistance: 0, maxDistance: 1,
        levelUpCosts: [C(2,2,30), C(3,3,80), C(4,4,150), C(5,6,250)],
        levelEffects: [L(1,1.2,15,10,28,""), L(2,1.5,14,9,29,""), L(3,1.8,13,8,30,""), L(4,2.2,12,7,31,""), L(5,2.6,11,6,32,"")]
      }
    ]
  }
};

// ================================================================
//  通用基础技能
// ================================================================
export const BASE_SKILLS = {
  attack: {
    id: "attack", name: "体术平A", description: "基础体术攻击，不消耗咒力。",
    type: "martial", category: "martial", cost: 0, damageMultiplier: 1.0,
    castTime: 5, baseRecoverySpeed: 30, minDistance: 0, maxDistance: 0,
    isDefault: true, requires: null,
    levelUpCosts: [C(2,1,30), C(3,2,80), C(4,3,150)],
    levelEffects: [L(1,1.0,0,5,30,""), L(2,1.2,0,5,31,""), L(3,1.4,0,4,32,""), L(4,1.7,0,4,33,"")]
  },
  advance: {
    id: "advance", name: "逼近", description: "向敌人逼近 1 档距离。",
    type: "movement", category: null, cost: 0, damageMultiplier: 0,
    castTime: 3, baseRecoverySpeed: 35, minDistance: 0, maxDistance: 3,
    isDefault: true, requires: null, levelUpCosts: [],
    levelEffects: [L(1,0,0,3,35,"")]
  },
  retreat: {
    id: "retreat", name: "后退", description: "向后退开 1 档距离。",
    type: "movement", category: null, cost: 0, damageMultiplier: 0,
    castTime: 3, baseRecoverySpeed: 35, minDistance: 0, maxDistance: 3,
    isDefault: true, requires: null, levelUpCosts: [],
    levelEffects: [L(1,0,0,3,35,"")]
  }
};

// ================================================================
//  Phase 6: 增强辅助函数
// ================================================================

/**
 * 构建所有技能的索引（基础技能 + 所有术式树的所有节点）
 */
function _allSkillsIndex() {
  const idx = { ...BASE_SKILLS };
  for (const tree of Object.values(SKILL_TREES)) {
    for (const skill of tree.nodes) {
      idx[skill.id] = skill;
    }
  }
  return idx;
}

/**
 * 获取技能节点在当前等级下的效果数据
 */
export function getSkillLevelData(skillId, skillLevels = {}) {
  const all = _allSkillsIndex();
  const skillDef = all[skillId];
  if (!skillDef) return { level: 1, effect: null, nextCost: null, maxLevel: 1 };

  const level = skillLevels[skillId] || 1;
  const effect = skillDef.levelEffects.find(e => e.level === level) || skillDef.levelEffects[0];
  const nextCost = skillDef.levelUpCosts ? skillDef.levelUpCosts.find(c => c.level === level + 1) || null : null;

  return { level, effect, nextCost, maxLevel: skillDef.maxLevel || 1, skillDef };
}

/**
 * 获取技能在当前等级下的完整战斗配置
 */
export function getSkillConfig(skillId, skillLevels = {}) {
  const { level, effect } = getSkillLevelData(skillId, skillLevels);
  if (!effect) return null;

  const all = _allSkillsIndex();
  const def = all[skillId];
  if (!def) return null;

  return {
    id: def.id, name: def.name, description: def.description,
    type: def.type,
    category: def.category || null,
    cost: effect.cost !== undefined ? effect.cost : def.cost,
    damageMultiplier: effect.damageMultiplier !== undefined ? effect.damageMultiplier : def.damageMultiplier,
    castTime: effect.castTime !== undefined ? effect.castTime : def.castTime,
    baseRecoverySpeed: effect.recoverySpeed !== undefined ? effect.recoverySpeed : def.baseRecoverySpeed,
    minDistance: def.minDistance, maxDistance: def.maxDistance,
    level
  };
}

/**
 * Phase 6: 获取战斗中所有可用技能（含已解锁的分支）
 * 遍历术式技能树，根据 skillLevels 判断解锁状态
 */
export function getAvailableSkills(techniqueId, skillLevels = {}) {
  const tree = SKILL_TREES[techniqueId];
  if (!tree) return [];

  const result = [];

  for (const skill of tree.nodes) {
    const unlockLevel = skillLevels[skill.id] || 0;

    if (skill.isBaseSkill) {
      // 基础技能：总是可用（至少 Lv.1）
      result.push(getSkillConfig(skill.id, skillLevels));
    } else if (unlockLevel > 0) {
      // 已在 skillLevels 中有记录 = 已解锁
      result.push(getSkillConfig(skill.id, skillLevels));
    } else if (skill.requires && (skillLevels[skill.requires] || 0) >= (skill.requiresLevel || 1)) {
      // 满足前置条件但尚未解锁 — 在 Phase 6 仍不可用（需通过技能树 UI 解锁）
      // 不加入战斗列表
    }
  }

  return result;
}

/**
 * Phase 6: 检查技能是否可以解锁
 */
export function canUnlockSkill(skillId, skillLevels = {}, skillPoints = 0, attributes = {}) {
  const all = _allSkillsIndex();
  const skill = all[skillId];
  if (!skill) return { can: false, reason: '未知技能' };

  // 已解锁
  if ((skillLevels[skillId] || 0) > 0) {
    return { can: false, reason: '已解锁' };
  }

  // 前置技能检查
  if (skill.requires) {
    const reqLevel = skillLevels[skill.requires] || 0;
    if (reqLevel < (skill.requiresLevel || 1)) {
      return { can: false, reason: `需要 ${skill.requires} Lv.${skill.requiresLevel || 1}（当前 Lv.${reqLevel}）` };
    }
  }

  // 技能点（解锁免费）
  return { can: true, reason: '' };
}

/**
 * Phase 6: 获取所有可解锁的技能列表（用于技能树 UI 显示）
 */
export function getUnlockableSkills(techniqueId, skillLevels = {}) {
  const tree = SKILL_TREES[techniqueId];
  if (!tree) return [];

  return tree.nodes.filter(skill => {
    const currentLevel = skillLevels[skill.id] || 0;
    if (currentLevel > 0 && !skill.isBaseSkill) return false; // 已解锁的非基础技能
    if (skill.isBaseSkill) return false; // 基础技能不显示为可解锁
    if (!skill.requires) return true; // 无条件解锁
    return (skillLevels[skill.requires] || 0) >= (skill.requiresLevel || 1);
  });
}
