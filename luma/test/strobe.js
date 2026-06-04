/* Strobe-safety probe: drive the visualizer with a worst-case flashing signal
 * (audio levels + beat slammed on/off every single frame) and measure how much
 * the on-screen luminance actually changes frame to frame. Big frame-to-frame
 * swings = strobing. We want them small. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const ROOT = path.resolve(__dirname, "..");
const PORT = 8166;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".webmanifest": "application/json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(PORT);

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 360, height: 720, deviceScaleFactor: 1 });
    await page.goto(`http://localhost:${PORT}/index.html?preserve`, { waitUntil: "load" });
    await new Promise((r) => setTimeout(r, 1200));

    // Force a worst-case strobe input: every frame, alternate full/zero levels
    // and fire a beat. If the pipeline were unsafe, the frame would flash.
    const stats = await page.evaluate(async () => {
      const app = window.VZ.app, A = app.audio, r = app.renderer, gl = r.gl;
      r._adapt = () => {}; // disable software-renderer resize (would black a frame)
      let f = 0;
      A.update = function () {
        f++;
        const hi = f % 2 === 0 ? 1 : 0;
        this.levels.bass = hi; this.levels.lowMid = hi; this.levels.mid = hi;
        this.levels.highMid = hi; this.levels.treble = hi; this.levels.energy = hi;
        this.beat = hi; this.beatHit = true; this.beatStrength = 1; this.flux = hi;
        this.hasSignal = true;
        for (let i = 0; i < this.specData.length; i++) this.specData[i] = hi ? 255 : 0;
      };
      const sample = () => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        const W = r.dispW, H = r.dispH, N = 10;
        let sum = 0;
        const px = new Uint8Array(4);
        for (let yi = 0; yi < N; yi++) for (let xi = 0; xi < N; xi++) {
          const x = Math.floor((xi + 0.5) / N * (W - 1));
          const y = Math.floor((yi + 0.5) / N * (H - 1));
          gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          sum += (px[0] + px[1] + px[2]) / 3;
        }
        return sum / (N * N);
      };
      const lumas = [];
      const modes = [];
      for (let i = 0; i < 140; i++) {
        await new Promise((res) => requestAnimationFrame(() => res()));
        lumas.push(sample());
        modes.push(app.director.modeName);
      }
      // ignore the first few warm-up frames
      const warm = 10;
      let maxD = 0, sumD = 0, mean = 0, maxAt = -1;
      const deltas = [];
      for (let i = warm + 1; i < lumas.length; i++) {
        const dd = Math.abs(lumas[i] - lumas[i - 1]);
        deltas.push(dd); sumD += dd; if (dd > maxD) { maxD = dd; maxAt = i; }
      }
      for (let i = warm; i < lumas.length; i++) mean += lumas[i];
      mean /= (lumas.length - warm);
      deltas.sort((a, b) => a - b);
      const around = lumas.slice(Math.max(0, maxAt - 2), maxAt + 2).map((x) => +x.toFixed(1));
      return { mean, maxDelta: maxD, maxAt, around,
        modeChangedAtMax: maxAt > 0 ? modes[maxAt] !== modes[maxAt - 1] : false,
        meanDelta: sumD / deltas.length,
        p95Delta: deltas[Math.floor(deltas.length * 0.95)], frames: lumas.length };
    });

    console.log("STROBE PROBE (0..255 luma):", JSON.stringify(stats, null, 2));
    // Heuristic thresholds: a calm scene shouldn't swing the whole frame hard
    // every frame. Flag if typical or peak per-frame swing is large.
    const verdict = [];
    if (stats.p95Delta > 18) verdict.push(`p95 frame swing high (${stats.p95Delta.toFixed(1)})`);
    if (stats.maxDelta > 40) verdict.push(`peak frame swing high (${stats.maxDelta.toFixed(1)})`);
    if (verdict.length) console.log("⚠️  POSSIBLE STROBE:\n - " + verdict.join("\n - "));
    else console.log(`✅ CALM — typical frame swing ${stats.meanDelta.toFixed(1)}, p95 ${stats.p95Delta.toFixed(1)}, peak ${stats.maxDelta.toFixed(1)} (/255)`);
    process.exitCode = verdict.length ? 1 : 0;
  } catch (e) {
    console.error("PROBE ERROR", e); process.exitCode = 2;
  } finally {
    await browser.close(); server.close();
  }
})();
