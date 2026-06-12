# Chrome Web Store 上架材料（提交时直接复制粘贴）

## 基本信息

- **名称**：Clash 指示器（英文商店自动取 Clash Indicator，由 _locales 提供）
- **类别**：开发者工具（Developer Tools）
- **语言**：中文（简体）+ English
- **单一用途说明（Single purpose）**：
  > 显示当前标签页经由本地 Clash 代理软件的路由状态（直连或代理），并提供规则、延迟与节点切换的查看入口。

## 简短描述（132 字符内）

中文：
> 实时显示当前页面走直连还是代理，查看 Clash 命中规则、节点延迟与页面流量，弹窗内一键切换节点。

English:
> See if the current page goes direct or through your Clash proxy — rules, latency, traffic, and one-click node switching.

## 详细描述

中文：

```
基于 Clash external controller API 的路由状态指示器。

功能：
• 工具栏图标实时变色：绿=直连，蓝=代理，灰=未知，红=无法连接
• 显示命中规则、节点链、节点延迟、页面流量
• 页面资源去向汇总：当前页所有域名各走哪条路线
• 弹窗内直接切换代理组节点
• 一键打开 Clash 面板
• 中英双语

使用前提：本地运行 Clash / Clash Verge / mihomo 等，并开启 external-controller。
扩展只与你配置的本地 controller 地址通信，不收集、不上传任何数据。
开源地址：<GitHub 仓库链接>
```

English:

```
A route status indicator powered by the Clash external controller API.

Features:
• Toolbar icon changes color in real time: green = direct, blue = proxied, gray = unknown, red = controller unreachable
• Shows matched rule, proxy chain, node latency and page traffic
• Per-domain breakdown of where every resource on the page goes
• Switch proxy group nodes right from the popup
• One-click access to your Clash dashboard
• Available in English and Chinese

Requires Clash / Clash Verge / mihomo running locally with external-controller enabled.
The extension only talks to the local controller address you configure. No data is collected or transmitted.
Source code: <GitHub repo URL>
```

## 权限用途说明（隐私权规范 → 权限理由，逐项填写）

| 权限 | 理由（中文，可直接粘贴英文版在下方） |
|---|---|
| `tabs` | 读取当前标签页的 URL 以提取域名，与 Clash 连接记录匹配并更新图标状态。 |
| `storage` | 保存用户配置的 controller 地址和 secret。 |
| `webNavigation` | 在页面导航完成时刷新图标的路由状态。 |
| `webRequest` | 在内存中记录当前标签页请求过的域名列表，用于"页面资源去向"功能；列表不落盘、不上传。 |
| 主机权限 `<all_urls>` | webRequest 需要观察任意站点的请求才能统计资源域名；同时允许向用户自行配置的任意本地 controller 地址（http/https、任意端口）发起 API 请求。不读取、不修改任何页面内容。 |

English versions:

- `tabs`: Read the active tab's URL to extract its hostname, match it against Clash connection records, and update the toolbar icon.
- `storage`: Persist the user-configured controller address and secret.
- `webNavigation`: Refresh the route status indicator when a page navigation completes.
- `webRequest`: Keep an in-memory list of domains requested by the current tab for the per-domain route breakdown. The list is never written to disk or transmitted.
- Host permission `<all_urls>`: Required for webRequest to observe requests on any site, and to call the user-configured local controller API (any host/port, http or https). The extension never reads or modifies page content.

## 数据使用声明（Privacy practices 表单勾选）

- 是否收集用户数据：**否**（全部选"不收集"）
- 远程代码：**否**
- 隐私政策 URL：GitHub 仓库的 `PRIVACY.md` 链接（如 `https://github.com/<user>/clash-indicator/blob/main/PRIVACY.md`）

## 图片素材（store-assets/）

| 文件 | 规格 | 用途 |
|---|---|---|
| `icons/icon128.png` | 128×128 | 商店图标（已在扩展包内） |
| `store-assets/screenshot-1.png` | 1280×800 | 商店截图（必填，至少 1 张；建议上架后补真实截图） |
| `store-assets/promo-tile.png` | 440×280 | 小型宣传图（可选） |

## 提交流程

1. https://chrome.google.com/webstore/devconsole 注册（一次性 $5）
2. 运行 `./pack.sh`，上传 `dist/clash-indicator.zip`
3. 按本文档填写商店信息、权限理由、隐私声明
4. 可见性建议先选 Unlisted，过审后改 Public
5. 含 webRequest 的扩展人工审核常见 3–14 天

## Edge 加载项商店（可选）

https://partner.microsoft.com/dashboard/microsoftedge 免费注册，同一个 zip 与文案直接复用。
