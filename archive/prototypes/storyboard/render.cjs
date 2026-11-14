const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('artifacts/handoff-storyboard');
const url = 'http://127.0.0.1:4185/storyboard/';
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1700, height: 1100 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({content:'main{width:1666px;max-width:none}.frame-wrap{width:1602px;height:902px;aspect-ratio:auto;border-radius:0}.timeline,.toast{display:none!important}'});
    await page.waitForFunction(() => document.querySelector('.frame').getBoundingClientRect().width === 1600);
    for (let i = 1; i <= 6; i++) {
      await page.locator(`[data-frame="${i}"]`).screenshot({ path: path.join(output, `frame-0${i}.png`) });
    }
    // Exercise the account chooser and confirm the export summary follows it.
    await page.locator('[data-options="Studio"] [data-profile="Personal"]').click();
    await page.locator('[data-frame="5"]').scrollIntoViewIfNeeded();
    if (!(await page.locator('.export-window').innerText()).includes('Studio + Personal · 18 tabs')) throw new Error('Profile mapping did not update the export summary');
    await page.locator('[data-frame="3"]').scrollIntoViewIfNeeded();
    await page.getByRole('checkbox',{name:'Include Personal'}).uncheck();
    if (await page.locator('#selection-count').innerText() !== '2 Spaces · 20 tabs selected') throw new Error('Selection count did not update');
    const assets = await page.locator('img').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0));
    if (!assets) throw new Error('An image failed to load');
    if (errors.length) throw new Error(errors.join('\n'));
    const labels = ['01 / New browser. Same world.','02 / Choose your sidebar.','03 / Preview your library.','04 / Choose your accounts.','05 / Keep your folders.','06 / Pick up where you left off.'];
    const cards = labels.map((label,i)=>`<article><img src="data:image/png;base64,${fs.readFileSync(path.join(output,`frame-0${i+1}.png`)).toString('base64')}"><p>${label}</p></article>`).join('');
    await page.setViewportSize({width:1800,height:1700});
    await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#111;color:white;font:17px Arial}header{padding:28px 34px;display:flex;justify-content:space-between;font-size:21px}header span{font-size:14px;color:#888}main{padding:0 22px 22px;display:grid;grid-template-columns:1fr 1fr;gap:18px}article{margin:0;border:1px solid #303030;background:black}img{display:block;width:100%}p{margin:0;padding:15px 18px;color:#bbb;font-size:15px}</style><header>Handoff — film storyboard<span>BLACK / BLUE · SIX FRAMES · 45 SECONDS</span></header><main>${cards}</main>`);
    await page.locator('body').screenshot({path:path.join(output,'storyboard-six-frames.png')});
    await page.setViewportSize({width:390,height:844});
    await page.goto(url);
    await page.evaluate(()=>document.fonts.ready);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    if(overflow)throw new Error('Mobile horizontal overflow');
    console.log(JSON.stringify({frames:6,assetsLoaded:assets,accountMapping:'passed',selection:'passed',mobileOverflow:overflow,pageErrors:errors,output}));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
