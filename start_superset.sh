#!/bin/bash

# Superset 本地启动脚本

# 激活虚拟环境
source /Users/wenxiaocheng/work/maptech/superset/.venv/bin/activate

# 设置环境变量
export SUPERSET_CONFIG_PATH=/Users/wenxiaocheng/work/maptech/superset/superset_config.py
export SUPERSET_SECRET_KEY="K7Gqn27vwQD1lHknch0Qm8AA9xVbYa6MqCVynZ2eqNelINtnWNFCFowez8riXmCa"
export DATABASE_DIALECT="postgresql"
export DATABASE_HOST="192.168.0.10"
export DATABASE_PORT="5432"
export DATABASE_DB="superset"
export DATABASE_USER="crawler_user"
export DATABASE_PASSWORD="Crawler_maptech20250801"
export REDIS_HOST="192.168.0.124"
export REDIS_PORT="6379"
export SUPERSET_LOAD_EXAMPLES="no"
export SUPERSET_WEBSERVER_PORT="8088"

# 启动 Superset
superset run -p 8088 --with-threads --reload --debugger --debug

# 登录账号密码为：admin tnq_PWV0kex3tpr1ber
