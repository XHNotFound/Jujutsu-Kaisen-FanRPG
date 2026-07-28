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
      { id: 'hollow_wicker', label: '🏺 弥虚葛笼', icon: '🏺' },
      // Phase 12: RCT tab always visible (like other advanced skills)
      { id: 'rct', label: '💚 反转术式', icon: '💚' }
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
      case 'rct':
        return this._renderRCTTab(st);
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
    const learnedTier = (st.domainLearnedTiers && st.domainLearnedTiers[techId]) || null;

    let html = '<div class="advanced-skill-header">';
    if (domainDef) {
      html += `<h3>${domainDef.name}</h3>`;
      html += `<p class="advanced-skill-flavor">${domainDef.flavorText || ''}</p>`;
    } else {
      html += '<h3>领域展开</h3>';
      html += '<p class="advanced-skill-flavor">该术式尚未配备领域配置。</p>';
    }

    // Phase 11: 分别处理不完全/完全领域
    if (learnedTier === 'complete') {
      html += '<div class="skill-unlock-badge unlocked">✅ 已学会完全领域展开</div>';
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
    } else if (learnedTier === 'incomplete') {
      html += '<div class="skill-unlock-badge unlocked">✅ 已学会不完全领域展开 (HP/伤害 ×0.6)</div>';
      if (domainDef) {
        const stats = calculateDomainStats(techId, st, false);
        if (stats) {
          html += '<div class="skill-stats-row">';
          html += `<span>HP: ${stats.hp}</span>`;
          html += `<span>攻击间隔: ${stats.attackInterval} 帧</span>`;
          html += `<span>伤害: ${stats.attackDamage}</span>`;
          html += `<span>咒力消耗: ${stats.mpCostPerTick}/tick</span>`;
          html += '</div>';
        }
      }
      // 检查是否可以升级到完全领域
      if (domainDef) {
        const cr = domainDef.completeRequirements;
        const sl = st.skillLevels || {};
        let totalTech = 0;
        for (const lv of Object.values(sl)) totalTech += lv;
        const barrier = st.attributes?.cursedEnergyControl || 0;
        const insp = st.inspiration || 0;
        const completeDone = totalTech >= cr.techniqueLevel && barrier >= cr.barrierLevel && insp >= cr.inspiration && barrier >= cr.cursedEnergyControl;

        html += '<div class="skill-requirements">';
        html += '<h4>升级至完全领域条件：</h4>';
        html += `<div class="req-row"><span>术式等级</span><div class="req-bar"><div class="req-fill" style="width:${Math.min(100, (totalTech/cr.techniqueLevel)*100)}%"></div></div><span>${totalTech}/${cr.techniqueLevel}</span></div>`;
        html += `<div class="req-row"><span>结界术(咒力操控)</span><div class="req-bar"><div class="req-fill" style="width:${Math.min(100, (barrier/cr.barrierLevel)*100)}%"></div></div><span>${barrier}/${cr.barrierLevel}</span></div>`;
        html += `<div class="req-row"><span>咒力操控</span><div class="req-bar"><div class="req-fill" style="width:${Math.min(100, (barrier/cr.cursedEnergyControl)*100)}%"></div></div><span>${barrier}/${cr.cursedEnergyControl}</span></div>`;
        html += `<div class="req-row"><span>灵感</span><div class="req-bar"><div class="req-fill" style="width:${Math.min(100, (insp/cr.inspiration)*100)}%"></div></div><span>${insp}/${cr.inspiration}</span></div>`;
        if (completeDone && insp >= cr.inspiration) {
          html += `<button class="btn btn-primary advanced-skill-unlock-btn" data-action="upgrade-domain" data-tier="complete" data-inspcost="${cr.inspiration}">🔓 升级为完全领域展开（消耗 ${cr.inspiration} 灵感）</button>`;
        } else {
          html += '<div class="skill-unlock-badge locked">🔒 完全领域条件不足</div>';
        }
        html += '</div>';
      }
    } else if (domainDef) {
      html += '<div class="skill-unlock-badge locked">🔒 未解锁</div>';
      html += '<div class="skill-requirements">';
      const cr = domainDef.completeRequirements;
      const ir = domainDef.incompleteRequirements;
      const sl = st.skillLevels || {};
      let totalTech = 0;
      for (const lv of Object.values(sl)) totalTech += lv;
      const barrier = st.attributes?.cursedEnergyControl || 0;
      const insp = st.inspiration || 0;
      const completeDone = totalTech >= cr.techniqueLevel && barrier >= cr.barrierLevel && insp >= cr.inspiration && barrier >= cr.cursedEnergyControl;
      const incompleteDone = totalTech >= ir.techniqueLevel && barrier >= ir.barrierLevel && insp >= ir.inspiration && barrier >= ir.cursedEnergyControl;

      // 完全领域卡片
      html += '<div class="domain-req-card">';
      html += '<h4>🏛️ 完全领域</h4>';
      html += `<div class="req-row"><span>术式等级</span><div class="req-bar"><div class="req-fill" style="width:${Math.min(100, (totalTech/cr.techniqueLevel)*100)}%"></div></div><span class="${totalTech>=cr.techniqueLevel?'req-met':''}">${totalTech}/${cr.techniqueLevel}</span></div>`;
      html += `<div class="req-row"><span>结界术(咒力操控)</span><div class="req-bar"><div class="req-fill" style="width:${Math.min(100, (barrier/cr.barrierLevel)*100)}%"></div></div><span class="${barrier>=cr.barrierLevel?'req-met':''}">${barrier}/${cr.barrierLevel}</span></div>`;
      html += `<div class="req-row"><span>咒力操控</span><div class="req-bar"><div class="req-fill" style="width:${Math.min(100, (barrier/cr.cursedEnergyControl)*100)}%"></div></div><span class="${barrier>=cr.cursedEnergyControl?'req-met':''}">${barrier}/${cr.cursedEnergyControl}</span></div>`;
      html += `<div class="req-row"><span>灵感</span><div class="req-bar"><div class="req-fill" style="width:${Math.min(100, (insp/cr.inspiration)*100)}%"></div></div><span class="${insp>=cr.inspiration?'req-met':''}">${insp}/${cr.inspiration}</span></div>`;
      if (completeDone && insp >= cr.inspiration) {
        html += `<button class="btn btn-primary advanced-skill-unlock-btn" data-action="learn-domain" data-tier="complete" data-inspcost="${cr.inspiration}">🔓 学会完全领域展开（消耗 ${cr.inspiration} 灵感）</button>`;
      } else {
        html += '<div class="skill-unlock-badge locked" style="margin-top:0.3rem;">🔒 条件不足</div>';
      }
      html += '</div>';

      // 不完全领域卡片
      html += '<div class="domain-req-card" style="margin-top:0.6rem;">';
      html += '<h4>📋 不完全领域</h4>';
      html += `<div class="req-row"><span>术式等级</span><div class="req-bar"><div class="req-fill" style="width:${Math.min(100, (totalTech/ir.techniqueLevel)*100)}%"></div></div><span class="${totalTech>=ir.techniqueLevel?'req-met':''}">${totalTech}/${ir.techniqueLevel}</span></div>`;
      html += `<div class="req-row"><span>结界术(咒力操控)</span><div class="req-bar"><div class="req-fill" style="width:${Math.min(100, (barrier/ir.barrierLevel)*100)}%"></div></div><span class="${barrier>=ir.barrierLevel?'req-met':''}">${barrier}/${ir.barrierLevel}</span></div>`;
      html += `<div class="req-row"><span>咒力操控</span><div class="req-bar"><div class="req-fill" style="width:${Math.min(100, (barrier/ir.cursedEnergyControl)*100)}%"></div></div><span class="${barrier>=ir.cursedEnergyControl?'req-met':''}">${barrier}/${ir.cursedEnergyControl}</span></div>`;
      html += `<div class="req-row"><span>灵感</span><div class="req-bar"><div class="req-fill" style="width:${Math.min(100, (insp/ir.inspiration)*100)}%"></div></div><span class="${insp>=ir.inspiration?'req-met':''}">${insp}/${ir.inspiration}</span></div>`;
      if (incompleteDone && insp >= ir.inspiration) {
        html += `<button class="btn btn-primary advanced-skill-unlock-btn" data-action="learn-domain" data-tier="incomplete" data-inspcost="${ir.inspiration}">🔓 学会不完全领域展开（消耗 ${ir.inspiration} 灵感）</button>`;
      } else {
        html += '<div class="skill-unlock-badge locked" style="margin-top:0.3rem;">🔒 条件不足</div>';
      }
      html += '</div>';
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
   * Phase 12: 反转术式 (RCT) 选项卡
   */
  _renderRCTTab(st) {
    const def = ADVANCED_SKILLS['rct'];
    if (!def) return '<p>反转术式配置未找到。</p>';

    const check = checkAdvancedSkillUnlocked('rct', st);
    const attrs = st.attributes || {};
    const unlockedPrereqs = st.advanced_skills_unlocked || [];

    let html = '<div class="advanced-skill-header">';
    html += `<h3>${def.name}</h3>`;
    html += `<p class="advanced-skill-flavor">${def.flavorText || ''}</p>`;
    html += `<p class="advanced-skill-desc">${def.description}</p>`;

    // 解锁状态
    if (unlockedPrereqs.includes('rct')) {
      html += '<div class="skill-unlock-badge unlocked">✅ 已解锁</div>';
      html += '<div class="skill-stats-row">';
      // 显示当前效率
      const cee = attrs.cursedEnergyEfficiency || 0;
      let eff;
      if (cee < 20) eff = 0.5;
      else if (cee <= 40) eff = 0.5 + (cee - 20) * 0.01;
      else if (cee <= 60) eff = 0.7 + (cee - 40) * 0.015;
      else eff = 1.0 + (cee - 60) * 0.02;
      html += `<span>回复效率: ${eff.toFixed(3)}</span>`;
      html += '<span>冷却: 60 AV</span>';
      html += '<span>消耗: 自由选择 (1 ~ MP)</span>';
      html += '</div>';
    } else {
      html += '<div class="skill-unlock-badge locked">🔒 未解锁</div>';
      if (check.reason) {
        html += `<p class="skill-lock-reason">💡 ${check.reason}</p>`;
      }
      html += '<div class="skill-requirements">';
      html += '<h4>解锁条件：</h4>';

      const req = def.requirements;

      // 前置请教
      if (req.prerequisite) {
        const hasPrereq = unlockedPrereqs.includes(req.prerequisite);
        html += `<div class="req-row"><span>前置基础：「${req.prerequisite}」</span><span>${hasPrereq ? '✅' : '❌ (向乙骨忧太/五条悟/家入硝子请教获得)'}</span></div>`;
      }

      // 属性条件
      if (req.cursed_energy) {
        html += `<div class="req-row"><span>咒力总量</span><div class="req-bar"><div class="req-fill" style="width:${this._pctAttr(st, 'cursedEnergy', req.cursed_energy)}%"></div></div><span>${attrs.cursedEnergy || 0}/${req.cursed_energy}</span></div>`;
      }
      if (req.cursed_energy_efficiency) {
        html += `<div class="req-row"><span>咒力效率</span><div class="req-bar"><div class="req-fill" style="width:${this._pctAttr(st, 'cursedEnergyEfficiency', req.cursed_energy_efficiency)}%"></div></div><span>${attrs.cursedEnergyEfficiency || 0}/${req.cursed_energy_efficiency}</span></div>`;
      }
      if (req.inspiration) {
        html += `<div class="req-row"><span>灵感</span><div class="req-bar"><div class="req-fill" style="width:${this._pctRes(st, 'inspiration', req.inspiration)}%"></div></div><span>${st.inspiration || 0}/${req.inspiration}</span></div>`;
      }

      // 解锁按钮
      if (check.unlocked) {
        html += `<button class="btn btn-primary advanced-skill-unlock-btn" data-skill="rct">🔓 解锁${def.name}</button>`;
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

    // 解锁按钮事件（高级技巧 + 领域学习）
    const unlockBtns = container.querySelectorAll('.advanced-skill-unlock-btn');
    unlockBtns.forEach(unlockBtn => {
      unlockBtn.addEventListener('click', () => {
        const action = unlockBtn.dataset.action;
        // Phase 11: 领域学习按钮
        if (action === 'learn-domain' || action === 'upgrade-domain') {
          const tier = unlockBtn.dataset.tier;
          const inspCost = parseInt(unlockBtn.dataset.inspcost) || 0;
          const state = this.saveManager.getState();
          if (!state) return;

          if (inspCost > 0 && (state.inspiration || 0) < inspCost) {
            if (this.uiManager && typeof this.uiManager.showModal === 'function') {
              this.uiManager.showModal(`灵感不足！需要 ${inspCost} 点灵感，当前 ${state.inspiration || 0}。`, { confirmOnly: true, onConfirm: () => this.uiManager.hideModal() });
            }
            return;
          }
          state.domainUnlocked = state.techniqueId;
          if (!state.domainLearnedTiers) state.domainLearnedTiers = {};
          state.domainLearnedTiers[state.techniqueId] = tier || 'incomplete';
          if (inspCost > 0) state.inspiration = Math.max(0, (state.inspiration || 0) - inspCost);
          this.saveManager.setState(state);
          this.saveManager.saveToSlot(this.saveManager._findCurrentSlot() || 0);
          if (this.uiManager && typeof this.uiManager.showModal === 'function') {
            this.uiManager.showModal(
              tier === 'complete' ? '你学会了完全领域展开！' : '你学会了不完全领域展开！（HP/伤害 ×0.6）',
              { confirmOnly: true, onConfirm: () => { this.uiManager.hideModal(); this._buildPanel(state); } }
            );
          }
          return;
        }
        // 原有：高级技巧解锁按钮
        const skillId = unlockBtn.dataset.skill;
        if (skillId && this.uiManager && typeof this.uiManager.unlockAdvancedSkill === 'function') {
          this.uiManager.unlockAdvancedSkill(skillId);
        }
      });
    });
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
