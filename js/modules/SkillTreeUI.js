// js/modules/SkillTreeUI.js — 技能树 UI 面板（Phase 6 重写）
// 负责主界面完整技能树渲染（含分支/解锁/升级）+ 事件委托
// 严禁包含任何战斗计算逻辑

import { SKILL_TREES, BASE_SKILLS, getSkillLevelData, canUnlockSkill, getUnlockableSkills } from '../data/skills.js';

export class SkillTreeUI {
  /**
   * @param {import('./SaveManager.js').SaveManager} saveManager
   * @param {import('./UIManager.js').UIManager} uiManager
   */
  constructor(saveManager, uiManager) {
    this.saveManager = saveManager;
    this.uiManager = uiManager;
  }

  show() {
    const state = this.saveManager.getState();
    if (!state) {
      this.uiManager.showModal('没有角色数据。', { confirmOnly: true, onConfirm: () => this.uiManager.hideModal() });
      return;
    }

    const techniqueId = state.techniqueId || 'cursedEnergyBoost';
    const tree = SKILL_TREES[techniqueId];
    if (!tree) {
      this.uiManager.showModal('未知术式技能树。', { confirmOnly: true, onConfirm: () => this.uiManager.hideModal() });
      return;
    }

    const skillLevels = state.skillLevels || {};
    const skillProficiency = state.skillProficiency || {};
    const skillPoints = state.skillPoints || 0;
    const attributes = state.attributes || {};

    // 术式名称映射
    const techNames = {
      cursedEnergyBoost: '咒力强化术', limitless: '无下限术式', tenShadows: '十种影法术',
      bloodManipulation: '赤血操术', boogieWoogie: '不义游戏', strawDoll: '傀儡操术',
      overtime: '十划咒法', curseManipulation: '咒灵操术', pureMartial: '纯体术流'
    };

    // ===== 术式技能节点列表 =====
    let treeHTML = '';
    for (const skill of tree.nodes) {
      const currentLevel = skillLevels[skill.id] || 0;
      const isUnlocked = currentLevel > 0;
      const { level, effect, nextCost, maxLevel } = getSkillLevelData(skill.id, skillLevels);
      const proficiency = skillProficiency[skill.id] || 0;

      // 分支标签
      let branchTag = '';
      if (!skill.isBaseSkill && isUnlocked) {
        branchTag = '<span class="skilltree-branch-tag">分支</span>';
      } else if (!skill.isBaseSkill && !isUnlocked) {
        const unlockCheck = canUnlockSkill(skill.id, skillLevels, skillPoints, attributes);
        if (unlockCheck.can) {
          branchTag = '<span class="skilltree-branch-tag unlockable">可解锁</span>';
        } else {
          branchTag = `<span class="skilltree-branch-tag locked">🔒 ${unlockCheck.reason}</span>`;
        }
      }

      // 基础技能标签
      if (skill.isBaseSkill) {
        branchTag = '<span class="skilltree-branch-tag base">基础</span>';
      }

      let actionHTML = '';
      if (!isUnlocked) {
        // 未解锁 → 显示解锁按钮
        const unlockCheck = canUnlockSkill(skill.id, skillLevels, skillPoints, attributes);
        actionHTML = `<button class="btn btn-primary btn-skill-action" data-skill-id="${skill.id}" data-action="unlock" ${unlockCheck.can ? '' : 'disabled'}>解锁</button>`;
      } else if (nextCost) {
        // 已解锁 → 升级按钮
        const canUpgrade = proficiency >= nextCost.proficiency && skillPoints >= nextCost.skillPoints && level < maxLevel;
        actionHTML = `<button class="btn btn-primary btn-skill-action" data-skill-id="${skill.id}" data-action="upgrade" ${canUpgrade ? '' : 'disabled'}>升级 Lv.${level + 1}</button>`;
      } else {
        actionHTML = '<span class="skilltree-max">已达最高 Lv.' + maxLevel + '</span>';
      }

      const nextCostHTML = nextCost
        ? `<div class="skilltree-cost">🔧 ${nextCost.skillPoints} 技能点 | 📊 ${proficiency}/${nextCost.proficiency} 熟练度 → Lv.${level + 1}</div>`
        : '';

      const effectText = effect
        ? ` (伤害 x${effect.damageMultiplier !== undefined ? effect.damageMultiplier : 1.0}, MP ${effect.cost !== undefined ? effect.cost : skill.cost}, 咏唱 ${effect.castTime !== undefined ? effect.castTime : skill.castTime}帧, 补偿 ${effect.recoverySpeed !== undefined ? effect.recoverySpeed : skill.baseRecoverySpeed}/tick)`
        : '';

      const isLockedClass = (!isUnlocked && !canUnlockSkill(skill.id, skillLevels, skillPoints, attributes).can) ? 'skilltree-locked' : '';

      treeHTML += `
        <div class="skilltree-card ${isLockedClass}" data-skill-id="${skill.id}">
          <div class="skilltree-header">
            <span class="skilltree-name">${skill.name} ${branchTag}</span>
            <span class="skilltree-level">${isUnlocked ? 'Lv.' + level : '未解锁'}</span>
          </div>
          <div class="skilltree-desc">${skill.description}${effectText}</div>
          ${isUnlocked && nextCost ? nextCostHTML : ''}
          <div class="skilltree-action-row">${actionHTML}</div>
        </div>
      `;
    }

    // ===== 领域信息卡片 =====
    let domainHTML = '';
    if (tree.domain) {
      const d = tree.domain;
      const reqText = d.unlockRequirements
        ? `需要: ${Object.entries(d.unlockRequirements.skillLevels || {}).map(([k, v]) => k + ' Lv.' + v).join(', ')}，灵感×${d.unlockRequirements.inspiration || 0}`
        : '条件未知';
      domainHTML = `
        <div class="skilltree-card skilltree-domain-card">
          <div class="skilltree-header">
            <span class="skilltree-name">🏛️ ${d.name}（领域展开）</span>
          </div>
          <div class="skilltree-desc">${d.flavorText || ''}</div>
          <div class="skilltree-domain-req">${reqText}</div>
          <span class="skilltree-domain-status">🔒 本期暂未开放</span>
        </div>
      `;
    }

    // ===== 基础技能区 =====
    let baseHTML = '';
    for (const [id, skillDef] of Object.entries(BASE_SKILLS)) {
      if (id === 'advance' || id === 'retreat') continue;
      const { level, effect, nextCost, maxLevel } = getSkillLevelData(id, skillLevels);
      const proficiency = skillProficiency[id] || 0;
      const canUpgrade = nextCost && proficiency >= nextCost.proficiency && skillPoints >= nextCost.skillPoints && level < maxLevel;

      const effectText2 = effect
        ? ` (Lv.${level} 伤害 x${effect.damageMultiplier}, 咏唱 ${skillDef.castTime}帧, 补偿 ${skillDef.baseRecoverySpeed}/tick)`
        : '';

      baseHTML += `
        <div class="skilltree-card">
          <div class="skilltree-header">
            <span class="skilltree-name">${skillDef.name}</span>
            <span class="skilltree-level">Lv.${level} / ${maxLevel}</span>
          </div>
          <div class="skilltree-desc">${skillDef.description}${effectText2}</div>
          ${nextCost ? `<div class="skilltree-cost">🔧 ${nextCost.skillPoints} 技能点 | 📊 ${proficiency}/${nextCost.proficiency} 熟练度 → Lv.${level + 1}</div>` : '<div class="skilltree-max">已达最高等级</div>'}
          ${nextCost ? `<button class="btn btn-primary btn-skill-action" data-skill-id="${id}" data-action="upgrade" ${canUpgrade ? '' : 'disabled'}>升级 Lv.${level + 1}</button>` : ''}
        </div>
      `;
    }

    const containerId = 'skilltree-panel-' + Date.now();
    const fullHTML = `
      <div id="${containerId}" class="skilltree-panel-container">
        <div class="skilltree-panel-header">
          <h3>📜 技能树 — ${techNames[techniqueId] || techniqueId}</h3>
          <span class="skilltree-sp">可用技能点: 🔧 ${skillPoints} | 灵感: ⚡ ${state.inspiration || 0}</span>
        </div>
        ${domainHTML}
        <div class="skilltree-section">
          <h4>术式技能 (${tree.nodes.length} 个节点)</h4>
          <div class="skilltree-grid">${treeHTML}</div>
        </div>
        <div class="skilltree-section">
          <h4>基础技能</h4>
          <div class="skilltree-grid">${baseHTML}</div>
        </div>
        <div class="skilltree-footer"></div>
      </div>
    `;

    this.uiManager.showModal(fullHTML, { confirmOnly: false, useHTML: true });

    // Phase 6: 事件委托绑定在面板容器上
    setTimeout(() => {
      const panel = document.getElementById(containerId);
      if (!panel) return;

      panel.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-skill-action');
        if (!btn || btn.disabled) return;

        const skillId = btn.dataset.skillId;
        const action = btn.dataset.action; // "upgrade" or "unlock"

        const st = this.saveManager.getState();
        const allSkills = { ...BASE_SKILLS };
        for (const t of Object.values(SKILL_TREES)) {
          for (const s of t.nodes) allSkills[s.id] = s;
        }
        const skillDef = allSkills[skillId];
        if (!skillDef) {
          this.uiManager.showModal('未找到技能定义。', { confirmOnly: true, onConfirm: () => this.uiManager.hideModal() });
          return;
        }

        if (action === 'unlock') {
          // 解锁分支技能
          const check = canUnlockSkill(skillId, st.skillLevels || {}, st.skillPoints || 0, st.attributes || {});
          if (!check.can) {
            this.uiManager.showModal(check.reason, { confirmOnly: true, onConfirm: () => this.uiManager.hideModal() });
            return;
          }
          if (!st.skillLevels) st.skillLevels = {};
          st.skillLevels[skillId] = 1;
          this.saveManager.setState(st);
          // 持久化
          this.saveManager.saveToSlot(this.saveManager._findCurrentSlot() || 0);
          this.uiManager.showModal(`技能「${skillDef.name}」解锁成功！`, {
            confirmOnly: true,
            onConfirm: () => { this.uiManager.hideModal(); this.show(); }
          });
        } else if (action === 'upgrade') {
          // 升级
          const result = this.saveManager.upgradeSkill(skillId, skillDef);
          this.uiManager.showModal(result.message, {
            confirmOnly: true,
            onConfirm: () => { this.uiManager.hideModal(); this.show(); }
          });
        }
      });
    }, 100);
  }
}
