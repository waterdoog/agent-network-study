import pathlib,json,os,signal,datetime
ops=pathlib.Path('/home/leo/.local/share/second-model-2026-10-05')
state=json.loads((ops/'m2-e0-technical-retry.json').read_text())
if state.get('finished_at'): print(json.dumps({'already_finished':True}))
else:
    pid=state['pid']
    cmd=pathlib.Path(f'/proc/{pid}/cmdline').read_bytes().split(b'\0')
    assert b'src/run.js' in cmd and b'm2-e0' in cmd and os.getpgid(pid)==pid
    os.killpg(pid,signal.SIGSTOP)
    record={'paused_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':pid,'signal':'SIGSTOP','reason':'Widespread first-pass technical failures; investigate before consuming remaining single retries'}
    (ops/'OPERATIONAL-PAUSE.json').write_text(json.dumps(record,indent=2)+'\n')
    print(json.dumps(record))