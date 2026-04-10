type TaskLockKey = string;

const taskLocks = new Map<TaskLockKey, boolean>();

export function acquireTaskLock(key: TaskLockKey): boolean {
  if (taskLocks.get(key)) {
    return false;
  }
  taskLocks.set(key, true);
  return true;
}

export function releaseTaskLock(key: TaskLockKey): void {
  taskLocks.delete(key);
}

export function isTaskLocked(key: TaskLockKey): boolean {
  return taskLocks.get(key) || false;
}

export function withTaskLock<T>(
  key: TaskLockKey,
  task: () => Promise<T>,
): Promise<T> {
  if (!acquireTaskLock(key)) {
    return Promise.reject(new Error("Task is already running"));
  }

  return task()
    .then((result) => {
      releaseTaskLock(key);
      return result;
    })
    .catch((error) => {
      releaseTaskLock(key);
      throw error;
    });
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function throttled(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
