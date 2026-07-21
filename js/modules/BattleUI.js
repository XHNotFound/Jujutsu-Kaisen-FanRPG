// js/modules/BattleUI.js — 战斗界面管理器
// 唯一负责战斗画面的 DOM 渲染和事件绑定
// 严禁在 JS 中写战斗计算逻辑！
// Phase 7: 使用 exec 直接执行 Python 源码彻底绕过 import 缓存
// Phase 9: 召唤物 UI + 仇恨热力图

import { getActiveSummons, getAggroRanking } from './summonSystem.js';

export class BattleUI {
  constructor(pyodideLoader, uiManager) {
    this.pyodideLoader = pyodideLoader;
    this.uiManager = uiManager;
    this.currentState = null;
    this._processing = false;
    this._delegationBound = false;
    this._controlledShikigami = null;  // Phase 9: 当前手动控制的式神 ID
  }

  async start() {
    this.uiManager.showScreen('screen-battle');
    this._showLoading(true);
    this.currentState = null;
    const logContainer = document.getElementById('battle-log');
    if (logContainer) logContainer.innerHTML = '';

    try {
      const py = await this.pyodideLoader.load();
      // 强制清除 Pyodide 缓存 + 重建 FS
      await py.runPythonAsync('import sys; [sys.modules.pop(k,None) for k in list(sys.modules.keys()) if "python" in k]');
      try { py.FS.rmdir('/home/pyodide/python'); } catch(e) {}
      try { py.FS.mkdir('/home/pyodide/python'); } catch(e) {}
      try { py.FS.rmdir('/home/pyodide/python/__pycache__'); } catch(e) {}
      // 写入最新 Python 文件
      const pyFiles = ['python/__init__.py', 'python/models.py', 'python/battle_engine.py'];
      for (const fp of pyFiles) {
        const resp = await fetch(fp, { cache: 'no-store' });
        const parts = fp.replace(/\\/g, '/').split('/');
        let dir = '/home/pyodide';
        for (let i = 0; i < parts.length - 1; i++) {
          dir += '/' + parts[i];
          try { py.FS.mkdir(dir); } catch(e) {}
        }
        const pyPath = '/home/pyodide/' + fp;
        try { py.FS.unlink(pyPath); } catch(e) {}
        py.FS.writeFile(pyPath, await resp.text());
      }

      const state = this.uiManager.saveManager.getState();
      const saveDataJson = state ? JSON.stringify(state) : '{}';

      // 使用 exec 绕过 import 缓存，直接加载最新源码
      const resultJson = await py.runPythonAsync(`
import sys, json
sys.path.insert(0, '/home/pyodide')
for k in list(sys.modules.keys()):
    if 'python' in k or 'battle_engine' in k or 'models' in k:
        sys.modules.pop(k, None)
with open('/home/pyodide/python/models.py', 'r', encoding='utf-8') as f:
    exec(f.read())
with open('/home/pyodide/python/battle_engine.py', 'r', encoding='utf-8') as f:
    exec(f.read())
init_battle('${saveDataJson.replace(/'/g, "\\'").replace(/\n/g, '')}')
      `);
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

  _bindDelegation() {
    if (this._delegationBound) return;
    this._delegationBound = true;
    const container = document.querySelector('#screen-battle .battle-container');
    if (!container) return;
    container.addEventListener('click', (e) => {
      if (this._processing) return;
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
      const skillBtn = e.target.closest('.battle-skill-btn');
      if (skillBtn && !skillBtn.disabled) {
        this._executeAction({ type: 'use_skill', actor: 'player', skill_id: skillBtn.dataset.skillId, target: this.currentState?.enemy?.id || 'enemy_1' });
        return;
      }
      if (e.target.closest('#btn-battle-flee')) {
        if (this.currentState && this.uiManager.saveManager) {
          const p = this.currentState.player;
          const sm = this.uiManager.saveManager;
          const st = sm.getState();
          if (st) { st.hp = p.hp; st.mp = p.mp; sm.setState(st); }
        }
        this.uiManager.showModal('确定要撤离战斗吗？', {
          onConfirm: () => { this.uiManager.hideModal(); this.uiManager.renderMainScreen(); },
          onCancel: () => this.uiManager.hideModal()
        });
        return;
      }
      const vowBtn = e.target.closest('.battle-vow-btn');
      if (vowBtn && !vowBtn.disabled) {
        this._executeAction({ type: 'apply_vow', actor: 'player', vow_id: vowBtn.dataset.vowId });
        return;
      }
      const domainBtn = e.target.closest('.battle-domain-btn');
      if (domainBtn && !domainBtn.disabled) {
        this._handleDomainExpand(domainBtn.dataset.domainId || 'limitless_domain');
        return;
      }
      if (e.target.closest('[data-action="cancel-domain"]')) {
        const d = this.currentState?.units?.find(u => u.unit_type === 'domain');
        if (d) this._executeAction({ type: 'cancel_domain', domain_id: d.id });
        return;
      }
      // Phase 9: shikigami auto/manual toggle
      const shAutoBtn = e.target.closest('[data-action="shikigami-auto"]');
      if (shAutoBtn) {
        this._controlledShikigami = null;
        this._renderAll();
        return;
      }
      const shManualBtn = e.target.closest('[data-action="shikigami-manual"]');
      if (shManualBtn) {
        this._controlledShikigami = shManualBtn.dataset.sid || null;
        this._renderAll();
        return;
      }
      // Phase 9: shikigami manual skill use
      const shSkillBtn = e.target.closest('[data-action="shikigami-use-skill"]');
      if (shSkillBtn && !shSkillBtn.disabled) {
        const shSid = shSkillBtn.dataset.sid;
        const shSkillId = shSkillBtn.dataset.skill;
        const shTarget = shSkillBtn.dataset.target || 'enemy_1';
        this._executeAction({ type: 'shikigami_skill', actor: shSid, skill_id: shSkillId, target: shTarget });
        return;
      }
    });
  }

  _renderAll() {
    if (!this.currentState) return;
    const s = this.currentState;
    this._renderCharCard('player', s.player);
    this._renderCharCard('enemy', s.enemy);
    this._renderDistance(s);
    this._renderLog(s.log);
    this._renderSummons(s);  // Phase 9: 召唤物状态栏
    this._renderShikigamiSkillPanel(s);  // Phase 9: 式神手动技能面板
    this._renderCollapsibleSection('battle-attack-section', 'battle-attack-body', '⚔️ 攻击', () => this._renderSkillButtons(s.player));
    this._renderCollapsibleSection('battle-vow-section', 'battle-vow-body', '🔗 束缚', () => this._renderVowButtons(s.player));
    this._renderDomainButton(s);
    if (s.last_hit_was_black_flash) this._flashBlackFlashEffect();
    if (s.turn === 'player_win') { this._appendLog('━━ 胜利！诅咒被祓除了。 ━━'); this._disableAllSkills(); this._showVictoryScreen(s); }
    else if (s.turn === 'enemy_win') { this._appendLog('━━ 败北…你失去了意识。 ━━'); this._disableAllSkills(); }
  }

  _renderCollapsibleSection(containerId, bodyId, label, renderFn) {
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.className = 'battle-collapsible-section';
      const skillsEl = document.getElementById('battle-skills');
      if (skillsEl && skillsEl.parentNode) skillsEl.parentNode.insertBefore(container, skillsEl);
    }
    container.innerHTML = `<button class="btn battle-section-toggle" data-section="${bodyId}">${label}</button><div id="${bodyId}" class="battle-section-body" style="display:none"></div>`;
    renderFn();
  }

  _renderCharCard(prefix, data) {
    const nameEl = document.getElementById(prefix + '-name');
    if (nameEl) {
      let label = data.name || '--';
      const dn = ['贴身', '近', '中', '远'];
      if (data.distance !== undefined && dn[data.distance]) label = data.name + ' [' + dn[data.distance] + ']';
      nameEl.textContent = label;
    }
    const hpPct = data.max_hp > 0 ? (data.hp / data.max_hp) * 100 : 0;
    const hpBar = document.getElementById(prefix + '-hp-bar');
    const hpText = document.getElementById(prefix + '-hp-text');
    if (hpBar) hpBar.style.width = hpPct + '%';
    if (hpText) hpText.textContent = data.hp + ' / ' + data.max_hp;
    if (prefix === 'player') {
      const mpPct = data.max_mp > 0 ? (data.mp / data.max_mp) * 100 : 0;
      const mpBar = document.getElementById('player-mp-bar');
      const mpText = document.getElementById('player-mp-text');
      if (mpBar) mpBar.style.width = mpPct + '%';
      if (mpText) mpText.textContent = data.mp + ' / ' + data.max_mp;
    }
    // Phase 8: 敌人 MP 条
    if (prefix === 'enemy' && data.max_mp > 0) {
      this._renderEnemyMp(data);
    }
    const atbPct = (data.atb / 300) * 100;
    const atbBar = document.getElementById(prefix + '-atb-bar');
    const atbText = document.getElementById(prefix + '-atb-text');
    if (atbBar) atbBar.style.width = atbPct + '%';
    if (atbText) atbText.textContent = data.atb + ' / 300';
  }

  _renderDistance(s) {
    let distEl = document.getElementById('battle-distance-bar');
    if (!distEl) {
      distEl = document.createElement('div'); distEl.id = 'battle-distance-bar'; distEl.className = 'battle-distance-bar';
      const logEl = document.getElementById('battle-log');
      if (logEl && logEl.parentNode) logEl.parentNode.insertBefore(distEl, logEl);
    }
    const slots = ['贴身', '近', '中', '远'];
    let html = '<span class="dist-label">距离：</span>';
    for (let i = 0; i < 4; i++) {
      let cls = 'dist-slot';
      if (i === s.player.distance && i === s.enemy.distance) cls += ' dist-both';
      else if (i === s.player.distance) cls += ' dist-player';
      else if (i === s.enemy.distance) cls += ' dist-enemy';
      html += '<span class="' + cls + '">【' + slots[i] + '】</span>';
    }
    distEl.innerHTML = html;
  }

  // ===== Phase 9: 召唤物 UI =====

  _renderSummons(s) {
    const container = document.getElementById('battle-summons');
    if (!container) return;
    const summons = getActiveSummons(s.units || []);
    if (summons.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';
    const ranking = getAggroRanking(s.units || []);
    const maxAggro = ranking.length > 0 ? (ranking[0].aggro || 0) : 0;
    container.innerHTML = summons.map(sh => {
      const isControlled = this._controlledShikigami === sh.id;
      const isExpiring = (sh.summon_duration || 0) < 60;
      const hpPct = sh.max_hp > 0 ? (sh.hp / sh.max_hp) * 100 : 0;
      const atbPct = (sh.atb / 300) * 100;
      const durPct = sh.summon_duration > 0 ? Math.floor(sh.summon_duration / 10) : 0;
      // Aggro indicator
      const agg = sh.aggro || 0;
      let aggClass = 'aggro-none';
      if (agg > 0 && maxAggro > 0) {
        const ratio = agg / maxAggro;
        if (ratio >= 0.7) aggClass = 'aggro-high';
        else if (ratio >= 0.3) aggClass = 'aggro-mid';
        else aggClass = 'aggro-low';
      }
      let ctls = '';
      if (isControlled) {
        ctls = `<div class="battle-summon-ctrls">
          <button class="btn btn-shikigami-auto" data-action="shikigami-auto" data-sid="${sh.id}">切换 AI 自动</button>
        </div>`;
      } else {
        ctls = `<div class="battle-summon-ctrls">
          <button class="btn btn-shikigami-manual" data-action="shikigami-manual" data-sid="${sh.id}">手动控制</button>
        </div>`;
      }
      return `<div class="battle-summon-card${isControlled ? ' summon-controllable' : ''}${isExpiring ? ' summon-expiring' : ''}">
        <div class="battle-summon-header">
          <span class="battle-summon-name"><span class="aggro-indicator ${aggClass}" title="仇恨:${agg}"></span>${sh.name}</span>
          <span class="battle-summon-type">式神</span>
        </div>
        <div class="battle-summon-stat-row">
          <span class="stat-label">HP</span>
          <div class="stat-bar-bg battle-bar-wide"><div class="stat-bar hp-bar" style="width:${hpPct}%"></div></div>
          <span class="stat-text">${sh.hp}/${sh.max_hp}</span>
        </div>
        <div class="battle-summon-stat-row">
          <span class="stat-label">ATB</span>
          <div class="stat-bar-bg battle-bar-wide"><div class="stat-bar" style="width:${atbPct}%;background:#eab308;"></div></div>
          <span class="stat-text">${sh.atb}/300</span>
        </div>
        <div class="battle-summon-duration">⏱ 剩余 <span class="${isExpiring ? 'duration-low' : ''}">${durPct}</span>s</div>
        ${ctls}
      </div>`;
    }).join('');
  }

  _renderShikigamiSkillPanel(s) {
    let panel = document.getElementById('battle-shikigami-skills-panel');
    // Only show if player is controlling a shikigami
    if (!this._controlledShikigami) {
      if (panel) panel.style.display = 'none';
      return;
    }
    const shiki = (s.units || []).find(u => u.id === this._controlledShikigami && u.is_alive);
    if (!shiki) {
      this._controlledShikigami = null;
      if (panel) panel.style.display = 'none';
      return;
    }
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'battle-shikigami-skills-panel';
      const vowsEl = document.getElementById('battle-vows');
      if (vowsEl && vowsEl.parentNode) {
        vowsEl.parentNode.insertBefore(panel, vowsEl.nextSibling);
      }
    }
    panel.style.display = '';
    const skills = shiki.skills || [];
    panel.innerHTML = `<div class="battle-shikigami-skills-title">🐺 ${shiki.name} 手动控制</div>
      <div class="battle-shikigami-skills">${skills.map(sk => {
        const canUse = shiki.mp >= (sk.cost || 0);
        return `<button class="btn btn-shikigami-skill${canUse ? '' : ' cost-too-high'}" data-action="shikigami-use-skill" data-sid="${shiki.id}" data-skill="${sk.id}" data-target="enemy_1" ${canUse ? '' : 'disabled'}>
          <span class="skill-name">${sk.name}</span>
          <span class="skill-cost">${sk.cost > 0 ? 'MP ' + sk.cost : '免费'}</span>
        </button>`;
      }).join('')}</div>`;
  }

  _renderLog(logs) {
    const container = document.getElementById('battle-log');
    if (!container) return;
    for (let i = container.children.length; i < logs.length; i++) {
      const entry = document.createElement('div');
      entry.className = 'battle-log-entry';
      const l = logs[i];
      if (l.includes('【黑闪！】') || l.includes('漆黑的光芒')) entry.classList.add('log-black-flash');
      if (l.includes('胜利') || l.includes('祓除')) entry.classList.add('log-victory');
      if (l.includes('败北') || l.includes('倒下')) entry.classList.add('log-defeat');
      entry.textContent = l;
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
    let body = document.getElementById('battle-attack-body');
    if (!body) { const c = document.getElementById('battle-skills'); if (c) { body = document.createElement('div'); body.id = 'battle-attack-body'; c.appendChild(body); } else return; }
    body.innerHTML = '';
    const skills = playerData.skills || [];
    for (const skill of skills) {
      const btn = document.createElement('button');
      btn.className = 'btn battle-skill-btn'; btn.dataset.skillId = skill.id;
      if (skill.type === 'martial') btn.classList.add('skill-martial');
      else if (skill.type === 'cursed') btn.classList.add('skill-cursed');
      else if (skill.type === 'movement') btn.classList.add('skill-movement');
      else if (skill.type === 'summon') btn.classList.add('skill-summon');
      if (skill.cost > 0 && playerData.mp < skill.cost) btn.classList.add('cost-too-high');
      const dn = ['贴身', '近', '中', '远'];
      const minD = skill.min_distance !== undefined ? dn[skill.min_distance] : '?';
      const maxD = skill.max_distance !== undefined ? dn[skill.max_distance] : '?';
      const dr = (skill.type === 'movement') ? '' : ' [' + minD + '~' + maxD + ']';
      const cl = skill.cost > 0 ? ' (MP ' + skill.cost + ')' : '';
      const ctl = skill.cast_time !== undefined ? ' 咏唱' + skill.cast_time + '帧' : '';
      const rvl = skill.base_recovery_speed !== undefined ? ' 补偿' + skill.base_recovery_speed : '';
      btn.innerHTML = '<span class="skill-name">' + skill.name + dr + '</span><span class="skill-cost">' + cl + ctl + rvl + '</span>';
      body.appendChild(btn);
    }
  }

  _renderVowButtons(playerData) {
    let body = document.getElementById('battle-vow-body');
    if (!body) { const c = document.getElementById('battle-vows'); if (c) { body = document.createElement('div'); body.id = 'battle-vow-body'; c.appendChild(body); } else return; }
    const av = playerData.active_vow;
    const vl = { 'offense_boost': '攻击强化', 'no_cursed_speed': '禁咒加速' };
    if (av) {
      body.innerHTML = '<span class="vow-active-badge">⚡ 束缚: ' + (vl[av] || av) + '</span><button class="btn battle-vow-btn btn-system" data-vow-id="none">解除束缚</button>';
    } else {
      body.innerHTML = '<button class="btn battle-vow-btn btn-system" data-vow-id="offense_boost">🔺 攻击强化之缚</button><button class="btn battle-vow-btn btn-system" data-vow-id="no_cursed_speed">⚡ 禁咒加速之缚</button>';
    }
  }

  _renderDomainButton(s) {
    const hasDomain = s.units && s.units.some(u => u.unit_type === 'domain');
    let bc = document.getElementById('battle-domain-bar');
    if (!bc) { bc = document.createElement('div'); bc.id = 'battle-domain-bar'; bc.className = 'battle-domain-bar'; const ve = document.getElementById('battle-vows'); if (ve && ve.parentNode) ve.parentNode.insertBefore(bc, ve.nextSibling); }
    if (hasDomain) {
      const d = s.units.find(u => u.unit_type === 'domain');
      bc.innerHTML = '<div class="domain-hp-row"><span class="domain-label">🏛️ ' + d.name + '</span><div class="stat-bar-bg battle-bar-wide" style="margin:0 0.5rem;"><div class="stat-bar hp-bar" style="width:' + (d.max_hp > 0 ? (d.hp / d.max_hp) * 100 : 0) + '%"></div></div><span class="stat-text">' + d.hp + ' / ' + d.max_hp + '</span><button class="btn battle-domain-btn btn-system" data-action="cancel-domain">取消领域</button></div>';
    } else {
      const st = this.uiManager.saveManager?.getState();
      const hl = st && st.domainUnlocked === st.techniqueId;
      bc.innerHTML = '<button class="btn battle-domain-btn btn-primary" data-domain-id="' + (st?.techniqueId || 'cursedEnergyBoost') + '_domain" ' + (hl ? '' : 'disabled') + '>🏛️ 领域展开' + (hl ? '' : ' (未学习)') + '</button>';
    }
  }

  _flashBlackFlashEffect() {
    const c = document.querySelector('#screen-battle .battle-container');
    if (!c) return;
    c.classList.add('black-flash-shake');
    setTimeout(() => c.classList.remove('black-flash-shake'), 600);
  }

  _showVictoryScreen(s) {
    const tracker = s._tracker || {};
    const usage = tracker.skill_usage || {};
    this.pyodideLoader.runPython('import sys; sys.path.insert(0,"/home/pyodide");\nfor k in list(sys.modules.keys()):\n if "python" in k: sys.modules.pop(k,None)\nwith open("/home/pyodide/python/battle_engine.py","r",encoding="utf-8") as f:\n exec(f.read())\ngenerate_battle_rewards(t, None)' + '').then(rs => {}).catch(err => {
      const proficiency = {};
      for (const [id, count] of Object.entries(usage)) proficiency[id] = count * 5;
      this._renderRewardPopup({ money: Math.floor(Math.random() * 31) + 20, skillPoints: 1, inspirationGained: Math.random() < 0.05, proficiencyGains: proficiency });
    });
  }

  _renderRewardPopup(rewards) {
    const container = document.querySelector('#screen-battle .battle-container');
    if (!container) return;
    const old = document.getElementById('battle-reward-overlay');
    if (old) old.remove();
    const pGains = rewards.proficiencyGains || {};
    const profLines = Object.entries(pGains).map(([id, val]) => '<div class="reward-row">' + (id || '??') + ': +' + val + ' 熟练度</div>').join('');
    const inspText = rewards.inspirationGained ? '<div class="reward-row reward-inspiration">⚡ 获得了灵感！</div>' : '';
    const overlay = document.createElement('div');
    overlay.id = 'battle-reward-overlay';
    overlay.className = 'battle-reward-overlay';
    overlay.innerHTML = '<div class="battle-reward-box"><h3>━━ 战斗胜利 ━━</h3><div class="reward-row reward-money">💰 金币: +' + rewards.money + '</div><div class="reward-row reward-sp">🔧 技能点: +' + rewards.skillPoints + '</div>' + profLines + inspText + '<button id="btn-reward-confirm" class="btn btn-primary">确认</button></div>';
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
      const resultJson = await this.pyodideLoader.runPython(`
import sys, json
sys.path.insert(0, '/home/pyodide')
for k in list(sys.modules.keys()):
    if 'python' in k or 'battle_engine' in k or 'models' in k:
        sys.modules.pop(k, None)
with open('/home/pyodide/python/models.py', 'r', encoding='utf-8') as f:
    exec(f.read())
with open('/home/pyodide/python/battle_engine.py', 'r', encoding='utf-8') as f:
    exec(f.read())
execute_action('${actionJson.replace(/'/g, "\\'")}', '''${stateJson.replace(/'/g, "\\'")}''')`);
      this.currentState = JSON.parse(resultJson);
      this._renderAll();
    } catch (err) {
      this._appendLog('[ERROR] 行动执行失败: ' + err.message);
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

  /**
   * Phase 8: 渲染敌人 MP 条 + 状态效果标记
   */
  _renderEnemyMp(data) {
    let mpRow = document.getElementById('enemy-mp-row');
    if (!mpRow) {
      mpRow = document.createElement('div');
      mpRow.id = 'enemy-mp-row';
      mpRow.className = 'battle-stat-row';
      const atbRow = document.getElementById('enemy-atb-text')?.parentElement;
      if (atbRow && atbRow.parentNode) atbRow.parentNode.insertBefore(mpRow, atbRow);
    }
    const mpPct = data.max_mp > 0 ? (data.mp / data.max_mp) * 100 : 0;
    mpRow.innerHTML = '<span class="stat-label">MP</span><div class="stat-bar-bg battle-bar-wide"><div class="stat-bar mp-bar" style="width:' + mpPct + '%"></div></div><span class="stat-text">' + data.mp + ' / ' + data.max_mp + '</span>';
    // 状态效果
    const se = data.status_effects || [];
    if (se.length > 0) {
      const labels = se.map(s => s.name || s.id).join(', ');
      mpRow.innerHTML += '<span class="status-badge" title="' + labels + '">' + labels + '</span>';
    }
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
    this._executeAction({ type: 'expand_domain', actor: 'player', domain_id: domainId, domain_name: domainNames[techId] || '领域', is_complete: isComplete, domain_hp: hp, attack_interval: 10, attack_damage: atkDmg, mp_cost: 5 });
  }
}
