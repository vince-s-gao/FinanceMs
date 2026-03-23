import { BadRequestException } from "@nestjs/common";
import { buildSingleFileInterceptorOptions } from "./upload.utils";

describe("upload.utils", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  function invokeFileFilter(
    options: ReturnType<typeof buildSingleFileInterceptorOptions>,
    file: Partial<Express.Multer.File>,
  ) {
    return new Promise<{ error: Error | null; accepted: boolean }>(
      (resolve) => {
        options.fileFilter?.(
          {},
          file as Express.Multer.File,
          (error: Error | null, accepted: boolean) =>
            resolve({ error, accepted }),
        );
      },
    );
  }

  it("should accept supported extension in development", async () => {
    process.env.NODE_ENV = "development";
    const options = buildSingleFileInterceptorOptions([".pdf"]);
    const result = await invokeFileFilter(options, {
      originalname: "contract.pdf",
      mimetype: "application/octet-stream",
    });

    expect(result.error).toBeNull();
    expect(result.accepted).toBe(true);
  });

  it("should reject unsupported extension", async () => {
    process.env.NODE_ENV = "development";
    const options = buildSingleFileInterceptorOptions([".pdf"]);
    const result = await invokeFileFilter(options, {
      originalname: "script.sh",
      mimetype: "text/plain",
    });

    expect(result.accepted).toBe(false);
    expect(result.error).toBeInstanceOf(BadRequestException);
  });

  it("should reject invalid mime type in production", async () => {
    process.env.NODE_ENV = "production";
    const options = buildSingleFileInterceptorOptions([".xlsx"]);
    const result = await invokeFileFilter(options, {
      originalname: "contracts.xlsx",
      mimetype: "text/plain",
    });

    expect(result.accepted).toBe(false);
    expect(result.error).toBeInstanceOf(BadRequestException);
  });

  it("should accept valid mime type in production", async () => {
    process.env.NODE_ENV = "production";
    const options = buildSingleFileInterceptorOptions([".xlsx"]);
    const result = await invokeFileFilter(options, {
      originalname: "contracts.xlsx",
      mimetype:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    expect(result.error).toBeNull();
    expect(result.accepted).toBe(true);
  });
});
