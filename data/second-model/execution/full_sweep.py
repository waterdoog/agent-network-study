import collections, fcntl, json, os, pathlib, shutil, signal, subprocess, time
from operations import ROOT, OPS, CODE, MODEL, PREREG, now, write_json, status, environment

COMMON = ['--seeds','5','--seed-start','4','--beats','1','--order-seed','2']
PLAN = [
    ('m2-e0', 180, ['--arms','A,B,C,D,Ab,Cb','--scenarios','conf-D2-I4,lab-D2-I4,trip-D2-I4,conf-D3-I8,lab-D3-I8,trip-D3-I8','--E','0']),
    ('m2-dir',30, ['--arms','Cr,Dr','--scenarios','conf-D2-I4,lab-D2-I4,trip-D2-I4','--E','0']),
    ('m2-e7', 60, ['--arms','A,B,C,D','--scenarios','conf-D2-I4,lab-D2-I4,trip-D2-I4','--E','0.7']),
]

def execute(run, args, stage, par):
    record = OPS / (run + '-' + stage + '.json')
    if record.exists():
        old = json.loads(record.read_text())
        if 'finished_at' not in old or old.get('stopped_reason'):
            raise RuntimeError('Existing incomplete or stopped stage requires operational review: ' + record.name)
        return old
    command = ['node','src/run.js','--run',run] + args + COMMON + ['--par',str(par)]
    state = dict(run=run, stage=stage, preregistration=PREREG, harness=CODE, command=command, started_at=now())
    write_json(record, state)
    env = environment()
    with (OPS/(run+'.log')).open('ab') as log:
        log.write(('\n=== ' + stage + ' ' + now() + '\n').encode()); log.flush()
        proc = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        state['pid'] = proc.pid
        write_json(record, state)
        while proc.poll() is None:
            time.sleep(10)
            op = status(run)
            write_json(OPS/'progress.json', dict(updated_at=now(), stage=stage, **op))
            if op['missing_served'] or op['wrong_served']:
                os.killpg(proc.pid, signal.SIGTERM)
                try: proc.wait(timeout=20)
                except subprocess.TimeoutExpired:
                    os.killpg(proc.pid, signal.SIGKILL); proc.wait()
                state['stopped_reason'] = 'serving_deployment_mismatch_or_missing'
                break
        state.update(finished_at=now(), returncode=proc.returncode, operational_status=status(run))
        write_json(record, state)
    if state.get('stopped_reason'):
        raise RuntimeError('Serving identity check failed; no continuation or model switch')
    return state

def prepare_retry(run):
    root = ROOT/'runs'/run
    state_file = OPS/(run+'-retry-selection.json')
    if state_file.exists():
        previous = json.loads(state_file.read_text())
        if previous.get('archive_completed'):
            return previous['episodes']
        raise RuntimeError('Interrupted failure archiving requires operational review')
    manifest = json.loads((root/'manifest.json').read_text())
    shutil.copyfile(root/'manifest.json', OPS/(run+'-initial-manifest.json'))
    failed = []
    for spec in manifest['episodes']:
        ep = root/spec['id']
        summary_path = ep/'summary.json'
        if summary_path.exists():
            summary = json.loads(summary_path.read_text())
            technical = any(b.get('failureKind') == 'technical' for b in summary.get('beats',[]))
            reason = 'technical_failure' if technical else None
        else:
            reason = 'crash_or_incomplete' if ep.exists() else 'not_started'
        if reason:
            failed.append(dict(id=spec['id'], reason=reason, had_directory=ep.exists()))
    selection = dict(run=run, selected_at=now(), episodes=failed, archive_completed=False)
    write_json(state_file, selection)
    archive = ROOT/'runs'/(run+'-technical-fail')
    for item in failed:
        ep = root/item['id']
        if ep.exists():
            archive.mkdir(exist_ok=True)
            destination = archive/item['id']
            if destination.exists(): raise RuntimeError('Refusing to overwrite a previous attempt')
            shutil.move(str(ep), str(destination))
    selection['archive_completed'] = True
    write_json(state_file, selection)
    return failed

def main():
    lock = (OPS/'full-sweep.lock').open('w')
    fcntl.flock(lock, fcntl.LOCK_EX|fcntl.LOCK_NB)
    smoke_record = json.loads((OPS/'m2-smoke-execution.json').read_text())
    smoke = status('m2-smoke')
    assert smoke_record.get('finished_at') and smoke_record.get('returncode') == 0
    assert smoke['summaries'] == 4 and smoke['technical'] == 0 and smoke['crashed'] == 0
    assert smoke['llm_calls'] > 0 and smoke['missing_served'] == 0 and smoke['wrong_served'] == 0
    # Verify the timestamped preregistration is still an ancestor of remote main.
    comparison = json.loads(subprocess.check_output(['/home/leo/.local/bin/gh','api',
        'repos/LeoYiLi/agentic-web-paper/compare/'+PREREG+'...main'], text=True))
    assert comparison['status'] in ['identical','ahead']
    plan = dict(preregistration=PREREG, harness=CODE, model=MODEL, gateway='https://agentport.world/v1',
        smoke=dict(run='m2-smoke', arms=['A','D'], scenario='conf-D2-I4', seeds=[1,2], expected=4),
        runs=[dict(run=r, expected=n, command=['node','src/run.js','--run',r]+a+COMMON+['--par','10']) for r,n,a in PLAN],
        technical_retry_limit=1, technical_retry_parallelism=2, analysis_locked_until_summaries=270)
    write_json(OPS/'plan.json', plan)
    started = now()
    for run, expected, args in PLAN:
        execute(run, args, 'initial', 10)
        selected = prepare_retry(run)
        if selected:
            execute(run, args, 'technical-retry', 2)
        final = status(run)
        record = dict(expected=expected, technical_retry_episodes=len(selected), **final)
        write_json(OPS/(run+'-completion.json'), record)
        print(json.dumps(record), flush=True)
    runs = [json.loads((OPS/(r+'-completion.json')).read_text()) for r,_,_ in PLAN]
    all_complete = all(r['summaries'] == r['expected'] for r in runs)
    final = dict(started_at=started, finished_at=now(), all_270_summaries=all_complete, runs=runs)
    write_json(OPS/'FULL-SWEEP-COMPLETED.json',final)
    print(json.dumps(final), flush=True)

if __name__ == '__main__':
    try: main()
    except Exception as exc:
        # Error messages are restricted to operator-authored messages and exception class.
        write_json(OPS/'ATTENTION.json',dict(at=now(), error_type=type(exc).__name__))
        raise SystemExit('Operational attention required: '+type(exc).__name__)