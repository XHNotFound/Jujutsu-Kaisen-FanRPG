// js/modules/SaveManager.js — 存档管理器（唯一负责 LocalStorage 读写）

/**
 * SaveManager 职责：
 * - LocalStorage 读写（3槽位）
 * - 内存状态管理
 * - 存档序号递增
 *
 * 严禁：
 * - 任何 DOM 操作
 * - 任何 UI 渲染逻辑
 * - 使用 window 全局变量暴露状态
 */

const SAVE_KEY_PREFIX = 'jjk_save_';
const COUNTER_KEY = 'jjk_save_counter';
const MAX_SLOTS = 3;

export class SaveManager {
  constructor() {
    /** @type {object|null} 当前角色状态 */
    this.state = null;
    /** @type {number} 存档序号计数器（用于生成唯一存档ID） */
    this.saveCounter = this._loadCounter();
  }

  // ===== 公开 API =====

  /**
   * 获取当前角色状态
   * @returns {object|null}
   */
  getState() {
    return this.state;
  }

  /**
   * 设置当前角色状态
   * @param {object} state
   */
  setState(state) {
    this.state = { ...state };
  }

  /**
   * 读取所有存档槽位
   * @returns {Array<{slot: number, data: object|null}>} 3个槽位的数据
   */
  getAllSlots() {
    const slots = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      const key = SAVE_KEY_PREFIX + i;
      const raw = localStorage.getItem(key);
      slots.push({
        slot: i,
        data: raw ? JSON.parse(raw) : null
      });
    }
    return slots;
  }

  /**
   * 保存当前状态到第一个可用槽位
   * 若全满则返回 needOverwrite = true
   * @returns {{ success: boolean, slot?: number, needOverwrite?: boolean }}
   */
  save() {
    if (!this.state) {
      return { success: false };
    }

    const slots = this.getAllSlots();
    const emptySlot = slots.find(s => s.data === null);

    if (emptySlot) {
      return this.saveToSlot(emptySlot.slot);
    }

    // 所有槽位已满
    return { success: false, needOverwrite: true };
  }

  /**
   * 保存到指定槽位（覆盖）
   * @param {number} slot - 槽位编号 (0-2)
   * @returns {{ success: boolean, slot?: number }}
   */
  saveToSlot(slot) {
    if (slot < 0 || slot >= MAX_SLOTS || !this.state) {
      return { success: false };
    }

    const data = {
      ...this.state,
      saveId: ++this.saveCounter,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(SAVE_KEY_PREFIX + slot, JSON.stringify(data));
    this._saveCounter();
    this.state = data;

    return { success: true, slot };
  }

  /**
   * 从指定槽位读档
   * @param {number} slot - 槽位编号 (0-2)
   * @returns {object|null} 角色数据，槽位为空返回 null
   */
  load(slot) {
    if (slot < 0 || slot >= MAX_SLOTS) {
      return null;
    }

    const raw = localStorage.getItem(SAVE_KEY_PREFIX + slot);
    if (!raw) {
      return null;
    }

    const data = JSON.parse(raw);
    this.state = data;
    return data;
  }

  /**
   * 删除指定槽位
   * @param {number} slot - 槽位编号 (0-2)
   */
  deleteSlot(slot) {
    if (slot < 0 || slot >= MAX_SLOTS) {
      return;
    }
    localStorage.removeItem(SAVE_KEY_PREFIX + slot);
  }

  /**
   * 检查是否有任何存档
   * @returns {boolean}
   */
  hasAnySave() {
    const slots = this.getAllSlots();
    return slots.some(s => s.data !== null);
  }

  /**
   * 生成存档数据结构（从 CharCreator 中提取）
   * @param {import('./CharCreator.js').CharCreator} charCreator
   * @returns {object} 存档数据
   */
  buildSaveData(charCreator) {
    const attrs = charCreator.currentAttributes;
    const binding = charCreator.getBindings().find(b => b.id === charCreator.selectedBindingId);
    const technique = charCreator.getTechniques().find(t => t.id === charCreator.selectedTechniqueId);

    const adjustedAttrs = charCreator.applyBinding(attrs, charCreator.selectedBindingId);
    const rank = charCreator.calculateRank(adjustedAttrs);

    return {
      characterName: charCreator.characterName,
      attributes: { ...adjustedAttrs },
      baseAttributes: { ...attrs },
      techniqueId: charCreator.selectedTechniqueId,
      bindingId: charCreator.selectedBindingId,
      rank: rank.name,

      // 基础资源（Phase 1 默认值，后续 Phase 可扩展）
      hp: 100,
      maxHp: 100,
      mp: 100,
      maxMp: 100,
      money: 0,
      actionPoints: 10,

      // Phase 4: 技能等级与熟练度
      skillLevels: {},       // { "aoi": 2, "attack": 3, ... }
      skillProficiency: {},  // { "aoi": 45, "attack": 80, ... }
      skillPoints: 0,        // 可用技能点
      inspiration: 0         // 灵感点数
    };
  }

  /**
   * Phase 4: 应用战斗奖励到当前存档状态
   * @param {object} rewards — Python generate_battle_rewards 的返回值
   */
  applyBattleRewards(rewards) {
    if (!this.state) return;

    // 1. 金币
    this.state.money = (this.state.money || 0) + (rewards.money || 0);

    // 2. 技能点
    this.state.skillPoints = (this.state.skillPoints || 0) + (rewards.skillPoints || 0);

    // 3. 灵感
    if (rewards.inspirationGained) {
      this.state.inspiration = (this.state.inspiration || 0) + 1;
    }

    // 4. 熟练度
    const profGains = rewards.proficiencyGains || {};
    if (!this.state.skillProficiency) this.state.skillProficiency = {};
    if (!this.state.skillLevels) this.state.skillLevels = {};

    for (const [skillId, gain] of Object.entries(profGains)) {
      const current = this.state.skillProficiency[skillId] || 0;
      this.state.skillProficiency[skillId] = current + gain;
      // 确保技能至少有 1 级
      if (!this.state.skillLevels[skillId]) {
        this.state.skillLevels[skillId] = 1;
      }
    }

    // 5. 立即持久化
    const slot = this._findCurrentSlot();
    if (slot >= 0) {
      this.saveToSlot(slot);
    }
  }

  /**
   * Phase 4: 尝试升级技能
   * @param {string} skillId
   * @param {object} skillDef — 技能树定义（含 levelUpCosts / levelEffects）
   * @returns {{ success: boolean, message: string, newLevel?: number }}
   */
  upgradeSkill(skillId, skillDef) {
    if (!this.state) return { success: false, message: '没有存档数据。' };

    const currentLevel = (this.state.skillLevels && this.state.skillLevels[skillId]) || 1;
    const nextCost = skillDef.levelUpCosts.find(c => c.level === currentLevel + 1);
    if (!nextCost) {
      return { success: false, message: '已达到最高等级。' };
    }

    const prof = (this.state.skillProficiency && this.state.skillProficiency[skillId]) || 0;
    if (prof < nextCost.proficiency) {
      return { success: false, message: `熟练度不足（需要 ${nextCost.proficiency}，当前 ${prof}）。` };
    }

    const sp = this.state.skillPoints || 0;
    if (sp < nextCost.skillPoints) {
      return { success: false, message: `技能点不足（需要 ${nextCost.skillPoints}，当前 ${sp}）。` };
    }

    // 扣除成本
    this.state.skillPoints = sp - nextCost.skillPoints;
    this.state.skillProficiency[skillId] = prof - nextCost.proficiency;
    this.state.skillLevels[skillId] = currentLevel + 1;

    // 持久化
    const slot = this._findCurrentSlot();
    if (slot >= 0) {
      this.saveToSlot(slot);
    }

    return {
      success: true,
      message: `技能升级成功！${skillDef.name || skillId} Lv.${currentLevel} → Lv.${currentLevel + 1}`,
      newLevel: currentLevel + 1
    };
  }

  /**
   * 查找当前 state 对应的存档槽位
   * @returns {number} -1 表示未找到
   */
  _findCurrentSlot() {
    const slots = this.getAllSlots();
    for (const { slot, data } of slots) {
      if (data && data.saveId === this.state.saveId) {
        return slot;
      }
    }
    // 回退：找第一个空槽
    for (const { slot, data } of slots) {
      if (data === null) return slot;
    }
    return 0; // 覆盖第一个
  }

  // ===== 内部方法 =====

  /**
   * 从 LocalStorage 读取存档计数器
   * @returns {number}
   */
  _loadCounter() {
    const raw = localStorage.getItem(COUNTER_KEY);
    return raw ? parseInt(raw, 10) : 0;
  }

  /**
   * 保存存档计数器到 LocalStorage
   */
  _saveCounter() {
    localStorage.setItem(COUNTER_KEY, String(this.saveCounter));
  }
}
