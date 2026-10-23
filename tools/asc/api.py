"""Shared App Store Connect API helpers for the Codemagic workflows (key from the
"Ironverse ASC key" integration; it never lives in this repo or in logs)."""
import json
import os
import time

import jwt
import requests

API = 'https://api.appstoreconnect.apple.com'


def pem_key():
    # Codemagic may hand the .p8 over with literal "\n", stray quotes or no PEM armour
    raw = os.environ['APP_STORE_CONNECT_PRIVATE_KEY'].strip()
    # Codemagic CLI-style references: "@file:/path/key.p8" or "@env:OTHER_VAR"
    if raw.startswith('@file:'):
        raw = open(os.path.expanduser(raw[6:]), encoding='utf-8').read().strip()
    elif raw.startswith('@env:'):
        raw = os.environ[raw[5:]].strip().strip('"').strip("'").replace(chr(92) + 'n', ' ')
    raw = raw.replace('-----BEGIN PRIVATE KEY-----', ' ').replace('-----END PRIVATE KEY-----', ' ')
    body = ''.join(raw.split())
    lines = [body[i:i + 64] for i in range(0, len(body), 64)]
    return '-----BEGIN PRIVATE KEY-----\n' + '\n'.join(lines) + '\n-----END PRIVATE KEY-----\n'


def token():
    key = pem_key()
    now = int(time.time())
    return jwt.encode({'iss': os.environ['APP_STORE_CONNECT_ISSUER_ID'], 'iat': now, 'exp': now + 900, 'aud': 'appstoreconnect-v1'},
                      key, algorithm='ES256', headers={'kid': os.environ['APP_STORE_CONNECT_KEY_IDENTIFIER'], 'typ': 'JWT'})


def call(method, path, body=None, ok=(200, 201, 204)):
    r = requests.request(method, API + path, headers={'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'},
                         data=json.dumps(body) if body is not None else None, timeout=60)
    if r.status_code not in ok:
        raise RuntimeError(f'{method} {path} -> {r.status_code}: {r.text[:3000]}')
    return r.json() if r.text else {}


def get(path):
    r = requests.get(API + path, headers={'Authorization': 'Bearer ' + token()}, timeout=60)
    return r.json() if r.status_code == 200 else {'error': r.status_code, 'body': r.text[:300]}
