// js/modules/UIManager.js — UI 管理器（唯一负责 DOM 操作、事件监听和画面切换）

import { ATTRIBUTES } from '../data/attributes.js';
import { BattleUI } from './BattleUI.js';
import { SkillTreeUI } from './SkillTreeUI.js';
import { HubSystem } from './HubSystem.js';
import { NPCS } from '../data/npcs.js';
import { QUESTS } from '../data/quests.js';

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

    this._updateRollDisplay();
  }

  /**
   * 更新 Roll 画面（属性、评定、风味文本、重掷次数）
   */
  _updateRollDisplay() {
    const attrs = this.charCreator.currentAttributes;
    const rerolls = this.charCreator.rerollsLeft;
    const rank = this.charCreator.calculateRank(attrs);
    const flavor = this.charCreator.getFlavorText(attrs);

    // 剩余次数
    document.getElementById('reroll-count').textContent = rerolls;

    // 属性列表
    const attrContainer = document.getElementById('roll-attributes');
    attrContainer.innerHTML = '';
    for (const [key, cfg] of Object.entries(ATTRIBUTES)) {
      const value = attrs[key];
      const item = document.createElement('div');
      item.className = 'roll-attr-item';
      item.innerHTML = `
        <span class="roll-attr-name">${cfg.name}</span>
        <span class="roll-attr-value">${value}</span>
      `;
      attrContainer.appendChild(item);
    }

    // 评定
    document.getElementById('roll-rank').innerHTML = `
      <span class="rank-name">${rank.name}</span>
      <span class="rank-avg">（平均值: ${rank.avg}）</span>
    `;

    // 风味文本
    document.getElementById('roll-flavor').textContent = flavor;

    // 按钮状态
    const btnReroll = document.getElementById('btn-reroll');
    btnReroll.disabled = rerolls <= 0;

    // 绑定事件（每次渲染重新绑定，因为按钮可能被销毁重建）
    btnReroll.onclick = () => {
      const result = this.charCreator.rollAllAttributes();
      if (result) {
        this._updateRollDisplay();
      }
    };

    document.getElementById('btn-roll-next').onclick = () => {
      this.renderCreateChoices();
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

    const state = this.saveManager.getState();
    if (!state) {
      this.renderTitleScreen();
      return;
    }

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
    await this._battleUI.start();
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

    let rows = '';
    for (const [key, cfg] of Object.entries(ATTRIBUTES)) {
      const curVal = (state.attributes && state.attributes[key]) || 0;
      const canTrain = ap >= 20 && stamina >= 15;
      rows += `
        <div class="train-row">
          <span class="train-name">${cfg.name}</span>
          <span class="train-value">当前: ${curVal}</span>
          <button class="btn btn-primary btn-train-action" data-attr="${key}" ${canTrain ? '' : 'disabled'}>修炼 (+1~3)</button>
        </div>
      `;
    }

    const residual = state.residual || 0;
    const html = `
      <div class="train-panel">
        <h3>🏋️ 修炼</h3>
        <p class="train-info">AP: ${ap}/100 | 体力: ${stamina}/100 | 残秽: ${residual}/100</p>
        <p style="color:var(--color-text-dim);font-size:0.8rem;">每次消耗 20 AP + 15 体力，属性 +1~3，残秽 +10</p>
        <div class="train-grid">${rows}</div>
      </div>
    `;

    this.showModal(html, { confirmOnly: false, useHTML: true });
  }

  /** 请教面板 */
  _showConsultPanel() {
    const state = this.saveManager.getState();
    if (!state) return;

    const ap = state.actionPoints || 0;
    const rel = state.relationship !== undefined ? state.relationship : 0;

    let cards = '';
    for (const npc of NPCS) {
      const actionRows = npc.actions.map(action => {
        const canDo = ap >= (action.cost.ap || 0) && rel >= (action.cost.relationship || 0) && state.money >= (action.cost.money || 0);
        const costLabel = [];
        if (action.cost.ap) costLabel.push(`${action.cost.ap} AP`);
        if (action.cost.relationship) costLabel.push(`${action.cost.relationship} 人情`);
        if (action.cost.money) costLabel.push(`${action.cost.money} 金币`);
        return `
          <div class="npc-action-row">
            <span>${action.name} (${costLabel.join(', ')})</span>
            <button class="btn btn-primary btn-consult-action" data-npc="${npc.id}" data-action="${action.id}" ${canDo ? '' : 'disabled'}>执行</button>
          </div>
        `;
      }).join('');

      cards += `
        <div class="npc-card">
          <div class="npc-card-name">${npc.name}</div>
          <div class="npc-card-desc">${npc.description}</div>
          <div class="npc-card-actions">${actionRows}</div>
        </div>
      `;
    }

    const html = `
      <div class="train-panel">
        <h3>👥 请教</h3>
        <p class="train-info">AP: ${ap}/100 | 人情: ${rel}</p>
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

    // 升职考核
    for (const q of QUESTS.promotions || []) {
      const canDo = ap >= (q.cost.ap || 0);
      rows += `
        <div class="train-row">
          <span class="train-name">🏅 ${q.name}</span>
          <span class="train-value">${q.description} (${q.cost.ap} AP)</span>
          <button class="btn btn-primary btn-quest-action" data-quest="${q.id}" data-cat="promotions" ${canDo ? '' : 'disabled'}>考核</button>
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