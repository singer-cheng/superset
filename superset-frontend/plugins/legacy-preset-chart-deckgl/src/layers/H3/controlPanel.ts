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
  ControlPanelConfig,
  getStandardizedControls,
} from '@superset-ui/chart-controls';
import { t } from '@apache-superset/core';
import { validateNonEmpty } from '@superset-ui/core';
import { ControlPanelState } from '@superset-ui/chart-controls';
import { columnChoices } from '../../utilities/controls';
import {
  filterNulls,
  autozoom,
  viewport,
  mapboxStyle,
  stroked,
  tooltipContents,
  tooltipTemplate,
} from '../../utilities/Shared_DeckGL';
import { deckGLLinearColorSchemeSelect } from '../../utilities/Shared_DeckGL';

const DEFAULT_ROW_LIMIT = 50000;

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'h3_index_column',
            config: {
              type: 'SelectControl',
              label: t('H3 Index Column'),
              description: t(
                'Column containing H3 hexagonal cell index (e.g. 8928308280fffff)',
              ),
              default: null,
              mapStateToProps: (state: ControlPanelState) => ({
                choices: columnChoices(state.datasource),
              }),
              validators: [validateNonEmpty],
            },
          },
        ],
        ['metric'],
        [
          {
            name: 'row_limit',
            config: {
              type: 'TextControl',
              label: t('Row limit'),
              description: t('Maximum number of rows to load, default 50,000'),
              default: DEFAULT_ROW_LIMIT,
              isInt: true,
              renderTrigger: true,
            },
          },
        ],
        [filterNulls],
        [tooltipContents],
        [tooltipTemplate],
      ],
    },
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [[mapboxStyle], [viewport], [autozoom]],
    },
    {
      label: t('H3 Settings'),
      expanded: true,
      controlSetRows: [
        [deckGLLinearColorSchemeSelect],
        [
          {
            name: 'color_scheme_reverse',
            config: {
              type: 'CheckboxControl',
              label: t('Reverse color scheme'),
              description: t('Reverse the color scale direction'),
              default: false,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'h3_fill_opacity',
            config: {
              type: 'SliderControl',
              label: t('Fill opacity'),
              default: 90,
              step: 1,
              min: 0,
              max: 100,
              renderTrigger: true,
              description: t('Opacity of hexagon fill (0-100)'),
            },
          },
        ],
        [stroked],
      ],
    },
  ],
  controlOverrides: {
    metric: {
      validators: [],
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
    row_limit: formData.row_limit ?? DEFAULT_ROW_LIMIT,
  }),
};

export default config;
