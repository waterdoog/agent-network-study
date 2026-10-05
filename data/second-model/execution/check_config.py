import json, pathlib, shlex, os
p = pathlib.Path('/home/leo/.study-second-model.env')
values = {}
for line in p.read_text(encoding='utf-8-sig').splitlines():
    line = line.strip()
    if not line or line.startswith('#'): continue
    if line.startswith('export '): line = line[7:]
    name, sep, raw = line.partition('=')
    if not sep: raise SystemExit('Invalid configuration line; content suppressed')
    name = name.strip()
    if name not in {'OPENAI_BASE_URL','OPENAI_API_KEY','STUDY_MODEL'}: continue
    parts = shlex.split(raw, comments=True)
    if len(parts) > 1: raise SystemExit('Invalid configuration value; content suppressed')
    values[name] = parts[0] if parts else ''
assert values.get('OPENAI_API_KEY'), 'API key is empty'
assert values.get('OPENAI_BASE_URL','').rstrip('/') == 'https://agentport.world/v1', 'Base URL does not match supplied gateway'
assert values.get('STUDY_MODEL') == 'azure:gpt-4.1-mini', 'Model does not match preregistration'
os.chmod(p, 0o600)
print(json.dumps({'key_nonempty': True, 'base_url': values['OPENAI_BASE_URL'], 'model': values['STUDY_MODEL'], 'permissions': oct(p.stat().st_mode & 0o777)}))