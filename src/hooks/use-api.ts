import { useState, useCallback } from "react";
import { AxiosError } from "axios";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Thin wrapper around any API call.
 * Usage:
 *   const { data, loading, error, execute } = useApi(audienceApi.list);
 *   useEffect(() => { execute(); }, []);
 */
export function useApi<T, Args extends unknown[] = []>(
  fn: (...args: Args) => Promise<{ data: { data: T } }>
) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: Args) => {
      setState({ data: null, loading: true, error: null });
      try {
        const res = await fn(...args);
        setState({ data: res.data.data, loading: false, error: null });
        return res.data.data;
      } catch (err) {
        const message =
          err instanceof AxiosError
            ? (err.response?.data as { error?: string })?.error ?? err.message
            : "Unexpected error";
        setState({ data: null, loading: false, error: message });
        throw err;
      }
    },
    [fn]
  );

  return { ...state, execute };
}
