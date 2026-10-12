#!/bin/bash
# 闪途官网部署脚本
# 架构说明：代码已将资源路径（assets/uploads/public/logs）固定为项目根绝对路径，
#   不再依赖 process.cwd()，也不需要 dist 内指向项目根的软链接。
#   因此 standalone 构建后无需再补软链接，也不会误删项目根文件。
# 用法：cd /www/wwwroot/shantu-web && bash deploy.sh
set -e
cd /www/wwwroot/shantu-web

TS=$(date +%s)

echo "=== [0/6] 清理历史部署备份（每份约 400MB，磁盘仅 40G，只保留最近 1 份）==="
# 按目录名（时间戳）排序，保留最新一份，其余删除；只匹配部署脚本自身生成的目录
ls -1d dist_bak_* dist_old_* dist_broken_* dist.bak-* 2>/dev/null | sort | head -n -1 | xargs -r rm -rf
echo "历史备份已清理，当前保留：$(ls -1d dist_bak_* dist_old_* 2>/dev/null | tail -1 || echo 无)"

echo "=== [1/6] 备份当前 dist ==="
if [ -d dist ]; then
  cp -a dist "dist_bak_$TS"
  echo "已备份到 dist_bak_$TS"
else
  echo "dist 不存在，跳过备份"
fi

echo "=== [2/6] 停止应用（避免构建期间 pm2 重启风暴）==="
# 关键：构建会移走 dist，此时 pm2 若自动重启将找不到 server.js 而疯狂重启（曾累积数千次无效重启）
pm2 stop shantu-web 2>/dev/null || echo "进程未运行，跳过"
# 清空历史日志，避免错误日志无限膨胀（曾涨到 210MB+）
pm2 flush shantu-web 2>/dev/null || true

echo "=== [3/6] 构建 (prisma generate + next build) ==="
# 防坑：当前 dist 内可能仍残留指向项目根的软链接（历史遗留）。
# 若直接 next build，其清理 dist 时会跟随软链接删除项目根 assets/uploads（已踩过两次坑）。
# 因此先断开软链接、把旧 dist 整体移走，让 build 生成全新 dist，全程不触碰项目根。
[ -L dist/standalone/assets ] && rm -f dist/standalone/assets
[ -L dist/standalone/uploads ] && rm -f dist/standalone/uploads
[ -d dist ] && mv dist "dist_old_$TS"
# 限制 node 堆内存，避免构建 OOM 拖垮系统（机器仅 1.7G 物理内存）
export NODE_OPTIONS="--max-old-space-size=1024"
if ! npm run build; then
  echo "构建失败！恢复旧 dist 并重启服务"
  rm -rf dist
  [ -d "dist_old_$TS" ] && mv "dist_old_$TS" dist
  export NODE_OPTIONS="--no-enable-source-maps"
  PORT=3008 pm2 restart shantu-web --update-env 2>/dev/null || \
    PORT=3008 pm2 start dist/standalone/server.js --name shantu-web --cwd /www/wwwroot/shantu-web
  exit 1
fi
# 构建成功：旧 dist 无需保留（已有一份 dist_bak_$TS 可回滚）
rm -rf "dist_old_$TS"

echo "=== [4/6] 同步 .env 到 standalone ==="
if [ -f .env ]; then
  cp -f .env dist/standalone/.env
  echo ".env 已同步"
fi

echo "=== [5/6] 重启应用 ==="
# 运行时禁用 source map：规避 Node 20.9.0 的 cloneSourceMapV3(null) 崩溃（曾导致进程反复重启）
export NODE_OPTIONS="--no-enable-source-maps"
PORT=3008 pm2 restart shantu-web --update-env 2>/dev/null || PORT=3008 pm2 start dist/standalone/server.js --name shantu-web --cwd /www/wwwroot/shantu-web
pm2 save 2>/dev/null || true
sleep 4

echo "=== [6/6] 验证 ==="
pm2 list | grep shantu || true
curl -s -o /dev/null -w "首页 HTTP:%{http_code}\n" --max-time 10 http://127.0.0.1:3008/ || echo "首页探测失败"
df -h / | tail -1
echo "=== 部署完成 ==="
