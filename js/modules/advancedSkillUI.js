// js/modules/advancedSkillUI.js — 高级技巧 UI（Phase 11 新增）
// 职责：DOM 渲染、事件委托、选项卡切换
// 严禁：解锁判定逻辑（逻辑在 advanced_skills.js 中）

import { ADVANCED_SKILLS, checkAdvancedSkillUnlocked } from '../data/advanced_skills.js';
import { DOMAINS, canExpandDomain, calculateDomainStats } from '../data/domains.js';

export class AdvancedSkillUI {
  /**
   * @param {import('./SaveManager.js').SaveManager} saveManager
   * @param {object} uiManager — 主 UI 管理器引用
   */
  constructor(saveManager, uiManager) {
    this.saveManager = saveManager;
    this.uiManager = uiManager;
    /** @type {string} 当前选项卡 */
    this._activeTab = 'domain';
  }

  /**
   * 渲染高级技巧面板
   */
  render() {
    const st = this.saveManager.getState();
    if (!st) return;

    this._buildPanel(st);
  }

  /**
   * 创建完整的选项卡面板
   */
  _buildPanel(characterState) {
    const container = document.getElementById('advanced-skill-panel');
    if (!container) return;

    const tabs = [
      { id: 'domain', label: '🏛️ 领域展开', icon: '🏛️' },
      { id: 'simple_domain', label: '🗡️ 简易领域', icon: '🗡️' },
      { id: 'falling_blossom', label: '🌸 落花之情', icon: '🌸' },
      { id: 'hollow_wicker', label: '🏺 弥虚葛笼', icon: '🏺' }
    ];

    // 选项卡栏
    let html = '<div class="advanced-skill-tabs">';
    for (const tab of tabs) {
      const activeClass = tab.id === this._activeTab ? ' tab-active' : '';
      html += `<button class="btn advanced-skill-tab${activeClass}" data-tab="${tab.id}">${tab.label}</button>`;
    }
    html += '</div>';

    // 内容区
    html += '<div id="advanced-skill-content" class="advanced-skill-content">';
    html += this._renderTabContent(this._activeTab, characterState);
    html += '</div>';

    container.innerHTML = html;

    // 绑定选项卡切换
    this._bindTabs(container, characterState);
  }

  /**
   * 渲染指定选项卡的内容
   */
  _renderTabContent(tabId, st) {
    switch (tabId) {
      case 'domain':
        return this._renderDomainTab(st);
      case 'simple_domain':
        return this._renderAdvancedSkillTab('simple_domain', st);
      case 'falling_blossom':
        return this._renderAdvancedSkillTab('falling_blossom', st);
      case 'hollow_wicker':
        return this._renderAdvancedSkillTab('hollow_wicker', st);
      default:
        return '<p>未知选项卡。</p>';
    }
  }

  /**
   * 领域展开选项卡
   */
  _renderDomainTab(st) {
    const techId = st.techniqueId || 'cursedEnergyBoost';
    const domainDef = DOMAINS[techId];
    const hasDomainLearned = st.domainUnlocked === techId;

    let html = '<div class="advanced-skill-header">';
    if (domainDef) {
      html += `<h3>${domainDef.name}</h3>`;
      html += `<p class="advanced-skill-flavor">${domainDef.flavorText || ''}</p>`;
    } else {
      html += '<h3>领域展开</h3>';
      html += '<p class="advanced-skill-flavor">该术式尚未配备领域配置。</p>';
    }

    // 状态
    if (hasDomainLearned) {
      html += '<div class="skill-unlock-badge unlocked">✅ 已解锁</div>';
      if (domainDef) {
        const stats = calculateDomainStats(techId, st, true);
        if (stats) {
          html += '<div class="skill-stats-row">';
          html += `<span>HP: ${stats.hp}</span>`;
          html += `<span>攻击间隔: ${stats.attackInterval} 帧</span>`;
          html += `<span>伤害: ${stats.attackDamage}</span>`;
          html += `<span>咒力消耗: ${stats.mpCostPerTick}/tick</span>`;
          html += '</div>';
        }
      }
    } else if (domainDef) {
      html += '<div class="skill-unlock-badge locked">🔒 未解锁</div>';
      html += '<div class="skill-requirements">';
      html += '<h4>完全领域条件：</h4>';
      const complete = domainDef.completeRequirements;
      html += `<div class="req-row"><span>术式等级</span><div class="req-bar"><div class="req-fill" style="width:${this._pct(st, 'technique', complete.techniqueLevel)}%"></div></div><span>${st._techLevel || 0}/${complete.techniqueLevel}</span></div>`;
      html += `<div class="req-row"><span>结界术(咒力操控)</span><div class="req-bar"><div class="req-fill" style="width:${this._pctAttr(st, 'cursedEnergyControl', complete.cursedEnergyControl)}%"></div></div><span>${st.attributes?.cursedEnergyControl || 0}/${complete.cursedEnergyControl}</span></div>`;
      html += `<div class="req-row"><span>灵感</span><div class="req-bar"><div class="req-fill" style="width:${this._pctRes(st, 'inspiration', complete.inspiration)}%"></div></div><span>${st.inspiration || 0}/${complete.inspiration}</span></div>`;
      html += '</div>';
    } else {
      html += '<div class="skill-unlock-badge locked">🔒 该术式无领域</div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * 高级技巧（简易领域/落花之情/弥虚葛笼）选项卡
   */
  _renderAdvancedSkillTab(skillId, st) {
    const def = ADVANCED_SKILLS[skillId];
    if (!def) return '<p>技巧配置未找到。</p>';

    const check = checkAdvancedSkillUnlocked(skillId, st);
    const buffEffect = def.buffEffect || {};
    const attrs = st.attributes || {};

    let html = '<div class="advanced-skill-header">';
    html += `<h3>${def.name}</h3>`;
    html += `<p class="advanced-skill-flavor">${def.flavorText || ''}</p>`;
    html += `<p class="advanced-skill-desc">${def.description}</p>`;

    // 解锁状态
    if (st.advanced_skills_unlocked && st.advanced_skills_unlocked.includes(skillId)) {
      html += '<div class="skill-unlock-badge unlocked">✅ 已解锁</div>';
      html += '<div class="skill-stats-row">';
      if (buffEffect.shield_hp) html += `<span>护盾 HP: ${buffEffect.shield_hp}</span>`;
      if (buffEffect.domain_damage_reduction > 0) html += `<span>减免伤害: ${Math.round(buffEffect.domain_damage_reduction * 100)}%</span>`;
      if (buffEffect.mp_drain_per_10av) html += `<span>咒力消耗: ${buffEffect.mp_drain_per_10av}/10AV</span>`;
      html += '</div>';
    } else {
      html += `<div class="skill-unlock-badge locked">🔒 未解锁</div>`;
      if (check.reason) {
        html += `<p class="skill-lock-reason">💡 ${check.reason}</p>`;
      }
      html += '<div class="skill-requirements">';
      html += '<h4>解锁条件：</h4>';
      const req = def.requirements;

      // 前置请教
      if (req.prerequisite) {
        const hasPrereq = (st.advanced_skills_unlocked || []).includes(req.prerequisite);
        html += `<div class="req-row"><span>前置基础：「${req.prerequisite}」</span><span>${hasPrereq ? '✅' : '❌'}</span></div>`;
      }

      // 属性条件
      if (req.cursed_energy_control) {
        html += `<div class="req-row"><span>咒力操控</span><div class="req-bar"><div class="req-fill" style="width:${this._pctAttr(st, 'cursedEnergyControl', req.cursed_energy_control)}%"></div></div><span>${attrs.cursedEnergyControl || 0}/${req.cursed_energy_control}</span></div>`;
      }
      if (req.talent) {
        html += `<div class="req-row"><span>天赋</span><div class="req-bar"><div class="req-fill" style="width:${this._pctAttr(st, 'talent', req.talent)}%"></div></div><span>${attrs.talent || 0}/${req.talent}</span></div>`;
      }
      if (req.constitution) {
        html += `<div class="req-row"><span>体质</span><div class="req-bar"><div class="req-fill" style="width:${this._pctAttr(st, 'constitution', req.constitution)}%"></div></div><span>${attrs.constitution || 0}/${req.constitution}</span></div>`;
      }
      if (req.inspiration) {
        html += `<div class="req-row"><span>灵感</span><div class="req-bar"><div class="req-fill" style="width:${this._pctRes(st, 'inspiration', req.inspiration)}%"></div></div><span>${st.inspiration || 0}/${req.inspiration}</span></div>`;
      }

      // 解锁按钮
      if (check.unlocked) {
        html += `<button class="btn btn-primary advanced-skill-unlock-btn" data-skill="${skillId}">🔓 解锁${def.name}</button>`;
      }

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * 绑定选项卡切换事件
   */
  _bindTabs(container, st) {
    const tabs = container.querySelectorAll('.advanced-skill-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this._activeTab = tab.dataset.tab;
        this._buildPanel(st);
      });
    });

    // 解锁按钮事件
    const unlockBtn = container.querySelector('.advanced-skill-unlock-btn');
    if (unlockBtn) {
      unlockBtn.addEventListener('click', () => {
        const skillId = unlockBtn.dataset.skill;
        if (skillId && this.uiManager && typeof this.uiManager.unlockAdvancedSkill === 'function') {
          this.uiManager.unlockAdvancedSkill(skillId);
        }
      });
    }
  }

  /** 计算属性进度百分比 */
  _pctAttr(st, attr, target) {
    const val = (st.attributes && st.attributes[attr]) || 0;
    return Math.min(100, (val / target) * 100);
  }

  _pctRes(st, res, target) {
    const val = st[res] || 0;
    return Math.min(100, (val / target) * 100);
  }

  _pct(st, res, target) {
    const val = st[res] || 0;
    return Math.min(100, (val / target) * 100);
  }
}
