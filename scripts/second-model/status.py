"""Operational checks only: never emit quality, token contrasts, or artifacts."""
import collections, json, pathlib

def inspect(root):
    root = pathlib.Path(root)
    manifest_path = root / 'manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    planned = [e['id'] for e in manifest.get('episodes', [])]
    complete, technical, missing = [], [], []
    for episode in planned:
        p = root / episode / 'summary.json'
        if not p.exists():
            missing.append(episode)
        else:
            summary = json.loads(p.read_text())
            complete.append(episode)
            if any(b.get('failureKind') == 'technical' for b in summary.get('beats', [])):
                technical.append(episode)
    serving = collections.Counter()
    exclusions = []
    llm_events = 0
    for p in root.glob('*/events.jsonl'):
        for line in p.read_text().splitlines():
            try: event = json.loads(line)
            except json.JSONDecodeError: continue
            if event.get('evt') == 'llm':
                serving[event.get('served') or '<missing>'] += 1
                llm_events += 1
            if event.get('evt') == 'llm.serving_exclusion': exclusions.append(p.parent.name)
    return dict(run=root.name, planned=len(planned), completed=len(complete),
        technical=len(technical), missing=len(missing), technical_ids=technical,
        missing_ids=missing, calls=llm_events, served=dict(serving),
        serving_exclusions=sorted(set(exclusions)))

if __name__ == '__main__':
    import sys
    for name in sys.argv[1:]:
        result = inspect(pathlib.Path('runs') / name)
        print(json.dumps({k:v for k,v in result.items() if not k.endswith('_ids')}))
