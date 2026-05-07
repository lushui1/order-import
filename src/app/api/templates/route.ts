import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getTemplateRule, saveTemplateRule } from '@/lib/db';

// Get template rule by fingerprint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fingerprint = searchParams.get('fingerprint');

    if (!fingerprint) {
      return NextResponse.json(
        { success: false, error: '缺少 fingerprint 参数' },
        { status: 400 }
      );
    }

    const rule = await getTemplateRule(fingerprint);

    return NextResponse.json({
      success: true,
      rule,
    });
  } catch (error) {
    console.error('[TEMPLATES] GET error:', error);
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}

// Save template rule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fingerprint, mapping, headers } = body;

    if (!fingerprint || !mapping || !headers) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const rule = await saveTemplateRule({
      fingerprint,
      mapping,
      headers,
    });

    return NextResponse.json({
      success: true,
      rule,
    });
  } catch (error) {
    console.error('[TEMPLATES] POST error:', error);
    return NextResponse.json(
      { success: false, error: '保存失败' },
      { status: 500 }
    );
  }
}