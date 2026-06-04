/* Headless smoke test: serves the site, boots it in real Chrome (SwiftShader
 * WebGL2), clicks Begin, runs frames, then verifies shaders compiled, no fatal
 * errors occurred, and the canvas is actually rendering colour. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const ROOT = path.resolve(__dirname, "..");
const PORT = 8137;
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};

function serve() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/") p = "/index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end("nope"); return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  }).listen(PORT);
}

(async () => {
  const server = serve();
  const logs = [];
  const errors = [];
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox", "--disable-setuid-sandbox",
        "--enable-webgl", "--ignore-gpu-blocklist",
        "--use-gl=angle", "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--autoplay-policy=no-user-gesture-required",
        "--window-size=900,1600",
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 412, height: 892, deviceScaleFactor: 2 });
    page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
    page.on("requestfailed", (r) => errors.push("REQFAIL: " + r.url() + " " + (r.failure() && r.failure().errorText)));

    await page.goto(`http://localhost:${PORT}/index.html?preserve&debug`, { waitUntil: "load", timeout: 30000 });

    // WebGL2 availability
    const hasGL2 = await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2"));
    console.log("webgl2 available:", hasGL2);

    // the app auto-starts (no splash / no gesture); just let it run
    await new Promise((r) => setTimeout(r, 2500));

    const sampleLuma = async () => page.evaluate(() => {
      const r = window.VZ.app.renderer, gl = r.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const W = r.dispW, H = r.dispH, sx = 24, sy = 24;
      const px = new Uint8Array(sx * sy * 4);
      // sample a coarse grid across the whole frame
      let sum = 0, max = 0, white = 0, lit = 0;
      for (let gyi = 0; gyi < 8; gyi++) for (let gxi = 0; gxi < 8; gxi++) {
        const x = Math.floor((gxi + 0.5) / 8 * (W - 1));
        const y = Math.floor((gyi + 0.5) / 8 * (H - 1));
        const one = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one);
        const l = (one[0] + one[1] + one[2]) / 3;
        sum += l; if (l > max) max = l; if (l > 250) white++; if (l > 12) lit++;
      }
      return { avg: sum / 64, max, whiteFrac: white / 64, litFrac: lit / 64,
               mode: window.VZ.app.director.modeName };
    });

    const shots = [];
    shots.push({ tag: "demo", ...(await sampleLuma()) });
    await page.screenshot({ path: path.join(ROOT, "test", "shot1.png") });

    // simulate touch painting across the canvas
    await page.mouse.move(120, 300);
    await page.mouse.down();
    for (let i = 0; i <= 16; i++) {
      await page.mouse.move(120 + i * 16, 300 + Math.sin(i * 0.5) * 160);
      await new Promise((r) => setTimeout(r, 16));
    }
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 600));
    shots.push({ tag: "painted", ...(await sampleLuma()) });
    await page.screenshot({ path: path.join(ROOT, "test", "shot2.png") });

    // visit each named mood with its palette settled, to judge colour identity
    const moods = ["Inferno", "Aurora", "Bioluminescence", "Crystal", "Prism", "Nebula"];
    for (let i = 0; i < moods.length; i++) {
      await page.evaluate((m) => window.VZ.app.director.forceMode(m, true), moods[i]);
      await new Promise((r) => setTimeout(r, 2600));
      shots.push({ tag: moods[i], ...(await sampleLuma()) });
      await page.screenshot({ path: path.join(ROOT, "test", "mood_" + moods[i] + ".png") });
    }
    console.log("LUMA SAMPLES:", JSON.stringify(shots, null, 2));

    const result = await page.evaluate(() => {
      const app = window.VZ && window.VZ.app;
      const out = { ok: false };
      if (!app || !app.renderer) { out.reason = "no app/renderer"; return out; }
      const r = app.renderer, gl = r.gl;
      out.started = app.started;
      out.time = r.time;
      out.programs = r.prog ? Object.keys(r.prog) : [];
      out.particlesOn = !!(r.particles && r.particles._ok);
      out.errorShown = document.getElementById("error").style.display === "flex";
      out.errorMsg = document.querySelector("#error .error-msg").textContent;
      out.mode = app.director.modeName;
      out.dims = [r.dispW, r.dispH, r.simW, r.simH];
      out.bands = app.audio.levels;
      // read centre pixels from the default framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const n = 32;
      const px = new Uint8Array(n * n * 4);
      gl.readPixels((r.dispW - n) >> 1, (r.dispH - n) >> 1, n, n, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let sum = 0, max = 0;
      for (let i = 0; i < px.length; i += 4) {
        const l = px[i] + px[i + 1] + px[i + 2];
        sum += l; if (l > max) max = l;
      }
      out.avgLuma = sum / (n * n) / 3;
      out.maxLuma = max / 3;
      out.ok = true;
      return out;
    });

    console.log("RESULT:", JSON.stringify(result, null, 2));
    await page.screenshot({ path: path.join(ROOT, "test", "shot.png") });
    console.log("screenshot saved to test/shot.png");

    // verdict
    const fail = [];
    if (!hasGL2) fail.push("no WebGL2");
    if (!result.ok) fail.push("eval failed: " + result.reason);
    if (result.errorShown) fail.push("fatal overlay: " + result.errorMsg);
    if ((result.programs || []).length < 8) fail.push("missing programs: " + result.programs);
    if (!(result.time > 0)) fail.push("renderer not advancing");
    if (!(result.maxLuma > 4)) fail.push("canvas appears black (maxLuma=" + result.maxLuma + ")");
    const blown = shots.filter((s) => s.whiteFrac > 0.85);
    if (blown.length) fail.push("blown-out frames: " + blown.map((s) => s.tag + "(" + s.whiteFrac + ")").join(","));
    const dark = shots.filter((s) => s.litFrac < 0.12);
    if (dark.length) fail.push("too-dark frames: " + dark.map((s) => s.tag).join(","));
    const shaderErr = logs.filter((l) => /compile|link failed|ERROR:/i.test(l));
    if (shaderErr.length) fail.push("shader errors in console");

    if (errors.length) console.log("PAGE ERRORS:\n" + errors.join("\n"));
    if (shaderErr.length) console.log("SHADER LOG:\n" + shaderErr.join("\n"));

    if (fail.length) {
      console.log("\n❌ SMOKE TEST FAILED:\n - " + fail.join("\n - "));
      process.exitCode = 1;
    } else {
      console.log("\n✅ SMOKE TEST PASSED — shaders compiled, pipeline rendering, mode:", result.mode);
    }
  } catch (e) {
    console.error("HARNESS ERROR:", e);
    process.exitCode = 2;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})();
