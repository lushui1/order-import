import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { parseExcelFile, generateTemplateFingerprint } from '@/lib/excel-parser';
import { validateOrders } from '@/lib/validator';
import { saveImportRecord, getTemplateRule } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '请选择文件' },
        { status: 400 }
      );
    }

    console.log('[UPLOAD] Processing file:', file.name, 'size:', file.size);

    // Parse Excel
    const result = await parseExcelFile(file);

    if (!result || result.data.length === 0) {
      return NextResponse.json(
        { success: false, error: '文件解析失败或无数据' },
        { status: 400 }
      );
    }

    console.log('[UPLOAD] Parsed', result.data.length, 'rows from sheet:', result.sheetName);

    // Validate data
    console.log('[UPLOAD] Validating', result.data.length, 'rows...');
    const validation = validateOrders(result.data as Record<string, unknown>[]);
    console.log('[UPLOAD] Validation:', validation.validOrders.length, 'valid,', validation.errors.length, 'errors');
    
    // Generate template fingerprint and check if we have a saved mapping
    const fingerprint = generateTemplateFingerprint(result.headers);
    let savedRule = null;
    try {
      savedRule = await getTemplateRule(fingerprint);
    } catch (err) {
      console.log('[UPLOAD] No saved template rule found');
    }
    
    // Build auto-detected mapping: {excelColName: systemField}
    // colMapping is {colLetter: systemField}, need to convert to {excelColName: systemField}
    const autoMapping: Record<string, string> = {};
    for (const [colLetter, systemField] of Object.entries(result.colMapping)) {
      // Convert colLetter ("A", "B", "AA", etc.) to column index
      let colIndex = 0;
      for (let i = 0; i < colLetter.length; i++) {
        colIndex = colIndex * 26 + (colLetter.charCodeAt(i) - 64);
      }
      colIndex -= 1; // 0-based
      if (colIndex >= 0 && colIndex < result.headers.length) {
        autoMapping[result.headers[colIndex]] = systemField;
      }
    }
    console.log('[UPLOAD] Auto-mapped fields:', Object.keys(autoMapping).length, autoMapping);
    
    // Save import record
    const batchId = `batch_${Date.now()}`;
    try {
      await saveImportRecord({
        filename: file.name,
        sheetName: result.sheetName,
        totalRows: result.data.length,
        successCount: validation.validOrders.length,
        failCount: validation.errors.length,
        batchId,
      });
    } catch (err) {
      console.error('[UPLOAD] Failed to save import record:', err);
    }
    
    return NextResponse.json({
      success: true,
      data: result.data,
      headers: result.headers,
      sheetName: result.sheetName,
      totalRows: result.data.length,
      validRows: validation.validOrders.length,
      errors: validation.errors,
      fingerprint,
      hasSavedMapping: !!savedRule,
      mapping: savedRule?.mapping || autoMapping,
    });
  } catch (error) {
    console.error('[UPLOAD] Error:', error);
    return NextResponse.json(
      { success: false, error: '上传失败：' + (error instanceof Error ? error.message : '未知错误') },
      { status: 500 }
    );
  }
}