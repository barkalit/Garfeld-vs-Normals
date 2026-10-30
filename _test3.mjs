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
await new Promise(r=>server.listen(8124,r));

// create a temp copy exposing test hooks
let html = fs.readFileSync('/workspace/index.html','utf8');
html = html.replace('</script>\n</body>', `
window.__testHooks = { endGame, showEndScreen, resetEndScreen };
</script>
</body>`);
if (!html.includes('__testHooks')) { console.log('HOOK INJECT FAILED'); process.exit(1); }
fs.writeFileSync('/tmp/test_index.html', html);
// serve /tmp file too
const origHandler = server.listeners('request')[0];
server.removeListener('request', origHandler);
server.on('request', (req,res)=>{
  if (req.url.startsWith('/test_index.html')) {
    res.writeHead(200, {'Content-Type':'text/html'});
    fs.createReadStream('/tmp/test_index.html').pipe(res);
    return;
  }
  origHandler(req,res);
});

const browser = await chromium.launch({ args: ['--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,300)));
await page.goto('http://localhost:8124/test_index.html');
await page.waitForTimeout(2500);
await page.evaluate(() => { document.getElementById('intro-video').currentTime = 6.5; });
await page.waitForFunction(() => document.getElementById('menu-screen').classList.contains('active'), null, {timeout: 25000});
await page.click('#btn-play');
await page.click('#diff-easy');
await page.waitForTimeout(500);
await page.keyboard.press('KeyF');
await page.waitForFunction(() => document.getElementById('game-screen').classList.contains('active'), null, {timeout: 30000});
console.log('GAME started');
await page.waitForTimeout(1200);

// ===== TEST DEATH =====
await page.evaluate(() => window.__testHooks.endGame(false));
const diedActive = await page.evaluate(()=>document.getElementById('ds-death-screen').classList.contains('active'));
console.log('DS death active:', diedActive);
await page.waitForTimeout(200);
const opEarly = await page.evaluate(()=>getComputedStyle(document.getElementById('ds-death-text')).opacity);
await page.screenshot({ path: '/tmp/death_early.png' });
await page.waitForTimeout(3100);
const opLate = await page.evaluate(()=>getComputedStyle(document.getElementById('ds-death-text')).opacity);
console.log('death text opacity early:', opEarly, '-> after 3.3s:', opLate);
await page.screenshot({ path: '/tmp/death_full.png' });
// wait for buttons screen
await page.waitForFunction(()=>document.getElementById('btn-restart').classList.contains('show'), null, {timeout: 6000});
const st = await page.evaluate(()=>({
  cursor: getComputedStyle(document.getElementById('custom-cursor')).display,
  titleColor: getComputedStyle(document.getElementById('gameover-title')).color,
  titleText: document.getElementById('gameover-title').textContent,
}));
console.log('defeat buttons screen:', JSON.stringify(st));
await page.mouse.move(640, 300); // move cursor into container so it renders at position
await page.hover('#btn-restart');
const hovered = await page.evaluate(()=>document.getElementById('custom-cursor').classList.contains('hover'));
console.log('cursor hover on restart btn:', hovered);
await page.screenshot({ path: '/tmp/defeat_buttons.png' });

// ===== RESTART then TEST VICTORY =====
await page.click('#btn-restart');
await page.waitForFunction(() => document.getElementById('game-screen').classList.contains('active'), null, {timeout: 30000});
console.log('RESTART ok, game active again');
await page.waitForTimeout(800);
await page.evaluate(() => window.__testHooks.endGame(true));
await page.waitForTimeout(2500);
const vic = await page.evaluate(()=>({
  fwOn: document.getElementById('fireworks-canvas').classList.contains('on'),
  glow: document.getElementById('victory-glow').style.display,
  titleShown: document.getElementById('gameover-title').classList.contains('show'),
  anim: document.getElementById('gameover-title').classList.contains('victory-anim'),
  cursor: getComputedStyle(document.getElementById('custom-cursor')).display,
  particles: true,
}));
console.log('VICTORY state:', JSON.stringify(vic));
await page.mouse.move(640, 640);
await page.hover('#btn-to-menu');
const hovered2 = await page.evaluate(()=>document.getElementById('custom-cursor').classList.contains('hover'));
console.log('cursor hover on menu btn (victory):', hovered2);
await page.screenshot({ path: '/tmp/victory_screen.png' });

// to menu -> fireworks must stop
await page.click('#btn-to-menu');
await page.waitForTimeout(600);
const afterMenu = await page.evaluate(()=>({
  fwOn: document.getElementById('fireworks-canvas').classList.contains('on'),
  menu: document.getElementById('menu-screen').classList.contains('active'),
  cursor: getComputedStyle(document.getElementById('custom-cursor')).display,
}));
console.log('AFTER to-menu:', JSON.stringify(afterMenu));
await browser.close();
server.close();
console.log('DONE3');
