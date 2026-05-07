import * as XLSX from 'xlsx';
import { RawExcelRow, TemplateMapping } from '@/types';

// Column name synonyms for fuzzy matching
const COLUMN_SYNONYMS: Record<string, string[]> = {
  // 外部编码
  externalCode: ['外部编码', '外部单号', '客户单号', '订单号', 'Ref Code', 'Reference', '订单编号'],
  // 发件人姓名
  senderName: ['发件人', '发件人姓名', '发件方', '寄件人', '寄件人姓名', 'Sender', '寄件方'],
  // 发件人电话
  senderPhone: ['发件人电话', '发件电话', '寄件人电话', '发件方电话', 'Sender Tel', 'Sender Phone'],
  // 发件人地址
  senderAddress: ['发件人地址', '发件地址', '寄件人地址', '发件方地址', 'Sender Address'],
  // 收件人姓名
  receiverName: ['收件人', '收件人姓名', '收件方', '收货人', '收货人姓名', 'Receiver', '收货方'],
  // 收件人电话
  receiverPhone: ['收件人电话', '收件电话', '收货人电话', '收件方电话', 'Receiver Tel', 'Receiver Phone'],
  // 收件人地址
  receiverAddress: ['收件人地址', '收件地址', '收货人地址', '收件方地址', 'Receiver Address'],
  // 重量
  weight: ['重量', '重量(kg)', '重量kg', 'Weight', 'Weight(kg)', 'weight(kg)'],
  // 件数
  quantity: ['件数', '数量', 'Qty', 'Quantity', '包裹数', '包裹数量'],
  // 温层
  tempZone: ['温层', '温度', '温度要求', 'Temp Zone', 'Temperature', '温层要求'],
  // 备注
  note: ['备注', 'Note', '说明', '备注说明', '注释'],
};

// System field names
export const SYSTEM_FIELDS = [
  'externalCode',
  'senderName',
  'senderPhone',
  'senderAddress',
  'receiverName',
  'receiverPhone',
  'receiverAddress',
  'weight',
  'quantity',
  'tempZone',
  'note',
] as const;

// Levenshtein distance calculation
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]) + 1;
      }
    }
  }

  return dp[m][n];
}

// Normalize string for comparison
function normalize(str: string): string {
  return str.toLowerCase().replace(/[\s\-\_（）\(\)]/g, '').trim();
}

// Find best matching system field for an Excel column
function findBestMatch(excelColumn: string): string | null {
  const normalizedExcel = normalize(excelColumn);
  let bestMatch: string | null = null;
  let bestScore = Infinity;

  for (const [fieldName, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
    // Check exact match first
    if (normalize(excelColumn) === normalize(fieldName)) {
      return fieldName;
    }

    // Check synonyms
    for (const synonym of synonyms) {
      if (normalize(excelColumn) === normalize(synonym)) {
        return fieldName;
      }

      // Levenshtein distance for fuzzy matching
      const distance = levenshteinDistance(normalizedExcel, normalize(synonym));
      if (distance < bestScore && distance <= 3) {
        bestScore = distance;
        bestMatch = fieldName;
      }
    }
  }

  return bestMatch;
}

// Detect header row index
function detectHeaderRow(ws: XLSX.WorkSheet, maxRows: number = 10): number {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const rows = range.e.r + 1;
  
  for (let i = 0; i < Math.min(rows, maxRows); i++) {
    let hasContent = false;
    let fieldCount = 0;
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = ws[XLSX.utils.encode_cell({ r: i, c: col })];
      if (cell && cell.v && String(cell.v).trim()) {
        hasContent = true;
        const match = findBestMatch(String(cell.v).trim());
        if (match) fieldCount++;
      }
    }
    
    // If we find at least 3 field matches, this is likely the header row
    if (hasContent && fieldCount >= 3) {
      return i;
    }
  }
  
  return 0; // Default to first row
}

// Detect data start row (skip header and empty rows)
function detectDataStartRow(ws: XLSX.WorkSheet, headerRow: number): number {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const rows = range.e.r + 1;
  
  for (let i = headerRow + 1; i < rows; i++) {
    let hasContent = false;
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = ws[XLSX.utils.encode_cell({ r: i, c: col })];
      if (cell && cell.v && String(cell.v).trim()) {
        hasContent = true;
        break;
      }
    }
    if (hasContent) return i;
  }
  
  return headerRow + 1;
}

// Create column mapping from header row
function createColumnMapping(ws: XLSX.WorkSheet, headerRow: number): Record<string, string> {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const mapping: Record<string, string> = {};
  
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c: col })];
    if (cell && cell.v) {
      const excelColName = String(cell.v).trim();
      const systemField = findBestMatch(excelColName);
      if (systemField) {
        const colLetter = XLSX.utils.encode_col(col);
        mapping[colLetter] = systemField;
      }
    }
  }
  
  return mapping;
}

// Parse Excel sheet
export function parseExcelSheet(
  ws: XLSX.WorkSheet,
  options?: { onProgress?: (current: number, total: number) => void }
): { headers: string[]; data: RawExcelRow[]; mapping: Record<string, string> } {
  const headerRow = detectHeaderRow(ws);
  const dataStartRow = detectDataStartRow(ws, headerRow);
  const mapping = createColumnMapping(ws, headerRow);
  
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const totalRows = range.e.r - dataStartRow + 1;
  
  const data: RawExcelRow[] = [];
  
  for (let row = dataStartRow; row <= range.e.r; row++) {
    const rowData: RawExcelRow = {};
    let hasAnyContent = false;
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const colLetter = XLSX.utils.encode_col(col);
      const systemField = mapping[colLetter];
      
      if (systemField) {
        const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
        const value = cell?.v;
        
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          hasAnyContent = true;
          rowData[systemField] = typeof value === 'number' ? value : String(value).trim();
        }
      }
    }
    
    if (hasAnyContent) {
      data.push(rowData);
    }
    
    // Report progress
    if (options?.onProgress) {
      options.onProgress(row - dataStartRow + 1, totalRows);
    }
  }
  
  // Get header names for template fingerprinting
  const headers: string[] = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c: col })];
    if (cell && cell.v) {
      headers.push(String(cell.v).trim());
    }
  }
  
  return { headers, data, mapping };
}

// Parse Excel file
export async function parseExcelFile(
  file: File,
  options?: { 
    sheetIndex?: number; 
    onProgress?: (current: number, total: number) => void 
  }
): Promise<{ data: RawExcelRow[]; headers: string[]; sheetName: string; colMapping: Record<string, string> }> {
  // In Node.js environment (API route), use arrayBuffer() directly
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  
  // Find the best sheet for order data
  let targetSheet: XLSX.WorkSheet;
  let sheetName: string;
  
  if (options?.sheetIndex !== undefined) {
    const sheetNames = workbook.SheetNames;
    if (options.sheetIndex < sheetNames.length) {
      sheetName = sheetNames[options.sheetIndex];
      targetSheet = workbook.Sheets[sheetName];
    } else {
      throw new Error(`Sheet index ${options.sheetIndex} out of range`);
    }
  } else {
    // Auto-detect best sheet
    const bestSheet = findBestDataSheet(workbook);
    targetSheet = bestSheet.sheet;
    sheetName = bestSheet.name;
  }
  
  const result = parseExcelSheet(targetSheet, {
    onProgress: options?.onProgress
  });
  
  return {
    data: result.data,
    headers: result.headers,
    sheetName,
    colMapping: result.mapping,
  };
}

// Find the best sheet for order data
function findBestDataSheet(workbook: XLSX.WorkBook): { sheet: XLSX.WorkSheet; name: string } {
  const skipKeywords = ['说明', 'instruction', 'readme', '填写说明', '注意事项'];
  
  for (const sheetName of workbook.SheetNames) {
    // Skip sheets with instruction-related names
    const isInstructionSheet = skipKeywords.some(keyword => 
      sheetName.toLowerCase().includes(keyword)
    );
    
    if (isInstructionSheet) continue;
    
    const ws = workbook.Sheets[sheetName];
    const headerRow = detectHeaderRow(ws);
    const matchCount = countFieldMatches(ws, headerRow);
    
    if (matchCount >= 3) {
      return { sheet: ws, name: sheetName };
    }
  }
  
  // Fallback to first sheet
  const firstSheetName = workbook.SheetNames[0];
  return { sheet: workbook.Sheets[firstSheetName], name: firstSheetName };
}

// Count how many fields match in header row
function countFieldMatches(ws: XLSX.WorkSheet, headerRow: number): number {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  let matchCount = 0;
  
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c: col })];
    if (cell && cell.v) {
      const match = findBestMatch(String(cell.v).trim());
      if (match) matchCount++;
    }
  }
  
  return matchCount;
}

// Generate template fingerprint
export function generateTemplateFingerprint(headers: string[]): string {
  return headers
    .map(h => h.toLowerCase().replace(/[\s\-\_]/g, ''))
    .sort()
    .join('|');
}

// Save template mapping to localStorage
export function saveTemplateMapping(fingerprint: string, mapping: TemplateMapping): void {
  const saved = getSavedTemplateMappings();
  saved[fingerprint] = mapping;
  localStorage.setItem('templateMappings', JSON.stringify(saved));
}

// Get saved template mappings
export function getSavedTemplateMappings(): Record<string, TemplateMapping> {
  try {
    const saved = localStorage.getItem('templateMappings');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// Find saved mapping for a template
export function findSavedMapping(headers: string[]): TemplateMapping | null {
  const fingerprint = generateTemplateFingerprint(headers);
  const saved = getSavedTemplateMappings();
  return saved[fingerprint] || null;
}
