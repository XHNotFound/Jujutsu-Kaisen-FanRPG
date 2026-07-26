# python/models.py — 战斗系统数据模型 (Phase 7 多单位架构)
# 使用 Python dataclass 定义战斗单位、技能、战斗状态

from dataclasses import dataclass, field
from typing import Optional


# ===== 距离常量 =====
DISTANCE_CLOSE = 0
DISTANCE_NEAR = 1
DISTANCE_MID = 2
DISTANCE_FAR = 3
DISTANCE_NAMES = {0: "贴身", 1: "近", 2: "中", 3: "远"}

# ===== 单位类型 =====
UNIT_PLAYER = "player"
UNIT_ENEMY = "enemy"
UNIT_DOMAIN = "domain"
UNIT_SHIKIGAMI = "shikigami"

# ===== 战斗阶段 =====
PHASE_WAITING = "waiting"
PHASE_CHANTING = "chanting"
PHASE_RECOVERY = "recovery"

# ===== 常量 =====
ATB_MAX = 300
ATB_MOVEMENT_COST = 50
ATB_ACTION_COST = 300
BLACK_FLASH_BASE_RATE = 0.01
BLACK_FLASH_TALENT_RATE = 0.005

# Phase 7: 领域熔断效果
DOMAIN_BURNOUT_ATB_COST = 60  # 熔断时扣除行动值
DOMAIN_BURNOUT_SPEED_PENALTY = 0.30  # 熔断时体术补偿速度 -30%


# ===== 技能定义 =====
@dataclass
class Skill:
    id: str
    name: str
    cost: int
    type: str              # "martial" | "cursed" | "movement" | "domain_expand" | "summon"
    category: str = ""     # Phase 16: "martial"|"cursed_martial"|"cursed_attack"|"cursed_summon"|"cursed_buff"|"cursed_control"
    damage_multiplier: float = 1.0
    description: str = ""
    min_distance: int = DISTANCE_CLOSE
    max_distance: int = DISTANCE_FAR
    cast_time: int = 5
    base_recovery_speed: int = 30
    summon_config: Optional[dict] = None  # Phase 9: summon skill config

    def to_dict(self):
        d = {
            "id": self.id, "name": self.name, "cost": self.cost, "type": self.type,
            "category": self.category,
            "damage_multiplier": self.damage_multiplier,
            "min_distance": self.min_distance, "max_distance": self.max_distance,
            "cast_time": self.cast_time, "base_recovery_speed": self.base_recovery_speed
        }
        if self.summon_config:
            d["summon_config"] = self.summon_config
        return d


# ===== Phase 7: 通用战斗单位 (取代单一 Character) =====
@dataclass
class Unit:
    """多单位架构核心 — 玩家、敌人、领域、式神均视为 Unit"""
    id: str
    name: str
    unit_type: str = UNIT_PLAYER  # "player" | "enemy" | "domain" | "shikigami"
    hp: int = 100
    max_hp: int = 100
    mp: int = 0
    max_mp: int = 0
    atb: int = 0
    speed: int = 10
    constitution: int = 10
    martial_arts: int = 10
    cursed_energy: int = 10
    cursed_energy_control: int = 10
    cursed_energy_efficiency: int = 10
    talent: int = 10
    skills: list = field(default_factory=list)
    is_alive: bool = True
    distance: int = DISTANCE_MID
    active_vow: Optional[str] = None
    recovery_speed: int = 10
    # Phase 7: 多单位特有字段
    owner: Optional[str] = None        # 所属单位 ID（领域→展开者）
    attack_interval: int = 0           # 领域专属：攻击间隔
    attack_damage: int = 0             # 领域专属：单次伤害
    status_effects: list = field(default_factory=list)  # 状态效果
    domain_maintenance_cost: int = 0   # 领域继承消耗
    summon_duration: int = 0           # Phase 9: 召唤物剩余持续时间（行动值）
    aggro: int = 0                     # Phase 9: 仇恨值
    # Phase 10: 弱者防御手段 / 领域对抗 Buff
    domain_counter_buffs: list = field(default_factory=list)  # [{id, name, type, hp, mpDrainRate, ...}]
    # Phase 10: 敌人领域展开 AI 暂存字段（非 dataclass 字段，运行时动态设置）
    domain_name: Optional[str] = None
    domain_hp: int = 500

    def to_dict(self):
        d = {
            "id": self.id, "name": self.name, "unit_type": self.unit_type,
            "hp": self.hp, "max_hp": self.max_hp,
            "mp": self.mp, "max_mp": self.max_mp,
            "atb": self.atb, "speed": self.speed,
            "constitution": self.constitution, "martial_arts": self.martial_arts,
            "cursed_energy": self.cursed_energy, "cursed_energy_control": self.cursed_energy_control,
            "cursed_energy_efficiency": self.cursed_energy_efficiency, "talent": self.talent,
            "is_alive": self.is_alive,
            "distance": self.distance, "active_vow": self.active_vow,
            "recovery_speed": self.recovery_speed,
            "owner": self.owner,
            "attack_interval": self.attack_interval,
            "attack_damage": self.attack_damage,
            "status_effects": list(self.status_effects),
            "domain_maintenance_cost": self.domain_maintenance_cost,
            "summon_duration": self.summon_duration,
            "aggro": self.aggro,
            "domain_counter_buffs": list(self.domain_counter_buffs),
            "domain_name": self.domain_name,
            "domain_hp": self.domain_hp,
            "skills": [s.to_dict() for s in self.skills]
        }
        return d


# ===== Phase 4: 战斗内追踪器 =====
class BattleTracker:
    """战斗内追踪器 — 记录技能使用次数与奖励数据"""
    def __init__(self):
        self.skill_usage = {}
        self.money_reward = 0
        self.skill_points_reward = 0
        self.inspiration_gained = False

    def record_skill_use(self, skill_id: str):
        self.skill_usage[skill_id] = self.skill_usage.get(skill_id, 0) + 1

    def set_rewards(self, money: int, skill_points: int, inspiration: bool):
        self.money_reward = money
        self.skill_points_reward = skill_points
        self.inspiration_gained = inspiration

    def to_dict(self):
        return {
            "skill_usage": dict(self.skill_usage),
            "money_reward": self.money_reward,
            "skill_points_reward": self.skill_points_reward,
            "inspiration_gained": self.inspiration_gained
        }


# ===== Phase 7: 多单位战斗状态 =====
@dataclass
class BattleState:
    """多单位战斗状态 — units[] 数组统一管理所有战斗实体"""
    units: list = field(default_factory=list)  # Phase 7: 所有战斗单位
    turn: str = "player"
    log: list = field(default_factory=list)
    round_number: int = 1
    atb_tick: float = 10.0
    phase: str = PHASE_WAITING
    last_hit_was_black_flash: bool = False
    global_action_time: int = 0  # Phase 7: 全局行动时间

    # ===== Unit 查找辅助 =====
    def find_unit(self, unit_id: str):
        for u in self.units:
            if u.id == unit_id:
                return u
        return None

    def get_actor(self, actor_id: str):
        """兼容旧 API"""
        return self.find_unit(actor_id)

    def get_target(self, target_id: str):
        """兼容旧 API"""
        return self.find_unit(target_id)

    def get_opponent(self, actor_id: str):
        """获取对手 — 返回类型为 enemy 的第一个单位"""
        actor_type = None
        for u in self.units:
            if u.id == actor_id:
                actor_type = u.unit_type
                break
        if actor_type == UNIT_PLAYER:
            return self.find_enemy()
        else:
            return self.find_player()

    def find_player(self):
        for u in self.units:
            if u.unit_type == UNIT_PLAYER:
                return u
        return None

    def find_enemy(self):
        for u in self.units:
            if u.unit_type == UNIT_ENEMY:
                return u
        return None

    # Phase 9: aggro-based target selection
    def find_enemy_target(self, acting_unit=None):
        """敌人从友方单位中选择仇恨最高者攻击"""
        friendlies = [u for u in self.units
                      if u.unit_type in (UNIT_PLAYER, UNIT_SHIKIGAMI) and u.is_alive]
        if not friendlies:
            return self.find_player()
        # 选 aggro 最高的；同值优先 player
        target = max(friendlies, key=lambda u: (u.aggro or 0))
        return target

    # ===== 向后兼容属性 =====
    @property
    def player(self):
        return self.find_player()

    @property
    def enemy(self):
        return self.find_enemy()

    def to_dict(self):
        p = self.find_player()
        e = self.find_enemy()
        result = {
            "player": p.to_dict() if p else None,
            "enemy": e.to_dict() if e else None,  # 死亡敌人仍序列化
            "units": [u.to_dict() for u in self.units],  # Phase 7: 完整单位列表
            "turn": self.turn,
            "log": self.log,
            "round_number": self.round_number,
            "phase": self.phase,
            "last_hit_was_black_flash": self.last_hit_was_black_flash,
            "global_action_time": self.global_action_time,
            "status": "success",
            "domain_clash_active": getattr(self, 'domain_clash_active', False)
        }
        # 移除 None 值
        if result["player"] is None:
            del result["player"]
        if result["enemy"] is None:
            del result["enemy"]
        return result
