'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bookmark, Plus, Edit2, Trash2, CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { novelsAPI } from '@/lib/api';
import { toast } from 'sonner';

export interface PlotThread {
  id: string;
  novelId: string;
  title: string;
  content: string | null;
  status: 'open' | 'resolved' | 'dropped';
  createdAt: string;
  updatedAt: string;
}

interface PlotThreadManagerProps {
  novelId: string;
}
// ... (other imports stay the same)

export default function PlotThreadManager({ novelId }: PlotThreadManagerProps) {
  const [threads, setThreads] = useState<PlotThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingThread, setEditingThread] = useState<PlotThread | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    status: 'open' as PlotThread['status'],
  });

  const loadThreads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await novelsAPI.getPlotThreads(novelId);
      setThreads(res.data);
    } catch (error) {
      console.error('Failed to load plot threads:', error);
      toast.error('获取伏笔列表失败');
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    if (novelId) {
      loadThreads();
    }
  }, [novelId, loadThreads]);

  const handleOpenModal = (thread?: PlotThread) => {
    if (thread) {
      setEditingThread(thread);
      setFormData({
        title: thread.title,
        content: thread.content || '',
        status: thread.status,
      });
    } else {
      setEditingThread(null);
      setFormData({
        title: '',
        content: '',
        status: 'open',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('请输入伏笔标题/简述');
      return;
    }

    try {
      if (editingThread) {
        await novelsAPI.updatePlotThread(novelId, editingThread.id, formData);
        toast.success('伏笔已更新');
      } else {
        await novelsAPI.createPlotThread(novelId, formData);
        toast.success('伏笔添加成功');
      }
      setIsModalOpen(false);
      loadThreads();
    } catch (error) {
      console.error('Failed to save plot thread:', error);
      toast.error('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这条伏笔记录吗？该操作不可恢复。')) {
      try {
        await novelsAPI.deletePlotThread(novelId, id);
        toast.success('伏笔已删除');
        loadThreads();
      } catch (error) {
        console.error('Failed to delete plot thread:', error);
        toast.error('删除失败');
      }
    }
  };

  const StatusIcon = ({ status }: { status: PlotThread['status'] }) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'dropped':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <CircleDashed className="w-4 h-4 text-blue-500" />;
    }
  };

  const StatusLabel = ({ status }: { status: PlotThread['status'] }) => {
    switch (status) {
      case 'resolved':
        return <span className="text-green-600 dark:text-green-400 font-medium">已回收</span>;
      case 'dropped':
        return <span className="text-red-600 dark:text-red-400 font-medium">已废弃</span>;
      default:
        return <span className="text-blue-600 dark:text-blue-400 font-medium">未回收</span>;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Bookmark className="w-6 h-6 mr-2 text-primary-500" />
            伏笔追踪
          </h2>
          <p className="text-sm text-gray-500 mt-1">记录并追踪故事中埋下的伏笔及支线任务进度。</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-5 h-5 mr-2" />
          新增伏笔
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : threads.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-gray-400 bg-gray-50/50 dark:bg-gray-900/50">
          <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>暂无伏笔记录。在这里可以记录您在前期埋下的坑，防止后期遗忘。</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {threads.map((thread: PlotThread) => (
            <div key={thread.id} className="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 p-5 rounded-xl hover:shadow-md transition relative group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <StatusIcon status={thread.status} />
                  <h3 className="text-base font-bold text-gray-900 dark:text-white line-clamp-1">
                    {thread.title}
                  </h3>
                </div>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpenModal(thread)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-500 hover:text-primary-600 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(thread.id)}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-gray-500 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                <StatusLabel status={thread.status} />
              </div>

              {thread.content && (
                <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 bg-white/50 dark:bg-black/20 p-3 rounded-lg">
                  {thread.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Plot Thread Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingThread ? '编辑伏笔' : '新增伏笔'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">伏笔标题/简述</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="例如：后山神秘山洞里的声音"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">状态</label>
            <div className="flex space-x-3">
              {[
                { value: 'open', label: '未回收 (进行中)', icon: CircleDashed, color: 'text-blue-500' },
                { value: 'resolved', label: '已回收 (填坑完毕)', icon: CheckCircle2, color: 'text-green-500' },
                { value: 'dropped', label: '已废弃 (剧情修改废弃)', icon: XCircle, color: 'text-red-500' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, status: opt.value as any })}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border flex-1 transition ${
                    formData.status === opt.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <opt.icon className={`w-5 h-5 mb-1 ${formData.status === opt.value ? opt.color : 'text-gray-400'}`} />
                  <span className={`text-xs font-medium ${formData.status === opt.value ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">详细说明 (选填)</label>
            <Textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="记录伏笔埋在哪一章、期望在什么阶段用什么方式回收..."
              className="resize-none h-32"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit}>
              {editingThread ? '保存' : '添加'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
