// js/modules/HubSystem.js — 养成系统逻辑层（Phase 5 / Phase 11 扩展）
// 严禁：DOM 操作、document、getElementById、innerHTML
// 纯函数 + 状态机：接收玩家意图 → 校验资源 → 返回 { success, log, updatePayload }

import { ATTRIBUTES, TRAIN_CONFIG, CONSULT_CONFIG, REST_CONFIG, RESOURCE_CAPS } from '../data/attributes.js';
import { NPCS } from '../data/npcs.js';
import { QUESTS } from '../data/quests.js';
import { ADVANCED_SKILLS, checkAdvancedSkillUnlocked } from '../data/advanced_skills.js';
import { EXAMS, getNextExam } from '../data/exams.js';
import { ITEMS, getItem } from '../data/items.js';
import { CURSED_TOOLS, EQUIPMENT_SLOTS, getCursedTool, canEquipToSlot } from '../data/cursed_tools.js';

export class HubSystem {
  constructor() {
    // 无状态 — 所有操作基于传入的 characterState
  }

  /**
   * 修炼指定属性
   * @param {object} characterState — SaveManager.getState() 的返回值
   * @param {string} attrKey — ATTRIBUTES 中的 key
   * @returns {object}
   */
  train(characterState, attrKey) {
    const attrDef = ATTRIBUTES[attrKey];
    if (!attrDef) {
      return { success: false, log: '未知属性。', updatePayload: null };
    }

    const ap = characterState.actionPoints || 0;
    const stamina = characterState.stamina || 0;
    const sp = characterState.skillPoints || 0;
    const curVal = (characterState.attributes && characterState.attributes[attrKey]) || 0;

    // 技能点消耗 = 基础 2 + floor(当前值 / 5)，随属性增长递增
    const spCost = 2 + Math.floor(curVal / 5);
    if (sp < spCost) {
      return { success: false, log: `技能点不足！需要 ${spCost} 技能点，当前 ${sp}。`, updatePayload: null };
    }
    if (ap < TRAIN_CONFIG.apCost) {
      return { success: false, log: `行动力不足！需要 ${TRAIN_CONFIG.apCost} AP，当前 ${ap} AP。`, updatePayload: null };
    }
    if (stamina < TRAIN_CONFIG.staminaCost) {
      return { success: false, log: `体力不足！需要 ${TRAIN_CONFIG.staminaCost} 体力，当前 ${stamina} 体力。`, updatePayload: null };
    }

    // 基础提升 1 点，天赋每 10 点提供 10% 概率额外 +1（上限 50%，即最多 +2）
    const talent = (characterState.attributes && characterState.attributes.talent) || 10;
    let gain = 1;
    const bonusChance = Math.min(0.5, Math.floor(talent / 10) * 0.1);
    if (Math.random() < bonusChance) gain = 2;

    return {
      success: true,
      log: `你闭关修炼了${attrDef.name}，${attrDef.name}提升了 ${gain} 点（消耗 ${spCost} 技能点），但积累了 ${TRAIN_CONFIG.residualGain} 点咒力残秽。`,
      updatePayload: {
        [`attributes.${attrKey}`]: gain,
        ap: -TRAIN_CONFIG.apCost,
        stamina: -TRAIN_CONFIG.staminaCost,
        skillPoints: -spCost,
        residual: TRAIN_CONFIG.residualGain
      }
    };
  }

  /**
   * 请教 NPC
   * @param {object} characterState
   * @param {string} npcId
   * @param {string} actionId
   * @returns {object}
   */
  consult(characterState, npcId, actionId) {
    const npc = NPCS.find(n => n.id === npcId);
    if (!npc) {
      return { success: false, log: '未找到该 NPC。', updatePayload: null };
    }

    const action = npc.actions.find(a => a.id === actionId);
    if (!action) {
      return { success: false, log: '该 NPC 没有此项服务。', updatePayload: null };
    }

    const ap = characterState.actionPoints || 0;
    const relationships = characterState.relationships || {};
    const relationship = relationships[npcId] || 0;
    const money = characterState.money || 0;

    // 资源校验
    if (action.cost.ap && ap < action.cost.ap) {
      return { success: false, log: `行动力不足！需要 ${action.cost.ap} AP。`, updatePayload: null };
    }
    if (action.cost.relationship && relationship < action.cost.relationship) {
      return { success: false, log: `与${npc.name}的人情不足！需要 ${action.cost.relationship} 人情，当前 ${relationship}。`, updatePayload: null };
    }
    if (action.cost.money && money < action.cost.money) {
      return { success: false, log: `金钱不足！需要 ${action.cost.money} 金币。`, updatePayload: null };
    }

    // 处理不同效果类型
    const effect = action.effect;
    if (effect.type === 'heal') {
      // 家入硝子的治疗 — 恢复 HP 和 MP 到最大值，清除残秽
      // Phase 13 fix: 治疗回到基础属性的上限（不受装备加成）
      const baseCon = (characterState.attributes && characterState.attributes.constitution) || 10;
      const baseCE  = (characterState.attributes && characterState.attributes.cursedEnergy) || 10;
      const maxHp = (typeof this._calcMaxHp === 'function')
        ? this._calcMaxHp(baseCon) : (characterState.maxHp || 100);
      const maxMp = (typeof this._calcMaxMp === 'function')
        ? this._calcMaxMp(baseCE) : (characterState.maxMp || 100);
      const currentHp = characterState.hp || 0;
      const currentMp = characterState.mp || 0;
      const residual = characterState.residual || 0;
      const residualClear = Math.floor(residual * (effect.residualClearPct || 0.5));
      const hpRestore = maxHp - currentHp;
      const mpRestore = maxMp - currentMp;

      return {
        success: true,
        log: `家入硝子对你使用了反转术式。HP 恢复了 ${hpRestore} 点，MP 恢复了 ${mpRestore} 点，清除了 ${residualClear} 点残秽。`,
        updatePayload: {
          hp: hpRestore,
          mp: mpRestore,
          ap: -(action.cost.ap || 0),
          money: -(action.cost.money || 0),
          residual: -residualClear
        }
      };
    }

    if (effect.type === 'learn') {
      // 术式要求检查
      if (effect.requireTechnique && characterState.techniqueId !== effect.requireTechnique) {
        return { success: false, log: `需要${effect.requireTechnique}术式才能进行此项请教。`, updatePayload: null };
      }

      const profGains = {};
      for (const skillId of effect.targetSkills) {
        profGains[skillId] = effect.proficiencyGain;
      }

      const inspirationGained = Math.random() < (effect.inspirationChance || 0);
      const inspText = inspirationGained ? ' 一阵灵光闪过，获得了灵感！' : '';

      return {
        success: true,
        log: `你向${npc.name}请教了「${action.name}」。${inspText}`,
        updatePayload: {
          ap: -(action.cost.ap || 0),
          [`relationships.${npcId}`]: -(action.cost.relationship || 0),
          proficiencyGains: profGains,
          inspirationGained
        }
      };
    }

    if (effect.type === 'unlock_prerequisite') {
      // Phase 11: 请教获得的解锁基础（如 simple_domain_basics）
      const unlockedPrereqs = characterState.advanced_skills_unlocked || [];
      if (unlockedPrereqs.includes(effect.unlockKey)) {
        return { success: false, log: '你已经掌握了这项基础。', updatePayload: null };
      }

      return {
        success: true,
        log: `你向${npc.name}请教了「${action.name}」——${effect.description || '获得了新的知识基础。'}`,
        updatePayload: {
          ap: -(action.cost.ap || 0),
          [`relationships.${npcId}`]: -(action.cost.relationship || 0),
          advanced_skills_unlocked_add: effect.unlockKey
        }
      };
    }

    if (effect.type === 'gift') {
      // Phase 11: 赠礼 — 消耗金钱，增加人情
      return {
        success: true,
        log: `你赠送了礼物给${npc.name}，与${npc.name}的人情加深了。`,
        updatePayload: {
          ap: -(action.cost.ap || 0),
          money: -(action.cost.money || 0),
          [`relationships.${npcId}`]: effect.relationship || 2
        }
      };
    }

    if (effect.type === 'spar') {
      return {
        success: false,
        log: '切磋功能暂未实装，但已预留接口。',
        updatePayload: null
      };
    }

    return { success: false, log: '未知的行动类型。', updatePayload: null };
  }

  /**
   * 接取任务
   * @param {object} characterState
   * @param {string} questId
   * @param {string} category — "promotions" | "npcTasks" | "mainStory"
   * @returns {object}
   */
  acceptQuest(characterState, questId, category = 'npcTasks') {
    const pool = QUESTS[category] || [];
    const quest = pool.find(q => q.id === questId);

    if (!quest) {
      return { success: false, log: '未找到该任务。', updatePayload: null, storyText: null };
    }

    const ap = characterState.actionPoints || 0;
    if (ap < (quest.cost.ap || 0)) {
      return { success: false, log: `行动力不足！需要 ${quest.cost.ap} AP。`, updatePayload: null, storyText: null };
    }

    // 升职考核：属性校验
    if (category === 'promotions') {
      const attrs = characterState.attributes || {};
      const req = quest.requirements.attributes || {};
      for (const [key, val] of Object.entries(req)) {
        if ((attrs[key] || 0) < val) {
          const attrName = (ATTRIBUTES[key] && ATTRIBUTES[key].name) || key;
          return { success: false, log: `${attrName}不足！需要 ${val}，当前 ${attrs[key] || 0}。`, updatePayload: null, storyText: null };
        }
      }
    }

    // 构建奖励
    const reward = quest.reward || {};
    const updatePayload = {
      ap: -(quest.cost.ap || 0),
      money: reward.money || 0,
      skillPoints: reward.skillPoints || 0,
      relationship: reward.relationship || 0,
      inspirationGained: reward.inspirationGained || false,
      newRank: reward.newRank || null
    };

    return {
      success: true,
      log: `任务「${quest.name}」完成！`,
      updatePayload,
      storyText: reward.storyText || quest.storyText || null
    };
  }

  /**
   * 休息
   * @param {object} characterState
   * @returns {object}
   */
  rest(characterState) {
    // Phase 13 fix: 休息恢复以基础属性为准（不受装备加成）
    const baseCon = (characterState.attributes && characterState.attributes.constitution) || 10;
    const baseCE  = (characterState.attributes && characterState.attributes.cursedEnergy) || 10;
    // 用 SaveManager 的公式，如果没有则 fallback 到 state.maxHp
    const baseMaxHp = typeof this._calcMaxHp === 'function'
      ? this._calcMaxHp(baseCon)
      : (characterState.maxHp || 100);
    const baseMaxMp = typeof this._calcMaxMp === 'function'
      ? this._calcMaxMp(baseCE)
      : (characterState.maxMp || 100);

    const currentHp = characterState.hp || baseMaxHp;
    const hpGain = Math.floor(baseMaxHp * REST_CONFIG.hpRecoveryPct);
    const actualHpGain = Math.min(hpGain, baseMaxHp - currentHp);

    const currentMp = characterState.mp || baseMaxMp;
    const mpGain = Math.floor(baseMaxMp * REST_CONFIG.hpRecoveryPct);
    const actualMpGain = Math.min(mpGain, baseMaxMp - currentMp);

    const residual = characterState.residual || 0;
    const residualClear = Math.floor(residual * REST_CONFIG.residualClearPct);

    const stamina = characterState.stamina || 0;
    const staminaGain = Math.min(REST_CONFIG.staminaRecovery, (RESOURCE_CAPS.maxStamina || 100) - stamina);

    const ap = characterState.actionPoints || 0;
    const apGain = Math.min(REST_CONFIG.apRecovery, (RESOURCE_CAPS.maxAp || 100) - ap);

    const day = (characterState.gameDay || 0) + 1;

    return {
      success: true,
      log: `你休息了一天。恢复了 ${actualHpGain} HP、${actualMpGain} MP、${staminaGain} 体力、${apGain} AP，清除了 ${residualClear} 点残秽。`,
      updatePayload: {
        hp: actualHpGain,
        mp: actualMpGain,
        stamina: staminaGain,
        ap: apGain,
        residual: -residualClear,
        gameDay: 1,
        examCooldownDays: (characterState.examCooldownDays || 0) > 0 ? -1 : 0
      }
    };
  }

  /**
   * Phase 11: 完成考核任务（战斗胜利后调用）
   * @param {object} characterState
   * @param {string} examQuestId — 考核任务 ID
   * @returns {object}
   */
  completeExam(characterState, examQuestId) {
    const exam = EXAMS.promotions.find(e => e.id === examQuestId);
    if (!exam) {
      return { success: false, log: '无效的考核任务。', updatePayload: null };
    }

    const ap = characterState.actionPoints || 0;
    if (ap < (exam.cost?.ap || 30)) {
      return { success: false, log: '行动力不足！', updatePayload: null };
    }

    return {
      success: true,
      log: `🎉 恭喜！你通过了「${exam.name}」，晋升为 ${exam.target_rank}！`,
      updatePayload: {
        ap: -(exam.cost?.ap || 30),
        money: exam.reward?.money || 0,
        skillPoints: exam.reward?.skillPoints || 0,
        inspirationGained: true,
        newRank: exam.reward?.newRank || exam.target_rank
      }
    };
  }

  /**
   * Phase 11: 解锁高级技巧（消耗灵感）
   * @param {object} characterState
   * @param {string} skillId — 高级技巧 ID（如 "simple_domain"）
   * @returns {object}
   */
  unlockAdvancedSkill(characterState, skillId) {
    const check = checkAdvancedSkillUnlocked(skillId, characterState);
    if (!check.unlocked) {
      return { success: false, log: check.reason || '条件不满足。', updatePayload: null };
    }

    const def = ADVANCED_SKILLS[skillId];
    const alreadyUnlocked = (characterState.advanced_skills_unlocked || []).includes(skillId);
    if (alreadyUnlocked) {
      return { success: false, log: `你已解锁了「${def.name}」。`, updatePayload: null };
    }

    // 扣除灵感
    const inspCost = def.requirements.inspiration || 0;
    if (inspCost > 0 && (characterState.inspiration || 0) < inspCost) {
      return { success: false, log: `灵感不足！需要 ${inspCost} 点灵感，当前 ${characterState.inspiration || 0}。`, updatePayload: null };
    }

    return {
      success: true,
      log: `你成功解锁了「${def.name}」！${def.flavorText || ''}`,
      updatePayload: {
        advanced_skills_unlocked_add: skillId,
        inspiration: -inspCost
      }
    };
  }

  // ================================================================
  //  Phase 13: 商店与道具系统（纯函数，零 DOM 依赖）
  // ================================================================

  /**
   * 购买道具
   * @param {object} characterState
   * @param {string} itemId
   * @param {number} quantity — 购买数量（默认 1）
   * @returns {object}
   */
  buyItem(characterState, itemId, quantity = 1) {
    const item = getItem(itemId);
    if (!item) {
      return { success: false, log: '未知道具。', updatePayload: null };
    }
    const totalPrice = item.price * quantity;
    const money = characterState.money || 0;
    if (money < totalPrice) {
      return { success: false, log: `金钱不足！需要 ${totalPrice} 金币，当前 ${money} 金币。`, updatePayload: null };
    }
    return {
      success: true,
      log: `购买了 ${quantity} 个「${item.name}」，花费 ${totalPrice} 金币。`,
      updatePayload: {
        money: -totalPrice,
        inventory: { [itemId]: quantity }
      }
    };
  }

  /**
   * 使用道具（非战斗状态）
   * @param {object} characterState
   * @param {string} itemId
   * @returns {object}
   */
  useItem(characterState, itemId) {
    const item = getItem(itemId);
    if (!item) {
      return { success: false, log: '未知道具。', updatePayload: null };
    }

    // 检查背包中是否有此道具
    const inventory = characterState.inventory || {};
    const owned = inventory[itemId] || 0;
    if (owned <= 0) {
      return { success: false, log: `背包中没有「${item.name}」。`, updatePayload: null };
    }

    const effect = item.effect;
    const payload = {
      inventory: { [itemId]: -1 }  // 消耗 1 个
    };
    let logParts = [`使用了「${item.name}」。`];

    // 处理不同效果类型
    switch (effect.type) {
      case 'restore_stamina':
        const stamina = characterState.stamina || 0;
        const maxStamina = RESOURCE_CAPS.maxStamina || 100;
        const staminaRestore = Math.min(effect.amount || 0, maxStamina - stamina);
        payload.stamina = staminaRestore;
        logParts.push(`回复了 ${staminaRestore} 点体力。`);
        break;

      case 'restore_hp':
        const hp = characterState.hp || 0;
        // Phase 13 fix: 道具回复上限以基础属性为准（不受装备加成）
        const baseConHp = (characterState.attributes && characterState.attributes.constitution) || 10;
        const realMaxHp = (typeof this._calcMaxHp === 'function')
          ? this._calcMaxHp(baseConHp) : (characterState.maxHp || 100);
        const hpRestore = effect.pct
          ? Math.floor(realMaxHp * effect.pct)
          : (effect.amount || 0);
        const actualHp = Math.min(hpRestore, realMaxHp - hp);
        payload.hp = actualHp;
        logParts.push(`回复了 ${actualHp} 点生命值。`);
        break;

      case 'restore_mp':
        const mp = characterState.mp || 0;
        // Phase 13 fix: 道具回复上限以基础属性为准（不受装备加成）
        const baseCeMp = (characterState.attributes && characterState.attributes.cursedEnergy) || 10;
        const realMaxMp = (typeof this._calcMaxMp === 'function')
          ? this._calcMaxMp(baseCeMp) : (characterState.maxMp || 100);
        const mpRestore = effect.pct
          ? Math.floor(realMaxMp * effect.pct)
          : (effect.amount || 0);
        const actualMp = Math.min(mpRestore, realMaxMp - mp);
        payload.mp = actualMp;
        logParts.push(`回复了 ${actualMp} 点咒力。`);
        break;

      case 'clear_residual':
        const residual = characterState.residual || 0;
        payload.residual = -residual;  // 清除全部残秽
        logParts.push(`清除了 ${residual} 点咒力残秽。`);
        // 额外效果（如御守的体力恢复）
        if (effect.bonus && effect.bonus.stamina) {
          const bonusStamina = Math.min(effect.bonus.stamina,
            (RESOURCE_CAPS.maxStamina || 100) - (characterState.stamina || 0));
          payload.stamina = (payload.stamina || 0) + bonusStamina;
          logParts.push(`额外恢复了 ${bonusStamina} 点体力。`);
        }
        break;

      case 'flee_guaranteed':
        logParts.push('可在战斗中使用，必定成功脱离战斗。');
        break;

      default:
        return { success: false, log: '未知的道具效果类型。', updatePayload: null };
    }

    return {
      success: true,
      log: logParts.join(''),
      updatePayload: payload
    };
  }

  // ================================================================
  //  Phase 13: 窗的情报系统（纯函数，零 DOM 依赖）
  // ================================================================

  /**
   * 购买怪物情报
   * @param {object} characterState
   * @param {string} enemyId — 敌人 ID
   * @param {string} level — 情报等级: "basic" | "skill" | "advanced"
   * @param {object} enemyConfig — 敌人完整配置（从 ENEMIES 中查询）
   * @returns {object}
   */
  purchaseIntel(characterState, enemyId, level, enemyConfig) {
    if (!enemyConfig || !enemyConfig.intelData) {
      return { success: false, log: '该敌人没有可购买的情报数据。', updatePayload: null };
    }
    const intelLevel = enemyConfig.intelData[level];
    if (!intelLevel) {
      return { success: false, log: `无效的情报等级: ${level}。`, updatePayload: null };
    }

    const money = characterState.money || 0;
    const price = intelLevel.price;
    if (money < price) {
      return { success: false, log: `金钱不足！需要 ${price} 金币购买「${enemyConfig.name} - ${intelLevel.name}」，当前 ${money} 金币。`, updatePayload: null };
    }

    // 检查是否已购买过该等级的情报
    const unlockedIntel = characterState.unlockedIntel || {};
    const unlockedLevels = unlockedIntel[enemyId] || [];
    if (unlockedLevels.includes(level)) {
      return { success: false, log: `你已经购买过「${enemyConfig.name}」的「${intelLevel.name}」了。`, updatePayload: null };
    }

    return {
      success: true,
      log: `购买了「${enemyConfig.name}」的「${intelLevel.name}」——${intelLevel.description}，花费 ${price} 金币。`,
      updatePayload: {
        money: -price,
        unlockedIntel: { [enemyId]: [level] }
      }
    };
  }

  // ================================================================
  //  Phase 13: 咒具系统（纯函数，零 DOM 依赖）
  // ================================================================

  /**
   * 装备咒具到指定槽位
   * @param {object} characterState
   * @param {string} slotId — "mainHand" | "offHand" | "accessory"
   * @param {string} toolId — 咒具 ID（null 表示卸下）
   * @returns {object}
   */
  equipTool(characterState, slotId, toolId) {
    const slot = EQUIPMENT_SLOTS[slotId];
    if (!slot) {
      return { success: false, log: `无效的装备槽位: ${slotId}。`, updatePayload: null };
    }

    if (toolId === null) {
      // 卸下装备
      const equipment = characterState.equipment || { mainHand: null, offHand: null, accessory: null };
      const current = equipment[slotId];
      if (!current) {
        return { success: false, log: '该槽位没有装备。', updatePayload: null };
      }
      const oldTool = getCursedTool(current);
      return {
        success: true,
        log: `卸下了「${oldTool ? oldTool.name : current}」。`,
        updatePayload: { equipment: { [slotId]: null } }
      };
    }

    // 检查咒具是否存在
    const tool = getCursedTool(toolId);
    if (!tool) {
      return { success: false, log: `未找到咒具: ${toolId}。`, updatePayload: null };
    }

    // 检查槽位兼容性
    if (!canEquipToSlot(toolId, slotId)) {
      return { success: false, log: `「${tool.name}」无法装备到${slot.name}槽位（需要类型: ${slot.acceptedTypes.join('/')}）。`, updatePayload: null };
    }

    // 检查是否已拥有该咒具（简单检查：如果已在其他槽位装备，先卸下）
    const equipment = characterState.equipment || { mainHand: null, offHand: null, accessory: null };
    const oldEquipLog = [];
    for (const [otherSlot, otherToolId] of Object.entries(equipment)) {
      if (otherToolId === toolId && otherSlot !== slotId) {
        oldEquipLog.push(`（自动从${EQUIPMENT_SLOTS[otherSlot]?.name || otherSlot}卸下）`);
        equipment[otherSlot] = null;
      }
    }

    return {
      success: true,
      log: `装备了「${tool.name}」到${slot.name}。` + oldEquipLog.join(' '),
      updatePayload: { equipment: { [slotId]: toolId } }
    };
  }

  /**
   * 卸下指定槽位的装备（equipTool 的语法糖）
   * @param {object} characterState
   * @param {string} slotId
   * @returns {object}
   */
  unequipTool(characterState, slotId) {
    return this.equipTool(characterState, slotId, null);
  }

  /**
   * 计算最终属性（基础属性 + 装备加成）
   * 严禁直接修改 characterState.attributes！
   * 返回新的合并后的属性对象，供 UI 显示和战斗系统读取。
   *
   * @param {object} characterState — 玩家存档状态
   * @returns {object} 最终属性值（key 为属性名，value 为数值）
   */
  calculateFinalStats(characterState) {
    const base = { ...(characterState.attributes || {}) };

    // 遍历装备槽位，叠加咒具属性加成
    const equipment = characterState.equipment || { mainHand: null, offHand: null, accessory: null };
    for (const [slotId, toolId] of Object.entries(equipment)) {
      if (!toolId) continue;
      const tool = getCursedTool(toolId);
      if (!tool || !tool.statsBonus) continue;
      for (const [attr, bonus] of Object.entries(tool.statsBonus)) {
        base[attr] = (base[attr] || 0) + bonus;
      }
    }

    return base;
  }

  /**
   * 获取所有装备后的属性加成摘要
   * @param {object} characterState
   * @returns {Array<{toolName: string, bonuses: object}>}
   */
  getEquipmentBonuses(characterState) {
    const result = [];
    const equipment = characterState.equipment || { mainHand: null, offHand: null, accessory: null };
    for (const [slotId, toolId] of Object.entries(equipment)) {
      if (!toolId) continue;
      const tool = getCursedTool(toolId);
      if (tool) {
        result.push({ slotId, slotName: EQUIPMENT_SLOTS[slotId]?.name || slotId, toolId, toolName: tool.name, bonuses: { ...tool.statsBonus }, tier: tool.tier });
      }
    }
    return result;
  }
}
