// 路由指示器 - background service worker
// 基于 Clash-compatible controller：/connections 判路由，/proxies 拿延迟和节点组

const DEFAULTS = {
  controller: "http://192.168.10.1:9090",
  secret: ""
};

let localeMessages = null;

function t(key, subs) {
  const item = localeMessages && localeMessages[key.toLowerCase()];
  if (!item) return chrome.i18n.getMessage(key, subs) || key;
  const values = Array.isArray(subs) ? subs : subs == null ? [] : [subs];
  let message = item.message || key;
  for (const [name, placeholder] of Object.entries(item.placeholders || {})) {
    const index = Number(String(placeholder.content || "").replace("$", "")) - 1;
    message = message.replaceAll("$" + name.toUpperCase() + "$", values[index] ?? "");
  }
  return message;
}

async function loadSelectedLanguage() {
  const { language = "auto" } = await chrome.storage.sync.get({ language: "auto" });
  const resolvedLanguage = language === "auto"
    ? resolveLanguage(chrome.i18n.getUILanguage())
    : language;
  const version = chrome.runtime.getManifest().version;
  const url = chrome.runtime.getURL(`_locales/${resolvedLanguage}/messages.json?v=${version}`);
  const response = await fetch(url, { cache: "no-store" });
  const messages = await response.json();
  localeMessages = Object.fromEntries(
    Object.entries(messages).map(([key, value]) => [key.toLowerCase(), value])
  );
}

function resolveLanguage(value) {
  const language = String(value || "").toLowerCase().replace("_", "-");
  if (/^zh-(tw|hk|mo|hant)/.test(language)) return "zh_TW";
  if (language.startsWith("zh")) return "zh_CN";
  if (language.startsWith("ja")) return "ja";
  return "en";
}

let languageReady = loadSelectedLanguage();

// 支持 http/https；没写协议时补 http://
function normalizeController(url) {
  let u = (url || "").trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//i.test(u)) u = "http://" + u;
  return u || DEFAULTS.controller;
}

const COLORS = {
  direct: "#16a34a",
  proxy: "#2563eb",
  block: "#dc2626",
  mixed: "#7c3aed",
  unknown: "#9ca3af",
  error: "#dc2626"
};

// 域名 -> 路由结果缓存（连接关闭后 /connections 查不到，靠它兜底）
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

// tabId -> Set<host>：该 tab 实际请求过的域名（webRequest 记录）
const tabDomains = new Map();
// tabId -> Map<host, stats>：该 tab 内每个域名的请求次数和浏览器侧耗时
const tabDomainStats = new Map();
// requestId -> request start info：用于 onCompleted/onErrorOccurred 计算耗时
const requestStarts = new Map();
const routeSampleTimers = new Map();

let proxiesCache = { data: null, time: 0 };
const PROXIES_TTL = 10 * 1000;

async function getConfig() {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...cfg, controller: normalizeController(cfg.controller) };
}

// 是否已成功连过 controller（用于区分"没配置"和"连接故障"）
let configured = null;
async function isConfigured() {
  if (configured === null) {
    const d = await chrome.storage.local.get({ configured: false });
    configured = d.configured;
  }
  return configured;
}
async function markConfigured() {
  if (configured !== true) {
    configured = true;
    await chrome.storage.local.set({ configured: true });
  }
}

async function api(path, options = {}) {
  const cfg = await getConfig();
  const headers = { ...(options.headers || {}) };
  if (cfg.secret) headers["Authorization"] = "Bearer " + cfg.secret;
  const url = cfg.controller.replace(/\/+$/, "") + path;
  const resp = await fetch(url, { ...options, headers });
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  await markConfigured();
  return resp.json();
}

async function fetchConnections() {
  const data = await api("/connections");
  return data.connections || [];
}

async function fetchProxies() {
  if (proxiesCache.data && Date.now() - proxiesCache.time < PROXIES_TTL) {
    return proxiesCache.data;
  }
  const data = await api("/proxies");
  proxiesCache = { data: data.proxies || {}, time: Date.now() };
  return proxiesCache.data;
}

function baseDomain(host) {
  if (!host) return "";
  if (/^[\d.]+$/.test(host)) return host;
  const parts = host.split(".");
  return parts.length <= 2 ? host : parts.slice(-2).join(".");
}

function connHost(c) {
  const m = c.metadata || {};
  return m.host || m.sniffHost || m.destinationIP || "";
}

function isDirectOutbound(outbound) {
  return String(outbound || "").trim().toUpperCase() === "DIRECT";
}

function isBlockedOutbound(outbound) {
  return /^(REJECT|REJECT-DROP|DROP|BLOCK)$/.test(String(outbound || "").trim().toUpperCase());
}

function isExplicitlyBlockedError(error) {
  return /ERR_BLOCKED_BY_(CLIENT|ADMINISTRATOR|RESPONSE)/i.test(error || "");
}

function summarize(conn) {
  const chains = conn.chains || [];
  const outbound = chains[0] || "";
  return {
    direct: isDirectOutbound(outbound),
    blocked: isBlockedOutbound(outbound),
    outbound,
    chains,
    rule: conn.rule || "",
    rulePayload: conn.rulePayload || "",
    host: connHost(conn),
    time: Date.now()
  };
}

function getCached(host) {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.time < CACHE_TTL) return hit;
  return null;
}

function putCache(host, s) {
  cache.set(host, s);
}

function exactConnMatches(conns, host) {
  return conns.filter((c) => connHost(c) === host);
}

function relatedConnMatches(conns, host) {
  const bd = baseDomain(host);
  return conns.filter((c) => {
    const h = connHost(c);
    return h && h !== host && baseDomain(h) === bd;
  });
}

function routeKey(s) {
  return s.direct ? "direct" : s.blocked ? "block" : "proxy:" + (s.outbound || "");
}

// 主页面判定：精确命中优先；只有同主域名连接路线完全一致时才兜底，避免混合页面误判。
function inferHostSummary(conns, host) {
  const related = relatedConnMatches(conns, host).map(summarize);
  if (!related.length) return null;
  const routes = new Set(related.map(routeKey));
  return routes.size === 1 ? related[related.length - 1] : null;
}

function getTabHostStats(tabId, host) {
  const byHost = tabDomainStats.get(tabId);
  return byHost ? byHost.get(host) || null : null;
}

function addDomainStat(tabId, host, durationMs, error) {
  let byHost = tabDomainStats.get(tabId);
  if (!byHost) {
    byHost = new Map();
    tabDomainStats.set(tabId, byHost);
  }
  const s = byHost.get(host) || {
    count: 0,
    totalDuration: 0,
    lastDuration: 0,
    errors: 0,
    blocked: false,
    lastError: ""
  };
  s.count++;
  if (Number.isFinite(durationMs) && durationMs >= 0) {
    s.totalDuration += durationMs;
    s.lastDuration = durationMs;
  }
  if (error) {
    s.errors++;
    s.lastError = error;
    if (isExplicitlyBlockedError(error)) s.blocked = true;
  }
  byHost.set(host, s);
}

async function sampleTabRoutes(tabId) {
  routeSampleTimers.delete(tabId);
  const hosts = tabDomains.get(tabId);
  if (!hosts || !hosts.size) return;
  try {
    const conns = await fetchConnections();
    for (const host of hosts) {
      const m = exactConnMatches(conns, host);
      if (m.length) putCache(host, summarize(m[m.length - 1]));
    }
  } catch (e) {}
}

function scheduleRouteSample(tabId, delay = 150) {
  if (tabId < 0 || routeSampleTimers.has(tabId)) return;
  const timer = setTimeout(() => sampleTabRoutes(tabId), delay);
  routeSampleTimers.set(tabId, timer);
}

function nodeDelay(proxies, name) {
  let p = proxies[name];
  // 节点组则追到当前选中节点
  const seen = new Set();
  while (p && p.now && !seen.has(p.name)) {
    seen.add(p.name);
    p = proxies[p.now];
  }
  if (!p || !p.history || !p.history.length) return null;
  const d = p.history[p.history.length - 1].delay;
  return d > 0 ? d : null;
}

// 当前页面完整查询（popup 用）
async function lookup(host, tabId) {
  const conns = await fetchConnections();

  // 主域名判定
  const main = exactConnMatches(conns, host);
  let summary = null;
  let fresh = false;
  if (main.length) {
    summary = summarize(main[main.length - 1]);
    putCache(host, summary);
    fresh = true;
  } else {
    const cached = getCached(host);
    summary = cached || inferHostSummary(conns, host);
    fresh = !!summary && !cached;
  }

  // 该 tab 请求过的所有域名
  const domainSet = new Set(tabDomains.get(tabId) || []);
  domainSet.add(host);
  // 补充：连接里同主域名的 host
  const bd = baseDomain(host);
  for (const c of conns) {
    const h = connHost(c);
    if (h && baseDomain(h) === bd) domainSet.add(h);
  }

  const domains = [];
  const counts = { direct: 0, proxy: 0, block: 0, unknown: 0 };
  for (const d of domainSet) {
    const m = exactConnMatches(conns, d);
    let s = null;
    if (m.length) {
      s = summarize(m[m.length - 1]);
      putCache(d, s);
    } else {
      s = getCached(d);
    }
    const stat = getTabHostStats(tabId, d);
    const timing = stat
      ? {
          count: stat.count,
          avgDuration: stat.count ? stat.totalDuration / stat.count : 0,
          lastDuration: stat.lastDuration,
          errors: stat.errors,
          lastError: stat.lastError
        }
      : null;
    if (s && s.blocked || stat && stat.blocked) {
      counts.block++;
      domains.push({ host: d, state: "block", outbound: s ? s.outbound : "BLOCK", timing });
    } else if (!s) {
      counts.unknown++;
      domains.push({ host: d, state: "unknown", outbound: "", timing });
    } else if (s.direct) {
      counts.direct++;
      domains.push({ host: d, state: "direct", outbound: "DIRECT", timing });
    } else {
      counts.proxy++;
      domains.push({ host: d, state: "proxy", outbound: s.outbound, timing });
    }
  }
  domains.sort((a, b) => a.host.localeCompare(b.host));

  // 节点延迟
  let delayMs = null;
  if (summary && !summary.direct && !summary.blocked && summary.chains.length) {
    try {
      const proxies = await fetchProxies();
      delayMs = nodeDelay(proxies, summary.outbound);
    } catch (e) {}
  }

  return { ok: true, fresh, summary, delayMs, domains, counts };
}

// ---------- 动态图标 ----------
function drawIcon(color) {
  const images = {};
  for (const size of [16, 32]) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");
    const c = size / 2;
    ctx.beginPath();
    ctx.arc(c, c, c - size * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c, c, c * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    images[size] = ctx.getImageData(0, 0, size, size);
  }
  return images;
}

async function setIndicator(tabId, state, title) {
  try {
    await chrome.action.setIcon({ tabId, imageData: drawIcon(COLORS[state] || COLORS.unknown) });
    if (title) await chrome.action.setTitle({ tabId, title });
  } catch (e) {}
}

async function updateIndicator(tabId, url) {
  await languageReady;
  if (!url || !/^https?:/i.test(url)) {
    await setIndicator(tabId, "unknown", t("extName"));
    return;
  }
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }
  try {
    const conns = await fetchConnections();
    const m = exactConnMatches(conns, host);
    let s = m.length ? summarize(m[m.length - 1]) : getCached(host) || inferHostSummary(conns, host);
    if (m.length) putCache(host, s);
    if (!s) {
      await setIndicator(tabId, "unknown", t("bgNoRecord", [host]));
      return;
    }
    const state = s.direct ? "direct" : s.blocked ? "block" : "proxy";
    const label = s.direct
      ? t("direct")
      : s.blocked
        ? t("block")
        : t("proxy") + " " + s.chains.slice().reverse().join(" → ");
    await setIndicator(tabId, state, `${host}: ${label}\n${t("bgRule")}: ${s.rule} ${s.rulePayload}`);
  } catch (e) {
    if (await isConfigured()) {
      await setIndicator(tabId, "error", t("bgCtrlError", [e.message]));
    } else {
      // 从未连接成功过：大概率还没配置，给中性提示而非报错
      await setIndicator(tabId, "unknown", t("bgNotConfigured"));
    }
  }
}

function scheduleUpdate(tabId, url) {
  updateIndicator(tabId, url);
  setTimeout(() => updateIndicator(tabId, url), 2000);
}

// 新安装时打开引导页（固定扩展 + 配置 controller）
chrome.runtime.onInstalled.addListener((details) => {
  const version = chrome.runtime.getManifest().version;
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  } else if (details.reason === "update") {
    chrome.storage.local.set({ pendingUpdateVersion: version });
  }
});

// ---------- 事件 ----------
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0 || !/^https?:/i.test(details.url)) return;
    try {
      const host = new URL(details.url).hostname;
      if (details.type === "main_frame") {
        tabDomains.set(details.tabId, new Set([host]));
        tabDomainStats.set(details.tabId, new Map());
      } else {
        let set = tabDomains.get(details.tabId);
        if (!set) {
          set = new Set();
          tabDomains.set(details.tabId, set);
        }
        set.add(host);
      }
      requestStarts.set(details.requestId, { tabId: details.tabId, host, time: details.timeStamp });
      scheduleRouteSample(details.tabId, 150);
    } catch {}
  },
  { urls: ["<all_urls>"] }
);

function finishRequest(details, error = "") {
  const start = requestStarts.get(details.requestId);
  requestStarts.delete(details.requestId);
  if (!start || start.tabId < 0) return;
  const duration = details.timeStamp - start.time;
  addDomainStat(start.tabId, start.host, duration, error);
  scheduleRouteSample(start.tabId, 0);
}

chrome.webRequest.onCompleted.addListener(
  (details) => finishRequest(details),
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => finishRequest(details, details.error || "Request failed"),
  { urls: ["<all_urls>"] }
);

chrome.tabs.onRemoved.addListener((tabId) => {
  tabDomains.delete(tabId);
  tabDomainStats.delete(tabId);
  const timer = routeSampleTimers.get(tabId);
  if (timer) clearTimeout(timer);
  routeSampleTimers.delete(tabId);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    updateIndicator(tabId, tab.url);
  } catch {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    scheduleUpdate(tabId, tab.url);
  }
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) scheduleUpdate(details.tabId, details.url);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.language) languageReady = loadSelectedLanguage();
});

// ---------- popup 消息 ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "lookup") {
    lookup(msg.host, msg.tabId)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === "isConfigured") {
    isConfigured().then((v) => sendResponse({ ok: true, configured: v }));
    return true;
  }
  if (msg.type === "getController") {
    getConfig().then((cfg) => sendResponse({ ok: true, controller: cfg.controller }));
    return true;
  }
  if (msg.type === "testController") {
    (async () => {
      const headers = {};
      if (msg.secret) headers["Authorization"] = "Bearer " + msg.secret;
      const resp = await fetch(normalizeController(msg.controller) + "/version", { headers });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      await markConfigured();
      return resp.json();
    })()
      .then((v) => sendResponse({ ok: true, version: v.version || JSON.stringify(v) }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});
