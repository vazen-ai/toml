import { Schema as S } from 'effect';

export const PsaAutomaticModelFromCode = S.Literals([
  '0',
  '1',
  '2',
  '3',
]).transform([
  'none',
  'model_only',
  'model_label_bitmap',
  'model_extended_bitmap',
]);

export const PsaCanAttachFromCode = S.Literals(['0', '1', '2']).transform([
  'no',
  'yes',
  'manual',
]);

export const PsaCanCombineFromCode = S.Literals(['0', '1', '2', '3']).transform(
  ['no', 'yes', 'left_only', 'right_only'],
);

export const PsaCanSplitFromCode = S.Literals(['-1', '0', '1', '2']).transform([
  'default',
  'none',
  'any',
  'aisle',
]);

export const PsaDoorDirectionFromCode = S.Literals(['0', '1']).transform([
  'left',
  'right',
]);

export const PsaFillPatternFromCode = S.Literals([
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
]).transform([
  'solid',
  'diagonal_nw_se',
  'diagonal_ne_sw',
  'cross_hatch',
  'none',
  'dots',
  'x_s',
  'diamonds',
  'broken_ne_sw_line',
  'broken_nw_se_line',
  'triangles',
  'horizontal_sine_wave',
  'vertical_sine_wave',
  'squares',
  'horizontal_line',
  'vertical_line',
  'rectangles',
  'diagonal_nw_se_dot_line_45_deg_angle',
  'diagonal_ne_sw_dot_line_45_deg_angle',
  'diagonal_ne_sw_dot_line_30_deg_angle',
  'diagonal_nw_se_dot_line_30_deg_angle',
  'broken_vertical_sine_wave',
  'broken_horizontal_sine_wave',
  'alternating_horizontal_dash_solid_line',
  'alternating_vertical_dash_solid_line',
  'horizontal_dash_line',
  'vertical_dash_line',
  'bricks',
  'scales',
  'll_bean',
]);

export const PsaFixtureTypeFromCode = S.Literals([
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
]).transform([
  'shelf',
  'chest',
  'bin',
  'polygonal_shelf',
  'rod',
  'lateral_rod',
  'bar',
  'pegboard',
  'multi_row_pegboard',
  'curved_rod',
  'obstruction',
  'sign',
  'gravity_feed',
  'subplanogram_space',
]);

export const PsaMeasurementFromCode = S.Literals(['0', '1']).transform([
  'imperial',
  'metric',
]);

export const PsaMerchandisingDirectionFromCode = S.Literals([
  '0',
  '1',
]).transform(['normal', 'reverse']);

export const PsaMerchandisingNumberFromCode = S.Literals([
  '1',
  '2',
  '3',
]).transform(['manual', 'one', 'fill']);

export const PsaMerchandisingPlacementFromCode = S.Literals([
  '1',
  '2',
  '3',
  '4',
]).transform(['manual', 'edge', 'stack', 'spread']);

export const PsaMerchandisingSizeFromCode = S.Literals([
  '1',
  '2',
  '3',
]).transform(['normal', 'adjust', 'spaced']);

export const PsaMerchandisingSqueezeFromCode = S.Literals([
  '-1',
  '0',
  '1',
]).transform(['default', 'no', 'yes']);

export const PsaMerchandisingStyleFromCode = S.Literals([
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
]).transform([
  'unit',
  'tray',
  'case',
  'display',
  'alternate',
  'loose',
  'log_stack',
]);

export const PsaModelFilenameLookupFromCode = S.Literals([
  '3',
  '0',
  '1',
  '2',
]).transform([
  'none',
  'search_for_merch_style_specific_model',
  'model_file_represents_a_single_unit',
  'model_file_represents_any_merch_style',
]);

export const PsaOrientationFromCode = S.Literals([
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
]).transform([
  'front',
  'front_90',
  'side',
  'side_90',
  'top',
  'top_90',
  'back',
  'back_90',
  'right',
  'right_90',
  'base',
  'base_90',
  'front_180',
  'front_270',
  'side_180',
  'side_270',
  'top_180',
  'top_270',
  'back_180',
  'back_270',
  'right_180',
  'right_270',
  'base_180',
  'base_270',
]);

export const PsaPackageStyleFromCode = S.Literals([
  '0',
  '10',
  '11',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
]).transform([
  'box_stand_or_hang',
  'box_stand',
  'box_hang',
  'jar',
  'can',
  'roll',
  'loose',
  'hole',
  'hairpin',
  'clothing',
  'bottle',
]);

export const PsaPlanogramTypeFromCode = S.Literals([
  '0',
  '1',
  '2',
  '3',
  '4',
]).transform([
  'not_applicable',
  'template',
  'auxiliary',
  'target',
  'revision_template',
]);

export const PsaPrimaryKeyFromCode = S.Literals(['0', '1', '2']).transform([
  'upc',
  'id',
  'both',
]);

export const PsaSourceFileTypeFromCode = S.Literals(['0', '1', '2']).transform([
  'inter_cept',
  'pegman',
  'space_planning',
]);

export const PsaTrafficFlowFromCode = S.Literals(['0', '1', '2']).transform([
  'n_a',
  'left_right',
  'right_left',
]);

export const PsaUsePerformanceFromCode = S.Literals(['0', '1', '2']).transform([
  'no',
  'yes',
  'only_when_not_zero',
]);

export const PsaAutomaticModelOrDefaultFromCode = S.Union([
  S.Literals(['-1']).transform(['default']),
  ...PsaAutomaticModelFromCode.members,
]);

export const PsaMerchandisingDirectionOrDefaultFromCode = S.Union([
  S.Literals(['-1']).transform(['default']),
  ...PsaMerchandisingDirectionFromCode.members,
]);

export const PsaMerchandisingNumberOrDefaultFromCode = S.Union([
  S.Literals(['0']).transform(['default']),
  ...PsaMerchandisingNumberFromCode.members,
]);

export const PsaMerchandisingPlacementOrDefaultFromCode = S.Union([
  S.Literals(['0']).transform(['default']),
  ...PsaMerchandisingPlacementFromCode.members,
]);

export const PsaMerchandisingSizeOrDefaultFromCode = S.Union([
  S.Literals(['0']).transform(['default']),
  ...PsaMerchandisingSizeFromCode.members,
]);

export const PsaMerchandisingStyleOrDefaultFromCode = S.Union([
  S.Literals(['-1']).transform(['default']),
  ...PsaMerchandisingStyleFromCode.members,
]);

export const PsaOrientationOrDefaultFromCode = S.Union([
  S.Literals(['-1']).transform(['default']),
  ...PsaOrientationFromCode.members,
]);
