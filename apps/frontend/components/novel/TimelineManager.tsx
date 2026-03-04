'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Plus, Edit2, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { novelsAPI } from '@/lib/api';
import { toast } from 'sonner';

export interface TimelineEvent {
  id: string;
  novelId: string;
  title: string;
  description: string | null;
  timeLabel: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface TimelineManagerProps {
  novelId: string;
}

export default function TimelineManager({ novelId }: TimelineManagerProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    timeLabel: '',
    description: '',
    order: 0,
  });

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await novelsAPI.getTimelineEvents(novelId);
      setEvents(res.data);
    } catch (error) {
      console.error('Failed to load timeline events:', error);
      toast.error('获取时间线失败');
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    if (novelId) {
      loadEvents();
    }
  }, [novelId, loadEvents]);

  const handleOpenModal = (event?: TimelineEvent) => {
    if (event) {
      setEditingEvent(event);
      setFormData({
        title: event.title,
        timeLabel: event.timeLabel || '',
        description: event.description || '',
        order: event.order,
      });
    } else {
      setEditingEvent(null);
      // Auto-increment order based on last event
      const maxOrder = events.length > 0 ? Math.max(...events.map(e => e.order)) : 0;
      setFormData({
        title: '',
        timeLabel: '',
        description: '',
        order: maxOrder + 1,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('请输入事件名称');
      return;
    }

    try {
      if (editingEvent) {
        await novelsAPI.updateTimelineEvent(novelId, editingEvent.id, formData);
        toast.success('时间线节点已更新');
      } else {
        await novelsAPI.createTimelineEvent(novelId, formData);
        toast.success('时间线节点添加成功');
      }
      setIsModalOpen(false);
      loadEvents();
    } catch (error) {
      console.error('Failed to save timeline event:', error);
      toast.error('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个时间节点吗？操作不可恢复。')) {
      try {
        await novelsAPI.deleteTimelineEvent(novelId, id);
        toast.success('删除成功');
        loadEvents();
      } catch (error) {
        console.error('Failed to delete timeline event:', error);
        toast.error('删除失败');
      }
    }
  };

  // Helper function to quickly adjust order
  const handleMove = async (event: TimelineEvent, direction: 'up' | 'down') => {
    const currentIndex = events.findIndex(e => e.id === event.id);
    if (direction === 'up' && currentIndex > 0) {
      const targetEvent = events[currentIndex - 1];
      // Swap order
      await novelsAPI.updateTimelineEvent(novelId, event.id, { order: targetEvent.order });
      await novelsAPI.updateTimelineEvent(novelId, targetEvent.id, { order: event.order });
      loadEvents();
    } else if (direction === 'down' && currentIndex < events.length - 1) {
      const targetEvent = events[currentIndex + 1];
       // Swap order
       await novelsAPI.updateTimelineEvent(novelId, event.id, { order: targetEvent.order });
       await novelsAPI.updateTimelineEvent(novelId, targetEvent.id, { order: event.order });
       loadEvents();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Clock className="w-6 h-6 mr-2 text-primary-500" />
            时间线视图
          </h2>
          <p className="text-sm text-gray-500 mt-1">梳理小说的历史年代、大事件流以及人物成长时间节点。</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-5 h-5 mr-2" />
          新建节点
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-gray-400 bg-gray-50/50 dark:bg-gray-900/50">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>暂无时间节点。开始记录您故事中的第一个大事件吧。</p>
        </div>
      ) : (
        <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-4 md:ml-6 pb-4">
          {events.map((event, index) => (
            <div key={event.id} className="mb-10 pl-8 relative group">
              {/* Timeline Dot */}
              <div className="absolute w-4 h-4 rounded-full bg-primary-500 border-4 border-white dark:border-gray-900 -left-[9px] top-1.5 shadow-sm"></div>
              
              <div className="bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 p-5 rounded-xl hover:shadow-md transition relative group max-w-3xl">
                
                {/* Actions (visible on hover) */}
                <div className="absolute top-4 right-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg p-1">
                  <button
                    onClick={() => handleMove(event, 'up')}
                    disabled={index === 0}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-primary-600 disabled:opacity-30 transition"
                    title="向上移动"
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMove(event, 'down')}
                    disabled={index === events.length - 1}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-primary-600 disabled:opacity-30 transition"
                    title="向下移动"
                  >
                     <ArrowDownCircle className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 my-auto mx-1"></div>
                  <button
                    onClick={() => handleOpenModal(event)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-primary-600 transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-gray-500 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Content */}
                <div className="pr-24"> 
                  {event.timeLabel && (
                    <span className="inline-block px-3 py-1 mb-3 text-xs font-semibold text-primary-700 bg-primary-50 dark:text-primary-300 dark:bg-primary-900/40 rounded-full border border-primary-100 dark:border-primary-800">
                      {event.timeLabel}
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {event.title}
                  </h3>
                  {event.description && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEvent ? '编辑时间节点' : '新建时间节点'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
             <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">发生时间标签 (选填)</label>
              <Input
                value={formData.timeLabel}
                onChange={(e) => setFormData({ ...formData, timeLabel: e.target.value })}
                placeholder="例如：神魔大战元年、公元2050年"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">排序数值</label>
              <Input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                placeholder="0"
                className="w-full"
                title="用于排序，数值越小展示越靠前"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">事件名称</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="例如：发现上古遗迹"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">事件详情 (选填)</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="详细描述在这个时间点发生了什么事情..."
              className="resize-none h-32"
            />
          </div>

          <p className="text-xs text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
            提示：排序数值将决定节点在时间线上的先后顺序，数值较小的事件会在排在更上方。您在添加后也可以通过卡片上的箭头微调。
          </p>

          <div className="flex justify-end space-x-4 pt-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit}>
              {editingEvent ? '保存' : '添加'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
