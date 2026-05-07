import { NextRequest, NextResponse } from 'next/server';
import { parseExcelFile } from '@/lib/excel-parser';
import { validateOrders } from '@/lib/validator';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sheetIndex = formData.get('sheetIndex') ? Number(formData.get('sheetIndex')) : undefined;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: '请上传文件' },
        { status: 400 }
      );
    }
    
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    const validExtensions = ['.xlsx', '.xls'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
      return NextResponse.json(
        { success: false, error: '请上传 .xlsx 或 .xls 格式的 Excel 文件' },
        { status: 400 }
      );
    }
    
    // Parse Excel
    const result = await parseExcelFile(file, { sheetIndex });
    
    if (!result.data || result.data.length === 0) {
      return NextResponse.json(
        { success: false, error: '文件为空或未找到有效数据' },
        { status: 400 }
      );
    }
    
    // Validate data
    const validation = validateOrders(result.data as Record<string, unknown>[]);
    
    return NextResponse.json({
      success: true,
      data: result.data,
      headers: result.headers,
      sheetName: result.sheetName,
      totalRows: result.data.length,
      validRows: validation.validOrders.length,
      errors: validation.errors,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '解析文件时发生错误' 
      },
      { status: 500 }
    );
  }
}
