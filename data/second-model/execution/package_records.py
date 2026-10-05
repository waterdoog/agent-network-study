import collections, datetime, gzip, hashlib, json, pathlib, shutil, tarfile, tempfile
from operations import ROOT, OPS, CODE, MODEL, PREREG, write_json

RUNS = {'m2-e0':180, 'm2-dir':30, 'm2-e7':60}
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def files_under(paths):
    result=[]
    for p in paths:
        if p.is_dir(): result.extend(x for x in p.rglob('*') if x.is_file())
        elif p.is_file(): result.append(p)
    return sorted(set(result),key=lambda p:p.relative_to(ROOT).as_posix())
def metadata(files):
    calls=collections.Counter(); models=set(); arms=set(); scenarios=set(); seeds=set(); reach=set()
    count=0; cost=0; missing_cost=0; technical=0; model_failures=0
    for path in files:
        if path.name == 'summary.json':
            row=json.loads(path.read_text()); count+=1
            for key,dest in [('model',models),('arm',arms),('scenario',scenarios),('seed',seeds),('E',reach)]:
                if key in row: dest.add(row[key])
            technical+=any(x.get('failureKind')=='technical' for x in row.get('beats',[]))
            model_failures+=any(x.get('failureKind')=='model' for x in row.get('beats',[]))
        if path.name == 'events.jsonl':
            for line in path.read_text().splitlines():
                event=json.loads(line)
                if event.get('evt')!='llm': continue
                calls[event.get('served') or '<missing>']+=1
                value=event.get('cost_microusd')
                if value is None: missing_cost+=1
                else:
                    assert isinstance(value,int) and value>=0
                    cost+=value
    return dict(episode_summaries=count,models=sorted(models),configurations=sorted(arms),scenarios=sorted(scenarios),
        seeds=sorted(seeds),external_fraction=sorted(reach),technical_failures=technical,model_failures=model_failures,
        llm_calls_by_serving_deployment=dict(calls),response_header_cost_microusd=cost,
        calls_without_cost_header=missing_cost)

def main():
    completed=json.loads((OPS/'FULL-SWEEP-COMPLETED.json').read_text())
    assert completed['all_270_summaries'] is True
    from check_config import values
    secret=values['OPENAI_API_KEY'].encode()
    assert len(secret)>16
    for run,expected in RUNS.items():
        root=ROOT/'runs'/run
        plan=json.loads((root/'manifest.json').read_text())
        expected_ids={x['id'] for x in plan['episodes']}
        actual_ids={x.parent.name for x in root.glob('*/summary.json')}
        assert len(expected_ids)==expected and actual_ids==expected_ids
        assert plan['model']==MODEL
        for path in root.glob('*/summary.json'):
            row=json.loads(path.read_text())
            assert row['model']==MODEL and len(row['beats'])==1
        shutil.copyfile(OPS/(run+'.log'),ROOT/'runs'/(run+'.log'))
    shutil.copyfile(OPS/'m2-smoke.log',ROOT/'runs'/'m2-smoke.log')
    output=ROOT/'data'/'second-model'
    output.mkdir(parents=True,exist_ok=False)
    entries=[]; checksums={}
    groups=[(run,[ROOT/'runs'/run,ROOT/'runs'/(run+'.log')],'confirmatory') for run in RUNS]
    aside=[ROOT/'runs'/'m2-smoke',ROOT/'runs'/'m2-smoke.log']
    aside.extend(p for p in (ROOT/'runs').glob('m2-*-technical-fail') if p.is_dir())
    groups.append(('set-aside',aside,'smoke-and-technical-first-attempts'))
    for name,paths,role in groups:
        files=files_under(paths)
        for path in files:
            if path.is_symlink(): raise RuntimeError('Symlink in raw archive')
            if secret in path.read_bytes(): raise RuntimeError('Credential detected; archive blocked')
        archive=output/(name+'.tar.gz')
        with archive.open('wb') as dest:
            with gzip.GzipFile(filename='',mode='wb',fileobj=dest,mtime=0,compresslevel=9) as gz:
                with tarfile.open(fileobj=gz,mode='w',format=tarfile.PAX_FORMAT) as tar:
                    for path in files:
                        relative=path.relative_to(ROOT).as_posix()
                        info=tar.gettarinfo(str(path),arcname=relative)
                        info.uid=info.gid=0; info.uname=info.gname=''; info.mode=0o644; info.mtime=0; info.pax_headers={}
                        with path.open('rb') as src: tar.addfile(info,src)
                        checksums[relative]=sha(path)
        item=dict(archive=archive.relative_to(ROOT).as_posix(),run_directories=[p.relative_to(ROOT).as_posix() for p in paths],
            role=role,file_count=len(files),uncompressed_bytes=sum(p.stat().st_size for p in files),
            archive_bytes=archive.stat().st_size,sha256=sha(archive),**metadata(files))
        if role=='confirmatory':
            assert item['episode_summaries']==RUNS[name]
            assert set(item['llm_calls_by_serving_deployment'])=={MODEL}
            selection=json.loads((OPS/(name+'-retry-selection.json')).read_text())
            item['technical_retry_episodes']=len(selection['episodes'])
        entries.append(item)
    (output/'FILES.sha256').write_text(''.join(f'{digest}  {path}\n' for path,digest in sorted(checksums.items())))
    (output/'SHA256SUMS').write_text(''.join(f'{row["sha256"]}  {row["archive"]}\n' for row in entries))
    evidence=output/'execution'; evidence.mkdir()
    for path in sorted(OPS.glob('*.json')):
        if path.name in ['progress.json','ATTENTION.json']: continue
        assert secret not in path.read_bytes()
        shutil.copyfile(path,evidence/path.name)
    for name in ['operations.py','full_sweep.py','check_config.py','package_records.py','network_guard.py','pause_retry.py','resume_retry.py','resume_guarded_run.py']:
        path=OPS/name
        assert secret not in path.read_bytes()
        shutil.copyfile(path,evidence/name)
    manifest=dict(format_version=1,snapshot_date=datetime.date.today().isoformat(),harness_commit=CODE,
        preregistration_commit=PREREG,model=MODEL,gateway='https://agentport.world/v1',
        description='Second-model preregistered replication: 270 planned episodes, plus separate smoke and technical attempts.',
        archives=entries,ledger_reconciliation=dict(status='pending',ledger_url='https://agentport.world/calls',
            response_header_cost_microusd=sum(x['response_header_cost_microusd'] for x in entries),
            note='Response-header charges are retained for reconciliation. usage.json contains a legacy price estimate and is not the actual bill.'),
        experimental_code_modified=False,experiment_and_episode_request_headers=False)
    write_json(output/'manifest.json',manifest)
    # Restore all archives into a clean temporary directory and compare each raw file.
    with tempfile.TemporaryDirectory(prefix='second-model-restore-') as temporary:
        temp=pathlib.Path(temporary)
        for item in entries:
            with tarfile.open(ROOT/item['archive'],'r:gz') as tar: tar.extractall(temp,filter='data')
        restored={p.relative_to(temp).as_posix():sha(p) for p in temp.rglob('*') if p.is_file()}
        assert restored==checksums
    print(json.dumps({'archives':len(entries),'raw_files_verified':len(checksums),
        'summaries':sum(x['episode_summaries'] for x in entries if x['role']=='confirmatory'),
        'ledger_status':'pending','credentials_found':False}))

if __name__=='__main__': main()