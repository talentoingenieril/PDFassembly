export type MeasurementUnit = 'pt' | 'cm';

export interface MarginSettings {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type Alignment = 'left' | 'center' | 'right';
export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type FontType = 'Helvetica' | 'Helvetica-Bold' | 'Times-Roman' | 'Times-Bold' | 'Courier' | 'Courier-Bold' | 'Segoe UI' | 'Segoe UI-Bold';

export interface TextStyle {
  font: FontType;
  size: number;
  color: string; // Hex color
  align: Alignment;
}

export interface FrameStyle {
  thickness: number;
  color: string; // Hex color
  style: LineStyle;
}

export interface FileCoverSettings {
  useCover: boolean;
  coverPageStart: number;
  coverPageEnd: number;
}

export interface PDFFileItem {
  id: string;
  file: File;
  name: string;
  footerCustomText: string;
  isCoversPdf: boolean;
  coverSettings: FileCoverSettings;
  applyWhiteBorders: boolean;
  useCustomMargins: boolean;
  margins: MarginSettings; // Used if useCustomMargins is true
  applyAnnotations: boolean;
}

export interface HeaderSettings {
  useDefaultImages: boolean;
  marginTop: number;
  sideMargin: number;
  height: number;
  leftImage: string | null;  // DataURL
  rightImage: string | null; // DataURL
  centralTextWidthPercent: number; // 0 to 100
  titleText: string;
  textStyle: TextStyle;
  frameStyle: FrameStyle;
}

export interface FooterSettings {
  marginBottom: number;
  sideMargin: number;
  height: number;
  leftWidthPercent: number; // 0 to 100
  staticText: string;
  staticTextStyle: TextStyle;
  customTextStyle: TextStyle;
  paginationStyle: TextStyle;
  frameStyle: FrameStyle;
}

export interface ProcessingSettings {
  measurementUnit: MeasurementUnit;
  globalMargins: MarginSettings;
  header: HeaderSettings;
  footer: FooterSettings;
}

