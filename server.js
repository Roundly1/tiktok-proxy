const { execSync } = require("child_process");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const http = require("http");

const PORT = process.env.PORT || 3000;

function setup() {
  // Eski processlarni o'chirish
  try { execSync("pkill Xvfb; pkill x11vnc; pkill websockify; pkill chromium", { shell: true, stdio: "ignore" }); } catch(e) {}

  // Xvfb
  try {
    execSync("Xvfb :99 -screen 0 1280x800x24 +extension GLX &", { shell: true, stdio: "ignore" });
    console.log("Xvfb started");
  } catch(e) {}

  setTimeout(() => {
    // x11vnc
    try {
      execSync("x11vnc -display :99 -nopw -listen localhost -forever -shared -noxdamage -noscr -nowf &", { shell: true, stdio: "ignore" });
      console.log("x11vnc started");
    } catch(e) {}

    // websockify
    try {
      execSync("websockify 6080 127.0.0.1:5900 &", { shell: true, stdio: "ignore" });
      console.log("websockify started");
    } catch(e) {}

    // Chromium — ovoz bilan, qotishsiz
    setTimeout(() => {
      try {
        execSync(`DISPLAY=:99 chromium \
          --no-sandbox \
          --disable-setuid-sandbox \
          --disable-dev-shm-usage \
          --disable-gpu \
          --disable-software-rasterizer \
          --no-first-run \
          --no-default-browser-check \
          --disable-default-apps \
          --disable-popup-blocking \
          --disable-translate \
          --disable-background-timer-throttling \
          --disable-renderer-backgrounding \
          --disable-backgrounding-occluded-windows \
          --autoplay-policy=no-user-gesture-required \
          --window-size=1280,800 \
          --window-position=0,0 \
          https://www.tiktok.com &`, { shell: true, stdio: "ignore" });
        console.log("Chromium started");
      } catch(e) { console.log("Chromium error:", e.message); }
    }, 3000);
  }, 2000);
}

setup();

const app = express();

// noVNC static files
app.use("/static", express.static("/usr/share/novnc"));

const proxy = createProxyMiddleware({
  target: "http://127.0.0.1:6080",
  changeOrigin: true,
  ws: true,
  pathRewrite: { "^/proxy": "" },
  on: { error: (err) => console.log("proxy err:", err.message) }
});
app.use("/proxy", proxy);

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>TikTok</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#111;height:100vh;overflow:hidden;font-family:sans-serif;color:#fff;display:flex;align-items:center;justify-content:center}
    #loading{display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;padding:20px}
    .spinner{width:52px;height:52px;border:4px solid #333;border-top:4px solid #fe2c55;border-radius:50%;animation:spin 0.8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    #start-btn{background:#fe2c55;color:#fff;border:none;padding:14px 36px;border-radius:10px;font-size:18px;cursor:pointer}
    #start-btn:hover{background:#d4002f}
    #vnc-wrap{display:none;width:100vw;height:100vh;position:fixed;inset:0}
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <p>TikTok yuklanmoqda...</p>
    <p style="color:#888;font-size:13px">~10 soniya kuting</p>
    <button id="start-btn" onclick="startVNC()">▶️ Ochish</button>
  </div>
  <div id="vnc-wrap"></div>

  <script type="module">
    import RFB from '/static/core/rfb.js';

    window.startVNC = function() {
      document.getElementById("loading").style.display = "none";
      const wrap = document.getElementById("vnc-wrap");
      wrap.style.display = "block";

      const wsUrl = (location.protocol === "https:" ? "wss://" : "ws://")
        + location.host + "/proxy/websockify";

      const rfb = new RFB(wrap, wsUrl, { scaleViewport: true, resizeSession: true });
      rfb.scaleViewport = true;
      rfb.resizeSession = true;

      rfb.addEventListener("disconnect", () => {
        setTimeout(window.startVNC, 3000);
      });
    }

    setTimeout(window.startVNC, 10000);
  </script>
</body>
</html>`);
});

const server = http.createServer(app);
server.on("upgrade", proxy.upgrade);
server.listen(PORT, () => console.log("Server running on port " + PORT));
