'use client';

import { useState, useEffect } from 'react';
import { SYSTEM_FIELDS } from '@/lib/excel-parser';

interface ColumnMapperProps {
  headers: string[];
  currentMapping: Record<string, string>;  // Excel列名 -> 系统字段名
  onMappingChange: (mapping: Record<string, string>) => void;
  onConfirm: () => void;
  fingerprint: string;
}

// System field display names
const FIELD_DISPLAY_NAMES: Record<string, string> = {
  externalCode: '外部编码（可选）',
  senderName: '发件人姓名',
  senderPhone: '发件人电话',
  senderAddress: '发件人地址',
  receiverName: '收件人姓名',
  receiverPhone: '收件人电话',
  receiverAddress: '收件人地址',
  weight: '重量(kg)',
  quantity: '件数',
  tempZone: '温层',
  note: '备注（可选）',
};

export default function ColumnMapper({
  headers,
  currentMapping,
  onMappingChange,
  onConfirm,
  fingerprint,
}: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(currentMapping);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMapping(currentMapping);
  }, [currentMapping]);

  const handleFieldChange = (header: string, field: string) => {
    const newMapping = { ...mapping };
    // Remove any existing mapping to this field
    for (const [key, value] of Object.entries(newMapping)) {
      if (value === field) {
        delete newMapping[key];
      }
    }
    if (field) {
      newMapping[header] = field;
    } else {
      delete newMapping[header];
    }
    setMapping(newMapping);
    onMappingChange(newMapping);
  };

  const handleSaveAndConfirm = async () => {
    setSaving(true);
    try {
      // Save template rule to backend
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint,
          mapping,
          headers,
        }),
      });
    } catch (error) {
      console.error('Failed to save template rule:', error);
    }
    setSaving(false);
    onConfirm();
  };

  // Count mapped required fields
  const requiredFields = ['senderName', 'senderPhone', 'senderAddress', 'receiverName', 'receiverPhone', 'receiverAddress', 'weight', 'quantity', 'tempZone'];
  const mappedRequired = requiredFields.filter(f => 
    Object.values(mapping).includes(f)
  ).length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">📋 列映射配置</h3>
          <p className="text-sm text-gray-500 mt-1">
            系统自动识别了部分列，请确认或调整映射关系。
            已映射 {mappedRequired}/{requiredFields.length} 个必填字段。
          </p>
        </div>
        <button
          onClick={handleSaveAndConfirm}
          disabled={mappedRequired < requiredFields.length || saving}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            mappedRequired >= requiredFields.length && !saving
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {saving ? '保存中...' : mappedRequired >= requiredFields.length ? '✓ 确认映射' : `还缺 ${requiredFields.length - mappedRequired} 个必填字段`}
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider px-2 pb-2 border-b">
          <span>Excel 列名</span>
          <span>系统字段</span>
        </div>

        {headers.map((header) => {
          const currentField = mapping[header] || '';
          return (
            <div
              key={header}
              className={`grid grid-cols-2 gap-4 px-2 py-2 rounded-lg hover:bg-gray-50 ${
                currentField ? 'bg-green-50/50' : 'bg-yellow-50/50'
              }`}
            >
              <span className="flex items-center text-sm font-medium text-gray-700">
                <span className={`w-2 h-2 rounded-full mr-2 ${currentField ? 'bg-green-500' : 'bg-yellow-500'}`} />
                {header}
              </span>
              <select
                value={currentField}
                onChange={(e) => handleFieldChange(header, e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- 不映射 --</option>
                {SYSTEM_FIELDS.map((field) => (
                  <option
                    key={field}
                    value={field}
                    disabled={field !== currentField && Object.values(mapping).includes(field)}
                  >
                    {FIELD_DISPLAY_NAMES[field] || field}
                    {requiredFields.includes(field) ? ' *' : ''}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        💡 确认映射后，系统会记住此次映射规则。下次上传相同结构的模板时自动应用。
      </p>
    </div>
  );
}
