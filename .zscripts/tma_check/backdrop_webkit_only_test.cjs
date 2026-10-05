// Decisive test #2: does -webkit-backdrop-filter ALONE (no standard prop)
// render in headless Chromium? This matches the deployed .glass-card CSS.

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  // Test A: ONLY -webkit-backdrop-filter (matches production .glass-card)
  await page.setContent(`
    <!doctype html><html><head><style>
      body { margin:0; }
      .stripes {
        position:absolute; inset:0;
        background: repeating-linear-gradient(0deg, #ff0000 0px, #ff0000 8px, #00ff00 8px, #00ff00 16px);
      }
      .card {
        position:absolute; left:50px; top:50px; width:300px; height:200px;
        background: rgba(255,255,255,0.01);
        -webkit-backdrop-filter: blur(40px);
        border: 1px solid black;
      }
    </style></head><body>
      <div class="stripes"></div>
      <div class="card" id="c"></div>
    </body></html>
  `);
  await page.waitForTimeout(400);

  const computed = await page.evaluate(() => {
    const s = getComputedStyle(document.getElementById('c'));
    return {
      'backdrop-filter': s.getPropertyValue('backdrop-filter'),
      '-webkit-backdrop-filter': s.getPropertyValue('-webkit-backdrop-filter'),
    };
  });

  const buf = await page.screenshot({ clip: { x: 70, y: 70, width: 20, height: 20 } });
  const sharp = require('sharp');
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const idx = (Math.floor(info.height/2) * info.width + Math.floor(info.width/2)) * info.channels;
  const px = [data[idx], data[idx+1], data[idx+2]];
  // pure red (255,0,0) or pure green (0,255,0) = NO blur; blend toward (128,128,0) = blur rendering
  const blended = (Math.abs(px[0]-px[1]) < 80);  // if R≈G, the stripes are blurred together
  console.log('=== TEST A: only -webkit-backdrop-filter (matches production) ===');
  console.log('computed:', JSON.stringify(computed));
  console.log('center pixel RGB:', px);
  console.log('blur rendering?', blended);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
