#!/usr/bin/env python3
"""Frozen operational-only E=.3 controller; the experiment harness is unchanged."""
import argparse, datetime, fcntl, hashlib, importlib.util, json, os
from pathlib import Path
import shutil, signal, subprocess, sys, time

ROOT=Path(__file__).resolve().parents[2]
RUNS=ROOT/'runs'
STATE=RUNS/'midpoint-state.json'
SPEC=[('m2-e3-smoke','A','conf-D2-I4',2,1,2,2),
      ('m2-e3','A,B,C,D','conf-D2-I4,lab-D2-I4,trip-D2-I4',5,4,10,60)]
spec=importlib.util.spec_from_file_location('ops',ROOT/'scripts/second-model/status.py')
ops=importlib.util.module_from_spec(spec);spec.loader.exec_module(ops)
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()

def save(s):
    s['updated_at']=now();temp=STATE.with_suffix('.tmp')
    temp.write_text(json.dumps(s,indent=2)+'\n');temp.replace(STATE)

def snapshot(name):
    return {k:v for k,v in ops.inspect(RUNS/name).items() if not k.endswith('_ids')}

def verify_sources():
    m=json.loads((ROOT/'scripts/midpoint-study/source-manifest.json').read_text())
    for filename,digest in m['files'].items():
        assert hashlib.sha256((ROOT/filename).read_bytes()).hexdigest()==digest,filename

def halt_reason(name, offset=0):
    p=RUNS/name/'ledger.jsonl'
    if not p.exists():return None
    for line in p.read_text().splitlines()[offset:]:
        try:r=json.loads(line)
        except json.JSONDecodeError:continue
        if r.get('kind')=='response' and r.get('served')!='gpt-6-astra':
            return 'serving identity mismatch'
        if r.get('kind')=='attempt_error':
            err=str(r.get('error','')).lower()
            if r.get('status') in (401,403) or any(x in err for x in ('token_revoked','usage_limit_reached','insufficient_quota')):
                return 'authentication or subscription limit requires attention'
    return None

def stop(proc):
    if proc.poll() is None:
        os.killpg(proc.pid,signal.SIGTERM)
        try:proc.wait(timeout=15)
        except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);proc.wait()

def quarantine(name,s):
    root=RUNS/name;target=RUNS/(name+'-technical-fail')
    result=ops.inspect(root)
    if result['serving_exclusions'] or any(k!='gpt-6-astra' for k in result['served']):
        raise RuntimeError('Serving exclusion: no automatic rerun')
    technical=set(result['technical_ids'])
    for p in root.iterdir() if root.exists() else []:
        if p.is_dir() and not (p/'summary.json').exists() and any(p.iterdir()):technical.add(p.name)
    for episode in sorted(technical):
        if (target/episode).exists():
            raise RuntimeError('A technical rerun is exhausted or interrupted; no third attempt: '+episode)
        s.setdefault('rerun_ids',{}).setdefault(name,[])
        if episode not in s['rerun_ids'][name]:s['rerun_ids'][name].append(episode)
        save(s)
        target.mkdir(exist_ok=True);shutil.move(str(root/episode),str(target/episode))
    return bool(technical)

def sweep(config,par,s,lock):
    name,arms,scenarios,seeds,start,_,expected=config
    root=RUNS/name;root.mkdir(exist_ok=True)
    ledger=root/'ledger.jsonl';offset=len(ledger.read_text().splitlines()) if ledger.exists() else 0
    cmd=['node','src/run.js','--run',name,'--arms',arms,'--scenarios',scenarios,'--E','0.3',
         '--seeds',str(seeds),'--seed-start',str(start),'--beats','1','--order-seed','2',
         '--par',str(par),'--log','silent']
    env=dict(os.environ,STUDY_MODEL='gpt-6-astra',STUDY_TRANSPORT='codex-subscription',
             STUDY_SUBSCRIPTION_LEDGER=str(ledger),STUDY_HTTP_TIMEOUT_MS='180000')
    env.pop('OPENAI_API_KEY',None);env.pop('OPENAI_BASE_URL',None)
    entry={'run':name,'command':cmd,'started_at':now(),'expected':expected}
    s.setdefault('attempts',[]).append(entry);s.update(status='running',active_run=name);save(s)
    with (RUNS/(name+'.log')).open('a') as log:
        proc=subprocess.Popen(cmd,cwd=ROOT,env=env,stdout=log,stderr=log,
                              start_new_session=True,pass_fds=(lock.fileno(),))
        entry['pid']=proc.pid;save(s)
        try:
            while proc.poll() is None:
                manifest=root/'manifest.json'
                frozen=root/('manifest-pass-'+str(len(s['attempts']))+'.json')
                if manifest.exists() and not frozen.exists():shutil.copyfile(manifest,frozen)
                reason=halt_reason(name,offset)
                if reason:raise RuntimeError(reason)
                s['progress']=snapshot(name);save(s);time.sleep(5)
            entry.update(exit_code=proc.returncode,ended_at=now());save(s)
            if proc.returncode:raise RuntimeError('Sweep process interrupted; inspect before explicit resume')
        finally:stop(proc)
    reason=halt_reason(name,offset)
    if reason:raise RuntimeError(reason)

def main():
    p=argparse.ArgumentParser();p.add_argument('--registration-sha',required=True)
    p.add_argument('--paper',type=Path,required=True)
    p.add_argument('--resume-after-attention',action='store_true');args=p.parse_args()
    verify_sources()
    protocol='docs/PREREGISTRATION-astra-midpoint.md'
    remote=subprocess.check_output(['git','ls-remote','origin','refs/heads/main'],cwd=args.paper,text=True).split()[0]
    subprocess.run(['git','merge-base','--is-ancestor',args.registration_sha,remote],cwd=args.paper,check=True)
    text=subprocess.check_output(['git','show',args.registration_sha+':'+protocol],cwd=args.paper)
    assert b'm2-e3' in text and b'60' in text
    RUNS.mkdir(exist_ok=True)
    with (RUNS/'midpoint.lock').open('a+') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        s=json.loads(STATE.read_text()) if STATE.exists() else {'started_at':now(),'registration_sha':args.registration_sha,'attempts':[],'rerun_ids':{}}
        assert s['registration_sha']==args.registration_sha
        if s.get('status') in ('running','needs_attention') and not args.resume_after_attention:
            raise RuntimeError('Previous interrupted/paused controller needs explicit operational review before resume')
        try:
            for config in SPEC:
                name,_,_,_,_,par,expected=config
                r=snapshot(name)
                if r['completed']==expected and not r['technical']:
                    assert r['planned']==expected and r['calls'] and r['served']=={'gpt-6-astra':r['calls']} and not r['serving_exclusions']
                    continue
                recovering=quarantine(name,s)
                sweep(config,3 if recovering or any(a['run']==name for a in s['attempts']) else par,s,lock)
                if quarantine(name,s):sweep(config,3,s,lock)
                r=snapshot(name);s.setdefault('runs',{})[name]=r;save(s)
                if r['completed']!=expected or r['planned']!=expected or r['technical']:
                    raise RuntimeError('Incomplete or unresolved technical failure; no analysis or extra attempts')
                assert r['calls'] and r['served']=={'gpt-6-astra':r['calls']} and not r['serving_exclusions']
            s.update(status='complete',active_run=None,finished_at=now());save(s)
        except BaseException as e:
            s.update(status='needs_attention',error=str(e));save(s);raise

if __name__=='__main__':
    def interrupt(*_):raise KeyboardInterrupt('controller interrupted')
    signal.signal(signal.SIGTERM,interrupt)
    main()
