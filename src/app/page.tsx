'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import FileUpload from '@/components/FileUpload';
import DataPreview from '@/components/DataPreview';
import ColumnMapper from '@/components/ColumnMapper';
import { ValidationError } from '@/types';

type ImportPhase = 'idle' | 'parsing' | 'mapping' | 'validating' | 'preview' | 'submitting';

export default function Home() {
  const [data, setData] = useState<Record<string, unknown>[] | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fingerprint, setFingerprint] = useState<string>('');
  const [hasSavedMapping, setHasSavedMapping] = useState(false);
  
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0 });
  const [submitProgress, setSubmitProgress] = useState({ current: 0, total: 0 });
  
  const fileRef = useRef<File | null>(null);

  const handleUploadSuccess = async (result: {
    data: Record<string, unknown>[];
    headers: string[];
    errors: ValidationError[];
    fingerprint: string;
    hasSavedMapping: boolean;
    mapping?: Record<string, string>;
  }) => {
    setData(result.data);
    setHeaders(result.headers);
    setErrors(result.errors);
    setFingerprint(result.fingerprint);
    setHasSavedMapping(result.hasSavedMapping);
    setMapping(result.mapping || {});
    setPhase(result.hasSavedMapping ? 'preview' : 'mapping');
  };

  const handleUploadError = (error: string) => {
    toast.error(error);
    setPhase('idle');
  };

  const handleParseProgress = (current: number, total: number) => {
    setParseProgress({ current, total });
  };

  const handleMappingChange = (newMapping: Record<string, string>) => {
    setMapping(newMapping);
  };

  const handleMappingConfirm = () => {
    // Re-apply mapping to data
    if (data && Object.keys(mapping).length > 0) {
      const remappedData = data.map(row => {
        const newRow: Record<string, unknown> = {};
        for (const [excelCol, systemField] of Object.entries(mapping)) {
          if (row[excelCol] !== undefined) {
            newRow[systemField] = row[excelCol];
          }
        }
        return newRow;
      });
      setData(remappedData);
    }
    setPhase('preview');
    toast.success('映射已确认并保存');
  };

  const handleDataChange = (newData: Record<string, unknown>[]) => {
    setData(newData);
  };

  const handleSubmit = async () => {
    if (!data || data.length === 0) {
      toast.error('请先上传数据');
      return;
    }

    setPhase('submitting');
    setSubmitProgress({ current: 0, total: data.length });

    try {
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
        } else if (result.duplicateErrors) {
          // Show duplicate errors
          setErrors(prev => [...prev, ...result.duplicateErrors]);
          toast.error('发现重复的外部编码，请修改后再提交');
          setPhase('preview');
          return;
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
      
      setTimeout(() => {
        setData(null);
        setErrors([]);
        setHeaders([]);
        setMapping({});
        setPhase('idle');
      }, 2000);
    } catch (error) {
      toast.error('提交失败，请重试');
      setPhase('preview');
    } finally {
      setSubmitProgress({ current: 0, total: 0 });
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!data || data.length === 0) {
      toast.error('没有数据可导出');
      return;
    }

    const headers = ['外部编码', '发件人姓名', '发件人电话', '发件人地址', '收件人姓名', '收件人电话', '收件人地址', '重量(kg)', '件数', '温层', '备注'];
    const fields = ['externalCode', 'senderName', 'senderPhone', 'senderAddress', 'receiverName', 'receiverPhone', 'receiverAddress', 'weight', 'quantity', 'tempZone', 'note'];
    
    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      ...data.map(row => fields.map(f => row[f] || ''))
    ]);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // 外部编码
      { wch: 12 }, // 发件人姓名
      { wch: 15 }, // 发件人电话
      { wch: 30 }, // 发件人地址
      { wch: 12 }, // 收件人姓名
      { wch: 15 }, // 收件人电话
      { wch: 30 }, // 收件人地址
      { wch: 10 }, // 重量
      { wch: 8 },  // 件数
      { wch: 8 },  // 温层
      { wch: 20 }, // 备注
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '订单数据');
    
    XLSX.writeFile(wb, `订单数据_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success('Excel 导出成功');
  };

  const getPhaseStatus = (stepPhase: ImportPhase) => {
    const phases: ImportPhase[] = ['idle', 'parsing', 'mapping', 'validating', 'preview', 'submitting'];
    const currentIndex = phases.indexOf(phase);
    const stepIndex = phases.indexOf(stepPhase);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
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
            <Link href="/imports" className="text-gray-600 hover:text-blue-600 text-sm font-medium">
              📊 导入记录
            </Link>
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
        <div className="mb-8 flex items-center justify-center gap-4">
          {[
            { phase: 'idle' as ImportPhase, label: '上传文件', icon: '1' },
            { phase: 'parsing' as ImportPhase, label: '解析数据', icon: '2' },
            { phase: 'mapping' as ImportPhase, label: '列映射', icon: '3' },
            { phase: 'preview' as ImportPhase, label: '预览编辑', icon: '4' },
            { phase: 'submitting' as ImportPhase, label: '提交下单', icon: '5' },
          ].map((step, i, arr) => {
            const status = getPhaseStatus(step.phase);
            return (
              <div key={step.phase} className="flex items-center">
                <div className={`flex items-center gap-2 ${
                  status === 'completed' ? 'text-green-600' :
                  status === 'active' ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    status === 'completed' ? 'bg-green-600 text-white' :
                    status === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {status === 'completed' ? '✓' : step.icon}
                  </div>
                  <span className="font-medium text-sm hidden sm:inline">{step.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${
                    status === 'completed' ? 'bg-green-300' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Parse progress bar */}
        {phase === 'parsing' && parseProgress.total > 0 && (
          <div className="max-w-2xl mx-auto mb-6">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">正在解析 Excel...</span>
                <span className="text-sm font-medium text-blue-600">
                  {parseProgress.current} / {parseProgress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(parseProgress.current / parseProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Upload section */}
        {phase === 'idle' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
              <FileUpload
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
                onParseProgress={handleParseProgress}
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

        {/* Column mapping section */}
        {phase === 'mapping' && headers.length > 0 && (
          <div className="max-w-3xl mx-auto">
            <ColumnMapper
              headers={headers}
              currentMapping={mapping}
              onMappingChange={handleMappingChange}
              onConfirm={handleMappingConfirm}
              fingerprint={fingerprint}
            />
          </div>
        )}

        {/* Preview section */}
        {phase === 'preview' && data && (
          <div className="space-y-6">
            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <button
                  onClick={() => { 
                    setData(null); 
                    setErrors([]); 
                    setHeaders([]); 
                    setMapping({});
                    setPhase('idle');
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm"
                >
                  ← 重新上传
                </button>
                <button
                  onClick={handleExportExcel}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm"
                >
                  📥 导出 Excel
                </button>
              </div>
              <button
                onClick={handleSubmit}
                disabled={errors.length > 0}
                className={`px-6 py-2.5 rounded-lg font-medium text-sm shadow-sm transition-all ${
                  errors.length > 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md'
                }`}
              >
                {errors.length > 0 
                  ? `请先修正 ${errors.length} 个错误` 
                  : `✓ 提交 ${data.length} 条订单`}
              </button>
            </div>

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

        {/* Submit progress */}
        {phase === 'submitting' && submitProgress.total > 0 && (
          <div className="max-w-2xl mx-auto">
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
          </div>
        )}
      </div>
    </main>
  );
}
