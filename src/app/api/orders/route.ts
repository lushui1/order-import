import { NextRequest, NextResponse } from 'next/server';

// In-memory store for orders (will be replaced with database)
// Using a global variable to persist across requests in dev mode
const globalForOrders = globalThis as unknown as {
  orders: OrderRecord[];
};

if (!globalForOrders.orders) {
  globalForOrders.orders = [];
}

interface OrderRecord {
  id: string;
  externalCode?: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  weight: number;
  quantity: number;
  tempZone: string;
  note?: string;
  createdAt: string;
  batchId: string;
}

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

    for (const order of orders) {
      try {
        const record: OrderRecord = {
          id: `ord_${Date.now()}_${successCount}`,
          externalCode: order.externalCode,
          senderName: order.senderName,
          senderPhone: order.senderPhone,
          senderAddress: order.senderAddress,
          receiverName: order.receiverName,
          receiverPhone: order.receiverPhone,
          receiverAddress: order.receiverAddress,
          weight: Number(order.weight),
          quantity: Number(order.quantity),
          tempZone: order.tempZone,
          note: order.note,
          createdAt: new Date().toISOString(),
          batchId,
        };
        
        globalForOrders.orders.push(record);
        successCount++;
      } catch {
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

    let filtered = [...globalForOrders.orders];

    // Apply search filter
    if (search) {
      filtered = filtered.filter(order => {
        const fieldValue = String(order[searchField as keyof OrderRecord] || '');
        return fieldValue.toLowerCase().includes(search.toLowerCase());
      });
    }

    // Sort by createdAt descending
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Paginate
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paginatedOrders = filtered.slice(start, start + pageSize);

    return NextResponse.json({
      success: true,
      orders: paginatedOrders,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}