#!/usr/bin/env python3
"""Registered smoke gate then fixed formal collection, operational reporting only."""
import datetime
import fcntl
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RUNS = HERE / 'runs'
STATE = RUNS / 'controller-state.json'
RECEIPT = RUNS / 'registration-receipt.json'
NODE = shutil.which('node')


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def save(state):
    state['updated_at'] = now()
    temp = STATE.with_suffix('.tmp')
    temp.write_text(json.dumps(state, indent=2) + '\n')
    temp.replace(STATE)


def status(mode):
    result = subprocess.run([NODE, str(HERE / 'run.mjs'), '--mode', mode, '--status'],
                            cwd=ROOT, check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def stop_on_sigterm(signum, frame):
    raise RuntimeError('Controller received SIGTERM; stopping active runner')


def run_mode(mode, expected, state, lock_fd):
    state.update(status='running', mode=mode)
    command = [NODE, str(HERE / 'run.mjs'), '--mode', mode, '--execute',
               '--authorization', str(RECEIPT)]
    env = dict(os.environ)
    for name in ('OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'AZURE_OPENAI_API_KEY',
                 'OPENAI_BASE_URL'):
        env.pop(name, None)
    with (RUNS / f'{mode}-controller.log').open('a') as log:
        # Keep the same open-file-description lock alive in the runner if this
        # controller dies unexpectedly. A replacement controller then refuses
        # to start until the still-running child exits.
        child = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=log,
                                 pass_fds=(lock_fd,))
        record = {'mode': mode, 'pid': child.pid, 'started_at': now()}
        state['launches'].append(record)
        save(state)
        try:
            while child.poll() is None:
                state['progress'] = status(mode)
                save(state)
                time.sleep(15)
        except BaseException:
            child.terminate()
            child.wait(timeout=30)
            raise
        record.update(exit_code=child.returncode, ended_at=now())
        state['progress'] = status(mode)
        save(state)
        if child.returncode:
            raise RuntimeError(f'{mode} stopped; inspect operational cause and preserved attempts before manual resume')
    if state['progress'].get('finished') != expected:
        raise RuntimeError(f'{mode}: final status coverage differs from fixed plan')
    return state['progress']


def main():
    if not NODE:
        raise RuntimeError('Node runtime unavailable')
    RUNS.mkdir(exist_ok=True)
    if not RECEIPT.exists():
        raise RuntimeError('Pushed registration receipt required before collection')
    with (RUNS / 'controller.lock').open('a+') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Existing controller is active; duplicate launch refused')
        lock.seek(0)
        lock.truncate()
        lock.write(str(os.getpid()))
        lock.flush()
        state = json.loads(STATE.read_text()) if STATE.exists() else {
            'started_at': now(), 'launches': [], 'smoke_gate_passed': False}
        state['pid'] = os.getpid()
        signal.signal(signal.SIGTERM, stop_on_sigterm)
        try:
            if not state['smoke_gate_passed']:
                progress = run_mode('smoke', 6, state, lock.fileno())
                if progress['technical_exhausted'] or not progress['verified_calls_all_attempts']:
                    raise RuntimeError('Smoke operational gate failed; formal collection not started')
                validated = subprocess.run(
                    [NODE, str(HERE / 'score.mjs'), '--run', str(RUNS / 'smoke'), '--validate-only'],
                    cwd=ROOT, check=True, capture_output=True, text=True)
                validation = json.loads(validated.stdout)
                if validation['episodes'] != 6 or validation['scorer_executed'] != 6:
                    raise RuntimeError('Smoke record/scorer execution gate failed')
                state.update(smoke_gate_passed=True, smoke_gate_at=now(), smoke_validation=validation)
                save(state)
            progress = run_mode('formal', 108, state, lock.fileno())
            state.update(status='collection_finished', finished_at=now(),
                         remaining_technical_failures=progress['technical_exhausted'])
            save(state)
        except BaseException as error:
            state.update(status='needs_attention', error=str(error))
            save(state)
            raise


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
