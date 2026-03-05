#!/bin/bash

# Superset 前端开发脚本（热加载）

cd /Users/wenxiaocheng/work/maptech/superset/superset-frontend

# 确保依赖已安装
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm ci
fi

echo "Starting frontend dev server with hot reload..."
npm run dev-server
