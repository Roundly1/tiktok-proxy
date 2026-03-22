const express = require("express");
const { chromium } = require("playwright");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let browser = null;
let page = null;

// Browser ni ishga tushirish
async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
  }
  return browser;
}

// TikTok sahifasini screenshot qilish
app.get("/screenshot", async (req, res) => {
  try {
    const b = await getBrowser();
    if (!page) {
      page = await b.newPage();
      await page.setViewportSize({ width: 1280, height: 800 });
    }

    const screenshot = await page.screenshot({ type: "jpeg", quality: 80 });
    res.setHeader("Content-Type", "image/jpeg");
    res.send(screenshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TikTok ga o'tish (login sahifasi)
app.get("/open-tiktok", async (req, res) => {
  try {
    const b = await getBrowser();
    if (!page) {
      page = await b.newPage();
      await page.setViewportSize({ width: 1280, height: 800 });
    }
    await page.goto("https://www.tiktok.com/login", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    res.json({ success: true, url: page.url() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Click action
app.post("/click", async (req, res) => {
  try {
    const { x, y } = req.body;
    await page.mouse.click(x, y);
    await page.waitForTimeout(1000);
    const screenshot = await page.screenshot({ type: "jpeg", quality: 80 });
    res.setHeader("Content-Type", "image/jpeg");
    res.send(screenshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Keyboard input
app.post("/type", async (req, res) => {
  try {
    const { text } = req.body;
    await page.keyboard.type(text);
    await page.waitForTimeout(500);
    const screenshot = await page.screenshot({ type: "jpeg", quality: 80 });
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
    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(800);
    const screenshot = await page.screenshot({ type: "jpeg", quality: 80 });
    res.setHeader("Content-Type", "image/jpeg");
    res.send(screenshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hozirgi URL
app.get("/url", async (req, res) => {
  try {
    res.json({ url: page ? page.url() : "No page open" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
