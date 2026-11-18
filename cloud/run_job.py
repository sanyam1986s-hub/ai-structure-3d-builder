#!/usr/bin/env python3
"""AI Structure 3D Builder v5.9 — headless cloud runner.
Runs the real web app (index.html + acad.js) in headless Chrome, loads the drawings, applies the params/arch JSON
that Claude wrote after reading the drawings, then builds model + design + 2D sheets + BOQ and writes every export.

usage: python3 run_job.py --app <repo dir> --job job.json --drawings <dir> --out <dir>
job.json = {"params": {...same schema as the app's AI reply...}, "arch": {"walls":[...],"openings":[...],"rooms":[...]} (optional)}
"""
import argparse, asyncio, base64, json, os, re, subprocess, sys, glob
NM = '/tmp/npmx/node_modules/'

def ensure_libs():
    if os.path.exists(NM + 'three/build/three.module.js') and os.path.exists(NM + 'pdfjs-dist/build/pdf.min.js'):
        return
    os.makedirs('/tmp/npmx', exist_ok=True)
    subprocess.run(['npm', 'i', '--prefix', '/tmp/npmx', 'three@0.160.0', 'pdfjs-dist@3.11.174', '--no-audit', '--no-fund'], check=True)

def local(url):
    if 'pdf.worker' in url: return NM + 'pdfjs-dist/build/pdf.worker.min.js'
    if 'jsdelivr' in url and 'three@0.160.0/' in url: return NM + 'three/' + url.split('three@0.160.0/')[1]
    if 'cdnjs' in url: return NM + 'pdfjs-dist/build/' + url.rsplit('/', 1)[1]
    return None

async def main(a):
    from playwright.async_api import async_playwright
    ensure_libs()
    job = json.load(open(a.job, encoding='utf8'))
    files = sorted(f for f in glob.glob(os.path.join(a.drawings, '*')) if re.search(r'\.(pdf|png|jpe?g|webp|dxf)$', f, re.I))
    os.makedirs(a.out, exist_ok=True)
    async with async_playwright() as p:
        exe = '/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
        b = await p.chromium.launch(executable_path=exe, args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 1400, 'height': 900}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        async def route(r):
            f = local(r.request.url)
            if f and os.path.exists(f): await r.fulfill(path=f, content_type='application/javascript')
            else: await r.abort()
        await pg.route(re.compile(r'.*(jsdelivr|cdnjs|googleapis|gstatic).*'), route)
        await pg.add_init_script("try{sessionStorage.setItem('ai3d_offline','1');localStorage.setItem('ai3d_settings_v1',JSON.stringify({showStart:false,askTypes:false,autoPlay:false,fx:false,lim58:1,pdfPages:100,imgMax:100,dxfMax:100}))}catch(e){}")
        await pg.goto('file://' + os.path.abspath(os.path.join(a.app, 'index.html')))
        await pg.wait_for_function('window.__ai3dCloud && window.__ai3d', timeout=60000)
        await pg.evaluate("document.querySelectorAll('.hud.on').forEach(e=>e.classList.remove('on'))")
        if files:
            await pg.set_input_files('#fileIn', files)
            for _ in range(900):  # PDFs are rendered page by page
                await pg.wait_for_timeout(1000)
                busy = await pg.evaluate("(document.querySelector('#suDrop b')?.textContent||'').startsWith('กำลังอ่าน')")
                if not busy: break
        res = await pg.evaluate('job => window.__ai3dCloud.run(job)', job)
        for n, txt in res['files'].items(): open(os.path.join(a.out, n), 'w', encoding='utf8').write(txt)
        for n, b64 in res['binary'].items(): open(os.path.join(a.out, n), 'wb').write(base64.b64decode(b64))
        sd = os.path.join(a.out, 'ภาพโมเดล'); os.makedirs(sd, exist_ok=True)
        for v, url in res['shots'].items(): open(os.path.join(sd, f'{res["name"]}_{v}.jpg'), 'wb').write(base64.b64decode(url.split(',', 1)[1]))
        await b.close()
    out = {'name': res['name'], 'summary': res['summary'], 'log': res['log'], 'files': sorted(os.listdir(a.out)), 'page_errors': errs[:10], 'drawings_loaded': len(files)}
    json.dump(out, open(os.path.join(a.out, '_run.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1))

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--app', required=True); ap.add_argument('--job', required=True)
    ap.add_argument('--drawings', default=''); ap.add_argument('--out', required=True)
    asyncio.run(main(ap.parse_args()))
