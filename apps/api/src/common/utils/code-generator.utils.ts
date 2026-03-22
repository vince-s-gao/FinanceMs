type FindFirstModel = {
  findFirst: (args: {
    where: Record<string, unknown>;
    orderBy: Record<string, "asc" | "desc">;
    select: Record<string, boolean>;
  }) => Promise<Record<string, unknown> | null>;
};

type GenerateCodeOptions = {
  model: FindFirstModel;
  field: string;
  prefix: string;
  sequenceRegex: RegExp;
  sequenceLength: number;
};

type CreateWithGeneratedCodeOptions<T> = {
  generateCode: () => Promise<string>;
  create: (code: string) => Promise<T>;
  isCodeConflict: (error: unknown) => boolean;
  exhaustedError: () => Error;
  maxRetries?: number;
};

/**
 * 根据前缀和已有最大值生成下一个编号，支持通过正则提取序号段。
 */
export async function generatePrefixedCode(
  options: GenerateCodeOptions,
): Promise<string> {
  const last = await options.model.findFirst({
    where: {
      [options.field]: {
        startsWith: options.prefix,
      },
    },
    orderBy: {
      [options.field]: "desc",
    },
    select: {
      [options.field]: true,
    },
  });

  const lastValue = (last?.[options.field] as string | undefined) || "";
  const matched = lastValue.match(options.sequenceRegex);
  const sequence = matched ? Number(matched[1]) + 1 : 1;

  return `${options.prefix}${String(sequence).padStart(options.sequenceLength, "0")}`;
}

/**
 * 在唯一索引冲突时自动重试（通常用于编号生成后创建实体）。
 */
export async function createWithGeneratedCode<T>(
  options: CreateWithGeneratedCodeOptions<T>,
): Promise<T> {
  const retries = options.maxRetries ?? 8;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    const code = await options.generateCode();
    try {
      return await options.create(code);
    } catch (error) {
      if (options.isCodeConflict(error)) {
        if (attempt < retries - 1) {
          continue;
        }
        break;
      }
      throw error;
    }
  }

  throw options.exhaustedError();
}
