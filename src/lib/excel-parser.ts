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

// Propagate merged cell values to all cells in the merge range
function expandMergedCells(ws: XLSX.WorkSheet): void {
  const merges = (ws as Record<string, unknown>)['!merges'] as XLSX.Range[] | undefined;
  if (!merges) return;

  for (const merge of merges) {
    // Get the top-left cell value
    const topLeftCell = ws[XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c })];
    const value = topLeftCell?.v;
    if (value === undefined || value === null) continue;

    // Propagate to all cells in the merge range
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (r === merge.s.r && c === merge.s.c) continue; // Skip top-left
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef] || ws[cellRef].v === undefined || ws[cellRef].v === null) {
          ws[cellRef] = { t: 's', v: value, w: String(value) };
        }
      }
    }
  }
}

// Detect header row index - supports multi-row headers with merged cells
function detectHeaderRow(ws: XLSX.WorkSheet, maxRows: number = 10): number {
  expandMergedCells(ws);

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const rows = range.e.r + 1;

  let bestRow = 0;
  let bestFieldCount = 0;

  for (let i = 0; i < Math.min(rows, maxRows); i++) {
    let fieldCount = 0;
    const rowValues: string[] = [];

    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = ws[XLSX.utils.encode_cell({ r: i, c: col })];
      const val = cell?.v ? String(cell.v).trim() : '';
      rowValues.push(val);
      if (val && findBestMatch(val)) fieldCount++;
    }

    // Also check multi-row combination: this row's group + next row's field
    if (i + 1 < rows && fieldCount < 3) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cell1 = ws[XLSX.utils.encode_cell({ r: i, c: col })];
        const cell2 = ws[XLSX.utils.encode_cell({ r: i + 1, c: col })];
        const val1 = cell1?.v ? String(cell1.v).trim() : '';
        const val2 = cell2?.v ? String(cell2.v).trim() : '';
        if (val1 && val2 && val1 !== val2) {
          const combined = val1 + val2;
          if (findBestMatch(combined)) fieldCount++;
        }
      }
    }

    if (fieldCount > bestFieldCount) {
      bestFieldCount = fieldCount;
      bestRow = i;
    }
  }

  return bestFieldCount >= 2 ? bestRow : 0;
}


// Create column mapping from header row - supports multi-row headers
function createColumnMapping(ws: XLSX.WorkSheet, headerRow: number): Record<string, string> {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const mapping: Record<string, string> = {};

  // Try single-row header first
  let singleRowMatches = 0;
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c: col })];
    if (cell?.v && findBestMatch(String(cell.v).trim())) singleRowMatches++;
  }

  if (singleRowMatches >= 3) {
    // Single-row header works
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c: col })];
      if (cell?.v) {
        const excelColName = String(cell.v).trim();
        const systemField = findBestMatch(excelColName);
        if (systemField) {
          mapping[XLSX.utils.encode_col(col)] = systemField;
        }
      }
    }
  } else {
    // Multi-row header: combine group row + sub-header row
    const groupRow = headerRow;
    const subRow = headerRow + 1;

    for (let col = range.s.c; col <= range.e.c; col++) {
      const groupCell = ws[XLSX.utils.encode_cell({ r: groupRow, c: col })];
      const subCell = ws[XLSX.utils.encode_cell({ r: subRow, c: col })];
      const groupVal = groupCell?.v ? String(groupCell.v).trim() : '';
      const subVal = subCell?.v ? String(subCell.v).trim() : '';

      // Try: group+sub combined, then sub alone, then group alone
      let systemField: string | null = null;
      if (groupVal && subVal && groupVal !== subVal) {
        systemField = findBestMatch(groupVal + subVal);
      }
      if (!systemField && subVal) {
        systemField = findBestMatch(subVal);
      }
      if (!systemField && groupVal) {
        systemField = findBestMatch(groupVal);
      }

      if (systemField) {
        mapping[XLSX.utils.encode_col(col)] = systemField;
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
  expandMergedCells(ws);

  const headerRow = detectHeaderRow(ws);
  const mapping = createColumnMapping(ws, headerRow);

  // Detect if multi-row header (check if createColumnMapping used sub-row)
  let dataStartRow = headerRow + 1;
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  let singleRowMatches = 0;
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c: col })];
    if (cell?.v && findBestMatch(String(cell.v).trim())) singleRowMatches++;
  }
  if (singleRowMatches < 3) {
    // Multi-row header, skip one more row
    dataStartRow = headerRow + 2;
  }

  // Skip empty rows between header and data
  while (dataStartRow <= range.e.r) {
    let hasContent = false;
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = ws[XLSX.utils.encode_cell({ r: dataStartRow, c: col })];
      if (cell?.v && String(cell.v).trim()) { hasContent = true; break; }
    }
    if (hasContent) break;
    dataStartRow++;
  }

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

    if (options?.onProgress) {
      options.onProgress(row - dataStartRow + 1, totalRows);
    }
  }

  // Get header names for template fingerprinting
  const headers: string[] = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c: col })];
    if (cell?.v) {
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
