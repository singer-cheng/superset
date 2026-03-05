# crawler_db 全表扫描与 Superset 报表适配清单

- 扫描时间：2026-02-26 20:56:38
- 数据源：`crawler_db.public`
- 表总数：33
- 说明：每张表包含“字段结构表（含字段注释）”与“数据样例（CSV）”。

## 总览

| 表名 | 行数 | Superset报表可用性 | 表用途/使用场景 |
|---|---:|---|---|
| `app_foursquare_places_d` | 4618805 | 可用 | POI 数量与分类分析 |
| `app_osm_address_info` | 206 | 可用 | OSM/Overture 主题分析扩展 |
| `app_osm_barrier_info` | 505 | 可用 | OSM/Overture 主题分析扩展 |
| `app_osm_building_info` | 28552 | 可用 | OSM/Overture 主题分析扩展 |
| `app_osm_land_info` | 12886 | 可用 | OSM/Overture 主题分析扩展 |
| `app_osm_restriction_info` | 1234 | 可用 | OSM/Overture 主题分析扩展 |
| `app_osm_road_length` | 2957 | 可用 | 道路专题分析（长度、趋势、对比） |
| `app_osm_road_length_all` | 213 | 可用 | 道路专题分析（长度、趋势、对比） |
| `app_osm_turn_info` | 23124 | 可用 | OSM/Overture 主题分析扩展 |
| `app_osm_waterway_info` | 4408 | 可用 | OSM/Overture 主题分析扩展 |
| `app_overture_road_length` | 3117 | 可用 | OSM/Overture 主题分析扩展 |
| `crawler_tile_all` | 149 | 可用 | 采集覆盖总览（国家/类型/日期趋势） |
| `dem_tiles_data` | 33681 | 可用（地图） | 空间覆盖与轨迹/街景专题 |
| `dim_country` | 249 | 可用（维表） | 筛选器字典、维度映射、下钻 |
| `dim_country_name` | 250 | 可用（维表） | 筛选器字典、维度映射、下钻 |
| `dim_osm_country_relation` | 29111 | 可用（维表） | 筛选器字典、维度映射、下钻 |
| `dim_osm_poi_info` | 72 | 可用（维表） | 筛选器字典、维度映射、下钻 |
| `dim_province` | 5871 | 可用（维表） | 筛选器字典、维度映射、下钻 |
| `dw_osm_population_info` | 15101 | 可用 | 人口与综合指标分析 |
| `dws_osm_road_network_density` | 0 | 暂不建议 | 基础数据或专题扩展 |
| `gadm_country_boundary` | 348745 | 可用（地图） | 基础数据或专题扩展 |
| `geoboundaries_org_country_boundary` | 715 | 可用 | 基础数据或专题扩展 |
| `gps_trace_data` | 8303171 | 可用（地图） | 空间覆盖与轨迹/街景专题 |
| `o_node` | 0 | 暂不建议 | 基础数据或专题扩展 |
| `o_relation` | 0 | 暂不建议 | 基础数据或专题扩展 |
| `o_road` | 0 | 暂不建议 | 基础数据或专题扩展 |
| `openaddress_job_info` | 748573 | 条件可用 | 基础数据或专题扩展 |
| `overture_area_population` | 670620 | 可用 | 人口与综合指标分析 |
| `rels_all` | 286481 | 条件可用 | 基础数据或专题扩展 |
| `road_overture_osm_compare_m` | 198 | 可用 | 道路专题分析（长度、趋势、对比） |
| `satellite_images` | 0 | 暂不建议 | 空间覆盖与轨迹/街景专题 |
| `spatial_ref_sys` | 8500 | 条件可用 | 基础数据或专题扩展 |
| `street_views` | 187626 | 可用（地图） | 空间覆盖与轨迹/街景专题 |

## 逐表明细

### `app_foursquare_places_d`

- 行数：`4618805`
- 表用途/使用场景：POI 数量与分类分析
- Superset报表可用性：**可用**
- 理由：具备国家+时间维度，适合趋势、排行、占比等常规报表。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `integer` | - |
| `country` | `character(2)` | 国家Alpha-2代码 (如 "US") |
| `country_alpha3` | `character(3)` | 国家Alpha-3代码 (如 "USA") |
| `country_short_name` | `character varying(100)` | 国家简称 |
| `date_refreshed` | `date` | POI最后更新时间 |
| `is_closed` | `integer` | 是否关闭，1是0否 |
| `level1_category_id` | `character varying(30)` | 一级分类ID |
| `level1_category_name` | `character varying(50)` | 一级分类名称 |
| `poi_count` | `integer` | poi数量 |

#### 数据样例（CSV，1 行）

```csv
id,country,country_alpha3,country_short_name,date_refreshed,is_closed,level1_category_id,level1_category_name,poi_count
4585873,GB,GBR,UNITED KINGDOM OF GREAT BRITAIN AND NORTHERN IRELAND,2014-05-31,0,4d4b7105d754a06375d81259,Business and Professional Services,183
```

### `app_osm_address_info`

- 行数：`206`
- 表用途/使用场景：OSM/Overture 主题分析扩展
- Superset报表可用性：**可用**
- 理由：具备国家维度，可做国家级对比、排行、占比图。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `country` | `character varying(30)` | - |
| `count_nums` | `integer` | - |

#### 数据样例（CSV，1 行）

```csv
country,count_nums
POL,8486608
```

### `app_osm_barrier_info`

- 行数：`505`
- 表用途/使用场景：OSM/Overture 主题分析扩展
- Superset报表可用性：**可用**
- 理由：具备国家维度，可做国家级对比、排行、占比图。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `country` | `character varying(30)` | - |
| `barrier_class` | `character varying(200)` | - |
| `count_nums` | `integer` | - |

#### 数据样例（CSV，1 行）

```csv
country,barrier_class,count_nums
GBR,gate,647930
```

### `app_osm_building_info`

- 行数：`28552`
- 表用途/使用场景：OSM/Overture 主题分析扩展
- Superset报表可用性：**可用**
- 理由：具备国家维度，可做国家级对比、排行、占比图。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `country` | `character varying(30)` | - |
| `building_class` | `character varying(300)` | - |
| `count_nums` | `integer` | - |

#### 数据样例（CSV，1 行）

```csv
country,building_class,count_nums
AUT,platform,2
```

### `app_osm_land_info`

- 行数：`12886`
- 表用途/使用场景：OSM/Overture 主题分析扩展
- Superset报表可用性：**可用**
- 理由：具备国家维度，可做国家级对比、排行、占比图。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `country` | `character varying(30)` | - |
| `landuse_class` | `character varying(100)` | - |
| `area` | `double precision` | - |
| `count_nums` | `integer` | - |

#### 数据样例（CSV，1 行）

```csv
country,landuse_class,area,count_nums
JPN,gravel,1.7798151045886335,8
```

### `app_osm_restriction_info`

- 行数：`1234`
- 表用途/使用场景：OSM/Overture 主题分析扩展
- Superset报表可用性：**可用**
- 理由：具备国家维度，可做国家级对比、排行、占比图。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `country` | `character varying(3)` | - |
| `restriction_type` | `character varying(30)` | - |
| `restriction_value` | `character varying(60)` | - |
| `count_nums` | `bigint` | - |

#### 数据样例（CSV，1 行）

```csv
country,restriction_type,restriction_value,count_nums
CHN,no_u_turn,禁止掉头,3059
```

### `app_osm_road_length`

- 行数：`2957`
- 表用途/使用场景：道路专题分析（长度、趋势、对比）
- Superset报表可用性：**可用**
- 理由：具备国家+时间维度，适合趋势、排行、占比等常规报表。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `mo` | `character varying(6)` | - |
| `country_code` | `character varying(30)` | - |
| `road_subtype` | `character varying(255)` | - |
| `road_length_km` | `double precision` | - |

#### 数据样例（CSV，1 行）

```csv
mo,country_code,road_subtype,road_length_km
202512,PHL,tertiary_link,14.099928721043828
```

### `app_osm_road_length_all`

- 行数：`213`
- 表用途/使用场景：道路专题分析（长度、趋势、对比）
- Superset报表可用性：**可用**
- 理由：具备国家+时间维度，适合趋势、排行、占比等常规报表。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `mo` | `character varying(6)` | - |
| `country_code` | `character varying(30)` | - |
| `open_road` | `double precision` | - |
| `close_road` | `double precision` | - |
| `total_road` | `double precision` | - |

#### 数据样例（CSV，1 行）

```csv
mo,country_code,open_road,close_road,total_road
202512,NPL,176704.07285831287,322.86917005506746,177026.94202836783
```

### `app_osm_turn_info`

- 行数：`23124`
- 表用途/使用场景：OSM/Overture 主题分析扩展
- Superset报表可用性：**可用**
- 理由：具备国家维度，可做国家级对比、排行、占比图。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `country` | `character varying(30)` | - |
| `turn_key` | `character varying(100)` | - |
| `turn_value` | `character varying(300)` | - |
| `count_nums` | `integer` | - |

#### 数据样例（CSV，1 行）

```csv
country,turn_key,turn_value,count_nums
HND,turn:lanes,right|right,1
```

### `app_osm_waterway_info`

- 行数：`4408`
- 表用途/使用场景：OSM/Overture 主题分析扩展
- Superset报表可用性：**可用**
- 理由：具备国家维度，可做国家级对比、排行、占比图。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `country` | `character varying(30)` | - |
| `waterway_class` | `character varying(100)` | - |
| `count_nums` | `integer` | - |

#### 数据样例（CSV，1 行）

```csv
country,waterway_class,count_nums
,,
```

### `app_overture_road_length`

- 行数：`3117`
- 表用途/使用场景：OSM/Overture 主题分析扩展
- Superset报表可用性：**可用**
- 理由：具备国家维度，可做国家级对比、排行、占比图。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `country` | `character varying(3)` | - |
| `road_class` | `character varying(100)` | - |
| `road_length_km` | `double precision` | - |

#### 数据样例（CSV，1 行）

```csv
country,road_class,road_length_km
JPN,trunk,60931.495026087076
```

### `crawler_tile_all`

- 行数：`149`
- 表用途/使用场景：采集覆盖总览（国家/类型/日期趋势）
- Superset报表可用性：**可用**
- 理由：具备国家+时间维度，适合趋势、排行、占比等常规报表。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `country` | `character varying(3)` | - |
| `type` | `character varying(100)` | - |
| `dt` | `character varying(100)` | - |
| `count_nums` | `integer` | - |

#### 数据样例（CSV，1 行）

```csv
country,type,dt,count_nums
KWT,google_map,20260101,2261283
```

### `dem_tiles_data`

- 行数：`33681`
- 表用途/使用场景：空间覆盖与轨迹/街景专题
- Superset报表可用性：**可用（地图）**
- 理由：含空间几何字段，可用于地图/空间分布图；需控制行数与地图渲染性能。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `bigint` | 自增ID |
| `tile_id` | `character varying(255)` | 遥感瓦片文件名 |
| `level` | `character varying(50)` | 精度 |
| `cos_file_url` | `character varying(500)` | 对象存储url |
| `cos_file_size` | `numeric(14,3)` | 文件大小MB |
| `geom` | `geometry` | 区域 |
| `source_name` | `character varying(50)` | 来源 |
| `create_time` | `timestamp with time zone` | 创建时间 |
| `update_time` | `timestamp with time zone` | 更新时间 |
| `source_url` | `character varying(1000)` | 来源url |

#### 数据样例（CSV，1 行）

```csv
id,tile_id,level,cos_file_url,cos_file_size,geom,source_name,create_time,update_time,source_url
14296,N41E107,30m,dem/copernicus/,,<geometry>,copernicus,2025-10-09T18:07:20.398642+08:00,,
```

### `dim_country`

- 行数：`249`
- 表用途/使用场景：筛选器字典、维度映射、下钻
- Superset报表可用性：**可用（维表）**
- 理由：适合做筛选器、字典映射、下钻层级，不建议单独做主指标图。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `integer` | - |
| `alpha2_code` | `character varying(10)` | - |
| `alpha3_code` | `character varying(10)` | - |
| `numeric_code` | `character varying(10)` | - |
| `short_name` | `character varying(500)` | - |
| `full_name` | `character varying(1000)` | - |
| `independent` | `character varying(255)` | - |
| `territory_name` | `character varying(500)` | - |
| `status` | `character varying(255)` | - |
| `administrative_lang2` | `character varying(50)` | - |
| `administrative_lang3` | `character varying(50)` | - |
| `local_short_name` | `character varying(500)` | - |
| `subdivisions` | `text` | - |
| `source_url` | `character varying(255)` | - |
| `validity` | `smallint` | - |
| `create_time` | `timestamp with time zone` | - |
| `update_time` | `timestamp with time zone` | - |

#### 数据样例（CSV，1 行）

```csv
id,alpha2_code,alpha3_code,numeric_code,short_name,full_name,independent,territory_name,status,administrative_lang2,administrative_lang3,local_short_name,subdivisions,source_url,validity,create_time,update_time
7,AI,AIA,660,ANGUILLA,,No,,Officially assigned,en,eng,Anguilla,,https://www.iso.org/obp/ui/#iso:code:3166:AI,1,2025-10-09T15:32:30.808081+08:00,2025-10-29T20:27:46.085134+08:00
```

### `dim_country_name`

- 行数：`250`
- 表用途/使用场景：筛选器字典、维度映射、下钻
- Superset报表可用性：**可用（维表）**
- 理由：适合做筛选器、字典映射、下钻层级，不建议单独做主指标图。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `country` | `character varying(64)` | - |
| `name` | `character varying(200)` | - |

#### 数据样例（CSV，1 行）

```csv
country,name
AIA,安圭拉
```

### `dim_osm_country_relation`

- 行数：`29111`
- 表用途/使用场景：筛选器字典、维度映射、下钻
- Superset报表可用性：**可用（维表）**
- 理由：适合做筛选器、字典映射、下钻层级，不建议单独做主指标图。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `integer` | 区域唯一ID |
| `area_name_en` | `character varying(100)` | 区域英文名 |
| `area_name_cn` | `character varying(100)` | 区域中文名 |
| `parent_id` | `integer` | 父区域ID（根节点为NULL） |
| `adm_level` | `character varying(5)` | 行政级别（ADM0/1/2） |
| `country_code_alpha2` | `character(2)` | 2位国家编码 |
| `country_code_alpha3` | `character(3)` | 3位国家编码 |

#### 数据样例（CSV，1 行）

```csv
id,area_name_en,area_name_cn,parent_id,adm_level,country_code_alpha2,country_code_alpha3
60101,Vicente Guerrero,__NULL__,2166,ADM2,MX,MEX
```

### `dim_osm_poi_info`

- 行数：`72`
- 表用途/使用场景：筛选器字典、维度映射、下钻
- Superset报表可用性：**可用（维表）**
- 理由：适合做筛选器、字典映射、下钻层级，不建议单独做主指标图。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `integer` | - |
| `tag_key` | `character varying(100)` | - |
| `tag_value` | `character varying(200)` | - |
| `category_desc` | `text` | - |
| `fclass` | `character varying(100)` | - |
| `code` | `integer` | - |
| `is_valid` | `boolean` | - |
| `remark` | `text` | - |
| `create_time` | `timestamp without time zone` | - |
| `update_time` | `timestamp without time zone` | - |

#### 数据样例（CSV，1 行）

```csv
id,tag_key,tag_value,category_desc,fclass,code,is_valid,remark,create_time,update_time
1,amenity,restaurant,提供堂食服务的普通餐厅，含各类菜系,餐饮,2301,True,OSM官方核心餐饮标签,,
```

### `dim_province`

- 行数：`5871`
- 表用途/使用场景：筛选器字典、维度映射、下钻
- Superset报表可用性：**可用（维表）**
- 理由：适合做筛选器、字典映射、下钻层级，不建议单独做主指标图。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `integer` | - |
| `alpha2_code` | `character varying(10)` | - |
| `subdivision_cat` | `character varying(50)` | - |
| `subdivision_name` | `character varying(255)` | - |
| `code_3166_2` | `character varying(50)` | - |
| `lang` | `character varying(50)` | - |
| `validity` | `smallint` | - |
| `create_time` | `timestamp with time zone` | - |
| `update_time` | `timestamp with time zone` | - |

#### 数据样例（CSV，1 行）

```csv
id,alpha2_code,subdivision_cat,subdivision_name,code_3166_2,lang,validity,create_time,update_time
52,DZ,province,Batna,DZ-05,ar,1,2025-10-09T15:32:27.036139+08:00,2025-10-09T15:44:42.331180+08:00
```

### `dw_osm_population_info`

- 行数：`15101`
- 表用途/使用场景：人口与综合指标分析
- Superset报表可用性：**可用**
- 理由：具备国家+时间维度，适合趋势、排行、占比等常规报表。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `country` | `character varying(3)` | - |
| `countryname` | `character varying(100)` | - |
| `provincename` | `character varying(100)` | - |
| `townname` | `character varying(100)` | - |
| `population` | `character varying(100)` | - |
| `sourcepop` | `character varying(300)` | - |
| `populationdate` | `character varying(100)` | - |

#### 数据样例（CSV，1 行）

```csv
country,countryname,provincename,townname,population,sourcepop,populationdate
AFG,阿富汗,,,32738376,,
```

### `dws_osm_road_network_density`

- 行数：`0`
- 表用途/使用场景：基础数据或专题扩展
- Superset报表可用性：**暂不建议**
- 理由：当前空表（0 行），做报表无数据展示价值，可保留结构待后续入库。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `road_subtype` | `character varying(64)` | - |
| `road_class` | `character varying(64)` | - |
| `road_length` | `numeric(16,6)` | - |
| `coverage_area` | `numeric(16,6)` | - |
| `network_density` | `numeric(16,6)` | - |
| `province` | `character varying(164)` | - |
| `grouping_flag` | `character varying(228)` | - |
| `mo` | `character varying(6)` | - |
| `country` | `character varying(3)` | - |

#### 数据样例（CSV，1 行）

```csv
(empty table)
```

### `gadm_country_boundary`

- 行数：`348745`
- 表用途/使用场景：基础数据或专题扩展
- Superset报表可用性：**可用（地图）**
- 理由：含空间几何字段，可用于地图/空间分布图；需控制行数与地图渲染性能。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `bigint` | 自增ID |
| `country_name` | `character varying(128)` | 国家名 |
| `country_code3` | `character varying(10)` | 3字母code |
| `country_code2` | `character varying(10)` | 2字母code |
| `geom` | `geometry` | MultiPolygon |
| `level` | `integer` | 级别 |
| `level_type` | `character varying(50)` | 类型 |
| `level_name` | `character varying(255)` | 名称 |
| `level_id` | `character varying(50)` | 当前id |
| `parent_id` | `character varying(50)` | 上一层id |
| `meta` | `jsonb` | 当条数据原始属性信息 |
| `version` | `character varying(255)` | 数据源版本 |
| `create_time` | `timestamp with time zone` | 创建时间 |
| `update_time` | `timestamp with time zone` | 更新时间 |

#### 数据样例（CSV，1 行）

```csv
id,country_name,country_code3,country_code2,geom,level,level_type,level_name,level_id,parent_id,meta,version,create_time,update_time
1199,UnitedStates,USA,,<geometry>,2,County,Autauga,USA.1.1_1,USA.1_1,"{'CC_2': 'NA', 'GID_0': 'USA', 'GID_1': 'USA.1_1', 'GID_2': 'USA.1.1_1', 'HASC_2': 'US.AL.AU', 'NAME_1': 'Alabama', '...",4.1,2025-09-08T15:03:25+08:00,
```

### `geoboundaries_org_country_boundary`

- 行数：`715`
- 表用途/使用场景：基础数据或专题扩展
- Superset报表可用性：**可用**
- 理由：具备国家+时间维度，适合趋势、排行、占比等常规报表。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `integer` | - |
| `boundary_id` | `character varying(255)` | - |
| `country_name` | `character varying(255)` | - |
| `country_code` | `character varying(10)` | - |
| `represented_year` | `character varying(100)` | - |
| `level` | `character varying(10)` | - |
| `canonical` | `character varying(1000)` | - |
| `boundary_source` | `character varying(1000)` | - |
| `license` | `character varying(1000)` | - |
| `license_source` | `character varying(1000)` | - |
| `boundary_source_url` | `character varying(1000)` | - |
| `source_update_date` | `timestamp with time zone` | - |
| `build_date` | `timestamp with time zone` | - |
| `continent` | `character varying(255)` | - |
| `unsdg_region` | `character varying(255)` | - |
| `unsdg_subregion` | `character varying(255)` | - |
| `adm_unit_count` | `integer` | - |
| `geojson_url` | `character varying(255)` | - |
| `cos_path` | `character varying(255)` | - |
| `create_time` | `timestamp with time zone` | - |
| `update_time` | `timestamp with time zone` | - |

#### 数据样例（CSV，1 行）

```csv
id,boundary_id,country_name,country_code,represented_year,level,canonical,boundary_source,license,license_source,boundary_source_url,source_update_date,build_date,continent,unsdg_region,unsdg_subregion,adm_unit_count,geojson_url,cos_path,create_time,update_time
20,ABW-ADM0-13396579,Aruba,ABW,2021,ADM0,Unknown,Sentinel-2 10m LandCover,Creative Commons Attribution 4.0 (CC BY 4.0),sentinel.esa.int/documents/247904/690755/Sentinel_Data_Legal_Notice,livingatlas.arcgis.com/landcover/,2023-01-19T15:31:04+08:00,2023-12-12T08:00:00+08:00,Latin America and the Caribbean,Latin America and the Caribbean,Caribbean,1,https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/ABW/ADM0/geoBoundaries-ABW-ADM0.geojson,cos://resource-1376202708/geoboundaries/country=ABW/level=ADM0/geoBoundaries-ABW-ADM0.geojson,2025-10-20T19:44:50.906094+08:00,
```

### `gps_trace_data`

- 行数：`8303171`
- 表用途/使用场景：空间覆盖与轨迹/街景专题
- Superset报表可用性：**可用（地图）**
- 理由：含空间几何字段，可用于地图/空间分布图；需控制行数与地图渲染性能。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `bigint` | 自增ID |
| `trace_id` | `bigint` | trace_id |
| `file_name` | `character varying(255)` | 文件名 |
| `point_count` | `integer` | 轨迹点数 |
| `geom` | `geometry` | 起始坐标 |
| `description` | `character varying(1000)` | 描述 |
| `owner` | `character varying(255)` | 上传者 |
| `tags` | `jsonb` | 标签 |
| `visible` | `character varying(1000)` | 公开可见 |
| `upload_time` | `timestamp with time zone` | 轨迹上传时间 |
| `cos_file_url` | `character varying(300)` | 对象存储url，相对路径 |
| `cos_file_type` | `character varying(20)` | 文件类型 |
| `cos_file_size` | `real` | 文件大小,单位MB |
| `source_url` | `character varying(500)` | 原始url |
| `source_name` | `character varying(50)` | 原始出处 |
| `crawl_time` | `timestamp with time zone` | 抓取时间 |
| `status` | `smallint` | 0未下载gpx，1下载成功 |
| `transport_type` | `character varying(100)` | 机动车、徒步、非机动车骑行等类型 |
| `country` | `character varying(10)` | - |

#### 数据样例（CSV，1 行）

```csv
id,trace_id,file_name,point_count,geom,description,owner,tags,visible,upload_time,cos_file_url,cos_file_type,cos_file_size,source_url,source_name,crawl_time,status,transport_type,country
4158821,8061284,2023_06_12T12_54_05.827387Z.gpx,6000,<geometry>,Routes from dragonpilot 0.8.13 (TOYOTA PRIUS 2017).,dragonpilot,"[""None""]","Identifiable (shown in trace list and as identifiable, ordered points with timestamps)",2023-06-12T21:04:00+08:00,gps_traces/om/8061284.gpx,gpx+xml,0.77939796,https://www.openstreetmap.org//user/dragonpilot/traces/8061284,osm,2025-10-06T09:08:29+08:00,1,unknown,CHN
```

### `o_node`

- 行数：`0`
- 表用途/使用场景：基础数据或专题扩展
- Superset报表可用性：**暂不建议**
- 理由：当前空表（0 行），做报表无数据展示价值，可保留结构待后续入库。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `bigint` | - |
| `geom` | `geometry` | - |
| `node_id` | `bigint` | - |
| `tags` | `jsonb` | - |
| `version` | `integer` | - |
| `timestamp` | `timestamp(6) with time zone` | - |
| `changeset` | `bigint` | - |
| `visible` | `boolean` | - |
| `created_at` | `timestamp(6) with time zone` | - |
| `updated_at` | `timestamp(6) with time zone` | - |
| `status` | `smallint` | 0删除，1有效 |

#### 数据样例（CSV，1 行）

```csv
(empty table)
```

### `o_relation`

- 行数：`0`
- 表用途/使用场景：基础数据或专题扩展
- Superset报表可用性：**暂不建议**
- 理由：当前空表（0 行），做报表无数据展示价值，可保留结构待后续入库。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `bigint` | - |
| `geom` | `geometry(GeometryCollection,4326)` | - |
| `relation_id` | `bigint` | - |
| `tags` | `jsonb` | - |
| `members` | `jsonb` | - |
| `version` | `integer` | - |
| `timestamp` | `timestamp(6) with time zone` | - |
| `changeset` | `bigint` | - |
| `visible` | `boolean` | - |
| `created_at` | `timestamp(6) with time zone` | - |
| `updated_at` | `timestamp(6) with time zone` | - |

#### 数据样例（CSV，1 行）

```csv
(empty table)
```

### `o_road`

- 行数：`0`
- 表用途/使用场景：基础数据或专题扩展
- Superset报表可用性：**暂不建议**
- 理由：当前空表（0 行），做报表无数据展示价值，可保留结构待后续入库。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `bigint` | - |
| `geom` | `geometry` | 几何形状 |
| `road_id` | `bigint` | - |
| `tags` | `jsonb` | - |
| `nodes` | `jsonb` | - |
| `version` | `integer` | - |
| `timestamp` | `timestamp(6) with time zone` | - |
| `changeset` | `bigint` | - |
| `visible` | `boolean` | - |
| `created_at` | `timestamp(6) with time zone` | - |
| `updated_at` | `timestamp(6) with time zone` | - |

#### 数据样例（CSV，1 行）

```csv
(empty table)
```

### `openaddress_job_info`

- 行数：`748573`
- 表用途/使用场景：基础数据或专题扩展
- Superset报表可用性：**条件可用**
- 理由：可做表格或专题图，需结合业务口径定义指标与筛选条件。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `bigint` | - |
| `job_id` | `character varying(50)` | - |
| `run` | `bigint` | - |
| `created` | `timestamp with time zone` | - |
| `source_name` | `character varying(255)` | - |
| `layer` | `character varying(50)` | - |
| `name` | `character varying(40)` | - |
| `status` | `character varying(10)` | - |
| `file_size` | `bigint` | - |
| `source_url` | `character varying(1000)` | - |
| `output_validated` | `boolean` | - |
| `crawl_time` | `timestamp with time zone` | - |
| `update_time` | `timestamp with time zone` | - |

#### 数据样例（CSV，1 行）

```csv
id,job_id,run,created,source_name,layer,name,status,file_size,source_url,output_validated,crawl_time,update_time
5423,743693,11876,2026-01-03T19:01:48.671000+08:00,fr/02/statewide,buildings,state,Success,35591082,https://github.com/openaddresses/openaddresses/raw/7cdbe5fab9911aadf28235f0c8d917d8f7e54416/sources/fr/02/statewide.json,False,2026-01-05T17:21:15.557000+08:00,
```

### `overture_area_population`

- 行数：`670620`
- 表用途/使用场景：人口与综合指标分析
- Superset报表可用性：**可用**
- 理由：具备国家维度，可做国家级对比、排行、占比图。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `country` | `character varying(30)` | - |
| `subtype` | `character varying(100)` | - |
| `subtype_cn` | `character varying(100)` | - |
| `area` | `integer` | - |
| `population` | `integer` | - |

#### 数据样例（CSV，1 行）

```csv
country,subtype,subtype_cn,area,population
GBR,locality,聚居区,,8114
```

### `rels_all`

- 行数：`286481`
- 表用途/使用场景：基础数据或专题扩展
- Superset报表可用性：**条件可用**
- 理由：可做表格或专题图，需结合业务口径定义指标与筛选条件。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `bigint` | - |
| `members` | `character varying` | - |
| `tags` | `character varying` | - |

#### 数据样例（CSV，1 行）

```csv
id,members,tags
2180,"[{""ref"":8584638,""role"":"""",""type"":""w""},{""ref"":8584639,""role"":"""",""type"":""w""},{""ref"":8584640,""role"":"""",""type"":""w""}]","{""route"":""road"",""name"":""Continentalstraße"",""type"":""route""}"
```

### `road_overture_osm_compare_m`

- 行数：`198`
- 表用途/使用场景：道路专题分析（长度、趋势、对比）
- Superset报表可用性：**可用**
- 理由：具备国家维度，可做国家级对比、排行、占比图。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `country` | `character varying(3)` | - |
| `overture_total` | `bigint` | - |
| `overture_total2` | `bigint` | - |
| `osm_total` | `bigint` | - |
| `matched_count` | `bigint` | - |
| `overture_only_count` | `bigint` | - |
| `osm_only_count` | `bigint` | - |
| `match_rate` | `numeric(10,4)` | - |

#### 数据样例（CSV，1 行）

```csv
country,overture_total,overture_total2,osm_total,matched_count,overture_only_count,osm_only_count,match_rate
AFG,259371,0,260126,259344,27,782,0.9999
```

### `satellite_images`

- 行数：`0`
- 表用途/使用场景：空间覆盖与轨迹/街景专题
- Superset报表可用性：**暂不建议**
- 理由：当前空表（0 行），做报表无数据展示价值，可保留结构待后续入库。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `bigint` | - |
| `file_path` | `character varying(512)` | - |
| `coordinate_z` | `integer` | - |
| `coordinate_x` | `integer` | - |
| `coordinate_y` | `integer` | - |
| `capture_date` | `timestamp(6) with time zone` | - |
| `version` | `character varying(254)` | - |
| `md5` | `character varying(254)` | - |
| `resolution` | `character varying(254)` | - |
| `provider` | `character varying(254)` | - |
| `extent` | `geometry` | - |
| `metadata` | `jsonb` | - |
| `created_at` | `timestamp(6) with time zone` | - |
| `updated_at` | `timestamp(6) with time zone` | - |

#### 数据样例（CSV，1 行）

```csv
(empty table)
```

### `spatial_ref_sys`

- 行数：`8500`
- 表用途/使用场景：基础数据或专题扩展
- Superset报表可用性：**条件可用**
- 理由：可做表格或专题图，需结合业务口径定义指标与筛选条件。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `srid` | `integer` | - |
| `auth_name` | `character varying(256)` | - |
| `auth_srid` | `integer` | - |
| `srtext` | `character varying(2048)` | - |
| `proj4text` | `character varying(2048)` | - |

#### 数据样例（CSV，1 行）

```csv
srid,auth_name,auth_srid,srtext,proj4text
2000,EPSG,2000,"PROJCS[""Anguilla 1957 / British West Indies Grid"",GEOGCS[""Anguilla 1957"",DATUM[""Anguilla_1957"",SPHEROID[""Clarke 1880 ...",+proj=tmerc +lat_0=0 +lon_0=-62 +k=0.9995000000000001 +x_0=400000 +y_0=0 +ellps=clrk80 +units=m +no_defs
```

### `street_views`

- 行数：`187626`
- 表用途/使用场景：空间覆盖与轨迹/街景专题
- Superset报表可用性：**可用（地图）**
- 理由：含空间几何字段，可用于地图/空间分布图；需控制行数与地图渲染性能。

#### 字段结构表

| 字段名 | 数据类型 | 字段注释 |
|---|---|---|
| `id` | `bigint` | - |
| `panoid` | `character varying(255)` | 拍摄点ID |
| `country` | `character varying(255)` | - |
| `bbox` | `geometry` | 复制路口bbox |
| `geom` | `geometry` | 拍摄点gps |
| `img_list` | `jsonb` | - |
| `photo_time` | `timestamp with time zone` | 拍摄时间yyyy-mm |
| `crawl_from` | `character varying(255)` | 枚举：search，nearby |
| `origin_data` | `jsonb` | 原始数据 |
| `create_time` | `timestamp with time zone` | - |
| `update_time` | `timestamp with time zone` | - |
| `location` | `jsonb` | 拍摄点位置信息 |
| `trans_label` | `text` | - |
| `status` | `smallint` | 是否已下载图片 |

#### 数据样例（CSV，1 行）

```csv
id,panoid,country,bbox,geom,img_list,photo_time,crawl_from,origin_data,create_time,update_time,location,trans_label,status
47132,FvucdQg0-Y8HlZJ69mm8Cg,MY,<geometry>,<geometry>,,2020-10-01T08:00:00+08:00,nearby,"[[2, ""FvucdQg0-Y8HlZJ69mm8Cg""], null, [[null, null, 3.176487217564434, 101.6772332949497], [51.75071334838867, null, ...",2025-11-10T20:01:41.731685+08:00,2025-11-18T21:50:22.564411+08:00,"[[""Kuala Lumpur, Federal Territory of Kuala Lumpur"", ""en""]]",pred_410219_257515,0
```
