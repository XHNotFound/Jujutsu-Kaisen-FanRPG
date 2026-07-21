// js/modules/HubSystem.js — 养成系统逻辑层（Phase 5）
// 严禁：DOM 操作、document、getElementById、innerHTML
// 纯函数 + 状态机：接收玩家意图 → 校验资源 → 返回 { success, log, updatePayload }

import { ATTRIBUTES, TRAIN_CONFIG, CONSULT_CONFIG, REST_CONFIG, RESOURCE_CAPS } from '../data/attributes.js';
import { NPCS } from '../data/npcs.js';
import { QUESTS } from '../data/quests.js';

export class HubSystem {
  constructor() {
    // 无状态 — 所有操作基于传入的 characterState
  }

  /**
   * 修炼指定属性
   * @param {object} characterState — SaveManager.getState() 的返回值
   * @param {string} attrKey — ATTRIBUTES 中的 key
   * @returns {{ success: boolean, log: string, updatePayload: object|null }}
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
    if (Math.random() < bonusChance) gain += 1;

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
   * @returns {{ success: boolean, log: string, updatePayload: object|null }}
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
    const relationship = characterState.relationship || 0;
    const money = characterState.money || 0;

    // 资源校验
    if (action.cost.ap && ap < action.cost.ap) {
      return { success: false, log: `行动力不足！需要 ${action.cost.ap} AP。`, updatePayload: null };
    }
    if (action.cost.relationship && relationship < action.cost.relationship) {
      return { success: false, log: `人情不足！需要 ${action.cost.relationship} 人情。`, updatePayload: null };
    }
    if (action.cost.money && money < action.cost.money) {
      return { success: false, log: `金钱不足！需要 ${action.cost.money} 金币。`, updatePayload: null };
    }

    // 处理不同效果类型
    const effect = action.effect;
    if (effect.type === 'heal') {
      // 家入硝子的治疗 — 恢复 HP 和 MP 到最大值，清除残秽
      const currentHp = characterState.hp || 0;
      const maxHp = characterState.maxHp || 100;
      const currentMp = characterState.mp || 0;
      const maxMp = characterState.maxMp || 100;
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
          relationship: -(action.cost.relationship || 0),
          proficiencyGains: profGains,
          inspirationGained
        }
      };
    }

    return { success: false, log: '未知的行动类型。', updatePayload: null };
  }

  /**
   * 接取任务
   * @param {object} characterState
   * @param {string} questId
   * @param {string} category — "promotions" | "npcTasks" | "mainStory"
   * @returns {{ success: boolean, log: string, updatePayload: object|null, storyText: string|null }}
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
   * @returns {{ success: boolean, log: string, updatePayload: object }}
   */
  rest(characterState) {
    const maxHp = characterState.maxHp || 100;
    const currentHp = characterState.hp || maxHp;
    const hpGain = Math.floor(maxHp * REST_CONFIG.hpRecoveryPct);
    const actualHpGain = Math.min(hpGain, maxHp - currentHp);

    const maxMp = characterState.maxMp || 100;
    const currentMp = characterState.mp || maxMp;
    const mpGain = Math.floor(maxMp * REST_CONFIG.hpRecoveryPct);
    const actualMpGain = Math.min(mpGain, maxMp - currentMp);

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
        gameDay: 1
      }
    };
  }
}
