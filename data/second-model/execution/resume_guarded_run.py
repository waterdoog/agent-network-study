import datetime,json,os,pathlib,shutil,signal,subprocess,time
from operations import status
ops=pathlib.Path('/home/leo/.local/share/second-model-2026-10-05')
p=ops/'NETWORK-GUARD-PAUSE.json'; record=json.loads(p.read_text())
assert record['run']=='m2-e7' and not record.get('resumed_at')
pid=record['pid']; cmd=pathlib.Path(f'/proc/{pid}/cmdline').read_bytes().split(b'\0')
assert b'src/run.js' in cmd and b'm2-e7' in cmd and os.getpgid(pid)==pid
previous_guard=json.loads((ops/'NETWORK-GUARD.json').read_text())
assert not pathlib.Path('/proc/'+str(previous_guard['pid'])).exists(), 'Previous guard is still running'
suffix=record['paused_at'].replace(':','').replace('-','').split('.')[0]
history=ops/('network-guard-pause-'+record['run']+'-'+suffix+'.json')
assert not history.exists()
record['operational_status_before_resume']=status(record['run'])
record['resume_basis']='Default Node fetch and IPv4-first Node fetch both returned HTTP 200 for read-only gateway models endpoint; model calls still require confirmation after resuming'
p.write_text(json.dumps(record,indent=2)+'\n'); p.rename(history)
for name in ['NETWORK-GUARD.json','NETWORK-GUARD-EXIT.json']:
    source=ops/name
    if source.exists():
        destination=ops/(name[:-5]+'-'+suffix+'.json')
        assert not destination.exists(); shutil.copyfile(source,destination)
        if name=='NETWORK-GUARD-EXIT.json': source.unlink()
with (ops/'network-guard-restart.log').open('ab') as log:
    guard=subprocess.Popen(['python3',str(ops/'network_guard.py')],stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    for _ in range(50):
        if guard.poll() is not None: raise RuntimeError('Guard exited before resume')
        current=json.loads((ops/'NETWORK-GUARD.json').read_text())
        if current.get('pid')==guard.pid: break
        time.sleep(.1)
    else: raise RuntimeError('Guard startup was not confirmed')
os.killpg(pid,signal.SIGCONT)
record['resumed_at']=datetime.datetime.now(datetime.timezone.utc).isoformat(); record['guard_pid']=guard.pid
record['requires_operational_review']=False
history.write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'run':record['run'],'same_node_pid':pid,'guard_pid':guard.pid,'resumed_at':record['resumed_at'],'llm_calls_before_resume':record['operational_status_before_resume']['llm_calls']}))