const express = require("express");
const { chromium } = require("playwright");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let browser = null;
let page = null;

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ],
    });
  }
  return browser;
}

async function getPage() {
  if (!page) {
    const b = await getBrowser();
    const context = await b.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    page = await context.newPage();
  }
  return page;
}

// Asosiy sahifa - frontend
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>TikTok Viewer</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#000;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;height:100vh;overflow:hidden}
    #toolbar{background:#111;padding:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    button{background:#fe2c55;color:#fff;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px}
    button:hover{background:#d4002f}
    button:disabled{background:#555;cursor:not-allowed}
    #url-bar{flex:1;min-width:120px;background:#222;border:1px solid #444;color:#fff;padding:6px 10px;border-radius:6px;font-size:12px}
    #screen-wrap{flex:1;position:relative;overflow:hidden;cursor:crosshair;background:#111}
    #screen{width:100%;height:100%;object-fit:contain;display:block}
    #loading{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:16px;color:#888;text-align:center}
    #type-bar{background:#111;padding:6px;display:flex;gap:6px}
    #type-input{flex:1;background:#222;border:1px solid #444;color:#fff;padding:6px 10px;border-radius:6px;font-size:13px}
    #status{font-size:11px;color:#888;padding:2px 8px;background:#111;text-align:center}
  </style>
</head>
<body>
<div id="toolbar">
  <button onclick="openTiktok()" id="btn-open">🎵 TikTok</button>
  <button onclick="refresh()">🔄</button>
  <button onclick="scrollUp()">⬆️</button>
  <button onclick="scrollDown()">⬇️</button>
  <button onclick="goBack()">◀️</button>
  <input id="url-bar" readonly placeholder="URL..."/>
</div>
<div id="screen-wrap">
  <img id="screen" src="" alt=""/>
  <div id="loading">▶️ TikTok tugmasini bosing</div>
</div>
<div id="type-bar">
  <input id="type-input" placeholder="Matn yozing (Enter = yuborish)..."/>
  <button onclick="sendText()">⌨️</button>
</div>
<div id="status">Tayyor</div>

<script>
  const img = document.getElementById("screen");
  const loading = document.getElementById("loading");
  const urlBar = document.getElementById("url-bar");
  const status = document.getElementById("status");

  function setStatus(msg){ status.textContent = msg; }

  async function takeScreenshot(){
    img.src = "/screenshot?" + Date.now();
    return new Promise(res => { img.onload = res; img.onerror = res; });
  }

  async function updateUrl(){
    try{
      const r = await fetch("/url");
      const d = await r.json();
      urlBar.value = d.url;
    }catch(e){}
  }

  async function openTiktok(){
    loading.style.display = "block";
    loading.textContent = "TikTok ochilmoqda...";
    setStatus("Yuklanmoqda...");
    await fetch("/open-tiktok");
    await takeScreenshot();
    await updateUrl();
    loading.style.display = "none";
    setStatus("Tayyor");
  }

  async function refresh(){
    setStatus("Yangilanmoqda...");
    await takeScreenshot();
    await updateUrl();
    setStatus("Tayyor");
  }

  async function scrollDown(){
    setStatus("Scroll...");
    const r = await fetch("/scroll", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({deltaY:700})});
    const blob = await r.blob();
    img.src = URL.createObjectURL(blob);
    setStatus("Tayyor");
  }

  async function scrollUp(){
    setStatus("Scroll...");
    const r = await fetch("/scroll", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({deltaY:-700})});
    const blob = await r.blob();
    img.src = URL.createObjectURL(blob);
    setStatus("Tayyor");
  }

  async function goBack(){
    setStatus("Orqaga...");
    await fetch("/back");
    await takeScreenshot();
    await updateUrl();
    setStatus("Tayyor");
  }

  document.getElementById("screen-wrap").addEventListener("click", async (e)=>{
    const wrap = e.currentTarget;
    const rect = wrap.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 800 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setStatus("Klik: " + Math.round(x) + ", " + Math.round(y));
    const r = await fetch("/click", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({x,y})});
    const blob = await r.blob();
    img.src = URL.createObjectURL(blob);
    await updateUrl();
    setStatus("Tayyor");
  });

  async function sendText(){
    const input = document.getElementById("type-input");
    const text = input.value.trim();
    if(!text) return;
    input.value = "";
    setStatus("Yozilmoqda...");
    await fetch("/type", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})});
    await takeScreenshot();
    setStatus("Tayyor");
  }

  document.getElementById("type-input").addEventListener("keydown", e=>{
    if(e.key === "Enter") sendText();
  });
</script>
</body>
</html>`);
});

// Screenshot
app.get("/screenshot", async (req, res) => {
  try {
    const p = await getPage();
    const screenshot = await p.screenshot({ type: "jpeg", quality: 80 });
    res.setHeader("Content-Type", "image/jpeg");
    res.send(screenshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TikTok ochish
app.get("/open-tiktok", async (req, res) => {
  try {
    const p = await getPage();
    await p.goto("https://www.tiktok.com", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Click
app.post("/click", async (req, res) => {
  try {
    const { x, y } = req.body;
    const p = await getPage();
    await p.mouse.click(x, y);
    await p.waitForTimeout(1500);
    const screenshot = await p.screenshot({ type: "jpeg", quality: 80 });
    res.setHeader("Content-Type", "image/jpeg");
    res.send(screenshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Type
app.post("/type", async (req, res) => {
  try {
    const { text } = req.body;
    const p = await getPage();
    await p.keyboard.type(text);
    await p.waitForTimeout(500);
    const screenshot = await p.screenshot({ type: "jpeg", quality: 80 });
    res.setHeader("Content-Type", "image/jpeg");
    res.send(screenshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Scroll
app.post("/scroll", async (req, res) => {
  try {
    const { deltaY } = req.body;
    const p = await getPage();
    await p.mouse.wheel(0, deltaY);
    await p.waitForTimeout(800);
    const screenshot = await p.screenshot({ type: "jpeg", quality: 80 });
    res.setHeader("Content-Type", "image/jpeg");
    res.send(screenshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Orqaga
app.get("/back", async (req, res) => {
  try {
    const p = await getPage();
    await p.goBack();
    await p.waitForTimeout(1000);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// URL
app.get("/url", async (req, res) => {
  try {
    const p = await getPage();
    res.json({ url: p.url() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
