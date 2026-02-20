'use client';

import { useState, useEffect, useCallback } from 'react';
import { tasksAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { History, Plus, RotateCcw, Trash2, Eye, X, Clock, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Snapshot {
  id: string;
  chapterId: string;
  title: string;
  wordCount: number | null;
  label: string | null;
  createdAt: string;
}

interface SnapshotDetail extends Snapshot {
  content: string;
}

interface HistoryPanelProps {
  chapterId: string;
  currentContent: string;
  onRestore: (content: string) => void;
  className?: string;
}

export function HistoryPanel({ chapterId, currentContent, onRestore, className }: HistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<SnapshotDetail | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSnapshots = useCallback(async () => {
    if (!chapterId) return;
    setIsLoading(true);
    try {
      const res = await tasksAPI.listSnapshots(chapterId);
      setSnapshots(res.data || []);
    } catch (e) {
      console.error('Failed to load snapshots', e);
    } finally {
      setIsLoading(false);
    }
  }, [chapterId]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await tasksAPI.createSnapshot(chapterId, '手动快照');
      toast.success('快照已创建');
      fetchSnapshots();
    } catch (e) {
      toast.error('创建快照失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handlePreview = async (snapshot: Snapshot) => {
    setIsPreviewLoading(true);
    try {
      const res = await tasksAPI.getSnapshot(chapterId, snapshot.id);
      setPreviewSnapshot(res.data);
    } catch (e) {
      toast.error('加载快照内容失败');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleRestore = async (snapshot: Snapshot) => {
    if (!confirm(`确定要还原到此快照吗？当前内容将自动备份为新快照。`)) return;
    try {
      const res = await tasksAPI.restoreSnapshot(chapterId, snapshot.id);
      onRestore(res.data.chapter.content);
      toast.success('已还原到快照版本');
      setPreviewSnapshot(null);
      fetchSnapshots();
    } catch (e) {
      toast.error('还原快照失败');
    }
  };

  const handleDelete = async (snapshot: Snapshot) => {
    setDeletingId(snapshot.id);
    try {
      await tasksAPI.deleteSnapshot(chapterId, snapshot.id);
      toast.success('快照已删除');
      if (previewSnapshot?.id === snapshot.id) setPreviewSnapshot(null);
      fetchSnapshots();
    } catch (e) {
      toast.error('删除快照失败');
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: zhCN });
    } catch {
      return dateString;
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <History className="w-4 h-4 text-primary" />
          版本历史
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 border-primary/20 text-primary hover:bg-primary/5"
          onClick={handleCreate}
          disabled={isCreating || !currentContent}
          title="保存当前内容为快照"
        >
          <Plus className="w-3.5 h-3.5" />
          {isCreating ? '保存中...' : '创建快照'}
        </Button>
      </div>

      {/* Preview Panel */}
      {previewSnapshot && (
        <div className="border-b border-border bg-muted/20 flex flex-col shrink-0 max-h-[40%]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
            <span className="text-xs font-medium text-foreground/70 truncate">预览: {previewSnapshot.label}</span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => handleRestore(previewSnapshot)}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                还原
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewSnapshot(null)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="overflow-y-auto p-3 text-xs leading-relaxed text-foreground/70 whitespace-pre-wrap font-serif">
            {previewSnapshot.content.slice(0, 800)}{previewSnapshot.content.length > 800 ? '...' : ''}
          </div>
        </div>
      )}

      {/* Snapshot List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            加载中...
          </div>
        ) : snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground text-sm px-4 text-center">
            <Clock className="w-8 h-8 opacity-30" />
            <p>暂无快照</p>
            <p className="text-xs opacity-70">点击&ldquo;创建快照&rdquo;保存当前版本</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className={cn(
                  'flex items-start gap-2 px-3 py-2.5 hover:bg-accent/50 transition-colors group',
                  previewSnapshot?.id === snap.id && 'bg-primary/5'
                )}
              >
                <FileText className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium truncate">{snap.label || '快照'}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{(snap.wordCount ?? 0).toLocaleString()} 字</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatTime(snap.createdAt)}</p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handlePreview(snap)}
                    title="预览"
                    disabled={isPreviewLoading}
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleRestore(snap)}
                    title="还原"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(snap)}
                    title="删除"
                    disabled={deletingId === snap.id}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
