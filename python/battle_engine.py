# python/battle_engine.py — 战斗引擎（纯函数，无副作用）
# Phase 7: 帧级时间系统 — 每帧检查领域/敌人ATB中断

import json, random, math
from python.models import (
    Unit, Skill, BattleState, BattleTracker,
    ATB_MAX, ATB_MOVEMENT_COST, ATB_ACTION_COST,
    BLACK_FLASH_BASE_RATE, BLACK_FLASH_TALENT_RATE,
    DISTANCE_CLOSE, DISTANCE_NEAR, DISTANCE_MID, DISTANCE_FAR, DISTANCE_NAMES,
    PHASE_WAITING, PHASE_RECOVERY,
    UNIT_PLAYER, UNIT_ENEMY, UNIT_DOMAIN, UNIT_SHIKIGAMI,
    DOMAIN_BURNOUT_ATB_COST, DOMAIN_BURNOUT_SPEED_PENALTY
)

def _log(state: BattleState, msg: str):
    state.log.append(f"[{state.global_action_time} AV] {msg}")

def _capped(v, lo, hi): return max(lo, min(hi, v))
def _check_black_flash(actor, skill=None):
    """Phase 16: 黑闪仅 martial/cursed_martial 类别可触发"""
    if skill is not None and skill.category and skill.category not in ("martial", "cursed_martial"):
        return False
    return random.random() < (BLACK_FLASH_BASE_RATE + actor.talent * BLACK_FLASH_TALENT_RATE)

# ===== Phase 9: 仇恨机制 =====
def update_aggro(attacker, target, damage, action_type="damage"):
    """纯函数：更新目标对攻击者的仇恨值。
    - damage: 伤害/治疗量 = aggro * 1.0
    - heal: aggro * 0.5
    """
    mult = 0.5 if action_type == "heal" else 1.0
    delta = int(damage * mult)
    if delta > 0:
        target.aggro = (target.aggro or 0) + delta

# ===== Phase 10: 弱者防御手段（领域对抗 Buff）=====

# 领域对抗 Buff 配置
DOMAIN_COUNTER_BUFFS = {
    "simple_domain": {
        "id": "simple_domain",
        "name": "简易领域",
        "type": "domain_counter",
        "shield_hp": 200,              # 护盾 HP
        "negate_domain_special": True, # 抵消敌方领域特殊效果
        "domain_damage_reduction": 0.0,# 不减免，靠护盾扛
        "mp_drain_per_10av": 2,        # 每 10 AV 消耗 2 咒力
        "extra_mp_drain_on_hit": False # 受击不额外扣咒力
    },
    "falling_blossom": {
        "id": "falling_blossom",
        "name": "落花之情",
        "type": "domain_counter",
        "shield_hp": 0,                # 无护盾
        "negate_domain_special": True, # 抵消敌方领域特殊效果
        "domain_damage_reduction": 1.0,# 100% 免伤
        "mp_drain_per_10av": 5,        # 每 10 AV 消耗 5 咒力
        "extra_mp_drain_on_hit": True  # 受击按伤害量额外扣咒力
    },
    "hollow_wicker": {
        "id": "hollow_wicker",
        "name": "弥虚葛笼",
        "type": "domain_counter",
        "shield_hp": 0,
        "negate_domain_special": True,
        "domain_damage_reduction": 0.8,# 减少 80% 伤害
        "mp_drain_per_10av": 8,        # 每 10 AV 消耗 8 咒力（高消耗）
        "extra_mp_drain_on_hit": False
    }
}

def activate_domain_counter(unit, buff_id):
    """为指定 Unit 激活领域对抗 Buff。返回激活的 Buff 配置或 None。"""
    buff_cfg = DOMAIN_COUNTER_BUFFS.get(buff_id)
    if not buff_cfg:
        return None
    # 检查是否已有同类 Buff
    existing = [b for b in unit.domain_counter_buffs if b.get("id") == buff_id]
    if existing:
        return None  # 已有，不重复激活
    # 创建 Buff 实例
    buff_instance = dict(buff_cfg)  # 浅拷贝
    buff_instance["current_shield_hp"] = buff_cfg.get("shield_hp", 0)
    buff_instance["activated_at"] = 0  # 由调用方设置
    unit.domain_counter_buffs.append(buff_instance)
    return buff_instance

def has_domain_counter(unit):
    """检查 Unit 是否有任何激活的领域对抗 Buff"""
    return len(unit.domain_counter_buffs) > 0

# ===== Phase 12: Status Effects 系统 =====

def _tick_status_effects(state):
    """每帧推进所有单位 status_effects 的持续时间，移除已过期的"""
    for u in state.units:
        if not u.is_alive or not u.status_effects:
            continue
        surviving = []
        for se in u.status_effects:
            dur = se.get("duration", 0)
            if dur > 0:
                se["duration"] = max(0, dur - FRAME_STEP)
                if se["duration"] <= 0:
                    _log(state, f"{u.name} 的「{se.get('name','状态')}」效果消失了。")
                    # Phase 12: 当领域熔断 Debuff 过期时，恢复补偿速度
                    if se.get("id") == "domain_burnout":
                        u.recovery_speed = max(1, int(u.recovery_speed / (1.0 - DOMAIN_BURNOUT_SPEED_PENALTY)))
                    continue
            surviving.append(se)
        u.status_effects = surviving

def add_status_effect(unit, status_id, duration_override=None):
    """向 Unit 添加标准状态效果。若同 id 已存在则刷新持续时间（取更长者）"""
    STATUS_DEFS = {
        "domain_burnout": {
            "id": "domain_burnout", "name": "领域熔断", "type": "debuff",
            "duration": 60, "description": "禁用所有咒术技能，体术补偿速度 -30%。",
            "icon": "🔥",
            "effects": {"forbid_cursed_skills": True, "recovery_speed_penalty": 0.30}
        },
        "simple_domain_active": {
            "id": "simple_domain_active", "name": "简易领域", "type": "buff",
            "duration": 0, "description": "护盾中和敌方领域必中效果。每 10 AV 消耗咒力。",
            "icon": "🗡️",
            "effects": {"negate_domain_special": True, "shield_hp": 200, "mp_drain_per_10av": 2}
        },
        "falling_blossom_active": {
            "id": "falling_blossom_active", "name": "落花之情", "type": "buff",
            "duration": 0, "description": "以咒力将敌方领域必中效果打散，100% 免伤。每 10 AV 高消耗。",
            "icon": "🌸",
            "effects": {"negate_domain_special": True, "domain_damage_reduction": 1.0, "mp_drain_per_10av": 5}
        },
        "hollow_wicker_active": {
            "id": "hollow_wicker_active", "name": "弥虚葛笼", "type": "buff",
            "duration": 0, "description": "编织结界术防御空间，80% 减伤。每 10 AV 高消耗。",
            "icon": "🏺",
            "effects": {"negate_domain_special": True, "domain_damage_reduction": 0.8, "mp_drain_per_10av": 8}
        },
        # Phase 12: RCT related
        "rct_cooldown": {
            "id": "rct_cooldown", "name": "反转术式冷却", "type": "debuff",
            "duration": 60, "description": "反转术式使用后的咒力调整期，无法再次使用反转术式。",
            "icon": "💚",
            "effects": {"forbid_rct": True}
        },
        "rct_active": {
            "id": "rct_active", "name": "反转术式", "type": "buff",
            "duration": 0, "description": "反转术式已解锁，可在战斗中消耗咒力回复血量。",
            "icon": "💚",
            "effects": {"rct_unlocked": True}
        }
    }
    sd = STATUS_DEFS.get(status_id)
    if not sd:
        return False
    existing = [s for s in unit.status_effects if s.get("id") == status_id]
    if existing:
        dur = duration_override if duration_override is not None else sd.get("duration", 0)
        existing[0]["duration"] = max(existing[0].get("duration", 0), dur)
        return True
    se = dict(sd)  # shallow copy
    if duration_override is not None:
        se["duration"] = duration_override
    unit.status_effects.append(se)
    return True

def remove_status_effect(unit, status_id):
    """移除单位指定状态效果"""
    if not unit.status_effects:
        return False
    before = len(unit.status_effects)
    unit.status_effects = [s for s in unit.status_effects if s.get("id") != status_id]
    return len(unit.status_effects) < before

def has_status(unit, status_id):
    """检查单位是否拥有指定状态效果（且持续时间 > 0 或为永久）"""
    for s in (unit.status_effects or []):
        if s.get("id") == status_id and s.get("duration", 0) >= 0:
            return s
    return None

def _sync_domain_counter_to_status(unit):
    """Phase 12: 将 unit.domain_counter_buffs 映射为标准化 status_effects"""
    map_buff = {
        "simple_domain": "simple_domain_active",
        "falling_blossom": "falling_blossom_active",
        "hollow_wicker": "hollow_wicker_active",
    }
    active_ids = {b.get("id") for b in unit.domain_counter_buffs}
    for buff_id, status_id in map_buff.items():
        has_se = has_status(unit, status_id)
        if buff_id in active_ids:
            if not has_se:
                add_status_effect(unit, status_id)
        else:
            if has_se:
                remove_status_effect(unit, status_id)

def _tick_domain_counter_buffs(state):
    """每帧推进领域对抗 Buff 的咒力消耗（每 10 AV 扣一次）"""
    for u in state.units:
        if not u.is_alive or not u.domain_counter_buffs:
            continue
        expired = []
        for buf in u.domain_counter_buffs:
            # 每 10 AV 扣咒力
            drain_rate = buf.get("mp_drain_per_10av", 0)
            if drain_rate > 0 and state.global_action_time % 10 == 0:
                u.mp = max(0, u.mp - drain_rate)
                if u.mp <= 0:
                    expired.append(buf)
            # 护盾耗尽
            shield_current = buf.get("current_shield_hp", 0)
            if buf.get("shield_hp", 0) > 0 and shield_current <= 0:
                expired.append(buf)
        for buf in expired:
            u.domain_counter_buffs.remove(buf)
            _log(state, f"{u.name} 的「{buf['name']}」效果消失了。")
        # Phase 12: 同步 domain_counter_buffs 变更到 status_effects
        if expired:
            _sync_domain_counter_to_status(u)

def apply_domain_counter_to_damage(unit, raw_dmg):
    """对原始领域伤害应用领域对抗 Buff 的减免。
    返回值: (effective_dmg, absorbed_by_shield, extra_mp_cost)
    """
    if not unit.domain_counter_buffs:
        return (raw_dmg, 0, 0)

    remaining_dmg = raw_dmg
    absorbed = 0
    extra_mp = 0

    for buf in unit.domain_counter_buffs:
        # 减免
        reduction = buf.get("domain_damage_reduction", 0)
        if reduction > 0:
            reduced = int(remaining_dmg * reduction)
            remaining_dmg -= reduced
            absorbed += reduced
        # 护盾吸收
        shield = buf.get("current_shield_hp", 0)
        if shield > 0 and remaining_dmg > 0:
            absorbed_by_shield = min(shield, remaining_dmg)
            remaining_dmg -= absorbed_by_shield
            buf["current_shield_hp"] = shield - absorbed_by_shield
            absorbed += absorbed_by_shield
        # 受击额外扣咒力（落花之情）
        if buf.get("extra_mp_drain_on_hit"):
            extra_mp += raw_dmg  # 按原始伤害量扣咒力

    return (remaining_dmg, absorbed, extra_mp)

def _apply_shikigami_taunt_aggro(state):
    """被动仇恨修正：式神初始获得额外仇恨值，使敌人优先攻击式神而非主人。
    每次 _advance_time 推进时检查，给场上所有 shikigami 持续叠加微小的仇恨优势，
    确保敌方 AI 的 find_enemy_target 中 shikigami 排名高于 player。
    """
    player = state.find_player()
    if not player:
        return
    player_aggro = player.aggro or 0
    for u in state.units:
        if u.unit_type == UNIT_SHIKIGAMI and u.is_alive:
            # 式神仇恨至少比玩家高 20，确保敌人优先攻击式神
            target_min = player_aggro + 20
            if (u.aggro or 0) < target_min:
                u.aggro = target_min

# ===== 距离 =====
def calculate_move_cost(actor, frm, to):
    diff = abs(to - frm)
    return max(2, diff * 10 - actor.martial_arts // 5) if diff else 0

def _resolve_distance(actor, skill, target, state):
    cd = actor.distance; mn, mx = skill.min_distance, skill.max_distance
    if mn <= cd <= mx: return 0  # no move needed, return cost=0
    td = mn if cd < mn else mx
    cost = calculate_move_cost(actor, cd, td)
    if actor.atb < cost:
        _log(state, f"行动值不足！需要 {cost} ATB 进行位移（当前 {actor.atb}）。"); return -1
    actor.atb -= cost; actor.distance = td
    dir_txt = "后退" if cd < mn else "逼近"
    _log(state, f"{actor.name} 自动{dir_txt}至{DISTANCE_NAMES[td]}距离（消耗 {cost} ATB）。")
    return cost

# ===== 帧级时间推进 =====
FRAME_STEP = 1

def _advance_time(state: BattleState, frames: int):
    """推进 global_action_time 并逐帧检查领域/敌人/式神中断"""
    for _ in range(frames):
        state.global_action_time += FRAME_STEP
        # Phase 9: 推进召唤物持续时间
        _tick_summon_duration(state)
        # Phase 9: 式神仇恨优势（持续使敌人优先攻击式神而非主人）
        _apply_shikigami_taunt_aggro(state)
        # Phase 10: 领域对抗 Buff 咒力消耗
        _tick_domain_counter_buffs(state)
        # Phase 12: 推进所有单位的 status_effects 持续时间
        _tick_status_effects(state)
        # 1. 推进所有单位的 ATB
        for u in state.units:
            if u.is_alive:
                if u.unit_type == UNIT_DOMAIN:
                    u.atb = min(ATB_MAX, u.atb + u.attack_interval * 3)
                    if u.atb >= ATB_MAX:
                        _resolve_domain_auto_attack(u, state)
                        u.atb = 0
                elif u.unit_type in (UNIT_PLAYER, UNIT_ENEMY, UNIT_SHIKIGAMI):
                    u.atb = min(ATB_MAX, u.atb + u.speed)
        # Phase 9: 式神 ATB 满时自动行动
        _resolve_shikigami_turns(state)
        # Phase 9: ally NPC auto-action
        _resolve_ally_turns(state)
        # 2. 检查敌人是否满 ATB 且当前非敌回合
        e = state.find_enemy()
        if e and e.atb >= ATB_MAX and state.turn == "player" and e.is_alive:
            # Phase 9: 敌人回合前重新校准式神仇恨（确保优先攻击式神）
            _apply_shikigami_taunt_aggro(state)
            _resolve_enemy_turn(state)
            break  # 敌人回合结束后停止推进

def _check_battle_end(state: BattleState):
    """Fix 1: 统一伤亡检查 — 含式神死亡"""
    p = state.find_player(); e = state.find_enemy()
    if e and e.hp <= 0 and e.is_alive:
        e.is_alive = False; state.turn = "player_win"
        _log(state, f"{e.name} 被击败了！")
        e.status_effects = []  # Phase 12: 清除死亡单位的状态效果
        for u in list(state.units):
            if u.unit_type == UNIT_DOMAIN: _handle_cancel_domain({"domain_id": u.id}, state)
    if p and p.hp <= 0 and p.is_alive:
        p.is_alive = False; state.turn = "enemy_win"
        _log(state, f"{p.name} 倒下了…")
        p.status_effects = []  # Phase 12: 清除死亡单位的状态效果
        for u in list(state.units):
            if u.unit_type == UNIT_DOMAIN: _handle_cancel_domain({"domain_id": u.id}, state)
    # Phase 11: 检查式神死亡
    for u in list(state.units):
        if u.unit_type == UNIT_SHIKIGAMI and u.hp <= 0 and u.is_alive:
            u.is_alive = False
            u.status_effects = []  # Phase 12: 清除
            _log(state, f"{u.name} 被击败了，消失在影子中。")
            state.units = [x for x in state.units if x.id != u.id]

def _resolve_enemy_turn(state: BattleState):
    """敌人回合（中断或正常）— Phase 10: aggro-based target + 领域展开 AI"""
    enemy = state.find_enemy()
    if not enemy: return
    state.turn = "enemy"; _log(state, "—— 敌人回合 ——")
    # Phase 10: 敌人 AI 决策 — 含领域展开判断
    decision = _decide_enemy_action(enemy, state)
    if not decision: _log(state, f"{enemy.name} 无法行动！"); enemy.atb = 0; state.turn = "player"; _log(state, "—— 玩家回合 ——"); return

    # Phase 10: 如果敌人决定展开领域
    if decision == "expand_domain":
        domain_name = getattr(enemy, 'domain_name', '领域')
        domain_hp = getattr(enemy, 'domain_hp', 500)
        # 构建领域展开 action 并委托给 _handle_expand_domain
        fake_action = {
            "actor": enemy.id,
            "domain_id": f"{enemy.id}_domain",
            "domain_name": domain_name,
            "is_complete": True,
            "domain_hp": domain_hp,
            "attack_interval": 12,
            "attack_damage": max(30, enemy.cursed_energy * 3),
            "mp_cost": 5
        }
        _handle_expand_domain(fake_action, state)
        enemy.atb = 0
        _check_battle_end(state)
        if state.turn in ("enemy_win","player_win"): return
        state.turn = "player"; _log(state, "—— 玩家回合 ——")
        return

    es = decision
    # Phase 9: aggro-based target instead of hardcoded player
    target = state.find_enemy_target()
    if not target: target = state.find_player()
    if not target: enemy.atb = 0; state.turn = "player"; return
    _resolve_distance(enemy, es, target, state)
    is_bf = _check_black_flash(enemy); dmg = calculate_damage(enemy, es, target, is_bf)
    # Phase 8: 伤害偏移 ±20%
    dmg = apply_damage_variance(dmg, is_bf)
    cost = calculate_mp_cost(enemy, es)
    enemy.mp = max(0, enemy.mp - cost); enemy.atb = 0; target.hp = max(0, target.hp - dmg)
    # Phase 9: update aggro — target resents the enemy
    update_aggro(enemy, target, dmg, "damage")
    ct=es.cast_time; rv=es.base_recovery_speed
    _log(state, f"{enemy.name} 使用 {es.name}{'【黑闪！】' if is_bf else ''} → {target.name}，造成 {dmg} 点伤害。")
    _log(state, f"{enemy.name} 咏唱 {ct} 帧，补偿速度 {rv}，ATB 已清空。")
    if is_bf: _log(state, "漆黑的光芒一闪——那一击超越了极限。")
    state.last_hit_was_black_flash = is_bf
    _check_battle_end(state)
    if state.turn in ("enemy_win","player_win"): return
    state.turn = "player"; _log(state, "—— 玩家回合 ——")

# ===== 角色/技能构建 =====
def create_player_from_save(save_data):
    name = save_data.get("characterName", "无名咒术师"); attrs = save_data.get("attributes", {})
    con, ce = attrs.get("constitution",10), attrs.get("cursedEnergy",10)

    # Phase 14: 装备 activeBuff 注入
    EQUIPMENT_TOOLS = {
        "normalCursedBlade": {"statsBonus": {"martialArts": 5, "cursedEnergyControl": 2}},
        "ironBracers": {"statsBonus": {"constitution": 5}},
        "cursedRing": {"statsBonus": {"cursedEnergyEfficiency": 4, "cursedEnergy": 3}},
        "woodenTalisman": {"statsBonus": {"cursedEnergyControl": 3, "talent": 2}},
        "reinforcedBlade": {"statsBonus": {"martialArts": 10, "cursedEnergyControl": 4}},
        "dragonScaleBracer": {"statsBonus": {"constitution": 10, "cursedEnergy": 3}},
        "jadePendant": {"statsBonus": {"cursedEnergy": 6, "cursedEnergyControl": 5, "cursedEnergyEfficiency": 4}},
        "combatGloves": {"statsBonus": {"martialArts": 8, "talent": 4}},
        "spiritCharm": {"statsBonus": {"cursedEnergy": 8, "cursedEnergyEfficiency": 3}},
        # Phase 14: Tier 3 特效咒具
        "playfulCloud": {"statsBonus": {"martialArts": 15},
            "activeBuff": {"id": "playful_cloud_buff", "name": "游云·重击", "type": "buff",
                "duration": 1, "description": "下一次体术攻击倍率 +2.0，扣除 10% 当前 HP。",
                "icon": "☁️", "effects": {"nextMartialMultiplier": 2.0, "hpCostRatio": 0.1}}},
        "blackRope": {"statsBonus": {"constitution": 20, "cursedEnergyEfficiency": -10},
            "activeBuff": {"id": "black_rope_buff", "name": "黑绳·缚咒", "type": "buff",
                "duration": 0, "description": "体质 +20，咒力效率 -10%。",
                "icon": "🪢", "effects": {"constitutionBonus": 20, "cursedEnergyEfficiencyPenalty": -10}}},
    }

    # 读取装备加成用于 maxHp/maxMp
    equipment = save_data.get("equipment", {})
    equipment_bonus_con = 0
    equipment_bonus_ce = 0
    if equipment:
        for slot_id, tool_id in equipment.items():
            if tool_id and tool_id in EQUIPMENT_TOOLS:
                bonus = EQUIPMENT_TOOLS[tool_id].get("statsBonus", {})
                equipment_bonus_con += bonus.get("constitution", 0)
                equipment_bonus_ce += bonus.get("cursedEnergy", 0)

    effective_con = con + equipment_bonus_con
    effective_ce  = ce  + equipment_bonus_ce

    hp = save_data.get("hp",100) or 100; mhp = save_data.get("maxHp",100) or 100
    mp = save_data.get("mp",50) or 50; mmp = save_data.get("maxMp",50) or 50
    # Phase 13: 使用 effective_con/ce 重新计算 maxHp/maxMp（装备加成后的上限）
    # 这样可以保证装备体质/咒力对应的额外血量在战斗中生效
    if mhp <= 0 or True:  # 始终用 effective 属性重新计算
        mhp = max(30, 80 + effective_con * 2)
    if hp <= 0: hp = mhp
    if mmp <= 0 or True:  # 始终用 effective 属性重新计算
        mmp = max(30, 30 + effective_ce * 3)
    if mp <= 0: mp = mmp
    tid = save_data.get("techniqueId","cursedEnergyBoost"); spd = 8 + attrs.get("talent",10) // 3
    return Unit(id="player",name=name,unit_type=UNIT_PLAYER,hp=hp,max_hp=mhp,mp=mp,max_mp=mmp,
                atb=ATB_MAX,speed=spd,constitution=con,martial_arts=attrs.get("martialArts",10),
                cursed_energy=ce,cursed_energy_control=attrs.get("cursedEnergyControl",10),
                cursed_energy_efficiency=attrs.get("cursedEnergyEfficiency",10),talent=attrs.get("talent",10),
                skills=_build_player_skills(tid, save_data.get("skillLevels", {})),
                is_alive=True,distance=DISTANCE_MID,active_vow=None,recovery_speed=spd,
                status_effects=_build_equipment_buffs(save_data))

def _build_equipment_buffs(save_data):
    """Phase 14: 从装备中提取 activeBuff 并构建 status_effects"""
    buffs = []
    equipment = save_data.get("equipment", {})
    TOOLS = {
        "playfulCloud": {
            "id": "playful_cloud_buff", "name": "游云·重击", "type": "buff",
            "duration": 1, "description": "下一次体术攻击倍率 +2.0，扣除 10% 当前 HP。",
            "icon": "☁️", "effects": {"nextMartialMultiplier": 2.0, "hpCostRatio": 0.1}
        },
        "blackRope": {
            "id": "black_rope_buff", "name": "黑绳·缚咒", "type": "buff",
            "duration": 0, "description": "体质 +20，咒力效率 -10%。",
            "icon": "🪢", "effects": {"constitutionBonus": 20, "cursedEnergyEfficiencyPenalty": -10}
        }
    }
    for tool_id in equipment.values():
        if tool_id and tool_id in TOOLS:
            buffs.append(dict(TOOLS[tool_id]))
    return buffs

def _build_player_skills(tid, skill_levels=None):
    """Build skills based on unlocked skills in skillLevels. Only base + unlocked branch skills are included."""
    if skill_levels is None: skill_levels = {}
    B=[("attack","体术平A",0,"martial","martial",1.0,5,30,0,0,"基础体术"),("advance","逼近",0,"movement","",0.0,3,35,0,3,"逼近1档"),("retreat","后退",0,"movement","",0.0,3,35,0,3,"后退1档")]
    sk=[Skill(id=i,name=n,cost=c,type=t,category=cat,damage_multiplier=m,cast_time=ct,base_recovery_speed=r,min_distance=mn,max_distance=mx,description=d) for (i,n,c,t,cat,m,ct,r,mn,mx,d) in B]
    TS={"cursedEnergyBoost":[("cursed_boost","咒力强化拳",10,"cursed","cursed_martial",1.8,12,28,0,0,"以咒力强化拳击")],
        "limitless":[("aoi","苍",15,"cursed","cursed_attack",2.2,20,25,0,3,"空之涡"),("aka","赫",25,"cursed","cursed_attack",3.0,30,18,1,3,"排斥一切"),("aoi_strike","苍·打击",22,"cursed","cursed_attack",3.0,25,20,0,0,"近身苍"),("aoi_max","苍·最大出力",30,"cursed","cursed_attack",4.0,35,15,0,3,"极致苍"),("aka_max","赫·最大出力",40,"cursed","cursed_attack",4.5,40,12,1,3,"极致赫"),("murasaki","虚式·茈",50,"cursed","cursed_attack",6.0,45,10,0,3,"撕裂空间")],
        "tenShadows":[("gyokuken","玉犬",30,"summon","cursed_summon",0,25,20,0,3,"召唤黑白玉犬",
                    {"unitType":"shikigami","name":"玉犬","baseStats":{"hp":80,"max_hp":80,"mp":20,"max_mp":20,"speed":15,"constitution":12,"martialArts":25,"cursedEnergy":5,"cursedEnergyControl":5,"cursedEnergyEfficiency":5,"talent":8},"skills":[{"id":"shikigami_bite","name":"撕咬","type":"martial","damageMultiplier":1.5,"cost":0,"castTime":10,"baseRecoverySpeed":25,"minDistance":0,"maxDistance":0,"description":"用利齿撕咬目标"}],"duration":300}),
                   ("nue","鵺",35,"summon","cursed_summon",0,30,18,0,3,"召唤鵺",
                    {"unitType":"shikigami","name":"鵺","baseStats":{"hp":60,"max_hp":60,"mp":30,"max_mp":30,"speed":20,"constitution":8,"martialArts":20,"cursedEnergy":15,"cursedEnergyControl":12,"cursedEnergyEfficiency":10,"talent":12},"skills":[{"id":"shikigami_dive","name":"俯冲","type":"martial","damageMultiplier":2.0,"cost":0,"castTime":12,"baseRecoverySpeed":22,"minDistance":0,"maxDistance":3,"description":"从空中俯冲攻击"},{"id":"shikigami_shock","name":"电击","type":"cursed","damageMultiplier":1.8,"cost":10,"castTime":16,"baseRecoverySpeed":18,"minDistance":1,"maxDistance":3,"description":"释放雷电攻击远处目标"}],"duration":300}),
                   ("orochi","大蛇",30,"summon","cursed_summon",0,25,20,0,2,"召唤巨蛇",
                    {"unitType":"shikigami","name":"大蛇","baseStats":{"hp":100,"max_hp":100,"mp":15,"max_mp":15,"speed":10,"constitution":16,"martialArts":22,"cursedEnergy":8,"cursedEnergyControl":8,"cursedEnergyEfficiency":5,"talent":8},"skills":[{"id":"shikigami_constrict","name":"缠绕","type":"martial","damageMultiplier":1.5,"cost":0,"castTime":14,"baseRecoverySpeed":22,"minDistance":0,"maxDistance":1,"description":"缠绕目标造成持续伤害","dotDamage":8,"dotTurns":2}],"duration":350}),
                   ("max_elephant","满象",40,"summon","cursed_summon",0,35,15,0,2,"召唤满象",
                    {"unitType":"shikigami","name":"满象","baseStats":{"hp":150,"max_hp":150,"mp":10,"max_mp":10,"speed":8,"constitution":22,"martialArts":30,"cursedEnergy":5,"cursedEnergyControl":5,"cursedEnergyEfficiency":3,"talent":6},"skills":[{"id":"shikigami_crush","name":"碾压","type":"martial","damageMultiplier":2.5,"cost":0,"castTime":18,"baseRecoverySpeed":16,"minDistance":0,"maxDistance":2,"description":"以巨大身躯碾压目标，无视30%防御"}],"duration":300}),
                   ("tora_no_fun","虎葬",35,"summon","cursed_summon",0,25,18,0,3,"召唤虎形神",
                    {"unitType":"shikigami","name":"虎葬","baseStats":{"hp":70,"max_hp":70,"mp":20,"max_mp":20,"speed":25,"constitution":10,"martialArts":28,"cursedEnergy":10,"cursedEnergyControl":10,"cursedEnergyEfficiency":8,"talent":14},"skills":[{"id":"shikigami_rush","name":"突袭","type":"martial","damageMultiplier":2.2,"cost":0,"castTime":8,"baseRecoverySpeed":26,"minDistance":0,"maxDistance":3,"description":"闪电突袭目标，先制攻击"}],"duration":250}),
                   ("makora","魔虚罗",60,"cursed","cursed_summon",8.0,60,5,0,3,"终极式神")],
        "bloodManipulation":[("blood_blade","血刃",8,"cursed","cursed_martial",1.4,12,28,0,1,"血液利刃"),("slicing_exorcism","血涂",14,"cursed","cursed_attack",1.8,16,24,0,1,"切割线"),("piercing_blood","穿血",14,"cursed","cursed_attack",2.0,16,24,0,3,"高压血箭"),("supernova","超新星",22,"cursed","cursed_attack",3.0,22,18,0,3,"凝固血液"),("crimson_binding","赤鳞跃动",20,"cursed","cursed_buff",2.2,18,22,0,0,"强化身体"),("canal","运河",16,"cursed","cursed_control",2.0,20,20,0,3,"血液轨迹")],
        "boogieWoogie":[("clap_swap","拍手换位",6,"cursed","cursed_control",1.2,8,32,0,3,"交换位置"),("tactical_combo","战术连携",12,"cursed","cursed_martial",2.0,12,28,0,0,"连续攻击")],
        "overtime":[("weakness","基础弱点",8,"cursed","cursed_martial",1.3,10,30,0,1,"7:3弱点"),("ratio_strike","咒力钝器·七三",14,"cursed","cursed_martial",2.0,15,25,0,0,"精准打击"),("collapse","瓦解",18,"cursed","cursed_martial",2.5,20,20,0,0,"削弱防御"),("overtime","极之番·加班",25,"cursed","cursed_buff",3.5,25,18,0,1,"加班模式")],
        "curseManipulation":[("curse_absorb","基础吞噬",10,"cursed","cursed_martial",1.2,12,28,0,1,"吞噬咒灵"),("curse_sphere","咒灵玉储存",20,"cursed","cursed_attack",2.5,22,20,0,3,"释放咒力"),("uzumaki_pseudo","极之番·伪",35,"cursed","cursed_attack",4.0,30,14,0,3,"全部释放")],
        "strawDoll":[("doll_basic","基础操控",10,"cursed","cursed_attack",1.5,14,26,0,1,"人偶攻击"),("doll_scout","远程侦查",12,"cursed","cursed_control",1.6,16,24,1,3,"远程侦查"),("doll_resonance","共鸣",13,"cursed","cursed_attack",1.9,18,22,0,3,"远程冲击"),("doll_overload","傀儡自爆",30,"cursed","cursed_attack",5.0,30,10,1,1,"引爆傀儡")],
        "pureMartial":[("martial_combo","体术连击",0,"martial","martial",1.2,8,30,0,0,"高速连击"),("black_flash_boost","黑闪强化",0,"martial","martial",1.5,6,32,0,0,"提升黑闪"),("rush_strike","疾风突袭",0,"martial","martial",2.0,10,26,0,1,"速度突袭")]}
    for e in TS.get(tid, TS.get("cursedEnergyBoost",[])):
        skill_id = e[0]
        branch_skills = {"aoi_strike","aoi_max","aka_max","murasaki","nue","orochi","max_elephant","tora_no_fun","makora",
                         "slicing_exorcism","supernova","crimson_binding","canal",
                         "tactical_combo","ratio_strike","collapse","overtime",
                         "curse_sphere","uzumaki_pseudo","doll_scout","doll_overload",
                         "black_flash_boost","rush_strike"}
        if skill_id in branch_skills and skill_levels.get(skill_id, 0) < 1:
            continue
        # Phase 9: handle optional summon_config (11th element)
        sc = e[10] if len(e) > 10 else None
        sk.append(Skill(id=e[0],name=e[1],cost=e[2],type=e[3],damage_multiplier=e[4],cast_time=e[5],base_recovery_speed=e[6],min_distance=e[7],max_distance=e[8],description=e[9],summon_config=sc))
    return sk

def create_default_enemy(tier="normal"):
    """Phase 8: 根据玩家评定动态生成中低级咒灵"""
    return Unit(id="enemy_1",name="蛸头",unit_type=UNIT_ENEMY,hp=80,max_hp=80,mp=20,max_mp=20,atb=0,speed=7,constitution=10,martial_arts=12,cursed_energy=8,cursed_energy_control=8,cursed_energy_efficiency=6,talent=5,
                skills=[Skill(id="enemy_attack",name="撞击",cost=0,type="martial",damage_multiplier=1.0,cast_time=8,base_recovery_speed=28,min_distance=0,max_distance=0,description="身体撞击"),
                        Skill(id="enemy_cursed_blast",name="诅咒弹",cost=8,type="cursed",damage_multiplier=1.3,cast_time=18,base_recovery_speed=22,min_distance=1,max_distance=3,description="诅咒能量弹")],
                is_alive=True,distance=DISTANCE_MID,active_vow=None,recovery_speed=7)

def create_enemy_from_save(save_data):
    """Phase 10: 根据玩家评定等级动态选择敌人（含高阶咒灵 boss 池）"""
    player_rank = save_data.get("rank", "四级")
    RANK_ORDER = ["不入流", "四级", "准三级", "三级", "准二级", "二级", "准一级", "一级", "准特级", "特级", "现代最强"]
    player_idx = RANK_ORDER.index(player_rank) if player_rank in RANK_ORDER else 1

    # 敌人池（与 JS enemies.js 同步）
    ENEMY_POOL = [
        # normal: rank 0~5
        {"id":"enemy_flyhead","name":"蛸头","rank":"不入流","tier":"normal","hp":50,"mp":0,"speed":7,"con":6,"ma":8,"ce":0,"cec":0,"cee":0,"tal":3,"skills":[("enemy_bite","撕咬",0,"martial",1.0,8,28,0,0)]},
        {"id":"enemy_cursed_doll","name":"咒骸","rank":"四级","tier":"normal","hp":80,"mp":15,"speed":8,"con":10,"ma":12,"ce":6,"cec":5,"cee":5,"tal":5,"skills":[("enemy_punch","重拳",0,"martial",1.0,8,28,0,0),("enemy_cursed_bolt","诅咒弹",6,"cursed",1.3,16,22,1,3)]},
        {"id":"enemy_centipede","name":"百足咒灵","rank":"准三级","tier":"normal","hp":100,"mp":20,"speed":9,"con":12,"ma":14,"ce":8,"cec":8,"cee":6,"tal":8,"skills":[("enemy_swipe","横扫",0,"martial",1.0,6,30,0,1),("enemy_poison_spit","毒液喷射",8,"cursed",1.5,18,20,1,3)]},
        {"id":"enemy_shadow_beast","name":"影兽","rank":"三级","tier":"normal","hp":130,"mp":30,"speed":10,"con":14,"ma":16,"ce":10,"cec":10,"cee":8,"tal":10,"skills":[("enemy_claw","影爪",0,"martial",1.2,5,30,0,0),("enemy_shadow_bolt","暗影弹",12,"cursed",1.8,20,18,0,3)]},
        {"id":"enemy_blood_ghost","name":"血涂灵","rank":"准二级","tier":"normal","hp":160,"mp":40,"speed":11,"con":16,"ma":18,"ce":12,"cec":12,"cee":10,"tal":12,"skills":[("enemy_blood_strike","血击",0,"martial",1.1,6,28,0,1),("enemy_blood_spear","血矛",15,"cursed",2.0,22,16,0,3)]},
        {"id":"enemy_iron_curse","name":"铁甲咒灵","rank":"二级","tier":"normal","hp":200,"mp":50,"speed":12,"con":20,"ma":20,"ce":14,"cec":14,"cee":12,"tal":14,"skills":[("enemy_iron_fist","铁拳",0,"martial",1.3,7,26,0,0),("enemy_iron_cannon","铁甲炮",20,"cursed",2.2,25,14,0,3)]},
        # Phase 11: 新增三级到一级普通咒灵
        {"id":"enemy_kuchisake","name":"裂口女","rank":"二级","tier":"normal","hp":220,"mp":40,"speed":13,"con":18,"ma":22,"ce":16,"cec":14,"cee":12,"tal":15,"skills":[("enemy_scissor_slash","剪刀斩",0,"martial",1.5,6,28,0,0),("enemy_kuchisake_question","裂口质问",15,"cursed",2.0,18,20,0,2)]},
        {"id":"enemy_hanako","name":"花子","rank":"二级","tier":"normal","hp":190,"mp":60,"speed":15,"con":16,"ma":18,"ce":20,"cec":18,"cee":14,"tal":16,"skills":[("enemy_toilet_curse","厕所诅咒",0,"martial",1.2,8,26,0,1),("enemy_water_blade","水刃",18,"cursed",2.2,20,18,1,3)]},
        {"id":"enemy_rokurokubi","name":"辘轳首","rank":"准一级","tier":"normal","hp":260,"mp":70,"speed":14,"con":20,"ma":24,"ce":20,"cec":18,"cee":14,"tal":17,"skills":[("enemy_neck_whip","长颈鞭",0,"martial",1.4,7,28,0,2),("enemy_gaze_curse","凝视诅咒",20,"cursed",2.5,22,16,1,3)]},
        {"id":"enemy_jorogumo","name":"络新妇","rank":"准一级","tier":"normal","hp":240,"mp":80,"speed":16,"con":18,"ma":22,"ce":22,"cec":20,"cee":16,"tal":18,"skills":[("enemy_web_trap","蛛网陷阱",0,"martial",1.3,8,26,0,2),("enemy_venom_string","毒丝",22,"cursed",2.8,24,14,0,3)]},
        {"id":"enemy_ubume","name":"姑获鸟","rank":"一级","tier":"normal","hp":300,"mp":90,"speed":17,"con":22,"ma":26,"ce":24,"cec":22,"cee":18,"tal":20,"skills":[("enemy_bird_talon","利爪",0,"martial",1.6,6,28,0,1),("enemy_screech","啼鸣诅咒",25,"cursed",3.0,26,14,0,3)]},
        {"id":"enemy_nurarihyon","name":"滑瓢","rank":"一级","tier":"normal","hp":320,"mp":85,"speed":16,"con":24,"ma":28,"ce":22,"cec":24,"cee":20,"tal":19,"skills":[("enemy_sneak_strike","潜行一击",0,"martial",1.7,7,28,0,0),("enemy_dark_mist","黑雾侵蚀",28,"cursed",3.2,28,12,0,3)]},
        {"id":"enemy_gyuki","name":"牛鬼","rank":"一级","tier":"normal","hp":350,"mp":70,"speed":13,"con":28,"ma":30,"ce":20,"cec":20,"cee":16,"tal":17,"skills":[("enemy_horn_charge","牛角冲撞",0,"martial",1.8,10,24,0,2),("enemy_breath_fire","鬼火吐息",30,"cursed",3.5,30,10,0,3)]},
        {"id":"enemy_gashadokuro","name":"饿者骷髅","rank":"一级","tier":"normal","hp":380,"mp":100,"speed":11,"con":30,"ma":26,"ce":26,"cec":22,"cee":18,"tal":18,"skills":[("enemy_bone_crush","骨碎",0,"martial",1.9,12,22,0,1),("enemy_grave_wind","墓场阴风",35,"cursed",3.8,32,10,0,3)]},
        # elite: rank 6~7
        {"id":"enemy_cursed_womb","name":"咒胎","rank":"准一级","tier":"elite","hp":300,"mp":80,"speed":14,"con":22,"ma":24,"ce":18,"cec":18,"cee":14,"tal":16,"skills":[("enemy_womb_slam","重压",0,"martial",1.5,10,24,0,1),("enemy_womb_beam","咒胎光束",20,"cursed",2.5,28,14,0,3),("enemy_womb_roar","咒胎咆哮",15,"cursed",2.0,22,16,1,2)]},
        {"id":"enemy_vengeful_spirit","name":"怨灵","rank":"一级","tier":"elite","hp":400,"mp":100,"speed":16,"con":25,"ma":26,"ce":22,"cec":22,"cee":16,"tal":18,"skills":[("enemy_vengeful_strike","怨念击",0,"martial",1.6,8,24,0,0),("enemy_vengeful_blast","怨念爆破",25,"cursed",3.0,30,12,0,3),("enemy_vengeful_curse","深层诅咒",18,"cursed",2.2,24,14,0,2)]},
    ]
    # 高阶 boss 池（与 JS enemies.js 中 boss tier 同步）
    BOSS_POOL = [
        {"id":"enemy_special_grade","name":"特级咒灵","rank":"准特级","tier":"boss","hp":600,"mp":200,"speed":18,"con":30,"ma":32,"ce":28,"cec":28,"cee":20,"tal":22,
         "skills":[("boss_domain_fist","领域之拳",0,"martial",2.0,12,22,0,1),("boss_cursed_beam","咒力光束",30,"cursed",3.5,30,12,0,3),("boss_catastrophe","灾厄降临",50,"cursed",4.5,40,8,0,3)]},
        # Phase 10: 具名高阶咒灵
        {"id":"boss_jogo","name":"漏瑚","rank":"特级","tier":"boss","hp":700,"mp":250,"speed":20,"con":28,"ma":30,"ce":32,"cec":30,"cee":22,"tal":25,
         "skills":[("boss_jogo_volcano","火山弹",25,"cursed",4.5,24,14,0,3),("boss_jogo_fire_eruption","火炎柱",30,"cursed",5.0,28,12,0,2),("boss_jogo_insect","火虫",18,"cursed",3.0,16,18,1,2),("boss_jogo_meteor","极之番·陨",60,"cursed",8.0,50,6,0,3),("boss_jogo_ember_slash","灼烧击",0,"martial",1.8,8,24,0,0)],
         "domain_name":"盖棺铁围山", "domain_hp":800},
        {"id":"boss_mahito","name":"真人","rank":"特级","tier":"boss","hp":650,"mp":280,"speed":22,"con":24,"ma":32,"ce":30,"cec":28,"cee":24,"tal":28,
         "skills":[("boss_mahito_touch","无为转变",30,"cursed",3.5,22,16,0,0),("boss_mahito_morph","肉体变形",15,"cursed",2.5,15,22,0,1),("boss_mahito_dolls","改造人偶",25,"cursed",2.8,20,18,0,3)],
         "domain_name":"自闭圆顿裹", "domain_hp":700},
        {"id":"boss_dagon","name":"陀艮","rank":"准特级","tier":"boss","hp":550,"mp":200,"speed":16,"con":25,"ma":26,"ce":26,"cec":24,"cee":20,"tal":22,
         "skills":[("boss_dagon_water","水流弹",20,"cursed",3.0,18,20,0,3),("boss_dagon_shikigami","鱼形式神",30,"cursed",3.5,24,16,0,3),("boss_dagon_swarm","鱼群吞噬",40,"cursed",4.0,30,12,0,2)],
         "domain_name":"荡蕴平线", "domain_hp":600},
        {"id":"boss_sukuna_3f","name":"两面宿傩（三指）","rank":"特级","tier":"boss","hp":900,"mp":300,"speed":25,"con":35,"ma":38,"ce":36,"cec":35,"cee":30,"tal":35,
         "skills":[("boss_sukuna_cleave","解",15,"cursed",4.0,12,22,0,1),("boss_sukuna_dismantle","捌",20,"cursed",4.5,15,20,0,3),("boss_sukuna_cleave_net","解·网",35,"cursed",5.5,22,14,0,2),("boss_sukuna_slash","袈裟斩",0,"martial",3.0,8,26,0,0)],
         "domain_name":"伏魔御厨子", "domain_hp":1000},
        {"id":"boss_choso","name":"胀相","rank":"准特级","tier":"boss","hp":500,"mp":220,"speed":18,"con":22,"ma":28,"ce":24,"cec":22,"cee":18,"tal":20,
         "skills":[("boss_choso_convergence","百敛·穿血",35,"cursed",5.0,25,14,0,3),("boss_choso_slicing","血星弹",15,"cursed",2.2,12,22,1,3),("piercing_blood","穿血",14,"cursed",2.4,15,25,0,3),("blood_blade","血刃",8,"cursed",2.0,10,30,0,1)],
         "domain_name":"九血之狱（未完成）", "domain_hp":500},
    ]

    roll = random.random()
    if roll < 0.60:
        # 60%: ±1级 (normal)
        candidates = [e for e in ENEMY_POOL if abs(RANK_ORDER.index(e["rank"]) - player_idx) <= 1]
    elif roll < 0.80:
        # 20%: 精英
        elite_candidates = [e for e in ENEMY_POOL if e["tier"] == "elite" and RANK_ORDER.index(e["rank"]) - player_idx in (1,2)]
        candidates = elite_candidates if elite_candidates else ENEMY_POOL
    elif roll < 0.95:
        # 15%: boss (准特级以上)
        boss_candidates = [e for e in BOSS_POOL if RANK_ORDER.index(e["rank"]) - player_idx >= 2]
        candidates = boss_candidates if boss_candidates else BOSS_POOL
    else:
        # 5%: 低2级以上
        candidates = [e for e in ENEMY_POOL if player_idx - RANK_ORDER.index(e["rank"]) >= 2]

    if not candidates:
        candidates = ENEMY_POOL

    # 从候选中随机抽取一只
    chosen = candidates[random.randint(0, len(candidates)-1)]

    # 构建 Unit
    sk_list = []
    for sk in chosen["skills"]:
        sk_list.append(Skill(id=sk[0],name=sk[1],cost=sk[2],type=sk[3],damage_multiplier=sk[4],cast_time=sk[5],base_recovery_speed=sk[6],min_distance=sk[7],max_distance=sk[8]))
    if not sk_list:
        sk_list = [Skill(id="enemy_attack",name="撞击",cost=0,type="martial",damage_multiplier=1.0,cast_time=8,base_recovery_speed=28,min_distance=0,max_distance=0)]

    return Unit(
        id="enemy_1", name=chosen["name"], unit_type=UNIT_ENEMY,
        hp=chosen["hp"], max_hp=chosen["hp"],
        mp=chosen["mp"], max_mp=chosen["mp"],
        atb=0, speed=chosen["speed"],
        constitution=chosen["con"], martial_arts=chosen["ma"],
        cursed_energy=chosen["ce"], cursed_energy_control=chosen["cec"],
        cursed_energy_efficiency=chosen["cee"], talent=chosen["tal"],
        skills=sk_list,
        is_alive=True, distance=DISTANCE_MID, active_vow=None,
        recovery_speed=chosen["speed"],
        domain_name=chosen.get("domain_name"),  # Phase 10: 领域展开 AI 使用
        domain_hp=chosen.get("domain_hp", 500)  # Phase 10: 领域 HP
    )

# ===== 伤害 =====
def calculate_damage(actor, skill, target, is_bf=False):
    ba = actor.martial_arts * 2; sb = skill.damage_multiplier * 10
    ed = target.constitution * 0.5
    if is_bf: ed *= 0.5
    dmg = max(1, int(ba + sb - ed))
    if is_bf: dmg = max(1, int(dmg * 2.5))
    cb = 1.0 + min(0.5, actor.cursed_energy_control * 0.01)
    return max(1, int(dmg * cb))

def apply_damage_variance(dmg, is_bf=False):
    """Phase 8: 伤害偏移 ±20%. 黑闪保底不低于基础伤害的2.0倍"""
    varied = max(1, int(dmg * (0.8 + random.random() * 0.4)))
    if is_bf: varied = max(int(dmg * 0.8 * 2.0), varied)  # 保底
    return varied

def _decide_enemy_action(enemy, state):
    """Phase 10: 敌人 AI — 含领域展开判断 + 70%概率使用咒术技能"""
    available = [s for s in enemy.skills if s.type in ("martial","cursed") and enemy.mp >= s.cost]
    if not available: return None

    # Phase 10: 领域展开判断（HP健康 + MP充足 + 有domain_name配置 + 尚未展开领域）
    domain_name = getattr(enemy, 'domain_name', None)
    has_existing_domain = any(u.unit_type == UNIT_DOMAIN and u.owner == enemy.id for u in state.units)
    if domain_name and not has_existing_domain:
        # Phase 10.5: 若玩家已展开领域，敌人下次行动必展开
        player_domain = _get_player_domain(state, "player")
        if player_domain:
            return "expand_domain"
        hp_ratio = enemy.hp / max(1, enemy.max_hp)
        mp_ratio = enemy.mp / max(1, enemy.max_mp)
        # 高阶敌人(HP>500)在HP>60%+MP>50%时有25%概率展开领域
        if enemy.max_hp >= 500 and hp_ratio > 0.6 and mp_ratio > 0.5 and random.random() < 0.25:
            return "expand_domain"
        # 普通敌人在HP>40%+MP>40%时有8%概率展开领域
        elif hp_ratio > 0.4 and mp_ratio > 0.4 and random.random() < 0.08:
            return "expand_domain"

    cursed = [s for s in available if s.type == "cursed"]
    if cursed and random.random() < 0.7:
        cursed.sort(key=lambda s: -s.damage_multiplier)
        return cursed[0]
    martial = [s for s in available if s.type == "martial"]
    return martial[0] if martial else (available[0] if available else None)

def calculate_mp_cost(actor, skill):
    if skill.cost <= 0: return 0
    return max(0, int(skill.cost * max(0.3, 1.0 - actor.cursed_energy_efficiency * 0.005)))

# ===== Phase 12: 反转术式 (Reverse Cursed Technique) =====

def calculate_rct_efficiency(cursed_energy_efficiency):
    """计算反转术式回复效率（分段线性函数，严格连续无跳变）
    - cee < 20:  固定 0.5
    - 20 <= cee <= 40: 0.5 + (cee - 20) * 0.01   (线性上升至 0.7)
    - 40 < cee <= 60:  0.7 + (cee - 40) * 0.015  (线性上升至 1.0)
    - cee > 60:  1.0 + (cee - 60) * 0.02
    边界验证:
      cee=19 -> 0.5; cee=20 -> 0.5 (第二段代入: 0.5+(20-20)*0.01=0.5) ✓连续
      cee=40 -> 0.7 (第二段: 0.5+(40-20)*0.01=0.7; 第三段: 0.7+(40-40)*0.015=0.7) ✓连续
      cee=60 -> 1.0 (第三段: 0.7+(60-40)*0.015=1.0; 第四段: 1.0+(60-60)*0.02=1.0) ✓连续
    """
    if cursed_energy_efficiency < 20:
        return 0.5
    if cursed_energy_efficiency <= 40:
        return 0.5 + (cursed_energy_efficiency - 20) * 0.01
    if cursed_energy_efficiency <= 60:
        return 0.7 + (cursed_energy_efficiency - 40) * 0.015
    return 1.0 + (cursed_energy_efficiency - 60) * 0.02

def execute_rct(unit, consume_amount):
    """执行反转术式回复。
    参数:
      unit: 施术者 Unit
      consume_amount: 消耗的咒力量（1 ~ unit.mp）
    返回:
      (heal_amount, consume_amount, log_text) 三元组
    """
    if consume_amount <= 0 or consume_amount > unit.mp:
        return (0, 0, "无效的咒力消耗量。")
    efficiency = calculate_rct_efficiency(unit.cursed_energy_efficiency)
    heal_amount = int(consume_amount * efficiency)
    unit.mp -= consume_amount
    actual_heal = min(heal_amount, unit.max_hp - unit.hp)
    unit.hp += actual_heal
    return (actual_heal, consume_amount,
            f"{unit.name} 使用了反转术式，消耗 {consume_amount} 咒力，回复了 {actual_heal} HP（效率 {efficiency:.3f}）。")

# ===== 行动执行 =====
def execute_action(action_json, state_json):
    action = json.loads(action_json); state_dict = json.loads(state_json)
    state = _deserialize_state(state_dict)
    td = state_dict.get("_tracker", {}); tracker = BattleTracker()
    tracker.skill_usage = td.get("skill_usage", {})
    tracker.money_reward = td.get("money_reward", 0)
    tracker.skill_points_reward = td.get("skill_points_reward", 0)
    tracker.inspiration_gained = td.get("inspiration_gained", False)
    at = action.get("type","")
    if at == "use_skill": _handle_use_skill(action, state, tracker)
    elif at == "tick": _advance_time(state, 1)
    elif at == "apply_vow": _handle_apply_vow(action, state)
    elif at == "expand_domain": _handle_expand_domain(action, state)
    elif at == "cancel_domain": _handle_cancel_domain(action, state)
    # Phase 9: shikigami manual control
    elif at == "shikigami_skill": _handle_shikigami_skill(action, state, tracker)
    # Phase 9: add ally NPC to battle
    elif at == "add_ally": _handle_add_ally(action, state)
    # Phase 10: activate domain counter buff (simple domain / falling blossom / hollow wicker)
    elif at == "activate_domain_counter": _handle_activate_domain_counter(action, state)
    # Phase 10.5: repair domain barrier
    elif at == "repair_domain": _handle_repair_domain(action, state)
    # Phase 12: reverse cursed technique heal
    elif at == "rct_heal": _handle_rct_heal(action, state)
    result = state.to_dict(); result["_tracker"] = tracker.to_dict()
    return json.dumps(result, ensure_ascii=False)

def _handle_use_skill(action, state, tracker=None):
    aid = action.get("actor","player"); sid = action.get("skill_id","attack")
    e = state.find_enemy(); tid = action.get("target", e.id if e else "enemy_1")
    actor = state.get_actor(aid); target = state.get_target(tid)
    if not actor or not target: _log(state, "[ERROR] 无效的行动者或目标。"); return
    if actor.atb < ATB_MAX and state.turn == "player":
        _advance_time(state, 1)
        _log(state, f"{actor.name} 的 ATB 恢复中（{actor.atb}/{ATB_MAX}）…"); return
    skill = None
    for s in actor.skills:
        if s.id == sid: skill = s; break
    if not skill: _log(state, f"[ERROR] 未找到技能: {sid}"); return
    if actor.mp < skill.cost and skill.type in ("cursed","summon"):
        _log(state, f"咒力不足！需要 {skill.cost} MP，当前 {actor.mp} MP。"); return
    if tracker: tracker.record_skill_use(sid)
    # Phase 9: summon skill
    if skill.type == "summon":
        _execute_summon(actor, skill, state)
    elif skill.type == "movement": _execute_movement(actor, skill, state)
    elif skill.type in ("martial","cursed"):
        _execute_attack_framed(actor, skill, target, state)
    enemy = state.find_enemy()
    if enemy and enemy.hp <= 0: enemy.is_alive = False; state.turn = "player_win"; _log(state, f"{enemy.name} 被击败了！")

def _execute_attack_framed(actor, skill, target, state):
    """帧级攻击流程：距离移动 → 咏唱（中断点1）→ 伤害结算→ 补偿恢复（中断点2）"""
    # Step 1: 距离移动
    move_cost = _resolve_distance(actor, skill, target, state)
    if move_cost < 0: return  # ATB 不足
    if move_cost > 0:
        _advance_time(state, move_cost)
    # Step 2: 咏唱阶段（逐帧推进，允许中断）
    ct = skill.cast_time
    _log(state, f"{actor.name} 开始咏唱 {skill.name}（{ct} 帧）…")
    _advance_time(state, ct)
    # Step 3: 伤害结算
    is_bf = False
    if skill.category in ("martial", "cursed_martial"):
        is_bf = _check_black_flash(actor, skill)
    dmg = calculate_damage(actor, skill, target, is_bf)
    dmg = apply_damage_variance(dmg, is_bf)  # Phase 8: 伤害偏移
    cost = calculate_mp_cost(actor, skill)
    actor.mp = max(0, actor.mp - cost); target.hp = max(0, target.hp - dmg)
    # Phase 9: aggro — enemy resents attacker
    update_aggro(actor, target, dmg, "damage")
    actor.atb = 0
    bf_text = "【黑闪！】" if is_bf else ""
    cost_text = f"（消耗 {cost} MP）" if cost > 0 else ""
    bf_detail = " 无视 50% 防御！" if is_bf else ""
    _log(state, f"{actor.name} 使用 {skill.name}{cost_text}{bf_text}，造成 {dmg} 点伤害。{bf_detail}")
    if is_bf: _log(state, "漆黑的光芒一闪——那一击超越了极限。")
    state.last_hit_was_black_flash = is_bf
    _check_battle_end(state)
    if state.turn in ("player_win","enemy_win"): return
    _check_battle_end(state)
    if target.hp <= 0: return
    # Step 4: 补偿恢复阶段（逐帧推进，允许中断）
    rec = actor.recovery_speed
    base_spd = actor.speed
    if base_spd > 0 and actor.recovery_speed != base_spd:
        actor.recovery_speed = max(1, int(skill.base_recovery_speed * actor.recovery_speed / base_spd))
    else:
        actor.recovery_speed = max(1, skill.base_recovery_speed)
    recovery_frames = math.ceil(300 / actor.recovery_speed) + math.ceil(300 / actor.speed)
    _log(state, f"{actor.name} 进入补偿恢复（{recovery_frames} 帧，补偿速度 {actor.recovery_speed}）…")
    _advance_time(state, recovery_frames)
    actor.atb = min(ATB_MAX, actor.atb + actor.recovery_speed * recovery_frames)
    _check_battle_end(state)

def _execute_movement(actor, skill, state):
    cur = actor.distance
    nd = max(0, cur - 1) if "advance" in skill.id else min(3, cur + 1)
    if nd == cur: _log(state, f"{actor.name} 已经处于边界，无法继续移动。"); return
    cost = calculate_move_cost(actor, cur, nd)
    if actor.atb < cost: _log(state, f"行动值不足！需要 {cost} ATB（当前 {actor.atb}）。"); return
    actor.atb -= cost; actor.distance = nd
    dir_txt = "逼近" if nd < cur else "后退"
    _log(state, f"{actor.name} {dir_txt}至{DISTANCE_NAMES[nd]}距离（消耗 {cost} ATB）。")

# ===== Phase 9: 召唤系统 =====

def _execute_summon(summoner, skill, state):
    """执行召唤 — 判定同类型式神是否已存在，消耗 MP，生成召唤物 Unit"""
    sc = skill.summon_config
    if not sc: _log(state, f"[ERROR] 技能 {skill.id} 缺少 summonConfig。"); return
    sname = sc.get("name", "召唤物")
    utype = sc.get("unitType", UNIT_SHIKIGAMI)
    # 检查同名式神是否已存在
    existing = [u for u in state.units if u.unit_type == UNIT_SHIKIGAMI and u.owner == summoner.id and u.is_alive]
    if existing:
        _log(state, f"{summoner.name} 的式神 {existing[0].name} 仍在场，无法重复召唤。")
        return
    duration = sc.get("duration", 300)
    # 根据玩家等级施展召唤 — 帧级流程
    ct = skill.cast_time
    cost = calculate_mp_cost(summoner, skill)
    summoner.mp = max(0, summoner.mp - cost)
    summoner.atb = 0
    _log(state, f"{summoner.name} 开始咏唱召唤 {sname}（{ct} 帧）…")
    _advance_time(state, ct)
    st = sc.get("baseStats", {})
    summon_unit = Unit(
        id=f"{utype}_{summoner.id}_{sc.get('name','')}_{int(state.global_action_time)}",
        name=sname,
        unit_type=utype,
        hp=st.get("hp", 80), max_hp=st.get("max_hp", st.get("hp", 80)),
        mp=st.get("mp", 20), max_mp=st.get("max_mp", st.get("mp", 20)),
        atb=0, speed=st.get("speed", 15),
        constitution=st.get("constitution", 10),
        martial_arts=st.get("martialArts", 20),
        cursed_energy=st.get("cursedEnergy", 5),
        cursed_energy_control=st.get("cursedEnergyControl", 5),
        cursed_energy_efficiency=st.get("cursedEnergyEfficiency", 5),
        talent=st.get("talent", 8),
        skills=[Skill(
            id=sk.get("id",""), name=sk.get("name",""), cost=sk.get("cost",0),
            type=sk.get("type","martial"), damage_multiplier=sk.get("damageMultiplier",1.0),
            cast_time=sk.get("castTime",10), base_recovery_speed=sk.get("baseRecoverySpeed",25),
            min_distance=sk.get("minDistance",0), max_distance=sk.get("maxDistance",0)
        ) for sk in sc.get("skills", [])],
        is_alive=True, distance=summoner.distance, owner=summoner.id,
        recovery_speed=st.get("speed", 15), summon_duration=duration
    )
    state.units.append(summon_unit)
    _log(state, f"{summoner.name} 召唤了 {sname}！（HP: {summon_unit.hp}, ATK: {summon_unit.martial_arts}, 持续: {duration} AV）")

def _tick_summon_duration(state):
    """推进所有召唤物的持续时间，超时则移除"""
    expired = []
    for u in state.units:
        if u.unit_type in (UNIT_SHIKIGAMI,) and u.is_alive and u.summon_duration > 0:
            u.summon_duration -= FRAME_STEP
            if u.summon_duration <= 0:
                u.is_alive = False
                expired.append(u)
    for u in expired:
        _log(state, f"{u.name} 的持续时间已到，消失在影子中。")
        state.units = [x for x in state.units if x.id != u.id]

def _resolve_shikigami_turns(state):
    """检查所有 shikigami 的 ATB，满则自动执行 AI 行动"""
    for u in list(state.units):
        if u.unit_type == UNIT_SHIKIGAMI and u.is_alive and u.atb >= ATB_MAX:
            _resolve_shikigami_action(u, state)

def _resolve_shikigami_action(shiki, state):
    """式神 AI：优先攻击最近的敌对目标"""
    # Phase 11: 如果设置了手动技能，使用它；否则自动选择
    manual_skill = getattr(shiki, '_manual_skill', None)
    if manual_skill:
        target = state.find_enemy()
        if not target or not target.is_alive:
            shiki.atb = 0
            return
        skill = manual_skill
        # 清除手动标记（仅当次行动）
        shiki._manual_skill = None
        _resolve_distance(shiki, skill, target, state)
        is_bf = _check_black_flash(shiki, sk)
        dmg = calculate_damage(shiki, skill, target, is_bf)
        dmg = apply_damage_variance(dmg, is_bf)
        cost = calculate_mp_cost(shiki, skill)
        shiki.mp = max(0, shiki.mp - cost)
        shiki.atb = 0
        target.hp = max(0, target.hp - dmg)
        update_aggro(shiki, target, dmg, "damage")
        _log(state, f"[{shiki.name}] 使用手动指定技能 {skill.name}{'【黑闪！】' if is_bf else ''}，造成 {dmg} 点伤害。")
        if is_bf: _log(state, "漆黑的光芒一闪——那一击超越了极限。")
        _check_battle_end(state)
        return

    target = state.find_enemy()
    if not target or not target.is_alive:
        shiki.atb = 0
        return
    # 选择可用技能（跳过距离过滤，由 _resolve_distance 处理）
    avail = [s for s in shiki.skills if s.type in ("martial","cursed") and shiki.mp >= s.cost]
    if not avail:
        shiki.atb = 0
        _log(state, f"{shiki.name} 没有可用技能，略过行动。")
        return
    # 优先高伤害技能
    avail.sort(key=lambda s: -s.damage_multiplier)
    skill = avail[0]
    distance_cost = _resolve_distance(shiki, skill, target, state)
    if distance_cost < 0: return  # ATB 不足
    is_bf = _check_black_flash(shiki, skill)
    dmg = calculate_damage(shiki, skill, target, is_bf)
    dmg = apply_damage_variance(dmg, is_bf)
    cost = calculate_mp_cost(shiki, skill)
    shiki.mp = max(0, shiki.mp - cost)
    shiki.atb = 0
    target.hp = max(0, target.hp - dmg)
    update_aggro(shiki, target, dmg, "damage")
    _log(state, f"[{shiki.name}] 自动使用 {skill.name}{'【黑闪！】' if is_bf else ''}，造成 {dmg} 点伤害。")
    if is_bf: _log(state, "漆黑的光芒一闪——那一击超越了极限。")
    _check_battle_end(state)

def _handle_shikigami_skill(action, state, tracker=None):
    """Phase 11: 手动控制式神 — 仅设定下一次行动使用的技能，不立即触发"""
    sid = action.get("skill_id", "")
    actor = state.find_unit(action.get("actor", ""))
    if not actor or actor.unit_type != UNIT_SHIKIGAMI:
        _log(state, "[ERROR] 无效的式神行动。"); return
    skill = None
    for s in actor.skills:
        if s.id == sid: skill = s; break
    if not skill: _log(state, f"[ERROR] 式神 {actor.name} 未找到技能: {sid}"); return
    if actor.mp < skill.cost:
        _log(state, f"式神咒力不足！需要 {skill.cost} MP，当前 {actor.mp} MP。"); return
    # 设定手动技能标记，等 ATB 满时自动执行
    actor._manual_skill = skill
    _log(state, f"[手动] {actor.name} 的下一次行动已设定为：{skill.name}（需 {skill.cost} MP）")

# ===== Phase 12: 反转术式 Handler =====

def _handle_rct_heal(action, state):
    """处理玩家使用反转术式回复"""
    actor_id = action.get("actor", "player")
    consume_amount = action.get("consume_amount", 0)
    actor = state.find_unit(actor_id)
    if not actor:
        _log(state, "[ERROR] 无效的行动者。")
        return
    # Phase 12: 检查 rct_cooldown debuff
    if has_status(actor, "rct_cooldown"):
        _log(state, f"{actor.name} 的反转术式仍在冷却中，无法使用。")
        return
    # Phase 12: 检查领域熔断（禁止咒术技能）
    if has_status(actor, "domain_burnout"):
        _log(state, f"{actor.name} 处于领域熔断状态，无法使用反转术式！")
        return
    heal, consumed, log_text = execute_rct(actor, consume_amount)
    if heal <= 0:
        _log(state, f"[ERROR] {log_text}")
        return
    _log(state, log_text)
    # 添加 RCT 冷却 Debuff（先 tick 再创建，避免立即被倒计时）
    _advance_time(state, 10)  # 回复动作占用 10 行动值
    add_status_effect(actor, "rct_cooldown", 60)

# ===== Phase 9: add_ally handler =====

def _handle_add_ally(action, state):
    """运行时从 JS 侧传入 ally 配置 JSON，创建 ally Unit 并加入战斗"""
    ally_config = action.get("ally_config", {})
    if not ally_config:
        _log(state, "[ERROR] add_ally 缺少 ally_config。")
        return
    add_ally_to_battle(state, ally_config)

# ===== Phase 10: 领域对抗 Buff 激活 =====

def _handle_activate_domain_counter(action, state):
    """玩家或敌人激活领域对抗 Buff（简易领域/落花之情/弥虚葛笼）"""
    actor_id = action.get("actor", "player")
    buff_id = action.get("buff_id", "")
    actor = state.find_unit(actor_id)
    if not actor:
        _log(state, "[ERROR] 无效的行动者。")
        return
    buff = activate_domain_counter(actor, buff_id)
    if buff:
        _log(state, f"{actor.name} 开启了「{buff['name']}」！")
        if buff.get("shield_hp", 0) > 0:
            _log(state, f"护盾 HP: {buff['shield_hp']}")
        if buff.get("mp_drain_per_10av", 0) > 0:
            _log(state, f"每 10 AV 消耗 {buff['mp_drain_per_10av']} 咒力")
        # Phase 12: 同步 domain_counter_buffs → status_effects
        _sync_domain_counter_to_status(actor)
    else:
        _log(state, f"[ERROR] 无法激活 Buff: {buff_id}（不存在或已有同类 Buff）")

# ===== Phase 10.5: 结界术修复 =====

def _handle_repair_domain(action, state):
    """结界术修复：消耗 MP 修复己方领域的 HP"""
    actor = state.find_unit(action.get("actor", "player"))
    if not actor: return
    domain = None
    for u in state.units:
        if u.unit_type == UNIT_DOMAIN and u.owner == actor.id and u.is_alive:
            domain = u
            break
    if not domain:
        _log(state, "[ERROR] 没有可修复的领域。")
        return
    cost = 15
    if actor.mp < cost:
        _log(state, f"咒力不足！需要 {cost} MP 进行结界术修复。")
        return
    heal_amount = int(domain.max_hp * 0.2)
    actor.mp -= cost
    domain.hp = min(domain.max_hp, domain.hp + heal_amount)
    _log(state, f"{actor.name} 使用结界术修复，{domain.name} 恢复 {heal_amount} HP（消耗 {cost} MP）。")

# ===== Phase 9: 友方 NPC 助战 AI =====

def _resolve_ally_turns(state):
    """检查所有 ally 的 ATB，满则自动执行预设 AI 行动"""
    for u in list(state.units):
        if u.unit_type == "ally" and u.is_alive and u.atb >= ATB_MAX:
            _resolve_ally_action(u, state)

def _resolve_ally_action(ally, state):
    """友方 NPC AI：选定敌人 → 选择最优技能 → 攻击。
    aiBehavior 优先级: aggressive(高伤害) > balanced(兼顾距离) > defensive(节约MP) > support(预留)"
    """
    target = state.find_enemy()
    if not target or not target.is_alive:
        ally.atb = 0
        return
    avail = [s for s in ally.skills
             if s.type in ("martial","cursed") and ally.mp >= s.cost
             and s.min_distance <= ally.distance <= s.max_distance]
    if not avail:
        ally.atb = 0
        _log(state, f"[{ally.name}] 没有可用技能，略过。")
        return
    # 简单 AI: 优先高伤害技能
    avail.sort(key=lambda s: -s.damage_multiplier)
    skill = avail[0]
    _resolve_distance(ally, skill, target, state)
    is_bf = _check_black_flash(ally, skill)
    dmg = calculate_damage(ally, skill, target, is_bf)
    dmg = apply_damage_variance(dmg, is_bf)
    cost = calculate_mp_cost(ally, skill)
    ally.mp = max(0, ally.mp - cost)
    ally.atb = 0
    target.hp = max(0, target.hp - dmg)
    update_aggro(ally, target, dmg, "damage")
    _log(state, f"[{ally.name}] 使用 {skill.name}{'【黑闪！】' if is_bf else ''} → {target.name}，造成 {dmg} 点伤害。")
    if is_bf: _log(state, "漆黑的光芒一闪——那一击超越了极限。")
    _check_battle_end(state)

def create_ally_unit(ally_config):
    """从 NPC_ALLY_CONFIGS 配置创建 ally Unit（纯数据 → Unit）"""
    st = ally_config.get("baseStats", {})
    sk = [Skill(
        id=s.get("id",""), name=s.get("name",""), cost=s.get("cost",0),
        type=s.get("type","martial"), damage_multiplier=s.get("damageMultiplier",1.0),
        cast_time=s.get("castTime",10), base_recovery_speed=s.get("baseRecoverySpeed",25),
        min_distance=s.get("minDistance",0), max_distance=s.get("maxDistance",0)
    ) for s in ally_config.get("skills", [])]
    return Unit(
        id=f"ally_{ally_config.get('unitType','')}_{ally_config.get('name','')}",
        name=ally_config.get("name","友方NPC"),
        unit_type="ally",
        hp=st.get("hp",200), max_hp=st.get("max_hp",st.get("hp",200)),
        mp=st.get("mp",60), max_mp=st.get("max_mp",st.get("mp",60)),
        atb=ATB_MAX, speed=st.get("speed",14),
        constitution=st.get("constitution",18),
        martial_arts=st.get("martialArts",20),
        cursed_energy=st.get("cursedEnergy",14),
        cursed_energy_control=st.get("cursedEnergyControl",14),
        cursed_energy_efficiency=st.get("cursedEnergyEfficiency",12),
        talent=st.get("talent",14),
        skills=sk, is_alive=True,
        distance=DISTANCE_MID, owner=None,
        recovery_speed=st.get("speed",14)
    )

def add_ally_to_battle(state, ally_config):
    """向战斗 state 中添加友方 NPC 助战 Unit"""
    # 检查是否已存在
    ally_name = ally_config.get("name","")
    existing = [u for u in state.units if u.unit_type == "ally" and u.name == ally_name]
    if existing:
        _log(state, f"{ally_name} 已在场上。")
        return None
    ally = create_ally_unit(ally_config)
    state.units.append(ally)
    _log(state, f"{ally_name} 加入战斗！（HP: {ally.hp}, ATK: {ally.martial_arts}）")
    return ally

# ===== 束缚 =====
VOWS = {"offense_boost":{"id":"offense_boost","name":"攻击强化之缚","description":"攻击伤害+50%，承受伤害+30%","forbidden_type":None,"bonus_damage_pct":0.50,"penalty_dmg_taken_pct":0.30,"speed_bonus":0,"violation_hp_loss_pct":0.20},"no_cursed_speed":{"id":"no_cursed_speed","name":"禁咒加速之缚","description":"禁用咒术，体术速度+30%","forbidden_type":"cursed","bonus_damage_pct":0,"penalty_dmg_taken_pct":0,"speed_bonus":0.30,"recovery_bonus":0.30,"violation_hp_loss_pct":0.20}}
def get_available_vows(): return [{"id":v["id"],"name":v["name"],"description":v["description"],"forbidden_type":v.get("forbidden_type")} for v in VOWS.values()]
def _handle_apply_vow(action, state):
    vid=action.get("vow_id",""); aid=action.get("actor","player"); actor=state.get_actor(aid)
    if not actor: return
    if actor.active_vow: _log(state,f"{actor.name} 解除了之前的束缚。"); _clear_vow_effects(actor,actor.active_vow)
    if vid in ("none",""): actor.active_vow=None; _log(state,f"{actor.name} 选择不施加束缚。"); return
    vow=VOWS.get(vid)
    if not vow: _log(state,f"[ERROR] 未知束缚: {vid}"); return
    actor.active_vow=vid; _apply_vow_effects(actor,vow)
    _log(state,f"{actor.name} 立下束缚「{vow['name']}」——{vow['description']}")
def _apply_vow_effects(actor,vow):
    rb=vow.get("recovery_bonus",0); sb=vow.get("speed_bonus",0)
    if rb>0: actor.recovery_speed=int(actor.speed*(1.0+rb))
    if sb>0: actor.speed=int(actor.speed*(1.0+sb))
def _clear_vow_effects(actor,vid): actor.recovery_speed=actor.speed

# ===== 序列化 =====
def _deserialize_state(d):
    pd=d.get("player",{}); ed=d.get("enemy",{})
    extra=[u for u in d.get("units",[]) if u.get("id") not in (pd.get("id"), ed.get("id"))]
    def _u(cd):
        sks=[Skill(id=s.get("id",""),name=s.get("name",""),cost=s.get("cost",0),type=s.get("type","martial"),damage_multiplier=s.get("damage_multiplier",1.0),min_distance=s.get("min_distance",0),max_distance=s.get("max_distance",3),cast_time=s.get("cast_time",5),base_recovery_speed=s.get("base_recovery_speed",30),summon_config=s.get("summon_config")) for s in cd.get("skills",[])]
        return Unit(id=cd.get("id",""),name=cd.get("name",""),unit_type=cd.get("unit_type","player"),hp=cd.get("hp",0),max_hp=cd.get("max_hp",0),mp=cd.get("mp",0),max_mp=cd.get("max_mp",0),atb=cd.get("atb",0),speed=cd.get("speed",10),is_alive=cd.get("is_alive",True),skills=sks,constitution=cd.get("constitution",10),martial_arts=cd.get("martial_arts",10),cursed_energy=cd.get("cursed_energy",10),cursed_energy_control=cd.get("cursed_energy_control",10),cursed_energy_efficiency=cd.get("cursed_energy_efficiency",10),talent=cd.get("talent",10),distance=cd.get("distance",2),active_vow=cd.get("active_vow"),recovery_speed=cd.get("recovery_speed",cd.get("speed",10)),owner=cd.get("owner"),attack_interval=cd.get("attack_interval",0),attack_damage=cd.get("attack_damage",0),status_effects=cd.get("status_effects",[]),domain_maintenance_cost=cd.get("domain_maintenance_cost",0),summon_duration=cd.get("summon_duration",0),aggro=cd.get("aggro",0),domain_counter_buffs=cd.get("domain_counter_buffs",[]),domain_name=cd.get("domain_name"),domain_hp=cd.get("domain_hp",500))
    return BattleState(units=[_u(pd),_u(ed)]+[_u(x) for x in extra],turn=d.get("turn","player"),log=d.get("log",[]),round_number=d.get("round_number",1),phase=d.get("phase",PHASE_WAITING),last_hit_was_black_flash=d.get("last_hit_was_black_flash",False),global_action_time=d.get("global_action_time",0))

def generate_battle_rewards(tracker, enemy_config=None, player_rank="四级", enemy_rank="四级", is_low_hp=False):
    """Phase 8: 细化奖励 — 金币/技能经验/技能点/灵感按等级差和残血加成"""
    if enemy_config is None: enemy_config={"money":{"min":20,"max":50},"skillPoints":1,"inspirationChance":0.05,"skillExp":5}
    # 等级差缩放
    RANKS=["不入流","四级","准三级","三级","准二级","二级","准一级","一级","准特级","特级","现代最强"]
    pi=RANKS.index(player_rank) if player_rank in RANKS else 1
    ei=RANKS.index(enemy_rank) if enemy_rank in RANKS else 1
    ld=ei-pi
    scale=max(0.1,1-ld*0.2)
    money_base=enemy_config["money"]["min"]+random.randint(0,enemy_config["money"]["max"]-enemy_config["money"]["min"])
    money=max(1,int(money_base*scale))
    sp=enemy_config.get("skillPoints",1)
    skill_exp=enemy_config.get("skillExp",5)
    insp_chance=enemy_config.get("inspirationChance",0.05)
    if ld>0: insp_chance=min(1.0,insp_chance+0.30)
    if is_low_hp: insp_chance=min(1.0,insp_chance*2)
    insp=random.random()<insp_chance
    pg={sid:count*skill_exp for sid,count in tracker.skill_usage.items()}
    tracker.set_rewards(money,sp,insp)
    return {"money":money,"skillPoints":sp,"inspirationGained":insp,"proficiencyGains":pg,"skillExp":skill_exp}

# ===== 领域 =====
def _handle_expand_domain(action, state):
    aid=action.get("actor","player"); owner=state.find_unit(aid)
    if not owner: _log(state,"[ERROR] 展开者不存在。"); return
    # Phase 10: 可以存在多个领域（敌我各一个用于对拼），但同一 owner 不可重复展开
    existing_owner = [u for u in state.units if u.unit_type==UNIT_DOMAIN and u.owner==aid]
    if existing_owner:
        _log(state,f"{owner.name} 已经展开了领域，无法重复展开。"); return
    did=action.get("domain_id","d"); dn=action.get("domain_name","领域")
    ic=action.get("is_complete",True); dh=action.get("domain_hp",500)
    ai=action.get("attack_interval",15); ad=action.get("attack_damage",50); mc=action.get("mp_cost",5)
    du=Unit(id=f"{aid}_domain_{did}",name=dn,unit_type=UNIT_DOMAIN,hp=dh,max_hp=dh,mp=0,max_mp=0,atb=0,speed=0,owner=aid,attack_interval=ai,attack_damage=ad,domain_maintenance_cost=mc)
    lt="完全领域" if ic else "不完全领域"
    _log(state, f"{owner.name} 展开了{lt}\"{dn}\"！领域 HP: {dh}, 攻击间隔: {ai} 帧, 伤害: {ad}")
    state.units.append(du); _advance_time(state, 10)
    # Phase 10: 领域对拼检测
    _check_domain_clash(state)

def _handle_cancel_domain(action, state):
    did=action.get("domain_id",""); domain=state.find_unit(did)
    if not domain: return
    owner=state.find_unit(domain.owner) if domain.owner else None
    state.units=[u for u in state.units if u.id!=did]; _advance_time(state, 20)
    if owner:
        owner.atb=max(0,owner.atb-DOMAIN_BURNOUT_ATB_COST)
        owner.recovery_speed=max(1,int(owner.recovery_speed*(1.0-DOMAIN_BURNOUT_SPEED_PENALTY)))
        # Phase 12: 领域熔断作为标准化 Debuff 加入 status_effects
        add_status_effect(owner, "domain_burnout", 60)
        _log(state,f"领域解除！{owner.name} 遭受熔断——扣除 {DOMAIN_BURNOUT_ATB_COST} ATB，补偿速度 -30%。")
    else: _log(state,"领域被解除。")
    # Phase 10: 对拼结束后重新检查
    _check_domain_clash(state)
    # Phase 10: 清理敌人领域 Unit 上的 domain_name/hp 引用
    owner_unit = state.find_unit(domain.owner) if domain.owner else None
    if owner_unit:
        if hasattr(owner_unit, 'domain_name'): owner_unit.domain_name = None
        if hasattr(owner_unit, 'domain_hp'): owner_unit.domain_hp = 0

# ===== Phase 10: 领域对拼机制 =====

def _get_player_domain(state, owner_type="player"):
    """获取指定 owner 类型的活跃领域 Unit"""
    for u in state.units:
        if u.unit_type == UNIT_DOMAIN and u.is_alive:
            if owner_type == "player" and u.owner == "player":
                return u
            elif owner_type == "enemy":
                owner_unit = state.find_unit(u.owner)
                if owner_unit and owner_unit.unit_type == UNIT_ENEMY:
                    return u
    return None

def _is_enemy_domain(domain, state):
    """判断一个领域是否属于敌方"""
    if domain.owner == "player":
        return False
    owner_unit = state.find_unit(domain.owner)
    return owner_unit is not None and owner_unit.unit_type == UNIT_ENEMY

def _check_domain_clash(state):
    """检查是否存在领域对拼（双方都展开了领域）
    若对拼：两个领域的攻击目标互相切换为对方领域 Unit，且特殊效果失效
    若不对拼：恢复各自对敌方本体的攻击
    """
    p_domain = _get_player_domain(state, "player")
    e_domain = _get_player_domain(state, "enemy")

    clash_active = p_domain is not None and e_domain is not None

    if clash_active and not getattr(state, 'domain_clash_active', False):
        state.domain_clash_active = True
        _log(state, "⚠️ 领域对拼！「" + p_domain.name + "」VS「" + e_domain.name + "」——双方特殊效果失效，领域互相攻击！")
    elif not clash_active and getattr(state, 'domain_clash_active', False):
        state.domain_clash_active = False
        _log(state, "领域对拼结束。")

def _resolve_domain_auto_attack(domain, state):
    owner = state.find_unit(domain.owner) if domain.owner else None
    if not owner: domain.is_alive = False; _log(state, "领域展开者消失，领域破碎。"); return
    if owner.mp < domain.domain_maintenance_cost:
        _log(state, "咒力不足，领域无法维持！"); _handle_cancel_domain({"domain_id": domain.id}, state); return
    owner.mp -= domain.domain_maintenance_cost

    # Phase 10: 领域对拼时攻击对方领域，否则攻击敌方本体
    if getattr(state, 'domain_clash_active', False):
        # 找到敌对领域作为攻击目标
        if domain.owner == "player":
            enemy_domain = _get_player_domain(state, "enemy")
        else:
            enemy_domain = _get_player_domain(state, "player")
        if enemy_domain:
            target = enemy_domain
        else:
            target = state.find_enemy() if domain.owner == "player" else state.find_player()
    else:
        # 非对拼时：领域攻击敌方本体
        # 敌方领域 → 攻击玩家；玩家领域 → 攻击敌人
        if _is_enemy_domain(domain, state):
            target = state.find_player()
        else:
            target = state.find_enemy()

    if not target or not target.is_alive: return
    dmg = domain.attack_damage

    # Phase 10: 对拼状态下特殊效果被中和
    if getattr(state, 'domain_clash_active', False) and target.unit_type == UNIT_DOMAIN:
        _log(state, f"「{domain.name}」攻击「{target.name}」！（领域对拼中——特殊效果失效）")
        target.hp = max(0, target.hp - dmg)
    else:
        # Phase 10: 非对拼状态 — 应用领域对抗 Buff
        eff_dmg, absorbed, extra_mp = apply_domain_counter_to_damage(target, dmg)
        target.hp = max(0, target.hp - eff_dmg)
        if extra_mp > 0:
            target.mp = max(0, target.mp - extra_mp)
        update_aggro(domain, target, eff_dmg, "damage")  # Phase 9: aggro
        if eff_dmg < dmg:
            absorb_text = f"（减免 {dmg - eff_dmg}）" if eff_dmg > 0 else "（完全抵挡）"
            counter_name = target.domain_counter_buffs[0].get('name','领域对抗') if target.domain_counter_buffs else '未知'
            _log(state, f"{domain.name} 自动攻击 {target.name}，但被「{counter_name}」{absorb_text}，实际造成 {eff_dmg} 点伤害。")
            if extra_mp > 0:
                _log(state, f"{target.name} 因落花之情额外消耗 {extra_mp} 咒力。")
        else:
            _log(state, f"{domain.name} 自动攻击 {target.name}，造成 {eff_dmg} 点伤害。")

    _check_battle_end(state)
    if state.turn in ("player_win","enemy_win"): return
    if owner.hp < owner.max_hp * 0.5:
        penalty = max(0, int(domain.max_hp * 0.05))
        domain.hp = max(0, domain.hp - penalty)
        _log(state, f"{owner.name} HP 低于 50%，领域维系损耗（-{penalty} HP）。")
    if domain.hp <= 0:
        _handle_cancel_domain({"domain_id": domain.id}, state)
        _log(state, f"{domain.name} 破碎了！")
        _check_domain_clash(state)

def _handle_domain_attack(action, state):
    did=action.get("domain_id",""); domain=state.find_unit(did)
    if not domain or domain.unit_type!=UNIT_DOMAIN: return
    owner=state.find_unit(domain.owner) if domain.owner else None
    if not owner: domain.is_alive=False; _log(state,"领域展开者消失，领域破碎。"); return
    if owner.mp<domain.domain_maintenance_cost: _log(state,"咒力不足，领域无法维持！"); _handle_cancel_domain({"domain_id":did},state); return
    owner.mp-=domain.domain_maintenance_cost
    target=state.find_enemy()
    if not target or not target.is_alive: return
    dmg=domain.attack_damage; target.hp=max(0,target.hp-dmg)
    _log(state,f"{domain.name} 自动攻击 {target.name}，造成 {dmg} 点伤害。")
    penalty=max(0,int(domain.max_hp*0.05))
    if owner.hp<owner.max_hp*0.5: domain.hp=max(0,domain.hp-penalty); _log(state,f"{owner.name} HP 低于 50%，领域维系损耗（-{penalty} HP）。")
    if domain.hp<=0: _handle_cancel_domain({"domain_id":did},state); _log(state,f"{domain.name} 破碎了！")

# ===== 初始化 =====
def init_battle(save_data_json):
    if save_data_json and save_data_json!="{}":
        try: save_data=json.loads(save_data_json)
        except json.JSONDecodeError: save_data={}
    else: save_data={}
    player=create_player_from_save(save_data)

    # Phase 11: 强制考核怪物（从 _forced_enemy_id 读取）
    forced_enemy_id = save_data.get("_forced_enemy_id")
    if forced_enemy_id:
        enemy = _create_enemy_by_id(forced_enemy_id)
    else:
        enemy = create_enemy_from_save(save_data)

    state=BattleState(units=[player,enemy],turn="player",phase=PHASE_WAITING)
    _log(state,"战斗开始！一股诅咒气息扑面而来。")
    _log(state,f"遭遇了 {enemy.name}！")
    _log(state,f"初始距离：{DISTANCE_NAMES[player.distance]}。")
    _log(state,"—— 玩家回合 ——")
    return json.dumps(state.to_dict(),ensure_ascii=False)

def _create_enemy_by_id(enemy_id):
    """Phase 11: 根据 enemy_id 从池中强制创建敌人（用于考核战斗）"""
    # 搜索所有池（需要访问 create_enemy_from_save 中的局部变量）
    # ENEMY_POOL 和 BOSS_POOL 在 create_enemy_from_save 内部定义
    # 我们在这里直接用内联搜索
    all_enemies = [
        # normal pool entries
        {"id":"enemy_flyhead","name":"蛸头","rank":"不入流","tier":"normal","hp":50,"mp":0,"speed":7,"con":6,"ma":8,"ce":0,"cec":0,"cee":0,"tal":3,"skills":[("enemy_bite","撕咬",0,"martial",1.0,8,28,0,0)]},
        {"id":"enemy_cursed_doll","name":"咒骸","rank":"四级","tier":"normal","hp":80,"mp":15,"speed":8,"con":10,"ma":12,"ce":6,"cec":5,"cee":5,"tal":5,"skills":[("enemy_punch","重拳",0,"martial",1.0,8,28,0,0),("enemy_cursed_bolt","诅咒弹",6,"cursed",1.3,16,22,1,3)]},
        {"id":"enemy_centipede","name":"百足咒灵","rank":"准三级","tier":"normal","hp":100,"mp":20,"speed":9,"con":12,"ma":14,"ce":8,"cec":8,"cee":6,"tal":8,"skills":[("enemy_swipe","横扫",0,"martial",1.0,6,30,0,1),("enemy_poison_spit","毒液喷射",8,"cursed",1.5,18,20,1,3)]},
        {"id":"enemy_shadow_beast","name":"影兽","rank":"三级","tier":"normal","hp":130,"mp":30,"speed":10,"con":14,"ma":16,"ce":10,"cec":10,"cee":8,"tal":10,"skills":[("enemy_claw","影爪",0,"martial",1.2,5,30,0,0),("enemy_shadow_bolt","暗影弹",12,"cursed",1.8,20,18,0,3)]},
        {"id":"enemy_blood_ghost","name":"血涂灵","rank":"准二级","tier":"normal","hp":160,"mp":40,"speed":11,"con":16,"ma":18,"ce":12,"cec":12,"cee":10,"tal":12,"skills":[("enemy_blood_strike","血击",0,"martial",1.1,6,28,0,1),("enemy_blood_spear","血矛",15,"cursed",2.0,22,16,0,3)]},
        {"id":"enemy_iron_curse","name":"铁甲咒灵","rank":"二级","tier":"normal","hp":200,"mp":50,"speed":12,"con":20,"ma":20,"ce":14,"cec":14,"cee":12,"tal":14,"skills":[("enemy_iron_fist","铁拳",0,"martial",1.3,7,26,0,0),("enemy_iron_cannon","铁甲炮",20,"cursed",2.2,25,14,0,3)]},
        {"id":"enemy_kuchisake","name":"裂口女","rank":"二级","tier":"normal","hp":220,"mp":40,"speed":13,"con":18,"ma":22,"ce":16,"cec":14,"cee":12,"tal":15,"skills":[("enemy_scissor_slash","剪刀斩",0,"martial",1.5,6,28,0,0),("enemy_kuchisake_question","裂口质问",15,"cursed",2.0,18,20,0,2)]},
        {"id":"enemy_hanako","name":"花子","rank":"二级","tier":"normal","hp":190,"mp":60,"speed":15,"con":16,"ma":18,"ce":20,"cec":18,"cee":14,"tal":16,"skills":[("enemy_toilet_curse","厕所诅咒",0,"martial",1.2,8,26,0,1),("enemy_water_blade","水刃",18,"cursed",2.2,20,18,1,3)]},
        {"id":"enemy_rokurokubi","name":"辘轳首","rank":"准一级","tier":"normal","hp":260,"mp":70,"speed":14,"con":20,"ma":24,"ce":20,"cec":18,"cee":14,"tal":17,"skills":[("enemy_neck_whip","长颈鞭",0,"martial",1.4,7,28,0,2),("enemy_gaze_curse","凝视诅咒",20,"cursed",2.5,22,16,1,3)]},
        {"id":"enemy_jorogumo","name":"络新妇","rank":"准一级","tier":"normal","hp":240,"mp":80,"speed":16,"con":18,"ma":22,"ce":22,"cec":20,"cee":16,"tal":18,"skills":[("enemy_web_trap","蛛网陷阱",0,"martial",1.3,8,26,0,2),("enemy_venom_string","毒丝",22,"cursed",2.8,24,14,0,3)]},
        {"id":"enemy_ubume","name":"姑获鸟","rank":"一级","tier":"normal","hp":300,"mp":90,"speed":17,"con":22,"ma":26,"ce":24,"cec":22,"cee":18,"tal":20,"skills":[("enemy_bird_talon","利爪",0,"martial",1.6,6,28,0,1),("enemy_screech","啼鸣诅咒",25,"cursed",3.0,26,14,0,3)]},
        {"id":"enemy_nurarihyon","name":"滑瓢","rank":"一级","tier":"normal","hp":320,"mp":85,"speed":16,"con":24,"ma":28,"ce":22,"cec":24,"cee":20,"tal":19,"skills":[("enemy_sneak_strike","潜行一击",0,"martial",1.7,7,28,0,0),("enemy_dark_mist","黑雾侵蚀",28,"cursed",3.2,28,12,0,3)]},
        {"id":"enemy_gyuki","name":"牛鬼","rank":"一级","tier":"normal","hp":350,"mp":70,"speed":13,"con":28,"ma":30,"ce":20,"cec":20,"cee":16,"tal":17,"skills":[("enemy_horn_charge","牛角冲撞",0,"martial",1.8,10,24,0,2),("enemy_breath_fire","鬼火吐息",30,"cursed",3.5,30,10,0,3)]},
        {"id":"enemy_gashadokuro","name":"饿者骷髅","rank":"一级","tier":"normal","hp":380,"mp":100,"speed":11,"con":30,"ma":26,"ce":26,"cec":22,"cee":18,"tal":18,"skills":[("enemy_bone_crush","骨碎",0,"martial",1.9,12,22,0,1),("enemy_grave_wind","墓场阴风",35,"cursed",3.8,32,10,0,3)]},
        # elite
        {"id":"enemy_cursed_womb","name":"咒胎","rank":"准一级","tier":"elite","hp":300,"mp":80,"speed":14,"con":22,"ma":24,"ce":18,"cec":18,"cee":14,"tal":16,"skills":[("enemy_womb_slam","重压",0,"martial",1.5,10,24,0,1),("enemy_womb_beam","咒胎光束",20,"cursed",2.5,28,14,0,3),("enemy_womb_roar","咒胎咆哮",15,"cursed",2.0,22,16,1,2)]},
        {"id":"enemy_vengeful_spirit","name":"怨灵","rank":"一级","tier":"elite","hp":400,"mp":100,"speed":16,"con":25,"ma":26,"ce":22,"cec":22,"cee":16,"tal":18,"skills":[("enemy_vengeful_strike","怨念击",0,"martial",1.6,8,24,0,0),("enemy_vengeful_blast","怨念爆破",25,"cursed",3.0,30,12,0,3),("enemy_vengeful_curse","深层诅咒",18,"cursed",2.2,24,14,0,2)]},
        # boss
        {"id":"enemy_special_grade","name":"特级咒灵","rank":"准特级","tier":"boss","hp":600,"mp":200,"speed":18,"con":30,"ma":32,"ce":28,"cec":28,"cee":20,"tal":22,"skills":[("boss_domain_fist","领域之拳",0,"martial",2.0,12,22,0,1),("boss_cursed_beam","咒力光束",30,"cursed",3.5,30,12,0,3),("boss_catastrophe","灾厄降临",50,"cursed",4.5,40,8,0,3)]},
        {"id":"boss_jogo","name":"漏瑚","rank":"特级","tier":"boss","hp":700,"mp":250,"speed":20,"con":28,"ma":30,"ce":32,"cec":30,"cee":22,"tal":25,"skills":[("boss_jogo_volcano","火山弹",25,"cursed",4.5,24,14,0,3),("boss_jogo_fire_eruption","火炎柱",30,"cursed",5.0,28,12,0,2),("boss_jogo_insect","火虫",18,"cursed",3.0,16,18,1,2),("boss_jogo_meteor","极之番·陨",60,"cursed",8.0,50,6,0,3),("boss_jogo_ember_slash","灼烧击",0,"martial",1.8,8,24,0,0)],"domain_name":"盖棺铁围山","domain_hp":800},
        {"id":"boss_mahito","name":"真人","rank":"特级","tier":"boss","hp":650,"mp":280,"speed":22,"con":24,"ma":32,"ce":30,"cec":28,"cee":24,"tal":28,"skills":[("boss_mahito_touch","无为转变",30,"cursed",3.5,22,16,0,0),("boss_mahito_morph","肉体变形",15,"cursed",2.5,15,22,0,1),("boss_mahito_dolls","改造人偶",25,"cursed",2.8,20,18,0,3)],"domain_name":"自闭圆顿裹","domain_hp":700},
        {"id":"boss_dagon","name":"陀艮","rank":"准特级","tier":"boss","hp":550,"mp":200,"speed":16,"con":25,"ma":26,"ce":26,"cec":24,"cee":20,"tal":22,"skills":[("boss_dagon_water","水流弹",20,"cursed",3.0,18,20,0,3),("boss_dagon_shikigami","鱼形式神",30,"cursed",3.5,24,16,0,3),("boss_dagon_swarm","鱼群吞噬",40,"cursed",4.0,30,12,0,2)],"domain_name":"荡蕴平线","domain_hp":600},
        {"id":"boss_sukuna_3f","name":"两面宿傩（三指）","rank":"特级","tier":"boss","hp":900,"mp":300,"speed":25,"con":35,"ma":38,"ce":36,"cec":35,"cee":30,"tal":35,"skills":[("boss_sukuna_cleave","解",15,"cursed",4.0,12,22,0,1),("boss_sukuna_dismantle","捌",20,"cursed",4.5,15,20,0,3),("boss_sukuna_cleave_net","解·网",35,"cursed",5.5,22,14,0,2),("boss_sukuna_slash","袈裟斩",0,"martial",3.0,8,26,0,0)],"domain_name":"伏魔御厨子","domain_hp":1000},
        {"id":"boss_choso","name":"胀相","rank":"准特级","tier":"boss","hp":500,"mp":220,"speed":18,"con":22,"ma":28,"ce":24,"cec":22,"cee":18,"tal":20,"skills":[("boss_choso_convergence","百敛·穿血",35,"cursed",5.0,25,14,0,3),("boss_choso_slicing","血星弹",15,"cursed",2.2,12,22,1,3),("piercing_blood","穿血",14,"cursed",2.4,15,25,0,3),("blood_blade","血刃",8,"cursed",2.0,10,30,0,1)],"domain_name":"九血之狱（未完成）","domain_hp":500},
    ]
    for chosen in all_enemies:
        if chosen.get("id") == enemy_id:
            sk_list = []
            for sk in chosen.get("skills", []):
                sk_list.append(Skill(id=sk[0],name=sk[1],cost=sk[2],type=sk[3],damage_multiplier=sk[4],cast_time=sk[5],base_recovery_speed=sk[6],min_distance=sk[7],max_distance=sk[8]))
            if not sk_list:
                sk_list = [Skill(id="enemy_attack",name="撞击",cost=0,type="martial",damage_multiplier=1.0,cast_time=8,base_recovery_speed=28,min_distance=0,max_distance=0)]
            return Unit(
                id="enemy_1", name=chosen["name"], unit_type=UNIT_ENEMY,
                hp=chosen["hp"], max_hp=chosen["hp"],
                mp=chosen["mp"], max_mp=chosen["mp"],
                atb=0, speed=chosen["speed"],
                constitution=chosen["con"], martial_arts=chosen["ma"],
                cursed_energy=chosen["ce"], cursed_energy_control=chosen["cec"],
                cursed_energy_efficiency=chosen["cee"], talent=chosen["tal"],
                skills=sk_list,
                is_alive=True, distance=DISTANCE_MID, active_vow=None,
                recovery_speed=chosen["speed"],
                domain_name=chosen.get("domain_name"),
                domain_hp=chosen.get("domain_hp", 500)
            )
    # Fallback
    return create_enemy_from_save({"rank": "四级"})
