import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFunctionPermissions } from "@/hooks/useFunctionPermissions";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from "@/lib/api";

describe("useFunctionPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads permissions and checks permission keys", async () => {
    vi.mocked(api.get).mockResolvedValue({
      functions: ["contract.view", "invoice.view"],
    } as never);

    const { result } = renderHook(() => useFunctionPermissions());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.has("contract.view")).toBe(true);
    expect(result.current.has("invoice.view", "contract.view")).toBe(true);
    expect(result.current.has("contract.delete")).toBe(false);
  });

  it("falls back to empty set when request fails", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useFunctionPermissions());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.has("contract.view")).toBe(false);
    expect(result.current.functions.size).toBe(0);
  });
});
