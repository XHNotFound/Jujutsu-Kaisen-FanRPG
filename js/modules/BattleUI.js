// js/modules/BattleUI.js — 战斗界面管理器
// 唯一负责战斗画面的 DOM 渲染和事件绑定
// 严禁在 JS 中写战斗计算逻辑！

/**
 * BattleUI 职责：
 * - 渲染战斗画面（敌我 HP/MP/ATB、日志、技能按钮）
 * - 统一事件绑定（委托在 #screen-battle 上）
 * - 调用 Python（通过 PyodideLoader）获取新状态
 * - 将 Python 返回的 JSON 映射到 DOM
 *
 * 严禁：
 * - 在 JS 中写任何战斗逻辑（hp -= damage 等）
 * - 多层事件委托
 */

export class BattleUI {
  /**
   * @param {import('../pyodide_loader.js').PyodideLoader} pyodideLoader
   * @param {import('./UIManager.js').UIManager} uiManager
   */
  constructor(pyodideLoader, uiManager) {
    this.pyodideLoader = pyodideLoader;
    this.uiManager = uiManager;

    /** @type {object|null} 当前战斗状态（Python 返回的 JSON） */
    this.currentState = null;
    /** @type {boolean} 是否正在处理中（防连点） */
    this._processing = false;
  }

  /**
   * 进入战斗：加载 Python 文件，初始化战斗状态，渲染 UI
   */
  async start() {
    this.uiManager.showScreen('screen-battle');
    this._showLoading(true);

    try {
      // 加载 Python 依赖
      const pyFiles = [
        'python/__init__.py',
        'python/models.py',
        'python/battle_engine.py'
      ];
      await this.pyodideLoader.loadPythonFiles(pyFiles);

      // 从 SaveManager 获取存档构建战斗初始数据
      const state = this.uiManager.saveManager.getState();
      const saveDataJson = state
        ? JSON.stringify(state)
        : '{}';

      // 调用 Python 初始化
      const resultJson = await this.pyodideLoader.runPython(
        `from python.battle_engine import init_battle\ninit_battle('${saveDataJson.replace(/'/g, "\\'").replace(/\n/g, '')}')`
      );
      this.currentState = JSON.parse(resultJson);

      this._showLoading(false);
      this._renderAll();
    } catch (err) {
      this._showLoading(false);
      this._appendLog(`[ERROR] 战斗环境加载失败: ${err.message}`);
      console.error('[BattleUI]', err);
    }
  }

  // ================================================================
  //  渲染
  // ================================================================

  /**
   * 全量渲染战斗画面
   */
  _renderAll() {
    if (!this.currentState) return;
    const s = this.currentState;

    // === 玩家 ===
    this._renderCharCard('player', s.player);

    // === 敌人 ===
    this._renderCharCard('enemy', s.enemy);

    // === 日志 ===
    this._renderLog(s.log);

    // === 技能按钮 ===
    this._renderSkillButtons(s.player);

    // === 撤离按钮 ===
    document.getElementById('btn-battle-flee').onclick = () => {
      if (this._processing) return;
      this.uiManager.showModal('确定要撤离战斗吗？', {
        onConfirm: () => {
          this.uiManager.hideModal();
          this.uiManager.renderMainScreen();
        },
        onCancel: () => this.uiManager.hideModal()
      });
    };

    // === 胜利/失败检查 ===
    if (s.turn === 'player_win') {
      this._appendLog('━━ 胜利！诅咒被祓除了。 ━━');
      this._disableAllSkills();
    } else if (s.turn === 'enemy_win') {
      this._appendLog('━━ 败北…你失去了意识。 ━━');
      this._disableAllSkills();
    }
  }

  /**
   * 渲染角色卡片（HP/MP/ATB 条）
   * @param {'player'|'enemy'} prefix
   * @param {object} data
   */
  _renderCharCard(prefix, data) {
    // 名称
    document.getElementById(`${prefix}-name`).textContent = data.name;

    // HP
    const hpPct = data.max_hp > 0 ? (data.hp / data.max_hp) * 100 : 0;
    document.getElementById(`${prefix}-hp-bar`).style.width = hpPct + '%';
    document.getElementById(`${prefix}-hp-text`).textContent = `${data.hp} / ${data.max_hp}`;

    // MP（仅玩家有）
    if (prefix === 'player') {
      const mpPct = data.max_mp > 0 ? (data.mp / data.max_mp) * 100 : 0;
      document.getElementById(`player-mp-bar`).style.width = mpPct + '%';
      document.getElementById(`player-mp-text`).textContent = `${data.mp} / ${data.max_mp}`;
    }

    // ATB
    const atbPct = (data.atb / 300) * 100;
    document.getElementById(`${prefix}-atb-bar`).style.width = atbPct + '%';
    document.getElementById(`${prefix}-atb-text`).textContent = `${data.atb} / 300`;
  }

  /**
   * 渲染战斗日志（增量追加新条目）
   * @param {string[]} logs
   */
  _renderLog(logs) {
    const container = document.getElementById('battle-log');
    // 仅追加新条目
    const currentCount = container.children.length;
    for (let i = currentCount; i < logs.length; i++) {
      const entry = document.createElement('div');
      entry.className = 'battle-log-entry';
      entry.textContent = logs[i];
      container.appendChild(entry);
    }
    // 自动滚动到底部
    container.scrollTop = container.scrollHeight;
  }

  /**
   * 追加单条日志
   */
  _appendLog(msg) {
    const container = document.getElementById('battle-log');
    const entry = document.createElement('div');
    entry.className = 'battle-log-entry';
    entry.textContent = msg;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
  }

  /**
   * 渲染技能按钮（事件委托在父容器上）
   */
  _renderSkillButtons(playerData) {
    const container = document.getElementById('battle-skills');
    container.innerHTML = '';

    const skills = playerData.skills || [];

    // 事件委托统一绑定
    container.onclick = (e) => {
      const btn = e.target.closest('.battle-skill-btn');
      if (!btn) return;
      if (this._processing) return;
      if (btn.disabled) return;

      const skillId = btn.dataset.skillId;
      const action = {
        type: 'use_skill',
        actor: 'player',
        skill_id: skillId,
        target: this.currentState.enemy.id
      };
      this._executeAction(action);
    };

    for (const skill of skills) {
      const btn = document.createElement('button');
      btn.className = 'btn battle-skill-btn';
      btn.dataset.skillId = skill.id;

      // 技能类型样式
      if (skill.type === 'martial') {
        btn.classList.add('skill-martial');
      } else if (skill.type === 'cursed') {
        btn.classList.add('skill-cursed');
      } else if (skill.type === 'movement') {
        btn.classList.add('skill-movement');
      }

      // 咒力不足标记
      if (skill.cost > 0 && playerData.mp < skill.cost) {
        btn.classList.add('cost-too-high');
      }

      const costLabel = skill.cost > 0 ? ` (MP ${skill.cost})` : '';
      btn.innerHTML = `
        <span class="skill-name">${skill.name}</span>
        <span class="skill-cost">${costLabel}</span>
      `;

      container.appendChild(btn);
    }
  }

  /**
   * 禁用所有技能按钮（战斗结束）
   */
  _disableAllSkills() {
    const btns = document.querySelectorAll('#battle-skills .battle-skill-btn');
    btns.forEach(b => { b.disabled = true; });
  }

  // ================================================================
  //  调用 Python 执行行动
  // ================================================================

  /**
   * 向 Python 发送行动，接收新状态并重新渲染
   * @param {object} action — { type, actor, skill_id, target }
   */
  async _executeAction(action) {
    if (this._processing) return;
    this._processing = true;
    this._setSkillsDisabled(true);

    try {
      const actionJson = JSON.stringify(action);
      const stateJson = JSON.stringify(this.currentState);

      // 调用 Python
      const resultJson = await this.pyodideLoader.runPython(
        `from python.battle_engine import execute_action\nexecute_action('${actionJson.replace(/'/g, "\\'")}', '''${stateJson.replace(/'/g, "\\'")}''')`
      );
      this.currentState = JSON.parse(resultJson);

      // 重新渲染
      this._renderAll();
    } catch (err) {
      this._appendLog(`[ERROR] 行动执行失败: ${err.message}`);
      console.error('[BattleUI]', err);
    } finally {
      this._processing = false;
      this._setSkillsDisabled(false);
    }
  }

  /**
   * 切换所有技能按钮的禁用状态（防连点）
   */
  _setSkillsDisabled(disabled) {
    const btns = document.querySelectorAll('#battle-skills .battle-skill-btn');
    btns.forEach(b => { b.disabled = disabled; });
  }

  // ================================================================
  //  辅助
  // ================================================================

  _showLoading(show) {
    const el = document.getElementById('battle-loading');
    if (el) {
      el.classList.toggle('hidden', !show);
    }
  }
}
