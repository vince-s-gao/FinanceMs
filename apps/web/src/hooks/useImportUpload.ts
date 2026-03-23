import { useMemo, useState } from "react";
import type { UploadProps } from "antd";
import { message } from "antd";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import { resolveUploadFileMeta } from "@/lib/upload";

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

interface UseImportUploadOptions {
  endpoint: string;
  onImported?: (result: ImportResult) => Promise<void> | void;
  accept?: string;
}

export function useImportUpload(options: UseImportUploadOptions) {
  const { endpoint, onImported, accept = ".csv,.xlsx,.xls" } = options;
  const [importing, setImporting] = useState(false);

  const uploadProps: UploadProps = useMemo(
    () => ({
      showUploadList: false,
      accept,
      customRequest: async ({ file, onSuccess, onError }) => {
        const { blob, name } = resolveUploadFileMeta(file);
        if (!blob) {
          onError?.(new Error("不支持的文件类型"));
          message.error("不支持的文件类型");
          return;
        }

        setImporting(true);
        try {
          const formData = new FormData();
          formData.append("file", blob);
          const result = await api.post<ImportResult>(endpoint, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          if (result.failed > 0) {
            const sample = result.errors
              .slice(0, 3)
              .map((item) => `第${item.row}行: ${item.message}`)
              .join("；");
            message.warning(
              `导入完成：成功 ${result.success} 条，失败 ${result.failed} 条。${sample}`,
            );
          } else {
            message.success(`导入成功：共 ${result.success} 条`);
          }
          await onImported?.(result);
          onSuccess?.(result);
        } catch (error: unknown) {
          message.error(getErrorMessage(error, `导入失败（${name}）`));
          onError?.(error as Error);
        } finally {
          setImporting(false);
        }
      },
    }),
    [accept, endpoint, onImported],
  );

  return {
    importing,
    uploadProps,
  };
}
