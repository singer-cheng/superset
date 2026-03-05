# Apache Superset H3 地图插件技术方案

**文档版本：** v1.1 · **编写日期：** 2026年3月 · **目标版本：** Apache Superset 4.x

---

## 1. 背景与目标

Apache Superset 目前不原生支持 H3 六边形地图（H3HexagonLayer）。社区 Discussion #18643 中有多人提出该需求，但截至目前无人提交 PR。本方案通过向 Superset 源码中添加 H3 Layer 插件，为平台提供完整的 H3 地图可视化能力。

### 1.1 核心需求

- 支持在 Superset 中渲染 H3 六边形网格地图
- 支持颜色映射（Heatmap），基于数值指标对六边形着色
- 支持全球范围地图，可缩放、平移
- 通过 Superset 控制面板配置字段和样式，无需写代码

### 1.2 不在范围内（本期）

- 3D 高度柱状渲染
- 多分辨率自动聚合
- 时间轴动画

---

## 2. 技术架构

Superset 的地图图表基于 deck.gl 构建，底图使用 Mapbox / MapLibre GL。`H3HexagonLayer` 是 `@deck.gl/geo-layers` 包中的官方内置图层，可以直接接受 H3 index 字符串进行渲染，**无需预先转换为 GeoJSON**，性能优于 GeoJSON 方案。

### 2.1 数据流

```
数据库 → Superset 后端 → API → 前端 React 组件 → deck.gl H3HexagonLayer → MapLibre/Mapbox 底图
```

### 2.2 依赖栈

| 组件 | 版本要求 | 说明 |
|------|----------|------|
| `@deck.gl/geo-layers` | ^8.x / ^9.x | 提供 H3HexagonLayer，Superset 已有此依赖 |
| `h3-js` | ^4.x | H3 index 校验与辅助计算，**需新增依赖** |
| `d3-scale` / `d3-scale-chromatic` | 已内置 | 颜色映射色阶，Superset 已引入 |
| MapLibre GL / Mapbox GL | 已内置 | 底图渲染，与其他 deck.gl 图层共用 |

---

## 3. 文件改动清单

所有改动均在前端目录下，**不涉及 Python 后端修改**。

| 文件路径 | 操作 | 说明 |
|----------|------|------|
| `plugins/legacy-preset-chart-deckgl/src/layers/H3/H3.tsx` | 新建 | 主组件，构建 H3HexagonLayer |
| `plugins/legacy-preset-chart-deckgl/src/layers/H3/controlPanel.ts` | 新建 | 控制面板配置（字段选择、颜色等）|
| `plugins/legacy-preset-chart-deckgl/src/layers/H3/index.ts` | 新建 | 模块导出 |
| `plugins/legacy-preset-chart-deckgl/src/layers/H3/transformProps.ts` | 新建 | 数据转换（API 响应 → Layer 数据格式）|
| `plugins/legacy-preset-chart-deckgl/src/preset.ts` | 修改 | 注册 H3 插件到 MainPreset |
| `plugins/legacy-preset-chart-deckgl/package.json` | 修改 | 添加 h3-js 依赖 |

---

## 4. 核心实现

### 4.1 数据格式要求

数据库中需要有以下两列（列名可在控制面板中配置）：

| 字段 | 类型 | 示例 | 说明 |
|------|------|------|------|
| `h3_index` | VARCHAR / TEXT | `8928308280fffff` | H3 六边形索引，分辨率 0-15 |
| `metric` | NUMERIC | `1234.56` | 用于颜色映射的数值指标 |

> **H3 分辨率建议：** 城市级用 7-9，全国级用 4-6，全球级用 1-3。分辨率越高六边形越小，数据量越大。

### 4.2 H3.tsx 主组件（核心逻辑）

```tsx
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { scaleSequential } from 'd3-scale';
import { interpolateYlOrRd } from 'd3-scale-chromatic';

// 构建颜色映射
const values = data.map(d => d[metricCol]);
const [minVal, maxVal] = [Math.min(...values), Math.max(...values)];
const colorScale = scaleSequential(interpolateYlOrRd).domain([minVal, maxVal]);

// 构建 H3HexagonLayer
const layer = new H3HexagonLayer({
  id: 'h3-hexagon-layer',
  data: rows,
  getHexagon: d => d[h3IndexCol],         // 控制面板选择的字段
  getFillColor: d => {
    const rgb = colorScale(d[metricCol]); // 返回 'rgb(r,g,b)'
    return [...parseRgb(rgb), 200];        // 带透明度
  },
  pickable: true,
  stroked: true,
  lineWidthMinPixels: 1,
  getLineColor: [255, 255, 255, 60],
  extruded: false,                         // 保持 2D 平面
  coverage: 0.9,
});
```

### 4.3 控制面板配置项

| 配置项 | 类型 | 说明 |
|--------|------|------|
| H3 Index 字段 | 列选择器 | 选择数据集中存储 H3 index 的列 |
| 指标字段 | 列选择器 | 选择用于颜色映射的数值列 |
| 色阶方案 | 下拉选择 | YlOrRd / Blues / Viridis / Plasma 等 |
| 色阶反转 | 开关 | 反转颜色方向 |
| 六边形透明度 | 滑块 0-100 | 控制填充透明度 |
| 显示边框 | 开关 | 是否显示六边形边框线 |
| Tooltip 字段 | 多选 | 鼠标悬浮时显示的附加字段 |
| Row Limit | 数字输入 | 最大数据行数，默认 50,000 |

### 4.4 注册插件

在 `preset.ts` 中添加：

```ts
import H3ChartPlugin from './layers/H3';

// 在 plugins 数组中添加
new H3ChartPlugin().configure({ key: 'deck_h3' }),
```

---

## 5. 实施计划

| 阶段 | 任务 | 预估工时 | 产出 |
|------|------|----------|------|
| 阶段一 | 搭建 H3/ 目录骨架，完成 `index.ts` 和 `transformProps.ts` | 0.5 天 | 可编译通过的空插件 |
| 阶段一 | 实现 `H3.tsx` 核心渲染逻辑，接入 H3HexagonLayer | 1 天 | 基础地图可渲染 |
| 阶段二 | 实现 `controlPanel.ts`，接入字段选择和颜色配置 | 1 天 | 控制面板可用 |
| 阶段二 | 实现 Tooltip 和图例（Legend） | 0.5 天 | 交互完整 |
| 阶段三 | 联调测试：不同分辨率、大数据量性能测试 | 1 天 | 稳定可用 |
| 阶段三 | 文档与 PR 提交（可选回馈社区） | 0.5 天 | 开源 PR |

**总预估工时：4.5 个工作日**

---

## 6. 风险与注意事项

### 6.1 Mapbox Token

Superset 的 deck.gl 图层依赖 Mapbox GL JS，使用 Mapbox 底图需要配置 token（`MAPBOX_API_KEY`）。如果希望免费使用，可切换为 MapLibre GL（Superset 已支持，在 `superset_config.py` 中配置）。

### 6.2 大数据量性能

H3HexagonLayer 相比 GeoJSON 方案性能更优，因为六边形形状由 deck.gl 在 GPU 中实时计算，不传输多边形坐标。但若数据行数超过 10 万，仍需在 Superset 后端做 Row Limit 限制或预聚合。

> **建议** 在控制面板中提供 Row Limit 配置项，默认设为 50,000。

### 6.3 deck.gl 版本兼容

不同 Superset 版本捆绑的 deck.gl 版本可能不同。H3HexagonLayer 在 deck.gl 8.x 和 9.x 中参数略有差异，需确认当前 Superset 版本的 deck.gl 版本后调整 API 调用。

---

## 7. 后续扩展方向（可选）

- **3D 高度渲染：** 开启 `extruded: true`，加入 `getElevation` 映射，适合展示密度分布
- **多分辨率自动聚合：** 根据地图缩放级别动态切换 H3 分辨率
- **时间轴支持：** 配合 Superset 时间过滤器实现动态播放
- **回馈社区：** 整理为 PR 提交，响应 Discussion #18643

---

## 8. 测试图表创建（crawler_db.h3_test_data）

若已在 `crawler_db` 中创建了 `h3_test_data` 表，可用以下方式创建 H3 测试图表。

h3 图表 Map Style 用 Topography(OSM) 底图，国内只有这个能显示

### 8.1 脚本创建（推荐）

在项目根目录进入 Superset Shell 后执行：

```bash
superset shell
```

```python
exec(open("scripts/create_h3_test_chart.py").read())
```

或指定列名（表结构与默认 `h3_index` / `value` 不一致时）：

```python
from scripts.create_h3_test_chart import run_create_h3_test_chart
run_create_h3_test_chart(h3_index_column="你的H3列名", metric_column="你的数值列名")
```

脚本会：1）如不存在则创建 `h3_test_data` 数据集；2）创建一张使用「deck.gl H3 Hexagon」的图表。

### 8.2 界面创建

1. **数据 → 数据集**：如无 `h3_test_data`，点「+ 数据集」，选数据库 `crawler_db`、表 `h3_test_data`，保存。
2. **图表 → + 图表**：数据源选刚建的数据集，可视化类型选 **「deck.gl H3 Hexagon」**。
3. 在 **Query** 中：**H3 Index Column** 选 H3 索引列，**Metric** 选用于颜色映射的指标（可选）。
4. 保存图表。

---

## 9. 问题排查与修复记录

> 本节记录 H3 插件开发过程中遇到的实际问题及解决方案，供后续维护参考。

### 9.1 图表无法渲染 - 2026年3月

**问题现象：**
- 图表创建后地图区域空白，无六边形渲染
- 开发者工具 Console 无报错

**排查过程：**

1. **检查数据源**：API 返回数据正常，包含 10 行 H3 索引和数值
2. **检查图表配置**：
   - Metric 设置为 `COUNT(*)`，应为具体数值列（如 `SUM(metric)`）
   - Viewport 聚焦中国区域（经度 118°E，纬度 36°N）
   - Auto Zoom 未启用
3. **代码调试**：
   - 在 `transformProps.ts` 中添加 console.log，发现 `metricValue` 始终为 undefined
   - 根因：`getMetricLabelFromFormData` 无法处理 adhoc metric 格式 `{aggregate: SUM, column: {...}, ...}`，返回 undefined

**修复措施：**

1. 图表配置修复：
   - Metric 改为 `SUM(metric)`
   - 启用 Auto Zoom
   - 保存图表

2. 代码修复（`transformProps.ts`）：

```typescript
// 修改前 - 无法处理 adhoc metrics
const metricLabel = getMetricLabelFromFormData(metric);

// 修改后 - 直接使用 getMetricLabel
import { getMetricLabel } from '@superset-ui/core';
const metricLabel = getMetricLabel(metric);
```

3. H3 索引修复 - 添加 "healing" 函数：

```typescript
function healH3Index(h3Index: string): string {
  if (h3Index.length === 15 && /^[0-9a-f]+$/.test(h3Index)) {
    return h3Index;
  }
  if (h3Index.length === 14 && /^[0-9a-f]+$/.test(h3Index)) {
    const padded = h3Index + 'f';
    try {
      const coords = h3ToGeo(padded);
      const reindexed = geoToH3(coords[0], coords[1], 9);
      if (reindexed) return reindexed;
    } catch {}
  }
  return h3Index;
}
```

**修复结果：**
- 地图成功渲染喀麦隆森林区域的彩色六边形
- API 数据正确映射到六边形颜色

### 9.2 常见问题清单

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 地图空白 | Metric 使用 COUNT(*) | 改为 SUM(数值列) |
| 地图空白 | H3 索引格式错误（14字符） | 添加 healing 函数修复 |
| 位置错误 | getMetricLabelFromFormData 不支持 adhoc | 改用 getMetricLabel(metric) |
| 视图不对 | Viewport 聚焦错误区域 | 启用 Auto Zoom |
| 无颜色 | 色阶 domain 计算错误 | 检查数值类型是否为 number |

---

## 10. 核心文件参考

| 文件 | 作用 |
|------|------|
| `layers/H3/H3.tsx` | 主组件，构建 H3HexagonLayer |
| `layers/H3/transformProps.ts` | 数据转换，包含 metric 提取和 H3 healing |
| `layers/H3/controlPanel.ts` | 控制面板配置 |
| `layers/H3/buildQuery.ts` | 查询构建 |

---

*Apache Superset H3 地图插件方案 v1.0*
