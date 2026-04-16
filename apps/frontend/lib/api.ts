import axios from "axios";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:8002");

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Important for Better-Auth cookies
});

// Request interceptor (removed legacy JWT token logic)
api.interceptors.request.use((config) => {
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
      return Promise.reject(error);
    }

    // Extract a human-readable error message
    const serverMsg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "未知错误";

    const status = error.response?.status;
    const label = status ? `[${status}] ` : "";

    // Show toast – dynamically import sonner to avoid SSR issues
    if (typeof window !== "undefined") {
      import("sonner").then(({ toast }) => {
        toast.error(`${label}${serverMsg}`, {
          description: error.config
            ? `${error.config.method?.toUpperCase()} ${error.config.url}`
            : undefined,
          duration: 5000,
        });
      });
    }

    return Promise.reject(error);
  },
);

// Auth API
export const authAPI = {
  register: (data: { email: string; password: string; name?: string }) =>
    api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
};

// Novels API
export const novelsAPI = {
  list: () => api.get("/novels"),
  get: (id: string) => api.get(`/novels/${id}`),
  create: (data: any) => api.post("/novels", data),
  update: (id: string, data: any) => api.patch(`/novels/${id}`, data),
  updateCover: (id: string, formData: FormData) =>
    api.patch(`/novels/${id}/cover`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (id: string) => api.delete(`/novels/${id}`),

  // Characters
  getCharacters: (novelId: string) => api.get(`/novels/${novelId}/characters`),
  createCharacter: (novelId: string, data: any) =>
    api.post(`/novels/${novelId}/characters`, data),
  updateCharacter: (novelId: string, characterId: string, data: any) =>
    api.patch(`/novels/${novelId}/characters/${characterId}`, data),
  deleteCharacter: (novelId: string, characterId: string) =>
    api.delete(`/novels/${novelId}/characters/${characterId}`),

  // Outline
  updateOutline: (novelId: string, data: { content: string }) =>
    api.patch(`/novels/${novelId}/outline`, data),

  // Plot Threads
  getPlotThreads: (novelId: string) => api.get(`/novels/${novelId}/threads`),
  createPlotThread: (
    novelId: string,
    data: { title: string; content?: string; status?: string },
  ) => api.post(`/novels/${novelId}/threads`, data),
  updatePlotThread: (
    novelId: string,
    threadId: string,
    data: { title?: string; content?: string; status?: string },
  ) => api.patch(`/novels/${novelId}/threads/${threadId}`, data),
  deletePlotThread: (novelId: string, threadId: string) =>
    api.delete(`/novels/${novelId}/threads/${threadId}`),

  // Timeline
  getTimelineEvents: (novelId: string) =>
    api.get(`/novels/${novelId}/timeline`),
  createTimelineEvent: (
    novelId: string,
    data: {
      title: string;
      description?: string;
      timeLabel?: string;
      order?: number;
    },
  ) => api.post(`/novels/${novelId}/timeline`, data),
  updateTimelineEvent: (
    novelId: string,
    eventId: string,
    data: {
      title?: string;
      description?: string;
      timeLabel?: string;
      order?: number;
    },
  ) => api.patch(`/novels/${novelId}/timeline/${eventId}`, data),
  deleteTimelineEvent: (novelId: string, eventId: string) =>
    api.delete(`/novels/${novelId}/timeline/${eventId}`),

  // Outline Versions & Streaming
  getOutlineVersions: (novelId: string) =>
    api.get(`/novels/${novelId}/outline/versions`),

  saveOutlineVersion: (
    novelId: string,
    data: { content: string; context?: any; mode?: string },
  ) => api.post(`/novels/${novelId}/outline/versions`, data),

  lockOutlineVersion: (novelId: string, versionId: string, isLocked: boolean) =>
    api.patch(`/novels/${novelId}/outline/versions/${versionId}/lock`, {
      isLocked,
    }),

  rollbackOutlineVersion: (novelId: string, versionId: string) =>
    api.post(`/novels/${novelId}/outline/versions/${versionId}/rollback`),

  generateOutlineStream: (
    novelId: string,
    mode: string,
    existingOutline?: string,
  ) => {
    const API_URL =
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === "production" ? "" : "http://localhost:8002");
    const url = new URL(
      `${API_URL}/api/novels/${novelId}/generate/outline/stream`,
    );
    url.searchParams.set("mode", mode);
    if (existingOutline) {
      url.searchParams.set("existingOutline", existingOutline);
    }
    return new EventSource(url.toString(), { withCredentials: true });
  },

  // AI Suggestions
  suggestTitles: (data: {
    genre?: string[];
    style?: string[];
    background?: string;
  }) => api.post("/novels/suggestions/titles", data),

  expandBackground: (data: {
    genre?: string[];
    style?: string[];
    background: string;
  }) => api.post("/novels/suggestions/expand-background", data),

  // Export/Import
  export: (id: string, format: string = "json") =>
    api.get(`/novels/${id}/export`, {
      params: { format },
      responseType: format === "json" ? "json" : "blob",
    }),
  import: (data: any) => {
    if (data instanceof FormData) {
      return api.post("/novels/import", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
    return api.post("/novels/import", data);
  },
  extractStyle: (id: string, sampleText: string) =>
    api.post(`/novels/${id}/extract-style`, { sampleText }),
};

// Tasks API
export const tasksAPI = {
  generateOutline: (novelId: string) =>
    api.post(`/novels/${novelId}/generate/outline`),
  generateTitles: (novelId: string, data: any) =>
    api.post(`/novels/${novelId}/generate/titles`, data),
  generateVolumes: (
    novelId: string,
    data: { outline: string; additionalRequirements?: string },
  ) => api.post(`/novels/${novelId}/generate/volumes`, data),
  saveBatchVolumes: (novelId: string, volumes: any[]) =>
    api.post(`/novels/${novelId}/volumes/batch`, { volumes }),
  updateVolume: (
    novelId: string,
    volumeId: string,
    data: { title: string; summary?: string },
  ) => api.patch(`/novels/${novelId}/volumes/${volumeId}`, data),
  deleteVolume: (novelId: string, volumeId: string) =>
    api.delete(`/novels/${novelId}/volumes/${volumeId}`),
  generateChapters: (
    novelId: string,
    data: {
      outline: string;
      volumeId?: string;
      additionalRequirements?: string;
      targetCount?: number;
    },
  ) => api.post(`/novels/${novelId}/generate/chapters`, data),
  saveBatchChapters: (novelId: string, volumeId: string, chapters: any[]) =>
    api.post(`/novels/${novelId}/volumes/${volumeId}/chapters/batch`, {
      chapters,
    }),
  generateChapterContent: (novelId: string, chapterId: string, data?: any) =>
    api.post(`/novels/${novelId}/chapters/${chapterId}/generate`, data),
  getTaskStatus: (taskId: string) => api.get(`/tasks/${taskId}`),
  getActiveTasks: (novelId: string) =>
    api.get(`/novels/${novelId}/tasks/active`),
  getAllTasks: (novelId: string) => api.get(`/novels/${novelId}/tasks`),
  updateChapter: (
    chapterId: string,
    data: { title?: string; content?: string; outline?: string },
  ) => api.patch(`/chapters/${chapterId}`, data),
  deleteChapter: (chapterId: string) => api.delete(`/chapters/${chapterId}`),
  getChapter: (chapterId: string) => api.get(`/chapters/${chapterId}`),

  // Snapshot (Version History)
  listSnapshots: (chapterId: string) =>
    api.get(`/chapters/${chapterId}/snapshots`),
  createSnapshot: (chapterId: string, label?: string) =>
    api.post(`/chapters/${chapterId}/snapshots`, { label }),
  getSnapshot: (chapterId: string, snapshotId: string) =>
    api.get(`/chapters/${chapterId}/snapshots/${snapshotId}`),
  restoreSnapshot: (chapterId: string, snapshotId: string) =>
    api.post(`/chapters/${chapterId}/snapshots/${snapshotId}/restore`),
  deleteSnapshot: (chapterId: string, snapshotId: string) =>
    api.delete(`/chapters/${chapterId}/snapshots/${snapshotId}`),

  // Analysis
  checkOoc: (chapterId: string, content: string) =>
    api.post(`/chapters/${chapterId}/ooc-check`, { content }),
};

// AI Config API
export const aiConfigAPI = {
  list: () => api.get("/ai-config"),
  create: (data: any) => api.post("/ai-config", data),
  update: (id: string, data: any) => api.patch(`/ai-config/${id}`, data),
  delete: (id: string) => api.delete(`/ai-config/${id}`),
};

// Knowledge Base API
export const knowledgeAPI = {
  listAll: () => api.get("/knowledge"),
  list: (novelId: string) => api.get(`/knowledge/${novelId}`),
  create: (novelId: string, data: any) =>
    api.post(`/knowledge/${novelId}`, data),
  update: (novelId: string, id: string, data: any) =>
    api.patch(`/knowledge/${novelId}/${id}`, data),
  delete: (novelId: string, id: string) =>
    api.delete(`/knowledge/${novelId}/${id}`),

  // Documents
  getDocuments: (novelId: string, kbId: string) =>
    api.get(`/knowledge/${novelId}/${kbId}/documents`),
  uploadDocument: (novelId: string, kbId: string, formData: FormData) =>
    api.post(`/knowledge/${novelId}/${kbId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteDocument: (novelId: string, kbId: string, docId: string) =>
    api.delete(`/knowledge/${novelId}/${kbId}/documents/${docId}`),
  search: (novelId: string, kbId: string, query: string, limit?: number) =>
    api.post(`/knowledge/${novelId}/${kbId}/search`, { query, limit }),
};

// Chat API
export const chatAPI = {
  sendMessage: async (
    novelId: string,
    message: string,
    previousContent?: string,
    onChunk?: (chunk: string) => void,
  ) => {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`, // Backup, mainly cookies
      },
      credentials: "include", // Important for cookies
      body: JSON.stringify({ novelId, message, previousContent }),
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || "Chat request failed");
      } catch (e) {
        if (e instanceof Error && e.message !== "Chat request failed") {
          throw e;
        }
        throw new Error(
          `Chat request failed: ${response.status} ${response.statusText}`,
        );
      }
    }

    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.content && onChunk) {
              onChunk(parsed.content);
            }
          } catch (e) {
            console.error("Parse error:", e);
          }
        }
      }
    }
  },
};

// Sandbox API (Plot Sandbox)
export const sandboxAPI = {
  list: (novelId: string) => api.get(`/novels/${novelId}/sandboxes`),
  create: (novelId: string, data: { title: string; premise: string }) =>
    api.post(`/novels/${novelId}/sandboxes`, data),
  update: (
    id: string,
    data: { title?: string; premise?: string; content?: string },
  ) => api.patch(`/sandboxes/${id}`, data),
  delete: (id: string) => api.delete(`/sandboxes/${id}`),
  generate: (id: string) => api.post(`/sandboxes/${id}/generate`),
};
