# python/battle_engine.py — 战斗引擎（纯函数，无副作用）
# 严禁：DOM 操作、print、console.log
# 调试信息请附加到 BattleState.log 中返回

import json
import random
import math
from python.models import (
    Character, Skill, BattleState,
    ATB_MAX, ATB_MOVEMENT_COST, ATB_ACTION_COST,
    BLACK_FLASH_BASE_RATE, BLACK_FLASH_TALENT_RATE,
    DISTANCE_CLOSE, DISTANCE_NEAR, DISTANCE_MID, DISTANCE_FAR, DISTANCE_NAMES,
    PHASE_WAITING, PHASE_RECOVERY
)


# ================================================================
#  内部工具函数
# ================================================================

def _capped(value: int, lo: int, hi: int) -> int:
    """将 value 限制在 [lo, hi] 范围内"""
    return max(lo, min(hi, value))


def _check_black_flash(actor: Character) -> bool:
    """判定黑闪是否触发：概率 = 基础概率(1%) + 天赋 * 0.5%"""
    rate = BLACK_FLASH_BASE_RATE + actor.talent * BLACK_FLASH_TALENT_RATE
    return random.random() < rate


# ================================================================
#  距离系统（Phase 3 新增）
# ================================================================

def calculate_move_cost(actor: Character, from_distance: int, to_distance: int) -> int:
    """
    计算移动消耗：
      cost = max(2, abs(距离差) * 10 - floor(体术水平 / 5))
    """
    diff = abs(to_distance - from_distance)
    if diff == 0:
        return 0
    base = diff * 10
    reduction = actor.martial_arts // 5
    return max(2, base - reduction)


def resolve_distance(
    actor: Character,
    skill: Skill,
    target: Character,
    state: BattleState
) -> bool:
    """
    距离校验与自动位移。
    如果当前距离不满足技能要求，自动扣除 ATB 进行移动，并追加日志。

    Returns:
        True 如果距离已满足（或自动调整后满足），False 如果 ATB 不足以完成移动
    """
    current_dist = actor.distance
    min_d = skill.min_distance
    max_d = skill.max_distance

    if min_d <= current_dist <= max_d:
        return True  # 距离满足

    # 需要进行自动位移：选择最近的合法距离
    if current_dist < min_d:
        target_dist = min_d
        dir_text = "后退"
    else:
        target_dist = max_d
        dir_text = "逼近"

    cost = calculate_move_cost(actor, current_dist, target_dist)
    if actor.atb < cost:
        state.log.append(
            f"行动值不足！需要 {cost} ATB 进行位移（当前 {actor.atb}）。"
        )
        return False

    actor.atb -= cost
    actor.distance = target_dist
    state.log.append(
        f"{actor.name} 自动{dir_text}至{DISTANCE_NAMES[target_dist]}距离（消耗 {cost} ATB）。"
    )
    return True


# ================================================================
#  行动间隔与补偿速度（Phase 3 新增）
# ================================================================

def calculate_action_interval(actor: Character) -> int:
    """
    行动间隔公式：
      总间隔 = ceil(300 / 补偿速度) + ceil(300 / 角色速度)
    补偿速度初始值 = 角色速度，可被束缚等机制修改。
    返回值单位：帧/tick 次数
    """
    recovery = actor.recovery_speed
    if recovery <= 0:
        recovery = 1
    speed = actor.speed
    if speed <= 0:
        speed = 1
    return math.ceil(300 / recovery) + math.ceil(300 / speed)


def resolve_recovery(actor: Character, delta_ticks: int = 1):
    """
    每帧恢复 ATB：
      恢复量 = 补偿速度 * delta_ticks
    用于行动后的 ATB 重填阶段。
    """
    gain = actor.recovery_speed * delta_ticks
    actor.atb = min(ATB_MAX, actor.atb + gain)


# ================================================================
#  角色/技能构建
# ================================================================

def create_player_from_save(save_data: dict) -> Character:
    """从存档数据创建玩家角色"""
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
        id="player",
        name=name,
        hp=hp, max_hp=max_hp,
        mp=mp, max_mp=max_mp,
        atb=ATB_MAX,
        speed=speed,
        constitution=constitution,
        martial_arts=attrs.get("martialArts", 10),
        cursed_energy=cursed_energy,
        cursed_energy_control=attrs.get("cursedEnergyControl", 10),
        cursed_energy_efficiency=attrs.get("cursedEnergyEfficiency", 10),
        talent=attrs.get("talent", 10),
        skills=_build_player_skills(technique_id),
        is_alive=True,
        distance=DISTANCE_MID,
        active_vow=None,
        recovery_speed=speed
    )


def _build_player_skills(technique_id: str) -> list:
    """根据术式 ID 构建玩家技能列表

    每个技能现在包含 min_distance / max_distance 范围。
    """
    skills = [
        # 通用基础技能 — 体术：仅限贴身处
        Skill(id="attack", name="体术平A", cost=0, type="martial",
              damage_multiplier=1.0, description="基础体术攻击，不消耗咒力",
              min_distance=DISTANCE_CLOSE, max_distance=DISTANCE_CLOSE),

        # 位移技能
        Skill(id="advance", name="逼近", cost=0, type="movement",
              damage_multiplier=0, description="向敌人逼近 1 档距离",
              min_distance=DISTANCE_CLOSE, max_distance=DISTANCE_FAR),

        Skill(id="retreat", name="后退", cost=0, type="movement",
              damage_multiplier=0, description="向后退开 1 档距离",
              min_distance=DISTANCE_CLOSE, max_distance=DISTANCE_FAR),
    ]

    # 根据术式添加咒术技能（各术式有不同适用距离）
    technique_skills = {
        "cursedEnergyBoost": [
            Skill(id="cursed_boost", name="咒力强化拳", cost=10, type="cursed",
                  damage_multiplier=1.8, description="以咒力强化拳击，朴实但有效",
                  min_distance=DISTANCE_CLOSE, max_distance=DISTANCE_CLOSE),
        ],
        "limitless": [
            Skill(id="aoi", name="苍", cost=15, type="cursed",
                  damage_multiplier=2.2, description="吸引一切的空之涡",
                  min_distance=DISTANCE_CLOSE, max_distance=DISTANCE_FAR),
            Skill(id="aka", name="赫", cost=25, type="cursed",
                  damage_multiplier=3.0, description="排斥一切的术式顺转",
                  min_distance=DISTANCE_NEAR, max_distance=DISTANCE_FAR),
        ],
        "tenShadows": [
            Skill(id="gyokuken", name="玉犬", cost=12, type="cursed",
                  damage_multiplier=1.6, description="召唤黑白玉犬撕咬目标",
                  min_distance=DISTANCE_CLOSE, max_distance=DISTANCE_NEAR),
        ],
        "bloodManipulation": [
            Skill(id="piercing_blood", name="穿血", cost=14, type="cursed",
                  damage_multiplier=2.0, description="以高压血箭贯穿目标",
                  min_distance=DISTANCE_CLOSE, max_distance=DISTANCE_FAR),
        ],
        "boogieWoogie": [
            Skill(id="boogie_punch", name="拍手连击", cost=8, type="cursed",
                  damage_multiplier=1.5, description="利用位置交换制造破绽后进行连击",
                  min_distance=DISTANCE_CLOSE, max_distance=DISTANCE_CLOSE),
        ],
        "strawDoll": [
            Skill(id="doll_resonance", name="共鸣", cost=13, type="cursed",
                  damage_multiplier=1.9, description="以傀儡共鸣释放远程咒力冲击",
                  min_distance=DISTANCE_CLOSE, max_distance=DISTANCE_FAR),
        ],
    }

    sk = technique_skills.get(technique_id, [])
    if not sk:
        sk = technique_skills.get("cursedEnergyBoost", [])

    skills.extend(sk)
    return skills


def create_default_enemy(enemy_tier: str = "normal") -> Character:
    """创建默认敌人"""
    return Character(
        id="enemy_1",
        name="蛸头",
        hp=60, max_hp=60,
        mp=0, max_mp=0,
        atb=0,
        speed=7,
        constitution=8,
        martial_arts=10,
        cursed_energy=0,
        cursed_energy_control=0,
        cursed_energy_efficiency=0,
        talent=5,
        skills=[
            Skill(id="enemy_attack", name="撞击", cost=0, type="martial",
                  damage_multiplier=1.0, description="用身体撞击目标",
                  min_distance=DISTANCE_CLOSE, max_distance=DISTANCE_CLOSE),
        ],
        is_alive=True,
        distance=DISTANCE_MID,
        active_vow=None,
        recovery_speed=7
    )


# ================================================================
#  伤害计算（纯函数）
# ================================================================

def calculate_damage(
    actor: Character,
    skill: Skill,
    target: Character,
    is_black_flash: bool = False
) -> int:
    """
    伤害计算公式：
      基础伤害 = max(1, (攻击方体术 * 2) + (技能倍率 * 10) - (防御方体质 * 0.5))

    黑闪额外：
      - 伤害 * 2.5
      - 无视 50% 防御
    """
    base_atk = actor.martial_arts * 2
    skill_bonus = skill.damage_multiplier * 10
    effective_defense = target.constitution * 0.5

    if is_black_flash:
        effective_defense *= 0.5

    raw = base_atk + skill_bonus - effective_defense
    damage = max(1, int(raw))

    if is_black_flash:
        damage = max(1, int(damage * 2.5))

    # 咒力操控加成（每点 +1% 伤害，最多 50%）
    control_bonus = 1.0 + min(0.5, actor.cursed_energy_control * 0.01)
    damage = max(1, int(damage * control_bonus))

    return damage


def calculate_mp_cost(actor: Character, skill: Skill) -> int:
    """咒力消耗公式"""
    if skill.cost <= 0:
        return 0
    efficiency_factor = 1.0 - (actor.cursed_energy_efficiency * 0.005)
    efficiency_factor = max(0.3, efficiency_factor)
    return max(0, int(skill.cost * efficiency_factor))


# ================================================================
#  ATB 系统
# ================================================================

def tick_atb(state: BattleState) -> BattleState:
    """推进 ATB：双方 ATB += speed * atb_tick"""
    state.player.atb = min(ATB_MAX, state.player.atb + int(state.player.speed * state.atb_tick))
    state.enemy.atb = min(ATB_MAX, state.enemy.atb + int(state.enemy.speed * state.atb_tick))
    return state


def begin_enemy_turn(state: BattleState) -> BattleState:
    """切换到敌人回合，执行敌人 AI"""
    if state.turn in ("player_win", "enemy_win"):
        return state

    # 推进 ATB
    state.enemy.atb = min(ATB_MAX, state.enemy.atb + int(state.enemy.speed * state.atb_tick * 2))
    state.player.atb = min(ATB_MAX, state.player.atb + int(state.player.speed * state.atb_tick))

    state.turn = "enemy"
    state.log.append("—— 敌人回合 ——")

    # 敌人 AI：检查距离 → 自动位移（若需要）→ 选择体术技能攻击
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

    # 距离校验（敌人也会自动逼近）
    resolve_distance(state.enemy, enemy_skill, state.player, state)

    # 执行攻击
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

    # 标记黑闪状态供 UI 渲染特效
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
    """执行战斗行动"""
    action = json.loads(action_json)
    state_dict = json.loads(state_json)
    state = _deserialize_state(state_dict)

    action_type = action.get("type", "")

    if action_type == "use_skill":
        _handle_use_skill(action, state)
    elif action_type == "tick":
        tick_atb(state)
    elif action_type == "apply_vow":
        _handle_apply_vow(action, state)

    return json.dumps(state.to_dict(), ensure_ascii=False)


def _handle_use_skill(action: dict, state: BattleState):
    """处理玩家使用技能（Phase 3 扩展：距离校验）"""
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

    # 查找技能
    skill = None
    for s in actor.skills:
        if s.id == skill_id:
            skill = s
            break

    if not skill:
        state.log.append(f"[ERROR] 未找到技能: {skill_id}")
        return

    # 检查咒力
    if actor.mp < skill.cost and skill.type == "cursed":
        state.log.append(f"咒力不足！需要 {skill.cost} MP，当前 {actor.mp} MP。")
        return

    # ---- 执行技能 ----
    if skill.type == "movement":
        _execute_movement(actor, skill, state)
    elif skill.type in ("martial", "cursed"):
        # Phase 3: 距离校验
        if not resolve_distance(actor, skill, target, state):
            return  # ATB 不足，无法自动位移
        _execute_attack(actor, skill, target, state)

    # 检查敌人是否死亡
    if state.enemy.hp <= 0:
        state.enemy.is_alive = False
        state.turn = "player_win"
        state.log.append(f"{state.enemy.name} 被击败了！")


def _execute_attack(actor: Character, skill: Skill, target: Character, state: BattleState):
    """执行攻击类技能（体术/咒术）"""
    is_bf = False
    bf_text = ""

    # 黑闪判定：仅体术技能可触发
    if skill.type == "martial":
        if _check_black_flash(actor):
            is_bf = True
            bf_text = "【黑闪！】"

    # 伤害计算
    damage = calculate_damage(actor, skill, target, is_bf)
    actual_cost = calculate_mp_cost(actor, skill)

    # 执行
    actor.mp = max(0, actor.mp - actual_cost)
    actor.atb = 0
    target.hp = max(0, target.hp - damage)

    # 日志
    bf_detail = " 无视 50% 防御！" if is_bf else ""
    cost_text = f"（消耗 {actual_cost} MP）" if actual_cost > 0 else ""
    state.log.append(
        f"{actor.name} 使用 {skill.name}{cost_text}{bf_text}，造成 {damage} 点伤害。{bf_detail}"
    )

    if is_bf:
        state.log.append("漆黑的光芒一闪——那一击超越了极限。")

    # 恢复阶段：使用补偿速度开始 ATB 恢复
    recover_ticks = max(1, actor.speed // 3)
    resolve_recovery(actor, recover_ticks)
    resolve_recovery(target, recover_ticks)
    state.log.append(
        f"{actor.name} 的 ATB 开始恢复（补偿速度 {actor.recovery_speed}，+{actor.recovery_speed * recover_ticks} ATB）。"
    )

    # 标记黑闪状态供 UI 渲染特效
    state.last_hit_was_black_flash = is_bf

    # 攻击后切换至敌人回合
    if target.is_alive and target.hp > 0:
        begin_enemy_turn(state)


def _execute_movement(actor: Character, skill: Skill, state: BattleState):
    """执行位移技能 — 移动 1 档距离"""
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
    state.log.append(
        f"{actor.name} {dir_text}至{DISTANCE_NAMES[new_dist]}距离（消耗 {cost} ATB）。"
    )


# ================================================================
#  束缚系统（Phase 3 新增）
# ================================================================

# 预设束缚定义
VOWS = {
    "offense_boost": {
        "id": "offense_boost",
        "name": "攻击强化之缚",
        "description": "放弃防御以换取攻击力。攻击伤害 +50%，但承受伤害 +30%。",
        "forbidden_type": None,     # 不禁止任何技能类型
        "bonus_damage_pct": 0.50,   # 伤害 +50%
        "penalty_dmg_taken_pct": 0.30,  # 受伤 +30%
        "speed_bonus": 0,
        "violation_hp_loss_pct": 0.20,  # 违规扣除 20% HP
    },
    "no_cursed_speed": {
        "id": "no_cursed_speed",
        "name": "禁咒加速之缚",
        "description": "立誓本回合不使用咒术，体术速度 +30%。若违规则遭受反噬。",
        "forbidden_type": "cursed",  # 禁止使用咒术
        "bonus_damage_pct": 0,
        "penalty_dmg_taken_pct": 0,
        "speed_bonus": 0.30,         # 速度 +30%（用于 ATB 恢复）
        "recovery_bonus": 0.30,      # 补偿速度 +30%
        "violation_hp_loss_pct": 0.20,
    },
}


def get_available_vows() -> list:
    """获取所有可用的束缚定义"""
    return [
        {
            "id": v["id"],
            "name": v["name"],
            "description": v["description"],
            "forbidden_type": v.get("forbidden_type"),
        }
        for v in VOWS.values()
    ]


def _handle_apply_vow(action: dict, state: BattleState):
    """应用束缚"""
    vow_id = action.get("vow_id", "")
    actor_id = action.get("actor", "player")
    actor = state.get_actor(actor_id)

    if not actor:
        return

    # 清除旧束缚
    if actor.active_vow:
        state.log.append(f"{actor.name} 解除了之前的束缚「{VOWS.get(actor.active_vow, {}.get('name', actor.active_vow))}」。")
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


def _apply_vow_effects(actor: Character, vow: dict):
    """应用束缚增益到角色"""
    # 补偿速度加成
    recovery_bonus = vow.get("recovery_bonus", 0)
    if recovery_bonus > 0:
        actor.recovery_speed = int(actor.speed * (1.0 + recovery_bonus))
    # 速度加成
    speed_bonus = vow.get("speed_bonus", 0)
    if speed_bonus > 0:
        original = actor.speed
        actor.speed = int(actor.speed * (1.0 + speed_bonus))


def _clear_vow_effects(actor: Character, vow_id: str):
    """清除束缚效果，恢复默认"""
    actor.recovery_speed = actor.speed  # 恢复速度 = 基础速度
    # 速度已在 _apply_vow_effects 中修改，此处重置
    # 注：由于 speed 是基础值，恢复时直接用 speed 覆盖 recovery_speed


def check_vow_violation(actor: Character, skill: Skill) -> bool:
    """
    检查是否违反束缚。

    Returns:
        True 如果违规（需要反噬），False 如果合规。
    """
    if not actor.active_vow:
        return False

    vow = VOWS.get(actor.active_vow)
    if not vow:
        return False

    forbidden = vow.get("forbidden_type")
    if forbidden and skill.type == forbidden:
        return True

    return False


def apply_vow_bonus_damage(actor: Character, base_damage: int) -> int:
    """应用束缚的伤害加成"""
    if not actor.active_vow:
        return base_damage

    vow = VOWS.get(actor.active_vow)
    if not vow:
        return base_damage

    bonus = vow.get("bonus_damage_pct", 0)
    if bonus > 0:
        return max(1, int(base_damage * (1.0 + bonus)))
    return base_damage


def apply_vow_penalty_damage(actor: Character, incoming_damage: int) -> int:
    """应用束缚的受伤惩罚"""
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
#  序列化/反序列化
# ================================================================

def _deserialize_state(d: dict) -> BattleState:
    """从 JSON dict 重建 BattleState 对象"""
    pd = d.get("player", {})
    ed = d.get("enemy", {})

    def _build_char(cd: dict) -> Character:
        skills = [
            Skill(
                id=s.get("id", ""),
                name=s.get("name", ""),
                cost=s.get("cost", 0),
                type=s.get("type", "martial"),
                min_distance=s.get("min_distance", DISTANCE_CLOSE),
                max_distance=s.get("max_distance", DISTANCE_FAR),
            )
            for s in cd.get("skills", [])
        ]
        return Character(
            id=cd.get("id", ""),
            name=cd.get("name", ""),
            hp=cd.get("hp", 0),
            max_hp=cd.get("max_hp", 0),
            mp=cd.get("mp", 0),
            max_mp=cd.get("max_mp", 0),
            atb=cd.get("atb", 0),
            speed=cd.get("speed", 10),
            is_alive=cd.get("is_alive", True),
            skills=skills,
            constitution=cd.get("constitution", 10),
            martial_arts=cd.get("martial_arts", 10),
            cursed_energy=cd.get("cursed_energy", 10),
            cursed_energy_control=cd.get("cursed_energy_control", 10),
            cursed_energy_efficiency=cd.get("cursed_energy_efficiency", 10),
            talent=cd.get("talent", 10),
            distance=cd.get("distance", DISTANCE_MID),
            active_vow=cd.get("active_vow"),
            recovery_speed=cd.get("recovery_speed", cd.get("speed", 10)),
        )

    return BattleState(
        player=_build_char(pd),
        enemy=_build_char(ed),
        turn=d.get("turn", "player"),
        log=d.get("log", []),
        round_number=d.get("round_number", 1),
        phase=d.get("phase", PHASE_WAITING),
        last_hit_was_black_flash=d.get("last_hit_was_black_flash", False),
    )


# ================================================================
#  初始化 API
# ================================================================

def init_battle(save_data_json: str) -> str:
    """初始化战斗状态"""
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
