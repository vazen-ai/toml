export enum PrimaryKey {
  UPC = 0,
  ID = 1,
  Both = 2,
}

export enum Measurement {
  Imperial = 0,
  Metric = 1,
}

export enum MerchPlacement {
  Default = 0,
  Manual = 1,
  Edge = 2,
  Stack = 3,
  Spread = 4,
}

export enum MerchNumber {
  Default = 0,
  Manual = 1,
  One = 2,
  Fill = 3,
}

export enum MerchSize {
  Default = 0,
  Normal = 1,
  Adjust = 2,
  Spaced = 3,
}

export enum MerchDirection {
  Default = -1,
  Normal = 0,
  Reverse = 1,
}

export enum MerchSqueeze {
  Default = -1,
  No = 0,
  Yes = 1,
}

export enum BooleanEnum {
  No = 0,
  Yes = 1,
  OnlyWhenNotZero = 2,
}

export enum Status {
  Default = 0,
  Live = 1,
  Pending = 2,
  WorkInProgress = 3,
  Historic = 4,
  Analysis = 200,
}

export enum FillPattern {
  Solid = 0, //Default
  DiagonalNWSE = 1,
  DiagonalNESW = 2,
  CrossHatch = 3,
  None = 4,
  Dots = 5,
  Xs = 6,
  Diamonds = 7,
  BrokenNESWLine = 8,
  BrokenNWSELine = 9,
  Trialngles = 10,
  HorizontalSineWave = 11,
  VerticalSineWave = 12,
  Squares = 13,
  HorizontalLine = 14,
  VerticalLine = 15,
  Rectangles = 16,
  DiagonalNWSEDotLine45DegAngle = 17,
  DiagonalNESWDotLine45DegAngle = 18,
  DiagonalNESWDotLine30DegAngle = 19,
  DiagonalNWSEDotLine30DegAngle = 20,
  BrokenVerticalSineWave = 21,
  BrokenHorizontalSineWave = 22,
  AlternatingHorizontalDashSolidLine = 23,
  AlternatingVerticalDashSolidLine = 24,
  HorizontalDashLine = 25,
  VerticalDashLine = 26,
  Bricks = 27,
  Scales = 28,
  Pattern29 = 29,
}

export enum ModelFilenameLookup {
  SearchForMerchStyleSpecificModel = 0, //Default
  ModelFileRepresentsASingleUnit = 1,
  ModelFileRepresentsAnyMerchStyle = 2,
  None = 3,
}

export enum MerchStyle {
  Default = -1, //Default
  Unit = 0,
  Tray = 1,
  Case = 2,
  Display = 3,
  Alternate = 4,
  Loose = 5,
  LogStack = 6,
}

export enum AutomaticModel {
  Default = -1,
  None = 0,
  ModelOnly = 1,
  ModelAndLabelBitmap = 2, //Default
  ModelAndExtendedBitmap = 3,
}

export enum DoorDirection {
  Left = 0, //default
  Right = 1,
}

export enum FixtureType {
  Shelf = 0,
  Chest = 1,
  Bin = 2,
  PolygonalShelf = 3,
  Rod = 4,
  LateralRod = 5,
  Bar = 6,
  Pegboard = 7,
  MultiRowPegboard = 8,
  CurvedRod = 9,
  Obstruction = 10,
  Sign = 11,
  GravityFeed = 12,
  SubplanogramSpace = 13,
}

export enum FixtureCanCombine {
  No = 0, //default
  Yes = 1,
  LeftOnly = 2,
  RightOnly = 3,
}

export enum CanAttach {
  No = 0, //default
  Yes = 1,
  Manual = 2,
}

export enum Orientation {
  Default = -1,
  Front = 0,
  Front90 = 1,
  Side = 2,
  Side90 = 3,
  Top = 4,
  Top90 = 5,
  Back = 6,
  Back90 = 7,
  Right = 8,
  Right90 = 9,
  Base = 10,
  Base90 = 11,
  Front180 = 12,
  Front270 = 13,
  Side180 = 14,
  Side270 = 15,
  Top180 = 16,
  Top270 = 17,
  Back180 = 18,
  Back270 = 19,
  Right180 = 20,
  Right270 = 21,
  Base180 = 22,
  Base270 = 23,
}

export enum TrafficFlow {
  NA = 0, //default
  LeftRight = 1,
  RightLeft = 2,
}

export enum SourceFileType {
  InterCept = 0,
  Pegman = 1,
  SpacePlanning = 2, //default
}

export enum CanSplit {
  Default = -1,
  None = 0,
  Any = 1,
  Aisle = 2,
}

export enum PGType {
  Default = 0,
  Template = 1,
  Auxiliary = 2,
  Target = 3,
  RevisionTemplate = 4,
}

export enum PackageStyle {
  BoxStandOrHang = 0,
  BoxStand = 10,
  BoxHang = 11,
  Jar = 1,
  Can = 2,
  Roll = 3,
  Loose = 4,
  Hole = 5,
  Hairpin = 6,
  Clothing = 7,
  Bottle = 8,
}
