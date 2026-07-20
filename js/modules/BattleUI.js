// js/modules/BattleUI.js — 战斗界面管理器
// 唯一负责战斗画面的 DOM 渲染和事件绑定
// 严禁在 JS 中写战斗计算逻辑！

/**
 * BattleUI 职责：
 * - 渲染战斗画面（敌我 HP/MP/ATB、距离、束缚、日志、技能按钮）
 * - 统一事件委托绑定在 #battle-container 上
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
    /** @type {boolean} 事件委托是否已绑定 */
    this._delegationBound = false;
  }

  /**
   * 进入战斗：加载 Python 文件，初始化战斗状态，渲染 UI
   */
  async start() {
    this.uiManager.showScreen('screen-battle');
    this._showLoading(true);

    // 清空上一次战斗的残留日志和状态
    this.currentState = null;
    const logContainer = document.getElementById('battle-log');
    if (logContainer) logContainer.innerHTML = '';

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
      this._bindDelegation();
      this._renderAll();
    } catch (err) {
      this._showLoading(false);
      this._appendLog(`[ERROR] 战斗环境加载失败: ${err.message}`);
      console.error('[BattleUI]', err);
    }
  }

  // ================================================================
  //  事件委托（一次性绑定在 #battle-container 上）
  // ================================================================

  _bindDelegation() {
    if (this._delegationBound) return;
    this._delegationBound = true;

    const container = document.querySelector('#screen-battle .battle-container');
    if (!container) return;

    container.addEventListener('click', (e) => {
      if (this._processing) return;

      // 折叠区头部按钮（攻击/束缚/领域）
      const toggleBtn = e.target.closest('.battle-section-toggle');
      if (toggleBtn) {
        const sectionId = toggleBtn.dataset.section;
        if (sectionId) {
          const section = document.getElementById(sectionId);
          if (section) {
            const isHidden = section.style.display === 'none';
            section.style.display = isHidden ? '' : 'none';
            toggleBtn.classList.toggle('collapsed', !isHidden);
          }
        }
        return;
      }

      // 技能按钮
      const skillBtn = e.target.closest('.battle-skill-btn');
      if (skillBtn && !skillBtn.disabled) {
        const skillId = skillBtn.dataset.skillId;
        this._executeAction({
          type: 'use_skill',
          actor: 'player',
          skill_id: skillId,
          target: this.currentState?.enemy?.id || 'enemy_1'
        });
        return;
      }

      // 撤离按钮
      if (e.target.closest('#btn-battle-flee')) {
        if (this.currentState && this.uiManager.saveManager) {
          const p = this.currentState.player;
          const sm = this.uiManager.saveManager;
          const state = sm.getState();
          if (state) {
            state.hp = p.hp;
            state.mp = p.mp;
            sm.setState(state);
          }
        }
        this.uiManager.showModal('确定要撤离战斗吗？', {
          onConfirm: () => {
            this.uiManager.hideModal();
            this.uiManager.renderMainScreen();
          },
          onCancel: () => this.uiManager.hideModal()
        });
        return;
      }

      // 束缚按钮
      const vowBtn = e.target.closest('.battle-vow-btn');
      if (vowBtn && !vowBtn.disabled) {
        const vowId = vowBtn.dataset.vowId;
        this._executeAction({
          type: 'apply_vow',
          actor: 'player',
          vow_id: vowId
        });
        return;
      }

      // Phase 7: 领域展开按钮
      const domainBtn = e.target.closest('.battle-domain-btn');
      if (domainBtn && !domainBtn.disabled) {
        this._handleDomainExpand(domainBtn.dataset.domainId || 'limitless_domain');
        return;
      }

      // 解除领域按钮 (Fix 2: 改为取消领域，不碰束缚)
      if (e.target.closest('[data-action="cancel-domain"]')) {
        const d = this.currentState?.units?.find(u => u.unit_type === 'domain');
        if (d) this._executeAction({ type: 'cancel_domain', domain_id: d.id });
        return;
      }
    });
  }

  // ================================================================
  //  渲染
  // ================================================================

  _renderAll() {
    if (!this.currentState) return;
    const s = this.currentState;

    this._renderCharCard('player', s.player);
    this._renderCharCard('enemy', s.enemy);
    this._renderDistance(s);
    this._renderLog(s.log);

    // 折叠攻击区
    this._renderCollapsibleSection('battle-attack-section', 'battle-attack-body', '⚔️ 攻击', () => this._renderSkillButtons(s.player));
    // 折叠束缚区
    this._renderCollapsibleSection('battle-vow-section', 'battle-vow-body', '🔗 束缚', () => this._renderVowButtons(s.player));
    // 领域区（独立）
    this._renderDomainButton(s);

    if (s.last_hit_was_black_flash) {
      this._flashBlackFlashEffect();
    }

    if (s.turn === 'player_win') {
      this._appendLog('━━ 胜利！诅咒被祓除了。 ━━');
      this._disableAllSkills();
      this._showVictoryScreen(s);
    } else if (s.turn === 'enemy_win') {
      this._appendLog('━━ 败北…你失去了意识。 ━━');
      this._disableAllSkills();
    }
  }

  _renderCollapsibleSection(containerId, bodyId, label, renderFn) {
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.className = 'battle-collapsible-section';
      const skillsEl = document.getElementById('battle-skills');
      if (skillsEl && skillsEl.parentNode) {
        skillsEl.parentNode.insertBefore(container, skillsEl);
      }
    }
    container.innerHTML = `
      <button class="btn battle-section-toggle" data-section="${bodyId}">${label}</button>
      <div id="${bodyId}" class="battle-section-body"></div>
    `;
    renderFn();
  }

  _renderCharCard(prefix, data) {
    const nameEl = document.getElementById(`${prefix}-name`);
    if (nameEl) {
      let label = data.name || '--';
      const distNames = ['贴身', '近', '中', '远'];
      const dist = data.distance;
      if (dist !== undefined && distNames[dist]) {
        label = `${data.name} [${distNames[dist]}]`;
      }
      nameEl.textContent = label;
    }
    const hpPct = data.max_hp > 0 ? (data.hp / data.max_hp) * 100 : 0;
    const hpBar = document.getElementById(`${prefix}-hp-bar`);
    const hpText = document.getElementById(`${prefix}-hp-text`);
    if (hpBar) hpBar.style.width = hpPct + '%';
    if (hpText) hpText.textContent = `${data.hp} / ${data.max_hp}`;
    if (prefix === 'player') {
      const mpPct = data.max_mp > 0 ? (data.mp / data.max_mp) * 100 : 0;
      const mpBar = document.getElementById('player-mp-bar');
      const mpText = document.getElementById('player-mp-text');
      if (mpBar) mpBar.style.width = mpPct + '%';
      if (mpText) mpText.textContent = `${data.mp} / ${data.max_mp}`;
    }
    const atbPct = (data.atb / 300) * 100;
    const atbBar = document.getElementById(`${prefix}-atb-bar`);
    const atbText = document.getElementById(`${prefix}-atb-text`);
    if (atbBar) atbBar.style.width = atbPct + '%';
    if (atbText) atbText.textContent = `${data.atb} / 300`;
  }

  _renderDistance(s) {
    let distEl = document.getElementById('battle-distance-bar');
    if (!distEl) {
      distEl = document.createElement('div');
      distEl.id = 'battle-distance-bar';
      distEl.className = 'battle-distance-bar';
      const logEl = document.getElementById('battle-log');
      if (logEl && logEl.parentNode) logEl.parentNode.insertBefore(distEl, logEl);
    }
    const slots = ['贴身', '近', '中', '远'];
    const pDist = s.player.distance;
    const eDist = s.enemy.distance;
    let html = '<span class="dist-label">距离：</span>';
    for (let i = 0; i < 4; i++) {
      let cls = 'dist-slot';
      if (i === pDist && i === eDist) cls += ' dist-both';
      else if (i === pDist) cls += ' dist-player';
      else if (i === eDist) cls += ' dist-enemy';
      html += `<span class="${cls}">【${slots[i]}】</span>`;
    }
    distEl.innerHTML = html;
  }

  _renderLog(logs) {
    const container = document.getElementById('battle-log');
    if (!container) return;
    const currentCount = container.children.length;
    for (let i = currentCount; i < logs.length; i++) {
      const entry = document.createElement('div');
      entry.className = 'battle-log-entry';
      if (logs[i].includes('【黑闪！】') || logs[i].includes('漆黑的光芒')) entry.classList.add('log-black-flash');
      if (logs[i].includes('胜利') || logs[i].includes('祓除')) entry.classList.add('log-victory');
      if (logs[i].includes('败北') || logs[i].includes('倒下')) entry.classList.add('log-defeat');
      entry.textContent = logs[i];
      container.appendChild(entry);
    }
    container.scrollTop = container.scrollHeight;
  }

  _appendLog(msg) {
    const container = document.getElementById('battle-log');
    if (!container) return;
    const entry = document.createElement('div');
    entry.className = 'battle-log-entry';
    if (msg.includes('【黑闪！】') || msg.includes('漆黑的光芒')) entry.classList.add('log-black-flash');
    entry.textContent = msg;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
  }

  _renderSkillButtons(playerData) {
    // 渲染到折叠 body 中
    let body = document.getElementById('battle-attack-body');
    if (!body) {
      const container = document.getElementById('battle-skills');
      if (container) { body = document.createElement('div'); body.id = 'battle-attack-body'; container.appendChild(body); }
      else return;
    }
    body.innerHTML = '';
    const skills = playerData.skills || [];
    for (const skill of skills) {
      const btn = document.createElement('button');
      btn.className = 'btn battle-skill-btn';
      btn.dataset.skillId = skill.id;
      if (skill.type === 'martial') btn.classList.add('skill-martial');
      else if (skill.type === 'cursed') btn.classList.add('skill-cursed');
      else if (skill.type === 'movement') btn.classList.add('skill-movement');
      if (skill.cost > 0 && playerData.mp < skill.cost) btn.classList.add('cost-too-high');
      const distNames = ['贴身', '近', '中', '远'];
      const minD = skill.min_distance !== undefined ? distNames[skill.min_distance] : '?';
      const maxD = skill.max_distance !== undefined ? distNames[skill.max_distance] : '?';
      const distRange = (skill.type === 'movement') ? '' : ` [${minD}~${maxD}]`;
      const costLabel = skill.cost > 0 ? ` (MP ${skill.cost})` : '';
      const ctLabel = skill.cast_time !== undefined ? ` 咏唱${skill.cast_time}帧` : '';
      const rvLabel = skill.base_recovery_speed !== undefined ? ` 补偿${skill.base_recovery_speed}` : '';
      btn.innerHTML = `
        <span class="skill-name">${skill.name}${distRange}</span>
        <span class="skill-cost">${costLabel}${ctLabel}${rvLabel}</span>
      `;
      body.appendChild(btn);
    }
  }

  _renderVowButtons(playerData) {
    let body = document.getElementById('battle-vow-body');
    if (!body) {
      const container = document.getElementById('battle-vows');
      if (container) { body = document.createElement('div'); body.id = 'battle-vow-body'; container.appendChild(body); }
      else return;
    }
    const activeVow = playerData.active_vow;
    const vowLabels = { 'offense_boost': '攻击强化', 'no_cursed_speed': '禁咒加速' };
    let html = '';
    if (activeVow) {
      html += `<span class="vow-active-badge">⚡ 束缚: ${vowLabels[activeVow] || activeVow}</span>`;
      html += `<button class="btn battle-vow-btn btn-system" data-vow-id="none">解除束缚</button>`;
    } else {
      html += `<button class="btn battle-vow-btn btn-system" data-vow-id="offense_boost">🔺 攻击强化之缚</button>`;
      html += `<button class="btn battle-vow-btn btn-system" data-vow-id="no_cursed_speed">⚡ 禁咒加速之缚</button>`;
    }
    body.innerHTML = html;
  }

  _renderDomainButton(s) {
    const hasDomain = s.units && s.units.some(u => u.unit_type === 'domain');
    let btnContainer = document.getElementById('battle-domain-bar');
    if (!btnContainer) {
      btnContainer = document.createElement('div');
      btnContainer.id = 'battle-domain-bar';
      btnContainer.className = 'battle-domain-bar';
      const vowsEl = document.getElementById('battle-vows');
      if (vowsEl && vowsEl.parentNode) vowsEl.parentNode.insertBefore(btnContainer, vowsEl.nextSibling);
    }
    if (hasDomain) {
      const domain = s.units.find(u => u.unit_type === 'domain');
      btnContainer.innerHTML = `
        <div class="domain-hp-row">
          <span class="domain-label">🏛️ ${domain.name}</span>
          <div class="stat-bar-bg battle-bar-wide" style="margin: 0 0.5rem;">
            <div class="stat-bar hp-bar" style="width: ${domain.max_hp > 0 ? (domain.hp / domain.max_hp) * 100 : 0}%"></div>
          </div>
          <span class="stat-text">${domain.hp} / ${domain.max_hp}</span>
          <button class="btn battle-domain-btn btn-system" data-action="cancel-domain">取消领域</button>
        </div>
      `;
    } else {
      const state = this.uiManager.saveManager?.getState();
      const hasLearned = state && state.domainUnlocked === state.techniqueId;
      const techId = state?.techniqueId || 'cursedEnergyBoost';
      btnContainer.innerHTML = `
        <button class="btn battle-domain-btn btn-primary" data-domain-id="${techId}_domain" ${hasLearned ? '' : 'disabled'}>🏛️ 领域展开${hasLearned ? '' : ' (未学习)'}</button>
      `;
    }
  }

  _flashBlackFlashEffect() {
    const container = document.querySelector('#screen-battle .battle-container');
    if (!container) return;
    container.classList.add('black-flash-shake');
    setTimeout(() => container.classList.remove('black-flash-shake'), 600);
  }

  _showVictoryScreen(s) {
    const tracker = s._tracker || {};
    const usage = tracker.skill_usage || {};
    const skillUsageStr = JSON.stringify(usage);
    this.pyodideLoader.runPython(
      `from python.battle_engine import generate_battle_rewards, BattleTracker
t = BattleTracker()
t.skill_usage = ${skillUsageStr}
rewards = generate_battle_rewards(t)
__builtins__.dict(rewards)`
    ).then(rewardsStr => {
      const rewards = typeof rewardsStr === 'string' ? JSON.parse(rewardsStr) : rewardsStr;
      this._renderRewardPopup(rewards);
    }).catch(err => {
      const proficiency = {};
      for (const [id, count] of Object.entries(usage)) proficiency[id] = count * 5;
      this._renderRewardPopup({
        money: Math.floor(Math.random() * 31) + 20,
        skillPoints: 1,
        inspirationGained: Math.random() < 0.05,
        proficiencyGains: proficiency
      });
    });
  }

  _renderRewardPopup(rewards) {
    const container = document.querySelector('#screen-battle .battle-container');
    if (!container) return;
    const old = document.getElementById('battle-reward-overlay');
    if (old) old.remove();
    const pGains = rewards.proficiencyGains || {};
    const profLines = Object.entries(pGains)
      .map(([id, val]) => {
        const nameMap = { attack: '体术平A', cursed_boost: '咒力强化拳', aoi: '苍', aka: '赫', gyokuken: '玉犬', piercing_blood: '穿血', boogie_punch: '拍手连击', doll_resonance: '共鸣' };
        return `<div class="reward-row">${nameMap[id] || id}: +${val} 熟练度</div>`;
      }).join('');
    const inspText = rewards.inspirationGained ? '<div class="reward-row reward-inspiration">⚡ 获得了灵感！</div>' : '';
    const overlay = document.createElement('div');
    overlay.id = 'battle-reward-overlay';
    overlay.className = 'battle-reward-overlay';
    overlay.innerHTML = `
      <div class="battle-reward-box">
        <h3>━━ 战斗胜利 ━━</h3>
        <div class="reward-row reward-money">💰 金币: +${rewards.money}</div>
        <div class="reward-row reward-sp">🔧 技能点: +${rewards.skillPoints}</div>
        ${profLines}${inspText}
        <button id="btn-reward-confirm" class="btn btn-primary">确认</button>
      </div>
    `;
    container.appendChild(overlay);
    document.getElementById('btn-reward-confirm').onclick = () => {
      overlay.remove();
      if (this.uiManager.saveManager && typeof this.uiManager.saveManager.applyBattleRewards === 'function') {
        this.uiManager.saveManager.applyBattleRewards(rewards);
      }
    };
  }

  _disableAllSkills() {
    document.querySelectorAll('#battle-attack-body .battle-skill-btn').forEach(b => b.disabled = true);
    document.querySelectorAll('#battle-vow-body .battle-vow-btn').forEach(b => b.disabled = true);
    const dBtn = document.querySelector('#battle-domain-bar .battle-domain-btn');
    if (dBtn) dBtn.disabled = true;
  }

  async _executeAction(action) {
    if (this._processing) return;
    this._processing = true;
    this._setAllBtns(true);
    try {
      const actionJson = JSON.stringify(action);
      const stateJson = JSON.stringify(this.currentState);
      const resultJson = await this.pyodideLoader.runPython(
        `from python.battle_engine import execute_action\nexecute_action('${actionJson.replace(/'/g, "\\'")}', '''${stateJson.replace(/'/g, "\\'")}''')`
      );
      this.currentState = JSON.parse(resultJson);
      this._renderAll();
    } catch (err) {
      this._appendLog(`[ERROR] 行动执行失败: ${err.message}`);
      console.error('[BattleUI]', err);
    } finally {
      this._processing = false;
      this._setAllBtns(false);
    }
  }

  _setAllBtns(disabled) {
    document.querySelectorAll('#battle-attack-body .battle-skill-btn, #battle-vow-body .battle-vow-btn, #battle-domain-bar .battle-domain-btn, [data-action="cancel-domain"]').forEach(b => b.disabled = disabled);
  }

  _showLoading(show) {
    const el = document.getElementById('battle-loading');
    if (el) el.classList.toggle('hidden', !show);
  }

  _handleDomainExpand(domainId) {
    const saveState = this.uiManager.saveManager?.getState();
    if (!saveState) return;
    const techId = saveState.techniqueId || 'cursedEnergyBoost';
    const tier = (saveState.domainLearnedTiers && saveState.domainLearnedTiers[techId]) || 'complete';
    const isComplete = tier === 'complete';
    const attrs = saveState.attributes || {};
    let totalTech = 0;
    const sl = saveState.skillLevels || {};
    for (const lv of Object.values(sl)) totalTech += lv;
    const barrier = attrs.cursedEnergyControl || 10;
    let hp = 100 * barrier + 5 * barrier;
    let atkDmg = 50 * Math.max(1, totalTech);
    if (!isComplete) { hp = Math.floor(hp * 0.6); atkDmg = Math.floor(atkDmg * 0.6); }
    const domainNames = { limitless: '无量空处', tenShadows: '嵌合暗翳庭', boogieWoogie: '不义游戏·领域', curseManipulation: '极之番·漩涡', pureMartial: '天与咒缚·体' };
    this._executeAction({
      type: 'expand_domain', actor: 'player', domain_id: domainId,
      domain_name: domainNames[techId] || '领域', is_complete: isComplete,
      domain_hp: hp, attack_interval: 10, attack_damage: atkDmg, mp_cost: 5
    });
  }
}
