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

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return browser;
}

// TikTok scraping — video URLlarini olish
app.get("/videos", async (req, res) => {
  const b = await getBrowser();
  const context = await b.newContext({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  const videoData = [];

  // Network requestlarni kuzatish
  page.on("response", async (response) => {
    const url = response.url();
    if (
      url.includes("item_list") ||
      url.includes("aweme/v1") ||
      url.includes("feed?") ||
      url.includes("recommend")
    ) {
      try {
        const text = await response.text();
        const json = JSON.parse(text);
        const items = json.aweme_list || json.itemList || json.items || [];
        for (const item of items) {
          try {
            const vid = item.video;
            if (!vid) continue;
            const playUrl =
              vid.play_addr?.url_list?.[0] ||
              vid.download_addr?.url_list?.[0] ||
              vid.playAddr ||
              null;
            if (!playUrl) continue;
            videoData.push({
              id: item.aweme_id || item.id || Math.random(),
              desc: item.desc || item.description || "",
              author: item.author?.nickname || item.author?.unique_id || "user",
              cover: vid.cover?.url_list?.[0] || vid.cover || "",
              playUrl,
              likes: item.statistics?.digg_count || item.stats?.diggCount || 0,
              comments: item.statistics?.comment_count || item.stats?.commentCount || 0,
            });
          } catch (e) {}
        }
      } catch (e) {}
    }
  });

  try {
    await page.goto("https://www.tiktok.com/", {
      waitUntil: "networkidle",
      timeout: 40000,
    });
    await page.waitForTimeout(5000);

    // Scroll qilish — ko'proq video yuklash uchun
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log("Goto error:", e.message);
  }

  await page.close();
  await context.close();

  console.log("Topilgan videolar:", videoData.length);
  res.json({ videos: videoData });
});

// Video proxy
app.get("/proxy-video", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL kerak" });

    const b = await getBrowser();
    const context = await b.newContext();
    const page = await context.newPage();

    const response = await page.request.get(decodeURIComponent(url), {
      headers: {
        Referer: "https://www.tiktok.com/",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
      },
    });

    const body = await response.body();
    const ct = response.headers()["content-type"] || "video/mp4";
    res.setHeader("Content-Type", ct);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(body);

    await page.close();
    await context.close();
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
    .info{position:absolute;bottom:80px;left:12px;right:60px;z-index:10;text-shadow:0 1px 3px rgba(0,0,0,0.8)}
    .author{font-weight:700;font-size:15px;margin-bottom:6px}
    .desc{font-size:13px;color:#eee;line-height:1.4}
    .actions{position:absolute;right:10px;bottom:80px;display:flex;flex-direction:column;gap:16px;align-items:center;z-index:10}
    .action-btn{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer}
    .action-btn span:first-child{font-size:28px}
    .action-btn span:last-child{font-size:11px}
    #loading{position:fixed;inset:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:100}
    .spinner{width:48px;height:48px;border:3px solid #333;border-top:3px solid #fe2c55;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:16px}
    @keyframes spin{to{transform:rotate(360deg)}}
    #retry-btn{margin-top:16px;background:#fe2c55;border:none;color:#fff;padding:10px 24px;border-radius:8px;font-size:15px;cursor:pointer;display:none}
  </style>
</head>
<body>
<div id="loading">
  <div class="spinner"></div>
  <p id="load-text">TikTok yuklanmoqda... (20-30 sek)</p>
  <button id="retry-btn" onclick="loadVideos()">🔄 Qayta urish</button>
</div>
<div id="feed"></div>

<script>
  const feed = document.getElementById("feed");
  const loading = document.getElementById("loading");
  const loadText = document.getElementById("load-text");
  const retryBtn = document.getElementById("retry-btn");

  async function loadVideos() {
    loading.style.display = "flex";
    retryBtn.style.display = "none";
    loadText.textContent = "TikTok yuklanmoqda... (20-30 sek)";
    feed.innerHTML = "";

    try {
      const r = await fetch("/videos");
      const data = await r.json();
      loading.style.display = "none";

      if (!data.videos || data.videos.length === 0) {
        loadText.textContent = "Video topilmadi 😞";
        retryBtn.style.display = "block";
        loading.style.display = "flex";
        return;
      }

      data.videos.forEach(v => addVideo(v));
    } catch(e) {
      loadText.textContent = "Xato: " + e.message;
      retryBtn.style.display = "block";
      loading.style.display = "flex";
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
    if (!n) return "0";
    if (n >= 1000000) return (n/1000000).toFixed(1) + "M";
    if (n >= 1000) return (n/1000).toFixed(1) + "K";
    return String(n);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      const video = e.target.querySelector("video");
      if (!video) return;
      if (e.isIntersecting) video.play().catch(()=>{});
      else video.pause();
    });
  }, { threshold: 0.7 });

  new MutationObserver(() => {
    document.querySelectorAll(".video-item").forEach(el => observer.observe(el));
  }).observe(feed, { childList: true });

  loadVideos();
</script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
