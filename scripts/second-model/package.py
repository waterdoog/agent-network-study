"""Archive complete raw records; no contrasts, quality summaries or tests."""
import collections, datetime, gzip, hashlib, io, json, pathlib, subprocess, tarfile
from status import inspect

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT/'data/second-model'
RUNS = ROOT/'runs'
EXPECTED = {'m2-e0':180,'m2-dir':30,'m2-e7':60}
PREREG = '8d05ae53378e528ad06bf2dbb9e97ad3522f9ea4'
sha = lambda b: hashlib.sha256(b).hexdigest()

def files_under(paths):
    files=[]
    for path in paths:
        p=ROOT/path
        if p.is_file(): files.append(p)
        elif p.is_dir(): files.extend(x for x in p.rglob('*') if x.is_file())
    return sorted(set(files))

def archive(name, paths):
    files=files_under(paths)
    target=OUT/f'{name}.tar.gz'
    with target.open('wb') as raw:
        with gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0) as zipped:
            with tarfile.open(fileobj=zipped,mode='w',format=tarfile.PAX_FORMAT) as tar:
                for p in files:
                    if p.is_symlink(): raise RuntimeError(f'Unexpected symlink {p}')
                    rel=p.relative_to(ROOT).as_posix()
                    if '.env' in p.name or p.name=='auth.json': raise RuntimeError('Credential path in archive')
                    body=p.read_bytes()
                    for secret_marker in [b'Bearer eyJ',b'"access_token":',b'"refresh_token":',b'sk-proj-',b'ghp_',b'gho_']:
                        if secret_marker in body: raise RuntimeError(f'Potential credential in {rel}')
                    info=tarfile.TarInfo(rel)
                    info.size=len(body); info.mtime=0; info.mode=0o644
                    info.uid=info.gid=0; info.uname=info.gname=''
                    tar.addfile(info,io.BytesIO(body))
    return dict(archive=target.relative_to(ROOT).as_posix(),sha256=sha(target.read_bytes()),
        archive_bytes=target.stat().st_size,file_count=len(files),
        uncompressed_bytes=sum(p.stat().st_size for p in files),
        run_directories=paths),files

def ledger_info(path):
    rows=[json.loads(x) for x in path.read_text().splitlines()]
    responses=[x for x in rows if x.get('kind')=='response']
    costs=[x.get('cost_microusd') for x in responses]
    return dict(attempts=sum(x.get('kind')=='attempt_started' for x in rows),
        response_records=len(responses),attempt_errors=sum(x.get('kind')=='attempt_error' for x in rows),
        calls_by_serving_model=dict(collections.Counter(x.get('served') for x in responses)),
        input_tokens=sum((x.get('usage') or {}).get('input_tokens',0) for x in responses),
        output_tokens=sum((x.get('usage') or {}).get('output_tokens',0) for x in responses),
        reasoning_tokens=sum(((x.get('usage') or {}).get('output_tokens_details') or {}).get('reasoning_tokens',0) for x in responses),
        cost_usd=sum(costs)/1e6 if costs and all(x is not None for x in costs) else None,
        cost_status='not_reported_by_subscription')

def main():
    state=json.loads((RUNS/'second-model-state.json').read_text())
    if state.get('status')!='complete': raise RuntimeError('All runs must finish before packaging/accounting')
    checks={}
    for name,count in EXPECTED.items():
        status=inspect(RUNS/name)
        if status['completed']!=count or status['planned']!=count: raise RuntimeError('Incomplete planned run')
        if status['serving_exclusions'] or any(k!='gpt-6-astra' for k in status['served']): raise RuntimeError('Serving exclusions need explicit reporting')
        checks[name]={k:v for k,v in status.items() if not k.endswith('_ids')}
        checks[name]['technical_reruns']=state['runs'][name]['technical_reruns']
        checks[name]['ledger']=ledger_info(RUNS/name/'ledger.jsonl')
        # Account for every successful call across the initial and rerun attempts.
        event_ids=[]
        for directory in [RUNS/name,RUNS/f'{name}-technical-fail']:
            for p in directory.glob('*/events.jsonl'):
                for line in p.read_text().splitlines():
                    event=json.loads(line)
                    if event.get('evt')=='llm': event_ids.append(event['response_id'])
        ledger_ids=[r['response_id'] for r in map(json.loads,(RUNS/name/'ledger.jsonl').read_text().splitlines()) if r.get('kind')=='response']
        if sorted(event_ids)!=sorted(ledger_ids): raise RuntimeError(f'Ledger/event mismatch in {name}')
    OUT.mkdir(parents=True,exist_ok=True)
    archives=[]; all_files=[]
    for name in EXPECTED:
        record,files=archive(name,[f'runs/{name}',f'runs/{name}.log'])
        record.update(checks[name]); archives.append(record); all_files+=files
    aside=['runs/m2-smoke','runs/m2-smoke.log','runs/m2-smoke-technical-fail','runs/transport-preflight','runs/second-model-state.json','runs/environment.json']
    aside += [f'runs/{x}-technical-fail' for x in EXPECTED if (RUNS/f'{x}-technical-fail').exists()]
    record,files=archive('set-aside',aside)
    record['role']='Smoke, transport preflight, orchestration record and superseded technical failures; never pool with confirmatory episodes'
    archives.append(record); all_files+=files
    manifest=dict(format_version=1,created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        packaging_revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
        environment=json.loads((RUNS/'environment.json').read_text()),
        harness_base='3408758',checkout_base='08e492ee49b6193029fe24be019f272ffb20b48f',
        preregistration_repository='LeoYiLi/agentic-web-paper',preregistration_commit=PREREG,
        model='gpt-6-astra',transport='ChatGPT subscription via Codex OAuth Responses',
        started_at=state['started_at'],finished_at=state['finished_at'],
        node_version=subprocess.check_output(['node','--version'],text=True).strip(),
        parameters=dict(reasoning_effort='medium',temperature='omitted; service default',
            max_output_tokens='original per-call harness limit; includes reasoning tokens',store=False,
            seed_start=4,seeds=5,beats=1,order_seed=2,initial_parallelism=10,technical_retry_parallelism=3),
        planned_episodes=270,episode_summaries=270,archives=archives,
        accounting=dict(cost_usd=None,cost_status='not_reported_by_subscription',
            description='Upstream usage ledger includes initial and technical rerun attempts. No per-call money is returned. API-price estimates and a claim of zero spend would be unsupported.',
            ledgers={str(p.relative_to(ROOT)):ledger_info(p) for p in RUNS.glob('*/ledger.jsonl')},
            connectivity_probe=json.loads((RUNS/'transport-preflight/connectivity.json').read_text())),
        analysis_performed=False,
        limitations=['Prospective Astra registration follows a separate prior Azure registration; prior Azure attempt status is unknown.',
            'Service default sampling replaces unsupported temperature.',
            'The output limit includes reasoning tokens.',
            'Subscription response exposes no USD or consumed-credit charge.'])
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (OUT/'SHA256SUMS').write_text(''.join(f"{a['sha256']}  {a['archive']}\n" for a in archives))
    (OUT/'FILES.sha256').write_text(''.join(f'{sha(p.read_bytes())}  {p.relative_to(ROOT).as_posix()}\n' for p in sorted(set(all_files))))
    # Verify every restored byte and exact membership, without printing outcomes.
    restored={}
    for a in archives:
        with tarfile.open(ROOT/a['archive'],'r:gz') as tar:
            for member in tar.getmembers():
                if not member.isfile() or member.name in restored: raise RuntimeError('Archive member conflict')
                restored[member.name]=sha(tar.extractfile(member).read())
    original={p.relative_to(ROOT).as_posix():sha(p.read_bytes()) for p in set(all_files)}
    if restored!=original: raise RuntimeError('Restored file verification failed')
    print(json.dumps({'complete':270,'archives':len(archives),'files_verified':len(restored),'cost_usd':None,'cost_status':'not_reported_by_subscription'}))

if __name__=='__main__': main()
