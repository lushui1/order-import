'use client';

import { useState } from 'react';
import { OrderData, ValidationError } from '@/types';

interface DataPreviewProps {
  data: Record<string, unknown>[];
  errors: ValidationError[];
  onDataChange: (data: Record<string, unknown>[]) => void;
}

// Field display configuration
const FIELD_CONFIG: { key: keyof OrderData; label: string; required: boolean }[] = [
  { key: 'externalCode', label: '外部编码', required: false },
  { key: 'senderName', label: '发件人', required: true },
  { key: 'senderPhone', label: '发件人电话', required: true },
  { key: 'senderAddress', label: '发件人地址', required: true },
  { key: 'receiverName', label: '收件人', required: true },
  { key: 'receiverPhone', label: '收件人电话', required: true },
  { key: 'receiverAddress', label: '收件人地址', required: true },
  { key: 'weight', label: '重量(kg)', required: true },
  { key: 'quantity', label: '件数', required: true },
  { key: 'tempZone', label: '温层', required: true },
  { key: 'note', label: '备注', required: false },
];

export default function DataPreview({ data, errors, onDataChange }: DataPreviewProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Get errors for a specific cell
  const getCellErrors = (rowIndex: number, field: string): ValidationError[] => {
    return errors.filter(e => e.row === rowIndex + 1 && e.field === field);
  };

  // Check if a cell has error
  const hasError = (rowIndex: number, field: string): boolean => {
    return getCellErrors(rowIndex, field).length > 0;
  };

  // Get all errors for a row
  const getRowErrors = (rowIndex: number): ValidationError[] => {
    return errors.filter(e => e.row === rowIndex + 1);
  };

  // Handle cell click to start editing
  const handleCellClick = (rowIndex: number, field: string, value: unknown) => {
    setEditingCell({ row: rowIndex, field });
    setEditValue(String(value || ''));
  };

  // Handle cell edit save
  const handleCellBlur = () => {
    if (editingCell) {
      const newData = [...data];
      newData[editingCell.row] = {
        ...newData[editingCell.row],
        [editingCell.field]: editValue,
      };
      onDataChange(newData);
      setEditingCell(null);
    }
  };

  // Handle key press in edit mode
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // Delete a row
  const handleDeleteRow = (rowIndex: number) => {
    const newData = data.filter((_, i) => i !== rowIndex);
    onDataChange(newData);
  };

  // Add empty row
  const handleAddRow = () => {
    const newData = [...data, {}];
    onDataChange(newData);
  };

  return (
    <div className="w-full">
      {/* Error summary */}
      {errors.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-red-800 font-semibold mb-2">
            发现 {errors.length} 个错误：
          </h3>
          <ul className="text-red-600 text-sm space-y-1 max-h-40 overflow-y-auto">
            {errors.map((error, index) => (
              <li key={index}>
                第 {error.row} 行，{FIELD_CONFIG.find(f => f.key === error.field)?.label || error.field}：{error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats */}
      <div className="mb-4 flex gap-4 text-sm text-gray-600">
        <span>总计：{data.length} 条</span>
        <span className="text-green-600">
          有效：{data.length - new Set(errors.map(e => e.row)).size} 条
        </span>
        <span className="text-red-600">
          错误：{new Set(errors.map(e => e.row)).size} 条
        </span>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  #
                </th>
                {FIELD_CONFIG.map(field => (
                  <th
                    key={field.key}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((row, rowIndex) => {
                const rowErrors = getRowErrors(rowIndex);
                const hasRowError = rowErrors.length > 0;
                
                return (
                  <tr
                    key={rowIndex}
                    className={`hover:bg-gray-50 ${hasRowError ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {rowIndex + 1}
                    </td>
                    {FIELD_CONFIG.map(field => {
                      const cellErrors = getCellErrors(rowIndex, field.key);
                      const isEditing = editingCell?.row === rowIndex && editingCell?.field === field.key;
                      const cellHasError = cellErrors.length > 0;
                      
                      return (
                        <td
                          key={field.key}
                          className={`px-4 py-3 text-sm whitespace-nowrap ${
                            cellHasError ? 'bg-red-100' : ''
                          }`}
                          onClick={() => handleCellClick(rowIndex, field.key, row[field.key])}
                          style={{ minWidth: '120px' }}
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellBlur}
                              onKeyDown={handleKeyDown}
                              className="w-full px-2 py-1 border border-blue-500 rounded"
                              autoFocus
                            />
                          ) : (
                            <span className={cellHasError ? 'text-red-600' : 'text-gray-900'}>
                              {String(row[field.key] || '')}
                            </span>
                          )}
                          {cellHasError && !isEditing && (
                            <div className="text-xs text-red-600 mt-1">
                              {cellErrors[0].message}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleDeleteRow(rowIndex)}
                        className="text-red-600 hover:text-red-800"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add row button */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={handleAddRow}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
        >
          + 新增行
        </button>
      </div>
    </div>
  );
}