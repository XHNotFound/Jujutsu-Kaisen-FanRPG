# python/models.py — 战斗系统数据模型
# 使用 Python dataclass 定义角色、技能、战斗状态

from dataclasses import dataclass, field
from typing import Optional


# ===== 技能定义 =====
@dataclass
class Skill:
    id: str
    name: str
    cost: int              # 咒力消耗（体术为 0）
    type: str              # "martial" | "cursed" | "movement"
    damage_multiplier: float = 1.0   # 伤害倍率
    description: str = ""

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "cost": self.cost,
            "type": self.type
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
            "skills": [s.to_dict() for s in self.skills]
        }


# ===== 战斗状态 =====
ATB_MAX = 300           # ATB 满值
ATB_MOVEMENT_COST = 50  # 位移消耗 ATB
ATB_ACTION_COST = 300   # 行动后扣除的 ATB（清零）
BLACK_FLASH_BASE_RATE = 0.005  # 黑闪基础概率 (0.5%)


@dataclass
class BattleState:
    player: Character
    enemy: Character
    turn: str = "player"     # "player" | "enemy" | "player_win" | "enemy_win"
    log: list = field(default_factory=list)
    round_number: int = 1
    atb_tick: float = 10.0   # 每次推进的 ATB 增量系数

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
            "status": "success"
        }
