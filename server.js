const { spawn } = require("child_process");
const express = require("express");
const http = require("http");
const net = require("net");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const W = 1080, H = 1920;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function setup() {
  spawn("Xvfb", [":99", "-screen", "0", `${W}x${H}x24`, "-ac", "+extension", "RANDR"], {
    stdio: "ignore", detached: true
  }).unref();
  console.log("Xvfb started");
  await sleep(2000);

  spawn("x11vnc", [
    "-display", ":99",
    "-nopw",
    "-listen", "127.0.0.1",
    "-forever",
    "-shared",
    "-raw",
    "-wait", "1",
    "-defer", "1",
    "-noxdamage",
    "-noscr",
    "-nowf",
    "-nowirecopyrect",
    "-threads",
    "-fp", "built-ins",
  ], { stdio: "ignore", detached: true }).unref();
  console.log("x11vnc started");
  await sleep(1500);

  spawn("chromium", [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-background-networking",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-default-apps",
    "--disable-sync",
    "--disable-translate",
    "--autoplay-policy=no-user-gesture-required",
    "--enable-features=NetworkService",
    `--window-size=${W},${H}`,
    "--window-position=0,0",
    "--kiosk",
    "--user-agent=Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "https://www.tiktok.com"
  ], {
    env: { ...process.env, DISPLAY: ":99" },
    stdio: "ignore", detached: true
  }).unref();
  console.log("Chromium started");
}

setup();

const app = express();
app.use("/static", express.static("/usr/share/novnc"));

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"/>
  <title>TikTok</title>
  <style>
    html,body{margin:0;padding:0;width:100vw;height:100vh;background:#000;overflow:hidden;touch-action:none}
    #vnc{width:100vw;height:100vh;position:fixed;inset:0}
    #vnc canvas{width:100vw !important;height:100vh !important;display:block}
    #overlay{position:fixed;inset:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;gap:14px;z-index:999;transition:opacity 0.3s}
    .sp{width:50px;height:50px;border:4px solid #222;border-top:4px solid #fe2c55;border-radius:50%;animation:sp 0.6s linear infinite}
    @keyframes sp{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div id="overlay"><div class="sp"></div><span>Ulanmoqda...</span></div>
  <div id="vnc"></div>
  <script type="module">
    import RFB from '/static/core/rfb.js';

    const wrap = document.getElementById("vnc");
    const overlay = document.getElementById("overlay");

    function connect() {
      const url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/vnc";
      
      const rfb = new RFB(wrap, url);
      rfb.scaleViewport = true;
      rfb.clipViewport = false;
      rfb.resizeSession = false;
      rfb.qualityLevel = 9;
      rfb.compressionLevel = 0;
      rfb.viewOnly = false;
      rfb.showDotCursor = false;
      rfb.background = "#000";

      rfb.addEventListener("connect", () => {
        overlay.style.opacity = "0";
        setTimeout(() => overlay.style.display = "none", 300);
        console.log("Connected!");
      });

      rfb.addEventListener("disconnect", (e) => {
        overlay.style.display = "flex";
        overlay.style.opacity = "1";
        overlay.innerHTML = '<div class="sp"></div><span>Qayta ulanmoqda...</span>';
        setTimeout(connect, 1000);
      });
    }

    connect();
  </script>
</body>
</html>`);
});

const server = http.createServer(app);

// Binary WebSocket → TCP bridge (eng tez usul)
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

wss.on("connection", (ws) => {
  const tcp = net.createConnection({ host: "127.0.0.1", port: 5900 });
  
  tcp.setNoDelay(true);
  tcp.setKeepAlive(true, 1000);

  tcp.on("connect", () => console.log("VNC TCP connected"));
  tcp.on("data", (buf) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(buf, { binary: true });
    }
  });
  tcp.on("close", () => ws.terminate());
  tcp.on("error", (e) => { console.log("tcp:", e.message); ws.terminate(); });

  ws.on("message", (msg) => {
    if (tcp.writable) tcp.write(msg);
  });
  ws.on("close", () => tcp.destroy());
  ws.on("error", () => tcp.destroy());
});

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/vnc") {
    socket.setNoDelay(true);
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => console.log("Server running on port " + PORT));
