import { Schema as S } from 'effect';

export const PsaAutomaticModelFromCode = S.transformLiterals(
  ['0', 'none'],
  ['1', 'model_only'],
  ['2', 'model_label_bitmap'],
  ['3', 'model_extended_bitmap'],
);

export const PsaCanAttachFromCode = S.transformLiterals(
  ['0', 'no'],
  ['1', 'yes'],
  ['2', 'manual'],
);

export const PsaCanCombineFromCode = S.transformLiterals(
  ['0', 'no'],
  ['1', 'yes'],
  ['2', 'left_only'],
  ['3', 'right_only'],
);

export const PsaCanSplitFromCode = S.transformLiterals(
  ['-1', 'default'],
  ['0', 'none'],
  ['1', 'any'],
  ['2', 'aisle'],
);

export const PsaDoorDirectionFromCode = S.transformLiterals(
  ['0', 'left'],
  ['1', 'right'],
);

export const PsaFillPatternFromCode = S.transformLiterals(
  ['0', 'solid'],
  ['1', 'diagonal_nw_se'],
  ['2', 'diagonal_ne_sw'],
  ['3', 'cross_hatch'],
  ['4', 'none'],
  ['5', 'dots'],
  ['6', 'x_s'],
  ['7', 'diamonds'],
  ['8', 'broken_ne_sw_line'],
  ['9', 'broken_nw_se_line'],
  ['10', 'triangles'],
  ['11', 'horizontal_sine_wave'],
  ['12', 'vertical_sine_wave'],
  ['13', 'squares'],
  ['14', 'horizontal_line'],
  ['15', 'vertical_line'],
  ['16', 'rectangles'],
  ['17', 'diagonal_nw_se_dot_line_45_deg_angle'],
  ['18', 'diagonal_ne_sw_dot_line_45_deg_angle'],
  ['19', 'diagonal_ne_sw_dot_line_30_deg_angle'],
  ['20', 'diagonal_nw_se_dot_line_30_deg_angle'],
  ['21', 'broken_vertical_sine_wave'],
  ['22', 'broken_horizontal_sine_wave'],
  ['23', 'alternating_horizontal_dash_solid_line'],
  ['24', 'alternating_vertical_dash_solid_line'],
  ['25', 'horizontal_dash_line'],
  ['26', 'vertical_dash_line'],
  ['27', 'bricks'],
  ['28', 'scales'],
  ['29', 'll_bean'],
);

export const PsaFixtureTypeFromCode = S.transformLiterals(
  ['0', 'shelf'],
  ['1', 'chest'],
  ['2', 'bin'],
  ['3', 'polygonal_shelf'],
  ['4', 'rod'],
  ['5', 'lateral_rod'],
  ['6', 'bar'],
  ['7', 'pegboard'],
  ['8', 'multi_row_pegboard'],
  ['9', 'curved_rod'],
  ['10', 'obstruction'],
  ['11', 'sign'],
  ['12', 'gravity_feed'],
  ['13', 'subplanogram_space'],
);

export const PsaMeasurementFromCode = S.transformLiterals(
  ['0', 'imperial'],
  ['1', 'metric'],
);

export const PsaMerchandisingDirectionFromCode = S.transformLiterals(
  ['0', 'normal'],
  ['1', 'reverse'],
);

export const PsaMerchandisingNumberFromCode = S.transformLiterals(
  ['1', 'manual'],
  ['2', 'one'],
  ['3', 'fill'],
);

export const PsaMerchandisingPlacementFromCode = S.transformLiterals(
  ['1', 'manual'],
  ['2', 'edge'],
  ['3', 'stack'],
  ['4', 'spread'],
);

export const PsaMerchandisingSizeFromCode = S.transformLiterals(
  ['1', 'normal'],
  ['2', 'adjust'],
  ['3', 'spaced'],
);

export const PsaMerchandisingSqueezeFromCode = S.transformLiterals(
  ['-1', 'default'],
  ['0', 'no'],
  ['1', 'yes'],
);

export const PsaMerchandisingStyleFromCode = S.transformLiterals(
  ['0', 'unit'],
  ['1', 'tray'],
  ['2', 'case'],
  ['3', 'display'],
  ['4', 'alternate'],
  ['5', 'loose'],
  ['6', 'log_stack'],
);

export const PsaModelFilenameLookupFromCode = S.transformLiterals(
  ['3', 'none'],
  ['0', 'search_for_merch_style_specific_model'],
  ['1', 'model_file_represents_a_single_unit'],
  ['2', 'model_file_represents_any_merch_style'],
);

export const PsaOrientationFromCode = S.transformLiterals(
  ['0', 'front'],
  ['1', 'front_90'],
  ['2', 'side'],
  ['3', 'side_90'],
  ['4', 'top'],
  ['5', 'top_90'],
  ['6', 'back'],
  ['7', 'back_90'],
  ['8', 'right'],
  ['9', 'right_90'],
  ['10', 'base'],
  ['11', 'base_90'],
  ['12', 'front_180'],
  ['13', 'front_270'],
  ['14', 'side_180'],
  ['15', 'side_270'],
  ['16', 'top_180'],
  ['17', 'top_270'],
  ['18', 'back_180'],
  ['19', 'back_270'],
  ['20', 'right_180'],
  ['21', 'right_270'],
  ['22', 'base_180'],
  ['23', 'base_270'],
);

export const PsaPackageStyleFromCode = S.transformLiterals(
  ['0', 'box_stand_or_hang'],
  ['10', 'box_stand'],
  ['11', 'box_hang'],
  ['1', 'jar'],
  ['2', 'can'],
  ['3', 'roll'],
  ['4', 'loose'],
  ['5', 'hole'],
  ['6', 'hairpin'],
  ['7', 'clothing'],
  ['8', 'bottle'],
);

export const PsaPlanogramTypeFromCode = S.transformLiterals(
  ['0', 'not_applicable'],
  ['1', 'template'],
  ['2', 'auxiliary'],
  ['3', 'target'],
  ['4', 'revision_template'],
);

export const PsaPrimaryKeyFromCode = S.transformLiterals(
  ['0', 'upc'],
  ['1', 'id'],
  ['2', 'both'],
);

export const PsaSourceFileTypeFromCode = S.transformLiterals(
  ['0', 'inter_cept'],
  ['1', 'pegman'],
  ['2', 'space_planning'],
);

export const PsaTrafficFlowFromCode = S.transformLiterals(
  ['0', 'n_a'],
  ['1', 'left_right'],
  ['2', 'right_left'],
);

export const PsaUsePerformanceFromCode = S.transformLiterals(
  ['0', 'no'],
  ['1', 'yes'],
  ['2', 'only_when_not_zero'],
);

export const PsaAutomaticModelOrDefaultFromCode = S.Union(
  S.transformLiterals(['-1', 'default']),
  ...PsaAutomaticModelFromCode.members,
);

export const PsaMerchandisingDirectionOrDefaultFromCode = S.Union(
  S.transformLiterals(['-1', 'default']),
  ...PsaMerchandisingDirectionFromCode.members,
);

export const PsaMerchandisingNumberOrDefaultFromCode = S.Union(
  S.transformLiterals(['0', 'default']),
  ...PsaMerchandisingNumberFromCode.members,
);

export const PsaMerchandisingPlacementOrDefaultFromCode = S.Union(
  S.transformLiterals(['0', 'default']),
  ...PsaMerchandisingPlacementFromCode.members,
);

export const PsaMerchandisingSizeOrDefaultFromCode = S.Union(
  S.transformLiterals(['0', 'default']),
  ...PsaMerchandisingSizeFromCode.members,
);

export const PsaMerchandisingStyleOrDefaultFromCode = S.Union(
  S.transformLiterals(['-1', 'default']),
  ...PsaMerchandisingStyleFromCode.members,
);

export const PsaOrientationOrDefaultFromCode = S.Union(
  S.transformLiterals(['-1', 'default']),
  ...PsaOrientationFromCode.members,
);
