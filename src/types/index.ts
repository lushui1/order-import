// Order data types
export interface OrderData {
  id?: string;
  externalCode?: string;      // 外部编码（可选）
  senderName: string;          // 发件人姓名（必填）
  senderPhone: string;         // 发件人电话（必填）
  senderAddress: string;       // 发件人地址（必填）
  receiverName: string;        // 收件人姓名（必填）
  receiverPhone: string;      // 收件人电话（必填）
  receiverAddress: string;    // 收件人地址（必填）
  weight: number;              // 重量kg（必填，正数）
  quantity: number;            // 件数（必填，正整数）
  tempZone: '常温' | '冷藏' | '冷冻';  // 温层（必填）
  note?: string;               // 备注（可选）
  createdAt?: Date;
  updatedAt?: Date;
}

// Raw Excel row data
export interface RawExcelRow {
  [key: string]: string | number | undefined;
}

// Validation error
export interface ValidationError {
  row: number;
  field: string;
  value: unknown;
  message: string;
}

// Template mapping
export interface TemplateMapping {
  templateId: string;
  templateName: string;
  columnMappings: Record<string, string>;  // Excel列名 -> 系统字段名
  headerRowIndex: number;  // 表头所在行（0-based）
  dataStartRowIndex: number;  // 数据起始行（0-based）
  sheetName?: string;
}

// Import progress
export interface ImportProgress {
  phase: 'parsing' | 'validating' | 'importing';
  current: number;
  total: number;
  percentage: number;
}

// Import result
export interface ImportResult {
  success: boolean;
  totalRows: number;
  successRows: number;
  failedRows: number;
  errors: ValidationError[];
  orders?: OrderData[];
}

// Template fingerprint
export interface TemplateFingerprint {
  id: string;
  headers: string[];
  columnCount: number;
  createdAt: Date;
}
