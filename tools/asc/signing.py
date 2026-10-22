"""Signing chores through the App Store Connect API (Codemagic `asc-signing` workflow).

  1. turns on the HealthKit capability for com.nouriapps.ironverse
  2. creates a fresh App Store provisioning profile that includes it
     (Apple invalidates the old one when a capability changes)

Idempotent. Never deletes certificates or the old profile. Codemagic then picks the
new profile up via Team settings → Code signing identities → "Fetch profiles".
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from api import call, get  # noqa: E402

BUNDLE = 'com.nouriapps.ironverse'
PROFILE_NAME = 'ironverse_app_store_healthkit'

b = call('GET', f'/v1/bundleIds?filter[identifier]={BUNDLE}&limit=5')['data']
bundle = next(x for x in b if x['attributes']['identifier'] == BUNDLE)
BID = bundle['id']
print(f'bundle id {BUNDLE}: {BID}')

caps = get(f'/v1/bundleIds/{BID}/bundleIdCapabilities').get('data') or []
names = [c['attributes'].get('capabilityType') for c in caps]
print('capabilities:', names)
if 'HEALTHKIT' not in names:
    call('POST', '/v1/bundleIdCapabilities', {'data': {'type': 'bundleIdCapabilities', 'attributes': {'capabilityType': 'HEALTHKIT'},
         'relationships': {'bundleId': {'data': {'type': 'bundleIds', 'id': BID}}}}})
    print('HealthKit capability turned on')

certs = [c for c in call('GET', '/v1/certificates?limit=50')['data']
         if c['attributes'].get('certificateType') in ('DISTRIBUTION', 'IOS_DISTRIBUTION')]
print('distribution certificates:', [(c['attributes'].get('name'), c['attributes'].get('expirationDate', '')[:10]) for c in certs])
if not certs:
    sys.exit('no distribution certificate found')

profiles = get(f'/v1/bundleIds/{BID}/profiles').get('data') or []
for p in profiles:
    a = p['attributes']
    print(f'profile {a.get("name")}: {a.get("profileType")} {a.get("profileState")}')
active = [p for p in profiles if p['attributes'].get('name') == PROFILE_NAME and p['attributes'].get('profileState') == 'ACTIVE']
if active:
    print(f'{PROFILE_NAME} already ACTIVE — kept')
else:
    stamp = time.strftime('%Y%m%d%H%M')
    res = call('POST', '/v1/profiles', {'data': {'type': 'profiles', 'attributes': {'name': PROFILE_NAME if not any(p['attributes'].get('name') == PROFILE_NAME for p in profiles) else f'{PROFILE_NAME}_{stamp}', 'profileType': 'IOS_APP_STORE'},
          'relationships': {'bundleId': {'data': {'type': 'bundleIds', 'id': BID}},
                            'certificates': {'data': [{'type': 'certificates', 'id': c['id']} for c in certs]}}}})['data']
    print(f'created profile {res["attributes"]["name"]}: {res["attributes"].get("profileState")}, expires {res["attributes"].get("expirationDate", "")[:10]}')

# ---- v10: Apple Watch companion app (com.nouriapps.ironverse.watchkitapp) ----
WATCH = BUNDLE + '.watchkitapp'
WATCH_PROFILE = 'ironverse_watch_app_store'
wb = [x for x in call('GET', f'/v1/bundleIds?filter[identifier]={WATCH}&limit=5')['data'] if x['attributes']['identifier'] == WATCH]
if wb:
    WID = wb[0]['id']
    print(f'watch bundle id {WATCH}: {WID} (exists)')
else:
    WID = call('POST', '/v1/bundleIds', {'data': {'type': 'bundleIds', 'attributes': {'identifier': WATCH, 'name': 'Ironverse Watch', 'platform': 'IOS'}}})['data']['id']
    print(f'created watch bundle id {WATCH}: {WID}')
wprofiles = get(f'/v1/bundleIds/{WID}/profiles').get('data') or []
if any(p['attributes'].get('name') == WATCH_PROFILE and p['attributes'].get('profileState') == 'ACTIVE' for p in wprofiles):
    print(f'{WATCH_PROFILE} already ACTIVE — kept')
else:
    r = call('POST', '/v1/profiles', {'data': {'type': 'profiles', 'attributes': {'name': WATCH_PROFILE, 'profileType': 'IOS_APP_STORE'},
          'relationships': {'bundleId': {'data': {'type': 'bundleIds', 'id': WID}},
                            'certificates': {'data': [{'type': 'certificates', 'id': c['id']} for c in certs]}}}})['data']
    print(f'created profile {r["attributes"]["name"]}: {r["attributes"].get("profileState")}')
print('SUMMARY: signing OK')
