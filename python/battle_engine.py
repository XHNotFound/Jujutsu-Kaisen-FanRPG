# python/battle_engine.py — 战斗引擎（纯函数，无副作用）
# 严禁：DOM 操作、print、console.log
# 调试信息请附加到 BattleState.log 中返回

import json
import random
import math
from python.models import (
    Character, Skill, BattleState,
    ATB_MAX, ATB_MOVEMENT_COST, ATB_ACTION_COST, BLACK_FLASH_BASE_RATE
)


# ================================================================
#  内部工具函数
# ================================================================

def _capped(value: int, lo: int, hi: int) -> int:
    """将 value 限制在 [lo, hi] 范围内"""
    return max(lo, min(hi, value))


def _check_black_flash(actor: Character) -> bool:
    """判定黑闪是否触发：概率 = 天赋 * 0.5%"""
    rate = actor.talent * BLACK_FLASH_BASE_RATE
    return random.random() < rate


# ================================================================
#  角色/技能构建
# ================================================================

def create_player_from_save(save_data: dict) -> Character:
    """从存档数据创建玩家角色

    save_data 结构（来自 SaveManager.buildSaveData）:
    {
        "characterName": str,
        "attributes": {
            "cursedEnergy": int,
            "cursedEnergyControl": int,
            "cursedEnergyEfficiency": int,
            "constitution": int,
            "martialArts": int,
            "talent": int
        },
        "techniqueId": str,
        "bindingId": str,
        "rank": str,
        "hp": int, "maxHp": int,
        "mp": int, "maxMp": int
    }
    """
    name = save_data.get("characterName", "无名咒术师")
    attrs = save_data.get("attributes", {})

    # 计算 HP/MP 基础值（若存档未提供则根据体质/咒力总量推算）
    constitution = attrs.get("constitution", 10)
    cursed_energy = attrs.get("cursedEnergy", 10)
    hp = save_data.get("hp", 100) or 100
    max_hp = save_data.get("maxHp", 100) or 100
    mp = save_data.get("mp", 50) or 50
    max_mp = save_data.get("maxMp", 50) or 50

    # 如果 HP/MP 为 0（默认值），根据属性派生
    if max_hp <= 0:
        max_hp = 80 + constitution * 2
    if hp <= 0:
        hp = max_hp
    if max_mp <= 0:
        max_mp = 30 + cursed_energy * 3
    if mp <= 0:
        mp = max_mp

    technique_id = save_data.get("techniqueId", "cursedEnergyBoost")

    return Character(
        id="player",
        name=name,
        hp=hp, max_hp=max_hp,
        mp=mp, max_mp=max_mp,
        atb=ATB_MAX,  # 玩家先手，初始满 ATB
        speed=8 + attrs.get("talent", 10) // 3,
        constitution=constitution,
        martial_arts=attrs.get("martialArts", 10),
        cursed_energy=cursed_energy,
        cursed_energy_control=attrs.get("cursedEnergyControl", 10),
        cursed_energy_efficiency=attrs.get("cursedEnergyEfficiency", 10),
        talent=attrs.get("talent", 10),
        skills=_build_player_skills(technique_id),
        is_alive=True
    )


def _build_player_skills(technique_id: str) -> list:
    """根据术式 ID 构建玩家技能列表

    所有角色都有基础技能。特定术式额外解锁专属技能。
    本期（Phase 2）仅实现基础技能，术式专属技能留至后续 Phase。
    """
    skills = [
        # 通用基础技能
        Skill(id="attack", name="体术平A", cost=0, type="martial",
              damage_multiplier=1.0, description="基础体术攻击，不消耗咒力"),

        Skill(id="advance", name="逼近", cost=0, type="movement",
              damage_multiplier=0, description="逼近敌人（消耗 50 ATB，不造成伤害）"),

        Skill(id="retreat", name="后退", cost=0, type="movement",
              damage_multiplier=0, description="后退拉开距离（消耗 50 ATB，不造成伤害）"),
    ]

    # 根据术式添加咒术技能
    technique_skills = {
        "cursedEnergyBoost": [
            Skill(id="cursed_boost", name="咒力强化拳", cost=10, type="cursed",
                  damage_multiplier=1.8, description="以咒力强化拳击，朴实但有效"),
        ],
        "limitless": [
            Skill(id="aoi", name="苍", cost=15, type="cursed",
                  damage_multiplier=2.2, description="吸引一切的空之涡"),
            Skill(id="aka", name="赫", cost=25, type="cursed",
                  damage_multiplier=3.0, description="排斥一切的术式顺转"),
        ],
        "tenShadows": [
            Skill(id="gyokuken", name="玉犬", cost=12, type="cursed",
                  damage_multiplier=1.6, description="召唤黑白玉犬撕咬目标"),
        ],
        "bloodManipulation": [
            Skill(id="piercing_blood", name="穿血", cost=14, type="cursed",
                  damage_multiplier=2.0, description="以高压血箭贯穿目标"),
        ],
        "boogieWoogie": [
            Skill(id="boogie_punch", name="拍手连击", cost=8, type="cursed",
                  damage_multiplier=1.5, description="利用位置交换制造破绽后进行连击"),
        ],
        "strawDoll": [
            Skill(id="doll_resonance", name="共鸣", cost=13, type="cursed",
                  damage_multiplier=1.9, description="以傀儡共鸣释放远程咒力冲击"),
        ],
    }

    sk = technique_skills.get(technique_id, [])
    if not sk:
        # 未知术式 → 使用默认术式技能
        sk = technique_skills.get("cursedEnergyBoost", [])

    skills.extend(sk)
    return skills


def create_default_enemy(enemy_tier: str = "normal") -> Character:
    """创建默认敌人

    enemy_tier 预留扩展（后期可定义不同难度敌人）。
    Phase 2 仅使用 "normal" 级。
    """
    # 蛸头 — 标准杂鱼敌人
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
                  damage_multiplier=1.0, description="用身体撞击目标"),
        ],
        is_alive=True
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

    Returns:
        最终伤害值（整数）
    """
    base_atk = actor.martial_arts * 2
    skill_bonus = skill.damage_multiplier * 10
    effective_defense = target.constitution * 0.5

    if is_black_flash:
        # 黑闪：无视 50% 防御
        effective_defense *= 0.5

    raw = base_atk + skill_bonus - effective_defense
    damage = max(1, int(raw))

    if is_black_flash:
        damage = max(1, int(damage * 2.5))

    # 添加咒力操控加成（每点 +1% 伤害，最多 50%）
    control_bonus = 1.0 + min(0.5, actor.cursed_energy_control * 0.01)
    damage = max(1, int(damage * control_bonus))

    return damage


def calculate_mp_cost(actor: Character, skill: Skill) -> int:
    """
    咒力消耗公式：
      实际消耗 = 基础消耗 * (1 - 咒力效率 * 0.005)
    结果向下取整，最低为 0
    """
    if skill.cost <= 0:
        return 0
    efficiency_factor = 1.0 - (actor.cursed_energy_efficiency * 0.005)
    efficiency_factor = max(0.3, efficiency_factor)  # 最低 30% 消耗
    return max(0, int(skill.cost * efficiency_factor))


# ================================================================
#  ATB 系统
# ================================================================

def tick_atb(state: BattleState) -> BattleState:
    """推进 ATB：双方 ATB += speed * atb_tick

    若推进后某人 ATB >= 300 且当前非其回合，切换回合归属。
    """
    state.player.atb = min(ATB_MAX, state.player.atb + int(state.player.speed * state.atb_tick))
    state.enemy.atb = min(ATB_MAX, state.enemy.atb + int(state.enemy.speed * state.atb_tick))

    # 回合切换规则：任何一方满 ATB 获得行动权
    if state.turn not in ("player_win", "enemy_win"):
        if state.player.atb >= ATB_MAX and state.enemy.atb >= ATB_MAX:
            # 双方同时满：当前回合者保持不变（先手优势）
            pass
        elif state.enemy.atb >= ATB_MAX and state.turn == "player":
            # 敌人满了但当前是玩家回合 → 只在玩家行动结束后切换
            pass

    return state


def begin_enemy_turn(state: BattleState) -> BattleState:
    """切换到敌人回合，推进 ATB 并执行敌人 AI"""
    if state.turn in ("player_win", "enemy_win"):
        return state

    # 推进 ATB 确保敌人有足够值
    state.enemy.atb = min(ATB_MAX, state.enemy.atb + int(state.enemy.speed * state.atb_tick * 2))
    state.player.atb = min(ATB_MAX, state.player.atb + int(state.player.speed * state.atb_tick))

    state.turn = "enemy"
    state.log.append("—— 敌人回合 ——")

    # 敌人 AI：选择体术技能攻击玩家
    enemy_skill = None
    for s in state.enemy.skills:
        if s.type in ("martial", "cursed") and state.enemy.mp >= s.cost:
            enemy_skill = s
            break

    if not enemy_skill:
        # 没有可用技能 → 跳过回合
        state.log.append(f"{state.enemy.name} 无法行动！")
        state.enemy.atb = 0
        state.turn = "player"
        state.log.append("—— 玩家回合 ——")
        return state

    # 执行攻击
    is_bf = _check_black_flash(state.enemy)
    damage = calculate_damage(state.enemy, enemy_skill, state.player, is_bf)
    cost = calculate_mp_cost(state.enemy, enemy_skill)

    state.enemy.mp = max(0, state.enemy.mp - cost)
    state.enemy.atb = 0  # 行动后 ATB 清零
    state.player.hp = max(0, state.player.hp - damage)

    bf_text = "【黑闪！】" if is_bf else ""
    state.log.append(f"{state.enemy.name} 使用 {enemy_skill.name}{bf_text}，造成 {damage} 点伤害。")

    # 检查玩家是否死亡
    if state.player.hp <= 0:
        state.player.is_alive = False
        state.turn = "enemy_win"
        state.log.append(f"{state.player.name} 倒下了…")
        return state

    # 敌回合结束，切换回玩家
    state.turn = "player"
    state.log.append("—— 玩家回合 ——")
    return state


# ================================================================
#  行动执行（核心 API）
# ================================================================

def execute_action(action_json: str, state_json: str) -> str:
    """
    执行战斗行动

    Args:
        action_json: JSON 字符串
            {"type": "use_skill", "actor": "player", "skill_id": "attack", "target": "enemy_1"}
        或
            {"type": "init", "save_data": {...}}
        state_json: 当前 BattleState 序列化 JSON 字符串

    Returns:
        新的 BattleState 序列化 JSON 字符串
    """
    action = json.loads(action_json)
    state_dict = json.loads(state_json)

    # 从 dict 重建 BattleState 对象
    state = _deserialize_state(state_dict)

    action_type = action.get("type", "")

    if action_type == "use_skill":
        _handle_use_skill(action, state)
    elif action_type == "tick":
        # 纯 ATB 推进（不执行行动）
        tick_atb(state)

    # 序列化返回
    return json.dumps(state.to_dict(), ensure_ascii=False)


def _handle_use_skill(action: dict, state: BattleState):
    """处理玩家使用技能"""
    actor_id = action.get("actor", "player")
    skill_id = action.get("skill_id", "attack")
    target_id = action.get("target", state.enemy.id)

    actor = state.get_actor(actor_id)
    target = state.get_target(target_id)

    if not actor or not target:
        state.log.append("[ERROR] 无效的行动者或目标。")
        return

    if actor.atb < ATB_MAX and state.turn == "player":
        # 玩家行动但 ATB 不满 → 只推进 ATB
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

    # 咒力消耗计算
    actual_cost = calculate_mp_cost(actor, skill)

    # 执行
    actor.mp = max(0, actor.mp - actual_cost)
    actor.atb = 0  # 行动后 ATB 清零
    target.hp = max(0, target.hp - damage)

    # 日志
    bf_detail = " 无视 50% 防御！" if is_bf else ""
    cost_text = f"（消耗 {actual_cost} MP）" if actual_cost > 0 else ""
    state.log.append(
        f"{actor.name} 使用 {skill.name}{cost_text}{bf_text}，造成 {damage} 点伤害。{bf_detail}"
    )

    if is_bf:
        state.log.append("漆黑的光芒一闪——那一击超越了极限。")

    # 攻击后切换至敌人回合
    if target.is_alive and target.hp > 0:
        begin_enemy_turn(state)


def _execute_movement(actor: Character, skill: Skill, state: BattleState):
    """执行位移技能 — 消耗 50 ATB，不推进 tick（与其他行动一致，由后续回合自然恢复）"""
    actor.atb = max(0, actor.atb - ATB_MOVEMENT_COST)

    dir_text = "逼近" if "advance" in skill.id else "后退"
    state.log.append(f"{actor.name} {dir_text}了。（{skill.description}）")


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
            )
            for s in cd.get("skills", [])
        ]
        # 保留属性中可能未在 JSON 中传递的字段（如 constitution 等）
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
            # 以下属性从 JSON 中读取（若存在），否则用默认值
            constitution=cd.get("constitution", 10),
            martial_arts=cd.get("martial_arts", 10),
            cursed_energy=cd.get("cursed_energy", 10),
            cursed_energy_control=cd.get("cursed_energy_control", 10),
            cursed_energy_efficiency=cd.get("cursed_energy_efficiency", 10),
            talent=cd.get("talent", 10)
        )

    return BattleState(
        player=_build_char(pd),
        enemy=_build_char(ed),
        turn=d.get("turn", "player"),
        log=d.get("log", []),
        round_number=d.get("round_number", 1),
    )


# ================================================================
#  初始化 API
# ================================================================

def init_battle(save_data_json: str) -> str:
    """
    初始化战斗状态
    Args:
        save_data_json: JSON 字符串，包含角色属性、术式、HP/MP 等
    Returns:
        BattleState 序列化 JSON 字符串
    """
    if save_data_json and save_data_json != "{}":
        try:
            save_data = json.loads(save_data_json)
        except json.JSONDecodeError:
            save_data = {}
    else:
        save_data = {}

    player = create_player_from_save(save_data)
    enemy = create_default_enemy()

    state = BattleState(player=player, enemy=enemy, turn="player")
    state.log.append("战斗开始！一股诅咒气息扑面而来。")
    state.log.append(f"遭遇了 {enemy.name}！")
    state.log.append(f"—— 玩家回合 ——")

    return json.dumps(state.to_dict(), ensure_ascii=False)
