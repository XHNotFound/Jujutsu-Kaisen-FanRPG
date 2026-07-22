"""Test the JSON temp-file fix: init → expand domain → attack, all via execute_action."""
import sys, json, io
sys.path.insert(0, 'E:/jujustu kaisen 3')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
exec(open('E:/jujustu kaisen 3/python/models.py', encoding='utf-8').read())
exec(open('E:/jujustu kaisen 3/python/battle_engine.py', encoding='utf-8').read())

save_data = {
    'characterName': 'test', 'techniqueId': 'boogieWoogie',
    'attributes': {'cursedEnergy': 22, 'cursedEnergyControl': 55, 'cursedEnergyEfficiency': 22, 'constitution': 19, 'martialArts': 26, 'talent': 21},
    'skillLevels': {'clap_swap': 5, 'tactical_combo': 5, 'attack': 5},
    'hp': 500, 'maxHp': 500, 'mp': 300, 'maxMp': 300,
    'domainUnlocked': 'boogieWoogie', 'domainLearnedTiers': {'boogieWoogie': 'complete'},
    'inspiration': 5, 'rank': '四级'
}

# Step 1: Init battle
state_json = init_battle(json.dumps(save_data))
state = json.loads(state_json)
print(f'Step 1 - Init: enemy={state["enemy"]["name"]} hp={state["enemy"]["hp"]}')
print(f'  Player: hp={state["player"]["hp"]} atb={state["player"]["atb"]}')

# Boost enemy HP so it survives domain attack
for u in state['units']:
    if u.get('unit_type') == 'enemy':
        u['hp'] = 9999
        u['max_hp'] = 9999

# Step 2: Expand domain (simulating JS fix: file → json.load → json.dumps → execute_action)
# This is exactly what the JS fix does
expand_action_dict = {
    'type': 'expand_domain', 'actor': 'player',
    'domain_id': 'test_d', 'domain_name': 'Test',
    'is_complete': True, 'domain_hp': 500, 'attack_interval': 99,
    'attack_damage': 1, 'mp_cost': 5
}
# JS writes to FS file, Python reads: json.load(file) → dict → json.dumps → execute_action
# So the flow is: action_dict → json.dumps → json.loads → json.dumps → json.loads
# Which is equivalent to: action_dict → json.dumps → execute_action(json.dumps(action_dict), ...)
state_json = execute_action(json.dumps(expand_action_dict), json.dumps(state))
state = json.loads(state_json)
errs = [l for l in state['log'] if 'ERROR' in l.upper()]
print(f'Step 2 - Domain: units={len(state["units"])} errors={errs}')
domain_unit = [u for u in state['units'] if u['unit_type'] == 'domain']
if domain_unit:
    print(f'  Domain: {domain_unit[0]["name"]} hp={domain_unit[0]["hp"]} owner={domain_unit[0].get("owner")}')

# Step 3: Attack
attack_action_dict = {
    'type': 'use_skill', 'actor': 'player',
    'skill_id': 'attack', 'target': 'enemy_1'
}
state_json = execute_action(json.dumps(attack_action_dict), json.dumps(state))
state = json.loads(state_json)
errs = [l for l in state['log'] if 'ERROR' in l.upper()]
print(f'Step 3 - Attack: errors={errs} player_hp={state["player"]["hp"]} player_atb={state["player"]["atb"]}')
print(f'  Last 3 logs:')
for l in state['log'][-3:]:
    print(f'    {l}')

# Step 4: Find the domain unit and cancel it
domain_units = [u for u in state['units'] if u['unit_type'] == 'domain']
if domain_units:
    cancel_action_dict = {'type': 'cancel_domain', 'domain_id': domain_units[0]['id']}
    state_json = execute_action(json.dumps(cancel_action_dict), json.dumps(state))
    state = json.loads(state_json)
    errs = [l for l in state['log'] if 'ERROR' in l.upper()]
    print(f'Step 4 - Cancel domain: errors={errs} turn={state["turn"]}')

    # Step 5: Attack again after domain cancelled
    attack_action_dict2 = {
        'type': 'use_skill', 'actor': 'player',
        'skill_id': 'attack', 'target': 'enemy_1'
    }
    state_json = execute_action(json.dumps(attack_action_dict2), json.dumps(state))
    state = json.loads(state_json)
    errs = [l for l in state['log'] if 'ERROR' in l.upper()]
    print(f'Step 5 - Attack after cancel: errors={errs} player_hp={state["player"]["hp"]}')
else:
    errs = ['domain was already destroyed before cancel step']
    print(f'Step 4 - Cancel domain: SKIPPED (domain already destroyed)')

if not errs:
    print('\n=== ALL TESTS PASSED ===')
else:
    print(f'\n=== FAILURES: {errs} ===')
