# python/models.py — 战斗系统数据模型
# 使用 Python dataclass 定义角色、技能、战斗状态

from dataclasses import dataclass, field
from typing import Optional


# ===== 距离常量 =====
DISTANCE_CLOSE = 0    # 贴身
DISTANCE_NEAR = 1     # 近
DISTANCE_MID = 2      # 中
DISTANCE_FAR = 3      # 远
DISTANCE_NAMES = {0: "贴身", 1: "近", 2: "中", 3: "远"}

# ===== 技能定义 =====
@dataclass
class Skill:
    id: str
    name: str
    cost: int              # 咒力消耗（体术为 0）
    type: str              # "martial" | "cursed" | "movement"
    damage_multiplier: float = 1.0   # 伤害倍率
    description: str = ""
    # Phase 3 新增：技能适用距离范围
    min_distance: int = DISTANCE_CLOSE
    max_distance: int = DISTANCE_FAR
    # Phase 4 新增：咏唱时间与补偿速度
    cast_time: int = 5              # 咏唱时间（帧/tick），体术默认 5
    base_recovery_speed: int = 30   # 基础补偿速度，体术默认 30

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "cost": self.cost,
            "type": self.type,
            "damage_multiplier": self.damage_multiplier,
            "min_distance": self.min_distance,
            "max_distance": self.max_distance,
            "cast_time": self.cast_time,
            "base_recovery_speed": self.base_recovery_speed
        }


# ===== 角色定义 =====
@dataclass
class Character:
    id: str
    name: str
    hp: int
    max_hp: int
    mp: int
    max_mp: int
    atb: int = 0                       # 当前 ATB 值 (0~300)
    speed: int = 10                    # 速度（影响 ATB 积累速率）
    constitution: int = 10             # 体质（减伤）
    martial_arts: int = 10             # 体术水平（物理攻击力）
    cursed_energy: int = 10            # 咒力总量
    cursed_energy_control: int = 10    # 咒力操控
    cursed_energy_efficiency: int = 10 # 咒力效率（降低咒力消耗）
    talent: int = 10                   # 天赋（影响黑闪概率等）
    skills: list = field(default_factory=list)
    is_alive: bool = True
    # Phase 3 新增字段
    distance: int = DISTANCE_MID       # 当前距离档位
    active_vow: Optional[str] = None   # 当前激活的束缚 ID
    recovery_speed: int = 10           # 补偿速度（基础值 = 角色速度）

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "hp": self.hp,
            "max_hp": self.max_hp,
            "mp": self.mp,
            "max_mp": self.max_mp,
            "atb": self.atb,
            "speed": self.speed,
            "constitution": self.constitution,
            "martial_arts": self.martial_arts,
            "cursed_energy": self.cursed_energy,
            "cursed_energy_control": self.cursed_energy_control,
            "cursed_energy_efficiency": self.cursed_energy_efficiency,
            "talent": self.talent,
            "is_alive": self.is_alive,
            "distance": self.distance,
            "active_vow": self.active_vow,
            "recovery_speed": self.recovery_speed,
            "skills": [s.to_dict() for s in self.skills]
        }


# ===== 战斗状态 =====
ATB_MAX = 300           # ATB 满值
ATB_MOVEMENT_COST = 50  # 位移消耗 ATB（基础值）
ATB_ACTION_COST = 300   # 行动后扣除的 ATB（清零）
BLACK_FLASH_BASE_RATE = 0.01   # 黑闪基础概率 (1%)
BLACK_FLASH_TALENT_RATE = 0.005  # 黑闪天赋加成 (0.5%/点)

# Phase 3: 战斗阶段
PHASE_WAITING = "waiting"      # 等待玩家输入
PHASE_CHANTING = "chanting"    # 咏唱中（预留）
PHASE_RECOVERY = "recovery"    # ATB 恢复中


# Phase 4: 战斗内追踪器（移到这里避免循环导入）
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


@dataclass
class BattleState:
    player: Character
    enemy: Character
    turn: str = "player"     # "player" | "enemy" | "player_win" | "enemy_win"
    log: list = field(default_factory=list)
    round_number: int = 1
    atb_tick: float = 10.0   # 每次推进的 ATB 增量系数
    phase: str = PHASE_WAITING  # Phase 3: 当前战斗阶段
    # Phase 3: 上一击是否为黑闪（供 UI 渲染特效）
    last_hit_was_black_flash: bool = False

    def get_actor(self, actor_id: str) -> Character:
        """根据 ID 获取角色"""
        if actor_id == self.player.id:
            return self.player
        elif actor_id == self.enemy.id:
            return self.enemy
        return None

    def get_target(self, target_id: str) -> Character:
        """根据 ID 获取目标"""
        return self.get_actor(target_id)

    def get_opponent(self, actor_id: str) -> Character:
        """获取对手"""
        if actor_id == self.player.id:
            return self.enemy
        else:
            return self.player

    def to_dict(self):
        return {
            "player": self.player.to_dict(),
            "enemy": self.enemy.to_dict(),
            "turn": self.turn,
            "log": self.log,
            "round_number": self.round_number,
            "phase": self.phase,
            "last_hit_was_black_flash": self.last_hit_was_black_flash,
            "status": "success"
        }
