"""Execute registered cells, one technical rerun, then leave packaging ready.

No analysis or outcome-driven choices. Reinvoke safely after interruption.
"""
import datetime, json, os, pathlib, shutil, subprocess, sys, time
from status import inspect

ROOT = pathlib.Path(__file__).resolve().parents[2]
os.chdir(ROOT)
RUNS = ROOT / 'runs'
STATE = RUNS / 'second-model-state.json'
LOCK = RUNS / 'second-model.lock'
CONFIGS = [
    ('m2-e0','A,B,C,D,Ab,Cb','conf-D2-I4,lab-D2-I4,trip-D2-I4,conf-D3-I8,lab-D3-I8,trip-D3-I8','0',180),
    ('m2-dir','Cr,Dr','conf-D2-I4,lab-D2-I4,trip-D2-I4','0',30),
    ('m2-e7','A,B,C,D','conf-D2-I4,lab-D2-I4,trip-D2-I4','0.7',60),
]
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()

def save(state):
    state['updated_at'] = now()
    temp = STATE.with_suffix('.tmp')
    temp.write_text(json.dumps(state, indent=2)+'\n')
    temp.replace(STATE)

def run(config, par, phase, state):
    name, arms, scenarios, e, expected = config
    directory = RUNS / name
    directory.mkdir(exist_ok=True)
    cmd = ['node','src/run.js','--run',name,'--arms',arms,'--scenarios',scenarios,
        '--E',e,'--seeds','5','--seed-start','4','--beats','1','--order-seed','2','--par',str(par),'--log','silent']
    env = dict(os.environ, STUDY_MODEL='gpt-6-astra', STUDY_TRANSPORT='codex-subscription',
        STUDY_SUBSCRIPTION_LEDGER=str(directory/'ledger.jsonl'), STUDY_HTTP_TIMEOUT_MS='180000')
    # Subscription-only dispatch is fail-closed even if API variables happen to exist.
    env.pop('OPENAI_API_KEY',None)
    env.pop('OPENAI_BASE_URL',None)
    state.update(status='running',active_run=name,phase=phase)
    record = dict(started_at=now(),phase=phase,command=cmd,expected=expected)
    with (RUNS/f'{name}.log').open('a') as log:
        proc = subprocess.Popen(cmd,env=env,stdout=log,stderr=log)
        record['pid']=proc.pid
        state['attempts'].append(record)
        save(state)
        while proc.poll() is None:
            snapshot = directory/f'manifest-{phase}.json'
            if (directory/'manifest.json').exists() and not snapshot.exists():
                shutil.copyfile(directory/'manifest.json',snapshot)
            state['progress']={k:v for k,v in inspect(directory).items() if not k.endswith('_ids')}
            save(state)
            time.sleep(20)
        record.update(exit_code=proc.returncode,ended_at=now())
        for filename in ['manifest','usage','all']:
            src=directory/f'{filename}.json'
            dst=directory/f'{filename}-{phase}.json'
            if src.exists() and not dst.exists(): shutil.copyfile(src,dst)
        save(state)
    if proc.returncode != 0:
        raise RuntimeError(f'{name} {phase}: process exited {proc.returncode}; inspect operational logs before resume')

def main():
    if LOCK.exists():
        pid=int(LOCK.read_text())
        try: os.kill(pid,0)
        except ProcessLookupError: LOCK.unlink()
        else: raise RuntimeError(f'Existing runner {pid}; not launching a duplicate')
    with LOCK.open('x') as f: f.write(str(os.getpid()))
    state=json.loads(STATE.read_text()) if STATE.exists() else dict(started_at=now(),attempts=[],runs={})
    try:
        smoke=inspect(RUNS/'m2-smoke')
        if '--wait-for-smoke' in sys.argv:
            state.update(status='waiting-for-smoke',active_run='m2-smoke')
            save(state)
            deadline=time.monotonic()+900
            while smoke['completed']<2 and time.monotonic()<deadline:
                time.sleep(10)
                smoke=inspect(RUNS/'m2-smoke')
        if smoke['completed']!=2 or smoke['technical'] or not smoke['calls'] or smoke['served']!={'gpt-6-astra':smoke['calls']} or smoke['serving_exclusions']:
            raise RuntimeError('Smoke gate failed; full experiment not started')
        for config in CONFIGS:
            name,_,_,_,expected=config
            saved=state['runs'].setdefault(name,{})
            if not saved.get('initial_finished'):
                run(config,10,'initial',state)
                saved['initial_finished']=now()
                save(state)
            if 'rerun_ids' not in saved:
                result=inspect(RUNS/name)
                if result['serving_exclusions'] or any(k!='gpt-6-astra' for k in result['served']):
                    raise RuntimeError(f'{name}: serving exclusion; do not silently rerun a wrong-model outcome')
                # A summary's failureKind is the only outcome field consulted.
                ids=sorted(set(result['technical_ids']+result['missing_ids']))
                saved['rerun_ids']=ids
                save(state)
                target=RUNS/f'{name}-technical-fail'
                target.mkdir(exist_ok=True)
                for episode in ids:
                    src=RUNS/name/episode
                    dst=target/episode
                    if src.exists():
                        if dst.exists(): raise RuntimeError(f'Refusing to overwrite preserved attempt: {episode}')
                        shutil.move(str(src),str(dst))
                saved['failures_set_aside']=now()
                save(state)
            if saved['rerun_ids'] and not saved.get('rerun_finished'):
                if not saved.get('failures_set_aside'):
                    raise RuntimeError('Interrupted during failure quarantine; inspect before continuing')
                run(config,3,'technical-rerun',state)
                saved['rerun_finished']=now()
                save(state)
            result=inspect(RUNS/name)
            saved['final']={k:v for k,v in result.items() if not k.endswith('_ids')}
            saved['technical_reruns']=len(saved['rerun_ids'])
            save(state)
            if result['planned']!=expected or result['completed']!=expected:
                raise RuntimeError(f'{name}: incomplete after permitted retry; no further reruns or analysis')
        state.update(status='complete',active_run=None,phase='ready-to-package',finished_at=now())
        save(state)
    except Exception as e:
        state.update(status='needs_attention',error=str(e))
        save(state)
        raise
    finally:
        LOCK.unlink(missing_ok=True)

if __name__=='__main__': main()
