"use client";

import { useState, useCallback, useRef } from "react";

interface UseAsyncActionOptions {
  onSuccess?: (result: unknown) => void;
  onError?: (error: unknown) => void;
  onFinally?: () => void;
}

/**
 * 用于处理异步操作的 Hook，防止重复提交
 * @returns isLoading - 是否正在执行
 * @returns execute - 执行函数，返回 Promise
 * @returns reset - 重置状态
 */
export function useAsyncAction<
  T extends (...args: unknown[]) => Promise<unknown>,
>(action: T, options: UseAsyncActionOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const isExecutingRef = useRef(false);

  const execute = useCallback(
    async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
      // 使用 ref 进行同步检查，避免状态更新延迟问题
      if (isExecutingRef.current) {
        return undefined;
      }

      isExecutingRef.current = true;
      setIsLoading(true);

      try {
        const result = await action(...args);
        options.onSuccess?.(result);
        return result as ReturnType<T>;
      } catch (error) {
        options.onError?.(error);
        throw error;
      } finally {
        isExecutingRef.current = false;
        setIsLoading(false);
        options.onFinally?.();
      }
    },
    [action, options],
  );

  const reset = useCallback(() => {
    isExecutingRef.current = false;
    setIsLoading(false);
  }, []);

  return {
    isLoading,
    execute,
    reset,
    isExecuting: () => isExecutingRef.current,
  };
}

/**
 * 用于管理多个并发操作的 Hook
 * 每个操作通过 ID 区分，互不影响
 */
export function useAsyncActionMap<
  T extends (...args: unknown[]) => Promise<unknown>,
>(action: T, options: UseAsyncActionOptions = {}) {
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const executingRef = useRef<Record<string, boolean>>({});

  const execute = useCallback(
    async (
      id: string,
      ...args: Parameters<T>
    ): Promise<ReturnType<T> | undefined> => {
      if (executingRef.current[id]) {
        return undefined;
      }

      executingRef.current[id] = true;
      setLoadingMap((prev: Record<string, boolean>) => ({
        ...prev,
        [id]: true,
      }));

      try {
        const result = await action(...args);
        options.onSuccess?.(result);
        return result as ReturnType<T>;
      } catch (error) {
        options.onError?.(error);
        throw error;
      } finally {
        executingRef.current[id] = false;
        setLoadingMap((prev: Record<string, boolean>) => ({
          ...prev,
          [id]: false,
        }));
        options.onFinally?.();
      }
    },
    [action, options],
  );

  const isLoading = useCallback(
    (id: string) => loadingMap[id] || false,
    [loadingMap],
  );

  const reset = useCallback((id?: string) => {
    if (id) {
      executingRef.current[id] = false;
      setLoadingMap((prev: Record<string, boolean>) => ({
        ...prev,
        [id]: false,
      }));
    } else {
      executingRef.current = {};
      setLoadingMap({});
    }
  }, []);

  return {
    isLoading,
    execute,
    reset,
    isExecuting: (id: string) => executingRef.current[id] || false,
  };
}

export default useAsyncAction;
