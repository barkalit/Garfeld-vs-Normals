import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0,200)); });
await page.goto('file:///workspace/index.html');
await page.waitForTimeout(1500);

// Skip intro: force menu
await page.evaluate(() => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
});
// Simulate death via exposed functions? They're module-scoped. Instead trigger damage by dispatching nothing... 
// We can't access module scope. Use UI: click through is heavy. Alternative: emulate health depletion not possible.
// So test only static structure:
const res = await page.evaluate(() => {
  const ds = document.getElementById('ds-death-screen');
  const cs = getComputedStyle(document.getElementById('custom-cursor'));
  return {
    dsExists: !!ds,
    hintText: document.getElementById('ds-death-hint')?.textContent,
    cursorBg: cs.backgroundImage,
    cursorSize: cs.width + 'x' + cs.height,
    titleFont: getComputedStyle(document.getElementById('gameover-title')).fontFamily,
    fwCanvas: !!document.getElementById('fireworks-canvas'),
    youDeadAudio: !!document.querySelector('script'),
  };
});
console.log(JSON.stringify(res, null, 2));

// Test DS death screen visuals by manually adding classes
await page.evaluate(() => {
  document.getElementById('ds-death-screen').classList.add('active');
  document.getElementById('ds-death-text').classList.add('show');
  document.getElementById('ds-death-hint').classList.add('show');
});
await page.screenshot({ path: '/tmp/death.png' });

// Victory screen visuals
await page.evaluate(() => {
  document.getElementById('ds-death-screen').classList.remove('active');
  document.getElementById('gameover-screen').classList.add('active');
  document.getElementById('gameover-title').textContent = 'ПОБЕДА!';
  document.getElementById('gameover-title').style.color = '#ffdd55';
  document.getElementById('gameover-title').classList.add('show','victory-anim');
  const sub = document.getElementById('gameover-subtitle');
  sub.style.display='block'; sub.classList.add('show');
  document.getElementById('victory-glow').style.display='block';
  document.querySelectorAll('.gameover-btn').forEach(b=>b.classList.add('show'));
  document.getElementById('custom-cursor').style.display='block';
  document.getElementById('custom-cursor').style.left='640px';
  document.getElementById('custom-cursor').style.top='500px';
});
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/victory.png' });
await browser.close();
console.log('DONE');
