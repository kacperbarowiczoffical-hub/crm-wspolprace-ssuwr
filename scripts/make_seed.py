"""Generuje supabase/seed.sql z bazy firm (JSON z uporządkowanego arkusza).

Użycie: python3 scripts/make_seed.py data.json > supabase/seed.sql
Rozdziela dawną kolumnę „E-mail / social” na osobne pola: e-mail, Instagram,
Facebook, TikTok, LinkedIn, strona www. Resztę tekstu dopisuje do uwag.
"""
import json, re, sys

EMAIL = re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+')
URL = re.compile(r'https?://[^\s,;]+')

def split_contact(k, w):
    out = {'email': [], 'instagram': '', 'facebook': '', 'tiktok': '', 'linkedin': '', 'website': '', 'rest': []}
    text = (k or '') + '\n' + (w or '')
    for e in EMAIL.findall(k or ''):
        e = e.rstrip('.')
        if e.lower() not in [x.lower() for x in out['email']]:
            out['email'].append(e)
    for u in URL.findall(text):
        u = u.rstrip('.,)')
        lu = u.lower()
        if 'instagram.com' in lu:
            out['instagram'] = out['instagram'] or u
        elif 'facebook.com' in lu or 'fb.com' in lu or 'm.me/' in lu or 'messenger.com' in lu:
            out['facebook'] = out['facebook'] or u
        elif 'tiktok.com' in lu:
            out['tiktok'] = out['tiktok'] or u
        elif 'linkedin.com' in lu:
            out['linkedin'] = out['linkedin'] or u
        else:
            out['website'] = out['website'] or u
    rest = EMAIL.sub('', URL.sub('', k or ''))
    rest = re.sub(r'\s+', ' ', rest.replace('\ufeff', '')).strip(' ,;|-:/.+')
    if re.fullmatch(r'(www\.)?[\w-]+(\.[\w-]+)*\.[a-z]{2,}(/\S*)?', rest, re.I):
        out['website'] = out['website'] or 'https://' + rest
        rest = ''
    if rest.lower() in ('brak', 'nie ma', 'none', 'x'):
        rest = ''
    m = re.match(r'^(?:ig:\s*)?@?([\w.]*[_.\d][\w.]*)$', rest, re.I) if re.match(r'^(?:ig:\s*)?@?[\w.]+$', rest, re.I) else None
    if m and not out['instagram']:
        out['instagram'] = 'https://www.instagram.com/' + m.group(1) + '/'
        rest = ''
    if rest:
        out['rest'].append(rest)
    return out

def q(v):
    if v is None or v == '':
        return "''"
    return "'" + str(v).replace("'", "''") + "'"

STAGE = {'G': 'wspolpraca', 'Y': 'pozniej', 'R': 'odmowa', '': 'nowa'}

def main():
    data = json.load(open(sys.argv[1], encoding='utf-8'))
    print('-- Firmy z bazy Komisji (import startowy). Uruchom po schema.sql.')
    print('begin;')
    cols = 'id,name,sector,category,reach,phone,email,instagram,facebook,tiktok,linkedin,website,address,collected_by,notes,last_mail,status,stage'
    batch = []
    for r in data:
        c = split_contact(r.get('k', ''), r.get('w', ''))
        notes = r.get('u', '')
        if c['rest']:
            notes = (notes + ('; ' if notes else '') + 'Kontakt: ' + '; '.join(c['rest'])).strip()
        s = r.get('s', '') or ''
        vals = [r['id'], r['n'], r.get('sec', 'Do uzupełnienia'), r.get('c', ''), r.get('z', ''), r.get('t', ''),
                ', '.join(c['email']), c['instagram'], c['facebook'], c['tiktok'], c['linkedin'], c['website'],
                r.get('a', ''), r.get('kto', ''), notes, r.get('m', ''), s, STAGE.get(s, 'nowa')]
        batch.append('(' + ','.join(q(v) for v in vals) + ')')
        if len(batch) == 200:
            print(f'insert into public.firms ({cols}) values\n' + ',\n'.join(batch) + '\non conflict (id) do nothing;')
            batch = []
    if batch:
        print(f'insert into public.firms ({cols}) values\n' + ',\n'.join(batch) + '\non conflict (id) do nothing;')
    print('commit;')

if __name__ == '__main__':
    main()
