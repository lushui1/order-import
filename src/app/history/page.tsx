'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Order {
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

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState('receiverName');

  useEffect(() => {
    fetchOrders();
  }, [page, search]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search,
        field: searchField,
      });
      
      const response = await fetch(`/api/orders?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setOrders(result.orders);
        setTotal(result.total);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchOrders();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">历史运单</h1>
            <p className="text-gray-600 mt-2">查看已导入的运单记录</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            新建导入
          </Link>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex gap-3">
            <select
              value={searchField}
              onChange={(e) => setSearchField(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="receiverName">收件人姓名</option>
              <option value="externalCode">外部编码</option>
              <option value="senderName">发件人姓名</option>
            </select>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
            >
              搜索
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex gap-6 text-sm text-gray-600">
            <span>总计：<strong>{total}</strong> 条</span>
            <span>当前显示：第 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} 条</span>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-20 text-center text-gray-500">
            暂无数据
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">外部编码</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">发件人</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">发件人电话</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">收件人</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">收件人电话</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">重量</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">件数</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">温层</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{order.externalCode || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.senderName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.senderPhone}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.receiverName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.receiverPhone}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.weight} kg</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.quantity}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          order.tempZone === '常温' ? 'bg-green-100 text-green-800' :
                          order.tempZone === '冷藏' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {order.tempZone}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleString('zh-CN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <span className="px-4 py-2 text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </main>
  );
}