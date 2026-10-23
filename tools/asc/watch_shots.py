"""Upload Apple Watch screenshots (taken in the watchOS simulator by the Codemagic
`watch-screenshots` workflow) to version 1.0.0 through the official API.
Usage: python3 tools/asc/watch_shots.py store/watch/*.png
Idempotent: an existing Watch screenshot set for the same display type is emptied first.
"""
import hashlib
import os
import struct
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(__file__))
from api import call, get  # noqa: E402

APP_ID = os.environ.get('APP_STORE_APPLE_ID', '6825232233')
VERSION = '1.0.0'
# native simulator sizes -> App Store display type
TYPES = {422: 'APP_WATCH_ULTRA', 410: 'APP_WATCH_ULTRA', 416: 'APP_WATCH_SERIES_10', 374: 'APP_WATCH_SERIES_10',
         396: 'APP_WATCH_SERIES_7', 352: 'APP_WATCH_SERIES_7', 368: 'APP_WATCH_SERIES_4', 324: 'APP_WATCH_SERIES_4',
         312: 'APP_WATCH_SERIES_3'}


def png_size(path):
    with open(path, 'rb') as f:
        head = f.read(24)
    return struct.unpack('>II', head[16:24])


def upload(set_id, path):
    data = open(path, 'rb').read()
    res = call('POST', '/v1/appScreenshots', {'data': {'type': 'appScreenshots',
          'attributes': {'fileName': os.path.basename(path), 'fileSize': len(data)},
          'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': set_id}}}}})['data']
    for op in res['attributes']['uploadOperations']:
        h = {x['name']: x['value'] for x in op.get('requestHeaders') or []}
        r = requests.request(op['method'], op['url'], headers=h, data=data[op['offset']:op['offset'] + op['length']], timeout=120)
        if r.status_code >= 300:
            raise RuntimeError(f'upload chunk -> {r.status_code}')
    call('PATCH', f'/v1/appScreenshots/{res["id"]}', {'data': {'type': 'appScreenshots', 'id': res['id'],
         'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(data).hexdigest()}}})
    st = {}
    for _ in range(24):
        time.sleep(5)
        st = call('GET', f'/v1/appScreenshots/{res["id"]}')['data']['attributes'].get('assetDeliveryState') or {}
        if st.get('state') in ('COMPLETE', 'FAILED'):
            break
    print(f'   {os.path.basename(path)}: {st.get("state")} {st.get("errors") or ""}')
    if st.get('state') == 'FAILED':
        raise RuntimeError('Apple rejected the screenshot')


shots = sorted(p for p in sys.argv[1:] if p.endswith('.png'))
if not shots:
    sys.exit('no screenshots given')
w, h = png_size(shots[0])
dtype = TYPES.get(w)
print(f'{len(shots)} screenshots, {w}x{h} -> {dtype}')
if not dtype:
    sys.exit(f'unknown Watch screenshot width {w}')

versions = call('GET', f'/v1/apps/{APP_ID}/appStoreVersions?filter[platform]=IOS&limit=20')['data']
vid = next(v['id'] for v in versions if v['attributes']['versionString'] == VERSION)
locs = call('GET', f'/v1/appStoreVersions/{vid}/appStoreVersionLocalizations')['data']
for loc in locs:
    lid, locale = loc['id'], loc['attributes']['locale']
    sets = get(f'/v1/appStoreVersionLocalizations/{lid}/appScreenshotSets?filter[screenshotDisplayType]={dtype}').get('data') or []
    if sets:
        sid = sets[0]['id']
        for old in get(f'/v1/appScreenshotSets/{sid}/appScreenshots').get('data') or []:
            call('DELETE', f'/v1/appScreenshots/{old["id"]}')
    else:
        sid = call('POST', '/v1/appScreenshotSets', {'data': {'type': 'appScreenshotSets', 'attributes': {'screenshotDisplayType': dtype},
                   'relationships': {'appStoreVersionLocalization': {'data': {'type': 'appStoreVersionLocalizations', 'id': lid}}}}})['data']['id']
    print(f'== {locale}: set {sid}')
    for p in shots:
        upload(sid, p)
print('SUMMARY: Watch screenshots uploaded')
