// js/modules/SkillTreeUI.js — 技能树 UI 面板
// 负责主界面技能树渲染、升级逻辑
// 严禁包含任何战斗计算逻辑

import { SKILL_TREES, BASE_SKILLS, getSkillLevelData, getSkillConfig } from '../data/skills.js';

export class SkillTreeUI {
  /**
   * @param {import('./SaveManager.js').SaveManager} saveManager
   * @param {import('./UIManager.js').UIManager} uiManager
   */
  constructor(saveManager, uiManager) {
    this.saveManager = saveManager;
    this.uiManager = uiManager;
  }

  /**
   * 打开技能树面板（在主界面弹出）
   */
  show() {
    const state = this.saveManager.getState();
    if (!state) {
      this.uiManager.showModal('没有角色数据。', { confirmOnly: true, onConfirm: () => this.uiManager.hideModal() });
      return;
    }

    const techniqueId = state.techniqueId || 'cursedEnergyBoost';
    const tree = SKILL_TREES[techniqueId] || [];
    const skillLevels = state.skillLevels || {};
    const skillProficiency = state.skillProficiency || {};
    const skillPoints = state.skillPoints || 0;

    // 构建面板 HTML
    let treeHTML = '';
    for (const skill of tree) {
      const { level, effect, nextCost } = getSkillLevelData(skill.id, skillLevels);
      const proficiency = skillProficiency[skill.id] || 0;
      const isUnlocked = level > 0 || !skill.requires;  // 无前置=初始即解锁
      const canUpgrade = nextCost && proficiency >= nextCost.proficiency && skillPoints >= nextCost.skillPoints;

      let statusHTML = '';
      if (!isUnlocked && skill.requires) {
        statusHTML = `<span class="skilltree-status locked">🔒 需要前置: ${skill.requires}</span>`;
      }

      const nextCostHTML = nextCost
        ? `<div class="skilltree-cost">
            升级 Lv.${level + 1}: 🔧 ${nextCost.skillPoints} 技能点 | 📊 ${proficiency}/${nextCost.proficiency} 熟练度
           </div>`
        : '<div class="skilltree-max">已达到最高等级</div>';

      const btnDisabled = !canUpgrade ? 'disabled' : '';
      const effectText = effect ? ` (伤害 x${effect.damageMultiplier}, 消耗 ${effect.cost} MP)` : '';

      treeHTML += `
        <div class="skilltree-card ${isUnlocked ? '' : 'skilltree-locked'}">
          <div class="skilltree-header">
            <span class="skilltree-name">${skill.name}</span>
            <span class="skilltree-level">Lv.${level}</span>
          </div>
          <div class="skilltree-desc">${skill.description}${effectText}</div>
          ${statusHTML}
          ${nextCost ? nextCostHTML : '<div class="skilltree-max">已达到最高等级</div>'}
          ${nextCost ? `<button class="btn btn-primary btn-upgrade-skill" data-skill-id="${skill.id}" ${btnDisabled}>升级</button>` : ''}
        </div>
      `;
    }

    // 获取术式名称
    const techNames = {
      cursedEnergyBoost: '咒力强化术', limitless: '无下限术式', tenShadows: '十种影法术',
      bloodManipulation: '赤血操术', boogieWoogie: '不义游戏', strawDoll: '傀儡操术'
    };

    // ★ 新增：基础技能区
    let baseHTML = '';
    for (const [id, skillDef] of Object.entries(BASE_SKILLS)) {
      if (id === 'advance' || id === 'retreat') continue;
      const { level, effect, nextCost } = getSkillLevelData(id, skillLevels);
      const proficiency = skillProficiency[id] || 0;
      const isUnlocked2 = level > 0;
      const canUpgrade = nextCost && proficiency >= nextCost.proficiency && skillPoints >= nextCost.skillPoints;

      let statusHTML2 = '';
      if (!isUnlocked2 && skillDef.requires) {
        statusHTML2 = `<span class="skilltree-status locked">🔒 需要前置: ${skillDef.requires}</span>`;
      }

      const nextCostHTML2 = nextCost
        ? `<div class="skilltree-cost">
            升级 Lv.${level + 1}: 🔧 ${nextCost.skillPoints} 技能点 | 📊 ${proficiency}/${nextCost.proficiency} 熟练度
           </div>`
        : '<div class="skilltree-max">已达到最高等级</div>';

      const btnDisabled2 = !canUpgrade ? 'disabled' : '';
      const effectText2 = effect ? ` (伤害 x${effect.damageMultiplier})` : '';

      baseHTML += `
        <div class="skilltree-card">
          <div class="skilltree-header">
            <span class="skilltree-name">${skillDef.name}</span>
            <span class="skilltree-level">Lv.${level}</span>
          </div>
          <div class="skilltree-desc">${skillDef.description}${effectText2}</div>
          ${statusHTML2}
          ${nextCost ? nextCostHTML2 : '<div class="skilltree-max">已达到最高等级</div>'}
          ${nextCost ? `<button class="btn btn-primary btn-upgrade-skill" data-skill-id="${id}" ${btnDisabled2}>升级</button>` : ''}
        </div>
      `;
    }

    const fullHTML = `
      <div class="skilltree-panel-container">
        <div class="skilltree-panel-header">
          <h3>📜 技能树 — ${techNames[techniqueId] || techniqueId}</h3>
          <span class="skilltree-sp">可用技能点: 🔧 ${skillPoints}</span>
        </div>
        <div class="skilltree-section">
          <h4>术式技能</h4>
          <div class="skilltree-grid">${treeHTML}</div>
        </div>
        <div class="skilltree-section">
          <h4>基础技能</h4>
          <div class="skilltree-grid">${baseHTML}</div>
        </div>
        <div class="skilltree-footer">
          <button id="btn-skilltree-close" class="btn btn-secondary">关闭</button>
        </div>
      </div>
    `;

    this.uiManager.showModal(fullHTML, { confirmOnly: false, useHTML: true });
  }
}
