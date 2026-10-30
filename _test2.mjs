import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const types = {'.html':'text/html','.png':'image/png','.mp3':'audio/mpeg','.mp4':'video/mp4','.js':'text/javascript'};
const server = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p==='/') p='/index.html';
  const f = path.join('/workspace', p);
  if (fs.existsSync(f) && fs.statSync(f).isFile()) {
    res.writeHead(200, {'Content-Type': types[path.extname(f)]||'application/octet-stream'});
    fs.createReadStream(f).pipe(res);
  } else { res.writeHead(404); res.end('nf'); }
});
await new Promise(r=>server.listen(8123,r));

const browser = await chromium.launch({ args: ['--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,300)));
await page.goto('http://localhost:8123/index.html');
await page.waitForTimeout(2500);

// Skip intro & go to menu quickly
await page.evaluate(() => {
  document.getElementById('intro-video').currentTime = 6.5;
});
await page.waitForFunction(() => document.getElementById('menu-screen').classList.contains('active'), null, {timeout: 20000});
console.log('MENU reached');

// Click ИГРАТЬ -> difficulty -> ПРОСТАЧОК -> cutscene: skip with F
await page.click('#btn-play');
await page.click('#diff-easy');
await page.waitForTimeout(600);
await page.keyboard.press('KeyF');
// loading -> game
await page.waitForFunction(() => document.getElementById('game-screen').classList.contains('active'), null, {timeout: 30000});
console.log('GAME started');
await page.waitForTimeout(1500);

// Trigger death: dispatch many mousedown while not locked? Simpler: click once (locks may fail headless) then spam clicks
for (let i=0;i<15;i++){ await page.mouse.click(640,400); await page.waitForTimeout(120); }
let died = await page.evaluate(()=>document.getElementById('ds-death-screen').classList.contains('active'));
if (!died) {
  // fallback: shoot monsters? try more clicks
  for (let i=0;i<40;i++){ await page.mouse.click(640,400); await page.waitForTimeout(60); }
  died = await page.evaluate(()=>document.getElementById('ds-death-screen').classList.contains('active'));
}
console.log('DEATH screen active:', died);
if (died) {
  await page.waitForTimeout(700);
  const textOpacity = await page.evaluate(()=>getComputedStyle(document.getElementById('ds-death-text')).opacity);
  console.log('death text opacity at ~0.7s:', textOpacity);
  await page.screenshot({ path: '/tmp/death_mid.png' });
  await page.waitForTimeout(2800);
  await page.screenshot({ path: '/tmp/death_full.png' });
  // wait auto-proceed to buttons
  await page.waitForFunction(()=>document.getElementById('btn-restart').classList.contains('show'), null, {timeout: 6000});
  const cursorVisible = await page.evaluate(()=>getComputedStyle(document.getElementById('custom-cursor')).display);
  console.log('after death: buttons shown, cursor display =', cursorVisible);
  // hover restart button to test highlight
  await page.hover('#btn-restart');
  await page.screenshot({ path: '/tmp/defeat_buttons.png' });
  const hovered = await page.evaluate(()=>document.getElementById('custom-cursor').classList.contains('hover'));
  console.log('cursor hover class on button:', hovered);
}
await browser.close();
server.close();
console.log('DONE2');
