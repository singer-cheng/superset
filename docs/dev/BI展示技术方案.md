# BI 展示技术方案（Superset + PostgreSQL）

## 文档信息

| 项目 | 说明             |
|------|----------------|
| 文档版本 | 1.0            |
| 创建日期 | 2026-02-03     |
| 文档状态 | 评审中            |
| 适用范围 | 地理空间数据采集 BI 展示 |

## 修订历史

| 版本 | 日期 | 修订人 | 修订说明 |
|------|------|--------|----------|
| 1.0 | 2026-02-03 | - | 初稿，整体架构与详细设计 |
| 1.1 | 2026-03-03 | - | 采集覆盖总览看板：下线「各类型采集量折线对比」图表，附录 B.1 图表数改为 7 张、布局去掉 ROW_2 |
| 1.2 | 2026-03-03 | - | 将 DS02（gadm_country_boundary 单表）合并入 DS01；覆盖热力与国家边界面统一使用 DS01，删除 DS02 数据集规划 |
| 1.3 | 2026-03-04 | - | DB01 新增 CH-DB01-09 采集明细下钻表 + CH-DB01-10 国家详情地图，加入 ROW_2；CH-DB01-01 保持 world_map 类型，点击国家 → 国家详情地图联动显示该国 |
| 1.4 | 2026-03-04 | - | 实施 B.1.5 看板布局：创建 CH-DB01-10（chartId=122）和 CH-DB01-09（chartId=123, table），更新看板 position_json（ROW_2）和 json_metadata（chartsInScope 加入 122、123） |
| 1.5 | 2026-03-04 | - | CH-DB01-10 从 `country_map` 改为 `deck_geojson`：country_map 的 select_country 为静态参数无法被 Cross-filter 动态切换；改用 deck_geojson 渲染 DS-DB01-01 的 geojson 列（`ST_AsGeoJSON(g.geom)`），筛选国家后自然只显示对应国家边界 |
| 1.6 | 2026-03-04 | - | 国家详情地图不显示修复：① 图表 122 底图由 `mapbox://styles/mapbox/light-v11` 改为 OSM（`https://tile.openstreetmap.org/{z}/{x}/{y}.png`），避免未配置 MAPBOX_API_KEY 时底图空白；② DS-DB01-01 的 geojson 列改为标准 GeoJSON Feature 格式（`json_build_object('type','Feature','geometry',ST_AsGeoJSON(g.geom)::json,'properties',...)::text`）以兼容 deck.gl 渲染 |
| 1.7 | 2026-03-04 | - | 需求：未选国家时国家详情地图与采集明细下钻表保持为空；在 B.1.5 实施要点后增加实现说明与手动步骤（专用 Virtual Dataset + `filter_values('country')` Jinja，无选中国家时 WHERE 1=0） |
---

## 目录

| 章节 | 内容 |
|------|------|
| 1. 概述 | 摘要、背景、目标 |
| 2. 现状与需求分析 | 数据主存与 PG 资产、需求匹配结论 |
| 3. 总体方案 | 方案结论、技术选型、总体架构、数据流概览 |
| 4. 详细设计 | 数据层、同步策略、展示能力、性能与索引、权限；Superset 平台设计（部署/数据集/图表/看板）；前端集成（Embedded SDK） |
| 5. 实施计划与里程碑 | 阶段与产出 |
| 6. 风险与对策 | 风险项与对策 |
| 7. 交付物 | 交付清单 |
| 附录 A：数据源表信息说明（外链） |
| 附录 B：看板详细实施规划（DB01~DB04） | DB01~DB04 详细实施规划 |

---

## 1. 概述

### 1.1 摘要
本方案针对地理空间数据采集场景，提出基于 **Superset + PostgreSQL** 的 BI 展示方案：以腾讯云 DLC/Iceberg 为数据主存，通过定时同步将聚合与维表落 PG，由 Superset 连接 PG 实现全球热力图、区域下钻及多主题分析，无需自研前端。

### 1.2 背景
- 采集数据已落入腾讯云 DLC 的 Iceberg 表，但难以直观查看**采集覆盖范围**与**各地区数据量**。
- 业务需要：全球热力图等整体展示，支持点选区域下钻到明细数据。

### 1.3 目标
- 提供全球范围的覆盖热力展示（国家/省市/H3/瓦片）。
- 支持区域下钻查看明细数据。
- 优先复用现有数据资产与计算产物，减少前端开发。

---

## 2. 现状与需求分析

### 2.1 数据主存（DLC/Iceberg）
- DLC 流处理作业已将数据写入 Iceberg 原生表，支持按 `dt` 分区与动态多表路由。
- Iceberg 表字段包含 `satellite_meta`、`country`、`source`、`ext`、`dt` 等，满足基础维度统计。
- **问题**：直接对 DLC 做 BI 查询需依赖 Spark 等引擎，接入与性能成本高；业务更希望用成熟 BI 工具快速出图。

### 2.2 PG 已有数据资产
数据人员已通过 DLC 作业将多类结果表同步至 PostgreSQL，可作为 BI 数据源。核心表与结构详见《20260203_BI展示技术方案_crawler_db数据源调研.md》。按表结构可归纳为：

| 类型 | 说明 | 代表表 | 典型用途 |
|------|------|--------|----------|
| **带 geometry 的表** | 含 `geom`/`extent`/`bbox`，可做地图、热力、点/面图层 | `gadm_country_boundary`、`geoboundaries_org_country_boundary`、`satellite_images`（extent）、`dem_tiles_data`、`gps_trace_data`、`street_views`（geom/bbox）、`o_road`、`o_node`、`o_relation` | 全球/国家边界图、瓦片覆盖热力、轨迹/街景点图 |
| **按国家/维度聚合的统计表** | 无几何，有 `country`/`country_code` + 指标列，需与维表/边界表 JOIN 上图 | `crawler_tile_all`（country, type, dt, count_nums）、`app_osm_road_length`、`app_foursquare_places_d`、`app_osm_address_info`、`dws_osm_road_network_density`、`road_overture_osm_compare_m` 等 | 按国家着色热力、柱状/饼图、趋势图 |
| **维表/字典表** | 主键 + 名称/编码，用于关联与筛选 | `dim_country`、`dim_country_name`、`dim_province`、`dim_osm_country_relation`、`dim_osm_poi_info` | 筛选器、下钻层级、名称展示 |

### 2.3 需求匹配结论
- **热力图**：已有 `crawler_tile_all`（country, type, dt, count_nums）可做按国家+类型的覆盖统计；边界表 `gadm_country_boundary`（geom, country_code3/country_code2）可做国家面着色；`satellite_images`（extent）、`dem_tiles_data`（geom）可做瓦片级覆盖展示。
- **下钻**：维表 `dim_osm_country_relation`（area_name_en/cn, parent_id, adm_level）支持国家→省市级下钻；明细表 `satellite_images`、`o_road`、`gps_trace_data` 等可按国家/时间过滤做明细列表。
- **缺省**：若需 H3 网格级热力或瓦片级聚合，可补充 `bi_coverage_h3` / `bi_coverage_tile`；当前表结构已可支撑国家级热力与多主题统计。

---

## 3. 总体方案

### 3.1 方案结论
**采用 Superset 作为展示层、PostgreSQL 作为 BI 加速层是可行且推荐的。**
- DLC/Iceberg 作为主存，保留明细与长期存储能力。
- PG 仅承载聚合表、维表及可选明细，为 Superset 提供稳定、低延迟查询。
- Superset 通过 JDBC 连接 PG，配置数据集与看板，实现热力图与下钻，无需自研前端。

### 3.2 技术选型

| 层次 | 选型 | 说明 |
|------|------|------|
| 数据主存 | 腾讯云 DLC / Iceberg | 现有采集落库，按 `dt` 分区，权威数据源 |
| BI 数据层 | PostgreSQL | 已有大量表落 PG，支持 PostGIS，易与 Superset 集成 |
| 展示层 | Apache Superset | 开源 BI，支持地图/热力/下钻，JDBC 连 PG |

### 3.3 总体架构
#### 3.3.1 架构说明
采用「**数据湖主存 + PG 加速层 + Superset 展示**」分层架构：

1. **数据主存层（DLC/Iceberg）**：采集与流处理结果写入 Iceberg 表，按 `dt` 分区，作为原始数据与明细的权威来源。
2. **同步与聚合层**：定时批处理（Spark SQL / ETL）将 DLC 的聚合结果、维表及部分明细同步至 PostgreSQL，仅落展示所需数据量。
3. **BI 数据层（PostgreSQL）**：存放聚合表、维表及可选明细，为 Superset 提供稳定、低延迟查询；通过 `dt` 分区/索引优化热力图与下钻。
4. **展示层（Superset）**：JDBC 连接 PG，配置数据集与看板，实现全球热力图、区域下钻、多主题分析（覆盖、道路、POI、人口等）。

权限与数据隔离：PG 侧通过 RLS/视图控制；Superset 侧通过行级权限配合。

#### 3.3.2 业务流程图

**数据到看板流程**：从采集落库到 BI 展示的端到端数据流。

```mermaid
flowchart LR
  A[采集/流处理<br/>写入 DLC] --> B[DLC / Iceberg 表]
  B --> C[定时批处理<br/>同步]
  C --> D[PostgreSQL<br/>聚合表/维表/明细]
  D --> E[Superset<br/>连接 PG 查询]
  E --> F[看板展示<br/>热力图/下钻/统计图]
  F --> G[用户/分析师]
```

**用户使用看板流程**：打开看板、筛选、看图、下钻查看明细。

```mermaid
flowchart TB
  subgraph 使用流程
    U1[用户打开 Superset 看板]
    U2[选择筛选条件<br/>国家 / 日期 / 类型等]
    U3[Superset 向 PG 发起查询]
    U4[渲染图表<br/>热力图 / 柱状图 / 趋势图]
    U5[点击区域或维度下钻]
    U6[查询明细表<br/>分页展示列表]
    U7[导出或继续筛选]
  end
  U1 --> U2 --> U3 --> U4
  U4 --> U5 --> U6 --> U7
  U5 -.-> U2
```

### 3.4 数据流概览
**采集/DLC 写入 → DLC Iceberg 表 → 批处理同步 → PostgreSQL → Superset 查询与展示 → 用户。**

---

## 4. 详细设计

本节基于《20260203_BI展示技术方案_crawler_db数据源调研.md》编写，表名字段与现有库表一致。

### 4.1 数据层设计

#### 4.1.1 数据组织原则
- **优先用现有聚合表**：如 `crawler_tile_all`（country, type, dt, count_nums）、`app_osm_road_length`、`app_foursquare_places_d` 等已按国家/类型/日期聚合，直接供图表与筛选使用。
- **带 geometry 的表**：用于地图/热力图层时，需在 Superset 中配置 PostGIS 数据源与几何列（如 `gadm_country_boundary.geom`、`satellite_images.extent`）；统计表与边界表通过 `country_code`/`country_code2`/`country_code3` 关联后上图。
- **明细表**：`satellite_images`、`o_road`、`gps_trace_data`、`street_views` 等用于下钻列表时，建议按 `country`/时间范围限制行数或做分页。

#### 4.1.2 现有表满足情况与可选补充
| 展示需求 | 现有表是否满足 | 说明 |
|----------|----------------|------|
| 国家级覆盖热力 | 满足 | `crawler_tile_all`(country, type, dt, count_nums) + `gadm_country_boundary`(geom, country_code3) 关联即可 |
| 瓦片/影像覆盖分布 | 满足 | `satellite_images`(extent, coordinate_z/x/y)、`dem_tiles_data`(geom, tile_id, level) 可直接做点/面图层 |
| 道路/POI/地址等按国家统计 | 满足 | `app_osm_road_length`、`app_osm_road_length_all`、`app_foursquare_places_d`、`app_osm_address_info` 等已有 country/country_code + 指标 |
| 国家→省市级下钻 | 满足 | `dim_osm_country_relation`(area_name_en/cn, parent_id, adm_level) 提供层级；统计表按 country 过滤 |
| H3 网格级热力 | 需补充 | 现有表无 h3_index；若需要可新增 `bi_coverage_h3`(dt, h3_resolution, h3_index, count_total) 由批处理产出 |

仅当需要 **H3 网格粒度** 热力时，再补充 `bi_coverage_h3`；其余场景用现有表即可。

#### 4.1.3 Superset 数据集规划（按表结构）
| 用途 | 数据来源 | 关键字段与关联 |
|------|----------|-----------------|
| **覆盖热力（按国家）与边界底图** | DS01（Virtual Dataset：`crawler_tile_all` + `gadm_country_boundary` JOIN） | 同一数据集提供 geom（边界几何）与 count_nums（着色指标）；以 `country` 与 `country_code3` 关联；过滤：type、dt；原 DS02 已合并入 DS01 |
| **瓦片/影像覆盖** | `satellite_images`、`dem_tiles_data` | 几何：satellite_images.extent、dem_tiles_data.geom；可按 coordinate_z 或 level 分层 |
| **道路/POI/地址等统计图** | `app_osm_road_length`、`app_osm_road_length_all`、`app_foursquare_places_d`、`app_osm_address_info` 等 | 维度：country/country_code、mo/date_refreshed、road_subtype/level1_category 等；指标：road_length_km、poi_count、count_nums；与维表 JOIN 取名称 |
| **道路/OSM 对比** | `road_overture_osm_compare_m` | 维度：country；指标：overture_total、osm_total、matched_count、match_rate |
| **明细下钻** | `satellite_images`、`o_road`、`gps_trace_data`、`street_views` | 按看板筛选器 country、时间范围限制；分页查询；几何列用于地图点/线 |
| **筛选器/下钻层级** | `dim_country`、`dim_country_name`、`dim_province`、`dim_osm_country_relation`、`dim_osm_poi_info` | 作为维度表与统计表 JOIN，或单独做筛选数据集 |

### 4.2 同步与刷新策略
- **日级批处理**：每日将 DLC 聚合结果/维表同步至 PG。对含 `dt`/`mo`/`date_refreshed` 的表（如 `crawler_tile_all`、`app_osm_road_length`、`app_foursquare_places_d`）按日期覆盖或追加；对维表（如 `dim_country`、`dim_osm_country_relation`）可全量刷新。
- **幂等与主键**：同步需与各表主键/唯一约束一致（如 `app_osm_road_length`(mo, country_code, road_subtype)、`app_foursquare_places_d`(country_alpha3, date_refreshed, is_closed, level1_category_id, level1_category_name)），避免重复与全表扫描。
- **明细表**：`satellite_images`、`o_road`、`gps_trace_data` 等若从 DLC 同步，建议按 `country` + 时间范围增量，或仅保留近 N 天供下钻。

### 4.3 展示能力设计
- **带几何的表**：`gadm_country_boundary`、`satellite_images`（extent）、`dem_tiles_data`、`gps_trace_data`、`street_views` 等可直接在 Superset 中配置为地图图层（面/点/线）；几何列分别为 geom、extent、geom、geom、geom/bbox。
- **纯统计表**：`crawler_tile_all`、`app_osm_road_length`、`app_foursquare_places_d` 等无几何列，需与 `gadm_country_boundary` 或 `dim_country` 按 country_code/country_code3 关联后，再以“按国家着色”方式上地图；或做柱状/饼图/趋势图。
- **下钻方式**：图表联动 → 过滤器（country、dt、mo）变化 → 刷新明细表；或通过 `dim_osm_country_relation` 的 parent_id/adm_level 实现国家→省市级下钻；明细表（satellite_images、o_road、gps_trace_data、street_views）分页展示。

### 4.4 性能与索引
- **已有索引**（详见《20260203_BI展示技术方案_crawler_db数据源调研.md》）：边界表已建 `geom`(GIST)、`country_code3`/`country_name`；`crawler_tile_all`、`app_*` 等统计表多为按主键/唯一键查询；`satellite_images` 有 `udx_tile_z_x_y`、`extent`(GIST)；`gps_trace_data` 有 `trace_id`、`geom`(GIST)、`crawl_time`。Superset 查询应尽量带 `country`/`dt`/`mo` 等过滤以利用索引。
- **明细表**：`satellite_images`、`o_road`、`gps_trace_data`、`street_views` 等下钻列表需限制行数或分页，避免全表扫描。
- **Superset**：合理使用缓存与查询超时/限流；地图图层可对几何做简化或按视野范围裁剪。

### 4.5 权限与安全
- **PostgreSQL**：通过 RLS 或视图按国家/来源做行级隔离；敏感字段可做脱敏或权限视图。
- **Superset**：配置角色与行级权限（RLS），与 PG 权限模型对齐。

### 4.6 Superset 平台设计

本节给出 Superset 的部署方式（本地 Docker Compose 测试、生产 K8s）、数据集（Datasets）清单、图表（Charts）类型与配置、看板（Dashboards）组成与布局及数据联动方式，便于实施与运维。

#### 4.6.1 部署方案

##### 4.6.1.1 本地 Docker Compose 部署（测试）

用于本地或测试环境快速启动 Superset，连接已有 PostgreSQL（或同 compose 内 PG）。

**目录与文件**：建议在项目下建 `superset/docker-compose.yml` 及可选 `superset/.env`。

**docker-compose.yml 示例**：

```yaml
services:
  superset:
    image: apache/superset:6.0.0-dev
    container_name: superset
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "8088:8088"
    volumes:
      - superset_home:/app/superset_home
      - superset_config:/app/superset_config
    networks:
      - maptech
    command: >
      sh -c "
        superset db upgrade &&
        superset fab create-admin --username admin --firstname Admin --lastname User --email admin@example.com --password admin || true &&
        superset init &&
        gunicorn --bind 0.0.0.0:8088 --access-logfile - --error-logfile - --workers 4 --worker-class gthread --threads 20 --timeout 120 'superset.app:create_app()'
      "

volumes:
  superset_home:
  superset_config:

networks:
  maptech:
    driver: bridge
```

**.env 示例**：

```dotenv
# Flask 密钥，用于加密会话和 CSRF 令牌，长度至少 32 位
SUPERSET_SECRET_KEY=K7Gqn27vwQD1lHknch0Qm8AA9xVbYa6MqCVynZ2eqNelINtnWNFCFowez8riXmCa

SUPERSET_LOAD_EXAMPLES=yes
SUPERSET_WEBSERVER_PORT=8088

# Superset 元数据库配置
# PostgreSQL 数据库类型
DATABASE_DIALECT=postgresql
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_DB=superset
DATABASE_USER=superset
DATABASE_PASSWORD=xxxxxxxxxxxxxxxx

# Redis 缓存配置
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```


**说明**：

1. **PostgreSQL 配置**：
   - 用于存储 Superset 元数据（用户、角色、仪表板配置等）
   - 建议使用独立数据库实例或与业务数据同集群不同库
   - 生产环境需配置强密码并启用 SSL
   - `DATABASE_NAME` 需提前创建好数据库

2. **Redis 缓存配置**：
   - 用于加速查询结果、仪表板渲染和异步任务处理
   - 生产环境建议启用密码认证和持久化
   - 与 Superset 应用保持低延迟网络连接
   - 可与现有 Redis 集群复用，也可单独部署


##### 4.6.1.2 生产 K8s 部署方案

生产环境建议将 Superset 部署在 Kubernetes，与现有 PG 同网或可访问，并配置 Ingress、资源限制与密钥管理。

**资源清单要点**：

| 资源类型 | 说明 |
|----------|------|
| **Deployment** | Superset 应用，单副本或多副本；镜像 `apache/superset:latest` 或自建 tag；环境变量从 ConfigMap/Secret 注入；挂载 `superset_config.py`（ConfigMap）及可选 `superset_home`（PVC）。 |
| **Service** | ClusterIP 或 NodePort，暴露 8088；若需异步任务再部署 Celery Worker + Beat。 |
| **ConfigMap** | `superset_config.py` 片段（如 FEATURE_FLAGS、CACHE 配置、MAPBOX_TOKEN 等）、非敏感配置。 |
| **Secret** | `SUPERSET_SECRET_KEY`、数据库连接串（或单独 DB Secret）、Redis 密码等。 |
| **Ingress** | 对外暴露 HTTPS，域名如 `superset.xxx.com`；配置 TLS 与后端 Service。 |
| **PVC** | 可选，用于 `superset_home` 持久化（上传文件、日志等）。 |

**典型配置**：

- **数据库**：`SQLALCHEMY_DATABASE_URI` 使用 K8s Secret 中的连接串，指向 Superset 元数据库（可与 BI 业务 PG 同集群不同库）。
- **Redis**：若集群内已有 Redis，`REDIS_HOST`/`CELERY_BROKER_URL`/`DATA_CACHE_CONFIG` 指向该服务；否则单独部署 Redis 或使用云厂商 Redis。
- **Celery**（可选）：需定时刷新缓存或异步查询时，部署 Celery Worker + Beat，与 Web 共用 `CELERY_BROKER_URL` 与 Superset 配置。
- **资源**：建议 request/limit 如 `memory: 1Gi`、`cpu: 500m` 起步，按压测调整。
- **健康检查**：liveness/readiness 探针指向 `:8088/health` 或 `:8088/api/v1/`。

**数据源**：在 Superset 中配置的「Database」指向业务 PG（表清单与结构详见《20260203_BI展示技术方案_crawler_db数据源调研.md》），连接信息建议存 K8s Secret，通过环境变量或 init 脚本注入；或由运维在 Superset 界面一次性配置并导出为备份。

---

#### 4.6.2 数据集（Datasets）

Superset 中「Dataset」对应一个可查询的物理表或虚拟 SQL，用于生成图表。下表列出建议创建的数据集、来源类型（表 / SQL）、主要字段及用途。

| 序号 | 数据集名称 | 来源类型 | 来源（表名或 SQL 说明） | 主要字段/说明 | 用途 |
|------|------------|----------|--------------------------|----------------|------|
| DS01 | ds_coverage_by_country | SQL | crawler_tile_all + gadm_country_boundary JOIN | country_code3, **country**, country_name, **geom**, total_count, google_map_count, google_earth_count | 覆盖热力与国家边界面（含几何，原 DS02 已合并入）；详见**附录 B.1.3.1** |
| DS03 | ds_crawler_tile_all | Table | crawler_tile_all | country, type, dt, count_nums | 覆盖统计柱状/趋势 |
| DS04 | ds_satellite_images | Table | satellite_images | id, file_path, coordinate_z, coordinate_x, coordinate_y, extent, provider, capture_date | 影像覆盖点/面、下钻 |
| DS05 | ds_dem_tiles | Table | dem_tiles_data | id, tile_id, level, geom, source_name | DEM 覆盖点/面 |
| DS06 | ds_osm_road_length | Table | app_osm_road_length | mo, country_code, road_subtype, road_length_km | 道路长度柱状/趋势 |
| DS07 | ds_osm_road_length_all | Table | app_osm_road_length_all | mo, country_code, open_road, close_road, total_road | 道路全量趋势 |
| DS08 | ds_foursquare_poi | Table | app_foursquare_places_d | country_alpha3, date_refreshed, level1_category_name, poi_count, is_closed | POI 柱状/饼图/趋势 |
| DS09 | ds_osm_address | Table | app_osm_address_info | country, count_nums | 地址统计 |
| DS10 | ds_road_compare | Table | road_overture_osm_compare_m | country, overture_total, osm_total, matched_count, match_rate | Overture vs OSM 对比 |
| DS11 | ds_population | Table | dw_osm_population_info | country, countryname, provincename, population, sourcepop | 人口统计 |
| DS12 | ds_overture_population | Table | overture_area_population | country, subtype, subtype_cn, area, population | Overture 区域人口 |
| DS13 | ds_country_dim | Table | dim_country | id, alpha2_code, alpha3_code, short_name, full_name | 筛选器/名称解析 |
| DS14 | ds_osm_country_relation | Table | dim_osm_country_relation | id, area_name_en, area_name_cn, parent_id, adm_level, country_code_alpha2 | 下钻层级/筛选 |
| DS15 | ds_satellite_detail | SQL | 见下方 SQL | 下钻明细，带分页限制 | 下钻列表 |

**DS01（覆盖热力与边界合一）**：`crawler_tile_all` + `gadm_country_boundary` JOIN，同时提供 **geom**（国家边界面）与覆盖指标；原 DS02 已合并入，不再单独建边界数据集。SQL、输出列、Superset 配置等详见**附录 B.1.3.1**。

**DS15（卫星影像下钻明细，限制行数）SQL 示例**：

```sql
SELECT id, file_path, coordinate_z, coordinate_x, coordinate_y, provider, resolution, capture_date, extent
FROM satellite_images
WHERE 1=1
  AND (CASE
    WHEN TRIM('{{ date_from }}') = '' OR TRIM('{{ date_from }}') = '{{ date_from }}' THEN true
    ELSE capture_date >= (TRIM('{{ date_from }}'))::timestamptz
  END)
  AND (CASE
    WHEN TRIM('{{ date_to }}') = '' OR TRIM('{{ date_to }}') = '{{ date_to }}' THEN true
    ELSE capture_date <= (TRIM('{{ date_to }}'))::timestamptz
  END)
ORDER BY capture_date DESC
LIMIT 1000
```

（`date_from`、`date_to` 由看板 Native Filter 传入。说明：`satellite_images` 表无 `country` 列，若需按国家过滤，需与边界表做空间 JOIN，例如 `JOIN gadm_country_boundary g ON ST_Intersects(satellite_images.extent, g.geom) AND g.country_code3 = '{{ country }}'`，并注意性能与行数限制。）

---

#### 4.6.3 图表（Charts）

下表列出建议创建的图表、类型、所用数据集、配置要点及可选 SQL。

| 图表 ID | 图表名称 | 图表类型 | 数据集 | 配置要点（维度/指标/过滤） | 可选 SQL / 说明 |
|---------|----------|----------|--------|----------------------------|------------------|
| CH01 | 覆盖热力-国家面 | Deck.gl - Polygon | **DS01** | 几何列：geom；颜色/权重：total_count；实体/Emit 列：country；筛选：dt, type（均来自 DS01，DS02 已合并入 DS01） | 指标选 total_count，Tooltip 可加 google_map_count、google_earth_count |
| CH02 | 覆盖量-按国家柱状 | Bar Chart | DS03 | X：country；Y：count_nums（Sum）；Group by：type；Filter：dt | — |
| CH03 | 覆盖量-按日期趋势 | Line Chart | DS03 | X：dt；Y：count_nums（Sum）；Series：country 或 type；Filter：country, type | — |
| CH04 | 卫星影像覆盖点/面 | Deck.gl - Geojson 或 Point | DS04 | 几何：extent；Tooltip：coordinate_z, provider, capture_date；Filter：country, capture_date | 数据量大时用 WHERE 限制或采样 |
| CH05 | DEM 瓦片覆盖 | Deck.gl - Polygon/Point | DS05 | 几何：geom；Tooltip：tile_id, level, source_name | — |
| CH06 | 道路长度-按国家/类型 | Bar Chart | DS06 | X：country_code；Y：road_length_km（Sum）；Group：road_subtype；Filter：mo | — |
| CH07 | 道路长度-趋势 | Line Chart | DS07 | X：mo；Y：total_road（Sum）；Series：country_code | — |
| CH08 | POI 数量-按国家/分类 | Bar Chart | DS08 | X：country_alpha3 或 level1_category_name；Y：poi_count（Sum）；Filter：date_refreshed, is_closed | — |
| CH09 | POI 分类占比 | Pie Chart | DS08 | 维度：level1_category_name；指标：poi_count（Sum）；Filter：country_alpha3, date_refreshed | — |
| CH10 | Overture vs OSM 道路对比 | Bar Chart | DS10 | X：country；Y：overture_total, osm_total, matched_count；或双轴 match_rate | — |
| CH11 | 人口分布-按国家 | Bar Chart | DS11 或 DS12 | X：country 或 countryname；Y：population（Sum）；Filter：provincename | — |
| CH12 | 卫星影像下钻明细表 | Table | DS15 | 列：id, file_path, coordinate_z, coordinate_x, coordinate_y, provider, capture_date；Filter：country, date_from, date_to；分页 | 依赖 DS15 的 Template 参数 |
| CH13 | 国家筛选器 | Filter Box / Native Filter | DS13 或 DS14 | 筛选项：country（alpha2/alpha3 或 area_name）；可多选 | 与看板其他图表联动 |

**图表类型与字段对应关系小结**：

- **Deck.gl Polygon/Geojson**：需数据集含几何列（geom/extent），选「Spatial」列做 geometry；颜色/大小可绑指标列。
- **Bar/Line/Pie**：维度选列（如 country, dt, mo），指标选聚合（Sum/Count）。
- **Table**：选列即可；过滤与分页由数据集 SQL 或 Native Filter 控制。
- **Native Filter**：绑定到维度列（如 country, dt, type），勾选「Cross-filter」后可与同看板图表联动。

---

#### 4.6.4 看板（Dashboards）与布局、数据联动

##### 4.6.4.1 看板清单与组成

| 看板 ID | 看板名称 | 用途 | 由哪些图表组成 |
|---------|----------|------|----------------|
| DB01 | 采集覆盖总览 | 全球覆盖热力、按国家/类型/日期统计、趋势 | CH01, CH02, CH03, CH13（国家/类型/日期筛选） |
| DB02 | 覆盖下钻与明细 | 影像/DEM 覆盖分布 + 卫星影像下钻明细表 | CH04, CH05, CH12, CH13（国家/日期范围） |
| DB03 | 道路与 POI 分析 | 道路长度、POI 数量与分类、Overture vs OSM | CH06, CH07, CH08, CH09, CH10, CH13 |
| DB04 | 人口与综合指标 | 人口分布、与区域维度联动 | CH11, CH13 及可选 CH02 |

##### 4.6.4.2 布局建议

- **DB01（采集覆盖总览）**  
  - 第 1 行：Native Filter（国家、类型、日期 dt）占一整行。  
  - 第 2 行：CH01（覆盖热力-国家面）大图，占 12 列。  
  - 第 3 行：CH02（按国家柱状）6 列 + CH03（按日期趋势）6 列。  

- **DB02（覆盖下钻与明细）**  
  - 第 1 行：Native Filter（国家、date_from、date_to）。  
  - 第 2 行：CH04（卫星影像覆盖）8 列 + CH05（DEM 瓦片）4 列。  
  - 第 3 行：CH12（卫星影像下钻明细表）12 列，表格可占多行高度。  

- **DB03（道路与 POI）**  
  - 第 1 行：Native Filter（国家、月份 mo、日期 date_refreshed）。  
  - 第 2 行：CH06、CH07 各 6 列。  
  - 第 3 行：CH08、CH09 各 6 列。  
  - 第 4 行：CH10 占 12 列。  

- **DB04（人口与综合）**  
  - 第 1 行：Native Filter（国家等）。  
  - 第 2 行：CH11 占 12 列；可选 CH02 做对比。  

（Superset 网格为 12 列，可依实际拖拽微调。）

##### 4.6.4.3 数据联动

- **Native Filter 联动**：所有看板使用「Native Filter」组件，绑定维度列（如 country, dt, type, mo, date_refreshed）。在 Filter 上勾选 **Cross-filter**（或「Scoping」中勾选要联动的图表），则选择国家/日期/类型后，该看板内所有勾选联动的图表自动带相同过滤条件重新查询。  
- **图表 → 图表**：若需「点击热力图上某国家再驱动明细表」，可用 **Cross-filter**：CH01 的维度列（如 country_code3）设为「Emit filter when clicked」，目标图表 CH12 勾选接收该 Cross-filter；或同一看板内统一依赖同一批 Native Filter，通过筛选器联动。  
- **参数传递**：DS01/DS15 的 SQL 中 `{{ dt }}`、`{{ country }}`、`{{ date_from }}`/`{{ date_to }}` 对应 Superset 的「Filter」或「Template parameters」，在数据集「Edit」中声明参数名与类型，在看板里将 Native Filter 映射到该参数即可。

按上述步骤配置后，即可在本地 Docker Compose 验证数据源、数据集、图表与看板，再在生产 K8s 中部署同一套配置（可通过 Superset 导出/导入 YAML 或备份元数据库做迁移）。

### 4.7 前端集成（Embedded SDK）

本节说明如何将 Superset 看板**嵌入到业务前端**，实现统一导航与统一登录，用户无需单独访问 Superset 或二次登录。采用 **Superset Embedded SDK** 方式，由业务后端签发 **Guest Token**，前端通过 SDK 挂载看板 iframe 并完成鉴权。

#### 4.7.1 选型说明

| 方式 | 说明 | 与本方案 |
|------|------|----------|
| **Embedded SDK** | 使用 `@superset-ui/embedded-sdk` 在前端页面挂载仪表盘，后端提供 Guest Token，SDK 负责 iframe 与鉴权 | **已采用** |
| iframe 直嵌 | 直接 iframe 嵌 Superset 看板 URL，需单独解决登录或带参 URL | 不采用 |

采用 Embedded SDK 后，看板作为业务前端的一个**路由/区块**呈现，导航、布局、登录体系由业务系统统一管理，仅图表区域由 Superset 渲染。

#### 4.7.2 鉴权与 Guest Token 流程

```mermaid
sequenceDiagram
  participant U as 用户
  participant F as 业务前端
  participant B as 业务后端
  participant S as Superset

  U->>F: 访问 BI 看板页
  F->>B: 请求 Guest Token（当前用户/看板 ID）
  B->>S: POST /api/v1/security/guest_token（带 API Key 或服务账号）
  S-->>B: 返回 guest_token (JWT)
  B-->>F: 返回 guest_token
  F->>F: embedDashboard({ fetchGuestToken, ... })
  F->>S: 加载看板 iframe（携带 guest_token）
  S-->>F: 渲染看板
  F-->>U: 展示看板
```

- **业务后端**：在用户访问 BI 看板页时，根据当前登录用户与要展示的看板 ID，向 Superset 的 `POST /api/v1/security/guest_token` 发起请求（需使用具备 `can_grant_guest_token` 权限的 Superset 账号或 API Key），获取 JWT 格式的 `guest_token`，再下发给前端。
- **业务前端**：使用 Embedded SDK 的 `embedDashboard`，在 `fetchGuestToken` 回调中调用后端接口取得 `guest_token` 并返回；SDK 会将 token 传给 Superset 的 iframe，完成嵌入式鉴权，用户无需在 Superset 登录。

#### 4.7.3 前端集成步骤

**1. 安装依赖**

```bash
npm install --save @superset-ui/embedded-sdk
```

**2. 封装看板嵌入组件（示例）**

```javascript
import { embedDashboard } from "@superset-ui/embedded-sdk";

export function embedBiDashboard(options) {
  const {
    dashboardId,
    supersetDomain,
    mountPoint,
    fetchGuestToken,
    hideTitle = true,
    hideTab = true,
    hideChartControls = false,
  } = options;

  return embedDashboard({
    id: dashboardId,
    supersetDomain,
    mountPoint,
    fetchGuestToken,
    dashboardUiConfig: {
      hideTitle,
      hideTab,
      hideChartControls,
      filters: { expanded: true },
      urlParams: {},
    },
  });
}
```

**3. 页面使用示例**

- 在业务前端的「BI 看板」路由下，预留一个容器节点（如 `div#superset-dashboard-root`）。
- 页面加载时：先调用业务后端接口获取 Guest Token（后端再请求 Superset `/api/v1/security/guest_token`），再调用 `embedBiDashboard`，将 `mountPoint` 指向该容器，`fetchGuestToken` 返回后端下发的 token。
- 若看板 ID 随路由变化（如 `/bi/dashboard/:id`），则根据路由参数传入对应 `dashboardId`。

**4. 后端接口职责（建议）**

- 提供接口例如 `GET /api/bi/guest_token?dashboard_id=xxx`。
- 校验当前用户是否有权查看该看板（可选：与业务角色/权限中心对齐）。
- 使用具备 `can_grant_guest_token` 的 Superset 服务账号或 API Key，向 Superset 请求 Guest Token（请求体包含 `user`、`resources`、`rls` 等，见 Superset 文档），将返回的 `token` 再返回给前端。
- 建议对 Guest Token 请求做频率限制与审计。

#### 4.7.4 Superset 侧配置

- **启用嵌入式**：在 Superset 的 `superset_config.py`（或环境变量）中开启嵌入式能力，例如：
  - `FEATURE_FLAGS = { "EMBEDDED_SUPERSET": True }`（具体 flag 名以当前 Superset 版本文档为准）。
- **Guest Token 密钥**：配置 `GUEST_TOKEN_JWT_SECRET` 或等价配置，用于签发/校验 Guest Token，需与 Superset 版本要求一致且妥善保管。
- **CORS**：若前端与 Superset 不同域，需在 Superset 侧配置允许业务前端域名（如 `WEBDRIVER_BASEURL`、CORS 白名单等，以当前版本文档为准）。
- **看板/图表权限**：在 Superset 中为「Guest」或嵌入式角色配置可访问的看板与数据集，确保 Guest Token 仅能访问允许的资源；结合 RLS 可实现行级数据隔离。

#### 4.7.5 看板与图表配色方案

- **看板级**：编辑看板 → 右上角「编辑仪表板」→ 左侧「Dashboard 属性」→ **ADVANCED** 中的 `json_metadata` 可配置：
  - `color_scheme`：如 `"supersetColors"` 或自定义方案 id（需在服务端注册）。
  - `color_scheme_domain`：看板内图表共用的颜色列表（十六进制数组），如 `["#1FA8C9","#454E7C",…]`。
  - `shared_label_colors`：按维度值固定颜色，如 `{"google_map":"#1FA8C9","google_earth":"#5AC189"}`。
  - `label_colors`：按图表/指标指定颜色，格式见 Superset 文档。
- **单图表**：编辑图表 → **Customize** / **Chart Options** → **Color Scheme** 或 **Colors** 选择/自定义色板；部分图表类型支持「指标/维度」与颜色列绑定。
- **服务端统一色板**：在 `superset_config.py` 中配置 `EXTRA_CATEGORICAL_COLOR_SCHEMES`（分类色板）、`EXTRA_SEQUENTIAL_COLOR_SCHEMES`（连续/渐变色板），在看板或图表中即可选用对应方案。例如全球采集覆盖热力图若需「蓝（冷）→ 红（热）」渐变，可新增 sequential 方案并在图表中选用：
  ```python
  EXTRA_SEQUENTIAL_COLOR_SCHEMES = [
      {
          "id": "blue_to_red",
          "label": "蓝→红（冷→热）",
          "colors": ["#2166ac", "#4393c3", "#92c5de", "#d1e5f0", "#fddbc7", "#f4a582", "#d6604d", "#b2182b", "#67001f"],
      }
  ]
  ```
  图表「Customize」→ Country Color Scheme 选该方案即可。

#### 4.7.6 安全与注意点

- **Guest Token 有效期**：Superset 签发 Guest Token 时可设置过期时间，建议设为较短（如 5–15 分钟），由前端在过期前通过 `fetchGuestToken` 再向业务后端申请新 token。
- **不暴露 Superset 管理员账号**：业务后端请求 Guest Token 时使用**专用服务账号**或 API Key，且仅授予 `can_grant_guest_token` 及必要资源权限，不在前端或公网暴露 Superset 管理员密码。
- **HTTPS**：生产环境 Superset 与业务前端均使用 HTTPS，避免 token 在传输中被窃取。
- **审计**：对业务后端的 Guest Token 申请做日志与审计，便于合规与安全排查。



---

## 5. 实施计划与里程碑

| 阶段 | 内容 | 产出 |
|------|------|------|
| P0 | 对照《20260203_BI展示技术方案_crawler_db数据源调研.md》确认 PG 表与索引就绪；需 H3 热力时补充 `bi_coverage_h3` | 数据层就绪 |
| P1 | 按 **4.1.3** 与《20260203_BI展示技术方案_crawler_db数据源调研.md》配置 Superset 数据源与数据集；搭建覆盖热力（crawler_tile_all + gadm_country_boundary）+ 下钻明细看板 | 核心看板上线 |
| P2 | 按《20260203_BI展示技术方案_crawler_db数据源调研.md》扩展主题页：道路（app_osm_road_length 等）、POI（app_foursquare_places_d）、人口（dw_osm_population_info、overture_area_population）、土地/水系等 | 多主题看板 |
| P3 | 权限与性能调优（RLS、索引与过滤条件），文档与运维说明 | 稳定交付 |

---

## 6. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 明细表数据量过大导致查询慢 | 下钻卡顿、超时 | 只保留近 N 天或采样；下钻优先走聚合表，明细仅展示分页结果 |
| 边界数据缺失或不匹配 | 热力图区域不准 | 统一采用 GADM 或 GeoBoundaries 的国家/省市边界，维表与边界表一致 |
| 同步延迟或失败 | 看板数据滞后 | 同步任务监控与告警；关键表配置重试与幂等 |

---

## 7. 交付物

- Superset 数据源与数据集配置说明。
- 覆盖热力图与下钻明细看板（含筛选与下钻逻辑）。
- 主题分析页（道路、POI、人口、土地、水系等）清单与配置要点。
- 数据同步作业说明（表、频率、依赖）。

## 附录

> 说明：为保持主方案精简，原数据源细节附录（表清单/字段/样例）已迁移到外部调研文档维护，本方案仅保留引用说明与实施规划附录。

## 附录 A：数据源表信息说明

为保持方案文档精简，`crawler_db` 的表清单、字段结构、数据样例与 Superset 报表可用性评估，统一维护在《20260203_BI展示技术方案_crawler_db数据源调研.md》。

---

## 附录 B：看板详细实施规划

> **参考**：本规划整合 DB01~DB04 四个看板的详细实施规划，各看板参照 Superset 示例看板 *World Bank's Data*（dashboard_id=3）的图表组合风格进行设计，完整匹配 crawler_db 现有表结构，可按以下步骤直接在 Superset 中创建。

---

### B.1 DB01 采集覆盖总览——详细实施规划

#### B.1.1 看板定位与目标

| 项目 | 说明 |
|------|------|
| 看板名称 | 采集覆盖总览 |
| 看板 ID（规划） | DB01 |
| 数据源 | crawler_db（PostgreSQL，Database ID: 1） |
| 核心问题 | ① 全球哪些国家/地区已有采集覆盖？量级如何？② 各采集类型（type）贡献占比？③ 覆盖量随时间（dt）如何变化？④ 哪些国家覆盖量 Top N？ |
| 刷新频率 | 日级（与 crawler_tile_all 同步周期一致） |

---

#### B.1.2 涉及表与字段速查

| 表名 | 关键字段 | 用途 |
|------|----------|------|
| `crawler_tile_all` | country(varchar 3), type, dt, count_nums | 覆盖量统计，全部图表数据来源 |
| `gadm_country_boundary` | country_code3, country_code2, country_name, geom(MultiPolygon), level | 国家边界几何，用于世界地图着色 |
| `dim_country` | alpha2_code, alpha3_code, short_name | 国家名称解析，用于筛选器友好显示 |
| `dim_country_name` | country(代码), name | 备用名称字典（若 dim_country 缺失条目） |

> **关联说明**（已确认）：`crawler_tile_all.country` 存储的是 **3 字母 ISO 代码**（ARE、ARG、USA 等），直接与 `gadm_country_boundary.country_code3` 等值关联即可，无需 country_code2 兜底。

---

#### B.1.3 数据集规划

##### B.1.3.1 DS-DB01-01：覆盖热力与国家边界面（对应主方案 DS01）

| 项目 | 说明 |
|------|------|
| **对应主方案** | **DS01**（覆盖热力与边界合一）；原 DS02（gadm_country_boundary 单表）已合并入本数据集 |
| **类型** | Virtual Dataset（SQL） |
| **数据集名称** | `ds_db01_coverage_world_map` |
| **定位** | 唯一同时提供**国家边界几何（geom）与覆盖指标**的数据集；CH01（全球采集覆盖热力图）的唯一数据源，替代原 DS02 单表边界 |
| **依赖表** | `crawler_tile_all`（覆盖量统计）、`gadm_country_boundary`（国家边界几何） |

**输出列**

| 列名 | 类型 | 来源 | 说明 |
|------|------|------|------|
| country_code3 | varchar(3) | gadm_country_boundary.country_code3 | 国家 3 字母 ISO 代码（原始值） |
| country | varchar(3) | `g.country_code3 AS country` | **与 DS-DB01-02 列名一致**，供地图 Emit Cross-filter 使用；若列名不同则点击地图后其他图表不会过滤 |
| country_name | varchar | gadm_country_boundary.country_name | 国家中/英文名称，用于 Tooltip 展示 |
| geom | geometry(MultiPolygon) | gadm_country_boundary.geom | 国家边界多边形，Superset 中标记为 **Spatial（Geometry）** |
| google_map_count | bigint | `SUM(CASE WHEN type='google_map' ...)` | google_map 类型采集量 |
| google_earth_count | bigint | `SUM(CASE WHEN type='google_earth' ...)` | google_earth 类型采集量 |
| total_count | bigint | `SUM(count_nums)` | 两种类型合计采集量，作为地图着色主指标 |

**SQL**

```sql
-- ds_db01_coverage_world_map
-- crawler_tile_all.country 为 3 字母 ISO 代码，直接与 country_code3 关联
-- gadm_country_boundary.level=0 对应国家级（共 263 条），level 1-4 为省/市/区/村级
-- 必须输出 country 列（与 DS-DB01-02 列名一致），供 Cross-filter 使用
SELECT
    g.country_code3,
    g.country_code3 AS country,
    g.country_name,
    g.geom,
    COALESCE(c.google_map_count,   0) AS google_map_count,
    COALESCE(c.google_earth_count, 0) AS google_earth_count,
    COALESCE(c.total_count,        0) AS total_count
FROM gadm_country_boundary g
LEFT JOIN (
    SELECT
        country,
        SUM(count_nums)                                          AS total_count,
        SUM(CASE WHEN type = 'google_map'   THEN count_nums END) AS google_map_count,
        SUM(CASE WHEN type = 'google_earth' THEN count_nums END) AS google_earth_count
    FROM crawler_tile_all
    GROUP BY country
) c ON g.country_code3 = c.country
WHERE g.level = 0
```

**Superset 数据集配置**

| 配置项 | 操作 |
|--------|------|
| `geom` 列 | Edit Dataset → Columns → 将 `geom` 的 Type 改为 **Spatial（Geometry）** |
| 默认指标 | 将 `total_count` 设为默认聚合指标（SUM） |
| `country` 列 | 标记为 **Dimension**（维度），用于 Cross-filter 实体/Emit 列 |
| `country_name` 列 | 标记为 **Dimension**，用于 Tooltip 展示 |
| `google_map_count`/`google_earth_count` 列 | 标记为 **Metric-ready**，可直接作为 Tooltip 追加指标 |

**Filters & Controls 配置**

| 配置项 | 说明 |
|--------|------|
| **Cross-filter（Emit）** | CH01 勾选 **Emit filter when clicked**，Emit 列选 **`country`**（不可选 country_code3），与 DS-DB01-02 列名一致 |
| **时间/类型筛选** | 可选：在子查询 WHERE 中增加 `AND (dt = '{{ dt }}' OR '{{ dt }}' = '')` 和 `AND (type = '{{ type }}' OR '{{ type }}' = '')`，在 Superset 数据集 Edit → Parameters 中声明 `dt`、`type` 为 Template parameters，由 Native Filter 映射 |
| **无传参等价全量** | 子查询不加 WHERE 条件时，输出所有日期和类型的汇总值 |

**已确认事项**（基于实际数据核实）

| # | 确认项 | 结论 |
|---|--------|------|
| 1 | `crawler_tile_all.country` 代码格式 | 3 字母 ISO 代码，JOIN 条件 `g.country_code3 = c.country` 正确 |
| 2 | `gadm_country_boundary.level` 国家级别 | `level = 0` 共 263 条（国家级），`WHERE g.level = 0` 过滤正确 |
| 3 | `type` 枚举值 | 仅 `google_map` / `google_earth` 两个值，按 type 分列展开无遗漏 |
| 4 | 无需 country_code2 兜底 | 3 字母 JOIN 已全覆盖，去掉 `OR g.country_code2 = c.country` |

##### B.1.3.2 DS-DB01-02：覆盖量统计（纯数值，用于其余图表）

- **类型**：Table Dataset（物理表直连）
- **数据集名称**：`ds_db01_crawler_tile_all`
- **来源**：`crawler_tile_all`

| 字段 | 类型 | 含义 |
|------|------|------|
| country | varchar(3) | 国家代码，3 字母 ISO（维度） |
| type | varchar(100) | 采集类型，枚举：`google_map` / `google_earth`（维度） |
| dt | varchar(100) | 日期分区，格式 `YYYYMMDD`，如 `20260101`（时间轴） |
| count_nums | integer | 采集量（指标，SUM） |

> **配置说明**（已基于实际数据确认）：
> - `dt` 列：标记为 **Temporal** 类型，格式 `%Y%m%d`；
> - `count_nums` 列：默认聚合设为 `SUM`；
> - `type` 筛选器：枚举值仅 2 个（`google_map` / `google_earth`），建议 Native Filter 使用 **Radio** 控件，比多选下拉更简洁。

---

#### B.1.4 图表规划

DB01 规划 **9 张图表 + 1 组筛选器**。

| 图表 ID | 图表名称 | Superset 图表类型 | 数据集 | 主要配置 | 说明 |
|---------|----------|-------------------|--------|----------|------|
| CH-DB01-01 | 全球采集覆盖热力图 | `world_map` | DS-DB01-01 | 实体列：**country**；颜色列：total_count；Tooltip：country_name, google_map_count, google_earth_count；**Emit cross filter 列选 country** | 全球视角世界地图，按 total_count 着色；点击某国触发 Cross-filter，驱动国家详情地图、明细表及其余图表联动 |
| CH-DB01-02 | 总采集量 KPI | `big_number_total` | DS-DB01-02 | 指标：SUM(count_nums)；副标题：「全量采集瓦片数」 | — |
| CH-DB01-03 | 覆盖国家数 KPI | `big_number_total` | DS-DB01-02 | 指标：COUNT_DISTINCT(country)；副标题：「已覆盖国家/地区数」 | — |
| CH-DB01-04 | 采集量按时间趋势 | `echarts_area` | DS-DB01-02 | X：dt（Temporal）；Y：SUM(count_nums)；Series：type；堆叠面积 | — |
| CH-DB01-06 | 类型覆盖量 Treemap | `treemap_v2` | DS-DB01-02 | 分组：type；指标：SUM(count_nums)；颜色渐变 | — |
| CH-DB01-08 | 国家覆盖量排行榜 | `table` | DS-DB01-02 | 列：country, type, SUM(count_nums) 采集量；按采集量降序；分页 20 行；启用条形图列 | — |
| CH-DB01-09 | 采集明细下钻表 | `table` | DS-DB01-02 | 列：country, type, dt, count_nums；按 dt 降序；分页 50 行；启用搜索 | 接收 Cross-filter / Native Filter 过滤；点击世界地图某国后仅显示该国按日期的明细行 |
| **CH-DB01-10** | **国家详情地图** | **`deck_geojson`** | **DS-DB01-01** | GeoJSON 列：**geojson**（`ST_AsGeoJSON(g.geom)`）；fill_color 半透明青色；底图 mapbox light | **接收** world_map Cross-filter / Native Filter；筛选国家后仅渲染该国边界多边形 |
| CH-DB01-F | 筛选器组 | Native Filter | DS-DB01-02 | 筛选项：采集类型 type **Radio**、国家 country 多选搜索；勾选 Cross-filter；**isInstant: true** | — |

**下钻交互流程（world_map → deck_geojson + 明细表）**

```mermaid
flowchart LR
  A[用户点击 world_map 某国家] --> B[CH-DB01-01 Emit Cross-filter<br/>country = 选中国家]
  B --> C[CH-DB01-10 deck_geojson<br/>仅渲染该国边界多边形]
  B --> D[KPI / 趋势 / Treemap<br/>联动过滤到该国]
  B --> E[CH-DB01-08 排行榜<br/>仅显示该国行]
  B --> F[CH-DB01-09 明细下钻表<br/>展示该国按 dt+type 的明细行]
  F --> G[用户可进一步<br/>用 Native Filter 筛选 type]
```

> **deck_geojson 说明**：使用 `deck_geojson`（Deck.gl GeoJSON 图层）替代 `country_map`。原因：`country_map` 的 `select_country` 是静态配置参数，无法被 Cross-filter 动态切换。`deck_geojson` 直接渲染 DS-DB01-01 的 `geojson` 列（由 `ST_AsGeoJSON(g.geom)` 生成），当 Cross-filter 或 Native Filter 过滤到某国时，查询仅返回该国数据行，地图自然只渲染对应国家的边界多边形。

---

#### B.1.5 看板布局

Superset 网格 12 列。看板分为 **ROW_1**（统计总览区）、**ROW_2**（国家下钻区：deck_geojson + 明细表）两个顶层行。

**视觉布局**

```
┌─────────────────── ROW_1 ────────────────────┬────────────┐
│ COLUMN_MAIN (w=9)                            │CHART_TABLE │
│ ┌─ ROW_A ──────────────────────────────────┐ │ (w=3)      │
│ │ COLUMN_KPI(w=2) │  CHART_MAP (w=7)       │ │ 国家覆盖   │
│ │ ┌─────────────┐ │  全球采集覆盖热力图     │ │ 量排行榜   │
│ │ │ KPI总采集量  │ │  world_map             │ │ (h=90)     │
│ │ │ (h=26)      │ │  [DS-DB01-01]          │ │[DS-DB01-02]│
│ │ ├─────────────┤ │  (h=54)                │ │            │
│ │ │ KPI覆盖国家 │ │  ↓ 点击国家            │ │            │
│ │ │ (h=26)      │ │  ↓ Cross-filter        │ │            │
│ │ └─────────────┘ │                        │ │            │
│ └─────────────────┴────────────────────────┘ │            │
│ ┌─ ROW_B ──────────────────────────────────┐ │            │
│ │ CHART_AREA (w=6)  │ CHART_TREEMAP (w=3)  │ │            │
│ │ 采集量按时间趋势   │ 采集类型覆盖量        │ │            │
│ │ [DS-DB01-02]       │ [DS-DB01-02]         │ │            │
│ │ (h=32)             │ (h=32)               │ │            │
│ └────────────────────┴─────────────────────┘ │            │
└──────────────────────────────────────────────┴────────────┘
                          ↓ Cross-filter 传递 country
┌──────────────────── ROW_2 ────────────────────────────────┐
│ CHART_COUNTRY_MAP (w=5)       │ CHART_DETAIL (w=7)        │
│ 国家详情地图 deck_geojson     │ 采集明细下钻表             │
│ [DS-DB01-01]                  │ [DS-DB01-02]               │
│ (h=50)                        │ country|type|dt|count_nums │
│ 显示选中国家行政区划轮廓      │ (h=50)                     │
│                               │ 该国按日期的明细行          │
└───────────────────────────────┴───────────────────────────┘
```

**position_json 节点结构**

| 节点类型 | 节点 ID | children | 宽度 | 高度 | chartId | 数据集 | 说明 |
|----------|---------|----------|------|------|---------|--------|------|
| ROOT | ROOT_ID | [GRID_ID] | — | — | — | — | 根节点 |
| GRID | GRID_ID | **[ROW_1, ROW_2]** | — | — | — | — | 两个顶层行 |
| HEADER | HEADER_ID | — | — | — | — | — | text: 采集覆盖总览 |
| ROW | ROW_1 | [COLUMN_MAIN, CHART_TABLE] | — | — | — | — | 统计总览区：左 9 列 + 右 3 列 |
| COLUMN | COLUMN_MAIN | [ROW_A, ROW_B] | 9 | — | — | — | 左侧主列 |
| ROW | ROW_A | [COLUMN_KPI, CHART_MAP] | — | — | — | — | 上区：KPI + world_map |
| COLUMN | COLUMN_KPI | [CHART_KPI_TOTAL, CHART_KPI_COUNTRY] | 2 | — | — | — | KPI 纵列 |
| CHART | CHART_KPI_TOTAL | [] | 2 | 26 | **105** | DS-DB01-02 | 总采集量 |
| CHART | CHART_KPI_COUNTRY | [] | 2 | 26 | **106** | DS-DB01-02 | 覆盖国家数 |
| CHART | CHART_MAP | [] | 7 | 54 | **104** | **DS-DB01-01** | 全球采集覆盖热力图（**world_map**，Emit Cross-filter） |
| ROW | ROW_B | [CHART_AREA, CHART_TREEMAP] | — | — | — | — | 下区：趋势 + Treemap |
| CHART | CHART_AREA | [] | 6 | 32 | **107** | DS-DB01-02 | 采集量按时间趋势 |
| CHART | CHART_TREEMAP | [] | 3 | 32 | **109** | DS-DB01-02 | 采集类型覆盖量 |
| CHART | CHART_TABLE | [] | 3 | 90 | **111** | DS-DB01-02 | 国家覆盖量排行榜（右侧全高） |
| ROW | **ROW_2** | **[CHART_COUNTRY_MAP, CHART_DETAIL]** | — | — | — | — | **国家下钻区**（新增） |
| CHART | **CHART_COUNTRY_MAP** | [] | 5 | 50 | **122** | **DS-DB01-01** | **国家详情地图**（deck_geojson，接收 Cross-filter）（新增） |
| CHART | **CHART_DETAIL** | [] | 7 | 50 | **123** | DS-DB01-02 | **采集明细下钻表**（新增） |

> **数据集说明**：
> - **DS-DB01-01**（对应主方案 DS01）：**CHART_MAP**（world_map）和 **CHART_COUNTRY_MAP**（deck_geojson）均使用，提供 geojson（`ST_AsGeoJSON(g.geom)` 国家边界面）+ 覆盖指标（total_count 等），详见 B.1.3.1。
> - **DS-DB01-02**（对应主方案 DS03）：其余 7 张图表（KPI、趋势、Treemap、排行榜、明细下钻表）均使用，物理表 `crawler_tile_all` 直连，详见 B.1.3.2。
> - 两个数据集通过 **`country`** 列名一致实现 Cross-filter 联动（详见 B.1.6）。

**下钻交互说明**

| 操作 | 触发 | 结果 |
|------|------|------|
| 点击 world_map 上某国家 | CHART_MAP Emit Cross-filter（country = 选中国家） | **CHART_COUNTRY_MAP 仅渲染该国边界多边形**；ROW_1 内 KPI/趋势/Treemap/排行 + ROW_2 明细表同步过滤到该国 |
| 再次点击同一国家（或点空白处） | 清除 Cross-filter | deck_geojson 恢复全部国家；其余图表恢复全量数据 |
| 通过 Native Filter 选择国家 | 筛选器联动 | 全部图表（含 world_map、deck_geojson、明细表）过滤到该国 |
| 通过 Native Filter 选择采集类型 | 筛选器联动 | 明细表仅显示该类型行；KPI/趋势/Treemap 同步过滤 |

**实施要点**

1. GRID_ID.children 为 `["ROW_1", "ROW_2"]`，ROW_1 保持现有统计总览结构不变。
2. **ROW_2** 为新增行，含 CHART_COUNTRY_MAP（w=5）+ CHART_DETAIL（w=7），共 12 列。
3. **CHART_MAP**（CH-DB01-01，world_map）保持不变，勾选 **Emit filter when clicked**，Emit 列为 **`country`**。
4. **CHART_COUNTRY_MAP**（CH-DB01-10，deck_geojson）接收 Cross-filter，使用 DS-DB01-01 的 `geojson` 列渲染国家边界多边形。筛选到某国后，查询仅返回该国数据行，地图自然只渲染对应国家。
5. **CHART_DETAIL**（CH-DB01-09）使用 DS-DB01-02，维度列 country + type + dt，指标列 count_nums，按 dt 降序、分页 50 行。
6. 两个新图表创建后，需将其 chartId 分别填入 ROW_2 和 Native Filter 的 chartsInScope 中。

**未选国家时国家详情地图与采集明细下钻表保持为空**

需求：当未在「国家」筛选器或世界地图上选择任何国家时，CH-DB01-10（国家详情地图）和 CH-DB01-09（采集明细下钻表）应显示为空，不展示全量数据。

实现思路：为上述两张图表使用**专用 Virtual Dataset**，在 SQL 中通过 Superset 的 Jinja 宏 `filter_values('country')` 判断是否有国家筛选；无选中时加 `WHERE 1=0` 使查询返回 0 行（需开启 ENABLE_TEMPLATE_PROCESSING）。世界地图、KPI、趋势等仍使用原 DS-DB01-01/02，不受影响。

| 图表 | 原数据集 | 专用数据集（需新建） | SQL 条件 |
|------|----------|----------------------|----------|
| CH-DB01-10 国家详情地图 | DS-DB01-01 (id=22) | ds_db01_country_map_require_country | 在原有 SQL 外包一层 sub，末尾加 `WHERE {% if filter_values('country') %} sub.country IN {{ filter_values('country') \| where_in }} {% else %} 1=0 {% endif %}` |
| CH-DB01-09 采集明细下钻表 | DS-DB01-02 (id=23) | ds_db01_detail_require_country | 在原有 SQL 末尾加 `WHERE {% if filter_values('country') %} c.country IN {{ filter_values('country') \| where_in }} {% else %} 1=0 {% endif %}` |

**手动操作步骤（在 Superset 界面完成）**：

1. **Data → Datasets → + Dataset → Virtual**，创建 `ds_db01_country_map_require_country`：
   - Database：crawler_db，Schema：public。
   - SQL：以 DS-DB01-01 的完整 SQL 为子查询，别名 `sub`，外层 `SELECT sub.*`，并加上上述 `WHERE {% if filter_values('country') %} ... {% else %} 1=0 {% endif %}`。
   - 保存后编辑列/类型与 DS-DB01-01 一致（含 geojson 列）。
2. **同上**，创建 `ds_db01_detail_require_country`：
   - SQL：与 DS-DB01-02 相同，在末尾增加 `WHERE {% if filter_values('country') %} c.country IN {{ filter_values('country') | where_in }} {% else %} 1=0 {% endif %}`（注意表别名 `c` 与现有 SQL 一致）。
3. **Charts**：编辑「国家详情地图」(122)，将 Data source 改为 `ds_db01_country_map_require_country`；编辑「采集明细下钻表」(123)，将 Data source 改为 `ds_db01_detail_require_country`。
4. 确认看板「国家」筛选器与 Cross-filter 的 Scoping 仍包含 122、123；未选国家时两图表为空，选国家后正常有数。

---

#### B.1.6 Native Filter 联动配置

| 筛选器名称 | 绑定字段 | 数据集 | 联动图表 | 说明 |
|-----------|----------|--------|----------|------|
| 采集类型 | type | DS-DB01-02 | CH-DB01-02/03/04/06/08/09 | Radio 控件，枚举：`google_map` / `google_earth`；不选等价全量 |
| 国家 | country | DS-DB01-02 | CH-DB01-02/03/04/06/08/09/**10** | 多选搜索框；与 world_map Cross-filter 双向联动；CH-DB01-10 deck_geojson 也接收 |

> **Cross-filter 说明**：
> - CH-DB01-01（world_map）勾选 **Emit cross filter**，Emit 列选 **`country`**。
> - CH-DB01-02/03/04/06/08/09/**10** 勾选**接收**该 Cross-filter。
> - CH-DB01-10（deck_geojson）使用 DS-DB01-01，列名同为 `country`，可直接接收。
> - 实现「点击 world_map 某国 → deck_geojson 仅渲染该国边界 + 看板全部图表同步过滤」。

---

#### B.1.9 故障排查：点击国家后看板数据不过滤

**现象**：DB01 点击地图某国家后，筛选条件区出现国家条件，但 KPI、趋势、排行等图表数据未随之过滤。

**原因**：Cross-filter 的**发出列名**与**接收图表使用的列名**不一致。地图数据集 DS-DB01-01 若仅暴露 `country_code3`，而其余图表使用 DS-DB01-02 的 `country`，Superset 不会将地图发出的筛选应用到这些图表。

**修复步骤**（在 Superset 中操作）：

1. **数据集 DS-DB01-01**  
   - 编辑 Virtual Dataset 的 SQL，在 SELECT 中增加：`g.country_code3 AS country`（与上文 B.1.3.1 SQL 一致）。  
   - 保存后确认该数据集存在 **country** 列。

2. **地图图表 CH-DB01-01**  
   - 编辑图表 → 实体/维度列改为 **country**（不再用 country_code3）。  
   - 在「Interactions」或「Cross-filter」中勾选 **Emit filter when clicked**，Emit 列选择 **country**。

3. **其余图表 CH-DB01-02/03/04/06/08/09/10**
   - 每张图表编辑 → 在「Interactions」/「Cross-filter」中勾选 **Receive filters from other charts**（或等价选项），并确保作用列为本图表的 **country**。  
   - 若看板有「Filter scoping」配置，确认这些图表均在「Scoping」范围内。
   - **CH-DB01-09（明细下钻表）、CH-DB01-10（deck_geojson）**：特别注意也需在 Scoping 范围内，否则点击 world_map 后不会联动。

4. **验证**  
   - 保存看板后，点击地图上某一国家，确认顶部/侧边出现国家筛选条件，且总采集量 KPI、趋势图、国家排行及**明细下钻表**数据仅显示该国。

---

#### B.1.7 创建步骤（参考顺序）

1. **确认数据源**：Data → Databases，确认 `crawler_db`（PostgreSQL）连接正常，可在 SQL Lab 执行 `SELECT count(*) FROM crawler_tile_all` 验证。
2. **创建 DS-DB01-01**：Data → Datasets → + → Virtual（SQL）→ 粘贴 D.3.1 SQL → 保存 → Edit Dataset，将 `geom` 列 Type 改为 `GEOMETRY`，将 `total_count` 设为默认指标（SUM）。
3. **创建 DS-DB01-02**：Data → Datasets → + → Physical Table → 选 `crawler_db` / `public` / `crawler_tile_all` → 保存 → Edit Dataset，将 `dt` 列 Type 改为 `TEMPORAL`，格式 `%Y%m%d`；将 `count_nums` 默认聚合设为 `SUM`。
4. **依次创建 9 张图表**（建议顺序：CH-DB01-02/03 KPI → CH-DB01-01 world_map → CH-DB01-04 趋势 → CH-DB01-06 Treemap → CH-DB01-08 排行 → **CH-DB01-10 deck_geojson** → **CH-DB01-09 明细下钻表**）。
5. **新建看板**：Dashboard → + → 命名「采集覆盖总览」，将 9 张图表拖入，按 B.1.5 布局排列：ROW_1 放统计总览（world_map+KPI+趋势+Treemap+排行榜），**ROW_2 放 deck_geojson（w=5）+ 明细下钻表（w=7）**。
6. **配置 Native Filter**：看板编辑模式 → Filters 面板 → 按 B.1.6 添加 2 个筛选器（采集类型、国家），勾选对应联动图表（含 CH-DB01-09、CH-DB01-10）和 Cross-filter。
7. **端到端验证**：
   - 点击 world_map 某国 → 确认 **deck_geojson 仅渲染该国边界**、KPI、趋势、排行、明细下钻表均联动过滤到该国。
   - 切换 type 筛选 → 确认 Treemap 与明细表随之变化。
   - 在明细下钻表中确认可按 dt 查看该国每日采集量。
   - 再次点击同一国家或点空白处 → 确认 deck_geojson 恢复全部国家、其余图表恢复全量。

---

#### B.1.8 已确认事项

最后查验实际：2026-02-26

以下 5 条已通过直接查询 crawler_db 核实，规划设计无需调整。

| # | 确认项 | 查询结论 | 对规划的影响 |
|---|--------|---------|------------|
| 1 | `crawler_tile_all.country` 代码格式 | **3 字母 ISO 代码**（ARE、ARG、JPN 等） | DS-DB01-01 JOIN 条件 `g.country_code3 = c.country` 正确，无需追加 country_code2 兜底 |
| 2 | `crawler_tile_all.dt` 格式 | **`YYYYMMDD`**，如 `20260101` | DS-DB01-02 时间格式设置 `%Y%m%d` 正确 |
| 3 | `crawler_tile_all.type` 枚举值 | **仅 2 个**：`google_earth`、`google_map` | Treemap/堆叠图无需限 Top N；筛选器只需 2 个选项，可用 Radio 控件替代下拉 |
| 4 | `gadm_country_boundary.level` 国家级别 | **`level = 0`**，共 263 条（国家级） | DS-DB01-01 `WHERE g.level = 0` 过滤正确 |
| 5 | `crawler_db` SQL Lab 执行权限 | **数据库本身可查**，但 `superset-mcp` 包的 `execute_sql` 工具调用 `/api/v1/sqllab/execute/` 时**未携带 Session Cookie**，导致 Superset 的 CSRF 校验失败（400）；已通过带 Cookie 的直接 API 调用验证数据可达 | 规划设计不受影响；Superset 界面 SQL Lab 正常可用；若需通过 MCP 执行 SQL，需等 `superset-mcp` 包修复 CSRF/Session 处理，或通过 Shell 脚本绕过 |

> **关于第 5 条（CSRF 问题）的技术细节**：
> Superset 的 `/api/v1/sqllab/execute/` 接口同时要求：① `Authorization: Bearer <JWT>` ② `X-CSRFToken: <csrf>` ③ 对应的 Session Cookie（三者缺一不可）。
> `superset-mcp` 包目前只传了 JWT，未维护 Session Cookie，所以 Superset 返回「CSRF session token is missing」400 错误。
> 这是 **`superset-mcp` 的已知局限**，不影响 Superset 本身的功能与数据。

---

### B.2 DB02 覆盖下钻与明细——详细实施规划

> **参考**：本规划延续 4.6.4.2 的 DB02 布局建议，与 DB01 一致采用 **12 列网格**；图表组成见 4.6.4.1（CH04、CH05、CH12、CH13），数据集见 4.6.2（DS04、DS05、DS15、DS13/DS14）。

---

#### B.2.1 看板定位与目标

| 项目 | 说明 |
|------|------|
| 看板名称 | 覆盖下钻与明细 |
| 看板 ID（规划） | DB02 |
| 数据源 | crawler_db（PostgreSQL） |
| 核心问题 | ① 卫星影像 / DEM 瓦片在空间上的覆盖分布？② 选定国家/日期后，卫星影像明细列表有哪些？ |
| 图表组成 | CH04（卫星影像覆盖）、CH05（DEM 瓦片）、CH12（卫星影像下钻明细表）、CH13（筛选器） |

---

#### B.2.2 涉及表与字段速查

| 表名 | 关键字段 | 用途 |
|------|----------|------|
| `satellite_images`（DS04） | id, file_path, coordinate_z/x/y, extent, provider, capture_date | 影像覆盖图 CH04、明细数据源 |
| `dem_tiles_data`（DS05） | id, tile_id, level, geom, source_name | DEM 覆盖图 CH05 |
| DS15（Virtual SQL） | 同 satellite_images 列 + Template 参数 date_from/date_to（可选 country 空间 JOIN） | 下钻明细表 CH12 |
| `dim_country` / `dim_osm_country_relation`（DS13/DS14） | alpha2/alpha3、area_name 等 | 国家筛选器 CH13 |

> **说明**：`satellite_images` 表无 `country` 列，按国家过滤需与 `gadm_country_boundary` 做 `ST_Intersects(extent, geom)` 空间 JOIN，注意行数限制与性能（见 4.6.2 DS15 说明）。

---

#### B.2.3 数据集规划

（数据集见 4.6.2：DS04、DS05、DS15、DS13/DS14；具体建表/SQL 与 B.1.3 风格一致，此处从略。）

---

#### B.2.4 图表规划

（图表组成见 4.6.4.1：CH04、CH05、CH12、CH13；配置要点与 B.1.4 风格一致，此处从略。）

---

#### B.2.5 看板布局

与 4.6.4.2 一致，并参照 DB01/World Bank 的 12 列与嵌套方式：

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ROW 1：筛选器（1 行高）                                                     │
│ [CH13] 国家（多选） | 开始日期 date_from | 结束日期 date_to | 应用/清除     │
├────────────────────────────────────────────────────────────────────────────┤
│ ROW 2：覆盖分布（建议 8～10 行高）                                          │
│ [CH04 卫星影像覆盖] 8 列          │ [CH05 DEM 瓦片覆盖] 4 列                │
├───────────────────────────────────┴────────────────────────────────────────┤
│ ROW 3：下钻明细（建议 12～16 行高，可滚动）                                  │
│ [CH12 卫星影像下钻明细表] 12 列                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

- **第 1 行**：Native Filter 占满 12 列，组件：国家（多选，绑定 DS13/DS14 或明细用参数）、date_from、date_to（绑定 DS15 的 Template 参数或时间列）。
- **第 2 行**：CH04 占 8 列、CH05 占 4 列，便于以影像为主、DEM 为辅对比查看。
- **第 3 行**：CH12 占 12 列全宽，高度适当加大以便分页浏览明细。

---

#### B.2.6 position_json 参考（Superset 12 列）

以下为与 DB01 实施时一致的 12 列网格 + ROW/CHART 结构，便于直接复用或脚本写入。

| 节点类型 | 节点 ID | 宽度 | 高度 | 说明 |
|----------|----------|------|------|------|
| GRID | GRID_ID | — | — | children: ROW_1, ROW_2, ROW_3 |
| ROW | ROW_1 | — | — | 筛选器行；children: 由 Native Filter 占位，无 CHART |
| ROW | ROW_2 | — | — | children: CHART_CH04, CHART_CH05 |
| CHART | CHART_CH04 | 8 | 50 | 卫星影像覆盖（Deck.gl Geojson/Point） |
| CHART | CHART_CH05 | 4 | 50 | DEM 瓦片覆盖（Deck.gl Polygon/Point） |
| ROW | ROW_3 | — | — | children: CHART_CH12 |
| CHART | CHART_CH12 | 12 | 70 | 卫星影像下钻明细表（Table） |

- 筛选器不参与 position_json 的 CHART 布局，由看板「Filters」配置单独管理。
- 高度单位为网格单位，可按实际观感微调（如 CH04/CH05 用 45～55，CH12 用 65～80）。

---

#### B.2.7 Native Filter 联动配置

| 筛选器名称 | 绑定对象 | 联动图表 | 说明 |
|------------|----------|----------|------|
| 国家 | DS13/DS14 的 country（alpha2/alpha3 或 area_name） | CH04、CH05、CH12 | 若 CH04/CH05 用物理表且无 country 列，需通过 Virtual Dataset + 空间 JOIN 传入 `country` 参数 |
| 开始日期（date_from） | DS15 Template 参数 `date_from` | CH12 | 控制明细表时间下限 |
| 结束日期（date_to） | DS15 Template 参数 `date_to` | CH12 | 控制明细表时间上限 |

- 所有需联动的图表在 Native Filter 的「Scoping」中勾选对应图表，并启用 **Cross-filter**（若做「点击地图驱动明细」可再配 CH04 的 Emit filter）。

---

#### B.2.8 创建步骤（参考顺序）

1. **数据源与数据集**：确认 crawler_db 可访问；创建/配置 DS04（satellite_images）、DS05（dem_tiles_data）、DS15（下钻 SQL，含 `date_from`/`date_to` 及可选 `country`）；DS13/DS14 用于国家筛选。
2. **图表**：先做 CH13（Native Filter）→ CH12（明细表，验证 DS15 与参数）→ CH04（影像覆盖）→ CH05（DEM 覆盖）。
3. **看板**：新建「覆盖下钻与明细」，拖入 CH04、CH05、CH12，按 B.2.3/B.2.4 排布；再在 Filters 中配置 B.2.5 的筛选器并勾选联动图表。
4. **验证**：切换国家与日期范围，确认 CH12 明细与 CH04/CH05（若已接参数）随之刷新。

---

### B.3 DB03 道路与 POI 分析——详细实施规划

> **参考**：本规划延续 4.6.4.1 / 4.6.4.2 的 DB03 定义，采用 **12 列网格**；图表为 CH06、CH07、CH08、CH09、CH10、CH13；数据集见 4.6.2（DS06、DS07、DS08、DS10、DS13/DS14）。

---

#### B.3.1 看板定位与目标

| 项目 | 说明 |
|------|------|
| 看板名称 | 道路与 POI 分析 |
| 看板 ID（规划） | DB03 |
| 数据源 | crawler_db（PostgreSQL） |
| 核心问题 | ① 各国道路长度及子类型分布？② 道路长度随时间（mo）趋势？③ 各国 POI 数量与分类占比？④ Overture 与 OSM 道路数据对比？ |
| 图表组成 | CH06（道路长度-按国家/类型）、CH07（道路长度-趋势）、CH08（POI 数量-按国家/分类）、CH09（POI 分类占比）、CH10（Overture vs OSM 对比）、CH13（筛选器） |

---

#### B.3.2 涉及表与字段速查

| 表名 | 关键字段 | 用途 |
|------|----------|------|
| `app_osm_road_length`（DS06） | mo, country_code, road_subtype, road_length_km | CH06 柱状（按国家/子类型） |
| `app_osm_road_length_all`（DS07） | mo, country_code, open_road, close_road, total_road | CH07 趋势（按 mo） |
| `app_foursquare_places_d`（DS08） | country_alpha3, date_refreshed, level1_category_name, poi_count, is_closed | CH08 柱状、CH09 饼图 |
| `road_overture_osm_compare_m`（DS10） | country, overture_total, osm_total, matched_count, match_rate | CH10 对比柱状 |
| `dim_country` / `dim_osm_country_relation`（DS13/DS14） | alpha2/alpha3、area_name 等 | CH13 国家筛选 |

> **主键/唯一**：app_osm_road_length(mo, country_code, road_subtype)；app_osm_road_length_all(mo, country_code)。筛选时尽量带 mo / date_refreshed / country 以利用索引。

---

#### B.3.3 数据集规划

（数据集见 4.6.2：DS06、DS07、DS08、DS10、DS13/DS14；具体建表/SQL 与 B.1.3 风格一致，此处从略。）

---

#### B.3.4 图表规划

| 图表 ID | 图表名称 | 图表类型 | 数据集 | 配置要点 |
|---------|----------|----------|--------|----------|
| CH-DB03-06 | 道路长度-按国家/类型 | Bar（柱状） | DS06 | X：country_code；Y：SUM(road_length_km)；Group/堆叠：road_subtype；Filter：mo；Row limit 建议 50 |
| CH-DB03-07 | 道路长度-趋势 | Line（折线） | DS07 | X：mo（时间）；Y：SUM(total_road)；Series：country_code；Filter：country_code |
| CH-DB03-08 | POI 数量-按国家/分类 | Bar（柱状） | DS08 | X：country_alpha3 或 level1_category_name；Y：SUM(poi_count)；Filter：date_refreshed, is_closed |
| CH-DB03-09 | POI 分类占比 | Pie（饼图） | DS08 | 分组：level1_category_name；指标：SUM(poi_count)；Filter：country_alpha3, date_refreshed |
| CH-DB03-10 | Overture vs OSM 道路对比 | Bar（柱状） | DS10 | X：country；Y：overture_total, osm_total, matched_count（多指标）；或双轴展示 match_rate |
| CH-DB03-F | 筛选器组 | Native Filter | DS06/DS07/DS08/DS10 + DS13 | 国家（country_code/alpha3）、月份 mo、日期 date_refreshed；勾选 Cross-filter 联动上述图表 |

> **CH10 多指标**：若 Superset 柱状图支持多指标，可同轴展示 overture_total、osm_total、matched_count；match_rate 可放次 Y 轴或单独图表。

---

#### B.3.5 看板布局

与 4.6.4.2 一致：

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ROW 1：筛选器（1 行高）                                                     │
│ [CH13] 国家（多选） | 月份 mo | 日期 date_refreshed | 应用/清除             │
├────────────────────────────────────────────────────────────────────────────┤
│ ROW 2：道路（建议 8～10 行高）                                              │
│ [CH06 道路长度-按国家/类型] 6 列     │ [CH07 道路长度-趋势] 6 列             │
├─────────────────────────────────────┴──────────────────────────────────────┤
│ ROW 3：POI（建议 8～10 行高）                                               │
│ [CH08 POI 数量-按国家/分类] 6 列     │ [CH09 POI 分类占比] 6 列               │
├─────────────────────────────────────┴──────────────────────────────────────┤
│ ROW 4：对比（建议 6～8 行高）                                               │
│ [CH10 Overture vs OSM 道路对比] 12 列                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

#### B.3.6 position_json 参考（12 列）

| 节点类型 | 节点 ID | 宽度 | 高度 | 说明 |
|----------|----------|------|------|------|
| GRID | GRID_ID | — | — | children: ROW_2, ROW_3, ROW_4 |
| ROW | ROW_2 | — | — | children: CHART_CH06, CHART_CH07 |
| CHART | CHART_CH06 | 6 | 36 | 道路长度-按国家/类型 |
| CHART | CHART_CH07 | 6 | 36 | 道路长度-趋势 |
| ROW | ROW_3 | — | — | children: CHART_CH08, CHART_CH09 |
| CHART | CHART_CH08 | 6 | 36 | POI 数量-按国家/分类 |
| CHART | CHART_CH09 | 6 | 36 | POI 分类占比 |
| ROW | ROW_4 | — | — | children: CHART_CH10 |
| CHART | CHART_CH10 | 12 | 32 | Overture vs OSM 道路对比 |

- 筛选器由看板「Filters」配置，不占 position_json 中的 CHART 节点；高度可按观感微调。

---

#### B.3.7 Native Filter 联动配置

| 筛选器名称 | 绑定列/数据集 | 联动图表 | 说明 |
|------------|---------------|----------|------|
| 国家 | country_code（DS06/DS07）或 country_alpha3（DS08）或 country（DS10） | CH06、CH07、CH08、CH09、CH10 | 需与各表维度一致：道路表多为 country_code，POI 为 country_alpha3，对比表为 country（3 字母） |
| 月份 mo | mo（DS06、DS07） | CH06、CH07 | 格式 yyyyMM |
| 日期 date_refreshed | date_refreshed（DS08） | CH08、CH09 | POI 表按日分区 |

- 若国家维度在各表中命名不统一，筛选器可绑定维表（DS13/DS14）后通过 Cross-filter 传到各图表，或各图表分别绑定对应数据集的国家列。

---

#### B.3.8 创建步骤（参考顺序）

1. **数据集**：创建 DS06（app_osm_road_length）、DS07（app_osm_road_length_all）、DS08（app_foursquare_places_d）、DS10（road_overture_osm_compare_m）；DS13/DS14 可选（国家筛选）。
2. **图表**：按 CH06 → CH07 → CH08 → CH09 → CH10 顺序创建并绑定对应数据集；再配置 CH13（Native Filter）。
3. **看板**：新建「道路与 POI 分析」，拖入 CH06～CH10，按 B.3.4/B.3.5 排布；在 Filters 中配置国家、mo、date_refreshed 并勾选联动图表。
4. **验证**：切换国家、月份、日期，确认各图表数据与筛选一致；检查 CH10 多指标/双轴展示是否符合预期。

---

### B.4 DB04 人口与综合指标——详细实施规划

> **参考**：本规划延续 4.6.4.1 / 4.6.4.2 的 DB04 定义，采用 **12 列网格**；图表为 CH11、CH13，可选 CH02（与 DB01 复用或复制）；数据集见 4.6.2（DS11、DS12、DS13/DS14）。

---

#### B.4.1 看板定位与目标

| 项目 | 说明 |
|------|------|
| 看板名称 | 人口与综合指标 |
| 看板 ID（规划） | DB04 |
| 数据源 | crawler_db（PostgreSQL） |
| 核心问题 | ① 各国/省份人口分布如何？② 可选：与采集覆盖量（CH02）对比查看 |
| 图表组成 | CH11（人口分布-按国家）、CH13（筛选器）；可选 CH02（覆盖量-按国家柱状） |

---

#### B.4.2 涉及表与字段速查

| 表名 | 关键字段 | 用途 |
|------|----------|------|
| `dw_osm_population_info`（DS11） | country, countryname, provincename, townname, population(varchar), sourcepop | CH11 人口柱状；population 为 varchar，聚合时需转数值或用表达式 |
| `overture_area_population`（DS12） | country, subtype, subtype_cn, area, population(integer) | 可选：Overture 区域人口柱状/对比 |
| `dim_country` / `dim_osm_country_relation`（DS13/DS14） | alpha2/alpha3、area_name 等 | CH13 国家筛选 |
| `crawler_tile_all`（DB01 已用，DS03） | country, type, dt, count_nums | 可选 CH02 覆盖量柱状 |

> **说明**：`dw_osm_population_info.population` 为 varchar(100)（详见《20260203_BI展示技术方案_crawler_db数据源调研.md》），若需按国家 SUM(population)，需在 Superset 中建**计算指标**（如 `SUM(CAST(population AS NUMERIC))` 或 `SUM(NULLIF(REGEXP_REPLACE(population,'[^0-9.]','','g'),'')::NUMERIC)`），或建虚拟数据集先转换再聚合。

---

#### B.4.3 数据集规划

（数据集见 4.6.2：DS11、DS12、DS13/DS14；具体建表/SQL 与 B.1.3 风格一致，此处从略。）

---

#### B.4.4 图表规划

| 图表 ID | 图表名称 | 图表类型 | 数据集 | 配置要点 |
|---------|----------|----------|--------|----------|
| CH-DB04-11 | 人口分布-按国家 | Bar（柱状） | DS11 | X：country 或 countryname；Y：SUM(population)（需做数值转换）；Filter：provincename；Row limit 建议 50 |
| CH-DB04-02（可选） | 覆盖量-按国家柱状 | Bar | DS03（crawler_tile_all） | 与 DB01 的 CH02 配置一致，便于与人口图对比；X：country；Y：SUM(count_nums)；Group：type |
| CH-DB04-F | 筛选器组 | Native Filter | DS11/DS12 + DS13 | 国家（country / countryname）；可选省份 provincename；勾选 Cross-filter 联动 CH11（及可选 CH02） |

> **CH11 指标**：若 DS11 直连物理表，在数据集「Metrics」中新增指标，表达式建议为 `SUM(CAST(NULLIF(TRIM(REGEXP_REPLACE(population, '[^0-9.]', '', 'g')), '') AS NUMERIC))`，先清洗逗号/空格等非数字字符再聚合，避免 `invalid input syntax for type numeric` 报错。

---

#### B.4.5 看板布局

与 4.6.4.2 一致：

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ROW 1：筛选器（1 行高）                                                     │
│ [CH13] 国家（多选） | 可选：省份 provincename | 应用/清除                   │
├────────────────────────────────────────────────────────────────────────────┤
│ ROW 2：人口主图（建议 10～12 行高）                                         │
│ [CH11 人口分布-按国家] 12 列                                                │
├────────────────────────────────────────────────────────────────────────────┤
│ ROW 3（可选）：对比                                                        │
│ [CH02 覆盖量-按国家柱状] 12 列                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

- 仅 CH11 时仅保留 ROW 1 + ROW 2；需要与覆盖量对比时增加 ROW 3 放置 CH02。

---

#### B.4.6 position_json 参考（12 列）

| 节点类型 | 节点 ID | 宽度 | 高度 | 说明 |
|----------|----------|------|------|------|
| GRID | GRID_ID | — | — | children: ROW_2 [, ROW_3] |
| ROW | ROW_2 | — | — | children: CHART_CH11 |
| CHART | CHART_CH11 | 12 | 40 | 人口分布-按国家 |
| ROW | ROW_3（可选） | — | — | children: CHART_CH02 |
| CHART | CHART_CH02（可选） | 12 | 32 | 覆盖量-按国家柱状 |

---

#### B.4.7 Native Filter 联动配置

| 筛选器名称 | 绑定列/数据集 | 联动图表 | 说明 |
|------------|---------------|----------|------|
| 国家 | country 或 countryname（DS11） | CH11、（可选 CH02 若绑定 DS03） | 与 DS11 维度一致；若加 CH02，需同时绑定 DS03.country |
| 省份（可选） | provincename（DS11） | CH11 | 下钻到省份粒度 |

---

#### B.4.8 创建步骤（参考顺序）

1. **数据集**：创建 DS11（dw_osm_population_info）；可选 DS12（overture_area_population）；DS13/DS14 可选（国家筛选）。在 DS11 中为 population 建可聚合指标（如 CAST 后 SUM）。
2. **图表**：创建 CH11（人口分布-按国家）；可选：复制或复用 DB01 的 CH02 作为「覆盖量-按国家」加入本看板。
3. **看板**：新建「人口与综合指标」，拖入 CH11（及可选 CH02），按 B.4.4/B.4.5 排布；在 Filters 中配置国家（及可选省份）并勾选联动图表。
4. **验证**：切换国家/省份，确认 CH11 数据与筛选一致；若含 CH02，确认两国度对比展示符合预期。

---
