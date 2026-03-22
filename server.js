const { execSync } = require("child_process");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");
const http = require("http");

function setup() {
  console.log("Setting up...");

  try {
    execSync("apt-get update -qq && apt-get install -y -qq xvfb x11vnc novnc websockify chromium", { stdio: "inherit" });
  } catch (e) {
    console.log("apt error:", e.message);
  }

  try {
    execSync("pkill Xvfb; pkill x11vnc; pkill websockify", { shell: true, stdio: "ignore" });
  } catch(e) {}

  try {
    execSync("Xvfb :99 -screen 0 1280x800x24 &", { shell: true, stdio: "inherit" });
    console.log("Xvfb started");
  } catch (e) {}

  setTimeout(() => {
    try {
      execSync("x11vnc -display :99 -nopw -listen localhost -forever -shared -noxdamage &", { shell: true, stdio: "inherit" });
      console.log("x11vnc started");
    } catch (e) {}

    try {
      execSync("websockify --web /usr/share/novnc 6080 localhost:5900 &", { shell: true, stdio: "inherit" });
      console.log("websockify started");
    } catch (e) {}

    setTimeout(() => {
      try {
        execSync("DISPLAY=:99 chromium --no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu --window-size=1280,800 --start-maximized https://www.tiktok.com &", { shell: true, stdio: "inherit" });
        console.log("Chromium started");
      } catch (e) {
        console.log("Chromium error:", e.message);
      }
    }, 3000);
  }, 2000);
}

setup();

const app = express();
app.use(cors());

// noVNC static fayllar
app.use("/vnc", express.static("/usr/share/novnc"));

// WebSocket proxy
const wsProxy = createProxyMiddleware({
  target: "http://localhost:6080",
  changeOrigin: true,
  ws: true,
});
app.use("/websockify", wsProxy);

// Asosiy sahifa
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>TikTok</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#000;height:100vh;overflow:hidden;font-family:sans-serif;color:#fff}
    #loading{position:fixed;inset:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;z-index:10}
    .spinner{width:52px;height:52px;border:4px solid #333;border-top:4px solid #fe2c55;border-radius:50%;animation:spin 0.8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    #start-btn{background:#fe2c55;color:#fff;border:none;padding:14px 32px;border-radius:10px;font-size:17px;cursor:pointer;margin-top:8px}
    #start-btn:hover{background:#d4002f}
    #vnc-container{width:100vw;height:100vh;display:none}
    iframe{width:100%;height:100%;border:none}
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <p>TikTok tayyorlanmoqda...</p>
    <button id="start-btn" onclick="startVNC()">▶️ TikTok ni ochish</button>
  </div>
  <div id="vnc-container">
    <iframe id="vnc-frame" src="" allowfullscreen></iframe>
  </div>

  <script>
    function startVNC() {
      document.getElementById("loading").style.display = "none";
      document.getElementById("vnc-container").style.display = "block";
      // noVNC ni to'g'ridan-to'g'ri port bilan ochish
      const host = window.location.hostname;
      const port = window.location.port || "443";
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const url = "/vnc/vnc.html?path=websockify&autoconnect=1&resize=scale&reconnect=1&reconnect_delay=2000";
      document.getElementById("vnc-frame").src = url;
    }

    // 12 soniyadan keyin avtomatik ochish
    setTimeout(startVNC, 12000);
  </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// WebSocket upgrade
server.on("upgrade", wsProxy.upgrade);

server.listen(PORT, () => console.log("Server running on port " + PORT));
