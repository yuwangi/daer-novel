import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play, CheckCircle, XCircle, Eye, Edit2, Sparkles, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { io, Socket } from 'socket.io-client';
import { tasksAPI } from '@/lib/api';
import { toast } from 'sonner';

interface Chapter {
  id: string;
  title: string;
  order: number;
  outline?: string;
  detailOutline?: string;
  content?: string;
  wordCount: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

interface Volume {
  id: string;
  title: string;
  order: number;
  chapters: Chapter[];
}

interface ChapterGeneratorProps {
  novelId: string;
  volumes: Volume[];
  outline?: string;
  onUpdate: () => void;
}

export default function ChapterGenerator({ novelId, volumes, outline, onUpdate }: ChapterGeneratorProps) {
  const router = useRouter();
  const [generatingChapterId, setGeneratingChapterId] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Structure Generation State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [additionalRequirements, setAdditionalRequirements] = useState('');
  const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);

  // Content Generation State
  const [activeChapterForConfig, setActiveChapterForConfig] = useState<Chapter | null>(null);
  const [contentOutline, setContentOutline] = useState('');
  const [contentInstructions, setContentInstructions] = useState('');

  useEffect(() => {
    // Setup WebSocket
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002');
    setSocket(newSocket);
    
    // Listen for structure generation events
    newSocket.on('novel:updated', (data) => {
       if (data.novelId === novelId) {
          onUpdate();
          setIsGeneratingStructure(false);
       }
    });

    // Listen for task events
    newSocket.on('task:progress', (data) => {
       setGenerationProgress(data.progress || 0);
       setGenerationStatus(data.message || '生成中...');
    });
    
    newSocket.on('task:completed', (data) => {
       setGenerationProgress(100);
       setGenerationStatus('生成完成');
       setTimeout(() => {
          setGeneratingChapterId(null);
          onUpdate();
       }, 500);
    });

    newSocket.on('task:failed', (data) => {
       setGenerationStatus('生成失败');
       toast.error(`生成失败: ${data.error}`);
       setGeneratingChapterId(null);
    });

    return () => {
      newSocket.close();
    };
  }, [novelId, onUpdate]);

  // Structure Generation Handlers
  const handleStartGeneration = () => {
    if (!outline) {
      toast.error('请先生成并选定一个大纲版本');
      return;
    }
    setIsSettingsModalOpen(true);
  };

  const handleConfirmGeneration = async () => {
    setIsSettingsModalOpen(false);
    setIsGeneratingStructure(true);
    try {
      await tasksAPI.generateChapters(novelId, { 
        outline,
        additionalRequirements 
      });
      toast.success('章节结构生成任务已提交');
    } catch (error) {
      console.error('Failed to generate chapters:', error);
      toast.error('生成请求失败');
      setIsGeneratingStructure(false);
    }
  };

  // Single Chapter Generation
  const handleGenerateChapter = async (chapter: Chapter) => {
    setActiveChapterForConfig(chapter);
    setContentOutline(chapter.detailOutline || chapter.outline || '');
    setContentInstructions('');
  };

  const handleConfirmContentGeneration = async () => {
    if (!activeChapterForConfig) return;
    
    const chapterId = activeChapterForConfig.id;
    setActiveChapterForConfig(null); // Close modal
    
    setGeneratingChapterId(chapterId);
    setGenerationProgress(0);
    setGenerationStatus('准备生成...');

    try {
      await tasksAPI.generateChapterContent(novelId, chapterId, {
        modifiedOutline: contentOutline,
        additionalInstructions: contentInstructions
      });
      toast.success('章节生成任务已提交');
    } catch (error) {
      console.error('Failed to generate chapter:', error);
      toast.error('生成请求失败');
      setGeneratingChapterId(null);
    }
  };

  const handlePreviewChapter = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    setEditContent(chapter.content || '');
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
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'generating':
        return 'text-primary-600 dark:text-primary-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
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
                 onClick={handleStartGeneration} 
                 disabled={isGeneratingStructure}
               >
                 {isGeneratingStructure ? (
                   <>
                     <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                     正在生成结构...
                   </>
                 ) : (
                   <>
                     <Sparkles className="w-4 h-4 mr-2" />
                     生成章节结构
                   </>
                 )}
               </Button>
             ) : (
               <p className="text-amber-500">请先在&quot;大纲&quot;标签页生成并锁定一个大纲</p>
             )}
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              章节列表 ({volumes.reduce((acc, v) => acc + v.chapters.length, 0)} 章)
            </h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleStartGeneration}
              disabled={isGeneratingStructure}
              className="text-primary-600 border-primary-200 hover:bg-primary-50 dark:border-primary-800 dark:hover:bg-primary-900/20"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              重新生成结构
            </Button>
          </div>
          
          {volumes.map((volume) => (
            <Card key={volume.id} className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {volume.title}
                </h3>
                <span className="text-sm font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                  {volume.chapters.filter(c => c.status === 'completed').length} / {volume.chapters.length} 已完成
                </span>
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
                      {/* Left: Title & Meta */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex-shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                          第 {chapter.order} 章
                        </span>
                        <h4 className="font-semibold text-gray-900 dark:text-white truncate" title={chapter.title}>
                          {chapter.title}
                        </h4>
                        {getStatusIcon(chapter.status, chapter.id)}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                         {chapter.status === 'completed' && (
                           <Button
                             variant="ghost"
                             size="sm"
                             className="h-8"
                             onClick={() => handlePreviewChapter(chapter)}
                           >
                             <Eye className="w-4 h-4 mr-1" />
                             预览
                           </Button>
                         )}

                         {generatingChapterId === chapter.id ? (
                          <Button variant="ghost" size="sm" disabled className="h-8">
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            生成中
                          </Button>
                        ) : (
                          <>
                            {chapter.status !== 'completed' && (
                              <Button
                                size="sm"
                                className="h-8"
                                onClick={() => handleGenerateChapter(chapter)}
                              >
                                <Sparkles className="w-4 h-4 mr-1" />
                                {chapter.status === 'failed' ? '重试' : '生成正文'}
                              </Button>
                            )}
                            
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              className="h-8"
                              onClick={() => handleEditChapter(chapter)}
                            >
                              <Edit2 className="w-4 h-4 mr-1" />
                              编辑
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Body: Summary */}
                    {chapter.outline && (
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
                           <span>字数: {chapter.wordCount.toLocaleString()}</span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium ${
                          chapter.status === 'completed' ? 'bg-green-100 text-green-700' :
                          chapter.status === 'generating' ? 'bg-blue-100 text-blue-700' :
                          chapter.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {chapter.status === 'completed' && '已完成'}
                          {chapter.status === 'generating' && '生成中'}
                          {chapter.status === 'failed' && '生成失败'}
                          {chapter.status === 'pending' && '待生成'}
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
            </div>
          </Card>

          ))}
        </div>
      )}

      {/* Generation Settings Modal (Structure) */}
      <Modal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="生成设置"
      >
        {/* ... existing modal ... */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              额外要求（可选）
            </label>
            <textarea
              value={additionalRequirements}
              onChange={(e) => setAdditionalRequirements(e.target.value)}
              placeholder="例如：希望能多一些打斗场面，或者把第一卷控制在50章以内..."
              className="w-full h-32 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <Button variant="ghost" onClick={() => setIsSettingsModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmGeneration}>
              开始生成
            </Button>
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
            <Button variant="ghost" onClick={() => setActiveChapterForConfig(null)}>
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
        title={selectedChapter?.title || '章节预览'}
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
                     selectedChapter.content.split('\n\n').map((paragraph, i) => (
                      <p key={i} className="mb-4 leading-relaxed text-justify indent-8">
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
                    <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
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
