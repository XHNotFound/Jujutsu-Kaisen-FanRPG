# python/battle_engine.py — 战斗引擎（纯函数，无副作用）
# 严禁：DOM 操作、print、console.log
# 调试信息请附加到 BattleState.log 中返回
# Phase 7 Step 4: 所有日志统一 [XX AV] 前缀格式

import json, random, math, re
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
    """统一日志：自动追加 [global_action_time AV] 前缀"""
    state.log.append(f"[{state.global_action_time} AV] {msg}")

def _capped(value: int, lo: int, hi: int) -> int: return max(lo, min(hi, value))
def _check_black_flash(actor: Unit) -> bool: return random.random() < (BLACK_FLASH_BASE_RATE + actor.talent * BLACK_FLASH_TALENT_RATE)

# ===== 距离系统 =====
def calculate_move_cost(actor: Unit, from_distance: int, to_distance: int) -> int:
    diff = abs(to_distance - from_distance)
    if diff == 0: return 0
    return max(2, diff * 10 - actor.martial_arts // 5)

def _resolve_distance(actor, skill, target, state):
    current_dist = actor.distance
    min_d, max_d = skill.min_distance, skill.max_distance
    if min_d <= current_dist <= max_d: return True
    target_dist = min_d if current_dist < min_d else max_d
    dir_text = "后退" if current_dist < min_d else "逼近"
    cost = calculate_move_cost(actor, current_dist, target_dist)
    if actor.atb < cost:
        _log(state, f"行动值不足！需要 {cost} ATB 进行位移（当前 {actor.atb}）。"); return False
    actor.atb -= cost; actor.distance = target_dist
    _log(state, f"{actor.name} 自动{dir_text}至{DISTANCE_NAMES[target_dist]}距离（消耗 {cost} ATB）。")
    return True

# ===== ATB / 恢复 =====
def _resolve_recovery(actor: Unit, delta_ticks: int = 1): actor.atb = min(ATB_MAX, actor.atb + actor.recovery_speed * delta_ticks)

def calculate_action_interval(actor: Unit, skill: Skill = None) -> int:
    ct = skill.cast_time if skill else 5
    r = max(1, actor.recovery_speed)
    s = max(1, actor.speed)
    return ct + math.ceil(300 / r) + math.ceil(300 / s)

def apply_recovery_after_action(actor: Unit, skill: Skill, state: BattleState):
    base_speed = actor.speed
    vm = 1.0
    if base_speed > 0 and actor.recovery_speed != base_speed: vm = actor.recovery_speed / base_speed
    if skill and skill.base_recovery_speed > 0: actor.recovery_speed = max(1, int(skill.base_recovery_speed * vm))
    actor.atb = 0
    interval = calculate_action_interval(actor, skill)
    ct = skill.cast_time if skill else 5; rec = actor.recovery_speed
    _resolve_recovery(actor, 1)
    state.global_action_time += interval
    _log(state, f"{actor.name} 使用了 {skill.name}，咏唱 {ct} 帧，行动间隔 {interval} 帧（补偿速度 {rec}），ATB 已恢复至 {actor.atb}/{ATB_MAX}。")

def tick_atb(state: BattleState) -> BattleState:
    p = state.find_player(); e = state.find_enemy()
    if p: p.atb = min(ATB_MAX, p.atb + int(p.speed * state.atb_tick))
    if e: e.atb = min(ATB_MAX, e.atb + int(e.speed * state.atb_tick))
    return state

# ===== 角色/技能构建 =====
def create_player_from_save(save_data: dict) -> Unit:
    name = save_data.get("characterName", "无名咒术师"); attrs = save_data.get("attributes", {})
    con, ce = attrs.get("constitution", 10), attrs.get("cursedEnergy", 10)
    hp = save_data.get("hp", 100) or 100; max_hp = save_data.get("maxHp", 100) or 100
    mp = save_data.get("mp", 50) or 50; max_mp = save_data.get("maxMp", 50) or 50
    if max_hp <= 0: max_hp = 80 + con * 2
    if hp <= 0: hp = max_hp
    if max_mp <= 0: max_mp = 30 + ce * 3
    if mp <= 0: mp = max_mp
    tid = save_data.get("techniqueId", "cursedEnergyBoost"); speed = 8 + attrs.get("talent", 10) // 3
    return Unit(id="player", name=name, unit_type=UNIT_PLAYER, hp=hp, max_hp=max_hp, mp=mp, max_mp=max_mp,
                atb=ATB_MAX, speed=speed, constitution=con, martial_arts=attrs.get("martialArts", 10),
                cursed_energy=ce, cursed_energy_control=attrs.get("cursedEnergyControl", 10),
                cursed_energy_efficiency=attrs.get("cursedEnergyEfficiency", 10), talent=attrs.get("talent", 10),
                skills=_build_player_skills(tid), is_alive=True, distance=DISTANCE_MID, active_vow=None, recovery_speed=speed)

def _build_player_skills(technique_id: str) -> list:
    BASE = [("attack","体术平A",0,"martial",1.0,5,30,0,0,"基础体术"),
            ("advance","逼近",0,"movement",0.0,3,35,0,3,"逼近1档"),
            ("retreat","后退",0,"movement",0.0,3,35,0,3,"后退1档")]
    skills = [Skill(id=id,name=name,cost=cost,type=typ,damage_multiplier=mult,cast_time=ct,base_recovery_speed=rcv,min_distance=min_d,max_distance=max_d,description=desc)
              for (id,name,cost,typ,mult,ct,rcv,min_d,max_d,desc) in BASE]
    TS = {"cursedEnergyBoost":[("cursed_boost","咒力强化拳",10,"cursed",1.8,12,28,0,0,"以咒力强化拳击")],
        "limitless":[("aoi","苍",15,"cursed",2.2,20,25,0,3,"空之涡"),("aka","赫",25,"cursed",3.0,30,18,1,3,"排斥一切"),("aoi_strike","苍·打击",22,"cursed",3.0,25,20,0,0,"近身苍"),("aoi_max","苍·最大出力",30,"cursed",4.0,35,15,0,3,"极致苍"),("aka_max","赫·最大出力",40,"cursed",4.5,40,12,1,3,"极致赫"),("murasaki","虚式·茈",50,"cursed",6.0,45,10,0,3,"撕裂空间")],
        "tenShadows":[("gyokuken","玉犬",12,"cursed",1.6,15,28,0,1,"召唤双犬"),("nue","鵺",18,"cursed",2.0,22,22,0,3,"俯冲攻击"),("orochi","大蛇",16,"cursed",1.8,18,24,0,1,"巨蛇缠绕"),("max_elephant","满象",22,"cursed",2.5,25,20,0,1,"召唤满象"),("tora_no_fun","虎葬",25,"cursed",3.0,20,22,0,3,"虎形式神"),("makora","魔虚罗",60,"cursed",8.0,60,5,0,3,"终极式神")],
        "bloodManipulation":[("blood_blade","血刃",8,"cursed",1.4,12,28,0,1,"血液利刃"),("slicing_exorcism","血涂",14,"cursed",1.8,16,24,0,1,"切割线"),("piercing_blood","穿血",14,"cursed",2.0,16,24,0,3,"高压血箭"),("supernova","超新星",22,"cursed",3.0,22,18,0,3,"凝固血液"),("crimson_binding","赤鳞跃动",20,"cursed",2.2,18,22,0,0,"强化身体"),("canal","运河",16,"cursed",2.0,20,20,0,3,"血液轨迹")],
        "boogieWoogie":[("clap_swap","拍手换位",6,"cursed",1.2,8,32,0,3,"交换位置"),("tactical_combo","战术连携",12,"cursed",2.0,12,28,0,0,"连续攻击")],
        "overtime":[("weakness","基础弱点",8,"cursed",1.3,10,30,0,1,"7:3弱点"),("ratio_strike","咒力钝器·七三",14,"cursed",2.0,15,25,0,0,"精准打击"),("collapse","瓦解",18,"cursed",2.5,20,20,0,0,"削弱防御"),("overtime","极之番·加班",25,"cursed",3.5,25,18,0,1,"加班模式")],
        "curseManipulation":[("curse_absorb","基础吞噬",10,"cursed",1.2,12,28,0,1,"吞噬咒灵"),("curse_sphere","咒灵玉储存",20,"cursed",2.5,22,20,0,3,"释放咒力"),("uzumaki_pseudo","极之番·伪",35,"cursed",4.0,30,14,0,3,"全部释放")],
        "strawDoll":[("doll_basic","基础操控",10,"cursed",1.5,14,26,0,1,"人偶攻击"),("doll_scout","远程侦查",12,"cursed",1.6,16,24,1,3,"远程侦查"),("doll_resonance","共鸣",13,"cursed",1.9,18,22,0,3,"远程冲击"),("doll_overload","傀儡自爆",30,"cursed",5.0,30,10,1,1,"引爆傀儡")],
        "pureMartial":[("martial_combo","体术连击",0,"martial",1.2,8,30,0,0,"高速连击"),("black_flash_boost","黑闪强化",0,"martial",1.5,6,32,0,0,"提升黑闪"),("rush_strike","疾风突袭",0,"martial",2.0,10,26,0,1,"速度突袭")]}
    entries = TS.get(technique_id, TS.get("cursedEnergyBoost", []))
    for (id,nm,co,ty,mu,ct,rv,md,xd,ds) in entries:
        skills.append(Skill(id=id,name=nm,cost=co,type=ty,damage_multiplier=mu,cast_time=ct,base_recovery_speed=rv,min_distance=md,max_distance=xd,description=ds))
    return skills

def create_default_enemy(enemy_tier: str = "normal") -> Unit:
    return Unit(id="enemy_1",name="蛸头",unit_type=UNIT_ENEMY,hp=120,max_hp=120,mp=0,max_mp=0,atb=0,speed=7,constitution=10,martial_arts=12,cursed_energy=0,cursed_energy_control=0,cursed_energy_efficiency=0,talent=5,skills=[Skill(id="enemy_attack",name="撞击",cost=0,type="martial",damage_multiplier=1.0,cast_time=8,base_recovery_speed=28,min_distance=0,max_distance=0,description="撞击目标")],is_alive=True,distance=DISTANCE_MID,active_vow=None,recovery_speed=7)

# ===== 伤害计算 =====
def calculate_damage(actor, skill, target, is_black_flash=False):
    ba, sb = actor.martial_arts * 2, skill.damage_multiplier * 10
    ed = target.constitution * 0.5
    if is_black_flash: ed *= 0.5
    dmg = max(1, int(ba + sb - ed))
    if is_black_flash: dmg = max(1, int(dmg * 2.5))
    cb = 1.0 + min(0.5, actor.cursed_energy_control * 0.01)
    return max(1, int(dmg * cb))

def calculate_mp_cost(actor, skill):
    if skill.cost <= 0: return 0
    ef = max(0.3, 1.0 - actor.cursed_energy_efficiency * 0.005)
    return max(0, int(skill.cost * ef))

# ===== 敌 AI =====
def begin_enemy_turn(state: BattleState) -> BattleState:
    if state.turn in ("player_win","enemy_win"): return state
    enemy = state.find_enemy()
    if not enemy: return state
    enemy.atb = min(ATB_MAX, enemy.atb + int(enemy.speed * state.atb_tick * 2))
    p = state.find_player()
    if p: p.atb = min(ATB_MAX, p.atb + int(p.speed * state.atb_tick))
    state.turn = "enemy"; state.global_action_time += 1
    _log(state, "—— 敌人回合 ——")
    es = None
    for s in enemy.skills:
        if s.type in ("martial","cursed") and enemy.mp >= s.cost: es = s; break
    if not es:
        _log(state, f"{enemy.name} 无法行动！"); enemy.atb = 0; state.turn = "player"
        _log(state, "—— 玩家回合 ——"); return state
    _resolve_distance(enemy, es, p, state)
    is_bf = _check_black_flash(enemy); dmg = calculate_damage(enemy, es, p, is_bf)
    cost = calculate_mp_cost(enemy, es)
    enemy.mp = max(0, enemy.mp - cost); enemy.atb = 0; p.hp = max(0, p.hp - dmg)
    bf_text = "【黑闪！】" if is_bf else ""
    state.global_action_time += 1
    _log(state, f"{enemy.name} 使用 {es.name}{bf_text}，造成 {dmg} 点伤害。")
    if is_bf: _log(state, "漆黑的光芒一闪——那一击超越了极限。")
    state.last_hit_was_black_flash = is_bf
    if p.hp <= 0: p.is_alive = False; state.turn = "enemy_win"; _log(state, f"{p.name} 倒下了…"); return state
    state.turn = "player"; state.phase = PHASE_WAITING
    _log(state, "—— 玩家回合 ——"); return state

# ===== 行动执行 =====
def execute_action(action_json: str, state_json: str) -> str:
    action = json.loads(action_json); state_dict = json.loads(state_json)
    state = _deserialize_state(state_dict)
    td = state_dict.get("_tracker", {}); tracker = BattleTracker()
    tracker.skill_usage = td.get("skill_usage", {})
    tracker.money_reward = td.get("money_reward", 0)
    tracker.skill_points_reward = td.get("skill_points_reward", 0)
    tracker.inspiration_gained = td.get("inspiration_gained", False)
    at = action.get("type", "")
    if at == "use_skill": _handle_use_skill(action, state, tracker)
    elif at == "tick": tick_atb(state)
    elif at == "apply_vow": _handle_apply_vow(action, state)
    elif at == "expand_domain": _handle_expand_domain(action, state)
    elif at == "domain_attack": _handle_domain_attack(action, state)
    elif at == "cancel_domain": _handle_cancel_domain(action, state)
    result = state.to_dict(); result["_tracker"] = tracker.to_dict()
    return json.dumps(result, ensure_ascii=False)

def _handle_use_skill(action: dict, state: BattleState, tracker: BattleTracker = None):
    aid = action.get("actor","player"); sid = action.get("skill_id","attack")
    e = state.find_enemy()
    tid = action.get("target", e.id if e else "enemy_1")
    actor = state.get_actor(aid); target = state.get_target(tid)
    if not actor or not target: _log(state, "[ERROR] 无效的行动者或目标。"); return
    if actor.atb < ATB_MAX and state.turn == "player":
        tick_atb(state); state.global_action_time += 1
        _log(state, f"{actor.name} 的 ATB 恢复中（{actor.atb}/{ATB_MAX}）…"); return
    skill = None
    for s in actor.skills:
        if s.id == sid: skill = s; break
    if not skill: _log(state, f"[ERROR] 未找到技能: {sid}"); return
    if actor.mp < skill.cost and skill.type == "cursed": _log(state, f"咒力不足！需要 {skill.cost} MP，当前 {actor.mp} MP。"); return
    if tracker: tracker.record_skill_use(sid)
    if skill.type == "movement": _execute_movement(actor, skill, state)
    elif skill.type in ("martial","cursed"):
        if not _resolve_distance(actor, skill, target, state): return
        _execute_attack(actor, skill, target, state)
    enemy = state.find_enemy()
    if enemy and enemy.hp <= 0: enemy.is_alive = False; state.turn = "player_win"; _log(state, f"{enemy.name} 被击败了！")

def _execute_attack(actor: Unit, skill: Skill, target: Unit, state: BattleState):
    is_bf = False
    if skill.type == "martial" and _check_black_flash(actor): is_bf = True
    bf_text = "【黑闪！】" if is_bf else ""
    dmg = calculate_damage(actor, skill, target, is_bf); cost = calculate_mp_cost(actor, skill)
    actor.mp = max(0, actor.mp - cost); target.hp = max(0, target.hp - dmg)
    bf_detail = " 无视 50% 防御！" if is_bf else ""
    cost_text = f"（消耗 {cost} MP）" if cost > 0 else ""
    _log(state, f"{actor.name} 使用 {skill.name}{cost_text}{bf_text}，造成 {dmg} 点伤害。{bf_detail}")
    if is_bf: _log(state, "漆黑的光芒一闪——那一击超越了极限。")
    apply_recovery_after_action(actor, skill, state)
    state.last_hit_was_black_flash = is_bf
    if target.is_alive and target.hp > 0: begin_enemy_turn(state)

def _execute_movement(actor: Unit, skill: Skill, state: BattleState):
    cur = actor.distance
    nd = max(0, cur - 1) if "advance" in skill.id else min(3, cur + 1)
    if nd == cur: _log(state, f"{actor.name} 已经处于边界，无法继续移动。"); return
    cost = calculate_move_cost(actor, cur, nd)
    if actor.atb < cost: _log(state, f"行动值不足！需要 {cost} ATB（当前 {actor.atb}）。"); return
    actor.atb -= cost; actor.distance = nd
    dir_text = "逼近" if nd < cur else "后退"
    _log(state, f"{actor.name} {dir_text}至{DISTANCE_NAMES[nd]}距离（消耗 {cost} ATB）。")

# ===== 束缚系统 =====
VOWS = {"offense_boost":{"id":"offense_boost","name":"攻击强化之缚","description":"攻击伤害+50%，承受伤害+30%","forbidden_type":None,"bonus_damage_pct":0.50,"penalty_dmg_taken_pct":0.30,"speed_bonus":0,"violation_hp_loss_pct":0.20},"no_cursed_speed":{"id":"no_cursed_speed","name":"禁咒加速之缚","description":"禁用咒术，体术速度+30%","forbidden_type":"cursed","bonus_damage_pct":0,"penalty_dmg_taken_pct":0,"speed_bonus":0.30,"recovery_bonus":0.30,"violation_hp_loss_pct":0.20}}

def get_available_vows(): return [{"id":v["id"],"name":v["name"],"description":v["description"],"forbidden_type":v.get("forbidden_type")} for v in VOWS.values()]

def _handle_apply_vow(action, state):
    vid = action.get("vow_id",""); aid = action.get("actor","player"); actor = state.get_actor(aid)
    if not actor: return
    if actor.active_vow: _log(state, f"{actor.name} 解除了之前的束缚。"); _clear_vow_effects(actor, actor.active_vow)
    if vid in ("none",""): actor.active_vow = None; _log(state, f"{actor.name} 选择不施加束缚。"); return
    vow = VOWS.get(vid)
    if not vow: _log(state, f"[ERROR] 未知束缚: {vid}"); return
    actor.active_vow = vid; _apply_vow_effects(actor, vow)
    _log(state, f"{actor.name} 立下束缚「{vow['name']}」——{vow['description']}")

def _apply_vow_effects(actor, vow):
    rb = vow.get("recovery_bonus",0); sb = vow.get("speed_bonus",0)
    if rb > 0: actor.recovery_speed = int(actor.speed * (1.0 + rb))
    if sb > 0: actor.speed = int(actor.speed * (1.0 + sb))
def _clear_vow_effects(actor, vid): actor.recovery_speed = actor.speed
def check_vow_violation(actor, skill):
    if not actor.active_vow: return False
    v = VOWS.get(actor.active_vow); fb = v.get("forbidden_type") if v else None
    return fb and skill.type == fb
def apply_vow_bonus_damage(actor, bd):
    if not actor.active_vow: return bd
    v = VOWS.get(actor.active_vow); bo = v.get("bonus_damage_pct",0) if v else 0
    return max(1, int(bd * (1.0 + bo))) if bo > 0 else bd
def apply_vow_penalty_damage(actor, idmg):
    if not actor.active_vow: return idmg
    v = VOWS.get(actor.active_vow); pe = v.get("penalty_dmg_taken_pct",0) if v else 0
    return max(1, int(idmg * (1.0 + pe))) if pe > 0 else idmg

# ===== 序列化 =====
def _deserialize_state(d: dict) -> BattleState:
    pd = d.get("player",{}); ed = d.get("enemy",{})
    extra = [u for u in d.get("units",[]) if u.get("id") not in (pd.get("id"), ed.get("id"))]
    def _u(cd):
        sks = [Skill(id=s.get("id",""),name=s.get("name",""),cost=s.get("cost",0),type=s.get("type","martial"),damage_multiplier=s.get("damage_multiplier",1.0),min_distance=s.get("min_distance",0),max_distance=s.get("max_distance",3),cast_time=s.get("cast_time",5),base_recovery_speed=s.get("base_recovery_speed",30)) for s in cd.get("skills",[])]
        return Unit(id=cd.get("id",""),name=cd.get("name",""),unit_type=cd.get("unit_type","player"),hp=cd.get("hp",0),max_hp=cd.get("max_hp",0),mp=cd.get("mp",0),max_mp=cd.get("max_mp",0),atb=cd.get("atb",0),speed=cd.get("speed",10),is_alive=cd.get("is_alive",True),skills=sks,constitution=cd.get("constitution",10),martial_arts=cd.get("martial_arts",10),cursed_energy=cd.get("cursed_energy",10),cursed_energy_control=cd.get("cursed_energy_control",10),cursed_energy_efficiency=cd.get("cursed_energy_efficiency",10),talent=cd.get("talent",10),distance=cd.get("distance",2),active_vow=cd.get("active_vow"),recovery_speed=cd.get("recovery_speed",cd.get("speed",10)),owner=cd.get("owner"),attack_interval=cd.get("attack_interval",0),attack_damage=cd.get("attack_damage",0),status_effects=cd.get("status_effects",[]),domain_maintenance_cost=cd.get("domain_maintenance_cost",0))
    units = [_u(pd), _u(ed)] + [_u(x) for x in extra]
    return BattleState(units=units, turn=d.get("turn","player"), log=d.get("log",[]), round_number=d.get("round_number",1), phase=d.get("phase",PHASE_WAITING), last_hit_was_black_flash=d.get("last_hit_was_black_flash",False), global_action_time=d.get("global_action_time",0))

# ===== 战后结算 =====
def generate_battle_rewards(tracker: BattleTracker, enemy_config: dict = None) -> dict:
    if enemy_config is None: enemy_config = {"money":{"min":20,"max":50},"skillPoints":1,"inspirationChance":0.05}
    money = enemy_config["money"]["min"] + random.randint(0, enemy_config["money"]["max"] - enemy_config["money"]["min"])
    sp = enemy_config.get("skillPoints",1); insp = random.random() < enemy_config.get("inspirationChance",0.05)
    pg = {sid: count * 5 for sid, count in tracker.skill_usage.items()}
    tracker.set_rewards(money, sp, insp)
    return {"money":money,"skillPoints":sp,"inspirationGained":insp,"proficiencyGains":pg}

# ===== Phase 7: 领域系统 =====
def _handle_expand_domain(action: dict, state: BattleState):
    aid = action.get("actor","player"); owner = state.find_unit(aid)
    if not owner: _log(state, "[ERROR] 展开者不存在。"); return
    if any(u.unit_type == UNIT_DOMAIN for u in state.units): _log(state, "已经存在领域，无法重复展开。"); return
    did = action.get("domain_id","d"); dn = action.get("domain_name","领域")
    ic = action.get("is_complete",True); dh = action.get("domain_hp",500)
    ai = action.get("attack_interval",15); ad = action.get("attack_damage",50); mc = action.get("mp_cost",5)
    du = Unit(id=f"{aid}_domain_{did}",name=dn,unit_type=UNIT_DOMAIN,hp=dh,max_hp=dh,mp=0,max_mp=0,atb=0,speed=0,owner=aid,attack_interval=ai,attack_damage=ad,domain_maintenance_cost=mc)
    state.units.append(du); state.global_action_time += 30
    lt = "完全领域" if ic else "不完全领域"
    _log(state, f"{owner.name} 展开了{lt}「{dn}」！领域 HP: {dh}, 攻击间隔: {ai} 帧, 伤害: {ad}")

def _handle_domain_attack(action: dict, state: BattleState):
    did = action.get("domain_id",""); domain = state.find_unit(did)
    if not domain or domain.unit_type != UNIT_DOMAIN: return
    owner = state.find_unit(domain.owner) if domain.owner else None
    if not owner: domain.is_alive = False; _log(state, "领域展开者已消失，领域破碎。"); return
    cost = domain.domain_maintenance_cost
    if owner.mp < cost: _log(state, "咒力不足，领域无法维持！"); _handle_cancel_domain({"domain_id":did}, state); return
    owner.mp -= cost
    target = state.find_enemy()
    if not target or not target.is_alive: return
    dmg = domain.attack_damage; target.hp = max(0, target.hp - dmg)
    _log(state, f"{domain.name} 自动攻击 {target.name}，造成 {dmg} 点伤害。")
    mp_penalty = max(0, int(domain.max_hp * 0.05))
    if owner.hp < owner.max_hp * 0.5:
        domain.hp = max(0, domain.hp - mp_penalty)
        _log(state, f"{owner.name} HP 低于 50%，领域受到维系损耗（-{mp_penalty} HP）。")
    if domain.hp <= 0: _handle_cancel_domain({"domain_id":did}, state); _log(state, f"{domain.name} 破碎了！")

def _handle_cancel_domain(action: dict, state: BattleState):
    did = action.get("domain_id",""); domain = state.find_unit(did)
    if not domain: return
    owner = state.find_unit(domain.owner) if domain.owner else None
    state.units = [u for u in state.units if u.id != did]; state.global_action_time += 20
    if owner:
        owner.atb = max(0, owner.atb - DOMAIN_BURNOUT_ATB_COST)
        owner.recovery_speed = max(1, int(owner.recovery_speed * (1.0 - DOMAIN_BURNOUT_SPEED_PENALTY)))
        _log(state, f"领域解除！{owner.name} 遭受熔断——扣除 {DOMAIN_BURNOUT_ATB_COST} ATB，补偿速度 -30%。")
    else: _log(state, "领域被解除。")

# ===== 初始化 =====
def init_battle(save_data_json: str) -> str:
    if save_data_json and save_data_json != "{}":
        try: save_data = json.loads(save_data_json)
        except json.JSONDecodeError: save_data = {}
    else: save_data = {}
    player = create_player_from_save(save_data); enemy = create_default_enemy()
    state = BattleState(units=[player, enemy], turn="player", phase=PHASE_WAITING)
    _log(state, "战斗开始！一股诅咒气息扑面而来。")
    _log(state, f"遭遇了 {enemy.name}！")
    _log(state, f"初始距离：{DISTANCE_NAMES[player.distance]}。")
    _log(state, "—— 玩家回合 ——")
    return json.dumps(state.to_dict(), ensure_ascii=False)
