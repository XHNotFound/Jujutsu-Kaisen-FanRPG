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

      // Phase 11: HP/MP 上限随体质/咒力总量阶梯线性提升
      hp: this._calcMaxHp(adjustedAttrs.constitution),
      maxHp: this._calcMaxHp(adjustedAttrs.constitution),
      mp: this._calcMaxMp(adjustedAttrs.cursedEnergy),
      maxMp: this._calcMaxMp(adjustedAttrs.cursedEnergy),
      money: 0,
      actionPoints: 10,

      // Phase 4: 技能等级与熟练度
      skillLevels: {},       // { "aoi": 2, "attack": 3, ... }
      skillProficiency: {},  // { "aoi": 45, "attack": 80, ... }
      skillPoints: 5,        // 可用技能点（Phase 5: 默认 5，修炼消耗 2+floor(值/5)，初始够用）
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

  /**
   * Phase 5: 应用养成操作的更新到当前存档状态
   * @param {object} payload — HubSystem 返回的 updatePayload
   *   支持格式: { ap: -20, stamina: -15, residual: 10, "attributes.constitution": 2, hp: 30, ... }
   */
  applyGrowthUpdate(payload) {
    if (!this.state || !payload) return;

    // 1. 初始化 Phase 5 字段的默认值
    if (this.state.stamina === undefined) this.state.stamina = 100;
    if (this.state.residual === undefined) this.state.residual = 0;
    if (this.state.gameDay === undefined) this.state.gameDay = 1;
    if (this.state.skillPoints === undefined) this.state.skillPoints = 5;
    if (this.state.inspiration === undefined) this.state.inspiration = 0;
    if (!this.state.skillLevels) this.state.skillLevels = {};
    if (!this.state.skillProficiency) this.state.skillProficiency = {};
    // Phase 11: 新字段默认值
    if (!this.state.relationships) this.state.relationships = {};
    if (!this.state.advanced_skills_unlocked) this.state.advanced_skills_unlocked = [];
    if (this.state.examCooldownDays === undefined) this.state.examCooldownDays = 0;

    const caps = {
      maxAp: 100, maxStamina: 100, maxResidual: 100,
      maxRelationship: 10, maxHp: this.state.maxHp || 100
    };

    // 2. 遍历 payload 中的每个字段
    for (const [key, value] of Object.entries(payload)) {
      if (key === 'newRank' && value) {
        this.state.rank = value;
        continue;
      }
      if (key === 'gameDay') {
        this.state.gameDay = (this.state.gameDay || 0) + value;
        continue;
      }
      if (key === 'inspirationGained' && value) {
        this.state.inspiration = (this.state.inspiration || 0) + 1;
        continue;
      }
      // Phase 11: relationships 按 NPC ID 独立存储
      if (key.startsWith('relationships.')) {
        const npcId = key.split('.')[1];
        if (!this.state.relationships) this.state.relationships = {};
        this.state.relationships[npcId] = Math.max(0, (this.state.relationships[npcId] || 0) + value);
        continue;
      }
      // Phase 11: 高级技巧解锁
      if (key === 'advanced_skills_unlocked_add') {
        if (!this.state.advanced_skills_unlocked) this.state.advanced_skills_unlocked = [];
        if (!this.state.advanced_skills_unlocked.includes(value)) {
          this.state.advanced_skills_unlocked.push(value);
        }
        continue;
      }
      // Phase 11: 考核冷却
      if (key === 'examCooldownDays') {
        this.state.examCooldownDays = Math.max(0, (this.state.examCooldownDays || 0) + value);
        continue;
      }
      if (key === 'storyText' || key === 'relationship' || value === null || value === undefined) {
        continue;
      }

      // proficiencyGains: { "aoi": 10, "attack": 10 }
      if (key === 'proficiencyGains' && typeof value === 'object') {
        if (!this.state.skillProficiency) this.state.skillProficiency = {};
        for (const [skillId, gain] of Object.entries(value)) {
          this.state.skillProficiency[skillId] = (this.state.skillProficiency[skillId] || 0) + gain;
          if (!this.state.skillLevels[skillId]) this.state.skillLevels[skillId] = 1;
        }
        continue;
      }

      // 嵌套属性: "attributes.constitution": 2
      if (key.startsWith('attributes.')) {
        const attrKey = key.split('.')[1];
        if (!this.state.attributes) this.state.attributes = {};
        if (!this.state.baseAttributes) this.state.baseAttributes = {};
        this.state.attributes[attrKey] = (this.state.attributes[attrKey] || 0) + value;
        this.state.baseAttributes[attrKey] = (this.state.baseAttributes[attrKey] || 0) + value;
        // Phase 11: 体质/咒力总量变化时重新计算 maxHp/maxMp
        if (attrKey === 'constitution') {
          this.state.maxHp = this._calcMaxHp(this.state.attributes.constitution);
          this.state.hp = Math.min(this.state.maxHp, this.state.hp || this.state.maxHp);
        }
        if (attrKey === 'cursedEnergy') {
          this.state.maxMp = this._calcMaxMp(this.state.attributes.cursedEnergy);
          this.state.mp = Math.min(this.state.maxMp, this.state.mp || this.state.maxMp);
        }
        continue;
      }

      // 简单顶层字段: hp, ap, stamina, residual, money, skillPoints
      if (key === 'hp') {
        const maxHp = this.state.maxHp || 100;
        this.state.hp = Math.min(maxHp, Math.max(0, (this.state.hp || maxHp) + value));
      } else if (key === 'stamina') {
        this.state.stamina = Math.max(0, Math.min(caps.maxStamina, (this.state.stamina || 100) + value));
      } else if (key === 'ap') {
        this.state.actionPoints = Math.max(0, Math.min(caps.maxAp, (this.state.actionPoints || 0) + value));
      } else if (key === 'residual') {
        this.state.residual = Math.max(0, Math.min(caps.maxResidual, (this.state.residual || 0) + value));
      } else if (key === 'money') {
        this.state.money = Math.max(0, (this.state.money || 0) + value);
      } else if (key === 'skillPoints') {
        this.state.skillPoints = Math.max(0, (this.state.skillPoints !== undefined ? this.state.skillPoints : 5) + value);
      } else if (key === 'mp') {
        const maxMp = this.state.maxMp || 100;
        this.state.mp = Math.min(maxMp, Math.max(0, (this.state.mp || maxMp) + value));
      }
    }

    // 3. 持久化
    const slot = this._findCurrentSlot();
    if (slot >= 0) {
      this.saveToSlot(slot);
    }
  }

  /**
   * Phase 11: 根据体质阶梯计算 maxHp
   * 体质≤20: +5/点, 20<体质≤40: +10/点, 体质>40: +15/点
   */
  _calcMaxHp(con) {
    con = con || 10;
    let hp = 30;
    if (con <= 20) {
      hp = 30 + con * 5;
    } else if (con <= 40) {
      hp = 30 + 20 * 5 + (con - 20) * 10;
    } else {
      hp = 30 + 20 * 5 + 20 * 10 + (con - 40) * 15;
    }
    return hp;
  }

  /**
   * Phase 11: 根据咒力总量阶梯计算 maxMp
   * 总量≤20: +4/点, 20<总量≤30: +8/点, 30<总量≤45: +15/点, 总量>45: +20/点
   */
  _calcMaxMp(ce) {
    ce = ce || 10;
    let mp = 30;
    // tier 1: ≤20
    const t1 = Math.min(ce, 20);
    mp += t1 * 4;
    if (ce <= 20) return mp;
    // tier 2: 20-30
    const t2 = Math.min(ce - 20, 10);
    mp += t2 * 8;
    if (ce <= 30) return mp;
    // tier 3: 30-45
    const t3 = Math.min(ce - 30, 15);
    mp += t3 * 15;
    if (ce <= 45) return mp;
    // tier 4: >45
    mp += (ce - 45) * 20;
    return mp;
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
