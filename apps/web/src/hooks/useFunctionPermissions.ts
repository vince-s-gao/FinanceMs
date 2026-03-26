import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

interface PermissionResponse {
  functions?: string[];
}

export function useFunctionPermissions() {
  const [loaded, setLoaded] = useState(false);
  const [functionSet, setFunctionSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await api.get<PermissionResponse>("/permissions/me");
        if (!mounted) return;
        setFunctionSet(new Set(res.functions || []));
      } catch {
        if (!mounted) return;
        setFunctionSet(new Set());
      } finally {
        if (mounted) {
          setLoaded(true);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const has = useCallback(
    (...permissions: string[]) => permissions.every((p) => functionSet.has(p)),
    [functionSet],
  );

  return useMemo(
    () => ({
      loaded,
      has,
      functions: functionSet,
    }),
    [has, loaded, functionSet],
  );
}
