import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExport } from "@/hooks/useExport";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock("antd", () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { api } from "@/lib/api";
import { message } from "antd";

describe("useExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports excel and shows success message", async () => {
    const fakeBlob = new Blob(["ok"], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    vi.mocked(api.get).mockResolvedValue(fakeBlob as never);

    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test-url");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName: string) => {
        if (tagName.toLowerCase() === "a") {
          return {
            href: "",
            download: "",
            click,
          } as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tagName);
      });

    const { result } = renderHook(() => useExport("/customers", "customers"));

    await act(async () => {
      await result.current.handleExport({ keyword: "abc" });
    });

    expect(api.get).toHaveBeenCalledWith("/customers/export/excel", {
      params: { keyword: "abc" },
      responseType: "blob",
    });
    expect(message.success).toHaveBeenCalledWith("导出成功");
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    createElementSpy.mockRestore();
  });

  it("shows error message when export fails", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useExport("/customers", "customers"));

    await act(async () => {
      await result.current.handleExport();
    });

    expect(message.error).toHaveBeenCalled();
  });
});
