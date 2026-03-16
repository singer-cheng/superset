---
name: superset-operations
description: 通过 MCP 和 REST API 操控 Apache Superset 看板、图表、数据集。当用户提到 Superset、看板、仪表盘、图表配色、数据集 SQL、筛选器、Cross-filter、BI 展示等关键词时使用本 skill。
---

# Superset 操作指南

## 连接信息

从项目规则 `.cursor/rules/superset-config.mdc` 获取地址与凭据。

## 工具选择策略

| 操作 | 首选工具 | 备注 |
|------|----------|------|
| 查询看板/图表/数据集 | MCP `user-superset` | 直接可用，无需认证 |
| 创建/更新图表 params | MCP `superset_chart_update` | 正常工作 |
| 更新数据集 SQL | MCP `superset_dataset_sql_search_replace` | 正常工作 |
| 更新数据集列/指标 | MCP `superset_dataset_update` | 正常工作 |
| **修改看板 json_metadata** | **REST API（curl）** | MCP 会合并而非替换，无法删除字段 |

## MCP 工具使用

### 查询

```
superset_dashboard_list     → 列出看板
superset_dashboard_get_by_id → 获取看板详情（含 json_metadata、position_json）
superset_chart_list          → 列出图表
superset_chart_get_by_id     → 获取图表详情（含 params）
superset_dataset_list        → 列出数据集
superset_dataset_get_by_id   → 获取数据集详情（含 SQL、columns、metrics）
```

### 修改图表

`superset_chart_update` payload 中 `params` 为 **JSON 字符串**。

常用 world_map params 字段：
- `entity`：国家列名（需与其他图表一致以支持 Cross-filter）
- `country_fieldtype`：`cca3`（ISO 3166-1 alpha-3）
- `metric`：指标配置
- `linear_color_scheme`：sequential 色板 id（如 `schemeRdBu`）
- `color_by`：`metric`（按指标着色）或 `country`（按国家分类着色）

### 修改数据集 SQL

```
superset_dataset_sql_search_replace
  dataset_id: 数据集 ID
  search: 要替换的 SQL 片段
  replace: 替换后的 SQL 片段
```

该工具会先验证 SQL 合法性再更新。

## REST API 操作看板 json_metadata

当 MCP 无法可靠修改 `json_metadata` 时（如清除 `color_scheme`、修改 `native_filter_configuration`），使用以下流程：

### 步骤 1：获取 Session + Token

```bash
SUPERSET_URL="http://172.22.67.236"
COOKIE_JAR="/tmp/superset_cookies.txt"

# 登录获取 access_token
curl -s -c "$COOKIE_JAR" -X POST "$SUPERSET_URL/api/v1/security/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"tnq_PWV0kex3tpr1ber","provider":"db","refresh":true}' \
  > /tmp/superset_login.json

ACCESS_TOKEN=$(python3 -c "import json; print(json.load(open('/tmp/superset_login.json'))['access_token'])")

# 获取 CSRF token（必须带 session cookie）
CSRF_TOKEN=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  "$SUPERSET_URL/api/v1/security/csrf_token/" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['result'])")
```

### 步骤 2：构造 json_metadata 并 PUT

```bash
# 用 python3 构造 payload（避免 shell 转义问题）
curl -s -b "$COOKIE_JAR" -X PUT "$SUPERSET_URL/api/v1/dashboard/{DASHBOARD_ID}" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-CSRFToken: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Referer: $SUPERSET_URL/" \
  -d "$(python3 -c "
import json
meta = {
    # 完整的 json_metadata 内容，不包含要删除的字段
}
print(json.dumps({'json_metadata': json.dumps(meta)}))
")"
```

### 关键注意事项

- `json_metadata` 值必须是 **JSON 字符串**（双重序列化）
- 必须同时带 `Authorization`、`X-CSRFToken`、Session Cookie（`-b $COOKIE_JAR`）和 `Referer`
- 不带 Session Cookie 会报 `CSRF session token is missing`

## Native Filter 配置（关键）

通过 API 创建看板原生筛选器时，必须包含以下**必填字段**，否则前端无法识别筛选器（显示为 "[untitled customization]"），导致 Apply Filters 按钮灰色、图表不刷新。

### 正确的 native_filter_configuration 模板

```python
{
    'id': 'NATIVE_FILTER-XXX',           # 必须以 NATIVE_FILTER- 开头
    'name': '筛选器名称',
    'filterType': 'filter_select',        # filter_select / filter_time / filter_range
    'targets': [{'datasetId': 23, 'column': {'name': 'col_name'}}],
    'defaultDataMask': {
        'extraFormData': {},              # ← 必填，不能省略
        'filterState': {'value': None},
        'ownState': {}                    # ← 必填，不能省略
    },
    'controlValues': {
        'enableEmptyFilter': False,
        'multiSelect': False,             # True 允许多选
        'inverseSelection': False,
        'defaultToFirstItem': False,
        'searchAllOptions': False          # True 启用搜索全部选项
    },
    'cascadeParentIds': [],
    'scope': {'rootPath': ['ROOT_ID'], 'excluded': []},
    'type': 'NATIVE_FILTER',             # ← 必填！标识为原生筛选器
    'chartsInScope': [104, 105, ...],    # ← 必填！看板上所有图表 ID
    'tabsInScope': [],                   # ← 必填！看板上的标签页
    'isInstant': True,                   # True=即时过滤 / False=需点击 Apply
    'description': ''
}
```

### 必填字段说明

| 字段 | 作用 | 缺失后果 |
|------|------|---------|
| `type: "NATIVE_FILTER"` | 标识为原生筛选器 | 显示为 "[untitled customization]" |
| `chartsInScope` | 筛选器作用于哪些图表 | Apply Filters 灰色，图表不刷新 |
| `tabsInScope` | 筛选器作用于哪些标签页 | 筛选器作用域计算异常 |
| `defaultDataMask.extraFormData` | 筛选器额外表单数据 | 前端状态初始化失败 |
| `defaultDataMask.ownState` | 筛选器自有状态 | 前端状态初始化失败 |

### 获取 chartsInScope

从看板的 `position_json` 中提取所有图表 ID：

```python
import json
pos = json.loads(dashboard['position_json'])
chart_ids = [v['meta']['chartId'] for v in pos.values()
             if isinstance(v, dict) and v.get('type') == 'CHART']
```

### 完整创建示例

```bash
curl -s -b "$COOKIE_JAR" -X PUT "$SUPERSET_URL/api/v1/dashboard/{ID}" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-CSRFToken: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Referer: $SUPERSET_URL/" \
  -d "$(python3 -c "
import json
all_chart_ids = [104, 105, 106, 107, 108, 109, 110, 111]
meta = {
    'native_filter_configuration': [
        {
            'id': 'NATIVE_FILTER-TYPE',
            'name': '采集类型',
            'filterType': 'filter_select',
            'targets': [{'datasetId': 23, 'column': {'name': 'type'}}],
            'defaultDataMask': {
                'extraFormData': {},
                'filterState': {'value': None},
                'ownState': {}
            },
            'controlValues': {
                'enableEmptyFilter': False,
                'multiSelect': False,
                'inverseSelection': False,
                'defaultToFirstItem': False,
                'searchAllOptions': False
            },
            'cascadeParentIds': [],
            'scope': {'rootPath': ['ROOT_ID'], 'excluded': []},
            'type': 'NATIVE_FILTER',
            'chartsInScope': all_chart_ids,
            'tabsInScope': [],
            'isInstant': True,
            'description': ''
        }
    ],
    # ... 其他 json_metadata 字段
}
print(json.dumps({'json_metadata': json.dumps(meta)}))
")"
```

### 常见问题排查

| 现象 | 原因 | 修复 |
|------|------|------|
| 筛选器显示 "[untitled customization]" | 缺少 `type: "NATIVE_FILTER"` | 补充该字段 |
| Apply Filters 按钮灰色 | 缺少 `chartsInScope` | 补充看板所有图表 ID |
| 选择值后图表不刷新 | 缺少 `chartsInScope` + `type` | 同时补充两个字段 |
| 筛选器下拉框为空 | `targets.datasetId` 或 `column.name` 错误 | 检查数据集和列名 |
| 即时过滤不生效 | `isInstant: false` | 改为 `true`；或手动点击 Apply |

## Cross-filter 配置要点

- Superset cross-filter 要求**发出端与接收端列名一致**
- 地图数据集若只有 `country_code3`，其他图表用 `country`，则不会联动
- 解决方案：在地图 SQL 里加 `AS country`，图表 entity 也选 `country`

## 看板配色与图表配色

- 看板 `json_metadata.color_scheme` 会覆盖图表级配色
- 若需图表单独控制配色，必须**清空看板的 color_scheme**
- 世界地图用 `linear_color_scheme`（sequential），其他图表用 `color_scheme`（categorical）

## 内置 Sequential 色板（常用）

| id | 说明 |
|----|------|
| `schemeRdBu` | 红→蓝（diverging） |
| `schemeBlues` | 浅蓝→深蓝 |
| `schemeReds` | 浅红→深红 |
| `schemeYlOrRd` | 黄→橙→红 |
| `schemeViridis` | 紫→蓝→绿→黄 |
| `schemeInferno` | 黑→紫→红→黄 |
| `schemeSpectral` | 彩虹 |

自定义色板需在 `superset_config.py` 中配置 `EXTRA_SEQUENTIAL_COLOR_SCHEMES`。
