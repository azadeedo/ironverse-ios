"""App Store Connect listing chores through the official API (run by the Codemagic
`asc-listing` workflow, which supplies the API key from the "Ironverse ASC key"
integration — the key never lives in this repo or in logs).

What it does (idempotent, safe to re-run):
  1. attaches TestFlight build $IV_BUILD (default 3) to version 1.0.0
  2. writes the App Review contact + notes (no phone — the owner adds it)
  3. uploads the paywall review screenshot to each subscription
It never submits anything for review and never changes prices.
"""
import hashlib
import json
import os
import sys
import time

import jwt
import requests

API = 'https://api.appstoreconnect.apple.com'
APP_ID = os.environ.get('APP_STORE_APPLE_ID', '6825232233')
VERSION = '1.0.0'
BUILD = os.environ.get('IV_BUILD', '3')
SUBS = {'6825262011': 'store/review/paywall-monthly.png', '6825259014': 'store/review/paywall-yearly.png'}
NOTES = """Ironverse needs no login. On first launch, tap Get started (every question can be skipped), then "Show me around" for a guided tour.

SUBSCRIPTIONS: New installs get every Premium feature free for 7 days. This is an app-side preview with no StoreKit offer and no card. After that the core app stays free, and Pro (monthly com.nouriapps.ironverse.pro.monthly / yearly com.nouriapps.ironverse.pro.yearly) unlocks the 12-week program, advanced progress, barcode scanner, meal-photo estimates, goal coach, photo compare, 3D body and meal plans. The paywall is at More > Ironverse Pro, with Restore Purchases and Terms/Privacy links.

TO TRY: Workout tab > Start this workout > log a set. Food tab > + > pick a cuisine chip (e.g. Thai) > tap + on a dish. Progress tab shows charts after a few entries. More > Suggest & report sends feedback to the developer.

Data is stored on the device. The optional meal-photo feature uses the user's OWN Anthropic API key and asks for consent before sending. Barcode lookups use the public Open Food Facts database. Location is used only while tracking an outdoor run. There are no ads and no tracking."""

failures = []


def token():
    key = os.environ['APP_STORE_CONNECT_PRIVATE_KEY']
    now = int(time.time())
    return jwt.encode({'iss': os.environ['APP_STORE_CONNECT_ISSUER_ID'], 'iat': now, 'exp': now + 900, 'aud': 'appstoreconnect-v1'},
                      key, algorithm='ES256', headers={'kid': os.environ['APP_STORE_CONNECT_KEY_IDENTIFIER'], 'typ': 'JWT'})


def call(method, path, body=None, ok=(200, 201, 204)):
    r = requests.request(method, API + path, headers={'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'},
                         data=json.dumps(body) if body is not None else None, timeout=60)
    if r.status_code not in ok:
        raise RuntimeError(f'{method} {path} -> {r.status_code}: {r.text[:800]}')
    return r.json() if r.text else {}


def step(name):
    def wrap(fn):
        print(f'\n== {name}')
        try:
            fn()
            print(f'   OK')
        except Exception as e:  # keep going; report every failure at the end
            print(f'   FAILED: {e}')
            failures.append(name)
    return wrap


versions = call('GET', f'/v1/apps/{APP_ID}/appStoreVersions?filter[platform]=IOS&limit=20')['data']
version = next(v for v in versions if v['attributes']['versionString'] == VERSION)
VID = version['id']
print(f'version {VERSION}: id {VID}, state {version["attributes"].get("appStoreState")}')


@step(f'attach build {BUILD} to version {VERSION}')
def _():
    builds = call('GET', f'/v1/builds?filter[app]={APP_ID}&filter[version]={BUILD}&filter[preReleaseVersion.platform]=IOS')['data']
    if not builds:
        raise RuntimeError(f'build {BUILD} not found')
    b = builds[0]
    print(f'   build {BUILD}: {b["id"]}, processing {b["attributes"].get("processingState")}')
    call('PATCH', f'/v1/appStoreVersions/{VID}/relationships/build', {'data': {'type': 'builds', 'id': b['id']}})
    now = call('GET', f'/v1/appStoreVersions/{VID}/build')['data']
    print(f'   version now uses build version {now["attributes"]["version"] if now else None}')


@step('App Review contact and notes')
def _():
    attrs = {'contactFirstName': 'Nouri', 'contactLastName': 'Khalil', 'contactEmail': 'azade@live.com.au',
             'demoAccountRequired': False, 'notes': NOTES}
    r = requests.get(API + f'/v1/appStoreVersions/{VID}/appStoreReviewDetail', headers={'Authorization': 'Bearer ' + token()}, timeout=60)
    existing = r.json().get('data') if r.status_code == 200 else None
    if existing:
        call('PATCH', f'/v1/appStoreReviewDetails/{existing["id"]}', {'data': {'type': 'appStoreReviewDetails', 'id': existing['id'], 'attributes': attrs}})
    else:
        call('POST', '/v1/appStoreReviewDetails', {'data': {'type': 'appStoreReviewDetails', 'attributes': attrs,
             'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': VID}}}}})
    d = call('GET', f'/v1/appStoreVersions/{VID}/appStoreReviewDetail')['data']['attributes']
    print(f'   contact {d.get("contactFirstName")} {d.get("contactLastName")} / {d.get("contactEmail")}, phone set: {bool(d.get("contactPhone"))}, notes {len(d.get("notes") or "")} chars')


def upload_review_shot(sub_id, path):
    sub = call('GET', f'/v1/subscriptions/{sub_id}')['data']['attributes']
    print(f'   {sub.get("productId")}: state {sub.get("state")}')
    r = requests.get(API + f'/v1/subscriptions/{sub_id}/appStoreReviewScreenshot', headers={'Authorization': 'Bearer ' + token()}, timeout=60)
    cur = r.json().get('data') if r.status_code == 200 else None
    if cur:
        st = (cur['attributes'].get('assetDeliveryState') or {}).get('state')
        if st == 'COMPLETE':
            print(f'   already has a review screenshot ({cur["attributes"].get("fileName")}), kept')
            return
        call('DELETE', f'/v1/subscriptionAppStoreReviewScreenshots/{cur["id"]}')
    data = open(path, 'rb').read()
    res = call('POST', '/v1/subscriptionAppStoreReviewScreenshots', {'data': {'type': 'subscriptionAppStoreReviewScreenshots',
          'attributes': {'fileName': os.path.basename(path), 'fileSize': len(data)},
          'relationships': {'subscription': {'data': {'type': 'subscriptions', 'id': sub_id}}}}})['data']
    for op in res['attributes']['uploadOperations']:
        chunk = data[op['offset']:op['offset'] + op['length']]
        h = {x['name']: x['value'] for x in op.get('requestHeaders') or []}
        u = requests.request(op['method'], op['url'], headers=h, data=chunk, timeout=120)
        if u.status_code >= 300:
            raise RuntimeError(f'upload chunk -> {u.status_code}')
    call('PATCH', f'/v1/subscriptionAppStoreReviewScreenshots/{res["id"]}', {'data': {'type': 'subscriptionAppStoreReviewScreenshots', 'id': res['id'],
         'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(data).hexdigest()}}})
    for _ in range(12):
        time.sleep(5)
        st = (call('GET', f'/v1/subscriptionAppStoreReviewScreenshots/{res["id"]}')['data']['attributes'].get('assetDeliveryState') or {})
        if st.get('state') in ('COMPLETE', 'FAILED'):
            break
    print(f'   uploaded {os.path.basename(path)}: {st.get("state")} {st.get("errors") or ""}')
    if st.get('state') == 'FAILED':
        raise RuntimeError('Apple rejected the screenshot')


for sid, p in SUBS.items():
    step(f'review screenshot for subscription {sid}')(lambda sid=sid, p=p: upload_review_shot(sid, p))

print('\nSUMMARY: ' + ('all steps OK' if not failures else 'FAILED: ' + '; '.join(failures)))
sys.exit(1 if failures else 0)
