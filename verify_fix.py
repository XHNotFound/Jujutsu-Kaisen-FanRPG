"""E2E test: verify the temp-file fix works for domain + attack."""
import sys, json, io
sys.path.insert(0, "E:/jujustu kaisen 3")
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

exec(open("E:/jujustu kaisen 3/python/models.py", encoding="utf-8").read())
exec(open("E:/jujustu kaisen 3/python/battle_engine.py", encoding="utf-8").read())

save_data = {
    "characterName": "test", "techniqueId": "boogieWoogie",
    "attributes": {"cursedEnergy": 22, "cursedEnergyControl": 55, "cursedEnergyEfficiency": 22, "constitution": 19, "martialArts": 26, "talent": 21},
    "skillLevels": {"clap_swap": 5, "tactical_combo": 5, "attack": 5},
    "hp": 500, "maxHp": 500, "mp": 300, "maxMp": 300,
    "domainUnlocked": "boogieWoogie", "domainLearnedTiers": {"boogieWoogie": "complete"},
    "inspiration": 5, "rank": "四级"
}

# Init
state_json = init_battle(json.dumps(save_data))
state = json.loads(state_json)
print("Step 1 - Init: OK, enemy=" + state["enemy"]["name"])

# Boost enemy HP
for u in state["units"]:
    if u.get("unit_type") == "enemy":
        u["hp"] = 9999
        u["max_hp"] = 9999

# Expand domain with low damage
state_json = execute_action(json.dumps({
    "type": "expand_domain", "actor": "player",
    "domain_id": "test_d", "domain_name": "Test",
    "is_complete": True, "domain_hp": 500, "attack_interval": 99,
    "attack_damage": 1, "mp_cost": 5
}), json.dumps(state))
state = json.loads(state_json)
errs = [l for l in state["log"] if "ERROR" in l.upper()]
domains = [u for u in state["units"] if u["unit_type"] == "domain"]
print(f"Step 2 - Expand domain: OK, domains={len(domains)}, errors={len(errs)}")

# Attack (this should NOT fail)
state_json = execute_action(json.dumps({
    "type": "use_skill", "actor": "player",
    "skill_id": "attack", "target": "enemy_1"
}), json.dumps(state))
state = json.loads(state_json)
errs = [l for l in state["log"] if "ERROR" in l.upper()]
print(f"Step 3 - Attack with domain active: errors={len(errs)}")

# Apply vow (this should NOT fail)
state_json = execute_action(json.dumps({
    "type": "apply_vow", "actor": "player", "vow_id": "offense_boost"
}), json.dumps(state))
state = json.loads(state_json)
errs = [l for l in state["log"] if "ERROR" in l.upper()]
print(f"Step 4 - Apply vow: errors={len(errs)}")

# Cancel domain (this should NOT fail)
d_id = [u["id"] for u in state["units"] if u["unit_type"] == "domain"]
if d_id:
    state_json = execute_action(json.dumps({
        "type": "cancel_domain", "domain_id": d_id[0]
    }), json.dumps(state))
    state = json.loads(state_json)
    errs = [l for l in state["log"] if "ERROR" in l.upper()]
    print(f"Step 5 - Cancel domain: errors={len(errs)}")
else:
    print("Step 5 - Cancel domain: SKIPPED (no domain)")

# Attack again after cancel
state_json = execute_action(json.dumps({
    "type": "use_skill", "actor": "player",
    "skill_id": "attack", "target": "enemy_1"
}), json.dumps(state))
state = json.loads(state_json)
errs = [l for l in state["log"] if "ERROR" in l.upper()]
print(f"Step 6 - Attack after cancel: errors={len(errs)}")

print("\nALL STEPS PASSED" if not errs else f"\nFAILURES: {errs}")
