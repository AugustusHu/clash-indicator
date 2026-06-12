#!/usr/bin/env bash
# 打包商店上传用 zip（只含扩展运行所需文件）
set -e
cd "$(dirname "$0")"
mkdir -p dist
rm -f dist/clash-indicator.zip
zip -rq dist/clash-indicator.zip manifest.json background.js popup.html popup.js icons _locales
echo "OK -> dist/clash-indicator.zip"
unzip -l dist/clash-indicator.zip
