// js/modules/UIManager.js — UI 管理器（唯一负责 DOM 操作、事件监听和画面切换）

import { ATTRIBUTES } from '../data/attributes.js';
import { BattleUI } from './BattleUI.js';
import { SkillTreeUI } from './SkillTreeUI.js';
import { HubSystem } from './HubSystem.js';
import { AdvancedSkillUI } from './advancedSkillUI.js';
import { NPCS } from '../data/npcs.js';
import { QUESTS } from '../data/quests.js';
import { DOMAINS } from '../data/domains.js';
import { getNextExam } from '../data/exams.js';
import { checkAdvancedSkillUnlocked } from '../data/advanced_skills.js';

/**
 * UIManager 职责：
 * - DOM 查询与渲染
 * - 统一事件绑定
 * - 画面切换
 * - 弹窗管理
 *
 * 严禁：
 * - 在 UI 层写业务逻辑或数值计算
 * - 让 CharCreator / SaveManager 直接操作 DOM
 */

export class UIManager {
  /**
   * @param {import('./SaveManager.js').SaveManager} saveManager
   * @param {import('./CharCreator.js').CharCreator} charCreator
   * @param {import('../pyodide_loader.js').PyodideLoader} pyodideLoader
   */
  constructor(saveManager, charCreator, pyodideLoader) {
    this.saveManager = saveManager;
    this.charCreator = charCreator;
    this.pyodideLoader = pyodideLoader;
    this.currentScreen = null;

    // 缓存弹窗回调
    this._modalCallbacks = {};

    // BattleUI 延迟创建（首次使用时初始化）
    /** @type {import('./BattleUI.js').BattleUI|null} */
    this._battleUI = null;

    // Phase 5: HubSystem 初始化
    /** @type {HubSystem} */
    this._hubSystem = new HubSystem();

    // Phase 11: AdvancedSkillUI 初始化
    /** @type {AdvancedSkillUI} */
    this._advancedSkillUI = new AdvancedSkillUI(this.saveManager, this);
  }

  // ================================================================
  //  初始化
  // ================================================================

  /**
   * 初始化应用：检查存档状态，显示标题画面
   */
  init() {
    this._bindGlobalEvents();
    this.renderTitleScreen();
  }

  // ================================================================
  //  画面切换
  // ================================================================

  /**
   * 切换到指定画面
   * @param {string} screenId - 目标画面的 DOM id
   */
  showScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.add('hidden'));

    const target = document.getElementById(screenId);
    if (target) {
      target.classList.remove('hidden');
      this.currentScreen = screenId;
    }
  }

  // ================================================================
  //  标题画面
  // ================================================================

  /**
   * 渲染标题画面
   */
  renderTitleScreen() {
    this.showScreen('screen-title');

    const btnContinue = document.getElementById('btn-continue');
    const noSaveHint = document.getElementById('no-save-hint');

    if (this.saveManager.hasAnySave()) {
      btnContinue.disabled = false;
      noSaveHint.classList.add('hidden');
    } else {
      btnContinue.disabled = true;
      noSaveHint.classList.remove('hidden');
    }
  }

  // ================================================================
  //  角色创建 — Step 1: 输入名字
  // ================================================================

  /**
   * 渲染角色创建 — Step 1
   */
  renderCreateName() {
    this.charCreator.reset();
    this.showScreen('screen-create-name');

    const input = document.getElementById('input-name');
    const btnNext = document.getElementById('btn-name-next');
    const errorEl = document.getElementById('name-error');

    input.value = '';
    btnNext.disabled = true;
    errorEl.classList.add('hidden');

    // 输入时校验
    input.oninput = () => {
      const name = input.value.trim();
      const len = name.length;

      if (len === 0) {
        btnNext.disabled = true;
        errorEl.classList.add('hidden');
      } else if (len < 3) {
        btnNext.disabled = true;
        errorEl.textContent = `至少需要 3 个字符（当前 ${len} 个）`;
        errorEl.classList.remove('hidden');
      } else {
        btnNext.disabled = false;
        errorEl.classList.add('hidden');
      }
    };

    // 回车键 = 下一步
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !btnNext.disabled) {
        btnNext.click();
      }
    };

    btnNext.onclick = () => {
      const name = input.value.trim();
      if (name.length < 3) return;
      this.charCreator.characterName = name;
      this.charCreator.rollAllAttributes();
      this.renderCreateRoll();
    };
  }

  // ================================================================
  //  角色创建 — Step 2: Roll点
  // ================================================================

  /**
   * 渲染角色创建 — Step 2
   */
  renderCreateRoll() {
    this.showScreen('screen-create-roll');

    // 首次掷骰
    if (!this.charCreator.currentAttributes) {
      this.charCreator.rollAllAttributes();
    }
    this._updateRollDisplay();
  }

  /**
   * 更新 Roll 画面（属性、评定、风味文本、重掷次数、储存状态）
   */
  _updateRollDisplay() {
    const attrs = this.charCreator.currentAttributes;
    const rerolls = this.charCreator.rerollsLeft;
    const rank = this.charCreator.calculateRank(attrs);
    const flavor = this.charCreator.getFlavorText(attrs);
    const saved = this.charCreator.savedAttributes;

    // 剩余次数
    document.getElementById('reroll-count').textContent = rerolls;
    // 更新 step indicator
    document.querySelector('#screen-create-roll .step-indicator').textContent =
      `Step 2 / 3（剩余重掷: ${rerolls}次${saved ? '，已储存 1 套六维' : ''}）`;

    // 属性列表
    this._renderAttrList('roll-attributes', attrs);

    // 评定
    document.getElementById('roll-rank').innerHTML = `
      <span class="rank-name">${rank.name}</span>
      <span class="rank-avg">（平均值: ${rank.avg}）</span>
    `;

    // 风味文本
    document.getElementById('roll-flavor').textContent = flavor;

    // 储存区域
    const savedArea = document.getElementById('saved-roll-area');
    if (saved) {
      savedArea.classList.remove('hidden');
      this._renderAttrList('saved-roll-attrs', saved);
      const savedRank = this.charCreator.calculateRank(saved);
      document.getElementById('saved-roll-rank').textContent =
        `评定: ${savedRank.name}（平均值: ${savedRank.avg}）`;
    } else {
      savedArea.classList.add('hidden');
    }

    // 按钮逻辑
    const btnReroll = document.getElementById('btn-reroll');
    const btnSaveReroll = document.getElementById('btn-save-reroll');
    const btnUseCurrent = document.getElementById('btn-use-current');

    btnReroll.disabled = rerolls <= 0;
    btnReroll.onclick = () => {
      const result = this.charCreator.rollAllAttributes();
      if (result) {
        this._updateRollDisplay();
      } else {
        // 没有重掷次数了 — 进入最终选择模式
        this._enterFinalSelection();
      }
    };

    // 储存按钮：有剩余次数才能储存，没有储存过才能用（用 != 而非 !== 允 undefined）
    btnSaveReroll.disabled = rerolls <= 0 || (saved != null);
    btnSaveReroll.onclick = () => {
      this.charCreator.saveAttributes();
      const r = this.charCreator.rollAllAttributes();
      if (r) this._updateRollDisplay();
    };

    // 直接选择
    btnUseCurrent.onclick = () => {
      if (saved) {
        // 如果有储存结果，进入最终选择
        this._enterFinalSelection();
      } else {
        // 直接进入自由加点
        this.charCreator.markBonusBase();
        this._renderBonusScreen();
      }
    };

    // 如果没有剩余次数且有储存结果，立即进入最终选择
    if (rerolls <= 0) {
      if (saved) {
        this._enterFinalSelection();
      } else {
        // 没有储存，强制使用当前结果 → 进入自由加点
        this.charCreator.markBonusBase();
        setTimeout(() => this._renderBonusScreen(), 300);
        this.showModal('重掷次数已用完。将使用当前六维继续。', { confirmOnly: true, onConfirm: () => this.hideModal() });
      }
    }
  }

  /**
   * Phase 11: 最后一次投掷 — 在当前和储存之间最终选择
   */
  _enterFinalSelection() {
    const saved = this.charCreator.savedAttributes;
    const current = this.charCreator.currentAttributes;
    if (!saved || !current) return;

    const container = document.getElementById('screen-create-roll');
    const savedRank = this.charCreator.calculateRank(saved);
    const curRank = this.charCreator.calculateRank(current);

    // 隐藏常规按钮，显示两个选择按钮
    document.getElementById('roll-buttons').innerHTML = `
      <button id="btn-pick-saved" class="btn btn-primary">⬆️ 选择储存的六维开始游戏</button>
      <button id="btn-pick-current" class="btn btn-secondary">⬇️ 选择当前的六维开始游戏</button>
    `;

    document.getElementById('btn-pick-saved').onclick = () => {
      this.charCreator.useSavedAttributes();
      this.charCreator.markBonusBase();
      this._renderBonusScreen();
    };

    document.getElementById('btn-pick-current').onclick = () => {
      this.charCreator.markBonusBase();
      this._renderBonusScreen();
    };
  }

  /**
   * 渲染属性列表到指定容器
   */
  _renderAttrList(containerId, attrs) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    for (const [key, cfg] of Object.entries(ATTRIBUTES)) {
      const value = attrs[key];
      const item = document.createElement('div');
      item.className = 'roll-attr-item';
      item.innerHTML = `
        <span class="roll-attr-name">${cfg.name}</span>
        <span class="roll-attr-value">${value}</span>
      `;
      container.appendChild(item);
    }
  }

  // ================================================================
  //  角色创建 — Step 2.5: 自由加点
  // ================================================================

  _renderBonusScreen() {
    this.showScreen('screen-create-bonus');
    const attrs = this.charCreator.currentAttributes;
    this._updateBonusDisplay();
  }

  _updateBonusDisplay() {
    const attrs = this.charCreator.currentAttributes;
    const remaining = this.charCreator.bonusPoints;
    const base = this.charCreator._bonusBaseAttributes || {};

    document.getElementById('bonus-points').textContent = remaining;

    const container = document.getElementById('bonus-attributes');
    container.innerHTML = '';
    for (const [key, cfg] of Object.entries(ATTRIBUTES)) {
      const value = attrs[key];
      const baseVal = base[key] || value;
      const hasBonus = value > baseVal;
      const item = document.createElement('div');
      item.className = 'roll-attr-item bonus-attr-item';
      item.innerHTML = `
        <span class="roll-attr-name">${cfg.name}</span>
        <span class="roll-attr-value${hasBonus ? ' bonus-added' : ''}">${value}${hasBonus ? ` (+${value - baseVal})` : ''}</span>
        <button class="btn btn-plus" data-attr="${key}" ${remaining <= 0 ? 'disabled' : ''}>+</button>
        ${hasBonus ? `<button class="btn btn-minus" data-attr="${key}">-</button>` : ''}
      `;
      container.appendChild(item);
    }

    // 事件绑定
    container.querySelectorAll('.btn-plus').forEach(btn => {
      btn.onclick = () => {
        const r = this.charCreator.addBonusPoint(btn.dataset.attr);
        if (r.success) this._updateBonusDisplay();
      };
    });
    container.querySelectorAll('.btn-minus').forEach(btn => {
      btn.onclick = () => {
        this.charCreator.removeBonusPoint(btn.dataset.attr);
        this._updateBonusDisplay();
      };
    });

    // 确认按钮
    const nextBtn = document.getElementById('btn-bonus-next');
    nextBtn.disabled = remaining > 0;
    nextBtn.onclick = () => {
      this.renderCreateChoices();
    };

    // 返回按钮
    document.getElementById('btn-bonus-prev').onclick = () => {
      // 恢复原始属性并返回
      this.charCreator.currentAttributes = { ...this.charCreator._bonusBaseAttributes };
      this.charCreator.bonusPoints = 3;
      this.renderCreateRoll();
    };
  }

  // ================================================================
  //  角色创建 — Step 3: 术式与咒缚选择
  // ================================================================

  /**
   * 渲染角色创建 — Step 3
   */
  renderCreateChoices() {
    this.showScreen('screen-create-choices');

    // 重置选择状态
    this.charCreator.selectedTechniqueId = null;
    this.charCreator.selectedBindingId = 'none';

    this._renderTechniqueGrid();
    this._renderBindingGrid();
    this._updateConfirmButton();

    // 上一步
    document.getElementById('btn-choices-prev').onclick = () => {
      this.renderCreateRoll();
    };
  }

  /**
   * 渲染术式卡片网格
   */
  _renderTechniqueGrid() {
    const grid = document.getElementById('technique-grid');
    grid.innerHTML = '';

    const attrs = this.charCreator.currentAttributes;
    const techniques = this.charCreator.getTechniques();

    for (const technique of techniques) {
      const req = this.charCreator.checkTechniqueRequirements(technique, attrs);
      const selectable = req.satisfied;

      const card = document.createElement('div');
      card.className = 'card';
      if (!selectable) {
        card.classList.add('card-disabled');
      }
      card.dataset.techniqueId = technique.id;

      // 前置要求 HTML
      let reqHtml = '';
      if (req.details.length > 0) {
        reqHtml = req.details.map(d => {
          const cls = d.ok ? 'requirement-ok' : 'requirement-fail';
          const mark = d.ok ? '✓' : '✗';
          return `<div class="card-req ${cls}">${mark} ${d.name} ≥ ${d.required}（当前: ${d.current}）</div>`;
        }).join('');
      }

      card.innerHTML = `
        <div class="card-name">${technique.name}</div>
        <div class="card-desc">${technique.description}</div>
        ${reqHtml}
        ${technique.flavorText ? `<div class="card-flavor">"${technique.flavorText}"</div>` : ''}
      `;

      if (selectable) {
        card.addEventListener('click', () => {
          // 取消之前选中
          grid.querySelectorAll('.card').forEach(c => c.classList.remove('card-selected'));
          card.classList.add('card-selected');
          this.charCreator.selectedTechniqueId = technique.id;
          this._updateConfirmButton();
        });
      }

      grid.appendChild(card);
    }
  }

  /**
   * 渲染咒缚卡片网格
   */
  _renderBindingGrid() {
    const grid = document.getElementById('binding-grid');
    grid.innerHTML = '';

    const bindings = this.charCreator.getBindings();

    for (const binding of bindings) {
      const isNone = binding.id === 'none';
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.bindingId = binding.id;

      // 默认选中"不选择"
      if (isNone) {
        card.classList.add('card-selected');
      }

      // 代价 HTML
      const costKeys = Object.keys(binding.costs);
      let costHtml = '';
      if (costKeys.length > 0) {
        const items = costKeys.map(k => {
          const name = (ATTRIBUTES[k] && ATTRIBUTES[k].name) || k;
          const val = binding.costs[k];
          const label = val <= -99 ? '完全丧失' : (val < 0 ? `${val}` : `+${val}`);
          return `${name} ${label}`;
        }).join('、');
        costHtml = `<div class="card-cost">代价: ${items}</div>`;
      }

      // 增益 HTML
      const bonusKeys = Object.keys(binding.bonuses);
      let bonusHtml = '';
      if (bonusKeys.length > 0) {
        const items = bonusKeys.map(k => {
          const name = (ATTRIBUTES[k] && ATTRIBUTES[k].name) || k;
          return `${name} +${binding.bonuses[k]}`;
        }).join('、');
        bonusHtml = `<div class="card-bonus">增益: ${items}</div>`;
      }

      card.innerHTML = `
        <div class="card-name">${binding.name}</div>
        <div class="card-desc">${binding.description}</div>
        ${costHtml}
        ${bonusHtml}
        ${binding.flavorText ? `<div class="card-flavor">"${binding.flavorText}"</div>` : ''}
      `;

      card.addEventListener('click', () => {
        grid.querySelectorAll('.card').forEach(c => c.classList.remove('card-selected'));
        card.classList.add('card-selected');
        this.charCreator.selectedBindingId = binding.id;
      });

      grid.appendChild(card);
    }
  }

  /**
   * 更新"确认创建"按钮状态
   */
  _updateConfirmButton() {
    const btn = document.getElementById('btn-confirm-create');
    btn.disabled = !this.charCreator.selectedTechniqueId;

    btn.onclick = () => {
      // 构建存档数据
      const saveData = this.saveManager.buildSaveData(this.charCreator);
      this.saveManager.setState(saveData);

      // 显示创建成功弹窗
      this.showModal(
        `角色「${saveData.characterName}」创建成功！\n评定：${saveData.rank}`,
        {
          confirmOnly: true,
          onConfirm: () => {
            this.hideModal();
            this.renderMainScreen();
          }
        }
      );
    };
  }

  // ================================================================
  //  主界面 HUD
  // ================================================================

  /**
   * 渲染主界面
   */
  renderMainScreen() {
    this.showScreen('screen-main');

    // clean up any stale train panel delegation
    this._unbindTrainDelegation();

    const state = this.saveManager.getState();
    if (!state) {
      this.renderTitleScreen();
      return;
    }

    state.hp = (state.hp !== undefined && state.hp !== null) ? state.hp : (state.maxHp || 100);
    state.mp = (state.mp !== undefined && state.mp !== null) ? state.mp : (state.maxMp || 100);
    state.skillPoints = (state.skillPoints !== undefined && state.skillPoints !== null) ? state.skillPoints : 5;

    this._updateHUD(state);
    this._bindMainMenuEvents();
  }

  /**
   * 更新顶部状态栏
   */
  _updateHUD(state) {
    document.getElementById('hud-name').textContent = state.characterName || '--';
    document.getElementById('hud-rank').textContent = state.rank || '--';

    // HP 条
    const hpPct = Math.max(0, (state.hp / state.maxHp) * 100);
    document.getElementById('hud-hp-bar').style.width = hpPct + '%';
    document.getElementById('hud-hp-text').textContent = `${state.hp} / ${state.maxHp}`;

    // MP 条
    const mpPct = Math.max(0, (state.mp / state.maxMp) * 100);
    document.getElementById('hud-mp-bar').style.width = mpPct + '%';
    document.getElementById('hud-mp-text').textContent = `${state.mp} / ${state.maxMp}`;

    // 资源
    document.getElementById('hud-money').textContent = state.money || 0;
    document.getElementById('hud-ap').textContent = state.actionPoints || 0;
  }

  // ================================================================
  //  主菜单 & 系统按钮事件
  // ================================================================

  _bindMainMenuEvents() {
    // 主菜单按钮（修炼、请教、任务、探索）
    const menuBtns = document.querySelectorAll('#main-menu .btn-menu');
    menuBtns.forEach(btn => {
      btn.onclick = () => {
        const action = btn.dataset.action;
        const labels = {
          train: '修炼',
          learn: '请教',
          quest: '任务',
          explore: '探索'
        };

        // 探索按钮 → 进入战斗
        if (action === 'explore') {
          this._enterBattle();
          return;
        }

        // Phase 5: 修炼/请教/任务 → 调用 HubSystem
        if (action === 'train') {
          this._showTrainPanel();
          return;
        }
        if (action === 'learn') {
          this._showConsultPanel();
          return;
        }
        if (action === 'quest') {
          this._showQuestPanel();
          return;
        }

        this.showModal(
          `「${labels[action] || action}」功能开发中，敬请期待。`,
          { confirmOnly: true, onConfirm: () => this.hideModal() }
        );
      };
    });

    // 技能树
    document.getElementById('btn-skilltree').onclick = () => {
      this._showSkillTree();
    };

    // Phase 7: 领域详情 → Phase 11 改为高级技巧面板
    document.getElementById('btn-domain-detail').onclick = () => {
      this._showAdvancedSkills();
    };

    // 休息
    document.getElementById('btn-rest').onclick = () => {
      this._handleRest();
    };

    // 存档
    document.getElementById('btn-save').onclick = () => {
      this._handleSave();
    };

    // 读档
    document.getElementById('btn-load').onclick = () => {
      const slots = this.saveManager.getAllSlots();
      this.renderLoadScreen(slots);
    };

    // 返回标题
    document.getElementById('btn-back-title').onclick = () => {
      this.showModal('确定要返回标题画面吗？\n未保存的进度将丢失。', {
        onConfirm: () => {
          this.hideModal();
          this.renderTitleScreen();
        },
        onCancel: () => this.hideModal()
      });
    };
  }

  /**
   * 进入战斗（从探索按钮触发）
   */
  async _enterBattle() {
    if (!this._battleUI) {
      this._battleUI = new BattleUI(this.pyodideLoader, this);
    }
    // Phase 11: 确保非考核战斗不传入 forced enemy
    const state = this.saveManager.getState();
    if (state && state._forcedEnemyId) {
      delete state._forcedEnemyId;
    }
    await this._battleUI.start();
  }

  /**
   * Phase 11: 考核战斗（传入强制 enemyId）
   */
  async _startBattle() {
    if (!this._battleUI) {
      this._battleUI = new BattleUI(this.pyodideLoader, this);
    }
    await this._battleUI.start();
  }

  /**
   * Phase 7: 打开领域详情页面（重写版 — 支持解锁领域展开）
   * Phase 11: 保留原有逻辑，新增高级技巧选项卡入口
   */
  _showDomainDetail() {
    const state = this.saveManager.getState();
    if (!state) {
      this.showModal('没有角色数据。', { confirmOnly: true, onConfirm: () => this.hideModal() });
      return;
    }

    const techId = state.techniqueId || 'cursedEnergyBoost';
    const domainDef = DOMAINS[techId];

    if (!domainDef) {
      this.showModal('该术式没有领域配置。', { confirmOnly: true, onConfirm: () => this.hideModal() });
      return;
    }

    const hasDomainLearned = state.domainUnlocked === techId;
    const learnedTier = (state.domainLearnedTiers && state.domainLearnedTiers[techId]) || null;
    // incomplete 可从 "incomplete" 升级到 "complete"
    const hasComplete = learnedTier === 'complete';
    const hasIncomplete = learnedTier === 'incomplete';

    const sl = state.skillLevels || {};
    let totalTech = 0;
    for (const lv of Object.values(sl)) totalTech += lv;
    const barrier = state.attributes?.cursedEnergyControl || 0;
    const insp = state.inspiration || 0;

    // 计算完全领域条件满足度
    const cr = domainDef.completeRequirements;
    const ir = domainDef.incompleteRequirements;
    const completeDone = totalTech >= cr.techniqueLevel && barrier >= cr.barrierLevel && insp >= cr.inspiration && barrier >= cr.cursedEnergyControl;
    const incompleteDone = totalTech >= ir.techniqueLevel && barrier >= ir.barrierLevel && insp >= ir.inspiration && barrier >= ir.cursedEnergyControl;

    function reqRow(name, current, required) {
      const ok = current >= required;
      const cls = ok ? 'requirement-ok' : 'requirement-fail';
      const mark = ok ? '✓' : '✗';
      return `<div class="card-req ${cls}">${mark} ${name} ≥ ${required}（当前: ${current}）</div>`;
    }

    const completeReqs = `
      ${reqRow('术式总等级', totalTech, cr.techniqueLevel)}
      ${reqRow('结界术(咒力操控)', barrier, cr.barrierLevel)}
      ${reqRow('灵感', insp, cr.inspiration)}
      ${reqRow('咒力操控', barrier, cr.cursedEnergyControl)}
    `;

    const incompleteReqs = `
      ${reqRow('术式总等级', totalTech, ir.techniqueLevel)}
      ${reqRow('结界术(咒力操控)', barrier, ir.barrierLevel)}
      ${reqRow('灵感', insp, ir.inspiration)}
      ${reqRow('咒力操控', barrier, ir.cursedEnergyControl)}
    `;

    const bs = domainDef.baseStats;
    const statsHTML = `
      <div class="domain-stats-grid">
        <div>每级结界术 HP</div><div><strong>${bs.hpPerBarrier}</strong></div>
        <div>每点咒力操控 HP</div><div><strong>${bs.hpPerCEC}</strong></div>
        <div>基础攻击间隔</div><div><strong>${bs.intervalBase} 帧</strong></div>
        <div>每级术式伤害</div><div><strong>${bs.damagePerTech}</strong></div>
        <div>每 tick 咒力消耗</div><div><strong>${bs.mpCostPerTick} MP</strong></div>
      </div>
    `;

    const containerId = 'domain-panel-' + Date.now();

    let learnBtnHTML = '';
    if (hasComplete) {
      learnBtnHTML = '<div class="domain-learned-badge">✅ 已学会完全领域展开</div>';
    } else if (hasIncomplete) {
      // 已学会不完全领域，可以升级到完全领域
      learnBtnHTML = '<div class="domain-learned-badge">✅ 已学会不完全领域展开</div>';
      if (completeDone && insp >= cr.inspiration) {
        learnBtnHTML += `<button class="btn btn-primary btn-learn-domain" data-tier="complete" data-inspcost="${cr.inspiration}">🔓 升级为完全领域展开（消耗 ${cr.inspiration} 灵感）</button>`;
      } else if (!completeDone) {
        learnBtnHTML += '<div class="domain-cannot-learn">🔒 完全领域条件不足，继续修行吧</div>';
      } else {
        learnBtnHTML += `<div class="domain-cannot-learn">🔒 灵感不足 (需要 ${cr.inspiration})</div>`;
      }
    } else if (completeDone) {
      // 直接学完全领域
      learnBtnHTML = `<button class="btn btn-primary btn-learn-domain" data-tier="complete" data-inspcost="${cr.inspiration}">🔓 学会完全领域展开（消耗 ${cr.inspiration} 灵感）</button>`;
    } else if (incompleteDone) {
      // 学不完全领域
      learnBtnHTML = `<button class="btn btn-primary btn-learn-domain" data-tier="incomplete" data-inspcost="${ir.inspiration}">🔓 学会不完全领域展开（消耗 ${ir.inspiration} 灵感）</button>`;
    } else {
      learnBtnHTML = '<div class="domain-cannot-learn">🔒 条件不足，无法学习</div>';
    }

    const html = `
      <div id="${containerId}" class="domain-detail-panel">
        <h3>🏛️ ${domainDef.name}</h3>
        <div class="domain-flavor">"${domainDef.flavorText}"</div>
        <div class="domain-section">
          <h4>特殊效果</h4>
          <div class="domain-special">${domainDef.specialEffect || '标准领域效果'}</div>
        </div>
        <div class="domain-section">
          <h4>基础数值</h4>
          ${statsHTML}
        </div>
        <div class="domain-section">
          <h4>完全领域</h4>
          <div class="domain-req-card ${completeDone ? 'domain-req-met' : ''}">${completeReqs}</div>
        </div>
        <div class="domain-section">
          <h4>不完全领域</h4>
          <div class="domain-req-card ${incompleteDone ? 'domain-req-met' : ''}">${incompleteReqs}</div>
        </div>
        <div class="domain-action-row">${learnBtnHTML}</div>
      </div>
    `;

    this.showModal(html, { confirmOnly: false, useHTML: true });

    // 绑定学习按钮
    setTimeout(() => {
      const panel = document.getElementById(containerId);
      if (!panel) return;
      const learnBtn = panel.querySelector('.btn-learn-domain');
      if (learnBtn) {
        learnBtn.onclick = () => {
          const tier = learnBtn.dataset.tier;
          const inspCost = parseInt(learnBtn.dataset.inspcost) || 0;
          const st = this.saveManager.getState();

          // 检查灵感是否足够
          if (inspCost > 0 && (st.inspiration || 0) < inspCost) {
            this.showModal(`灵感不足！需要 ${inspCost} 点灵感，当前 ${st.inspiration || 0}。`, { confirmOnly: true, onConfirm: () => this.hideModal() });
            return;
          }

          st.domainUnlocked = techId;
          if (!st.domainLearnedTiers) st.domainLearnedTiers = {};
          st.domainLearnedTiers[techId] = tier || 'incomplete';
          // 扣除灵感
          if (inspCost > 0) st.inspiration = Math.max(0, (st.inspiration || 0) - inspCost);
          this.saveManager.setState(st);
          this.saveManager.saveToSlot(this.saveManager._findCurrentSlot() || 0);
          this.showModal(
            tier === 'complete' ? '你学会了完全领域展开「' + domainDef.name + '」！' : '你学会了不完全领域展开「' + domainDef.name + '」！（HP/伤害 ×0.6）',
            { confirmOnly: true, onConfirm: () => { this.hideModal(); this._showDomainDetail(); } }
          );
        };
      }
    }, 100);
  }

  /**
   * Phase 11: 显示高级技巧面板（替换旧领域的单独弹窗入口）
   */
  _showAdvancedSkills() {
    // 使用弹窗展示选项卡式高级技巧面板
    const containerId = 'advanced-skill-modal-' + Date.now();
    const html = `<div id="${containerId}" class="advanced-skill-modal"></div>`;
    this.showModal(html, { confirmOnly: true, useHTML: true, onConfirm: () => this.hideModal() });

    // AdvancedSkillUI 通过 id 渲染到弹窗中
    setTimeout(() => {
      const target = document.getElementById('advanced-skill-panel');
      if (!target) {
        // 创建一个容器在弹窗内部
        const modal = document.getElementById(containerId);
        if (modal) {
          const panel = document.createElement('div');
          panel.id = 'advanced-skill-panel';
          modal.appendChild(panel);
          this._advancedSkillUI.render();
        }
      } else {
        this._advancedSkillUI.render();
      }
    }, 100);
  }

  /**
   * Phase 11: 解锁高级技巧
   */
  unlockAdvancedSkill(skillId) {
    const state = this.saveManager.getState();
    if (!state) return;
    const result = this._hubSystem.unlockAdvancedSkill(state, skillId);
    if (result.success) {
      this.saveManager.applyGrowthUpdate(result.updatePayload);
      this.saveManager.saveToSlot(this.saveManager._findCurrentSlot() || 0);
      this.showModal(result.log, { confirmOnly: true, onConfirm: () => { this.hideModal(); this._showAdvancedSkills(); } });
    } else {
      this.showModal(result.log, { confirmOnly: true, onConfirm: () => this.hideModal() });
    }
  }

  /**
   * 打开技能树面板
   */
  _showSkillTree() {
    if (!this._skillTreeUI) {
      this._skillTreeUI = new SkillTreeUI(this.saveManager, this);
    }
    this._skillTreeUI.show();
  }

  // ================================================================
  //  Phase 5: 养成面板（修炼 / 请教 / 任务 / 休息）
  // ================================================================

  /** 修炼面板 */
  _showTrainPanel() {
    const state = this.saveManager.getState();
    if (!state) return;

    const ap = state.actionPoints || 0;
    const stamina = state.stamina !== undefined ? state.stamina : 100;
    const sp = state.skillPoints || 0;

    let rows = '';
    for (const [key, cfg] of Object.entries(ATTRIBUTES)) {
      const curVal = (state.attributes && state.attributes[key]) || 0;
      const spCost = 2 + Math.floor(curVal / 5);
      const talent = (state.attributes && state.attributes.talent) || 10;
      const extraChance = Math.min(0.5, talent * 0.01);
      const extraPct = Math.round(extraChance * 100);
      const canTrain = ap >= 20 && stamina >= 15 && sp >= spCost;
      rows += `
        <div class="train-row">
          <span class="train-name">${cfg.name}</span>
          <span class="train-value">当前: ${curVal} （🔧 ${spCost} SP）</span>
          <button class="btn btn-primary btn-train-action" data-attr="${key}" ${canTrain ? '' : 'disabled'}>修炼 (+1${extraPct > 0 ? '~2, ' + extraPct + '%概率' : ''})</button>
        </div>
      `;
    }

    const residual = state.residual || 0;
    const html = `
      <div class="train-panel">
        <h3>🏋️ 修炼</h3>
        <p class="train-info">AP: ${ap}/100 | 体力: ${stamina}/100 | 技能点: 🔧 ${sp} | 残秽: ${residual}/100</p>
        <p style="color:var(--color-text-dim);font-size:0.8rem;margin-bottom:0.5rem;">消耗 20 AP + 15 体力 + 🔧技能点（2+⌊当前值/5⌋），基础 +1，天赋每10点提供10%概率额外+1（上限50%）</p>
        <div class="train-grid">${rows}</div>
      </div>
    `;

    this.showModal(html, { confirmOnly: false, useHTML: true });

    // Phase 5 fix: bind via event delegation — remove old listener first to avoid stacking
    this._unbindTrainDelegation();
    this._bindTrainDelegation();
  }

  _unbindTrainDelegation() {
    if (this._trainDelegationHandler) {
      document.removeEventListener('click', this._trainDelegationHandler, true);
      this._trainDelegationHandler = null;
    }
  }

  _bindTrainDelegation() {
    this._trainDelegationHandler = (e) => {
      const btn = e.target.closest('.btn-train-action');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      const attrKey = btn.dataset.attr;
      const state = this.saveManager.getState();
      if (!state) return;
      const result = this._hubSystem.train(state, attrKey);
      if (result.success && result.updatePayload) {
        this.saveManager.applyGrowthUpdate(result.updatePayload);
        this.showModal(result.log, { confirmOnly: true, onConfirm: () => { this.hideModal(); this.renderMainScreen(); } });
      } else {
        this.showModal(result.log, { confirmOnly: true, onConfirm: () => this.hideModal() });
      }
    };
    document.addEventListener('click', this._trainDelegationHandler, true);
  }

  /** Phase 11 请教面板（重构：按 NPC 独立人情 + 多功能 actions） */
  _showConsultPanel() {
    const state = this.saveManager.getState();
    if (!state) return;

    const ap = state.actionPoints || 0;
    const relationships = state.relationships || {};

    let cards = '';
    for (const npc of NPCS) {
      const npcRel = relationships[npc.id] || 0;
      const actionRows = npc.actions.map(action => {
        const costRel = action.cost.relationship || 0;
        const costAp = action.cost.ap || 0;
        const costMoney = action.cost.money || 0;

        let canDo = ap >= costAp && state.money >= costMoney;
        if (costRel > 0) canDo = canDo && npcRel >= costRel;

        const costLabel = [];
        if (costAp) costLabel.push(`${costAp} AP`);
        if (costRel) costLabel.push(`${costRel} 人情(当前${npcRel})`);
        if (costMoney) costLabel.push(`${costMoney} 金币`);

        // 根据类型给按钮标注
        let typeLabel = '';
        if (action.type === 'consult') typeLabel = '📚';
        else if (action.type === 'gift') typeLabel = '🎁';
        else if (action.type === 'spar') typeLabel = '⚔️';
        else if (action.type === 'special') typeLabel = '💊';
        else if (action.type === 'quest') typeLabel = '📋';

        // 未实装类型的提示
        const isImplemented = action.type === 'consult' || action.type === 'gift' || action.type === 'special' || action.type === 'unlock_prerequisite';
        const disabledTitle = !isImplemented ? ' title="暂未实装"' : '';

        return `
          <div class="npc-action-row">
            <span>${typeLabel} ${action.name} (${costLabel.join(', ')})</span>
            <button class="btn btn-primary btn-consult-action" data-npc="${npc.id}" data-action="${action.id}" ${canDo && isImplemented ? '' : 'disabled'}${disabledTitle}>${isImplemented ? '执行' : '未开放'}</button>
          </div>
        `;
      }).join('');

      cards += `
        <div class="npc-card">
          <div class="npc-card-name">${npc.name}</div>
          <div class="npc-card-desc">${npc.description}</div>
          <div class="npc-card-rel">❤️ 人情: ${npcRel}</div>
          <div class="npc-card-actions">${actionRows}</div>
        </div>
      `;
    }

    const html = `
      <div class="train-panel">
        <h3>👥 请教</h3>
        <p class="train-info">AP: ${ap}/100</p>
        <div class="npc-grid">${cards}</div>
      </div>
    `;

    this.showModal(html, { confirmOnly: false, useHTML: true });

    setTimeout(() => {
      document.querySelectorAll('.btn-consult-action').forEach(btn => {
        btn.onclick = () => {
          const result = this._hubSystem.consult(state, btn.dataset.npc, btn.dataset.action);
          if (result.success && result.updatePayload) {
            this.saveManager.applyGrowthUpdate(result.updatePayload);
            this.showModal(result.log, { confirmOnly: true, onConfirm: () => { this.hideModal(); this.renderMainScreen(); } });
          } else {
            this.showModal(result.log, { confirmOnly: true, onConfirm: () => this.hideModal() });
          }
        };
      });
    }, 50);
  }

  /** 任务面板 */
  _showQuestPanel() {
    const state = this.saveManager.getState();
    if (!state) return;

    const ap = state.actionPoints || 0;

    let rows = '';
    // NPC 任务
    for (const q of QUESTS.npcTasks || []) {
      const canDo = ap >= (q.cost.ap || 0);
      rows += `
        <div class="train-row">
          <span class="train-name">${q.name}</span>
          <span class="train-value">${q.description} (${q.cost.ap} AP)</span>
          <button class="btn btn-primary btn-quest-action" data-quest="${q.id}" data-cat="npcTasks" ${canDo ? '' : 'disabled'}>接取</button>
        </div>
      `;
    }

    // Phase 11: 升职考核（仅显示高一级考核，含强制怪物和冷却）
    const nextExam = getNextExam(state.rank || '四级');
    const cooldownDays = state.examCooldownDays || 0;
    if (cooldownDays > 0) {
      rows += `
        <div class="train-row exam-cooldown">
          <span class="train-name">⏳ 考核冷却中</span>
          <span class="train-value">距离下次考核还有 ${cooldownDays} 天（休息可减少冷却）</span>
          <button class="btn btn-primary" disabled>冷却中</button>
        </div>
      `;
    } else if (nextExam) {
      const reqs = nextExam.requirements?.attributes || {};
      const reqLines = Object.entries(reqs).map(([key, val]) => {
        const attrName = ATTRIBUTES[key]?.name || key;
        const currentVal = (state.attributes || {})[key] || 0;
        const met = currentVal >= val;
        return `${met ? '✓' : '✗'} ${attrName} ≥ ${val}（当前: ${currentVal}）`;
      }).join('<br>');
      const canDo = ap >= (nextExam.cost?.ap || 0);
      rows += `
        <div class="train-row">
          <span class="train-name">🏅 ${nextExam.name}</span>
          <span class="train-value">${nextExam.description}<br><small>目标：祓除 ${nextExam.enemy_name || '指定怪物'}</small><br><small>${reqLines}</small></span>
          <button class="btn btn-primary btn-quest-action" data-quest="${nextExam.id}" data-cat="exam" data-enemy="${nextExam.enemy_id}" ${canDo ? '' : 'disabled'}>参加考核</button>
        </div>
      `;
    } else {
      rows += `
        <div class="train-row">
          <span class="train-name">🎉 已达最高等级</span>
          <span class="train-value">你已经是最强的了，没有更高的考核。</span>
        </div>
      `;
    }

    // 主线
    const completedChapter = state.completedChapter || 1;
    for (const q of QUESTS.mainStory || []) {
      const reqChap = q.requiresChapter || 0;
      const canDo = ap >= (q.cost.ap || 0) && reqChap <= completedChapter;
      rows += `
        <div class="train-row">
          <span class="train-name">📖 ${q.name}</span>
          <span class="train-value">${q.description} (${q.cost.ap} AP)</span>
          <button class="btn btn-primary btn-quest-action" data-quest="${q.id}" data-cat="mainStory" ${canDo ? '' : 'disabled'}>推进</button>
        </div>
      `;
    }

    const html = `
      <div class="train-panel">
        <h3>📋 任务</h3>
        <p class="train-info">AP: ${ap}/100</p>
        <div class="train-grid">${rows}</div>
      </div>
    `;

    this.showModal(html, { confirmOnly: false, useHTML: true });

    setTimeout(() => {
      document.querySelectorAll('.btn-quest-action').forEach(btn => {
        btn.onclick = () => {
          // Phase 11: 考核任务走专用入口（强制怪物）
          if (btn.dataset.cat === 'exam' && btn.dataset.enemy) {
            const enemyId = btn.dataset.enemy;
            const examQuest = { id: btn.dataset.quest, enemy_id: enemyId };
            this._startExamBattle(examQuest);
            return;
          }
          const result = this._hubSystem.acceptQuest(state, btn.dataset.quest, btn.dataset.cat);
          if (result.success && result.updatePayload) {
            this.saveManager.applyGrowthUpdate(result.updatePayload);
            let msg = result.log;
            if (result.storyText) msg += '\n\n' + result.storyText;
            this.showModal(msg, { confirmOnly: true, onConfirm: () => { this.hideModal(); this.renderMainScreen(); } });
          } else {
            this.showModal(result.log, { confirmOnly: true, onConfirm: () => this.hideModal() });
          }
        };
      });
    }, 50);
  }

  /**
   * Phase 11: 考核战斗入口 — 强制指定怪物
   */
  async _startExamBattle(examQuest) {
    const state = this.saveManager.getState();
    if (!state) return;

    // Phase 11: 考核属性校验
    const nextExam = getNextExam(state.rank || '四级');
    if (!nextExam) {
      this.showModal('没有可参加的考核。', { confirmOnly: true, onConfirm: () => this.hideModal() });
      return;
    }
    const reqs = nextExam.requirements?.attributes || {};
    const attrs = state.attributes || {};
    for (const [key, val] of Object.entries(reqs)) {
      if ((attrs[key] || 0) < val) {
        const attrName = ATTRIBUTES[key]?.name || key;
        this.showModal(`${attrName}不足！需要 ${val}，当前 ${attrs[key] || 0}。`, { confirmOnly: true, onConfirm: () => this.hideModal() });
        return;
      }
    }

    // 扣除 AP
    const apCost = nextExam.cost?.ap || 30;
    if ((state.actionPoints || 0) < apCost) {
      this.showModal('行动力不足！', { confirmOnly: true, onConfirm: () => this.hideModal() });
      return;
    }
    state.actionPoints -= apCost;

    // Phase 11: 写入选定考核ID（战斗胜利后用于触发 quest 完成）
    state._examQuestId = examQuest.id;

    // 将强制 enemyId 写入 state（battle_engine init 时会读取）
    state._forcedEnemyId = examQuest.enemy_id;

    // 开始战斗
    this._startBattle();
  }

  /** 休息 */
  _handleRest() {
    const state = this.saveManager.getState();
    if (!state) return;

    const result = this._hubSystem.rest(state);
    if (result.success && result.updatePayload) {
      this.saveManager.applyGrowthUpdate(result.updatePayload);
      this.showModal(result.log, { confirmOnly: true, onConfirm: () => { this.hideModal(); this.renderMainScreen(); } });
    } else {
      this.showModal(result.log, { confirmOnly: true, onConfirm: () => this.hideModal() });
    }
  }

  /**
   * 处理存档逻辑
   * 直接持久化当前 state（由 buildSaveData 创建，或读档恢复的），避免重建
   */
  _handleSave() {
    // 更新当前 state 的时间戳再保存
    const currentState = this.saveManager.getState();
    if (!currentState) {
      this.showModal('没有可存档的数据。', {
        confirmOnly: true,
        onConfirm: () => this.hideModal()
      });
      return;
    }
    // 刷新 savedAt 时间戳
    currentState.savedAt = new Date().toISOString();
    this.saveManager.setState(currentState);

    const result = this.saveManager.save();

    if (result.success) {
      const savedState = this.saveManager.getState();
      const time = new Date(savedState.savedAt).toLocaleString('zh-CN');
      this.showModal(`存档成功！\n槽位 ${result.slot + 1}\n时间: ${time}`, {
        confirmOnly: true,
        onConfirm: () => this.hideModal()
      });
    } else if (result.needOverwrite) {
      const slots = this.saveManager.getAllSlots();
      this.renderOverwriteScreen(slots);
    }
  }

  // ================================================================
  //  读档界面
  // ================================================================

  /**
   * 渲染读档界面
   * @param {Array} slots - 存档槽位数据
   */
  renderLoadScreen(slots) {
    this.showScreen('screen-load');

    const container = document.getElementById('load-slots');
    container.innerHTML = '';

    for (const { slot, data } of slots) {
      const slotEl = document.createElement('div');
      slotEl.className = 'load-slot';

      if (data) {
        const time = new Date(data.savedAt).toLocaleString('zh-CN');
        slotEl.innerHTML = `
          <div class="load-slot-info">
            <span class="load-slot-name">${data.characterName}</span>
            <span class="load-slot-meta">评定: ${data.rank} | ${time}</span>
          </div>
        `;

        // 点击加载
        slotEl.addEventListener('click', (e) => {
          // 防止点到删除按钮时触发加载
          if (e.target.classList.contains('btn-delete')) return;
          const loaded = this.saveManager.load(slot);
          if (loaded) {
            this.renderMainScreen();
          }
        });

        // 删除按钮
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-delete';
        delBtn.textContent = '删除';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showModal(`确定要删除「${data.characterName}」的存档吗？此操作不可撤销。`, {
            onConfirm: () => {
              this.saveManager.deleteSlot(slot);
              this.hideModal();
              // 重新渲染
              const newSlots = this.saveManager.getAllSlots();
              this.renderLoadScreen(newSlots);
            },
            onCancel: () => this.hideModal()
          });
        });
        slotEl.appendChild(delBtn);
      } else {
        slotEl.classList.add('load-slot-empty');
        slotEl.innerHTML = `
          <div class="load-slot-info">
            <span class="load-slot-name">空槽位 ${slot + 1}</span>
            <span class="load-slot-meta">无存档数据</span>
          </div>
        `;
      }

      container.appendChild(slotEl);
    }

    document.getElementById('btn-load-back').onclick = () => {
      // 如果是从主界面来的，返回主界面；否则返回标题
      const state = this.saveManager.getState();
      if (state && state.characterName) {
        this.renderMainScreen();
      } else {
        this.renderTitleScreen();
      }
    };
  }

  // ================================================================
  //  覆盖存档选择界面
  // ================================================================

  /**
   * 渲染存档覆盖选择界面
   * @param {Array} slots - 存档槽位数据
   */
  renderOverwriteScreen(slots) {
    this.showScreen('screen-save-overwrite');

    const container = document.getElementById('overwrite-slots');
    container.innerHTML = '';

    for (const { slot, data } of slots) {
      const slotEl = document.createElement('div');
      slotEl.className = 'load-slot';

      if (data) {
        const time = new Date(data.savedAt).toLocaleString('zh-CN');
        slotEl.innerHTML = `
          <div class="load-slot-info">
            <span class="load-slot-name">槽位 ${slot + 1}: ${data.characterName}</span>
            <span class="load-slot-meta">评定: ${data.rank} | ${time}</span>
          </div>
        `;

        slotEl.addEventListener('click', () => {
          // 将当前 state 填入 saveData 并写入
          const result = this.saveManager.saveToSlot(slot);
          if (result.success) {
            const savedState = this.saveManager.getState();
            const time = new Date(savedState.savedAt).toLocaleString('zh-CN');
            this.showModal(`存档覆盖成功！\n槽位 ${slot + 1}\n时间: ${time}`, {
              confirmOnly: true,
              onConfirm: () => {
                this.hideModal();
                this.renderMainScreen();
              }
            });
          }
        });
      } else {
        slotEl.classList.add('load-slot-empty');
        slotEl.innerHTML = `
          <div class="load-slot-info">
            <span class="load-slot-name">空槽位 ${slot + 1}</span>
            <span class="load-slot-meta">（不应出现，请取消）</span>
          </div>
        `;
      }

      container.appendChild(slotEl);
    }

    document.getElementById('btn-overwrite-cancel').onclick = () => {
      this.renderMainScreen();
    };
  }

  // ================================================================
  //  通用弹窗
  // ================================================================

  /**
   * 显示通用弹窗
   * @param {string} message - 弹窗消息
   * @param {object} [opts] - 选项
   * @param {Function} [opts.onConfirm]
   * @param {Function} [opts.onCancel]
   * @param {boolean} [opts.confirmOnly]
   */
  showModal(message, opts = {}) {
    const overlay = document.getElementById('modal-overlay');
    const msgEl = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('modal-confirm');
    const cancelBtn = document.getElementById('modal-cancel');

    // Phase 4: 支持 useHTML 标记，允许传入 HTML 面板
    if (opts.useHTML) {
      msgEl.innerHTML = message;
    } else {
      msgEl.textContent = message;
    }

    // 存储回调
    this._modalCallbacks = {
      onConfirm: opts.onConfirm || null,
      onCancel: opts.onCancel || null
    };

    // 按钮配置
    confirmBtn.onclick = () => {
      if (this._modalCallbacks.onConfirm) {
        this._modalCallbacks.onConfirm();
      } else {
        this.hideModal();
      }
    };

    if (opts.confirmOnly) {
      cancelBtn.classList.add('hidden');
      confirmBtn.textContent = '确认';
    } else {
      cancelBtn.classList.remove('hidden');
      confirmBtn.textContent = '确认';
      cancelBtn.onclick = () => {
        if (this._modalCallbacks.onCancel) {
          this._modalCallbacks.onCancel();
        } else {
          this.hideModal();
        }
      };
    }

    overlay.classList.remove('hidden');
  }

  /**
   * 隐藏通用弹窗
   */
  hideModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('hidden');
    this._modalCallbacks = {};
  }

  // ================================================================
  //  全局事件（标题画面按钮只需绑定一次）
  // ================================================================

  _bindGlobalEvents() {
    // 新游戏
    document.getElementById('btn-new-game').onclick = () => {
      this.renderCreateName();
    };

    // 继续
    document.getElementById('btn-continue').onclick = () => {
      const slots = this.saveManager.getAllSlots();
      // 找到最近存档的槽位号
      let latestSlot = -1;
      let latestTime = 0;
      for (const { slot, data } of slots) {
        if (data && data.savedAt) {
          const t = new Date(data.savedAt).getTime();
          if (t > latestTime) {
            latestTime = t;
            latestSlot = slot;
          }
        }
      }
      if (latestSlot >= 0) {
        const loaded = this.saveManager.load(latestSlot);
        if (loaded) {
          this.renderMainScreen();
        }
      }
    };

    // 制作名单
    document.getElementById('btn-credits').onclick = () => {
      this.showModal(
        '咒术回战 同人 RPG\n\n基于芥见下下《咒术回战》\n同人创作，仅供学习交流\n\n开发: Claude Code AI + 你',
        { confirmOnly: true, onConfirm: () => this.hideModal() }
      );
    };
  }
}