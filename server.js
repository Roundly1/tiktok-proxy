const { execSync } = require("child_process");
try {
  execSync("npx playwright install chromium", { stdio: "inherit" });
} catch (e) {
  console.log("Playwright install:", e.message);
}

const express = require("express");
const { chromium } = require("playwright");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let browser = null;
let context = null;

async function getContext() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  if (!context) {
    context = await browser.newContext({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
    });
  }
  return context;
}

// TikTok For You page dan videolarni olish
app.get("/videos", async (req, res) => {
  try {
    const ctx = await getContext();
    const page = await ctx.newPage();

    const videos = [];

    // TikTok API intercepting
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("api/recommend/item_list") || url.includes("api/feed")) {
        try {
          const json = await response.json();
          const items = json.itemList || json.items || [];
          for (const item of items) {
            if (item.video && item.video.playAddr) {
              videos.push({
                id: item.id,
                desc: item.desc || "",
                author: item.author?.nickname || item.author?.uniqueId || "unknown",
                avatar: item.author?.avatarThumb || "",
                playUrl: item.video.playAddr,
                cover: item.video.cover || item.video.originCover || "",
                likes: item.stats?.diggCount || 0,
                comments: item.stats?.commentCount || 0,
              });
            }
          }
        } catch (e) {}
      }
    });

    await page.goto("https://www.tiktok.com/foryou", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    await page.waitForTimeout(3000);
    await page.close();

    if (videos.length === 0) {
      return res.json({ videos: [], message: "Video topilmadi, qayta urining" });
    }

    res.json({ videos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Video proxy — CORS muammosiz video oqimi
app.get("/proxy-video", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL kerak" });

    const ctx = await getContext();
    const page = await ctx.newPage();

    const response = await page.request.get(decodeURIComponent(url), {
      headers: {
        "Referer": "https://www.tiktok.com/",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
      },
    });

    const body = await response.body();
    const contentType = response.headers()["content-type"] || "video/mp4";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(body);
    await page.close();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Frontend
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
  <title>TikTok</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#000;color:#fff;font-family:sans-serif;overflow:hidden;height:100vh}
    #feed{height:100vh;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none}
    #feed::-webkit-scrollbar{display:none}
    .video-item{height:100vh;scroll-snap-align:start;position:relative;display:flex;align-items:center;justify-content:center;background:#000}
    video{width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0}
    .info{position:absolute;bottom:80px;left:12px;right:60px;z-index:10}
    .author{font-weight:700;font-size:15px;margin-bottom:6px}
    .desc{font-size:13px;color:#eee;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .actions{position:absolute;right:10px;bottom:80px;display:flex;flex-direction:column;gap:16px;align-items:center;z-index:10}
    .action-btn{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer}
    .action-btn span:first-child{font-size:26px}
    .action-btn span:last-child{font-size:11px;color:#eee}
    #loading{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:100}
    .spinner{width:40px;height:40px;border:3px solid #333;border-top:3px solid #fe2c55;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px}
    @keyframes spin{to{transform:rotate(360deg)}}
    #error-msg{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fe2c55;padding:16px 24px;border-radius:12px;text-align:center;z-index:100;display:none}
  </style>
</head>
<body>
<div id="loading">
  <div class="spinner"></div>
  <p>TikTok yuklanmoqda...</p>
</div>
<div id="error-msg"></div>
<div id="feed"></div>

<script>
  const feed = document.getElementById("feed");
  const loading = document.getElementById("loading");
  const errorMsg = document.getElementById("error-msg");

  async function loadVideos() {
    try {
      const r = await fetch("/videos");
      const data = await r.json();

      loading.style.display = "none";

      if (!data.videos || data.videos.length === 0) {
        showError("Video topilmadi. Qayta yuklang.");
        return;
      }

      data.videos.forEach(v => addVideo(v));
    } catch(e) {
      loading.style.display = "none";
      showError("Xato yuz berdi: " + e.message);
    }
  }

  function addVideo(v) {
    const div = document.createElement("div");
    div.className = "video-item";

    const videoUrl = "/proxy-video?url=" + encodeURIComponent(v.playUrl);

    div.innerHTML = \`
      <video src="\${videoUrl}" loop playsinline preload="none" poster="\${v.cover}"></video>
      <div class="info">
        <div class="author">@\${v.author}</div>
        <div class="desc">\${v.desc}</div>
      </div>
      <div class="actions">
        <div class="action-btn"><span>❤️</span><span>\${fmt(v.likes)}</span></div>
        <div class="action-btn"><span>💬</span><span>\${fmt(v.comments)}</span></div>
        <div class="action-btn"><span>↗️</span><span>Share</span></div>
      </div>
    \`;

    feed.appendChild(div);
  }

  function fmt(n) {
    if (n >= 1000000) return (n/1000000).toFixed(1) + "M";
    if (n >= 1000) return (n/1000).toFixed(1) + "K";
    return n || 0;
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = "block";
    setTimeout(() => errorMsg.style.display = "none", 4000);
  }

  // Auto play visible video
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      const video = e.target.querySelector("video");
      if (!video) return;
      if (e.isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, { threshold: 0.7 });

  const mo = new MutationObserver(() => {
    document.querySelectorAll(".video-item").forEach(el => observer.observe(el));
  });
  mo.observe(feed, { childList: true });

  loadVideos();
</script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
