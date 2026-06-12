const $ = (id) => document.getElementById(id);
const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;

document.title = t("extName");
document.querySelectorAll("[data-i18n]").forEach((el) => {
  el.textContent = t(el.dataset.i18n);
});

function normalizeController(v) {
  let u = (v || "").trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//i.test(u)) u = "http://" + u;
  return u || "http://192.168.10.1:9090";
}

async function init() {
  const cfg = await chrome.storage.sync.get({ controller: "http://192.168.10.1:9090", secret: "" });
  $("controller").value = cfg.controller;
  $("secret").value = cfg.secret;
}

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
    secret: $("secret").value.trim()
  });
  const m = $("msg");
  m.className = "ok";
  m.textContent = t("saved");
});

init();
