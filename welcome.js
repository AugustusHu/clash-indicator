const $ = (id) => document.getElementById(id);
let localeMessages = null;
const t = (key, subs) => {
  const item = localeMessages && localeMessages[key.toLowerCase()];
  if (!item) return chrome.i18n.getMessage(key, subs) || key;
  const values = Array.isArray(subs) ? subs : subs == null ? [] : [subs];
  let message = item.message || key;
  for (const [name, placeholder] of Object.entries(item.placeholders || {})) {
    const index = Number(String(placeholder.content || "").replace("$", "")) - 1;
    message = message.replaceAll("$" + name.toUpperCase() + "$", values[index] ?? "");
  }
  return message;
};

async function loadLanguage() {
  const { language = "auto" } = await chrome.storage.sync.get({ language: "auto" });
  $("language").value = language;
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

function applyI18n() {
  document.title = t("extName");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
}

function normalizeController(v) {
  let u = (v || "").trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//i.test(u)) u = "http://" + u;
  return u || "http://192.168.10.1:9090";
}

async function init() {
  await loadLanguage();
  applyI18n();
  const cfg = await chrome.storage.sync.get({ controller: "http://192.168.10.1:9090", secret: "", dashboard: "" });
  $("controller").value = cfg.controller;
  $("secret").value = cfg.secret;
  $("dashboard").value = cfg.dashboard;
}

$("language").addEventListener("change", async () => {
  await chrome.storage.sync.set({ language: $("language").value });
  location.reload();
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
  } else {
    m.className = "err";
    m.textContent = t("failed", [r ? r.error : t("noResponse")]);
  }
});

$("save").addEventListener("click", async () => {
  const normalized = normalizeController($("controller").value);
  $("controller").value = normalized;
  await chrome.storage.sync.set({
    controller: normalized,
    secret: $("secret").value.trim(),
    dashboard: $("dashboard").value.trim()
  });
  const m = $("msg");
  m.className = "ok";
  m.textContent = t("saved");
});

init();
