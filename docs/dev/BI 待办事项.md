# BI 展示技术实施待办事项

## 文档信息

| 项目 | 说明 |
|------|------|
| 文档版本 | 1.0 |
| 创建日期 | 2026-03-06 |
| 文档状态 | 进行中 |
| 适用范围 | 地理空间数据采集 BI 展示实施 |

## 修订历史

| 版本 | 日期 | 修订人 | 修订说明 |
|------|------|--------|----------|
| 1.0 | 2026-03-06 | - | 从《BI 展示技术方案_crawler_db 数据源调研.md》迁移待办事项，新增区县级别热力支持任务 |

---

## 待办事项清单

### 1. 采集数据多级别行政区域支持

**优先级**：高

**需求背景**：当前 `crawler_tile_all` 表仅有国家级别（Level 0）采集数据，无法支持省/市/县级别的多层级行政热力图展示。

**目标**：支持 Superset 看板"采集覆盖总览-V2"的多级别行政区域筛选与可视化展示。

**方案**：新建采集明细表 `crawler_tile_detail`

**SQL DDL**：
```sql
CREATE TABLE crawler_tile_detail (
    id              BIGSERIAL PRIMARY KEY,
    country         VARCHAR(3),        -- 国家代码 (ISO 3166-1 alpha-3)
    country_name    VARCHAR(255),      -- 国家名称

    -- Level 1: 省/州
    level1_id       VARCHAR(50),       -- GADM Level1 ID (如：CHN.1_1)
    level1_name     VARCHAR(255),      -- 省/州名称

    -- Level 2: 市/县
    level2_id       VARCHAR(50),       -- GADM Level2 ID (如：CHN.1.28_1)
    level2_name     VARCHAR(255),      -- 市/县名称

    -- 采集信息
    type            VARCHAR(50),       -- 采集类型 (google_map, google_earth, satellite)
    dt              VARCHAR(8),        -- 日期 (YYYYMMDD)
    count_nums      BIGINT,            -- 采集瓦片数量

    -- 元数据
    source_url      TEXT,              -- 数据来源 URL
    tile_level      INTEGER,           -- 瓦片层级 (Z)
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_detail_country ON crawler_tile_detail(country);
CREATE INDEX idx_detail_level1 ON crawler_tile_detail(level1_id);
CREATE INDEX idx_detail_level2 ON crawler_tile_detail(level2_id);
CREATE INDEX idx_detail_dt ON crawler_tile_detail(dt);
CREATE INDEX idx_detail_type ON crawler_tile_detail(type);
```

**关联说明**：
- 通过 `level_id` / `parent_id` 与 `gadm_country_boundary` 表关联
- 支持 Level 0 (国家)、Level 1 (省/州)、Level 2 (市/县) 三个层级

**依赖**：
- `gadm_country_boundary` 表（已存在）
- GADM 行政边界数据（Level 0-2）

**负责方**：数据研发团队

**状态**：待开发

---

### 2. 区县级别热力图支持

**优先级**：高

**需求背景**：业务需要将热力图下钻到区县级别（Level 2），当前仅支持国家级（Level 0）展示。

**目标**：在"采集覆盖总览"看板中支持国家→省→市三级下钻热力图。

**实施方案**：

#### 2.1 数据层改造
- ✅ 依赖待办事项 1：完成 `crawler_tile_detail` 表开发
- ⏳ 数据同步作业：DLC → PG 的 ETL 作业开发（日级）

#### 2.2 Superset 数据集改造
- ⏳ 修改 DS-DB01-01 数据集 SQL，支持动态级别筛选
- ⏳ 新增行政级别筛选器（Radio 控件：国家/省/市）
- ⏳ 新增区域级联筛选器（国家 → 省 → 市）

**修改后的数据集 SQL 示例**：
```sql
SELECT
    g.country_name,
    g.country_code3,
    g.level,
    g.level_name,
    g.level_id,
    g.parent_id,
    ST_AsGeoJSON(ST_Simplify(g.geom, 0.05)) as geojson,
    COALESCE(t.crawl_count, 0) as crawl_count
FROM gadm_country_boundary g
LEFT JOIN (
    SELECT
        level2_id as region_id,
        SUM(count_nums) as crawl_count
    FROM crawler_tile_detail
    WHERE 1=1
      AND ({{ level_filter }} = 'all' OR adm_level = {{ level_filter }})
    GROUP BY region_id
) t ON g.level_id = t.region_id
WHERE g.level IN (0, 1, 2)
```

#### 2.3 图表组件调整
- ⏳ 热力图（deck_polygon）：Emit 列改为 `level_id`，支持点击下钻
- ⏳ 热力图 Tooltip：显示当前级别名称（省名/市名）
- ⏳ 下钻明细表：增加 `level1_name`、`level2_name`、`tile_level` 列

#### 2.4 交互流程升级
```
用户选择级别 → 筛选器触发 → 热力图渲染对应级别 →
点击某区域 → Emit level_id → 明细表显示该区域下级或明细
```

**依赖**：
- 待办事项 1 完成
- `gadm_country_boundary` Level 1-2 数据（已存在）

**负责方**：BI 开发团队

**状态**：依赖待办事项 1

---

### 3. 空表数据入库

**优先级**：中

**待入库表清单**：

| 表名 | 当前行数 | 用途 |
|------|---------|------|
| `dws_osm_road_network_density` | 0 | 道路网络密度分析 |
| `o_node` | 0 | OSM 节点数据 |
| `o_relation` | 0 | OSM 关系数据 |
| `o_road` | 0 | OSM 道路数据 |
| `satellite_images` | 0 | 卫星影像覆盖 |

**负责方**：数据研发团队

**状态**：待开发

---

### 4. Superset 看板优化

**优先级**：低

**优化项**：
- ⏳ 图表配色统一：配置 `EXTRA_SEQUENTIAL_COLOR_SCHEMES` 蓝→红渐变方案
- ⏳ 地图底图优化：支持 OSM、Mapbox 等多种底图切换
- ⏳ 性能优化：大数据量表配置查询超时与限流

**负责方**：BI 开发团队

**状态**：规划中

---

## 实施计划

| 阶段 | 内容 | 依赖 | 预计周期 |
|------|------|------|---------|
| P0 | 完成 `crawler_tile_detail` 表开发与数据同步 | 无 | 1 周 |
| P1 | 实现区县级别热力图支持下钻 | 事项 1 | 1 周 |
| P2 | 空表数据入库 | 无 | 2 周 |
| P3 | 看板优化与性能调优 | 事项 1-2 | 1 周 |

---

## 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| `crawler_tile_detail` 数据量过大 | 查询慢、看板卡顿 | 按 `dt` 分区、配置索引、限制查询时间范围 |
| Level 1-2 边界数据缺失 | 热力图区域不准 | 提前验证 `gadm_country_boundary` 表各级别数据完整性 |
| 下钻交互复杂 | 用户体验差 | 简化交互流程，提供清晰的级别切换提示 |

---

## 相关链接

- [BI 展示技术方案](BI 展示技术方案.md)
- [crawler_db 数据源调研](BI 展示技术方案_crawler_db 数据源调研.md)
