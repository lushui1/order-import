'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import FileUpload from '@/components/FileUpload';
import DataPreview from '@/components/DataPreview';
import { ValidationError } from '@/types';

export default function Home() {
  const [data, setData] = useState<Record<string, unknown>[] | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    // Re-validate after change
    // In a real app, you'd call the validation API again here
  };

  const handleSubmit = async () => {
    if (!data || data.length === 0) {
      toast.error('请先上传数据');
      return;
    }

    if (errors.length > 0) {
      toast.error('存在错误数据，请先修正');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: data }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`成功提交 ${result.successCount} 条订单`);
        // Clear data after successful submit
        setData(null);
        setErrors([]);
        setHeaders([]);
      } else {
        toast.error(result.error || '提交失败');
      }
    } catch (error) {
      toast.error('提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    if (!data || data.length === 0) {
      toast.error('没有数据可导出');
      return;
    }

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(h => {
          const val = row[h] || '';
          // Escape quotes and wrap in quotes if contains comma
          const str = String(val).replace(/"/g, '""');
          return str.includes(',') ? `"${str}"` : str;
        }).join(',')
      )
    ].join('\n');

    // Download
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
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">万能导入系统</h1>
          <p className="text-gray-600 mt-2">支持多种 Excel 模板自动识别与批量下单</p>
        </div>

        {/* Step indicator */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${data ? 'text-green-600' : 'text-blue-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${data ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}>
                {data ? '✓' : '1'}
              </div>
              <span className="font-medium">上传文件</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 rounded">
              <div className={`h-1 rounded ${data ? 'bg-green-600' : 'bg-gray-200'}`} style={{ width: data ? '100%' : '0%' }} />
            </div>
            <div className={`flex items-center gap-2 ${data ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${data ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                2
              </div>
              <span className="font-medium">预览数据</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 rounded" />
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-600">
                3
              </div>
              <span className="font-medium">提交下单</span>
            </div>
          </div>
        </div>

        {/* Upload section */}
        {!data && (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">上传 Excel 文件</h2>
            <FileUpload
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
            />
          </div>
        )}

        {/* Preview section */}
        {data && (
          <div className="space-y-6">
            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setData(null);
                  setErrors([]);
                  setHeaders([]);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
              >
                重新上传
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
              >
                导出数据
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || errors.length > 0}
                className={`px-6 py-2 rounded-lg font-medium ${
                  isSubmitting || errors.length > 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isSubmitting ? '提交中...' : '提交下单'}
              </button>
            </div>

            {/* Data preview */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">数据预览</h2>
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