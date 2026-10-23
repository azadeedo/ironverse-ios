"""App Store Connect listing chores through the official API (run by the Codemagic
`asc-listing` workflow, which supplies the API key from the "Ironverse ASC key"
integration — the key never lives in this repo or in logs).

What it does (idempotent, safe to re-run):
  1. attaches TestFlight build $IV_BUILD (default 3) to version 1.0.0
  2. writes the App Review contact + notes (no phone — the owner adds it)
  3. uploads the paywall review screenshot to each subscription
It never changes prices, and submits for review only when IV_SUBMIT=1 (manual release).
"""
import hashlib
import json
import os
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(__file__))
from api import API, call, get, token  # noqa: E402
APP_ID = os.environ.get('APP_STORE_APPLE_ID', '6825232233')
VERSION = '1.0.0'
BUILD = os.environ.get('IV_BUILD', '3')
SUBS = {'6825262011': 'store/review/paywall-monthly.png', '6825259014': 'store/review/paywall-yearly.png'}
NOTES = """Ironverse needs no login. On first launch, tap Get started (every question can be skipped), then "Show me around" for a guided tour.

SUBSCRIPTIONS: New installs get every Premium feature free for 7 days. This is an app-side preview with no StoreKit offer and no card. After that the core app stays free, and Pro (monthly com.nouriapps.ironverse.pro.monthly / yearly com.nouriapps.ironverse.pro.yearly) unlocks the 12-week program, advanced progress, barcode scanner, meal-photo estimates, goal coach, photo compare, 3D body and meal plans. The paywall is at More > Ironverse Pro, with Restore Purchases and Terms/Privacy links.

TO TRY: Workout tab > Start this workout > log a set. Food tab > + > pick a cuisine chip (e.g. Thai) > tap + on a dish. Progress tab shows charts after a few entries. More > Suggest & report sends feedback to the developer.

Data is stored on the device. The optional meal-photo feature uses the user's OWN Anthropic API key and asks for consent before sending. Barcode lookups use the public Open Food Facts database. Location is used only while tracking an outdoor run. There are no ads and no tracking.

COACH PROGRAMS: styles are described in our own words as "inspired by" publicly known training approaches of well-known athletes and coaches. Each one states it is not their program and is not affiliated with or endorsed by them; no likeness, photo or quote is used."""

failures = []


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
    phone = os.environ.get('IV_CONTACT_PHONE', '').strip()
    if not phone:
        # Apple refuses the review details without a +country phone number
        print('   SKIPPED: set IV_CONTACT_PHONE (e.g. +61 4xx xxx xxx) in Codemagic to write these')
        return
    attrs = {'contactFirstName': 'Nouri', 'contactLastName': 'Khalil', 'contactEmail': 'azade@live.com.au',
             'contactPhone': phone, 'demoAccountRequired': False, 'notes': NOTES}
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

GROUP = '22499474'


@step('subscription group localization (App Store display name)')
def _():
    locs = get(f'/v1/subscriptionGroups/{GROUP}/subscriptionGroupLocalizations').get('data') or []
    for l in locs:
        print(f'   {l["attributes"].get("locale")}: "{l["attributes"].get("name")}" state {l["attributes"].get("state")}')
    if not any(l['attributes'].get('locale') == 'en-AU' for l in locs):
        call('POST', '/v1/subscriptionGroupLocalizations', {'data': {'type': 'subscriptionGroupLocalizations',
             'attributes': {'locale': 'en-AU', 'name': 'Ironverse Pro'},
             'relationships': {'subscriptionGroup': {'data': {'type': 'subscriptionGroups', 'id': GROUP}}}}})
        print('   created en-AU group name "Ironverse Pro"')


@step('subscription metadata check')
def _():
    for sid in SUBS:
        a = call('GET', f'/v1/subscriptions/{sid}')['data']['attributes']
        locs = get(f'/v1/subscriptions/{sid}/subscriptionLocalizations').get('data') or []
        prices = get(f'/v1/subscriptions/{sid}/prices?limit=200').get('data') or []
        shot = (get(f'/v1/subscriptions/{sid}/appStoreReviewScreenshot').get('data') or {}).get('attributes', {})
        print(f'   {a.get("productId")}: state {a.get("state")}, period {a.get("subscriptionPeriod")}, family {a.get("familySharable")}, '
              f'review note {bool(a.get("reviewNote"))}, localizations {[(l["attributes"]["locale"], l["attributes"].get("state")) for l in locs]}, '
              f'price rows {len(prices)}, screenshot {(shot.get("assetDeliveryState") or {}).get("state")}')

# ---------- submit for review (owner approval 23 Oct 2026; only with IV_SUBMIT=1) ----------
# Manual release: once Apple approves, the app waits for the owner to press Release.
if os.environ.get('IV_SUBMIT') == '1':
    if failures:
        print('\n== submit for review\n   NOT SUBMITTED: earlier steps failed')
    else:
        @step('release type: manual')
        def _():
            call('PATCH', f'/v1/appStoreVersions/{VID}', {'data': {'type': 'appStoreVersions', 'id': VID, 'attributes': {'releaseType': 'MANUAL'}}})
            a = call('GET', f'/v1/appStoreVersions/{VID}')['data']['attributes']
            print(f'   releaseType {a.get("releaseType")}')

        for sid in SUBS:
            def _sub(sid=sid):
                a = call('GET', f'/v1/subscriptions/{sid}')['data']['attributes']
                if a.get('state') != 'READY_TO_SUBMIT':
                    print(f'   {a.get("productId")} is {a.get("state")}, nothing to do')
                    return
                call('POST', '/v1/subscriptionSubmissions', {'data': {'type': 'subscriptionSubmissions',
                     'relationships': {'subscription': {'data': {'type': 'subscriptions', 'id': sid}}}}})
                print(f'   {a.get("productId")} submitted with the app version')
            step(f'submit subscription {sid} with the version')(_sub)

        @step(f'submit version {VERSION} for App Review')
        def _():
            if failures:  # never send the app without its subscriptions
                raise RuntimeError('not submitted, earlier steps failed: ' + '; '.join(failures))
            open_subs =get(f'/v1/reviewSubmissions?filter[app]={APP_ID}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW').get('data') or []
            if open_subs:
                rs = open_subs[0]['id']
                print(f'   reusing draft review submission {rs}')
            else:
                rs = call('POST', '/v1/reviewSubmissions', {'data': {'type': 'reviewSubmissions', 'attributes': {'platform': 'IOS'},
                          'relationships': {'app': {'data': {'type': 'apps', 'id': APP_ID}}}}})['data']['id']
                print(f'   created review submission {rs}')
            items = get(f'/v1/reviewSubmissions/{rs}/items').get('data') or []
            if not items:
                call('POST', '/v1/reviewSubmissionItems', {'data': {'type': 'reviewSubmissionItems',
                     'relationships': {'reviewSubmission': {'data': {'type': 'reviewSubmissions', 'id': rs}},
                                       'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': VID}}}}})
                print('   version added to the submission')
            call('PATCH', f'/v1/reviewSubmissions/{rs}', {'data': {'type': 'reviewSubmissions', 'id': rs, 'attributes': {'submitted': True}}})
            s = call('GET', f'/v1/reviewSubmissions/{rs}')['data']['attributes']
            print(f'   review submission state {s.get("state")}, submitted {s.get("submittedDate")}')
            v = call('GET', f'/v1/appStoreVersions/{VID}')['data']['attributes']
            print(f'   version {VERSION} state {v.get("appStoreState")}')
else:
    print('\n== submit for review\n   not requested (set IV_SUBMIT=1 when starting the build)')

print('\nSUMMARY: ' + ('all steps OK' if not failures else 'FAILED: ' + '; '.join(failures)))
sys.exit(1 if failures else 0)
