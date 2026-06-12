# Chrome Web Store 上架材料（提交时直接复制粘贴）

## 基本信息

- **名称**：Clash 指示器（英文商店自动取 Clash Indicator，由 _locales 提供）
- **类别**：开发者工具（Developer Tools）
- **语言**：中文（简体）+ English
- **单一用途说明（Single purpose）**：
  > 显示当前标签页经由本地 Clash 代理软件的路由状态（直连或代理），以及命中规则、节点延迟等只读信息。

## 简短描述（132 字符内）

中文：
> 实时显示当前页面走直连还是代理，查看 Clash 命中规则、节点延迟与页面流量。纯只读，零数据收集。

English:
> See if the current page goes direct or through your Clash proxy — rules, latency and traffic at a glance. Read-only, zero data collection.

## 详细描述

中文：

```
实时显示当前页面走直连还是代理的路由状态指示器，基于 Clash external controller API，纯只读、零数据收集。

【功能】
• 工具栏图标实时变色：绿=直连，蓝=代理，灰=未知，红=无法连接
• 显示命中规则、节点链、节点延迟、页面流量
• 页面资源去向汇总：当前页所有域名各走哪条路线
• 一键打开 Clash 面板
• 新装引导页，两步完成配置
• 中英双语

【如何使用】
1. 确认本地 Clash 配置已开启 external-controller，例如：
   external-controller: 127.0.0.1:9090
   secret: 你的密码（可选但建议设置）
   Clash Verge / Clash for Windows 用户可在客户端设置界面直接查看地址和密码。
2. 安装后会自动打开引导页，先把扩展固定到工具栏：点浏览器右上角拼图图标，再点本扩展旁的图钉。
3. 在引导页（或弹窗底部"设置"）填入 controller 地址和 secret，点"测试连接"确认成功后保存。
4. 打开任意网页，看图标颜色即知直连还是代理；点开弹窗可查看命中规则、节点延迟、页面流量和各域名去向。
5. 若显示"未知"，刷新一下页面再打开弹窗即可。

【使用前提】
本地运行 Clash / Clash Verge / mihomo 等代理软件，并开启 external-controller。

【隐私】
扩展只与你配置的本地 controller 地址通信，不收集、不上传任何数据。

【开源】
https://github.com/AugustusHu/clash-indicator
```

English:

```
A route status indicator that shows in real time whether the current page goes direct or through a proxy. Powered by the Clash external controller API. Read-only, zero data collection.

FEATURES
• Toolbar icon changes color in real time: green = direct, blue = proxied, gray = unknown, red = controller unreachable
• Shows matched rule, proxy chain, node latency and page traffic
• Per-domain breakdown of where every resource on the page goes
• One-click access to your Clash dashboard
• Onboarding page — set up in two steps
• Available in English and Chinese

HOW TO USE
1. Make sure external-controller is enabled in your local Clash config, e.g.:
   external-controller: 127.0.0.1:9090
   secret: your-password (optional but recommended)
   Clash Verge / Clash for Windows users can find the address and secret in the client settings.
2. After installation an onboarding page opens automatically. First pin the extension: click the puzzle icon in the toolbar, then the pin next to this extension.
3. Enter the controller address and secret on the onboarding page (or in the popup's Settings), click "Test connection", then save.
4. Open any page — the icon color tells you direct or proxied. Open the popup for the matched rule, latency, traffic and per-domain routes.
5. If it shows "Unknown", reload the page and reopen the popup.

REQUIREMENTS
Clash / Clash Verge / mihomo running locally with external-controller enabled.

PRIVACY
The extension only talks to the local controller address you configure. No data is collected or transmitted.

SOURCE
https://github.com/AugustusHu/clash-indicator
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
- 隐私政策 URL：`https://github.com/AugustusHu/clash-indicator/blob/master/PRIVACY.md`

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
