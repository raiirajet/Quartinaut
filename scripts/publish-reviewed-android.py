#!/usr/bin/env python3
"""Publish an already signed, hash-pinned preview. No signing key is used by CI."""
import argparse, hashlib, json, os, re, subprocess, urllib.error, urllib.parse, urllib.request
from pathlib import Path

def run(*args, **kwargs):
    return subprocess.run(list(args), check=True, **kwargs)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('metadata',type=Path)
    parser.add_argument('destination',type=Path)
    parser.add_argument('--publish',action='store_true')
    args=parser.parse_args();meta=json.loads(args.metadata.read_text())
    assert meta['tag']=='android-v34-preview' and meta['versionCode']==34
    assert re.fullmatch(r'[0-9a-f]{40}',meta['sourceCommit'])
    origin=urllib.parse.urlsplit(meta['origin'])
    assert origin.scheme=='https' and origin.port is None and origin.username is None
    assert origin.hostname.startswith('quartinaut--android-34-') and origin.hostname.endswith('.web.app')
    expected={'Quartinaut-Android-v34-preview.apk','Quartinaut-Android-v34-preview.aab','SHA256SUMS.txt','release-verification.json'}
    assert set(meta['files'])==expected
    args.destination.mkdir(parents=True,exist_ok=True)
    for name,item in meta['files'].items():
        assert re.fullmatch(r'[0-9a-f]{64}',item['sha256'])
        target=args.destination/name
        if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest()!=item['sha256']:
            url=meta['origin'].rstrip('/')+'/'+name
            try: response=urllib.request.urlopen(url,timeout=120)
            except urllib.error.HTTPError as error:
                if error.code not in [404,410]:raise
                response=urllib.request.urlopen('https://github.com/raiirajet/Quartinaut/releases/download/'+meta['tag']+'/'+name,timeout=120)
            with response, target.open('wb') as output:
                while chunk:=response.read(1024*1024):output.write(chunk)
        assert target.stat().st_size==item['bytes'], 'Incomplete download: '+name
        assert hashlib.sha256(target.read_bytes()).hexdigest()==item['sha256'], 'Hash mismatch: '+name
    sdk=Path(os.environ.get('ANDROID_HOME','/usr/local/lib/android/sdk'))/'build-tools/35.0.0'
    env=os.environ.copy();env['QUARTINAUT_SIGNING_SHA256']='A7F498276029BC545335FA8D9A12140FF5FEEEB215AC97AA9F4193F1BBE3F6AE'
    run('python3','scripts/verify-release-apk.py',str(sdk/'apksigner'),str(args.destination/'Quartinaut-Android-v34-preview.apk'),env=env)
    badging=run(str(sdk/'aapt2'),'dump','badging',str(args.destination/'Quartinaut-Android-v34-preview.apk'),capture_output=True,text=True).stdout
    assert "name='ch.quartinaut.nativeapp' versionCode='34' versionName='5.11.7-navigation-preview'" in badging
    assert 'application-debuggable' not in badging
    print('Verified the reviewed package, version, file hashes and existing signing identity.')
    if not args.publish:return
    repo='raiirajet/Quartinaut'
    run('gh','release','upload',meta['tag'],*(str(args.destination/name) for name in sorted(expected)),'--repo',repo,'--clobber')
    run('gh','release','edit',meta['tag'],'--repo',repo,'--draft=false','--prerelease','--target',meta['sourceCommit'],'--title','Quartinaut 5.11.7 · Build 34 · Stabile Navigation','--notes-file','releases/android-v34-preview.md')

if __name__=='__main__':main()
