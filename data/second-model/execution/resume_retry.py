import pathlib,json,os,signal,datetime
ops=pathlib.Path('/home/leo/.local/share/second-model-2026-10-05'); p=ops/'OPERATIONAL-PAUSE.json'
record=json.loads(p.read_text()); pid=record['pid']
cmd=pathlib.Path(f'/proc/{pid}/cmdline').read_bytes().split(b'\0')
assert b'src/run.js' in cmd and b'm2-e0' in cmd and os.getpgid(pid)==pid
assert 'resumed_at' not in record
os.killpg(pid,signal.SIGCONT)
record['resumed_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
record['resume_basis']='Python and default Node fetch both returned HTTP 200 for gateway models endpoint; same process and settings retained'
p.write_text(json.dumps(record,indent=2)+'\n'); print(json.dumps(record))