const { execSync, spawn } = require("child_process");
const express = require("express");
const http = require("http");
const net = require("net");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;

// Xvfb, x11vnc, Chromium ishga tushirish
function setup() {
  try { execSync("pkill Xvfb; pkill x11vnc; pkill chromium", { shell: true, stdio: "ignore" }); } catch(e) {}

  // Xvfb
  spawn("Xvfb", [":99", "-screen", "0", "1280x800x24", "+extension", "GLX"], { stdio: "ignore", detached: true }).unref();
  console.log("Xvfb started");

  setTimeout(() => {
    // x11vnc — localhost:5900
    spawn("x11vnc", [
      "-display", ":99",
      "-nopw", "-listen", "localhost",
      "-forever", "-shared",
      "-noxdamage", "-noscr", "-nowf",
      "-threads"
    ], { stdio: "ignore", detached: true }).unref();
    console.log("x11vnc started");

    // Chromium
    setTimeout(() => {
      spawn("chromium", [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-default-apps",
        "--autoplay-policy=no-user-gesture-required",
        "--window-size=1280,800",
        "--window-position=0,0",
        "https://www.tiktok.com"
      ], {
        env: { ...process.env, DISPLAY: ":99" },
        stdio: "ignore",
        detached: true
      }).unref();
      console.log("Chromium started");
    }, 2000);
  }, 1500);
}

setup();

const app = express();
app.use("/static", express.static("/usr/share/novnc"));

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>TikTok</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#000;height:100vh;overflow:hidden}
    #vnc-wrap{width:100vw;height:100vh;position:fixed;inset:0}
    #status{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-family:sans-serif;font-size:16px;text-align:center;z-index:10;pointer-events:none}
    .spinner{width:48px;height:48px;border:4px solid #333;border-top:4px solid #fe2c55;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div id="status"><div class="spinner"></div>Ulanmoqda...</div>
  <div id="vnc-wrap"></div>
  <script type="module">
    import RFB from '/static/core/rfb.js';

    const wrap = document.getElementById("vnc-wrap");
    const status = document.getElementById("status");

    function connect() {
      const wsUrl = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/vnc";
      const rfb = new RFB(wrap, wsUrl, { scaleViewport: true, resizeSession: true });
      rfb.scaleViewport = true;
      rfb.resizeSession = true;
      rfb.addEventListener("connect", () => { status.style.display = "none"; });
      rfb.addEventListener("disconnect", () => {
        status.style.display = "block";
        status.innerHTML = '<div class="spinner"></div>Qayta ulanmoqda...';
        setTimeout(connect, 2000);
      });
    }

    connect();
  </script>
</body>
</html>`);
});

const server = http.createServer(app);

// WebSocket → TCP tunnel to x11vnc:5900
const wss = new WebSocketServer({ noServer: true });
wss.on("connection", (ws) => {
  const tcp = net.createConnection({ host: "127.0.0.1", port: 5900 });

  tcp.on("connect", () => console.log("VNC connected"));
  tcp.on("data", (buf) => { if (ws.readyState === 1) ws.send(buf); });
  tcp.on("close", () => ws.terminate());
  tcp.on("error", (e) => { console.log("tcp err:", e.message); ws.terminate(); });

  ws.on("message", (msg) => tcp.write(msg));
  ws.on("close", () => tcp.destroy());
  ws.on("error", () => tcp.destroy());
});

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/vnc") {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => console.log("Server running on port " + PORT));
