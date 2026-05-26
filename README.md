# 天顺石业官网

这是一个静态官网项目，直接由 `index.html`、`css/`、`js/` 和 `assets/` 组成。

## 本地预览

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local.ps1
```

打开：

```text
http://localhost:4173/index.html
```

## 临时分享给别人

```powershell
powershell -ExecutionPolicy Bypass -File .\start-share.ps1
```

脚本会启动本地网站，并通过 Cloudflare Tunnel 生成一个公网链接。只要这台电脑和脚本保持运行，别人就能访问；你修改本地文件后刷新页面即可看到更新。

注意：这种 `trycloudflare.com` 链接是临时链接，重启隧道后可能变化。正式长期分享建议使用 GitHub Pages、Cloudflare Pages 或绑定自己的域名。

## GitHub Pages 正式部署思路

1. 创建一个 GitHub 仓库。
2. 把本项目推送到仓库。
3. 在仓库 Settings -> Pages 中选择 `main` 分支和根目录发布。
4. 之后每次修改本地文件，提交并推送到 GitHub，页面会自动更新。

常用命令：

```powershell
git add .
git commit -m "Update website"
git push
```
