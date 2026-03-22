const { execSync, spawn } = require("child_process");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");

// System dependencies va Xvfb, noVNC o'rnatish
function setup() {
  console.log("Setting up...");
  try {
    execSync("apt-get update -qq && apt-get install -y -qq xvfb x11vnc novnc websockify chromium chromium-driver net-tools", { stdio: "inherit" });
  } catch (e) {
    console.log("apt error:", e.message);
  }

  try {
    execSync("Xvfb :99 -screen 0 1280x800x24 &", { stdio: "inherit", shell: true });
    console.log("Xvfb started");
  } catch (e) {}

  try {
    execSync("x11vnc -display :99 -nopw -listen localhost -xkb -forever &", { stdio: "inherit", shell: true });
    console.log("x11vnc started");
  } catch (e) {}

  try {
    execSync("websockify --web /usr/share/novnc 6080 localhost:5900 &", { stdio: "inherit", shell: true });
    console.log("noVNC started on 6080");
  } catch (e) {}

  // Chrome ni TikTok bilan ochish
  setTimeout(() => {
    try {
      execSync(`DISPLAY=:99 chromium --no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --kiosk https://www.tiktok.com &`, { stdio: "inherit", shell: true });
      console.log("Chrome opened TikTok");
    } catch (e) {
      console.log("Chrome error:", e.message);
    }
  }, 3000);
}

setup();

const app = express();
app.use(cors());

// noVNC ni proxy qilish
app.use("/novnc", createProxyMiddleware({
  target: "http://localhost:6080",
  changeOrigin: true,
  ws: true,
  pathRewrite: { "^/novnc": "" },
}));

// Asosiy sahifa
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>TikTok Live</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;color:#fff;font-family:sans-serif}
    iframe{width:100vw;height:100vh;border:none}
    #loading{position:fixed;inset:0;background:#000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;z-index:10}
    .spinner{width:48px;height:48px;border:3px solid #333;border-top:3px solid #fe2c55;border-radius:50%;animation:spin 0.8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    button{background:#fe2c55;color:#fff;border:none;padding:12px 28px;border-radius:8px;font-size:16px;cursor:pointer;margin-top:8px}
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <p>TikTok yuklanmoqda...</p>
    <button onclick="openVNC()">▶️ Ochish</button>
  </div>
  <iframe id="vnc-frame" src="" allowfullscreen></iframe>

  <script>
    function openVNC() {
      document.getElementById("loading").style.display = "none";
      document.getElementById("vnc-frame").src = "/novnc/vnc.html?autoconnect=1&resize=scale&show_dot=1";
    }
    setTimeout(openVNC, 5000);
  </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
