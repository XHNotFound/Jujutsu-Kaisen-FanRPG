// js/modules/CharCreator.js — 角色创建器（唯一负责角色创建逻辑）

import { ATTRIBUTES, RANK_THRESHOLDS } from '../data/attributes.js';
import { TECHNIQUES } from '../data/techniques.js';
import { BINDINGS } from '../data/bindings.js';

/**
 * CharCreator 职责：
 * - Roll点（4d6去最低+10）
 * - 属性计算
 * - 实力评定
 * - 术式/咒缚前置校验
 *
 * 严禁：
 * - 任何 DOM 操作（document.getElementById, addEventListener 等）
 * - 任何 UI 渲染逻辑
 */

export class CharCreator {
  constructor() {
    /** @type {object|null} 当前掷出的属性值 */
    this.currentAttributes = null;
    /** @type {number} 剩余重掷次数 */
    this.rerollsLeft = 3;
    /** @type {string|null} 选中的术式 ID */
    this.selectedTechniqueId = null;
    /** @type {string} 选中的咒缚 ID */
    this.selectedBindingId = 'none';
    /** @type {string|null} 角色名 */
    this.characterName = null;
  }

  /**
   * 4d6 去最低值 + 10
   * @returns {number} 范围 13~34
   */
  roll4d6DropLowestAdd10() {
    const dice = [
      this._d6(),
      this._d6(),
      this._d6(),
      this._d6()
    ];
    // 排序后去掉最低值
    dice.sort((a, b) => a - b);
    const sum = dice[1] + dice[2] + dice[3];
    return sum + 10;
  }

  /**
   * 执行完整的 Roll 点流程（6项属性全部重掷）
   * 若还有重掷次数，减少一次
   * @returns {object|null} 属性对象，若无剩余次数返回 null
   */
  rollAllAttributes() {
    if (this.rerollsLeft <= 0) {
      return null;
    }

    this.rerollsLeft--;

    const attributes = {};
    for (const [key] of Object.entries(ATTRIBUTES)) {
      attributes[key] = this.roll4d6DropLowestAdd10();
    }

    this.currentAttributes = attributes;
    return attributes;
  }

  /**
   * 根据 6 项属性平均值计算实力评定
   * @param {object} attributes - 属性对象（可能包含 base/其他字段，只取 ATTRIBUTES 中定义的 key）
   * @returns {{ name: string, avg: number }} 评定名称 + 平均值
   */
  calculateRank(attributes) {
    const attrKeys = Object.keys(ATTRIBUTES);
    const values = attrKeys.map(k => attributes[k] || 0);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = Math.round((sum / values.length) * 10) / 10;

    // 从高到低遍历阈值，找到最高匹配
    let rankName = RANK_THRESHOLDS[0].name;
    for (const threshold of RANK_THRESHOLDS) {
      if (avg >= threshold.min) {
        rankName = threshold.name;
      }
    }

    return { name: rankName, avg };
  }

  /**
   * 根据属性生成风味提示文本
   * @param {object} attributes - 属性对象
   * @returns {string} 风味文本
   */
  getFlavorText(attributes) {
    const rank = this.calculateRank(attributes);
    const talent = attributes.talent || 0;
    const ce = attributes.cursedEnergy || 0;

    if (rank.name === "现代最强" || rank.name === "特级") {
      return "千年难遇的天才…你的名字将刻入咒术史。";
    }
    if (rank.name === "准特级" || rank.name === "一级") {
      return "你拥有跻身顶尖咒术师的资质。";
    }
    if (talent >= 28) {
      return "你的天赋觉醒了特殊的生得术式。";
    }
    if (ce >= 28) {
      return "你体内蕴藏着惊人的咒力。";
    }
    if (rank.name === "准一级" || rank.name === "二级") {
      return "你是一名可靠的咒术师，前途在你自己手中。";
    }
    if (rank.avg >= 16) {
      return "基础扎实，勤勉能补天赋之不足。";
    }
    return "前路漫漫，但弱者也有弱者的战斗方式。";
  }

  /**
   * 检查术式的前置要求是否满足
   * @param {object} technique - 术式对象
   * @param {object} attributes - 当前属性
   * @returns {{ satisfied: boolean, details: Array<{attr: string, name: string, required: number, current: number}> }}
   */
  checkTechniqueRequirements(technique, attributes) {
    const reqs = technique.requirements || {};

    // 空 requirements = 无条件可选
    if (Object.keys(reqs).length === 0) {
      return { satisfied: true, details: [] };
    }

    const details = [];
    let satisfied = true;

    for (const [attrKey, requiredValue] of Object.entries(reqs)) {
      const currentValue = attributes[attrKey] || 0;
      const attrName = (ATTRIBUTES[attrKey] && ATTRIBUTES[attrKey].name) || attrKey;
      const ok = currentValue >= requiredValue;
      if (!ok) {
        satisfied = false;
      }
      details.push({
        attr: attrKey,
        name: attrName,
        required: requiredValue,
        current: currentValue,
        ok
      });
    }

    return { satisfied, details };
  }

  /**
   * 应用天与咒缚到属性（返回新对象，不修改原属性）
   * 对于 -99 的代价项（如甚尔之缚），直接设为 0
   * @param {object} attributes - 原始属性
   * @param {string} bindingId - 咒缚 ID
   * @returns {object} 调整后的属性
   */
  applyBinding(attributes, bindingId) {
    const binding = BINDINGS.find(b => b.id === bindingId);
    if (!binding) {
      return { ...attributes };
    }

    const result = {};
    const attrKeys = Object.keys(ATTRIBUTES);

    for (const key of attrKeys) {
      const base = attributes[key] || 0;
      const cost = binding.costs[key] || 0;
      const bonus = binding.bonuses[key] || 0;
      let value = base + cost + bonus;

      // -99 表示完全丧失 → 设为 0
      if (cost <= -99) {
        value = 0;
      }

      // 确保属性不为负
      if (value < 0) {
        value = 0;
      }

      result[key] = value;
    }

    return result;
  }

  /**
   * 获取所有术式列表
   * @returns {Array} 术式数组
   */
  getTechniques() {
    return TECHNIQUES;
  }

  /**
   * 获取所有咒缚列表
   * @returns {Array} 咒缚数组
   */
  getBindings() {
    return BINDINGS;
  }

  /**
   * 重置创建状态
   */
  reset() {
    this.currentAttributes = null;
    this.rerollsLeft = 3;
    this.selectedTechniqueId = null;
    this.selectedBindingId = 'none';
    this.characterName = null;
  }

  // ===== 内部方法 =====

  /**
   * 单次 D6 掷骰
   * @returns {number} 1-6
   */
  _d6() {
    return Math.floor(Math.random() * 6) + 1;
  }
}
