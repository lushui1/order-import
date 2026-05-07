'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

interface FileUploadProps {
  onUploadSuccess: (result: {
    data: Record<string, unknown>[];
    headers: string[];
    errors: ValidationError[];
    fingerprint: string;
    hasSavedMapping: boolean;
    mapping?: Record<string, string>;
  }) => void;
  onUploadError: (error: string) => void;
  onParseProgress?: (current: number, total: number) => void;
}

interface ValidationError {
  row: number;
  field: string;
  value: unknown;
  message: string;
}

export default function FileUpload({ onUploadSuccess, onUploadError, onParseProgress }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setIsUploading(true);

    try {
      // Validate file type
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (!validExtensions.includes(fileExt)) {
        onUploadError('请上传 .xlsx、.xls 或 .csv 格式的文件');
        setIsUploading(false);
        return;
      }

      // Simulate parse progress for better UX
      if (onParseProgress) {
        onParseProgress(0, 100);
      }

      const formData = new FormData();
      formData.append('file', file);
      
      if (onParseProgress) {
        onParseProgress(30, 100);
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (onParseProgress) {
        onParseProgress(70, 100);
      }

      const result = await response.json();

      if (onParseProgress) {
        onParseProgress(100, 100);
      }

      if (result.success) {
        onUploadSuccess({
          data: result.data,
          headers: result.headers,
          errors: result.errors || [],
          fingerprint: result.fingerprint || '',
          hasSavedMapping: result.hasSavedMapping || false,
          mapping: result.mapping,
        });
        toast.success(`成功解析 ${result.data.length} 行数据`);
      } else {
        onUploadError(result.error || '解析失败');
      }
    } catch (error) {
      console.error('Upload error:', error);
      onUploadError('上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  }, [onUploadSuccess, onUploadError, onParseProgress]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    multiple: false,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-xl p-12
        transition-colors cursor-pointer
        ${isDragActive 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }
        ${isUploading ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <input {...getInputProps()} />
      
      <div className="text-center">
        {isUploading ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600 font-medium">正在解析文件...</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-900 mb-2">
              {isDragActive ? '松开以上传文件' : '拖拽文件到此处，或点击上传'}
            </p>
            <p className="text-sm text-gray-500">
              支持 .xlsx、.xls、.csv 格式，最大 50MB
            </p>
          </>
        )}
      </div>
    </div>
  );
}
