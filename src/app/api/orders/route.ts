import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  saveOrder,
  getOrders,
  checkExternalCodeExists,
  batchCheckExternalCodes,
} from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orders } = body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有订单数据' },
        { status: 400 }
      );
    }

    const batchId = `batch_${Date.now()}`;
    let successCount = 0;
    let failCount = 0;
    const duplicateErrors: { row: number; field: string; message: string }[] = [];

    // Check for duplicates with existing orders in DB
    const externalCodes = orders
      .map((o: Record<string, unknown>) => String(o.externalCode || '').trim())
      .filter((code: string) => code);

    if (externalCodes.length > 0) {
      const existingMap = await batchCheckExternalCodes(externalCodes);
      
      orders.forEach((order: Record<string, unknown>, i: number) => {
        const code = String(order.externalCode || '').trim();
        if (code && existingMap.get(code)) {
          duplicateErrors.push({
            row: i + 1,
            field: 'externalCode',
            message: `外部编码 "${code}" 已存在`,
          });
        }
      });

      // Also check batch-internal duplicates
      const seenCodes = new Set<string>();
      orders.forEach((order: Record<string, unknown>, i: number) => {
        const code = String(order.externalCode || '').trim();
        if (code && seenCodes.has(code) && !duplicateErrors.some(e => e.row === i + 1)) {
          duplicateErrors.push({
            row: i + 1,
            field: 'externalCode',
            message: `外部编码 "${code}" 在本批次中重复`,
          });
        }
        if (code) seenCodes.add(code);
      });
    }

    // If duplicates found, return error
    if (duplicateErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: '发现重复的外部编码',
        duplicateErrors,
        successCount: 0,
        failCount: orders.length,
      });
    }

    // Save orders
    for (const order of orders) {
      try {
        await saveOrder({
          externalCode: order.externalCode || null,
          senderName: String(order.senderName || ''),
          senderPhone: String(order.senderPhone || ''),
          senderAddress: String(order.senderAddress || ''),
          receiverName: String(order.receiverName || ''),
          receiverPhone: String(order.receiverPhone || ''),
          receiverAddress: String(order.receiverAddress || ''),
          weight: String(order.weight || '0'),
          quantity: String(order.quantity || '0'),
          tempZone: String(order.tempZone || '常温'),
          note: order.note ? String(order.note) : null,
          batchId,
        });
        successCount++;
      } catch (error) {
        console.error('[ORDERS] Save error:', error);
        failCount++;
      }
    }

    return NextResponse.json({
      success: true,
      successCount,
      failCount,
      batchId,
      total: orders.length,
    });
  } catch (error) {
    console.error('[ORDERS] POST error:', error);
    return NextResponse.json(
      { success: false, error: '提交失败' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') || '1');
    const pageSize = Number(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || '';
    const searchField = searchParams.get('field') || 'receiverName';

    const { orders, total } = await getOrders({
      page,
      pageSize,
      search,
      searchField,
    });

    return NextResponse.json({
      success: true,
      orders,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('[ORDERS] GET error:', error);
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}