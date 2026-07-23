# Clash 指示器 / Clash Indicator

一个轻量 Chrome 扩展：实时显示当前页面走**直连**、**代理**还是 **BLOCK**。基于 Clash-compatible controller API，支持 Clash、Mihomo、sing-box，纯只读、零数据收集。

A lightweight Chrome extension that shows whether the current page is **direct**, **proxied**, or **blocked**. It uses the Clash-compatible controller API exposed by Clash, Mihomo, and sing-box. Read-only, zero data collection.

![screenshot](store-assets/screenshot-1.png)

## 功能 / Features

- 工具栏图标实时变色：绿 = 直连，蓝 = 代理，红 = BLOCK/连接异常，灰 = 未知
- 弹窗显示命中规则、节点链和节点延迟
- 页面资源去向汇总：当前页所有域名各走哪条路线，比例条一目了然
- 一键打开 Zashboard 等兼容面板
- 新装引导页，三步完成配置
- 中英双语（跟随浏览器语言或手动切换）

Toolbar icon changes color in real time. The popup shows the matched rule, outbound chain, node latency, request duration, and a per-domain route breakdown. It never changes the proxy core's state.

## 安装 / Install

**商店安装**：Chrome Web Store 上架后在此更新链接。

**手动安装 / Manual:**

1. 下载本仓库（Code → Download ZIP）并解压 / Download and unzip this repo
2. 打开 `chrome://extensions`，开启右上角「开发者模式」/ Enable Developer mode
3. 点「加载已解压的扩展程序」，选择本项目目录 / Click "Load unpacked" and select the project folder

## 配置 / Setup

扩展读取代理核心暴露的 Clash-compatible controller API。Zashboard 只是使用该 API 的面板，并不是本扩展的依赖。

Clash / Mihomo 配置示例：

```yaml
external-controller: 0.0.0.0:9090   # 或 127.0.0.1:9090
secret: "你的密码"                    # 可选但建议设置
```

sing-box 配置示例：

```json
{
  "experimental": {
    "clash_api": {
      "external_controller": "0.0.0.0:9090",
      "secret": "your-password"
    }
  }
}
```

点扩展图标 → 设置 → 填入 controller 地址和 secret → 测试连接 → 保存。路由器上常见 `http://192.168.1.1:9090`，本机常见 `http://127.0.0.1:9090`，以实际配置为准。

如果 Zashboard 地址为 `http://路由器IP:9090/ui/`，扩展中填写不带 `/ui/` 的基础地址 `http://路由器IP:9090`。

## 工作原理 / How it works

Chrome 扩展 API 无法获知单个请求实际使用的代理，本扩展通过兼容控制器的 `/connections` 匹配当前页面域名并读取规则和出口链，通过 `/proxies` 获取节点信息和延迟。所有请求仅发往用户配置的 controller 地址。

Chrome's extension API does not expose the actual route used by each request, so this extension reads `/connections` and `/proxies` from a Clash-compatible controller. All requests go only to the configured controller. See [PRIVACY.md](PRIVACY.md).

## 常见问题 / FAQ

**显示"未知"？** 连接已关闭且缓存过期，刷新页面后重新打开弹窗即可。

**显示红色错误状态？** 检查地址、secret，以及 Clash/Mihomo 的 external-controller 或 sing-box 的 experimental.clash_api 是否监听了对应地址。

**HTTPS controller 报错？** 自签名证书需先在浏览器中手动访问一次 controller 地址并信任证书。

## 开发 / Development

无构建步骤，原生 MV3。打包上架用 `./pack.sh`，产物为 `dist/clash-indicator.zip`。

No build step, plain Manifest V3. Run `./pack.sh` to produce the store-ready zip.

## License

[MIT](LICENSE)
