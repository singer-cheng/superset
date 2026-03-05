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
import { ChartProps, getMetricLabel } from '@superset-ui/core';
import { cellToLatLng, latLngToCell, isValidCell } from 'h3-js';
import {
  createBaseTransformResult,
  getRecordsFromQuery,
  parseMetricValue,
  addPropertiesToFeature,
} from '../transformUtils';
import { DataRecord } from '../spatialUtils';
import { DeckH3FormData } from './buildQuery';

export interface H3Feature {
  hexagon: string;
  metricValue?: number;
  extraProps?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Heals malformed H3 index strings (e.g. 14-char hex) by re-indexing
 * based on coordinates derived from the best-effort parsing.
 */
function healH3Index(hex: string): string {
  if (isValidCell(hex)) {
    return hex;
  }
  try {
    const [lat, lng] = cellToLatLng(hex);
    let res = 8; // Default resolution for healing if not detectable
    if (hex.length >= 2 && hex.startsWith('8')) {
      const resChar = hex.charAt(1);
      const detectedRes = parseInt(resChar, 16);
      if (detectedRes >= 0 && detectedRes <= 15) {
        res = detectedRes;
      }
    }
    return latLngToCell(lat, lng, res);
  } catch {
    return hex;
  }
}

function processH3Data(
  records: DataRecord[],
  formData: DeckH3FormData,
): H3Feature[] {
  const { h3_index_column, metric } = formData;

  if (!h3_index_column || !records.length) {
    return [];
  }

  const metricLabel = metric ? getMetricLabel(metric) : undefined;
  const excludeKeys = new Set([h3_index_column]);

  return records
    .map(record => {
      const rawH3 = record[h3_index_column];
      if (rawH3 == null || String(rawH3).trim() === '') {
        return null;
      }

      const hexagon = healH3Index(String(rawH3).trim());
      const feature: H3Feature = {
        hexagon,
        extraProps: {},
      };

      const updated = addPropertiesToFeature(
        feature as unknown as Record<string, unknown>,
        record,
        excludeKeys,
      ) as unknown as H3Feature;

      if (metricLabel != null && record[metricLabel] != null) {
        const value = parseMetricValue(record[metricLabel]);
        if (value !== undefined) {
          updated.metricValue = value;
        }
      }

      return updated;
    })
    .filter((f): f is H3Feature => f !== null);
}

export default function transformProps(chartProps: ChartProps) {
  const { rawFormData: formData } = chartProps;
  const records = getRecordsFromQuery(chartProps.queriesData);
  const features = processH3Data(records, formData as DeckH3FormData);

  const metricLabel =
    formData.metric != null ? getMetricLabel(formData.metric) : undefined;
  const metricLabels = metricLabel ? [metricLabel] : [];

  return createBaseTransformResult(chartProps, features, metricLabels);
}
