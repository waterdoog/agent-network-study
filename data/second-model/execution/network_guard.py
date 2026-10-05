import collections,datetime,fcntl,json,os,pathlib,re,signal,time
OPS=pathlib.Path('/home/leo/.local/share/second-model-2026-10-05')
ROOT=pathlib.Path('/home/leo/repos/agent-network-study-second-model/runs')
RUNS=['m2-e0','m2-dir','m2-e7']
def utc(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def write(name,obj):
 p=OPS/name; t=p.with_suffix('.tmp'); t.write_text(json.dumps(obj,indent=2)+'\n'); t.replace(p)
def failures(run):
 found=set()
 for path in (ROOT/run).glob('*/events.jsonl'):
  for line in path.read_text().splitlines():
   try: event=json.loads(line)
   except json.JSONDecodeError: continue
   if event.get('evt')=='llm.fail': found.add((path.parent.name,event.get('s')))
 return found
lock=(OPS/'network-guard.lock').open('w'); fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
seen={run:failures(run) for run in RUNS}; recent=collections.deque()
write('NETWORK-GUARD.json',{'pid':os.getpid(),'started_at':utc(),'state':'watching','rule':'Pause current process after failures in 3 distinct episodes observed within 90 seconds; never retry episodes itself'})
while not (OPS/'FULL-SWEEP-COMPLETED.json').exists():
 current=None
 for run in RUNS:
  for stage in ['initial','technical-retry']:
   path=OPS/(run+'-'+stage+'.json')
   if not path.exists(): continue
   record=json.loads(path.read_text())
   if record.get('pid') and not record.get('finished_at'): current=(run,record['pid'])
 if current:
  run,pid=current; tick=time.monotonic(); found=failures(run)
  for episode,seq in found-seen[run]: recent.append((tick,run,episode))
  seen[run]|=found
  while recent and tick-recent[0][0]>90: recent.popleft()
  affected={episode for _,itemrun,episode in recent if itemrun==run}
  if len(affected)>=3:
   proc=pathlib.Path(f'/proc/{pid}/cmdline')
   if proc.exists():
    args=proc.read_bytes().split(b'\0')
    if b'src/run.js' in args and run.encode() in args and os.getpgid(pid)==pid:
     os.killpg(pid,signal.SIGSTOP)
     write('NETWORK-GUARD-PAUSE.json',{'paused_at':utc(),'pid':pid,'run':run,'signal':'SIGSTOP','reason':'Network/model-call failures in at least 3 distinct episodes within 90 seconds','affected_episode_count':len(affected),'requires_operational_review':True})
     break
 time.sleep(10)
write('NETWORK-GUARD-EXIT.json',{'at':utc(),'paused_for_review':(OPS/'NETWORK-GUARD-PAUSE.json').exists(),'all_runs_finished':(OPS/'FULL-SWEEP-COMPLETED.json').exists()})