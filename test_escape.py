"""Verify backslash escaping fix for Python string template embedding."""
import json

# Simulate the JS fix
# JSON with escape sequences that would break Python string parsing
test_obj = {"log": ['test "hello" world'], "name": "test's name", "path": "C:\\data\\file"}
json_str = json.dumps(test_obj)
print("Original JSON:", repr(json_str[:150]))

# WITHOUT fix: only escape single quotes (old code)
old = json_str.replace("'", "\\'")
print("OLD escape:", repr(old[:150]))
# Python would interpret this as: f'''{old}'''
# Backslash sequences like \" become " in Python string, breaking JSON

# WITH fix: escape backslashes first, then single quotes (new code)
new = json_str.replace("\\", "\\\\").replace("'", "\\'")
print("NEW escape:", repr(new[:150]))

# Test: can Python correctly parse the JSON through string interpolation?
# Simulate Python exec with f'''{escaped}'''
# Python would do: s = '''{escaped}''' then json.loads(s)
try:
    exec("s = '''" + old + "'''")
    data1 = json.loads(s)
    print("OLD: JSON parse OK")
except Exception as e:
    print("OLD: JSON parse FAILED:", str(e)[:80])

try:
    exec("s = '''" + new + "'''")
    data2 = json.loads(s)
    print("NEW: JSON parse OK")
except Exception as e:
    print("NEW: JSON parse FAILED:", str(e)[:80])

# Now test with actual battle state (Chinese characters, domain names)
print("\n=== Test with Chinese text ===")
chinese_obj = {
    "log": ['[0 AV] 测试术师 展开了完全领域"不义游戏·领域"！',
            '[10 AV] 不义游戏·领域 自动攻击'],
    "player": {"name": "测试术师", "skills": [{"id": "attack", "name": "体术平A", "cost": 0}]}
}
chinese_json = json.dumps(chinese_obj, ensure_ascii=False)
print("Chinese JSON length:", len(chinese_json))
print("Chinese JSON:", chinese_json[:200])

# Old method
chinese_old = chinese_json.replace("'", "\\'")
try:
    exec("s = '''" + chinese_old + "'''")
    data = json.loads(s)
    print("OLD: Chinese JSON parse OK")
except Exception as e:
    print("OLD: Chinese JSON parse FAILED:", str(e)[:80])

# New method
chinese_new = chinese_json.replace("\\", "\\\\").replace("'", "\\'")
try:
    exec("s = '''" + chinese_new + "'''")
    data = json.loads(s)
    print("NEW: Chinese JSON parse OK")
except Exception as e:
    print("NEW: Chinese JSON parse FAILED:", str(e)[:80])
