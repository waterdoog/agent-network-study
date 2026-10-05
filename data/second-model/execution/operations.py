import collections, datetime, json, os, pathlib, re, signal, subprocess, sys, time
ROOT = pathlib.Path('/home/leo/repos/agent-network-study-second-model')
OPS = pathlib.Path(__file__).resolve().parent
MODEL = 'azure:gpt-4.1-mini'
CODE = '3408758ecace59dab0b384a0eb81b2adb4fd18df'
PREREG = 'c420bf94fbd384421f7117076297c6fe07aea590'

def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def write_json(path, obj):
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(obj, indent=2) + '\n')
    tmp.replace(path)

def status(run):
    root = ROOT / 'runs' / run
    result = dict(run=run, summaries=0, technical=0, crashed=0, llm_calls=0, missing_served=0, wrong_served=0, http_statuses={})
    served = collections.Counter()
    http = collections.Counter()
    for ep in root.iterdir() if root.exists() else []:
        if not ep.is_dir(): continue
        if (ep/'summary.json').exists():
            try:
                summary = json.loads((ep/'summary.json').read_text())
            except (json.JSONDecodeError, OSError): continue
            result['summaries'] += 1
            result['technical'] += any(b.get('failureKind') == 'technical' for b in summary.get('beats', []))
        result['crashed'] += (ep/'CRASHED').exists()
        events = ep/'events.jsonl'
        if not events.exists(): continue
        for line in events.read_text().splitlines():
            try: event = json.loads(line)
            except json.JSONDecodeError: continue
            if event.get('evt') == 'llm':
                result['llm_calls'] += 1
                deployment = event.get('served')
                served[deployment or '<missing>'] += 1
                result['missing_served'] += not bool(deployment)
                result['wrong_served'] += bool(deployment) and deployment != MODEL
            if event.get('evt') == 'llm.fail':
                match = re.search(r'HTTP (\d{3})', event.get('err',''))
                http[match.group(1) if match else 'non-http'] += 1
    result['served'] = dict(served)
    result['http_statuses'] = dict(http)
    return result

def environment():
    import check_config
    assert subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT, text=True).strip() == CODE
    subprocess.run(['git','diff','--exit-code','HEAD','--','src','package.json','package-lock.json'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    env = {k:v for k,v in os.environ.items() if not k.startswith('STUDY_') and k not in ['OPENAI_API_KEY','OPENAI_BASE_URL']}
    env.update(check_config.values)
    return env

def launch(run, args, expected):
    env = environment()
    record = OPS / (run + '-execution.json')
    if record.exists(): raise SystemExit('Execution already exists; inspect state before resuming')
    command = ['node','src/run.js','--run',run] + args
    state = dict(run=run, preregistration=PREREG, harness=CODE, command=command, started_at=now(), expected=expected)
    write_json(record, state)
    with (OPS/(run+'.log')).open('ab') as log:
        proc = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        state['pid'] = proc.pid
        write_json(record, state)
        while proc.poll() is None:
            time.sleep(5)
            op = status(run)
            if op['missing_served'] or op['wrong_served']:
                os.killpg(proc.pid, signal.SIGTERM)
                state['stopped_reason'] = 'serving_deployment_mismatch_or_missing'
                proc.wait(timeout=20)
                break
        state.update(finished_at=now(), returncode=proc.returncode, operational_status=status(run))
        write_json(record, state)
    print(json.dumps(state, indent=2))

if __name__ == '__main__':
    if sys.argv[1] == 'status':
        for run in sys.argv[2:]: print(json.dumps(status(run)))
    elif sys.argv[1] == 'smoke':
        launch('m2-smoke', ['--arms','A,D','--scenarios','conf-D2-I4','--E','0','--seeds','2','--seed-start','1','--beats','1','--order-seed','2','--par','2'], 4)
    else: raise SystemExit('Unknown action')