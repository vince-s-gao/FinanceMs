import { useState } from 'react';
import { message } from 'antd';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/error';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getDatePart(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function useExport(apiPath: string, filenamePrefix: string) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (params?: Record<string, unknown>) => {
    setExporting(true);
    try {
      const blob = await api.get<Blob>(`${apiPath}/export/excel`, {
        params,
        responseType: 'blob',
      });
      downloadBlob(blob, `${filenamePrefix}-${getDatePart()}.xlsx`);
      message.success('导出成功');
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '导出失败'));
    } finally {
      setExporting(false);
    }
  };

  return {
    exporting,
    handleExport,
  };
}
