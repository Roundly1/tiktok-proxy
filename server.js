const { spawn } = require("child_process");
const express = require("express");
const http = require("http");
const net = require("net");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const W = 1080, H = 1920; // To'liq telefon o'lchami

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function setup() {
  // Xvfb
  spawn("Xvfb", [":99", "-screen", "0", `${W}x${H}x24`], { stdio: "ignore", detached: true }).unref();
  console.log("Xvfb started");
  await sleep(1500);

  // x11vnc
  spawn("x11vnc", [
    "-display", ":99",
    "-nopw", "-listen", "127.0.0.1",
    "-forever", "-shared",
    "-noxdamage", "-noscr", "-nowf",
    "-wait", "1", "-defer", "1",
    "-speeds", "lan",
  ], { stdio: "ignore", detached: true }).unref();
  console.log("x11vnc started");
  await sleep(1000);

  // Chromium — mobil user agent bilan
  spawn("chromium", [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-default-apps",
    "--autoplay-policy=no-user-gesture-required",
    `--window-size=${W},${H}`,
    "--window-position=0,0",
    "--start-maximized",
    "--kiosk",
    "--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
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
    html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}
    #vnc-wrap{width:100%;height:100%;position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
    #vnc-wrap canvas{width:100% !important;height:100% !important;object-fit:contain}
    #status{position:fixed;inset:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;gap:12px;z-index:99}
    .spinner{width:48px;height:48px;border:4px solid #222;border-top:4px solid #fe2c55;border-radius:50%;animation:spin 0.7s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div id="status"><div class="spinner"></div><span>Ulanmoqda...</span></div>
  <div id="vnc-wrap"></div>
  <script type="module">
    import RFB from '/static/core/rfb.js';

    const wrap = document.getElementById("vnc-wrap");
    const status = document.getElementById("status");
    let rfb;

    function connect() {
      const url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/vnc";
      rfb = new RFB(wrap, url);
      rfb.scaleViewport = true;
      rfb.clipViewport = false;
      rfb.resizeSession = false;
      rfb.qualityLevel = 9;
      rfb.compressionLevel = 0;
      rfb.addEventListener("connect", () => {
        status.style.display = "none";
      });
      rfb.addEventListener("disconnect", () => {
        status.style.display = "flex";
        setTimeout(connect, 1500);
      });
    }

    connect();
  </script>
</body>
</html>`);
});

const server = http.createServer(app);

// WebSocket → TCP (VNC)
const wss = new WebSocketServer({ noServer: true });
wss.on("connection", (ws) => {
  const tcp = net.createConnection({ host: "127.0.0.1", port: 5900 });
  tcp.on("data", buf => { if (ws.readyState === 1) ws.send(buf); });
  tcp.on("close", () => ws.terminate());
  tcp.on("error", () => ws.terminate());
  ws.on("message", msg => tcp.write(msg));
  ws.on("close", () => tcp.destroy());
  ws.on("error", () => tcp.destroy());
});

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/vnc") {
    wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws));
  } else socket.destroy();
});

server.listen(PORT, () => console.log("Server running on port " + PORT));
