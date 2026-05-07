'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import DataPreview from '@/components/DataPreview';
import { ValidationError } from '@/types';

export default function Home() {
  const [data, setData] = useState<Record<string, unknown>[] | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState({ current: 0, total: 0 });

  const handleUploadSuccess = (result: {
    data: Record<string, unknown>[];
    headers: string[];
    errors: ValidationError[];
  }) => {
    setData(result.data);
    setHeaders(result.headers);
    setErrors(result.errors);
  };

  const handleUploadError = (error: string) => {
    toast.error(error);
  };

  const handleDataChange = (newData: Record<string, unknown>[]) => {
    setData(newData);
  };

  const handleSubmit = async () => {
    if (!data || data.length === 0) {
      toast.error('请先上传数据');
      return;
    }

    setIsSubmitting(true);
    setSubmitProgress({ current: 0, total: data.length });

    try {
      // Simulate progress
      const batchSize = 50;
      const totalBatches = Math.ceil(data.length / batchSize);
      let allResults: { successCount: number; failCount: number } = { successCount: 0, failCount: 0 };

      for (let i = 0; i < totalBatches; i++) {
        const batch = data.slice(i * batchSize, (i + 1) * batchSize);
        
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders: batch }),
        });

        const result = await response.json();

        if (result.success) {
          allResults.successCount += result.successCount;
          allResults.failCount += result.failCount;
        }

        setSubmitProgress({ 
          current: Math.min((i + 1) * batchSize, data.length), 
          total: data.length 
        });
      }

      toast.success(`成功提交 ${allResults.successCount} 条订单`);
      if (allResults.failCount > 0) {
        toast.warning(`${allResults.failCount} 条订单提交失败`);
      }
      
      // Navigate to history after submit
      setTimeout(() => {
        setData(null);
        setErrors([]);
        setHeaders([]);
      }, 2000);
    } catch (error) {
      toast.error('提交失败，请重试');
    } finally {
      setIsSubmitting(false);
      setSubmitProgress({ current: 0, total: 0 });
    }
  };

  const handleExport = () => {
    if (!data || data.length === 0) {
      toast.error('没有数据可导出');
      return;
    }

    const csvHeaders = ['外部编码', '发件人姓名', '发件人电话', '发件人地址', '收件人姓名', '收件人电话', '收件人地址', '重量(kg)', '件数', '温层', '备注'];
    const fields = ['externalCode', 'senderName', 'senderPhone', 'senderAddress', 'receiverName', 'receiverPhone', 'receiverAddress', 'weight', 'quantity', 'tempZone', 'note'];
    
    const csvContent = [
      csvHeaders.join(','),
      ...data.map(row => 
        fields.map(f => {
          const val = row[f] || '';
          const str = String(val).replace(/"/g, '""');
          return str.includes(',') ? `"${str}"` : str;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `订单数据_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('导出成功');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              万
            </div>
            <h1 className="text-lg font-bold text-gray-900">万能导入系统</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/history" className="text-gray-600 hover:text-blue-600 text-sm font-medium">
              📋 历史运单
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero section */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-3">
            多模板自动导入下单
          </h2>
          <p className="text-gray-500 text-lg">
            上传 Excel 文件，自动识别模板，一键批量下单
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-center gap-6">
          <div className={`flex items-center gap-2 ${data ? 'text-green-600' : 'text-blue-600'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${data ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}>
              {data ? '✓' : '1'}
            </div>
            <span className="font-medium text-sm">上传文件</span>
          </div>
          <div className={`w-16 h-0.5 ${data ? 'bg-green-300' : 'bg-gray-200'}`} />
          <div className={`flex items-center gap-2 ${data ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${data ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              2
            </div>
            <span className="font-medium text-sm">预览编辑</span>
          </div>
          <div className={`w-16 h-0.5 ${isSubmitting ? 'bg-blue-300' : 'bg-gray-200'}`} />
          <div className={`flex items-center gap-2 ${isSubmitting ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isSubmitting ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              3
            </div>
            <span className="font-medium text-sm">提交下单</span>
          </div>
        </div>

        {/* Upload section */}
        {!data && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
              <FileUpload
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
              />
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {['标准模板', '电商模板', '英文模板', '分组模板', '多Sheet模板'].map((name, i) => (
                  <span key={i} className="px-3 py-1 bg-gray-50 text-gray-600 text-xs rounded-full border">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Preview section */}
        {data && (
          <div className="space-y-6">
            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <button
                  onClick={() => { setData(null); setErrors([]); setHeaders([]); }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm"
                >
                  ← 重新上传
                </button>
                <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm"
                >
                  📥 导出 CSV
                </button>
              </div>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || errors.length > 0}
                className={`px-6 py-2.5 rounded-lg font-medium text-sm shadow-sm transition-all ${
                  isSubmitting
                    ? 'bg-blue-400 text-white cursor-wait'
                    : errors.length > 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md'
                }`}
              >
                {isSubmitting 
                  ? `提交中... ${submitProgress.current}/${submitProgress.total}` 
                  : errors.length > 0 
                  ? `请先修正 ${errors.length} 个错误` 
                  : `✓ 提交 ${data.length} 条订单`}
              </button>
            </div>

            {/* Progress bar for submitting */}
            {isSubmitting && submitProgress.total > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">提交进度</span>
                  <span className="text-sm font-medium text-blue-600">
                    {submitProgress.current} / {submitProgress.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(submitProgress.current / submitProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Data preview */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <DataPreview
                data={data}
                errors={errors}
                onDataChange={handleDataChange}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}