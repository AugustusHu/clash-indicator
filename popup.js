const $ = (id) => document.getElementById(id);
const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;
let curHost = "";
let curTabId = null;

document.querySelectorAll("[data-i18n]").forEach((el) => {
  el.textContent = t(el.dataset.i18n);
});

function normalizeController(v) {
  let u = (v || "").trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//i.test(u)) u = "http://" + u;
  return u || "http://192.168.10.1:9090";
}

function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
  return (n / 1073741824).toFixed(2) + " GB";
}

function setVerdict(cls, text) {
  const v = $("verdict");
  v.className = cls;
  v.textContent = text;
}

function show(id, on) {
  $(id).style.display = on ? "" : "none";
}

async function render(r) {
  ["chain-row", "rule-row", "stale-row", "domains-sec", "hint"].forEach((id) => show(id, false));

  if (!r || !r.ok) {
    const c = await chrome.runtime.sendMessage({ type: "isConfigured" });
    show("hint", true);
    if (c && !c.configured) {
      // 从未连接成功：引导配置而不是报错
      setVerdict("unknown", t("notConfigured"));
      $("hint").textContent = t("setupHint");
      $("settings-details").open = true;
      $("controller").focus();
    } else {
      setVerdict("error", t("connFailed"));
      $("hint").textContent = t("errHint", [r ? r.error : t("noResponse")]);
    }
    return;
  }

  if (!r.summary) {
    setVerdict("unknown", t("unknown"));
    show("hint", true);
    $("hint").textContent = t("noRecord", [curHost]);
    renderDomains(r);
    return;
  }

  const s = r.summary;
  if (s.direct) {
    setVerdict("direct", t("direct"));
  } else {
    setVerdict("proxy", t("proxy"));
    show("chain-row", true);
    $("chain").textContent = s.chains.slice().reverse().join(" → ");
    if (r.delayMs != null) {
      const d = $("delay");
      d.textContent = r.delayMs + " ms";
      d.className = "right " + (r.delayMs < 300 ? "delay-ok" : "delay-bad");
    } else {
      $("delay").textContent = "";
    }
  }

  show("rule-row", true);
  $("rule").textContent = s.rule + (s.rulePayload ? "（" + s.rulePayload + "）" : "");
  $("traffic").textContent =
    r.traffic && (r.traffic.up || r.traffic.down)
      ? "↓ " + fmtBytes(r.traffic.down) + " · ↑ " + fmtBytes(r.traffic.up)
      : "";

  if (!r.fresh) show("stale-row", true);

  renderDomains(r);
}

function renderDomains(r) {
  if (!r.domains || r.domains.length < 2) return;
  show("domains-sec", true);
  const c = r.counts;
  $("dom-title").textContent = t("domTitle", [String(r.domains.length)]);
  $("dom-counts").textContent =
    t("proxy") + " " + c.proxy + " · " + t("direct") + " " + c.direct +
    (c.unknown ? " · " + t("unknown") + " " + c.unknown : "");

  const bar = $("bar");
  bar.innerHTML = "";
  const segs = [["p", c.proxy], ["d", c.direct], ["u", c.unknown]];
  for (const [cls, n] of segs) {
    if (!n) continue;
    const div = document.createElement("div");
    div.className = cls;
    div.style.flex = n;
    bar.appendChild(div);
  }

  const list = $("dom-list");
  list.innerHTML = "";
  for (const d of r.domains) {
    const row = document.createElement("div");
    row.className = "dom";
    const h = document.createElement("span");
    h.className = "h";
    h.textContent = d.host;
    const o = document.createElement("span");
    o.className = "o " + d.state;
    o.textContent = d.state === "direct" ? t("direct") : d.state === "proxy" ? d.outbound : t("unknown");
    row.append(h, o);
    list.appendChild(row);
  }
}

async function refresh() {
  if (!curHost) return;
  const r = await chrome.runtime.sendMessage({ type: "lookup", host: curHost, tabId: curTabId });
  await render(r);
}

async function init() {
  const cfg = await chrome.storage.sync.get({ controller: "http://192.168.10.1:9090", secret: "" });
  $("controller").value = cfg.controller;
  $("secret").value = cfg.secret;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab && tab.url ? tab.url : "";
  curTabId = tab ? tab.id : null;
  if (!/^https?:/i.test(url)) {
    $("host").textContent = t("nonWebTab");
    setVerdict("unknown", t("notApplicable"));
    return;
  }
  curHost = new URL(url).hostname;
  $("host").textContent = curHost;
  await refresh();
}

$("refresh").addEventListener("click", refresh);

$("open-dash").addEventListener("click", async () => {
  const r = await chrome.runtime.sendMessage({ type: "getController" });
  const base = normalizeController(r && r.controller);
  chrome.tabs.create({ url: base + "/ui/" });
});

$("save").addEventListener("click", async () => {
  const normalized = normalizeController($("controller").value);
  $("controller").value = normalized;
  await chrome.storage.sync.set({
    controller: normalized,
    secret: $("secret").value.trim()
  });
  const m = $("msg");
  m.className = "ok";
  m.textContent = t("saved");
});

$("test").addEventListener("click", async () => {
  const m = $("msg");
  m.className = "";
  m.textContent = t("testing");
  const r = await chrome.runtime.sendMessage({
    type: "testController",
    controller: normalizeController($("controller").value),
    secret: $("secret").value.trim()
  });
  if (r && r.ok) {
    m.className = "ok";
    m.textContent = t("testOk", [String(r.version)]);
    await refresh();
  } else {
    m.className = "err";
    m.textContent = t("failed", [r ? r.error : t("noResponse")]);
  }
});

init();
