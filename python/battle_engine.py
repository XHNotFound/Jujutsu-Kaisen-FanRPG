# python/battle_engine.py — 战斗引擎（纯函数，无副作用）
# 严禁：DOM 操作、print、console.log
# 调试信息请附加到 BattleState.log 中返回

import json
import random
import math
from python.models import (
    Character, Skill, BattleState, BattleTracker,
    ATB_MAX, ATB_MOVEMENT_COST, ATB_ACTION_COST,
    BLACK_FLASH_BASE_RATE, BLACK_FLASH_TALENT_RATE,
    DISTANCE_CLOSE, DISTANCE_NEAR, DISTANCE_MID, DISTANCE_FAR, DISTANCE_NAMES,
    PHASE_WAITING, PHASE_RECOVERY
)


# ================================================================
#  内部工具函数
# ================================================================

def _capped(value: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, value))


def _check_black_flash(actor: Character) -> bool:
    rate = BLACK_FLASH_BASE_RATE + actor.talent * BLACK_FLASH_TALENT_RATE
    return random.random() < rate


# ================================================================
#  距离系统
# ================================================================

def calculate_move_cost(actor: Character, from_distance: int, to_distance: int) -> int:
    diff = abs(to_distance - from_distance)
    if diff == 0:
        return 0
    base = diff * 10
    reduction = actor.martial_arts // 5
    return max(2, base - reduction)


def resolve_distance(actor, skill, target, state):
    current_dist = actor.distance
    min_d = skill.min_distance
    max_d = skill.max_distance
    if min_d <= current_dist <= max_d:
        return True
    if current_dist < min_d:
        target_dist = min_d
        dir_text = "后退"
    else:
        target_dist = max_d
        dir_text = "逼近"
    cost = calculate_move_cost(actor, current_dist, target_dist)
    if actor.atb < cost:
        state.log.append(f"行动值不足！需要 {cost} ATB 进行位移（当前 {actor.atb}）。")
        return False
    actor.atb -= cost
    actor.distance = target_dist
    state.log.append(f"{actor.name} 自动{dir_text}至{DISTANCE_NAMES[target_dist]}距离（消耗 {cost} ATB）。")
    return True


# ================================================================
#  ATB / 恢复
# ================================================================

def _resolve_recovery(actor: Character, delta_ticks: int = 1):
    gain = actor.recovery_speed * delta_ticks
    actor.atb = min(ATB_MAX, actor.atb + gain)


def calculate_action_interval(actor: Character, skill: Skill = None) -> int:
    ct = skill.cast_time if skill else 5
    recovery = actor.recovery_speed
    if recovery <= 0:
        recovery = 1
    speed = actor.speed
    if speed <= 0:
        speed = 1
    return ct + math.ceil(300 / recovery) + math.ceil(300 / speed)


def apply_recovery_after_action(actor: Character, skill: Skill, state: BattleState):
    base_speed = actor.speed
    vow_multiplier = 1.0
    if base_speed > 0 and actor.recovery_speed != base_speed:
        vow_multiplier = actor.recovery_speed / base_speed
    if skill and skill.base_recovery_speed > 0:
        actor.recovery_speed = max(1, int(skill.base_recovery_speed * vow_multiplier))
    actor.atb = 0
    total_interval = calculate_action_interval(actor, skill)
    ct = skill.cast_time if skill else 5
    recovery = actor.recovery_speed
    _resolve_recovery(actor, 1)
    state.log.append(
        f"{actor.name} 消耗了咏唱时间 {ct}，"
        f"行动间隔 {total_interval} 帧（补偿速度 {recovery}，速度 {actor.speed}），"
        f"ATB 已恢复至 {actor.atb}/{ATB_MAX}。"
    )


def tick_atb(state: BattleState) -> BattleState:
    state.player.atb = min(ATB_MAX, state.player.atb + int(state.player.speed * state.atb_tick))
    state.enemy.atb = min(ATB_MAX, state.enemy.atb + int(state.enemy.speed * state.atb_tick))
    return state


# ================================================================
#  角色/技能构建
# ================================================================

def create_player_from_save(save_data: dict) -> Character:
    name = save_data.get("characterName", "无名咒术师")
    attrs = save_data.get("attributes", {})
    constitution = attrs.get("constitution", 10)
    cursed_energy = attrs.get("cursedEnergy", 10)
    hp = save_data.get("hp", 100) or 100
    max_hp = save_data.get("maxHp", 100) or 100
    mp = save_data.get("mp", 50) or 50
    max_mp = save_data.get("maxMp", 50) or 50
    if max_hp <= 0:
        max_hp = 80 + constitution * 2
    if hp <= 0:
        hp = max_hp
    if max_mp <= 0:
        max_mp = 30 + cursed_energy * 3
    if mp <= 0:
        mp = max_mp
    technique_id = save_data.get("techniqueId", "cursedEnergyBoost")
    speed = 8 + attrs.get("talent", 10) // 3
    return Character(
        id="player", name=name,
        hp=hp, max_hp=max_hp, mp=mp, max_mp=max_mp,
        atb=ATB_MAX, speed=speed,
        constitution=constitution,
        martial_arts=attrs.get("martialArts", 10),
        cursed_energy=cursed_energy,
        cursed_energy_control=attrs.get("cursedEnergyControl", 10),
        cursed_energy_efficiency=attrs.get("cursedEnergyEfficiency", 10),
        talent=attrs.get("talent", 10),
        skills=_build_player_skills(technique_id),
        is_alive=True, distance=DISTANCE_MID,
        active_vow=None, recovery_speed=speed
    )


def _build_player_skills(technique_id: str) -> list:
    """根据术式 ID 构建玩家技能列表（Phase 6 扩展：支持所有 9 种术式）"""
    BASE = [
        ("attack", "体术平A", 0, "martial", 1.0, 5, 30, DISTANCE_CLOSE, DISTANCE_CLOSE, "基础体术攻击"),
        ("advance", "逼近", 0, "movement", 0.0, 3, 35, DISTANCE_CLOSE, DISTANCE_FAR, "向敌人逼近 1 档距离"),
        ("retreat", "后退", 0, "movement", 0.0, 3, 35, DISTANCE_CLOSE, DISTANCE_FAR, "向后退开 1 档距离"),
    ]
    skills = [Skill(id=id, name=name, cost=cost, type=typ,
                    damage_multiplier=mult, cast_time=ct, base_recovery_speed=rcv,
                    min_distance=min_d, max_distance=max_d, description=desc)
              for (id, name, cost, typ, mult, ct, rcv, min_d, max_d, desc) in BASE]
    # Phase 6: 完整术式技能映射
    TECH_SKILLS = {
        "cursedEnergyBoost": [
            ("cursed_boost", "咒力强化拳", 10, "cursed", 1.8, 12, 28, DISTANCE_CLOSE, DISTANCE_CLOSE, "以咒力强化拳击"),
        ],
        "limitless": [
            ("aoi", "苍", 15, "cursed", 2.2, 20, 25, DISTANCE_CLOSE, DISTANCE_FAR, "吸引一切的空之涡"),
            ("aka", "赫", 25, "cursed", 3.0, 30, 18, DISTANCE_NEAR, DISTANCE_FAR, "排斥一切的术式顺转"),
            ("aoi_strike", "苍·打击", 22, "cursed", 3.0, 25, 20, DISTANCE_CLOSE, DISTANCE_CLOSE, "将苍凝缩至拳上近距离释放"),
            ("aoi_max", "苍·最大出力", 30, "cursed", 4.0, 35, 15, DISTANCE_CLOSE, DISTANCE_FAR, "苍的极致版"),
            ("aka_max", "赫·最大出力", 40, "cursed", 4.5, 40, 12, DISTANCE_NEAR, DISTANCE_FAR, "赫的极致版"),
            ("murasaki", "虚式·茈", 50, "cursed", 6.0, 45, 10, DISTANCE_CLOSE, DISTANCE_FAR, "苍与赫的融合，撕裂空间"),
        ],
        "tenShadows": [
            ("gyokuken", "玉犬", 12, "cursed", 1.6, 15, 28, DISTANCE_CLOSE, DISTANCE_NEAR, "召唤黑白玉犬"),
            ("nue", "鵺", 18, "cursed", 2.0, 22, 22, DISTANCE_CLOSE, DISTANCE_FAR, "从空中俯冲攻击"),
            ("orochi", "大蛇", 16, "cursed", 1.8, 18, 24, DISTANCE_CLOSE, DISTANCE_NEAR, "巨蛇缠绕"),
            ("max_elephant", "满象", 22, "cursed", 2.5, 25, 20, DISTANCE_CLOSE, DISTANCE_NEAR, "召唤满象碾压"),
            ("tora_no_fun", "虎葬", 25, "cursed", 3.0, 20, 22, DISTANCE_CLOSE, DISTANCE_FAR, "虎形式神突袭"),
            ("makora", "魔虚罗", 60, "cursed", 8.0, 60, 5, DISTANCE_CLOSE, DISTANCE_FAR, "终极式神·未调伏"),
        ],
        "bloodManipulation": [
            ("blood_blade", "血刃", 8, "cursed", 1.4, 12, 28, DISTANCE_CLOSE, DISTANCE_NEAR, "血液凝结利刃"),
            ("slicing_exorcism", "血涂", 14, "cursed", 1.8, 16, 24, DISTANCE_CLOSE, DISTANCE_NEAR, "血液化作切割线"),
            ("piercing_blood", "穿血", 14, "cursed", 2.0, 16, 24, DISTANCE_CLOSE, DISTANCE_FAR, "高压血箭贯穿"),
            ("supernova", "超新星", 22, "cursed", 3.0, 22, 18, DISTANCE_CLOSE, DISTANCE_FAR, "凝固血液高速射出"),
            ("crimson_binding", "赤鳞跃动", 20, "cursed", 2.2, 18, 22, DISTANCE_CLOSE, DISTANCE_CLOSE, "全面强化身体"),
            ("canal", "运河", 16, "cursed", 2.0, 20, 20, DISTANCE_CLOSE, DISTANCE_FAR, "血液轨迹限制移动"),
        ],
        "boogieWoogie": [
            ("clap_swap", "拍手换位", 6, "cursed", 1.2, 8, 32, DISTANCE_CLOSE, DISTANCE_FAR, "拍手交换位置"),
            ("tactical_combo", "战术连携", 12, "cursed", 2.0, 12, 28, DISTANCE_CLOSE, DISTANCE_CLOSE, "利用位置优势连续攻击"),
        ],
        "overtime": [
            ("weakness", "基础弱点", 8, "cursed", 1.3, 10, 30, DISTANCE_CLOSE, DISTANCE_NEAR, "7:3制造弱点"),
            ("ratio_strike", "咒力钝器·七三", 14, "cursed", 2.0, 15, 25, DISTANCE_CLOSE, DISTANCE_CLOSE, "精准打击弱点"),
            ("collapse", "瓦解", 18, "cursed", 2.5, 20, 20, DISTANCE_CLOSE, DISTANCE_CLOSE, "强力打击削弱防御"),
            ("overtime", "极之番·加班", 25, "cursed", 3.5, 25, 18, DISTANCE_CLOSE, DISTANCE_NEAR, "开启加班模式"),
        ],
        "curseManipulation": [
            ("curse_absorb", "基础吞噬", 10, "cursed", 1.2, 12, 28, DISTANCE_CLOSE, DISTANCE_NEAR, "吞噬低级咒灵"),
            ("curse_sphere", "咒灵玉储存", 20, "cursed", 2.5, 22, 20, DISTANCE_CLOSE, DISTANCE_FAR, "一次性释放咒力"),
            ("uzumaki_pseudo", "极之番·伪", 35, "cursed", 4.0, 30, 14, DISTANCE_CLOSE, DISTANCE_FAR, "释放全部咒灵"),
        ],
        "strawDoll": [
            ("doll_basic", "基础操控", 10, "cursed", 1.5, 14, 26, DISTANCE_CLOSE, DISTANCE_NEAR, "咒力操控人偶攻击"),
            ("doll_scout", "远程侦查", 12, "cursed", 1.6, 16, 24, DISTANCE_NEAR, DISTANCE_FAR, "远程侦查干扰"),
            ("doll_resonance", "共鸣", 13, "cursed", 1.9, 18, 22, DISTANCE_CLOSE, DISTANCE_FAR, "傀儡共鸣远程冲击"),
            ("doll_overload", "傀儡自爆", 30, "cursed", 5.0, 30, 10, DISTANCE_NEAR, DISTANCE_NEAR, "引爆傀儡巨量伤害"),
        ],
        "pureMartial": [
            ("martial_combo", "体术连击", 0, "martial", 1.2, 8, 30, DISTANCE_CLOSE, DISTANCE_CLOSE, "高速近身连击"),
            ("black_flash_boost", "黑闪强化", 0, "martial", 1.5, 6, 32, DISTANCE_CLOSE, DISTANCE_CLOSE, "提升黑闪概率"),
            ("rush_strike", "疾风突袭", 0, "martial", 2.0, 10, 26, DISTANCE_CLOSE, DISTANCE_NEAR, "压倒性速度突袭"),
        ],
    }
    entries = TECH_SKILLS.get(technique_id, TECH_SKILLS.get("cursedEnergyBoost", []))
    for (id, name, cost, typ, mult, ct, rcv, min_d, max_d, desc) in entries:
        skills.append(Skill(id=id, name=name, cost=cost, type=typ,
                            damage_multiplier=mult, cast_time=ct, base_recovery_speed=rcv,
                            min_distance=min_d, max_distance=max_d, description=desc))
    return skills


def create_default_enemy(enemy_tier: str = "normal") -> Character:
    return Character(
        id="enemy_1", name="蛸头",
        hp=120, max_hp=120, mp=0, max_mp=0, atb=0, speed=7,
        constitution=10, martial_arts=12,
        cursed_energy=0, cursed_energy_control=0, cursed_energy_efficiency=0, talent=5,
        skills=[Skill(id="enemy_attack", name="撞击", cost=0, type="martial",
                      damage_multiplier=1.0, cast_time=8, base_recovery_speed=28,
                      min_distance=DISTANCE_CLOSE, max_distance=DISTANCE_CLOSE,
                      description="用身体撞击目标")],
        is_alive=True, distance=DISTANCE_MID, active_vow=None, recovery_speed=7
    )


# ================================================================
#  伤害计算
# ================================================================

def calculate_damage(actor, skill, target, is_black_flash=False):
    base_atk = actor.martial_arts * 2
    skill_bonus = skill.damage_multiplier * 10
    effective_defense = target.constitution * 0.5
    if is_black_flash:
        effective_defense *= 0.5
    raw = base_atk + skill_bonus - effective_defense
    damage = max(1, int(raw))
    if is_black_flash:
        damage = max(1, int(damage * 2.5))
    control_bonus = 1.0 + min(0.5, actor.cursed_energy_control * 0.01)
    damage = max(1, int(damage * control_bonus))
    return damage


def calculate_mp_cost(actor, skill):
    if skill.cost <= 0:
        return 0
    efficiency_factor = 1.0 - (actor.cursed_energy_efficiency * 0.005)
    efficiency_factor = max(0.3, efficiency_factor)
    return max(0, int(skill.cost * efficiency_factor))


# ================================================================
#  敌 AI
# ================================================================

def begin_enemy_turn(state: BattleState) -> BattleState:
    if state.turn in ("player_win", "enemy_win"):
        return state
    state.enemy.atb = min(ATB_MAX, state.enemy.atb + int(state.enemy.speed * state.atb_tick * 2))
    state.player.atb = min(ATB_MAX, state.player.atb + int(state.player.speed * state.atb_tick))
    state.turn = "enemy"
    state.log.append("—— 敌人回合 ——")
    enemy_skill = None
    for s in state.enemy.skills:
        if s.type in ("martial", "cursed") and state.enemy.mp >= s.cost:
            enemy_skill = s
            break
    if not enemy_skill:
        state.log.append(f"{state.enemy.name} 无法行动！")
        state.enemy.atb = 0
        state.turn = "player"
        state.log.append("—— 玩家回合 ——")
        return state
    resolve_distance(state.enemy, enemy_skill, state.player, state)
    is_bf = _check_black_flash(state.enemy)
    damage = calculate_damage(state.enemy, enemy_skill, state.player, is_bf)
    cost = calculate_mp_cost(state.enemy, enemy_skill)
    state.enemy.mp = max(0, state.enemy.mp - cost)
    state.enemy.atb = 0
    state.player.hp = max(0, state.player.hp - damage)
    bf_text = "【黑闪！】" if is_bf else ""
    state.log.append(f"{state.enemy.name} 使用 {enemy_skill.name}{bf_text}，造成 {damage} 点伤害。")
    if is_bf:
        state.log.append("漆黑的光芒一闪——那一击超越了极限。")
    state.last_hit_was_black_flash = is_bf
    if state.player.hp <= 0:
        state.player.is_alive = False
        state.turn = "enemy_win"
        state.log.append(f"{state.player.name} 倒下了…")
        return state
    state.turn = "player"
    state.phase = PHASE_WAITING
    state.log.append("—— 玩家回合 ——")
    return state


# ================================================================
#  行动执行（核心 API）
# ================================================================

def execute_action(action_json: str, state_json: str) -> str:
    action = json.loads(action_json)
    state_dict = json.loads(state_json)
    state = _deserialize_state(state_dict)
    tracker_data = state_dict.get("_tracker", {})
    tracker = BattleTracker()
    tracker.skill_usage = tracker_data.get("skill_usage", {})
    tracker.money_reward = tracker_data.get("money_reward", 0)
    tracker.skill_points_reward = tracker_data.get("skill_points_reward", 0)
    tracker.inspiration_gained = tracker_data.get("inspiration_gained", False)
    action_type = action.get("type", "")
    if action_type == "use_skill":
        _handle_use_skill(action, state, tracker)
    elif action_type == "tick":
        tick_atb(state)
    elif action_type == "apply_vow":
        _handle_apply_vow(action, state)
    result = state.to_dict()
    result["_tracker"] = tracker.to_dict()
    return json.dumps(result, ensure_ascii=False)


def _handle_use_skill(action: dict, state: BattleState, tracker: BattleTracker = None):
    actor_id = action.get("actor", "player")
    skill_id = action.get("skill_id", "attack")
    target_id = action.get("target", state.enemy.id)
    actor = state.get_actor(actor_id)
    target = state.get_target(target_id)
    if not actor or not target:
        state.log.append("[ERROR] 无效的行动者或目标。")
        return
    if actor.atb < ATB_MAX and state.turn == "player":
        tick_atb(state)
        state.log.append(f"{actor.name} 的 ATB 恢复中（{actor.atb}/{ATB_MAX}）…")
        return
    skill = None
    for s in actor.skills:
        if s.id == skill_id:
            skill = s
            break
    if not skill:
        state.log.append(f"[ERROR] 未找到技能: {skill_id}")
        return
    if actor.mp < skill.cost and skill.type == "cursed":
        state.log.append(f"咒力不足！需要 {skill.cost} MP，当前 {actor.mp} MP。")
        return
    if tracker:
        tracker.record_skill_use(skill_id)
    if skill.type == "movement":
        _execute_movement(actor, skill, state)
    elif skill.type in ("martial", "cursed"):
        if not resolve_distance(actor, skill, target, state):
            return
        _execute_attack(actor, skill, target, state)
    if state.enemy.hp <= 0:
        state.enemy.is_alive = False
        state.turn = "player_win"
        state.log.append(f"{state.enemy.name} 被击败了！")


def _execute_attack(actor: Character, skill: Skill, target: Character, state: BattleState):
    is_bf = False
    bf_text = ""
    if skill.type == "martial":
        if _check_black_flash(actor):
            is_bf = True
            bf_text = "【黑闪！】"
    damage = calculate_damage(actor, skill, target, is_bf)
    actual_cost = calculate_mp_cost(actor, skill)
    actor.mp = max(0, actor.mp - actual_cost)
    target.hp = max(0, target.hp - damage)
    bf_detail = " 无视 50% 防御！" if is_bf else ""
    cost_text = f"（消耗 {actual_cost} MP）" if actual_cost > 0 else ""
    state.log.append(f"{actor.name} 使用 {skill.name}{cost_text}{bf_text}，造成 {damage} 点伤害。{bf_detail}")
    if is_bf:
        state.log.append("漆黑的光芒一闪——那一击超越了极限。")
    apply_recovery_after_action(actor, skill, state)
    state.last_hit_was_black_flash = is_bf
    if target.is_alive and target.hp > 0:
        begin_enemy_turn(state)


def _execute_movement(actor: Character, skill: Skill, state: BattleState):
    current = actor.distance
    if "advance" in skill.id:
        new_dist = max(DISTANCE_CLOSE, current - 1)
    else:
        new_dist = min(DISTANCE_FAR, current + 1)
    if new_dist == current:
        state.log.append(f"{actor.name} 已经处于边界，无法继续移动。")
        return
    cost = calculate_move_cost(actor, current, new_dist)
    if actor.atb < cost:
        state.log.append(f"行动值不足！需要 {cost} ATB（当前 {actor.atb}）。")
        return
    actor.atb -= cost
    actor.distance = new_dist
    dir_text = "逼近" if new_dist < current else "后退"
    state.log.append(f"{actor.name} {dir_text}至{DISTANCE_NAMES[new_dist]}距离（消耗 {cost} ATB）。")


# ================================================================
#  束缚系统
# ================================================================

VOWS = {
    "offense_boost": {"id": "offense_boost", "name": "攻击强化之缚", "description": "放弃防御以换取攻击力。攻击伤害 +50%，但承受伤害 +30%。", "forbidden_type": None, "bonus_damage_pct": 0.50, "penalty_dmg_taken_pct": 0.30, "speed_bonus": 0, "violation_hp_loss_pct": 0.20},
    "no_cursed_speed": {"id": "no_cursed_speed", "name": "禁咒加速之缚", "description": "立誓本回合不使用咒术，体术速度 +30%。若违规则遭受反噬。", "forbidden_type": "cursed", "bonus_damage_pct": 0, "penalty_dmg_taken_pct": 0, "speed_bonus": 0.30, "recovery_bonus": 0.30, "violation_hp_loss_pct": 0.20},
}


def get_available_vows():
    return [{"id": v["id"], "name": v["name"], "description": v["description"], "forbidden_type": v.get("forbidden_type")} for v in VOWS.values()]


def _handle_apply_vow(action, state):
    vow_id = action.get("vow_id", "")
    actor_id = action.get("actor", "player")
    actor = state.get_actor(actor_id)
    if not actor:
        return
    if actor.active_vow:
        state.log.append(f"{actor.name} 解除了之前的束缚。")
        _clear_vow_effects(actor, actor.active_vow)
    if vow_id == "none" or vow_id == "":
        actor.active_vow = None
        state.log.append(f"{actor.name} 选择不施加束缚。")
        return
    vow = VOWS.get(vow_id)
    if not vow:
        state.log.append(f"[ERROR] 未知束缚: {vow_id}")
        return
    actor.active_vow = vow_id
    _apply_vow_effects(actor, vow)
    state.log.append(f"{actor.name} 立下束缚「{vow['name']}」——{vow['description']}")


def _apply_vow_effects(actor, vow):
    recovery_bonus = vow.get("recovery_bonus", 0)
    if recovery_bonus > 0:
        actor.recovery_speed = int(actor.speed * (1.0 + recovery_bonus))
    speed_bonus = vow.get("speed_bonus", 0)
    if speed_bonus > 0:
        actor.speed = int(actor.speed * (1.0 + speed_bonus))


def _clear_vow_effects(actor, vow_id):
    actor.recovery_speed = actor.speed


def check_vow_violation(actor, skill):
    if not actor.active_vow:
        return False
    vow = VOWS.get(actor.active_vow)
    if not vow:
        return False
    forbidden = vow.get("forbidden_type")
    if forbidden and skill.type == forbidden:
        return True
    return False


def apply_vow_bonus_damage(actor, base_damage):
    if not actor.active_vow:
        return base_damage
    vow = VOWS.get(actor.active_vow)
    if not vow:
        return base_damage
    bonus = vow.get("bonus_damage_pct", 0)
    if bonus > 0:
        return max(1, int(base_damage * (1.0 + bonus)))
    return base_damage


def apply_vow_penalty_damage(actor, incoming_damage):
    if not actor.active_vow:
        return incoming_damage
    vow = VOWS.get(actor.active_vow)
    if not vow:
        return incoming_damage
    penalty = vow.get("penalty_dmg_taken_pct", 0)
    if penalty > 0:
        return max(1, int(incoming_damage * (1.0 + penalty)))
    return incoming_damage


# ================================================================
#  序列化
# ================================================================

def _deserialize_state(d: dict) -> BattleState:
    pd = d.get("player", {})
    ed = d.get("enemy", {})
    def _build_char(cd):
        skills = [Skill(id=s.get("id",""), name=s.get("name",""), cost=s.get("cost",0), type=s.get("type","martial"),
                        damage_multiplier=s.get("damage_multiplier",1.0), min_distance=s.get("min_distance",0), max_distance=s.get("max_distance",3),
                        cast_time=s.get("cast_time",5), base_recovery_speed=s.get("base_recovery_speed",30))
                  for s in cd.get("skills",[])]
        return Character(id=cd.get("id",""), name=cd.get("name",""), hp=cd.get("hp",0), max_hp=cd.get("max_hp",0),
                         mp=cd.get("mp",0), max_mp=cd.get("max_mp",0), atb=cd.get("atb",0), speed=cd.get("speed",10),
                         is_alive=cd.get("is_alive",True), skills=skills,
                         constitution=cd.get("constitution",10), martial_arts=cd.get("martial_arts",10),
                         cursed_energy=cd.get("cursed_energy",10), cursed_energy_control=cd.get("cursed_energy_control",10),
                         cursed_energy_efficiency=cd.get("cursed_energy_efficiency",10), talent=cd.get("talent",10),
                         distance=cd.get("distance",2), active_vow=cd.get("active_vow"),
                         recovery_speed=cd.get("recovery_speed",cd.get("speed",10)))
    return BattleState(player=_build_char(pd), enemy=_build_char(ed),
                       turn=d.get("turn","player"), log=d.get("log",[]), round_number=d.get("round_number",1),
                       phase=d.get("phase",PHASE_WAITING), last_hit_was_black_flash=d.get("last_hit_was_black_flash",False))


# ================================================================
#  战后结算
# ================================================================

def generate_battle_rewards(tracker: BattleTracker, enemy_config: dict = None) -> dict:
    if enemy_config is None:
        enemy_config = {"money": {"min": 20, "max": 50}, "skillPoints": 1, "inspirationChance": 0.05}
    money = enemy_config["money"]["min"] + random.randint(0, enemy_config["money"]["max"] - enemy_config["money"]["min"])
    skill_points = enemy_config.get("skillPoints", 1)
    inspiration = random.random() < enemy_config.get("inspirationChance", 0.05)
    proficiency_gains = {skill_id: count * 5 for skill_id, count in tracker.skill_usage.items()}
    tracker.set_rewards(money, skill_points, inspiration)
    return {"money": money, "skillPoints": skill_points, "inspirationGained": inspiration, "proficiencyGains": proficiency_gains}


# ================================================================
#  初始化 API
# ================================================================

def init_battle(save_data_json: str) -> str:
    if save_data_json and save_data_json != "{}":
        try:
            save_data = json.loads(save_data_json)
        except json.JSONDecodeError:
            save_data = {}
    else:
        save_data = {}
    player = create_player_from_save(save_data)
    enemy = create_default_enemy()
    state = BattleState(player=player, enemy=enemy, turn="player", phase=PHASE_WAITING)
    state.log.append("战斗开始！一股诅咒气息扑面而来。")
    state.log.append(f"遭遇了 {enemy.name}！")
    state.log.append(f"初始距离：{DISTANCE_NAMES[player.distance]}。")
    state.log.append(f"—— 玩家回合 ——")
    return json.dumps(state.to_dict(), ensure_ascii=False)
