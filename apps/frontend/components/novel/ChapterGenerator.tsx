import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Play,
  CheckCircle,
  XCircle,
  Eye,
  Edit2,
  Sparkles,
  Settings,
  Book,
  Plus,
  Trash2,
  Save,
  X,
  FileText,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { io, Socket } from "socket.io-client";
import { tasksAPI } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// localStorage keys for task persistence
const getStorageKey = (novelId: string, type: string) =>
  `daer-novel:${novelId}:task:${type}`;

interface PersistedTaskState {
  taskId: string;
  type: string;
  volumeId?: string;
  chapterId?: string;
  status: string;
  progress?: number;
  timestamp: number;
}

const TASK_TYPES = {
  VOLUME_PLANNING: "volume_planning",
  CHAPTER_PLANNING: "chapter_planning",
  CONTENT: "content",
} as const;

interface Chapter {
  id: string;
  title: string;
  order: number;
  outline?: string;
  detailOutline?: string;
  content?: string;
  wordCount: number;
  status: "pending" | "generating" | "completed" | "failed";
}

interface Volume {
  id: string;
  title: string;
  order: number;
  summary?: string;
  chapters: Chapter[];
}

interface ChapterGeneratorProps {
  novelId: string;
  volumes: Volume[];
  outline?: string;
  onUpdate: () => void;
}

export default function ChapterGenerator({
  novelId,
  volumes,
  outline,
  onUpdate,
}: ChapterGeneratorProps) {
  const router = useRouter();
  const [generatingChapterId, setGeneratingChapterId] = useState<string | null>(
    null,
  );
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const activeVolumeRef = useRef<string | null>(null);

  // Structure Generation State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [additionalRequirements, setAdditionalRequirements] = useState("");
  const [targetCount, setTargetCount] = useState(30);
  const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);
  const [draftChapters, setDraftChapters] = useState<
    { title: string; summary: string }[] | null
  >(null);
  const [draftVolumeId, setDraftVolumeId] = useState<string | null>(null);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Volume Structure Draft State
  const [isVolumeSettingsModalOpen, setIsVolumeSettingsModalOpen] =
    useState(false);
  const [volumeAdditionalRequirements, setVolumeAdditionalRequirements] =
    useState("");
  const [draftVolumes, setDraftVolumes] = useState<
    { title: string; summary: string }[] | null
  >(null);
  const [isVolumeDraftModalOpen, setIsVolumeDraftModalOpen] = useState(false);
  const [isSavingVolumeDraft, setIsSavingVolumeDraft] = useState(false);
  // Volume Draft Confirmation State
  const [volumeConfirmText, setVolumeConfirmText] = useState("");
  const [showVolumeConfirmWarning, setShowVolumeConfirmWarning] =
    useState(false);

  // Volume Inline-Edit State
  const [editingVolumeId, setEditingVolumeId] = useState<string | null>(null);
  const [editVolumeTitle, setEditVolumeTitle] = useState("");
  const [editVolumeSummary, setEditVolumeSummary] = useState("");
  const [isSavingVolumeEdit, setIsSavingVolumeEdit] = useState(false);

  // Chapter Inline-Edit State
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState("");
  const [editChapterOutline, setEditChapterOutline] = useState("");
  const [isSavingChapterEdit, setIsSavingChapterEdit] = useState(false);

  // Content Generation State
  const [activeChapterForConfig, setActiveChapterForConfig] =
    useState<Chapter | null>(null);
  const [contentOutline, setContentOutline] = useState("");
  const [contentInstructions, setContentInstructions] = useState("");

  // Task state version (used to force re-check of localStorage
  const [taskStateVersion, setTaskStateVersion] = useState(0);

  // Persist task state to localStorage
  const saveTaskToStorage = useCallback(
    (taskData: Omit<PersistedTaskState, "timestamp">) => {
      try {
        const key = getStorageKey(novelId, taskData.type);
        const state: PersistedTaskState = {
          ...taskData,
          timestamp: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(state));
        // Force re-check of task state
        setTaskStateVersion((prev) => prev + 1);
      } catch (e) {
        console.warn("Failed to save task state to localStorage:", e);
      }
    },
    [novelId],
  );

  // Clear task state from localStorage
  const clearTaskFromStorage = useCallback(
    (type: string) => {
      try {
        const key = getStorageKey(novelId, type);
        localStorage.removeItem(key);
        // Force re-check of task state
        setTaskStateVersion((prev) => prev + 1);
      } catch (e) {
        console.warn("Failed to clear task state from localStorage:", e);
      }
    },
    [novelId],
  );

  // Get task state from localStorage
  const getTaskFromStorage = useCallback(
    (type: string): PersistedTaskState | null => {
      try {
        const key = getStorageKey(novelId, type);
        const stored = localStorage.getItem(key);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {
        console.warn("Failed to get task state from localStorage:", e);
      }
      return null;
    },
    [novelId],
  );

  // Restore state from active tasks on mount
  const restoreActiveTasks = useCallback(async () => {
    try {
      const response = await tasksAPI.getActiveTasks(novelId);
      const activeTasks = response.data as any[];

      if (activeTasks.length === 0) return;

      for (const task of activeTasks) {
        const stored = getTaskFromStorage(task.type);

        switch (task.type) {
          case TASK_TYPES.VOLUME_PLANNING:
            setIsGeneratingStructure(true);
            setGenerationStatus("正在规划分卷结构...");
            setGenerationProgress(task.progress || 0);
            if (socket) {
              socket.emit("subscribe:task", task.id);
            }
            saveTaskToStorage({
              taskId: task.id,
              type: task.type,
              status: task.status,
              progress: task.progress,
            });
            break;

          case TASK_TYPES.CHAPTER_PLANNING:
            setIsGeneratingStructure(true);
            if (stored?.volumeId) {
              activeVolumeRef.current = stored.volumeId;
              const volume = volumes.find((v) => v.id === stored.volumeId);
              if (volume) {
                setActiveVolumeForChapters(volume);
              }
            }
            setGenerationStatus("正在规划章节结构...");
            setGenerationProgress(task.progress || 0);
            if (socket) {
              socket.emit("subscribe:task", task.id);
            }
            saveTaskToStorage({
              taskId: task.id,
              type: task.type,
              volumeId: stored?.volumeId,
              status: task.status,
              progress: task.progress,
            });
            break;

          case TASK_TYPES.CONTENT:
            if (task.chapterId) {
              setGeneratingChapterId(task.chapterId);
              setGenerationStatus("正在生成章节内容...");
              setGenerationProgress(task.progress || 0);
              if (socket) {
                socket.emit("subscribe:task", task.id);
              }
              saveTaskToStorage({
                taskId: task.id,
                type: task.type,
                chapterId: task.chapterId,
                status: task.status,
                progress: task.progress,
              });
            }
            break;
        }
      }
    } catch (error) {
      console.error("Failed to restore active tasks:", error);
    }
  }, [novelId, socket, volumes, getTaskFromStorage, saveTaskToStorage]);

  useEffect(() => {
    // Setup WebSocket
    const socketUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === "production"
        ? window.location.origin
        : "http://localhost:8002");
    const newSocket = io(socketUrl, {
      path: "/socket.io", // Ensure socket.io path matches backend
    });
    setSocket(newSocket);

    // Listen for structure generation events
    newSocket.on("novel:updated", (data) => {
      if (data.novelId === novelId) {
        onUpdate();
        // Note: we don't reset isGeneratingStructure here anymore
        // as we rely on task:completed for better precision
      }
    });

    // Listen for task events
    newSocket.on("task:progress", (data) => {
      setGenerationProgress(data.progress || 0);
      setGenerationStatus(data.message || "生成中...");

      // Update localStorage with progress
      if (data.type) {
        const stored = getTaskFromStorage(data.type);
        if (stored) {
          saveTaskToStorage({
            ...stored,
            progress: data.progress || 0,
          });
        }
      }
    });

    newSocket.on("task:completed", (data) => {
      setGenerationProgress(100);
      setGenerationStatus("生成完成");

      // Clear persisted state
      clearTaskFromStorage(data.type);

      if (data.type === "chapter_planning" && data.result?.chapters) {
        setDraftChapters(data.result.chapters);
        // Use the Ref to get the correct volumeId even if the state is stale
        setDraftVolumeId(activeVolumeRef.current);
        setIsDraftModalOpen(true);
      } else if (data.type === "volume_planning" && data.result?.volumes) {
        setDraftVolumes(data.result.volumes);
        setIsVolumeDraftModalOpen(true);
      } else if (data.type === "content") {
        // Chapter content generated successfully
        setGeneratingChapterId(null);
        onUpdate(); // refresh the list to show new content
        return; // Avoid the setTimeout below for content generation
      }

      setIsGeneratingStructure(false);
      setActiveVolumeForChapters(null);
      setTimeout(() => {
        setGeneratingChapterId(null);
        onUpdate();
      }, 500);
    });

    newSocket.on("task:failed", (data) => {
      console.error("Task failed event received:", data);
      setGenerationStatus("生成失败");
      toast.error(`生成失败: ${data.error || "未知错误"}`);
      setGeneratingChapterId(null);
      setGenerationProgress(0);
      setIsGeneratingStructure(false); // Reset global structure generation state
      setActiveVolumeForChapters(null);

      // Clear persisted state on failure too
      if (data.type) {
        clearTaskFromStorage(data.type);
      }
    });

    return () => {
      newSocket.close();
    };
  }, [
    novelId,
    onUpdate,
    getTaskFromStorage,
    saveTaskToStorage,
    clearTaskFromStorage,
  ]);

  // Restore active tasks when socket is ready
  useEffect(() => {
    if (socket) {
      restoreActiveTasks();
    }
  }, [socket, restoreActiveTasks]);

  // Calculate existing content statistics for volume planning warning
  const getExistingContentStats = useCallback(() => {
    let totalVolumes = volumes.length;
    let totalChapters = 0;
    let completedChapters = 0;
    let chaptersWithContent = 0;
    let totalWords = 0;

    volumes.forEach((volume) => {
      volume.chapters.forEach((chapter) => {
        totalChapters++;
        if (chapter.status === "completed") {
          completedChapters++;
        }
        if (chapter.content && chapter.content.trim().length > 0) {
          chaptersWithContent++;
          totalWords += chapter.wordCount || 0;
        }
      });
    });

    return {
      totalVolumes,
      totalChapters,
      completedChapters,
      chaptersWithContent,
      totalWords,
      hasDangerousContent: completedChapters > 0 || chaptersWithContent > 0,
    };
  }, [volumes]);

  // Check if there is an active volume planning task
  // Using taskStateVersion as dependency to force re-check when localStorage changes
  const hasActiveVolumePlanningTask = useMemo(() => {
    // Just reference taskStateVersion to make it a dependency
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _version = taskStateVersion;

    const storedTask = getTaskFromStorage(TASK_TYPES.VOLUME_PLANNING);
    if (storedTask) {
      const isActive =
        storedTask.status === "queued" || storedTask.status === "running";
      return isActive;
    }
    return false;
  }, [taskStateVersion, getTaskFromStorage]);

  // Reset confirmation state when modal opens
  useEffect(() => {
    if (isVolumeDraftModalOpen) {
      setVolumeConfirmText("");
      setShowVolumeConfirmWarning(false);
    }
  }, [isVolumeDraftModalOpen]);

  // Structure Generation Handlers
  // Volume Structure Generation
  const handleOpenVolumeSettings = () => {
    if (!outline) {
      toast.error("请先生成并选定一个大纲版本");
      return;
    }
    setVolumeAdditionalRequirements("");
    setIsVolumeSettingsModalOpen(true);
  };

  const handleGenerateVolumes = async () => {
    setIsVolumeSettingsModalOpen(false);
    setIsGeneratingStructure(true);
    try {
      const res = await tasksAPI.generateVolumes(novelId, {
        outline: outline || "",
        additionalRequirements: volumeAdditionalRequirements,
      });
      const taskId = res.data?.id;
      if (taskId && socket) {
        socket.emit("subscribe:task", taskId);
        saveTaskToStorage({
          taskId,
          type: TASK_TYPES.VOLUME_PLANNING,
          status: "queued",
          progress: 0,
        });
      }
      toast.success("分卷规划任务已提交");
    } catch (error) {
      setIsGeneratingStructure(false);
    }
  };

  // Per-Volume Chapter Generation
  const [activeVolumeForChapters, setActiveVolumeForChapters] =
    useState<Volume | null>(null);

  const handleStartChapterPlanning = (volume: Volume) => {
    setActiveVolumeForChapters(volume);
    activeVolumeRef.current = volume.id;
    setIsSettingsModalOpen(true);
  };

  // Volume inline-edit handlers
  const handleEditVolume = (volume: Volume) => {
    setEditingVolumeId(volume.id);
    setEditVolumeTitle(volume.title);
    setEditVolumeSummary(volume.summary || "");
  };

  const handleCancelEditVolume = () => {
    setEditingVolumeId(null);
  };

  const handleSaveVolumeEdit = async (volume: Volume) => {
    setIsSavingVolumeEdit(true);
    try {
      await tasksAPI.updateVolume(novelId, volume.id, {
        title: editVolumeTitle,
        summary: editVolumeSummary,
      });
      toast.success("分卷信息已更新");
      setEditingVolumeId(null);
      onUpdate();
    } catch {
      toast.error("更新失败");
    } finally {
      setIsSavingVolumeEdit(false);
    }
  };

  const handleDeleteVolume = async (volume: Volume) => {
    if (
      !confirm(`确认删除《${volume.title}》？该分卷下的所有章节也将一并删除。`)
    )
      return;
    try {
      await tasksAPI.deleteVolume(novelId, volume.id);
      toast.success("分卷已删除");
      onUpdate();
    } catch {
      toast.error("删除失败");
    }
  };

  // Chapter inline-edit handlers
  const handleEditChapterInline = (chapter: Chapter) => {
    setEditingChapterId(chapter.id);
    setEditChapterTitle(chapter.title);
    setEditChapterOutline(chapter.outline || "");
  };

  const handleCancelEditChapterInline = () => {
    setEditingChapterId(null);
  };

  const handleSaveChapterEdit = async (chapter: Chapter) => {
    setIsSavingChapterEdit(true);
    try {
      await tasksAPI.updateChapter(chapter.id, {
        title: editChapterTitle,
        outline: editChapterOutline,
      });
      toast.success("章节信息已更新");
      setEditingChapterId(null);
      onUpdate();
    } catch {
      toast.error("更新失败");
    } finally {
      setIsSavingChapterEdit(false);
    }
  };

  const handleDeleteChapter = async (chapter: Chapter) => {
    if (!confirm(`确认删除《${chapter.title}》？该操作不可恢复。`)) return;
    try {
      await tasksAPI.deleteChapter(chapter.id);
      toast.success("章节已删除");
      onUpdate();
    } catch {
      toast.error("删除失败");
    }
  };

  const handleConfirmGeneration = async () => {
    if (!activeVolumeForChapters) return;
    const volumeId = activeVolumeForChapters.id;
    activeVolumeRef.current = volumeId;
    setDraftVolumeId(volumeId); // Save before clearing
    setIsSettingsModalOpen(false);
    setIsGeneratingStructure(true);
    try {
      const res = await tasksAPI.generateChapters(novelId, {
        outline: outline || "",
        volumeId,
        additionalRequirements,
        targetCount,
      });
      const taskId = res.data?.id;
      if (taskId && socket) {
        socket.emit("subscribe:task", taskId);
        saveTaskToStorage({
          taskId,
          type: TASK_TYPES.CHAPTER_PLANNING,
          volumeId,
          status: "queued",
          progress: 0,
        });
      }
      toast.success(`${activeVolumeForChapters.title} 的章节生成任务已提交`);
    } catch (error) {
      console.error("Failed to generate chapters:", error);
      toast.error("生成请求失败");
      setIsGeneratingStructure(false);
      setActiveVolumeForChapters(null);
    }
  };

  // Single Chapter Generation
  const handleGenerateChapter = async (chapter: Chapter) => {
    setActiveChapterForConfig(chapter);
    setContentOutline(chapter.detailOutline || chapter.outline || "");
    setContentInstructions("");
  };

  const handleConfirmContentGeneration = async () => {
    if (!activeChapterForConfig) return;

    const chapterId = activeChapterForConfig.id;
    setActiveChapterForConfig(null); // Close modal

    setGeneratingChapterId(chapterId);
    setGenerationProgress(0);
    setGenerationStatus("准备生成...");

    try {
      const res = await tasksAPI.generateChapterContent(novelId, chapterId, {
        modifiedOutline: contentOutline,
        additionalInstructions: contentInstructions,
      });
      const taskId = res.data?.id;
      if (taskId && socket) {
        socket.emit("subscribe:task", taskId);
        saveTaskToStorage({
          taskId,
          type: TASK_TYPES.CONTENT,
          chapterId,
          status: "queued",
          progress: 0,
        });
      }
      toast.success("章节生成任务已提交");
    } catch (error) {
      console.error("Failed to generate chapter:", error);
      toast.error("生成请求失败");
      setGeneratingChapterId(null);
    }
  };

  const handlePreviewChapter = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    setEditContent(chapter.content || "");
    setIsEditing(false);
    setIsPreviewOpen(true);
  };

  const handleEditChapter = (chapter: Chapter) => {
    router.push(`/chapters/edit?id=${chapter.id}`);
  };

  // Deprecated manual save handler (moved to full page editor)
  const handleSaveChapter = async () => {};

  const getStatusIcon = (status: string, chapterId: string) => {
    if (generatingChapterId === chapterId) {
      return <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />;
    }

    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600 dark:text-green-400";
      case "generating":
        return "text-primary-600 dark:text-primary-400";
      case "failed":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className="space-y-6">
      {volumes.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <div className="mb-4">
              <p className="text-lg font-medium mb-2">暂无章节</p>
              <p className="text-sm">根据当前大纲生成分卷和章节结构</p>
            </div>
            {outline ? (
              <Button
                onClick={handleOpenVolumeSettings}
                disabled={isGeneratingStructure}
              >
                {isGeneratingStructure ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    正在规划全书分卷...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    第一步：生成全书分卷规划
                  </>
                )}
              </Button>
            ) : (
              <p className="text-amber-500">
                请先在&quot;大纲&quot;标签页生成并锁定一个大纲
              </p>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              分卷与章节结构
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenVolumeSettings}
              disabled={isGeneratingStructure}
              className="text-primary-600 border-primary-200 hover:bg-primary-50 dark:border-primary-800 dark:hover:bg-primary-900/20 min-w-[120px]"
            >
              {isGeneratingStructure ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  规划中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  重新规划分卷
                </>
              )}
            </Button>
          </div>

          {volumes.map((volume) => (
            <Card
              key={volume.id}
              className="p-6 border-l-4 border-l-primary-500"
            >
              <div className="flex items-start justify-between mb-4">
                {editingVolumeId === volume.id ? (
                  // === Inline Edit Mode ===
                  <div className="flex-grow space-y-2 pr-2">
                    <input
                      value={editVolumeTitle}
                      onChange={(e) => setEditVolumeTitle(e.target.value)}
                      className="w-full text-xl font-bold bg-transparent border-b border-primary-400 focus:outline-none text-gray-900 dark:text-white pb-1"
                      placeholder="分卷名称"
                    />
                    <textarea
                      value={editVolumeSummary}
                      onChange={(e) => setEditVolumeSummary(e.target.value)}
                      className="w-full text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 focus:outline-none resize-none"
                      rows={3}
                      placeholder="分卷剧情摘要"
                    />
                    <div className="flex gap-2">
                      {hasActiveVolumePlanningTask ? (
                        <>
                          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            分卷规划中，无法保存
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            onClick={handleCancelEditVolume}
                          >
                            <X className="w-3 h-3 mr-1" />
                            取消
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            className="h-7"
                            onClick={() => handleSaveVolumeEdit(volume)}
                            disabled={isSavingVolumeEdit}
                          >
                            {isSavingVolumeEdit ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3 mr-1" />
                            )}
                            保存
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            onClick={handleCancelEditVolume}
                          >
                            <X className="w-3 h-3 mr-1" />
                            取消
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  // === Display Mode ===
                  <div className="space-y-1 pr-4 flex-grow">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                      <Book className="w-5 h-5 mr-2 text-primary-500" />
                      {volume.title}
                    </h3>
                    {volume.summary && (
                      <p
                        className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 italic"
                        title={volume.summary}
                      >
                        [剧情摘要]: {volume.summary}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full whitespace-nowrap">
                    {
                      volume.chapters.filter((c) => c.status === "completed")
                        .length
                    }{" "}
                    / {volume.chapters.length} 已完成
                  </span>
                  {editingVolumeId !== volume.id && (
                    <div className="flex gap-1">
                      {hasActiveVolumePlanningTask ? (
                        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          规划中
                        </div>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-gray-500 hover:text-primary-600"
                            onClick={() => handleEditVolume(volume)}
                            title="编辑分卷"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-gray-500 hover:text-red-600"
                            onClick={() => handleDeleteVolume(volume)}
                            title="删除分卷"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {volume.chapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    className="p-4 glass rounded-lg hover:shadow-md transition"
                  >
                    <div className="flex flex-col gap-3">
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: Title & Meta / Edit UI */}
                        {editingChapterId === chapter.id ? (
                          <div className="flex-grow space-y-2 pr-2">
                            <input
                              value={editChapterTitle}
                              onChange={(e) =>
                                setEditChapterTitle(e.target.value)
                              }
                              className="w-full text-base font-bold bg-transparent border-b border-primary-400 focus:outline-none text-gray-900 dark:text-white pb-1"
                              placeholder="章节名称"
                            />
                            <textarea
                              value={editChapterOutline}
                              onChange={(e) =>
                                setEditChapterOutline(e.target.value)
                              }
                              className="w-full text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 focus:outline-none resize-none"
                              rows={3}
                              placeholder="章节简介"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="h-7"
                                onClick={() => handleSaveChapterEdit(chapter)}
                                disabled={isSavingChapterEdit}
                              >
                                {isSavingChapterEdit ? (
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <Save className="w-3 h-3 mr-1" />
                                )}
                                保存
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7"
                                onClick={handleCancelEditChapterInline}
                              >
                                <X className="w-3 h-3 mr-1" />
                                取消
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 min-w-0 flex-grow pt-1">
                            <span className="flex-shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                              第 {chapter.order} 章
                            </span>
                            <h4
                              className="font-semibold text-gray-900 dark:text-white truncate"
                              title={chapter.title}
                            >
                              {chapter.title}
                            </h4>
                            {getStatusIcon(chapter.status, chapter.id)}
                          </div>
                        )}

                        {/* Right: Actions */}
                        {editingChapterId !== chapter.id && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {chapter.status === "completed" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 shadow-sm border border-gray-200 dark:border-gray-800"
                                onClick={() => handlePreviewChapter(chapter)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                预览
                              </Button>
                            )}

                            {generatingChapterId === chapter.id ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                className="h-8"
                              >
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                生成中
                              </Button>
                            ) : (
                              <>
                                {chapter.status !== "completed" && (
                                  <Button
                                    size="sm"
                                    className="h-8"
                                    onClick={() =>
                                      handleGenerateChapter(chapter)
                                    }
                                  >
                                    <Sparkles className="w-4 h-4 mr-1" />
                                    {chapter.status === "failed"
                                      ? "重试"
                                      : "生成正文"}
                                  </Button>
                                )}

                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-8 bg-secondary-100 text-secondary-700 hover:bg-secondary-200 dark:bg-secondary-900/40 dark:text-secondary-300 border-secondary-200 dark:border-secondary-800"
                                  onClick={() => handleEditChapter(chapter)}
                                >
                                  <FileText className="w-4 h-4 mr-1" />
                                  编辑器
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-gray-500 hover:text-primary-600 px-2"
                                  onClick={() =>
                                    handleEditChapterInline(chapter)
                                  }
                                  title="修改标题与简介"
                                >
                                  <Settings2 className="w-4 h-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 px-2"
                                  onClick={() => handleDeleteChapter(chapter)}
                                  title="删除章节"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Body: Summary */}
                      {editingChapterId !== chapter.id && chapter.outline && (
                        <div className="bg-gray-50/50 dark:bg-gray-800/50 p-3 rounded-md border border-gray-100 dark:border-gray-800">
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed text-justify">
                            {chapter.outline}
                          </p>
                        </div>
                      )}

                      {/* Footer: Status */}
                      <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800 pt-3 mt-1">
                        <div className="flex items-center gap-4">
                          {chapter.wordCount > 0 && (
                            <span>
                              字数: {chapter.wordCount.toLocaleString()}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium ${
                              chapter.status === "completed"
                                ? "bg-green-100 text-green-700"
                                : chapter.status === "generating"
                                  ? "bg-blue-100 text-blue-700"
                                  : chapter.status === "failed"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {chapter.status === "completed" && "已完成"}
                            {chapter.status === "generating" && "生成中"}
                            {chapter.status === "failed" && "生成失败"}
                            {chapter.status === "pending" && "待生成"}
                          </span>
                        </div>
                      </div>

                      {/* Generation Progress Bar */}
                      {generatingChapterId === chapter.id && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400">
                              {generationStatus}
                            </span>
                            <span className="text-primary-600 dark:text-primary-400">
                              {generationProgress}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${generationProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* === Prominent "Continue Generating" Button at the bottom === */}
                <button
                  onClick={() => handleStartChapterPlanning(volume)}
                  disabled={isGeneratingStructure}
                  className={cn(
                    "w-full py-8 px-6 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 group",
                    isGeneratingStructure &&
                      activeVolumeForChapters?.id === volume.id
                      ? "bg-primary-50/30 border-primary-200 cursor-wait"
                      : "bg-gray-50/50 border-gray-200 hover:border-primary-400 hover:bg-primary-50/30 dark:bg-gray-900/30 dark:border-gray-800 dark:hover:border-primary-500",
                  )}
                >
                  {isGeneratingStructure &&
                  activeVolumeForChapters?.id === volume.id ? (
                    <>
                      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                      <div className="text-center">
                        <p className="text-lg font-bold text-primary-700 dark:text-primary-300">
                          {generationStatus}
                        </p>
                        <p className="text-sm text-primary-500">
                          正在为您精心规划后续剧情结构...
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Sparkles className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">
                          继续生成更多章节
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          基于小说大纲与当前剧情，自动规划并填充后续章节结构
                        </p>
                      </div>
                    </>
                  )}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Volume Generation Settings Modal */}
      <Modal
        isOpen={isVolumeSettingsModalOpen}
        onClose={() => setIsVolumeSettingsModalOpen(false)}
        title="分卷规划设置"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              额外要求（可选）
            </label>
            <textarea
              value={volumeAdditionalRequirements}
              onChange={(e) => setVolumeAdditionalRequirements(e.target.value)}
              placeholder="例如：把全书分为5卷，或者前期的节奏再快一些..."
              className="w-full h-32 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              variant="ghost"
              onClick={() => setIsVolumeSettingsModalOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handleGenerateVolumes}>确认生成</Button>
          </div>
        </div>
      </Modal>

      {/* Volume Draft Review Modal */}
      <Modal
        isOpen={isVolumeDraftModalOpen}
        onClose={() => setIsVolumeDraftModalOpen(false)}
        title="预览并调整生成的分卷"
        size="lg"
      >
        {(() => {
          const stats = getExistingContentStats();
          const confirmTextRequired = "确认删除所有现有内容";
          const isConfirmValid = volumeConfirmText === confirmTextRequired;

          return (
            <div className="space-y-4">
              {/* Danger Warning Section */}
              {stats.hasDangerousContent ? (
                <div className="border-2 border-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                        <span className="text-red-600 dark:text-red-400 text-xl font-bold">
                          !
                        </span>
                      </div>
                    </div>
                    <div className="flex-grow space-y-2">
                      <h4 className="text-red-700 dark:text-red-400 font-bold text-lg">
                        ⚠️ 危险操作警告
                      </h4>
                      <p className="text-red-600 dark:text-red-400 text-sm">
                        此操作将永久删除以下内容，且无法恢复：
                      </p>

                      {/* Content Statistics */}
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className="bg-white/50 dark:bg-black/20 rounded p-2">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            现有分卷数
                          </div>
                          <div className="text-lg font-bold text-red-600 dark:text-red-400">
                            {stats.totalVolumes} 卷
                          </div>
                        </div>
                        <div className="bg-white/50 dark:bg-black/20 rounded p-2">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            现有章节数
                          </div>
                          <div className="text-lg font-bold text-red-600 dark:text-red-400">
                            {stats.totalChapters} 章
                          </div>
                        </div>
                        <div className="bg-white/50 dark:bg-black/20 rounded p-2">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            已完成章节
                          </div>
                          <div className="text-lg font-bold text-red-600 dark:text-red-400">
                            {stats.completedChapters} 章
                          </div>
                        </div>
                        <div className="bg-white/50 dark:bg-black/20 rounded p-2">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            总字数
                          </div>
                          <div className="text-lg font-bold text-red-600 dark:text-red-400">
                            {stats.totalWords.toLocaleString()} 字
                          </div>
                        </div>
                      </div>

                      {/* Confirmation Input */}
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                          为确认此危险操作，请输入以下文本：
                          <span className="font-mono bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded ml-2">
                            {confirmTextRequired}
                          </span>
                        </label>
                        <input
                          type="text"
                          value={volumeConfirmText}
                          onChange={(e) => {
                            setVolumeConfirmText(e.target.value);
                            setShowVolumeConfirmWarning(false);
                          }}
                          placeholder={`请输入：${confirmTextRequired}`}
                          className={`w-full px-3 py-2 text-sm rounded-md border ${
                            isConfirmValid
                              ? "border-green-400 bg-green-50 dark:bg-green-950/20"
                              : showVolumeConfirmWarning
                                ? "border-red-400 bg-red-50 dark:bg-red-950/20"
                                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                          } focus:ring-2 focus:ring-primary-500 focus:outline-none`}
                        />
                        {showVolumeConfirmWarning && (
                          <p className="text-red-500 text-sm mt-1">
                            请先输入确认文本以继续
                          </p>
                        )}
                        {isConfirmValid && (
                          <p className="text-green-600 dark:text-green-400 text-sm mt-1">
                            ✓ 确认文本已匹配
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4">
                  <p className="text-amber-700 dark:text-amber-400 font-medium">
                    ⚠️ 注意：确认保存后，原有的分卷结构将被新的分卷替换。
                  </p>
                  <p className="text-amber-600 dark:text-amber-500 text-sm mt-1">
                    当前尚未生成任何章节内容，此操作相对安全。
                  </p>
                </div>
              )}

              {/* Draft Volumes List */}
              <div>
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  新分卷预览（共 {draftVolumes?.length || 0} 卷）
                </h5>
                <div className="max-h-[40vh] overflow-y-auto space-y-3 p-1">
                  {draftVolumes?.map((draft, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex-shrink-0 text-xs font-mono text-gray-400 mt-2">
                        卷 {idx + 1}
                      </div>
                      <div className="flex-grow space-y-2">
                        <input
                          value={draft.title}
                          onChange={(e) => {
                            const newDrafts = [...(draftVolumes || [])];
                            newDrafts[idx].title = e.target.value;
                            setDraftVolumes(newDrafts);
                          }}
                          className="w-full font-bold bg-transparent border-none focus:ring-0 p-0 text-gray-900 dark:text-white"
                        />
                        <textarea
                          value={draft.summary}
                          onChange={(e) => {
                            const newDrafts = [...(draftVolumes || [])];
                            newDrafts[idx].summary = e.target.value;
                            setDraftVolumes(newDrafts);
                          }}
                          className="w-full text-sm bg-transparent border-gray-200 dark:border-gray-700 rounded focus:ring-1 p-1 text-gray-600 dark:text-gray-400"
                          rows={2}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => {
                          const newDrafts =
                            draftVolumes?.filter((_, i) => i !== idx) || null;
                          setDraftVolumes(newDrafts);
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newDrafts = [
                      ...(draftVolumes || []),
                      { title: "新卷名", summary: "分卷摘要描述" },
                    ];
                    setDraftVolumes(newDrafts);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  添加分卷
                </Button>
                <div className="space-x-3">
                  <Button
                    variant="ghost"
                    onClick={() => setIsVolumeDraftModalOpen(false)}
                  >
                    取消
                  </Button>
                  <Button
                    variant={
                      stats.hasDangerousContent ? "destructive" : "default"
                    }
                    onClick={async () => {
                      if (!draftVolumes) return;

                      // Check confirmation for dangerous operations
                      if (stats.hasDangerousContent && !isConfirmValid) {
                        setShowVolumeConfirmWarning(true);
                        return;
                      }

                      setIsSavingVolumeDraft(true);
                      try {
                        await tasksAPI.saveBatchVolumes(
                          novelId,
                          draftVolumes,
                          stats.hasDangerousContent,
                        );
                        toast.success("分卷已成功存入书库");
                        setIsVolumeDraftModalOpen(false);
                        onUpdate();
                      } catch (e) {
                        toast.error("保存失败");
                      } finally {
                        setIsSavingVolumeDraft(false);
                      }
                    }}
                    disabled={isSavingVolumeDraft || !draftVolumes?.length}
                  >
                    {isSavingVolumeDraft ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    {stats.hasDangerousContent
                      ? "确认删除并替换"
                      : `确认替换并保存 (${draftVolumes?.length || 0}卷)`}
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Chapter Generation Settings Modal */}
      <Modal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="章节生成设置"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              生成章节数量 (10-50)
            </label>
            <input
              type="number"
              min={10}
              max={50}
              value={targetCount}
              onChange={(e) => setTargetCount(parseInt(e.target.value) || 30)}
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              额外要求（可选）
            </label>
            <textarea
              value={additionalRequirements}
              onChange={(e) => setAdditionalRequirements(e.target.value)}
              placeholder="例如：希望能多一些打斗场面，或者注重某个人物的成长..."
              className="w-full h-32 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              variant="ghost"
              onClick={() => setIsSettingsModalOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handleConfirmGeneration}>确认生成</Button>
          </div>
        </div>
      </Modal>

      {/* Draft Review Modal */}
      <Modal
        isOpen={isDraftModalOpen}
        onClose={() => setIsDraftModalOpen(false)}
        title="预览并调整生成的章节"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            AI
            已为您生成以下章节建议。您可以修改标题、删除不需要的章节，确认后将保存到书库。
          </p>
          <div className="max-h-[50vh] overflow-y-auto space-y-3 p-1">
            {draftChapters?.map((draft, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-shrink-0 text-xs font-mono text-gray-400 mt-2">
                  #{idx + 1}
                </div>
                <div className="flex-grow space-y-2">
                  <input
                    value={draft.title}
                    onChange={(e) => {
                      const newDrafts = [...(draftChapters || [])];
                      newDrafts[idx].title = e.target.value;
                      setDraftChapters(newDrafts);
                    }}
                    className="w-full font-medium bg-transparent border-none focus:ring-0 p-0 text-gray-900 dark:text-white"
                  />
                  <textarea
                    value={draft.summary}
                    onChange={(e) => {
                      const newDrafts = [...(draftChapters || [])];
                      newDrafts[idx] = {
                        ...newDrafts[idx],
                        summary: e.target.value,
                      };
                      setDraftChapters(newDrafts);
                    }}
                    className="w-full text-xs text-gray-500 bg-transparent border border-gray-200 dark:border-gray-700 rounded p-1 focus:outline-none resize-none"
                    rows={2}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => {
                    const newDrafts =
                      draftChapters?.filter((_, i) => i !== idx) || null;
                    setDraftChapters(newDrafts);
                  }}
                >
                  删除
                </Button>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newDrafts = [
                  ...(draftChapters || []),
                  { title: "新章节", summary: "待完善" },
                ];
                setDraftChapters(newDrafts);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              添加章节
            </Button>
            <div className="space-x-3">
              <Button
                variant="ghost"
                onClick={() => setIsDraftModalOpen(false)}
              >
                以后再说
              </Button>
              <Button
                onClick={async () => {
                  if (!draftVolumeId || !draftChapters) return;
                  setIsSavingDraft(true);
                  try {
                    await tasksAPI.saveBatchChapters(
                      novelId,
                      draftVolumeId,
                      draftChapters,
                    );
                    toast.success("章节已成功存入书库");
                    setIsDraftModalOpen(false);
                    onUpdate();
                  } catch (e) {
                    toast.error("保存失败");
                  } finally {
                    setIsSavingDraft(false);
                  }
                }}
                disabled={isSavingDraft || !draftChapters?.length}
              >
                {isSavingDraft ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                确认并保存 ({draftChapters?.length || 0})
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Content Generation Settings Modal */}
      <Modal
        isOpen={!!activeChapterForConfig}
        onClose={() => setActiveChapterForConfig(null)}
        title="章节正文生成设置"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              章节细纲（可修改）
            </label>
            <textarea
              value={contentOutline}
              onChange={(e) => setContentOutline(e.target.value)}
              className="w-full h-48 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
              placeholder="在此处优化章节大纲..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              写作指导/额外要求
            </label>
            <textarea
              value={contentInstructions}
              onChange={(e) => setContentInstructions(e.target.value)}
              className="w-full h-24 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
              placeholder="例如：注重环境描写，增加心理活动..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button
              variant="ghost"
              onClick={() => setActiveChapterForConfig(null)}
            >
              取消
            </Button>
            <Button onClick={handleConfirmContentGeneration}>
              <Sparkles className="w-4 h-4 mr-2" />
              开始生成正文
            </Button>
          </div>
        </div>
      </Modal>

      {/* Chapter Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={selectedChapter?.title || "章节预览"}
        size="lg"
      >
        {selectedChapter && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>第 {selectedChapter.order} 章</span>
              <span>{selectedChapter.wordCount.toLocaleString()} 字</span>
            </div>

            <div className="min-h-[300px] max-h-[60vh] overflow-y-auto">
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-[50vh] px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none font-mono text-base leading-relaxed"
                  placeholder="在此编辑章节内容..."
                />
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {selectedChapter.content ? (
                    selectedChapter.content
                      .split("\n\n")
                      .map((paragraph, i) => (
                        <p
                          key={i}
                          className="mb-4 leading-relaxed text-justify indent-8"
                        >
                          {paragraph}
                        </p>
                      ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">暂无内容</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="text-xs text-gray-500">
                {isEditing ? (
                  <span>当前字数: {editContent.length.toLocaleString()}</span>
                ) : (
                  <span>最后更新: {new Date().toLocaleString()}</span>
                )}
              </div>
              <div className="flex space-x-3">
                <Button variant="ghost" onClick={() => setIsPreviewOpen(false)}>
                  关闭
                </Button>
                {isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                    >
                      取消
                    </Button>
                    <Button onClick={handleSaveChapter} disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          保存
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsEditing(true)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    编辑章节
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
