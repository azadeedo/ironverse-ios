"""Read-only TestFlight status: the latest builds Apple has, their processing
state, internal-testing state and any problems (Codemagic `asc-status`)."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from api import call, get  # noqa: E402

APP_ID = os.environ.get('APP_STORE_APPLE_ID', '6825232233')
builds = call('GET', f'/v1/builds?filter[app]={APP_ID}&sort=-uploadedDate&limit=12&include=buildBetaDetail,preReleaseVersion')
detail = {i['id']: i['attributes'] for i in builds.get('included', []) if i['type'] == 'buildBetaDetails'}
for b in builds['data']:
    a = b['attributes']
    bd = (b.get('relationships', {}).get('buildBetaDetail', {}) or {}).get('data') or {}
    d = detail.get(bd.get('id'), {})
    print(f"build {a.get('version'):>3}  uploaded {a.get('uploadedDate', '')[:16]}  processing={a.get('processingState')}  "
          f"expired={a.get('expired')}  internal={d.get('internalBuildState')}  external={d.get('externalBuildState')}  "
          f"minOS={a.get('minOsVersion')}")
# delivery problems Apple reports for the newest uploads
for b in builds['data'][:6]:
    issues = get(f"/v1/builds/{b['id']}/diagnosticSignatures")
    if issues.get('data'):
        print('  diagnostics for', b['attributes'].get('version'), [x['attributes'].get('signature') for x in issues['data'][:3]])
groups = get(f'/v1/apps/{APP_ID}/betaGroups').get('data') or []
for g in groups:
    ga = g['attributes']
    gb = get(f"/v1/betaGroups/{g['id']}/builds?limit=5").get('data') or []
    print(f"group {ga.get('name')}: internal={ga.get('isInternalGroup')} auto={ga.get('hasAccessToAllBuilds')} builds={[x['attributes'].get('version') for x in gb]}")
