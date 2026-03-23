import type { ContractAttachmentTarget } from "./contracts.import.types";
import { normalizeContractNoKey } from "./contracts.attachment.utils";
import { resolveErrorMessage } from "../../common/utils/error.utils";

export function resolveBatchAttachmentErrorMessage(error: unknown): string {
  return resolveErrorMessage(error, "附件绑定失败");
}

export function resolveContractByAttachmentFileName(
  fileName: string,
  targets: ContractAttachmentTarget[],
): { target?: ContractAttachmentTarget; error?: string } {
  const baseName = (fileName || "").replace(/\.[^.]+$/, "");
  const normalizedFileBase = normalizeContractNoKey(baseName);
  if (!normalizedFileBase) {
    return { error: "文件名为空，无法匹配合同编号" };
  }

  const exact = targets.find(
    (item) => item.normalizedContractNo === normalizedFileBase,
  );
  if (exact) {
    return { target: exact };
  }

  const matched = targets
    .filter((item) => normalizedFileBase.includes(item.normalizedContractNo))
    .sort(
      (a, b) => b.normalizedContractNo.length - a.normalizedContractNo.length,
    );

  if (matched.length === 0) {
    return { error: "文件名未包含系统内可识别的合同编号" };
  }

  if (
    matched.length > 1 &&
    matched[0].normalizedContractNo.length ===
      matched[1].normalizedContractNo.length &&
    matched[0].normalizedContractNo !== matched[1].normalizedContractNo
  ) {
    return {
      error: "文件名匹配到多个合同编号，请在文件名中仅保留一个合同编号",
    };
  }

  return { target: matched[0] };
}
