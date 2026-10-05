// Decisive test: does headless Chromium actually RENDER -webkit-backdrop-filter?
// We inject a striped background and an overlay using -webkit-backdrop-filter:blur,
// then sample pixel colors to detect whether the stripes are smeared.

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-experimental-web-platform-features'] });
  const ctx = await browser.newContext({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  await page.setContent(`
    <!doctype html><html><head><style>
      body { margin:0; }
      .stripes {
        position:absolute; inset:0;
        background: repeating-linear-gradient(0deg, #ff0000 0px, #ff0000 8px, #00ff00 8px, #00ff00 16px);
      }
      .card-w {
        position:absolute; left:50px; top:50px; width:300px; height:200px;
        background: rgba(255,255,255,0.01);
        -webkit-backdrop-filter: blur(40px);
        backdrop-filter: blur(40px);
        border: 1px solid black;
      }
      .card-webkit-only {
        position:absolute; left:50px; top:50px; width:300px; height:200px;
        background: rgba(255,255,255,0.01);
        -webkit-backdrop-filter: blur(40px);
        border: 1px solid blue;
      }
    </style></head><body>
      <div class="stripes"></div>
      <div class="card-w" id="c1"></div>
    </body></html>
  `);
  await page.waitForTimeout(300);

  // Sample pixel colors inside the card region via canvas drawImage
  const result = await page.evaluate(() => {
    const card = document.getElementById('c1');
    const r = card.getBoundingClientRect();
    const sx = Math.round(r.left + 20), sy = Math.round(r.top + 20);
    // Use a canvas to read pixels from the page screenshot
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const ctx2 = canvas.getContext('2d');
    // Cannot easily grab live page pixels without html2canvas; instead, sample background stripes pattern
    // We rely on the DOM being rendered. Use getComputedStyle to confirm property resolved.
    const s = getComputedStyle(card);
    return {
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      backdropFilter: s.getPropertyValue('backdrop-filter'),
      webkitBackdropFilter: s.getPropertyValue('-webkit-backdrop-filter'),
    };
  });

  // Now use Playwright's screenshot to get pixels and analyze
  const buf = await page.screenshot({ clip: { x: 70, y: 70, width: 20, height: 20 } });
  // Decode PNG manually (minimal) — or use sharp if available
  let sharpOk = false;
  try { require.resolve('sharp'); sharpOk = true; } catch {}
  console.log('sharp available:', sharpOk);
  console.log('computed:', JSON.stringify(result));

  if (sharpOk) {
    const sharp = require('sharp');
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    // Sample center pixel
    const idx = (Math.floor(info.height/2) * info.width + Math.floor(info.width/2)) * info.channels;
    const px = [data[idx], data[idx+1], data[idx+2]];
    // If backdrop-filter is rendering blur(40px), the red/green stripes should blend toward a yellowish color (~128,128,0)
    // If NOT rendering, we'd see a sharp stripe (~255,0,0 or ~0,255,0)
    console.log('center pixel RGB:', px);
    const blended = (Math.abs(px[0]-128) < 40 && Math.abs(px[1]-128) < 40 && Math.abs(px[2]) < 60);
    console.log('blur rendering (pixel blended toward 128,128,0)?', blended);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
