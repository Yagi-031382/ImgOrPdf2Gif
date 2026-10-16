// Start `python3 -m http.server 8000 --bind 127.0.0.1` in the repository first.
const { chromium } = require('playwright');
const bundledChromium = require('@sparticuz/chromium');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
(async () => {
  const directory = mkdtempSync(join(tmpdir(), 'gif-pages-'));
  let browser;
  const python = process.env.TEST_PYTHON || '.venv/bin/python';
  try {
    execFileSync(python, ['-c', `from PIL import Image
pages=[Image.new('RGB',(64,48),color) for color in ['red','blue']]
pages[0].save('${directory}/sample.pdf',save_all=True,append_images=pages[1:])`]);
    execFileSync('ffmpeg', ['-v','error','-f','lavfi','-i','testsrc=size=64x48:rate=10:duration=1','-c:v','libvpx-vp9',join(directory,'sample.webm')]);
    browser = await chromium.launch({args: bundledChromium.args, executablePath: await bundledChromium.executablePath(), headless: true});
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const requests = [];
    page.on('request', request => requests.push(request));
    await page.goto('http://127.0.0.1:8000/docs/');
    await page.locator('[data-mode=pdf]').click();
    await page.locator('#files').setInputFiles(join(directory,'sample.pdf'));
    await page.locator('[name=duration]').selectOption('500');
    await page.locator('button[type=submit]').click();
    await page.locator('#result').waitFor({state:'visible',timeout:60000});
    let downloadPromise = page.waitForEvent('download');
    await page.locator('#download').click();
    const pdfDownload = await downloadPromise;
    await pdfDownload.saveAs(join(directory,'pdf.gif'));
    execFileSync(python, ['-c', `from PIL import Image
im=Image.open('${directory}/pdf.gif')
assert im.n_frames==2
assert im.info['duration']==500
assert im.size==(480,360)
assert im.info['loop']==0`]);
    console.log('PASS PDF mode: valid two-frame GIF, dimensions, delay and loop');
    await page.locator('[data-mode=video]').click();
    await page.locator('#files').setInputFiles(join(directory,'sample.webm'));
    await page.locator('[name=fps]').selectOption('10');
    await page.locator('button[type=submit]').click();
    await page.locator('#result').waitFor({state:'visible',timeout:60000});
    downloadPromise = page.waitForEvent('download');
    await page.locator('#download').click();
    await (await downloadPromise).saveAs(join(directory,'video.gif'));
    execFileSync(python, ['-c', `from PIL import Image
im=Image.open('${directory}/video.gif')
assert im.n_frames==10, im.n_frames
assert im.size==(480,360)
assert im.info['duration']==100`]);
    console.log('PASS video mode: actual WebM conversion, frame count and dimensions');
    await page.locator('[data-mode=pdf]').click();
    await page.locator('#files').setInputFiles([
      {name:'valid.pdf',mimeType:'application/pdf',buffer:require('node:fs').readFileSync(join(directory,'sample.pdf'))},
      {name:'broken.pdf',mimeType:'application/pdf',buffer:Buffer.from('bad pdf')}
    ]);
    await page.locator('button[type=submit]').click();
    await page.locator('#result').waitFor({state:'visible',timeout:60000});
    downloadPromise = page.waitForEvent('download');
    await page.locator('#download').click();
    await (await downloadPromise).saveAs(join(directory,'batch.zip'));
    execFileSync(python, ['-c', `import zipfile
with zipfile.ZipFile('${directory}/batch.zip') as z:
 assert set(z.namelist())=={'1_valid.gif','errors.txt'}
 assert 'broken.pdf' in z.read('errors.txt').decode()`]);
    console.log('PASS partial batch: successful GIF and failure report in ZIP');
    assert.equal(requests.filter(r=>r.method()!=='GET').length,0);
    assert.equal(requests.filter(r=>!r.url().startsWith('http://127.0.0.1:8000/') && !r.url().startsWith('blob:')).length,0);
    assert.deepEqual(errors, []);
    console.log('PASS static subdirectory hosting: no uploads, external requests or browser errors');
  } finally {
    if (browser) await browser.close();
    rmSync(directory,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
