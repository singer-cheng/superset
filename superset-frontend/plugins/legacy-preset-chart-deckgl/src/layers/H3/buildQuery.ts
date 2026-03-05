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
import {
  buildQueryContext,
  ensureIsArray,
  getMetricLabel,
  QueryObjectFilterClause,
  QueryObject,
  QueryFormColumn,
  QueryFormMetric,
  SqlaFormData,
} from '@superset-ui/core';
import { addTooltipColumnsToQuery } from '../buildQueryUtils';

export interface DeckH3FormData extends SqlaFormData {
  h3_index_column?: string;
  metric?: string;
  filter_nulls?: boolean;
  tooltip_contents?: unknown[];
  tooltip_template?: string;
  row_limit?: number;
}

const DEFAULT_ROW_LIMIT = 50000;

export default function buildQuery(formData: DeckH3FormData) {
  const {
    h3_index_column,
    metric,
    filter_nulls = true,
    tooltip_contents,
    row_limit = DEFAULT_ROW_LIMIT,
  } = formData;

  if (!h3_index_column) {
    throw new Error('H3 index column is required for H3 charts');
  }

  return buildQueryContext(formData, (baseQueryObject: QueryObject) => {
    let columns: QueryFormColumn[] = [
      ...ensureIsArray(baseQueryObject.columns || []),
      h3_index_column,
    ];

    columns = addTooltipColumnsToQuery(columns, tooltip_contents);

    const metrics: QueryFormMetric[] = [];
    if (metric) {
      metrics.push(metric);
    }

    const filters = ensureIsArray(baseQueryObject.filters || []);
    if (filter_nulls) {
      const nullFilters: QueryObjectFilterClause[] = [
        { col: h3_index_column, op: 'IS NOT NULL' },
      ];
      if (metric) {
        nullFilters.push({
          col: getMetricLabel(metric),
          op: 'IS NOT NULL',
        });
      }
      filters.push(...nullFilters);
    }

    return [
      {
        ...baseQueryObject,
        columns,
        metrics,
        filters,
        is_timeseries: false,
        row_limit: baseQueryObject.row_limit ?? row_limit,
      },
    ];
  });
}
