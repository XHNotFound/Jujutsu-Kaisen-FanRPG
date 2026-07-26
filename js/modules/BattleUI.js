// js/modules/BattleUI.js — 战斗界面管理器
// 唯一负责战斗画面的 DOM 渲染和事件绑定
// 严禁在 JS 中写战斗计算逻辑！
// Phase 7: 使用 exec 直接执行 Python 源码彻底绕过 import 缓存
// Phase 9: 召唤物 UI + 仇恨热力图

import { getActiveSummons, getAggroRanking } from './summonSystem.js';
import { getStatusSummary, calculateRCTEfficiency } from './statusSystem.js';
import { isBattleUsable } from '../data/items.js';
import { CURSED_TOOLS } from '../data/cursed_tools.js';

// Phase 12: simple HTML escape (no DOM needed — just for safe attribute interpolation)
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export class BattleUI {
  constructor(pyodideLoader, uiManager) {
    this.pyodideLoader = pyodideLoader;
    this.uiManager = uiManager;
    this.currentState = null;
    this._processing = false;
    this._delegationBound = false;
    this._controlledShikigami = null;  // Phase 9: 当前手动控制的式神 ID
    this._escapeLocked = false;        // Phase 14: 逃跑是否已失败锁定
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

      // Phase 11: 如果有强制 enemyId（考核战斗），写入 saveData 让 Python 引擎读取
      let enemyIdOverride = '';
      if (state && state._forcedEnemyId) {
        enemyIdOverride = state._forcedEnemyId;
      }

      // 通过临时文件传递 JSON，避免字符串字面量转义问题
      py.FS.writeFile('/home/pyodide/_init_save.json', saveDataJson);
      if (enemyIdOverride) {
        py.FS.writeFile('/home/pyodide/_forced_enemy.json', JSON.stringify({ enemy_id: enemyIdOverride }));
      } else {
        try { py.FS.unlink('/home/pyodide/_forced_enemy.json'); } catch(e) {}
      }

      // 使用 exec 绕过 import 缓存，直接加载最新源码
      const resultJson = await py.runPythonAsync(`
import sys, json, os
sys.path.insert(0, '/home/pyodide')
for k in list(sys.modules.keys()):
    if 'python' in k or 'battle_engine' in k or 'models' in k:
        sys.modules.pop(k, None)
with open('/home/pyodide/python/models.py', 'r', encoding='utf-8') as f:
    exec(f.read())
with open('/home/pyodide/python/battle_engine.py', 'r', encoding='utf-8') as f:
    exec(f.read())
with open('/home/pyodide/_init_save.json', 'r', encoding='utf-8') as f:
    save_data = json.load(f)
# Phase 11: 检查是否有强制 enemy_id
try:
    with open('/home/pyodide/_forced_enemy.json', 'r', encoding='utf-8') as f:
        forced = json.load(f)
    save_data['_forced_enemy_id'] = forced.get('enemy_id')
except:
    pass
init_battle(json.dumps(save_data))
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
        this._handleEscapeAttempt();
        return;
      }
      const vowBtn = e.target.closest('.battle-vow-btn');
      if (vowBtn && !vowBtn.disabled) {
        this._executeAction({ type: 'apply_vow', actor: 'player', vow_id: vowBtn.dataset.vowId });
        return;
      }
      const domainBtn = e.target.closest('.battle-domain-btn');
      // Phase 12: status badge click/hover interaction
      const statusBadge = e.target.closest('.battle-status-badge');
      if (statusBadge) {
        this._toggleStatusBadge(statusBadge);
        return;
      }

      // cancel-domain 用 data-action 区分，必须在 domain expand 之前检查
      if (e.target.closest('[data-action="cancel-domain"]')) {
        const d = this.currentState?.units?.find(u => u.unit_type === 'domain' && u.owner === 'player');
        if (d) this._executeAction({ type: 'cancel_domain', domain_id: d.id });
        return;
      }
      if (domainBtn && !domainBtn.disabled && !domainBtn.dataset.action) {
        this._handleDomainExpand(domainBtn.dataset.domainId || 'limitless_domain');
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
      // Phase 10: activate domain counter buff
      const dcBtn = e.target.closest('.btn-domain-counter');
      if (dcBtn && !dcBtn.disabled) {
        const action = dcBtn.dataset.action;
        let buffId = 'simple_domain';
        if (action === 'activate-falling-blossom') buffId = 'falling_blossom';
        else if (action === 'activate-hollow-wicker') buffId = 'hollow_wicker';
        this._executeAction({ type: 'activate_domain_counter', actor: 'player', buff_id: buffId });
        return;
      }
      // Phase 10.5: repair domain barrier
      const repairBtn = e.target.closest('[data-action="repair-domain"]');
      if (repairBtn && !repairBtn.disabled) {
        this._executeAction({ type: 'repair_domain', actor: 'player' });
        return;
      }
      // Phase 12: RCT dialog — open slider popup
      const rctBtn = e.target.closest('[data-action="rct-dialog"]');
      if (rctBtn && !rctBtn.disabled) {
        this._showRCTDialog();
        return;
      }
      // Phase 16: use item
      const itemBtn = e.target.closest('[data-action="use-item"]');
      if (itemBtn && !itemBtn.disabled) {
        this._executeAction({ type: 'use_item', actor: 'player', item_id: itemBtn.dataset.itemId });
        return;
      }
      // Phase 16: use tool active skill
      const toolBtn = e.target.closest('[data-action="use-tool-active"]');
      if (toolBtn && !toolBtn.disabled) {
        this._executeAction({ type: 'tool_active', actor: 'player', tool_id: toolBtn.dataset.toolId });
        return;
      }
    });

    // Phase 12: mouseover/mouseout delegation for status badge hover expansion
    container.addEventListener('mouseover', (e) => {
      const badge = e.target.closest('.battle-status-badge');
      if (badge) {
        const nameSpan = badge.querySelector('.status-name');
        if (nameSpan) nameSpan.classList.add('status-expanded');
      }
    });
    container.addEventListener('mouseout', (e) => {
      const badge = e.target.closest('.battle-status-badge');
      if (badge) {
        const nameSpan = badge.querySelector('.status-name');
        if (nameSpan && !badge.classList.contains('status-pinned')) {
          nameSpan.classList.remove('status-expanded');
        }
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
    this._renderCollapsibleSection('battle-domain-section', 'battle-domain-body', '🏛️ 领域', () => this._renderDomainPanel(s));
    // Phase 16: 道具与咒具面板
    this._renderCollapsibleSection('battle-items-section', 'battle-items-body', '🎒 道具', () => this._renderItemPanel(s));
    this._renderCollapsibleSection('battle-tools-section', 'battle-tools-body', '⚔️ 咒具', () => this._renderToolPanel(s));
    // Phase 12: 反转术式按钮
    this._renderRCTButton(s);
    if (s.last_hit_was_black_flash) this._flashBlackFlashEffect();
    if (s.turn === 'player_win') { this._appendLog('━━ 胜利！诅咒被祓除了。 ━━'); this._disableAllSkills(); this._showVictoryScreen(s); }
    else if (s.turn === 'enemy_win') {
      this._appendLog('━━ 败北…你失去了意识。 ━━');
      this._disableAllSkills();
      // Phase 14: 重伤惩罚
      this._showDefeatScreen(s);
    }
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

    // Phase 13: 战斗中的 HP/MP 显示加成后的上限 (绿色)
    if (prefix === 'player') {
      const saveSt = this.uiManager.saveManager?.getState();
      const baseCon = (saveSt?.attributes?.constitution) || (data.constitution || 10);
      const baseCE  = (saveSt?.attributes?.cursedEnergy) || (data.cursed_energy || 10);
      // Calculate base max values from attributes (using SaveManager formula if available)
      const sm = this.uiManager.saveManager;
      const baseMaxHp = sm && sm._calcMaxHp ? sm._calcMaxHp(baseCon) : data.max_hp;
      const baseMaxMp = sm && sm._calcMaxMp ? sm._calcMaxMp(baseCE) : data.max_mp;
      const hpBonus = data.max_hp - baseMaxHp;
      const mpBonus = data.max_mp - baseMaxMp;

      if (hpBonus !== 0) {
        if (hpText) hpText.innerHTML = `${data.hp} / ${data.max_hp} <span style="color:#22c55e;font-size:0.7rem;">(+${hpBonus})</span>`;
      } else {
        if (hpText) hpText.textContent = data.hp + ' / ' + data.max_hp;
      }

      if (prefix === 'player') {
        const mpPct = data.max_mp > 0 ? (data.mp / data.max_mp) * 100 : 0;
        const mpBar = document.getElementById('player-mp-bar');
        const mpText = document.getElementById('player-mp-text');
        if (mpBar) mpBar.style.width = mpPct + '%';
        if (mpBonus !== 0) {
          if (mpText) mpText.innerHTML = `${data.mp} / ${data.max_mp} <span style="color:#22c55e;font-size:0.7rem;">(+${mpBonus})</span>`;
        } else {
          if (mpText) mpText.textContent = data.mp + ' / ' + data.max_mp;
        }
      }
    } else {
      if (hpText) hpText.textContent = data.hp + ' / ' + data.max_hp;
      if (prefix === 'enemy' && data.max_mp > 0) {
        this._renderEnemyMp(data);
      } else if (prefix === 'player') {
        // handled above
      }
    }
    const atbPct = (data.atb / 300) * 100;
    const atbBar = document.getElementById(prefix + '-atb-bar');
    const atbText = document.getElementById(prefix + '-atb-text');
    if (atbBar) atbBar.style.width = atbPct + '%';
    if (atbText) atbText.textContent = data.atb + ' / 300';

    // Phase 12: 渲染状态栏（Buff/Debuff 显式化）
    this._renderStatusBar(prefix, data);
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

  // ===== Phase 10: 领域对抗 Buff 状态显示 =====

  _renderDomainCounterBuffs(s) {
    let container = document.getElementById('battle-domain-counter-buffs');
    if (!container) {
      container = document.createElement('div');
      container.id = 'battle-domain-counter-buffs';
      container.className = 'battle-domain-counter-buffs';
      const summonsEl = document.getElementById('battle-summons');
      if (summonsEl && summonsEl.parentNode) {
        summonsEl.parentNode.insertBefore(container, summonsEl.nextSibling);
      }
    }
    // Check player's domain_counter_buffs
    const player = s.player || (s.units || []).find(u => u.unit_type === 'player');
    const buffs = (player && player.domain_counter_buffs) || [];
    if (buffs.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';
    container.innerHTML = buffs.map(b => {
      const mpDrain = b.mp_drain_per_10av || 0;
      const shield = b.shield_hp ? ` 护盾${b.current_shield_hp}` : '';
      const reduction = b.domain_damage_reduction ? ` -${Math.round(b.domain_damage_reduction*100)}%领域伤害` : '';
      const drainText = mpDrain > 0 ? ` ⚡${mpDrain}/10AV` : '';
      return `<div class="domain-counter-buff-badge" title="${b.name}: ${b.negate_domain_special ? '抵消领域特殊效果 ' : ''}${shield}${reduction}${drainText}">
        🛡️ ${b.name}${drainText}
      </div>`;
    }).join('');

    // Phase 10: 激活领域对抗 Buff 的按钮
    const domainExists = (s.units || []).some(u => u.unit_type === 'domain');
    if (domainExists && player && player.mp > 10) {
      container.innerHTML += `
        <div class="domain-counter-actions">
          <button class="btn btn-primary btn-domain-counter" data-action="activate-falling-blossom" ${buffs.length > 0 ? 'disabled' : ''}>🌸 落花之情</button>
          <button class="btn btn-primary btn-domain-counter" data-action="activate-simple-domain" ${buffs.length > 0 ? 'disabled' : ''}>🗡️ 简易领域</button>
          <button class="btn btn-primary btn-domain-counter" data-action="activate-hollow-wicker" ${buffs.length > 0 ? 'disabled' : ''}>🏺 弥虚葛笼</button>
        </div>`;
    }
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
      if (minD === 'undefined' || isNaN(skill.min_distance)) {
        // Python engine 可能传 undefined min_distance; fallback to 0
        skill.min_distance = 0;
      }
      const minDisplay = skill.min_distance !== undefined ? dn[skill.min_distance] : '?';
      const maxDisplay = skill.max_distance !== undefined ? dn[skill.max_distance] : '?';
      const dr = (skill.type === 'movement') ? '' : ' [' + minDisplay + '~' + maxDisplay + ']';
      const cl = skill.cost > 0 ? ' (MP ' + skill.cost + ')' : '';
      const ctl = skill.cast_time !== undefined ? ' 咏唱' + skill.cast_time + '帧' : '';
      const rvl = skill.base_recovery_speed !== undefined ? ' 补偿' + skill.base_recovery_speed : '';
      // Phase 16: 基准伤害（不含20%浮动）
      const enemyData = this.currentState?.enemy || (this.currentState?.units || []).find(u => u.unit_type === 'enemy');
      if (skill.damage_multiplier > 0 && enemyData) {
          const baseDmg = Math.max(1, Math.floor(playerData.martial_arts * 2 + skill.damage_multiplier * 10 - (enemyData.constitution || 10) * 0.5));
          btn.innerHTML = '<span class="skill-name">' + skill.name + dr + ' <span style="color:#fbbf24;font-size:0.7rem;">基础' + baseDmg + '</span></span><span class="skill-cost">' + cl + ctl + rvl + '</span>';
      } else {
          btn.innerHTML = '<span class="skill-name">' + skill.name + dr + '</span><span class="skill-cost">' + cl + ctl + rvl + '</span>';
      }
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
    // Phase 10.5: 已废弃，由 _renderDomainPanel 统一处理
    // 保留函数体以避免报错（旧代码可能引用），但不再被 _renderAll 调用
  }

  _renderDomainPanel(s) {
    const body = document.getElementById('battle-domain-body');
    if (!body) return;

    const player = s.player || (s.units || []).find(u => u.unit_type === 'player');
    const playerDomain = (s.units || []).find(u => u.unit_type === 'domain' && u.owner === 'player');
    const enemyDomain = (s.units || []).find(u => u.unit_type === 'domain' && u.owner !== 'player');
    const isClashActive = s.domain_clash_active || (playerDomain && enemyDomain);
    const buffs = (player && player.domain_counter_buffs) || [];

    let html = '';

    // 1. 我方领域状态
    if (playerDomain) {
      const hpPct = playerDomain.max_hp > 0 ? (playerDomain.hp / playerDomain.max_hp) * 100 : 0;
      html += '<div class="domain-status-row">';
      html += '<span class="domain-label">🏛️ ' + playerDomain.name + '（我方）</span>';
      html += '<div class="stat-bar-bg battle-bar-wide" style="margin:0 0.5rem;"><div class="stat-bar hp-bar" style="width:' + hpPct + '%"></div></div>';
      html += '<span class="stat-text">' + playerDomain.hp + ' / ' + playerDomain.max_hp + '</span>';
      html += '</div>';
      html += '<div class="domain-actions-row">';
      html += '<button class="btn battle-domain-btn btn-system" data-action="cancel-domain">❌ 取消领域</button>';
      html += '<button class="btn btn-domain-repair" data-action="repair-domain"' + (player.mp < 15 ? ' disabled' : '') + '>🔧 结界术修复</button>';
      html += '</div>';
    } else {
      const st = this.uiManager.saveManager?.getState();
      const hasDomainUnlocked = st && st.domainUnlocked === st.techniqueId;
      const TECHNIQUES_WITH_DOMAIN = ['limitless', 'tenShadows', 'boogieWoogie', 'curseManipulation', 'pureMartial'];
      const hasDomainConfig = st && TECHNIQUES_WITH_DOMAIN.includes(st.techniqueId);
      const canExpand = hasDomainUnlocked && hasDomainConfig;
      html += '<button class="btn battle-domain-btn btn-primary" data-domain-id="' + (st?.techniqueId || 'cursedEnergyBoost') + '_domain"' + (canExpand ? '' : ' disabled') + '>🏛️ 领域展开' + (canExpand ? '' : ' (未学习)') + '</button>';
    }

    // 2. 敌方领域状态
    if (enemyDomain) {
      const eHpPct = enemyDomain.max_hp > 0 ? (enemyDomain.hp / enemyDomain.max_hp) * 100 : 0;
      html += '<div class="domain-status-row domain-enemy-row">';
      html += '<span class="domain-label domain-enemy-label">⚫ ' + enemyDomain.name + '（敌方）</span>';
      html += '<div class="stat-bar-bg battle-bar-wide" style="margin:0 0.5rem;"><div class="stat-bar enemy-hp-bar" style="width:' + eHpPct + '%"></div></div>';
      html += '<span class="stat-text">' + enemyDomain.hp + ' / ' + enemyDomain.max_hp + '</span>';
      html += '</div>';
    }

    // 3. 领域对拼指示器
    if (isClashActive) {
      html += '<div class="domain-clash-indicator">⚔️ 领域对拼中！双方特殊效果失效</div>';
    }

    // 4. 领域对抗 Buff 状态
    if (buffs.length > 0) {
      html += '<div class="domain-counter-buffs-row">';
      for (const b of buffs) {
        const drainText = b.mp_drain_per_10av > 0 ? ' ⚡' + b.mp_drain_per_10av + '/10AV' : '';
        html += '<span class="domain-counter-buff-badge">🛡️ ' + b.name + drainText + '</span>';
      }
      html += '</div>';
    }

    // 5. 领域对抗按钮（仅敌方有领域时可用；已有 buff 时仍显示但 disabled）
    if (enemyDomain && player && player.mp > 10) {
      html += '<div class="domain-actions-row">';
      html += '<button class="btn btn-domain-counter" data-action="activate-simple-domain"' + (buffs.length > 0 ? ' disabled' : '') + '>🗡️ 简易领域</button>';
      html += '<button class="btn btn-domain-counter" data-action="activate-falling-blossom"' + (buffs.length > 0 ? ' disabled' : '') + '>🌸 落花之情</button>';
      html += '<button class="btn btn-domain-counter" data-action="activate-hollow-wicker"' + (buffs.length > 0 ? ' disabled' : '') + '>🏺 弥虚葛笼</button>';
      html += '</div>';
    }

    body.innerHTML = html;
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

    const examQuestId = this.uiManager.saveManager?.getState()?._examQuestId;
    if (examQuestId) {
      // Phase 11: 考核战斗胜利 - 完成考核任务
      this._completeExamQuest(examQuestId, tracker);
      return;
    }

    // 普通战斗奖励
    // Phase 12 fix: 先回写战斗后的 HP/MP 到存档状态（兼容模块缓存）
    const player = s.player || (s.units || []).find(u => u.unit_type === 'player');
    if (player && this.uiManager.saveManager) {
      if (typeof this.uiManager.saveManager.applyBattleStatus === 'function') {
        this.uiManager.saveManager.applyBattleStatus(player.hp, player.mp);
      }
      // 同时更新 state 上的 hp/mp 防止 renderMainScreen 覆盖
      const st = this.uiManager.saveManager.getState();
      if (st) { st.hp = player.hp; st.mp = player.mp; }
    }

    this.pyodideLoader.runPython(`
import sys, json
sys.path.insert(0,"/home/pyodide")
for k in list(sys.modules.keys()):
 if "python" in k: sys.modules.pop(k,None)
with open("/home/pyodide/python/battle_engine.py","r",encoding="utf-8") as f:
 exec(f.read())
json.dumps(generate_battle_rewards(BattleTracker(), None))
    `.trim()).then(rs => {
      try {
        const rewards = JSON.parse(rs);
        this._renderRewardPopup(rewards);
      } catch(e) {
        const proficiency = {};
        for (const [id, count] of Object.entries(usage)) proficiency[id] = count * 5;
        this._renderRewardPopup({ money: Math.floor(Math.random() * 31) + 20, skillPoints: 1, inspirationGained: Math.random() < 0.05, proficiencyGains: proficiency });
      }
    }).catch(err => {
      const proficiency = {};
      for (const [id, count] of Object.entries(usage)) proficiency[id] = count * 5;
      this._renderRewardPopup({ money: Math.floor(Math.random() * 31) + 20, skillPoints: 1, inspirationGained: Math.random() < 0.05, proficiencyGains: proficiency });
    });
  }

  _completeExamQuest(examQuestId, tracker) {
    // Phase 12 fix: 先回写战斗后 HP/MP 状态（兼容模块缓存：检查方法是否存在）
    const s = this.currentState;
    const player = s?.player || (s?.units || []).find(u => u.unit_type === 'player');
    if (player && this.uiManager.saveManager) {
      if (typeof this.uiManager.saveManager.applyBattleStatus === 'function') {
        this.uiManager.saveManager.applyBattleStatus(player.hp, player.mp);
      }
      const st = this.uiManager.saveManager.getState();
      if (st) { st.hp = player.hp; st.mp = player.mp; }
    }

    // 调用 HubSystem 完成考核
    if (this.uiManager._hubSystem && typeof this.uiManager._hubSystem.completeExam === 'function') {
      const state = this.uiManager.saveManager.getState();
      const result = this.uiManager._hubSystem.completeExam(state, examQuestId);
      if (result.success && result.updatePayload) {
        this.uiManager.saveManager.applyGrowthUpdate(result.updatePayload);
        // 清理 _examQuestId
        delete state._examQuestId;
        delete state._forcedEnemyId;
        this.uiManager.saveManager.saveToSlot(this.uiManager.saveManager._findCurrentSlot() || 0);

        const usage = tracker.skill_usage || {};
        const proficiency = {};
        for (const [id, count] of Object.entries(usage)) proficiency[id] = count * 5;
        this._renderRewardPopup({
          money: Math.floor(Math.random() * 101) + 200,
          skillPoints: 5,
          inspirationGained: true,
          proficiencyGains: proficiency,
          examComplete: true
        });
        return;
      }
    }
    // Fallback
    const usage2 = tracker.skill_usage || {};
    const proficiency2 = {};
    for (const [id, count] of Object.entries(usage2)) proficiency2[id] = count * 5;
    this._renderRewardPopup({ money: Math.floor(Math.random() * 31) + 20, skillPoints: 1, inspirationGained: Math.random() < 0.05, proficiencyGains: proficiency2 });
  }

  _renderRewardPopup(rewards) {
    const container = document.querySelector('#screen-battle .battle-container');
    if (!container) return;
    const old = document.getElementById('battle-reward-overlay');
    if (old) old.remove();
    const pGains = rewards.proficiencyGains || {};
    const profLines = Object.entries(pGains).map(([id, val]) => '<div class="reward-row">' + (id || '??') + ': +' + val + ' 熟练度</div>').join('');
    const inspText = rewards.inspirationGained ? '<div class="reward-row reward-inspiration">⚡ 获得了灵感！</div>' : '';
    const examText = rewards.examComplete ? '<div class="reward-row reward-inspiration">🏅 考核通过！职级已晋升</div>' : '';
    const overlay = document.createElement('div');
    overlay.id = 'battle-reward-overlay';
    overlay.className = 'battle-reward-overlay';
    overlay.innerHTML = '<div class="battle-reward-box"><h3>━━ 战斗胜利 ━━</h3><div class="reward-row reward-money">💰 金币: +' + rewards.money + '</div><div class="reward-row reward-sp">🔧 技能点: +' + rewards.skillPoints + '</div>' + profLines + inspText + examText + '<button id="btn-reward-confirm" class="btn btn-primary">确认</button></div>';
    container.appendChild(overlay);
    document.getElementById('btn-reward-confirm').onclick = () => {
      overlay.remove();
      if (this.uiManager.saveManager && typeof this.uiManager.saveManager.applyBattleRewards === 'function') {
        this.uiManager.saveManager.applyBattleRewards(rewards);
      }
      // Phase 12: 返回主界面，HP/MP 已在 _showVictoryScreen 中回写
      if (this.uiManager && typeof this.uiManager.renderMainScreen === 'function') {
        this.uiManager.renderMainScreen();
        this.uiManager.showScreen('screen-main');
      }
    };
  }

  _disableAllSkills() {
    document.querySelectorAll('#battle-attack-body .battle-skill-btn').forEach(b => b.disabled = true);
    document.querySelectorAll('#battle-vow-body .battle-vow-btn').forEach(b => b.disabled = true);
    const dBtn = document.querySelector('#battle-domain-bar .battle-domain-btn');
    if (dBtn) dBtn.disabled = true;
    // Phase 14: 锁定逃跑按钮
    const fleeBtn = document.getElementById('btn-battle-flee');
    if (fleeBtn) fleeBtn.disabled = true;
  }

  // ===== Phase 14: 重伤惩罚画面 =====

  _showDefeatScreen(s) {
    const player = s.player || (s.units || []).find(u => u.unit_type === 'player');
    if (player && this.uiManager.saveManager) {
      const st = this.uiManager.saveManager.getState();
      if (st) {
        st.hp = 1; // 保底 1 HP
        st.mp = Math.max(0, player.mp);
        this.uiManager.saveManager.setState(st);
      }
    }

    // 调用重伤惩罚逻辑
    const hub = this.uiManager._hubSystem;
    const st = this.uiManager.saveManager.getState();
    if (!st) return;

    const result = hub.applyHeavyInjuryPenalty(st);
    if (result.updatePayload) {
      this.uiManager.saveManager.applyGrowthUpdate(result.updatePayload);
    }

    // 显示重伤弹窗
    const penaltyText = result.penalties.join('\n');
    this.uiManager.showModal(
      `💀 重伤昏迷！\n\n${penaltyText}\n\n你被送回了咒术高专的医务室。`,
      {
        confirmOnly: true,
        onConfirm: () => {
          this.uiManager.hideModal();
          this.uiManager.renderMainScreen();
        }
      }
    );
  }

  async _executeAction(action) {
    if (this._processing) return;
    this._processing = true;
    this._setAllBtns(true);
    try {
      const actionJson = JSON.stringify(action);
      const stateJson = JSON.stringify(this.currentState);
      // 通过临时文件传递 JSON，避免字符串字面量转义问题
      const py = await this.pyodideLoader.load();
      py.FS.writeFile('/home/pyodide/_action.json', actionJson);
      py.FS.writeFile('/home/pyodide/_state.json', stateJson);
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
with open('/home/pyodide/_action.json', 'r', encoding='utf-8') as f:
    _action = json.load(f)
with open('/home/pyodide/_state.json', 'r', encoding='utf-8') as f:
    _state = json.load(f)
execute_action(json.dumps(_action), json.dumps(_state))
`);
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

  // ===== Phase 14: 动态逃跑机制 =====

  _calculateEscapeChance() {
    const s = this.currentState;
    if (!s) return 0;

    const enemy = s.enemy || (s.units || []).find(u => u.unit_type === 'enemy');
    const player = s.player || (s.units || []).find(u => u.unit_type === 'player');
    if (!enemy || !player) return 0;

    // 从敌人数据中读取 baseChance (战斗中无法直接读 JS 数据, 使用敌人属性推断)
    // 优先使用 enemy 对象上可能附带的 escapeBaseChance
    const baseChance = enemy.escapeBaseChance !== undefined ? enemy.escapeBaseChance : 50;

    // 攻击次数: 从 battle tracker 统计
    const tracker = s._tracker || {};
    const skillUsage = tracker.skill_usage || {};
    let attackCount = 0;
    for (const count of Object.values(skillUsage)) attackCount += count;

    // HP 百分比
    const hpRatio = player.max_hp > 0 ? (player.hp / player.max_hp) : 1;

    // Phase 14 公式: max(0, baseChance - attackCount*20 - (1-hpRatio)*100*0.5)
    let chance = baseChance - (attackCount * 20) - ((1 - hpRatio) * 100 * 0.5);
    chance = Math.max(0, Math.min(100, Math.round(chance)));

    // 如果已逃跑失败过, 锁定为 0
    if (this._escapeLocked) chance = 0;

    return chance;
  }

  _handleEscapeAttempt() {
    const s = this.currentState;
    if (!s) return;

    // 逃跑失败已被锁定
    if (this._escapeLocked) {
      this._appendLog('逃跑已不可用——你错过了逃跑的最佳时机。');
      return;
    }

    const chance = this._calculateEscapeChance();
    const roll = Math.floor(Math.random() * 100) + 1; // 1-100

    if (roll <= chance) {
      // 逃跑成功
      this._appendLog(`逃跑成功！（概率 ${chance}%，掷出 ${roll}）`);
      this._disableAllSkills();
      // 回写 HP/MP
      const player = s.player || (s.units || []).find(u => u.unit_type === 'player');
      if (player && this.uiManager.saveManager) {
        const st = this.uiManager.saveManager.getState();
        if (st) { st.hp = player.hp; st.mp = player.mp; this.uiManager.saveManager.setState(st); }
      }
      // 延迟返回主界面
      setTimeout(() => {
        this.uiManager.renderMainScreen();
        this.uiManager.showScreen('screen-main');
      }, 800);
    } else {
      // 逃跑失败 — 锁定逃跑按钮
      this._escapeLocked = true;
      this._appendLog(`逃跑失败！（概率 ${chance}%，掷出 ${roll}）———— 逃跑已不可用！`);
      // 禁用逃跑按钮
      const fleeBtn = document.getElementById('btn-battle-flee');
      if (fleeBtn) { fleeBtn.disabled = true; fleeBtn.textContent = '逃跑(已失败)'; }
      // 强制结束玩家回合
      this._executeAction({ type: 'tick' });
    }
  }

  // ===== Phase 12: 状态栏渲染（Buff/Debuff 显式化）=====

  _renderStatusBar(prefix, data) {
    const statuses = data.status_effects || [];
    // Also include mapped domain_counter_buffs as statuses
    const domainCounters = data.domain_counter_buffs || [];
    let container = document.getElementById(prefix + '-status-bar');
    if (!container) {
      container = document.createElement('div');
      container.id = prefix + '-status-bar';
      container.className = 'battle-status-bar';
      const cardEl = document.querySelector(`#screen-battle .battle-${prefix}-section .battle-char-card`);
      if (cardEl) cardEl.appendChild(container);
    }

    if (statuses.length === 0 && domainCounters.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '4px';

    let html = '';
    // Render status_effects
    for (const se of statuses) {
      const type = se.type || 'buff';
      const borderColor = type === 'debuff' ? 'var(--color-danger, #ef4444)' : 'var(--color-gold, #eab308)';
      const bgColor = type === 'debuff' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)';
      const durText = se.duration > 0 ? Math.floor(se.duration) + 's' : '';
      const detail = se.description ? ` title="${escapeHtml(se.description)}"` : '';
      html += `<span class="battle-status-badge" data-status-id="${escapeHtml(se.id)}" data-status-type="${type}" style="border:2px solid ${borderColor};background:${bgColor};cursor:pointer;padding:2px 6px;border-radius:4px;font-size:0.75rem;display:inline-flex;align-items:center;gap:2px;"${detail}>
        <span class="status-icon">${escapeHtml(se.icon || (type === 'debuff' ? '✕' : '✦'))}</span>
        <span class="status-name status-collapsed">${escapeHtml(se.name)}</span>
        ${durText ? `<span class="status-dur">${durText}</span>` : ''}
      </span>`;
    }
    // Also render domain_counter_buffs not already in status_effects
    const statusIds = new Set(statuses.map(s => s.id));
    const mapped = { simple_domain: 'simple_domain_active', falling_blossom: 'falling_blossom_active', hollow_wicker: 'hollow_wicker_active' };
    for (const db of domainCounters) {
      const statusId = mapped[db.id];
      if (statusId && statusIds.has(statusId)) continue; // already shown via status_effects
      const isBuff = true;
      const borderColor = 'var(--color-gold, #eab308)';
      const bgColor = 'rgba(234,179,8,0.15)';
      const shieldText = db.current_shield_hp ? ` 护盾${db.current_shield_hp}` : '';
      html += `<span class="battle-status-badge" data-status-id="${escapeHtml(db.id)}" data-status-type="buff" style="border:2px solid ${borderColor};background:${bgColor};cursor:pointer;padding:2px 6px;border-radius:4px;font-size:0.75rem;display:inline-flex;align-items:center;gap:2px;" title="${escapeHtml(db.name + shieldText)}">
        <span class="status-icon">🛡️</span>
        <span class="status-name status-collapsed">${escapeHtml(db.name)}</span>
      </span>`;
    }
    container.innerHTML = html;
  }

  _toggleStatusBadge(badge) {
    if (!badge) return;
    // Toggle pin: click to permanently expand/collapse
    const isPinned = badge.classList.toggle('status-pinned');
    const nameSpan = badge.querySelector('.status-name');
    const descEl = badge.querySelector('.status-desc-inline');
    if (isPinned) {
      if (nameSpan) nameSpan.classList.add('status-expanded');
      // Show inline description
      const desc = badge.getAttribute('title') || '';
      if (desc && !descEl) {
        const descSpan = document.createElement('span');
        descSpan.className = 'status-desc-inline';
        descSpan.style.cssText = 'font-size:0.65rem;color:var(--color-text-dim, #888);margin-left:4px;max-width:150px;white-space:normal;';
        descSpan.textContent = desc;
        badge.appendChild(descSpan);
      }
    } else {
      if (nameSpan) nameSpan.classList.remove('status-expanded');
      if (descEl) descEl.remove();
    }
  }

  // ===== Phase 12: 反转术式 UI（技能按钮 + 消耗滑块弹窗）=====

  _renderItemPanel(s) {
    const body = document.getElementById('battle-items-body');
    if (!body) return;
    const playerData = s.player || (s.units || []).find(u => u.unit_type === 'player');
    if (!playerData) return;

    const st = this.uiManager.saveManager?.getState();
    const inventory = st?.inventory || {};

    // 战斗可用道具：烟雾弹、肾上腺素
    const battleItems = [
      { id: 'smokeBomb', name: '烟雾弹', desc: '必定逃跑成功' },
      { id: 'adrenalineShot', name: '肾上腺素', desc: '恢复 60 HP' }
    ];

    let html = '';
    for (const item of battleItems) {
      const owned = inventory[item.id] || 0;
      const canUse = owned > 0;
      html += `<button class="btn btn-primary battle-item-btn" data-action="use-item" data-item-id="${item.id}" ${canUse ? '' : 'disabled'}>
        ${item.name} (持有: ${owned}) — ${item.desc}
      </button>`;
    }
    body.innerHTML = html || '<span style="color:var(--color-text-dim);">没有可用的战斗道具。</span>';
  }

  _renderToolPanel(s) {
    const body = document.getElementById('battle-tools-body');
    if (!body) return;
    const st = this.uiManager.saveManager?.getState();
    const equipment = st?.equipment || {};

    // 检查已装备中的有 activeBuff 的咒具
    const toolsWithActive = [
      { id: 'playfulCloud', name: '游云', desc: '体术伤害 +体术×0.5，咒术 +咒力操控×0.5，持续80AV。ATB归零。' },
    ];

    let html = '';
    for (const tool of toolsWithActive) {
      const isEquipped = Object.values(equipment).includes(tool.id);
      if (!isEquipped) continue;
      const alreadyUsed = s.used_tool_active_skill;
      html += `<button class="btn btn-primary battle-tool-btn" data-action="use-tool-active" data-tool-id="${tool.id}" ${alreadyUsed ? 'disabled' : ''}>
        ${tool.name} — ${tool.desc} ${alreadyUsed ? '(已使用)' : ''}
      </button>`;
    }
    body.innerHTML = html || '<span style="color:var(--color-text-dim);">未装备具备主动技能的咒具。</span>';
  }

  _renderRCTButton(s) {
    // Create or get the RCT button container
    let container = document.getElementById('battle-rct-area');
    if (!container) {
      container = document.createElement('div');
      container.id = 'battle-rct-area';
      container.className = 'battle-rct-area';
      const skillsEl = document.getElementById('battle-skills');
      if (skillsEl && skillsEl.parentNode) {
        skillsEl.parentNode.insertBefore(container, skillsEl);
      }
    }

    const player = s.player || (s.units || []).find(u => u.unit_type === 'player');
    if (!player || !player.is_alive) {
      container.innerHTML = '';
      return;
    }

    // Check if player has unlocked RCT
    const saveState = this.uiManager.saveManager?.getState();
    const rctUnlocked = saveState && (saveState.advanced_skills_unlocked || []).includes('rct');
    if (!rctUnlocked) {
      container.innerHTML = '';
      return;
    }

    // Check for blocking debuffs
    const statuses = player.status_effects || [];
    const hasCooldown = statuses.some(se => se.id === 'rct_cooldown');
    const hasBurnout = statuses.some(se => se.id === 'domain_burnout');
    const hasCurseSeal = statuses.some(se => se.id === 'curse_seal');

    const blockedReason = hasBurnout ? '领域熔断中' : hasCurseSeal ? '咒力被封' : hasCooldown ? '冷却中' : '';
    const canUse = !blockedReason && player.mp > 0;

    container.innerHTML = `
      <button class="btn btn-rct-heal${canUse ? '' : ' cost-too-high'}" data-action="rct-dialog" ${canUse ? '' : 'disabled'}>
        💚 反转术式${blockedReason ? ' (' + blockedReason + ')' : ''}
        <span class="skill-cost">${canUse ? 'MP 1~' + player.mp : ''}</span>
      </button>
    `;
  }

  _showRCTDialog() {
    const s = this.currentState;
    const player = s.player || (s.units || []).find(u => u.unit_type === 'player');
    if (!player) return;

    const mpAvailable = player.mp;
    if (mpAvailable <= 0) return;

    // Get save state for efficiency preview
    const saveState = this.uiManager.saveManager?.getState();
    const cee = (saveState && saveState.attributes && saveState.attributes.cursedEnergyEfficiency) || player.cursed_energy_efficiency || 10;
    const efficiency = calculateRCTEfficiency(cee);

    const containerId = 'rct-dialog-' + Date.now();
    const html = `
      <div id="${containerId}" class="rct-dialog">
        <h4>💚 反转术式</h4>
        <p class="rct-efficiency">咒力效率: ${cee} → 回复倍率: ${efficiency.toFixed(3)}</p>
        <input type="range" id="${containerId}-slider" min="1" max="${mpAvailable}" value="${Math.floor(mpAvailable / 2)}" class="rct-slider">
        <div class="rct-values">
          <span>消耗: <strong id="${containerId}-cost">${Math.floor(mpAvailable / 2)}</strong> MP</span>
          <span>回复: <strong id="${containerId}-heal" style="color:#22c55e;">${Math.floor(Math.floor(mpAvailable / 2) * efficiency)}</strong> HP</span>
        </div>
        <p class="rct-preview" id="${containerId}-cap-warn"></p>
        <button class="btn btn-primary btn-rct-confirm" id="${containerId}-confirm">确认回复</button>
      </div>
    `;

    this.uiManager.showModal(html, { confirmOnly: false, useHTML: true });

    // Wire up slider and confirm button after DOM is rendered
    setTimeout(() => {
      const slider = document.getElementById(containerId + '-slider');
      const costEl = document.getElementById(containerId + '-cost');
      const healEl = document.getElementById(containerId + '-heal');
      const warnEl = document.getElementById(containerId + '-cap-warn');
      const confirmBtn = document.getElementById(containerId + '-confirm');

      if (!slider || !confirmBtn) return;

      const hpMax = player.max_hp;
      const hpCur = player.hp;
      const hpRoom = hpMax - hpCur;

      const updatePreview = (val) => {
        const consume = parseInt(val);
        const rawHeal = Math.floor(consume * efficiency);
        const actualHeal = Math.min(rawHeal, hpRoom);
        costEl.textContent = consume;
        healEl.textContent = actualHeal;
        if (rawHeal > hpRoom) {
          warnEl.textContent = `⚠️ 溢出 ${rawHeal - hpRoom} HP（当前 ${hpCur}/${hpMax}）`;
        } else {
          warnEl.textContent = '';
        }
      };

      slider.oninput = () => updatePreview(slider.value);
      updatePreview(slider.value);

      confirmBtn.onclick = () => {
        const consume = parseInt(slider.value);
        this.uiManager.hideModal();
        this._executeAction({
          type: 'rct_heal',
          actor: 'player',
          consume_amount: consume
        });
      };
    }, 100);
  }
}
