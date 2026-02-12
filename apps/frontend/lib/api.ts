import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8002');

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
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
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: { email: string; password: string; name?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// Novels API
export const novelsAPI = {
  list: () => api.get('/novels'),
  get: (id: string) => api.get(`/novels/${id}`),
  create: (data: any) => api.post('/novels', data),
  update: (id: string, data: any) => api.patch(`/novels/${id}`, data),
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

  // Outline Versions & Streaming
  getOutlineVersions: (novelId: string) => api.get(`/novels/${novelId}/outline/versions`),
  
  saveOutlineVersion: (novelId: string, data: { content: string, context?: any, mode?: string }) =>
    api.post(`/novels/${novelId}/outline/versions`, data),
    
  lockOutlineVersion: (novelId: string, versionId: string, isLocked: boolean) => 
    api.patch(`/novels/${novelId}/outline/versions/${versionId}/lock`, { isLocked }),
    
  rollbackOutlineVersion: (novelId: string, versionId: string) =>
    api.post(`/novels/${novelId}/outline/versions/${versionId}/rollback`),

  generateOutlineStream: (novelId: string, mode: string, existingOutline?: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8002');
    const url = new URL(`${API_URL}/api/novels/${novelId}/generate/outline/stream`);
    url.searchParams.set('mode', mode);
    if (existingOutline) {
      url.searchParams.set('existingOutline', existingOutline);
    }
    return new EventSource(url.toString(), { withCredentials: true });
  },

  // AI Suggestions
  suggestTitles: (data: { genre?: string[]; style?: string[]; background?: string }) =>
    api.post('/novels/suggestions/titles', data),
    
  expandBackground: (data: { genre?: string[]; style?: string[]; background: string }) =>
    api.post('/novels/suggestions/expand-background', data),
};

// Tasks API
export const tasksAPI = {
  generateOutline: (novelId: string) =>
    api.post(`/novels/${novelId}/generate/outline`),
  generateTitles: (novelId: string, data: any) =>
    api.post(`/novels/${novelId}/generate/titles`, data),
  generateChapters: (novelId: string, data: any) =>
    api.post(`/novels/${novelId}/generate/chapters`, data),
  generateChapterContent: (novelId: string, chapterId: string, data?: any) =>
    api.post(`/novels/${novelId}/chapters/${chapterId}/generate`, data),
  getTaskStatus: (taskId: string) => api.get(`/tasks/${taskId}`),
  updateChapter: (chapterId: string, data: { title?: string; content?: string }) =>
    api.patch(`/chapters/${chapterId}`, data),
  getChapter: (chapterId: string) => api.get(`/chapters/${chapterId}`),
};

// AI Config API
export const aiConfigAPI = {
  list: () => api.get('/ai-config'),
  create: (data: any) => api.post('/ai-config', data),
  update: (id: string, data: any) => api.patch(`/ai-config/${id}`, data),
  delete: (id: string) => api.delete(`/ai-config/${id}`),
};

// Knowledge Base API
export const knowledgeAPI = {
  listAll: () => api.get('/knowledge'),
  list: (novelId: string) => api.get(`/knowledge/${novelId}`),
  create: (novelId: string, data: any) => api.post(`/knowledge/${novelId}`, data),
  update: (novelId: string, id: string, data: any) =>
    api.patch(`/knowledge/${novelId}/${id}`, data),
  delete: (novelId: string, id: string) => api.delete(`/knowledge/${novelId}/${id}`),
  
  // Documents
  getDocuments: (novelId: string, kbId: string) =>
    api.get(`/knowledge/${novelId}/${kbId}/documents`),
  uploadDocument: (novelId: string, kbId: string, formData: FormData) =>
    api.post(`/knowledge/${novelId}/${kbId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
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
    onChunk?: (chunk: string) => void
  ) => {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`, // If needed, though cookie is used
      },
      body: JSON.stringify({ novelId, message, previousContent }),
    });

    if (!response.ok) {
      throw new Error('Chat request failed');
    }

    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.content && onChunk) {
              onChunk(parsed.content);
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
    }
  }
};
