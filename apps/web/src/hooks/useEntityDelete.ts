import { useState } from 'react';
import { message } from 'antd';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/error';

type BatchDeleteResult = {
  success: number;
  failed: number;
};

export function useEntityDelete(apiPath: string, entityName: string) {
  const [deleting, setDeleting] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const deleteOne = async (id: string): Promise<boolean> => {
    setDeleting(true);
    try {
      await api.delete(`${apiPath}/${id}`);
      message.success('删除成功');
      return true;
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '删除失败'));
      return false;
    } finally {
      setDeleting(false);
    }
  };

  const deleteBatch = async (ids: string[]): Promise<BatchDeleteResult> => {
    if (ids.length === 0) {
      message.info(`请先选择要删除的${entityName}`);
      return { success: 0, failed: 0 };
    }

    setBatchDeleting(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => api.delete(`${apiPath}/${id}`)),
      );
      const success = results.filter((result) => result.status === 'fulfilled').length;
      const failed = ids.length - success;

      if (success > 0) {
        message.success(`批量删除完成：成功 ${success} 条${failed > 0 ? `，失败 ${failed} 条` : ''}`);
      } else {
        message.error('批量删除失败');
      }

      return { success, failed };
    } finally {
      setBatchDeleting(false);
    }
  };

  return {
    deleting,
    batchDeleting,
    deleteOne,
    deleteBatch,
  };
}
