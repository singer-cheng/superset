/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { rgb } from 'd3-color';
import { extent } from 'd3-array';
import {
  getSequentialSchemeRegistry,
  JsonObject,
  QueryFormData,
} from '@superset-ui/core';
import { cellToLatLng } from 'h3-js';

import { GetLayerType, createDeckGLComponent } from '../../factory';
import { createTooltipContent } from '../../utilities/tooltipUtils';
import TooltipRow from '../../TooltipRow';
import { commonLayerProps } from '../common';
import { H3Feature } from './transformProps';
import { DeckH3FormData } from './buildQuery';
import { Point } from '../../types';

function parseColorToRgba(
  color: string,
  alpha: number,
): [number, number, number, number] {
  const c = rgb(color);
  return [c.r, c.g, c.b, Math.round(alpha)];
}

function defaultTooltipGenerator(o: JsonObject, formData: QueryFormData) {
  const fd = formData as DeckH3FormData;
  const metricLabel = fd.metric ? String(fd.metric).replace(/^.*\./, '') : '';
  const value = o.object?.metricValue ?? o.object?.metric_value;

  return (
    <div className="deckgl-tooltip">
      <TooltipRow label="H3: " value={o.object?.hexagon} />
      {metricLabel && (
        <TooltipRow
          label={`${metricLabel}: `}
          value={value != null ? value : '—'}
        />
      )}
    </div>
  );
}

export const getLayer: GetLayerType<InstanceType<typeof H3HexagonLayer>> =
  function ({
    formData,
    payload,
    setTooltip,
    onContextMenu,
    filterState,
    setDataMask,
    emitCrossFilters,
  }) {
    const fd = formData as DeckH3FormData;
    const data = (payload.data.features || []) as H3Feature[];

    if (!data.length) {
      return new H3HexagonLayer({
        id: `h3-layer-${fd.slice_id}`,
        data: [],
        getHexagon: (d: H3Feature) => d.hexagon,
        getFillColor: [0, 0, 0, 0],
      });
    }

    const linearColorScheme = fd.linear_color_scheme ?? 'superset_seq_1';
    const colorScheme = getSequentialSchemeRegistry().get(linearColorScheme);
    const metricValues = data
      .map(d => d.metricValue)
      .filter((v): v is number => v != null && Number.isFinite(v));
    const domain = metricValues.length
      ? (extent(metricValues) as [number, number])
      : [0, 1];
    if (fd.color_scheme_reverse) {
      domain.reverse();
    }
    const colorScale = colorScheme?.createLinearScale(domain);

    const fillOpacity = Math.max(0, Math.min(100, fd.h3_fill_opacity ?? 90));
    const alpha = Math.round((fillOpacity / 100) * 255);

    const getFillColor = (d: H3Feature): [number, number, number, number] => {
      const val = d.metricValue;
      if (val == null || !Number.isFinite(val) || !colorScale) {
        return [160, 160, 160, alpha];
      }
      const color = colorScale(val) || '';
      return parseColorToRgba(color, alpha);
    };

    const tooltipContent = createTooltipContent(fd, (o: JsonObject) =>
      defaultTooltipGenerator(o, fd),
    );

    return new H3HexagonLayer({
      id: `h3-layer-${fd.slice_id}`,
      data,
      getHexagon: (d: H3Feature) => d.hexagon,
      getFillColor,
      stroked: fd.stroked ?? false,
      lineWidthMinPixels: 1,
      getLineColor: [255, 255, 255, 60],
      extruded: false,
      coverage: 0.9,
      ...commonLayerProps({
        formData: fd,
        setTooltip,
        setTooltipContent: tooltipContent,
        setDataMask,
        filterState,
        onContextMenu,
        emitCrossFilters,
      }),
      pickable: true,
    });
  };

export function getPoints(data: JsonObject[]): Point[] {
  const points: Point[] = [];
  data.forEach((d: JsonObject) => {
    const hex = d.hexagon as string;
    if (hex && typeof hex === 'string') {
      try {
        const [lat, lng] = cellToLatLng(hex);
        points.push([lng, lat]);
      } catch {
        // skip invalid H3 index
      }
    }
  });
  return points;
}

export default createDeckGLComponent(getLayer, getPoints);
