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
def _check_black_flash(actor): return random.random() < (BLACK_FLASH_BASE_RATE + actor.talent * BLACK_FLASH_TALENT_RATE)

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
    """推进 global_action_time 并逐帧检查领域/敌人中断"""
    for _ in range(frames):
        state.global_action_time += FRAME_STEP
        # 1. 推进所有单位的 ATB
        for u in state.units:
            if u.is_alive:
                if u.unit_type == UNIT_DOMAIN:
                    u.atb = min(ATB_MAX, u.atb + u.attack_interval * 3)
                    if u.atb >= ATB_MAX:
                        _resolve_domain_auto_attack(u, state)
                        u.atb = 0
                elif u.unit_type in (UNIT_PLAYER, UNIT_ENEMY):
                    u.atb = min(ATB_MAX, u.atb + u.speed)
        # 2. 检查敌人是否满 ATB 且当前非敌回合
        e = state.find_enemy()
        if e and e.atb >= ATB_MAX and state.turn == "player" and e.is_alive:
            _resolve_enemy_turn(state)
            break  # 敌人回合结束后停止推进

def _check_battle_end(state: BattleState):
    """Fix 1: 统一伤亡检查"""
    p = state.find_player(); e = state.find_enemy()
    if e and e.hp <= 0 and e.is_alive:
        e.is_alive = False; state.turn = "player_win"
        _log(state, f"{e.name} 被击败了！")
        for u in list(state.units):
            if u.unit_type == UNIT_DOMAIN: _handle_cancel_domain({"domain_id": u.id}, state)
    if p and p.hp <= 0 and p.is_alive:
        p.is_alive = False; state.turn = "enemy_win"
        _log(state, f"{p.name} 倒下了…")
        for u in list(state.units):
            if u.unit_type == UNIT_DOMAIN: _handle_cancel_domain({"domain_id": u.id}, state)

def _resolve_enemy_turn(state: BattleState):
    """敌人回合（中断或正常）— Phase 8: AI-driven skill choice"""
    enemy = state.find_enemy(); p = state.find_player()
    if not enemy or not p: return
    state.turn = "enemy"; _log(state, "—— 敌人回合 ——")
    # Phase 8: 敌人 AI 决策 — 优先使用咒术技能(70%)，否则体术
    es = _decide_enemy_action(enemy, state)
    if not es: _log(state, f"{enemy.name} 无法行动！"); enemy.atb = 0; state.turn = "player"; _log(state, "—— 玩家回合 ——"); return
    _resolve_distance(enemy, es, p, state)
    is_bf = _check_black_flash(enemy); dmg = calculate_damage(enemy, es, p, is_bf)
    # Phase 8: 伤害偏移 ±20%
    dmg = apply_damage_variance(dmg, is_bf)
    cost = calculate_mp_cost(enemy, es)
    enemy.mp = max(0, enemy.mp - cost); enemy.atb = 0; p.hp = max(0, p.hp - dmg)
    ct=es.cast_time; rv=es.base_recovery_speed
    _log(state, f"{enemy.name} 使用 {es.name}{'【黑闪！】' if is_bf else ''}，造成 {dmg} 点伤害。")
    _log(state, f"{enemy.name} 咏唱 {ct} 帧，补偿速度 {rv}，ATB 已清空。")
    if is_bf: _log(state, "漆黑的光芒一闪——那一击超越了极限。")
    if is_bf: _log(state, "漆黑的光芒一闪——那一击超越了极限。")
    state.last_hit_was_black_flash = is_bf
    _check_battle_end(state)
    if state.turn in ("enemy_win","player_win"): return
    state.turn = "player"; _log(state, "—— 玩家回合 ——")

def _resolve_domain_auto_attack(domain, state):
    owner = state.find_unit(domain.owner) if domain.owner else None
    if not owner: domain.is_alive = False; _log(state, "领域展开者消失，领域破碎。"); return
    if owner.mp < domain.domain_maintenance_cost:
        _log(state, "咒力不足，领域无法维持！"); _handle_cancel_domain({"domain_id": domain.id}, state); return
    owner.mp -= domain.domain_maintenance_cost
    target = state.find_enemy()
    if not target or not target.is_alive: return
    dmg = domain.attack_damage; target.hp = max(0, target.hp - dmg)
    _log(state, f"{domain.name} 自动攻击 {target.name}，造成 {dmg} 点伤害。")
    _check_battle_end(state)
    if state.turn in ("player_win","enemy_win"): return
    if owner.hp < owner.max_hp * 0.5:
        penalty = max(0, int(domain.max_hp * 0.05))
        domain.hp = max(0, domain.hp - penalty)
        _log(state, f"{owner.name} HP 低于 50%，领域维系损耗（-{penalty} HP）。")
    if domain.hp <= 0: _handle_cancel_domain({"domain_id": domain.id}, state); _log(state, f"{domain.name} 破碎了！")

# ===== 角色/技能构建 =====
def create_player_from_save(save_data):
    name = save_data.get("characterName", "无名咒术师"); attrs = save_data.get("attributes", {})
    con, ce = attrs.get("constitution",10), attrs.get("cursedEnergy",10)
    hp = save_data.get("hp",100) or 100; mhp = save_data.get("maxHp",100) or 100
    mp = save_data.get("mp",50) or 50; mmp = save_data.get("maxMp",50) or 50
    if mhp <= 0: mhp = 80 + con * 2
    if hp <= 0: hp = mhp
    if mmp <= 0: mmp = 30 + ce * 3
    if mp <= 0: mp = mmp
    tid = save_data.get("techniqueId","cursedEnergyBoost"); spd = 8 + attrs.get("talent",10) // 3
    return Unit(id="player",name=name,unit_type=UNIT_PLAYER,hp=hp,max_hp=mhp,mp=mp,max_mp=mmp,
                atb=ATB_MAX,speed=spd,constitution=con,martial_arts=attrs.get("martialArts",10),
                cursed_energy=ce,cursed_energy_control=attrs.get("cursedEnergyControl",10),
                cursed_energy_efficiency=attrs.get("cursedEnergyEfficiency",10),talent=attrs.get("talent",10),
                skills=_build_player_skills(tid, save_data.get("skillLevels", {})),
                is_alive=True,distance=DISTANCE_MID,active_vow=None,recovery_speed=spd)

def _build_player_skills(tid, skill_levels=None):
    """Build skills based on unlocked skills in skillLevels. Only base + unlocked branch skills are included."""
    if skill_levels is None: skill_levels = {}
    B=[("attack","体术平A",0,"martial",1.0,5,30,0,0,"基础体术"),("advance","逼近",0,"movement",0.0,3,35,0,3,"逼近1档"),("retreat","后退",0,"movement",0.0,3,35,0,3,"后退1档")]
    sk=[Skill(id=i,name=n,cost=c,type=t,damage_multiplier=m,cast_time=ct,base_recovery_speed=r,min_distance=mn,max_distance=mx,description=d) for (i,n,c,t,m,ct,r,mn,mx,d) in B]
    TS={"cursedEnergyBoost":[("cursed_boost","咒力强化拳",10,"cursed",1.8,12,28,0,0,"以咒力强化拳击")],
        "limitless":[("aoi","苍",15,"cursed",2.2,20,25,0,3,"空之涡"),("aka","赫",25,"cursed",3.0,30,18,1,3,"排斥一切"),("aoi_strike","苍·打击",22,"cursed",3.0,25,20,0,0,"近身苍"),("aoi_max","苍·最大出力",30,"cursed",4.0,35,15,0,3,"极致苍"),("aka_max","赫·最大出力",40,"cursed",4.5,40,12,1,3,"极致赫"),("murasaki","虚式·茈",50,"cursed",6.0,45,10,0,3,"撕裂空间")],
        "tenShadows":[("gyokuken","玉犬",12,"cursed",1.6,15,28,0,1,"召唤双犬"),("nue","鵺",18,"cursed",2.0,22,22,0,3,"俯冲攻击"),("orochi","大蛇",16,"cursed",1.8,18,24,0,1,"巨蛇缠绕"),("max_elephant","满象",22,"cursed",2.5,25,20,0,1,"召唤满象"),("tora_no_fun","虎葬",25,"cursed",3.0,20,22,0,3,"虎形式神"),("makora","魔虚罗",60,"cursed",8.0,60,5,0,3,"终极式神")],
        "bloodManipulation":[("blood_blade","血刃",8,"cursed",1.4,12,28,0,1,"血液利刃"),("slicing_exorcism","血涂",14,"cursed",1.8,16,24,0,1,"切割线"),("piercing_blood","穿血",14,"cursed",2.0,16,24,0,3,"高压血箭"),("supernova","超新星",22,"cursed",3.0,22,18,0,3,"凝固血液"),("crimson_binding","赤鳞跃动",20,"cursed",2.2,18,22,0,0,"强化身体"),("canal","运河",16,"cursed",2.0,20,20,0,3,"血液轨迹")],
        "boogieWoogie":[("clap_swap","拍手换位",6,"cursed",1.2,8,32,0,3,"交换位置"),("tactical_combo","战术连携",12,"cursed",2.0,12,28,0,0,"连续攻击")],
        "overtime":[("weakness","基础弱点",8,"cursed",1.3,10,30,0,1,"7:3弱点"),("ratio_strike","咒力钝器·七三",14,"cursed",2.0,15,25,0,0,"精准打击"),("collapse","瓦解",18,"cursed",2.5,20,20,0,0,"削弱防御"),("overtime","极之番·加班",25,"cursed",3.5,25,18,0,1,"加班模式")],
        "curseManipulation":[("curse_absorb","基础吞噬",10,"cursed",1.2,12,28,0,1,"吞噬咒灵"),("curse_sphere","咒灵玉储存",20,"cursed",2.5,22,20,0,3,"释放咒力"),("uzumaki_pseudo","极之番·伪",35,"cursed",4.0,30,14,0,3,"全部释放")],
        "strawDoll":[("doll_basic","基础操控",10,"cursed",1.5,14,26,0,1,"人偶攻击"),("doll_scout","远程侦查",12,"cursed",1.6,16,24,1,3,"远程侦查"),("doll_resonance","共鸣",13,"cursed",1.9,18,22,0,3,"远程冲击"),("doll_overload","傀儡自爆",30,"cursed",5.0,30,10,1,1,"引爆傀儡")],
        "pureMartial":[("martial_combo","体术连击",0,"martial",1.2,8,30,0,0,"高速连击"),("black_flash_boost","黑闪强化",0,"martial",1.5,6,32,0,0,"提升黑闪"),("rush_strike","疾风突袭",0,"martial",2.0,10,26,0,1,"速度突袭")]}
    for e in TS.get(tid, TS.get("cursedEnergyBoost",[])):
        # Fix: only include branch skills if unlocked in skillLevels (not all skills)
        skill_id = e[0]
        # Base skills (aoi/aka/gyokuken etc.) are always available.
        # Branch skills require skillLevels[skill_id] >= 1
        branch_skills = {"aoi_strike","aoi_max","aka_max","murasaki","nue","orochi","max_elephant","tora_no_fun","makora",
                         "slicing_exorcism","supernova","crimson_binding","canal",
                         "tactical_combo","ratio_strike","collapse","overtime",
                         "curse_sphere","uzumaki_pseudo","doll_scout","doll_overload",
                         "black_flash_boost","rush_strike"}
        if skill_id in branch_skills and skill_levels.get(skill_id, 0) < 1:
            continue  # skip unlocked branch skills
        sk.append(Skill(id=e[0],name=e[1],cost=e[2],type=e[3],damage_multiplier=e[4],cast_time=e[5],base_recovery_speed=e[6],min_distance=e[7],max_distance=e[8],description=e[9]))
    return sk

def create_default_enemy(tier="normal"):
    """Phase 8: 根据玩家评定动态生成中低级咒灵"""
    return Unit(id="enemy_1",name="蛸头",unit_type=UNIT_ENEMY,hp=80,max_hp=80,mp=20,max_mp=20,atb=0,speed=7,constitution=10,martial_arts=12,cursed_energy=8,cursed_energy_control=8,cursed_energy_efficiency=6,talent=5,
                skills=[Skill(id="enemy_attack",name="撞击",cost=0,type="martial",damage_multiplier=1.0,cast_time=8,base_recovery_speed=28,min_distance=0,max_distance=0,description="身体撞击"),
                        Skill(id="enemy_cursed_blast",name="诅咒弹",cost=8,type="cursed",damage_multiplier=1.3,cast_time=18,base_recovery_speed=22,min_distance=1,max_distance=3,description="诅咒能量弹")],
                is_alive=True,distance=DISTANCE_MID,active_vow=None,recovery_speed=7)

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
    """Phase 8: 敌人 AI 决策 — 70%概率使用咒术技能(如有MP), 否则体术"""
    available = [s for s in enemy.skills if s.type in ("martial","cursed") and enemy.mp >= s.cost]
    if not available: return None
    cursed = [s for s in available if s.type == "cursed"]
    if cursed and random.random() < 0.7:
        cursed.sort(key=lambda s: -s.damage_multiplier)
        return cursed[0]
    martial = [s for s in available if s.type == "martial"]
    return martial[0] if martial else (available[0] if available else None)

def calculate_mp_cost(actor, skill):
    if skill.cost <= 0: return 0
    return max(0, int(skill.cost * max(0.3, 1.0 - actor.cursed_energy_efficiency * 0.005)))

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
    if actor.mp < skill.cost and skill.type == "cursed":
        _log(state, f"咒力不足！需要 {skill.cost} MP，当前 {actor.mp} MP。"); return
    if tracker: tracker.record_skill_use(sid)
    if skill.type == "movement": _execute_movement(actor, skill, state)
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
    if skill.type == "martial" and _check_black_flash(actor): is_bf = True
    dmg = calculate_damage(actor, skill, target, is_bf)
    dmg = apply_damage_variance(dmg, is_bf)  # Phase 8: 伤害偏移
    cost = calculate_mp_cost(actor, skill)
    actor.mp = max(0, actor.mp - cost); target.hp = max(0, target.hp - dmg)
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
        sks=[Skill(id=s.get("id",""),name=s.get("name",""),cost=s.get("cost",0),type=s.get("type","martial"),damage_multiplier=s.get("damage_multiplier",1.0),min_distance=s.get("min_distance",0),max_distance=s.get("max_distance",3),cast_time=s.get("cast_time",5),base_recovery_speed=s.get("base_recovery_speed",30)) for s in cd.get("skills",[])]
        return Unit(id=cd.get("id",""),name=cd.get("name",""),unit_type=cd.get("unit_type","player"),hp=cd.get("hp",0),max_hp=cd.get("max_hp",0),mp=cd.get("mp",0),max_mp=cd.get("max_mp",0),atb=cd.get("atb",0),speed=cd.get("speed",10),is_alive=cd.get("is_alive",True),skills=sks,constitution=cd.get("constitution",10),martial_arts=cd.get("martial_arts",10),cursed_energy=cd.get("cursed_energy",10),cursed_energy_control=cd.get("cursed_energy_control",10),cursed_energy_efficiency=cd.get("cursed_energy_efficiency",10),talent=cd.get("talent",10),distance=cd.get("distance",2),active_vow=cd.get("active_vow"),recovery_speed=cd.get("recovery_speed",cd.get("speed",10)),owner=cd.get("owner"),attack_interval=cd.get("attack_interval",0),attack_damage=cd.get("attack_damage",0),status_effects=cd.get("status_effects",[]),domain_maintenance_cost=cd.get("domain_maintenance_cost",0))
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
    if any(u.unit_type==UNIT_DOMAIN for u in state.units): _log(state,"已经存在领域，无法重复展开。"); return
    did=action.get("domain_id","d"); dn=action.get("domain_name","领域")
    ic=action.get("is_complete",True); dh=action.get("domain_hp",500)
    ai=action.get("attack_interval",15); ad=action.get("attack_damage",50); mc=action.get("mp_cost",5)
    du=Unit(id=f"{aid}_domain_{did}",name=dn,unit_type=UNIT_DOMAIN,hp=dh,max_hp=dh,mp=0,max_mp=0,atb=0,speed=0,owner=aid,attack_interval=ai,attack_damage=ad,domain_maintenance_cost=mc)
    lt="完全领域" if ic else "不完全领域"
    _log(state, f"{owner.name} 展开了{lt}\"{dn}\"！领域 HP: {dh}, 攻击间隔: {ai} 帧, 伤害: {ad}")
    state.units.append(du); _advance_time(state, 10)

def _handle_cancel_domain(action, state):
    did=action.get("domain_id",""); domain=state.find_unit(did)
    if not domain: return
    owner=state.find_unit(domain.owner) if domain.owner else None
    state.units=[u for u in state.units if u.id!=did]; _advance_time(state, 20)
    if owner:
        owner.atb=max(0,owner.atb-DOMAIN_BURNOUT_ATB_COST)
        owner.recovery_speed=max(1,int(owner.recovery_speed*(1.0-DOMAIN_BURNOUT_SPEED_PENALTY)))
        _log(state,f"领域解除！{owner.name} 遭受熔断——扣除 {DOMAIN_BURNOUT_ATB_COST} ATB，补偿速度 -30%。")
    else: _log(state,"领域被解除。")

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
    player=create_player_from_save(save_data); enemy=create_default_enemy()
    state=BattleState(units=[player,enemy],turn="player",phase=PHASE_WAITING)
    _log(state,"战斗开始！一股诅咒气息扑面而来。")
    _log(state,f"遭遇了 {enemy.name}！")
    _log(state,f"初始距离：{DISTANCE_NAMES[player.distance]}。")
    _log(state,"—— 玩家回合 ——")
    return json.dumps(state.to_dict(),ensure_ascii=False)
