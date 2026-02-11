'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { BookOpen, ArrowLeft, Settings, FileText, Users, Database, Sparkles, Play, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import CharacterManager from '@/components/novel/CharacterManager';
import ChapterGenerator from '@/components/novel/ChapterGenerator';
import KnowledgeManager from '@/components/novel/KnowledgeManager';
import OutlineVersionManager from '@/components/novel/OutlineVersionManager';
import GenerationContext from '@/components/novel/GenerationContext';
import GenerationModeSelector from '@/components/novel/GenerationModeSelector';
import { novelsAPI, tasksAPI } from '@/lib/api';
import { io, Socket } from 'socket.io-client';

function NovelDetail() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const novelId = searchParams.get('id') as string;
  
  const [novel, setNovel] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('settings');
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Outline generation
  const [outlineVersions, setOutlineVersions] = useState<any[]>([]);
  const [currentVersion, setCurrentVersion] = useState<any>(null);
  const [generatedOutline, setGeneratedOutline] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [versionToRollback, setVersionToRollback] = useState<any>(null);
  
  // Ref for auto-scrolling textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleGenerateOutlineStream = (mode: string) => {
    setIsStreaming(true);
    if (mode === 'initial') {
      setGeneratedOutline('');
    }
    
    // If not initial, we use current generated outline as context
    const existingOutline = mode !== 'initial' ? generatedOutline : undefined;

    const eventSource = novelsAPI.generateOutlineStream(novelId, mode, existingOutline);
    let newContent = '';

    eventSource.onopen = () => {
      console.log('Stream connection opened');
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chunk') {
        newContent += data.content;
        setGeneratedOutline((prev) => mode === 'initial' ? prev + data.content : prev + data.content); // Simplified logic
        // Auto scroll
        if (textareaRef.current) {
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
      } else if (data.type === 'done') {
        eventSource.close();
        setIsStreaming(false);
        // Save the version automatically when done
        saveGeneratedVersion(newContent || generatedOutline, mode);
      } else if (data.type === 'error') {
        console.error('Stream error:', data.error);
        eventSource.close();
        setIsStreaming(false);
        toast.error('生成出错：' + data.error);
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
      eventSource.close();
      setIsStreaming(false);
      // toast.error('连接断开'); 
    };
  };

  const saveGeneratedVersion = async (content: string, mode: string) => {
    try {
      await novelsAPI.saveOutlineVersion(novelId, {
        content,
        mode,
        context: {
          title: novel?.title,
          genre: novel?.genre,
          targetWords: novel?.targetWords,
          worldSettings: !!novel?.worldSettings,
          knowledgeBases: novel?.knowledgeBases?.map((k: any) => k.name) || [],
          mode
        }
      });
      await loadOutlineVersions();
      toast.success('大纲已生成并保存！');
    } catch (error) {
      console.error('Failed to autosave version:', error);
      toast.error('自动保存失败');
    }
  };

  const handleManualSave = async () => {
    try {
      await novelsAPI.saveOutlineVersion(novelId, {
        content: generatedOutline,
        mode: 'manual',
        context: currentVersion?.generationContext
      });
      await loadOutlineVersions();
      toast.success('手动保存成功');
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('保存失败');
    }
  };

  const handleRollbackClick = (version: any) => {
    setVersionToRollback(version);
    setShowRollbackModal(true);
  };

  const confirmRollback = async () => {
    if (!versionToRollback) return;
    try {
      await novelsAPI.rollbackOutlineVersion(novelId, versionToRollback.id);
      await loadOutlineVersions();
      toast.success(`已回滚到版本 v${versionToRollback.version}`);
      setShowRollbackModal(false);
    } catch (error) {
      console.error('Rollback failed:', error);
      toast.error('回滚失败');
    }
  };

  const handleLock = async (version: any) => {
    try {
      await novelsAPI.lockOutlineVersion(novelId, version.id, !version.isLocked);
      await loadOutlineVersions();
      toast.success(version.isLocked ? '已解锁' : '已锁定');
    } catch (error) {
      console.error('Lock failed:', error);
      toast.error('操作失败');
    }
  };

  const handleUpdateNovel = async () => {
    try {
      await novelsAPI.update(novelId, {
        title: novel.title,
        genre: novel.genre,
        style: novel.style,
        background: novel.background,
        targetWords: novel.targetWords,
        worldSettings: novel.worldSettings,
      });
      toast.success('基础设定已保存');
    } catch (error) {
      console.error('Failed to update novel:', error);
      toast.error('保存失败');
    }
  };

  const loadNovel = async () => {
    try {
      const response = await novelsAPI.get(novelId);
      setNovel(response.data);
    } catch (error) {
      console.error('Failed to load novel:', error);
      router.push('/novels');
    } finally {
      setLoading(false);
    }
  };

  const loadOutlineVersions = async () => {
    try {
      const res = await novelsAPI.getOutlineVersions(novelId);
      setOutlineVersions(res.data || []);
      if (res.data && res.data.length > 0 && !currentVersion) {
        setCurrentVersion(res.data[0]);
        setGeneratedOutline(res.data[0].content);
      }
    } catch (error: any) {
      console.error('Failed to load outline versions:', error);
      // If it's an auth error, the axios interceptor will handle redirect
      // Otherwise, just set empty array
      if (error.response?.status !== 401) {
        setOutlineVersions([]);
      }
    }
  };

  useEffect(() => {
    loadNovel();
    
    // Setup WebSocket
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002');
    setSocket(newSocket);
    
    return () => {
      newSocket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novelId]);

  // Load versions when tab stays on outline or chapters
  useEffect(() => {
    if ((activeTab === 'outline' || activeTab === 'chapters') && novelId) {
      loadOutlineVersions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, novelId]);



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!novel) return null;

  const tabs = [
    { id: 'settings', label: '基础设定', icon: Settings },
    { id: 'outline', label: '大纲', icon: FileText },
    { id: 'chapters', label: '章节', icon: BookOpen },
    { id: 'characters', label: '人物卡', icon: Users },
    { id: 'knowledge', label: '知识库', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-white/20">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/novels" className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-primary-500">
              <ArrowLeft className="w-5 h-5" />
              <span>返回藏书阁</span>
            </Link>
            <div className="flex items-center space-x-3">
              <BookOpen className="w-6 h-6 text-primary-500" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {novel.title || '未命名小说'}
              </h1>
            </div>
            <div className="w-32 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => router.push('/settings')}>
                <Settings className="w-4 h-4 mr-2" />
                AI 设置
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex space-x-2 mb-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white'
                  : 'glass hover:bg-primary-100 dark:hover:bg-primary-900'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="max-w-4xl mx-auto">
          {/* Settings Tab */}
          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <Card className="animate-fadeIn p-6 md:p-8">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">基础设定</h2>
                <Button variant="default" onClick={handleUpdateNovel}>保存修改</Button>
              </div>
              
              <div className="space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        小说标题
                      </label>
                      <input
                        type="text"
                        value={novel.title || ''}
                        onChange={(e) => setNovel({ ...novel, title: e.target.value })}
                        className="w-full px-4 py-3 glass rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium text-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        类型与风格
                      </label>
                      <div className="flex flex-wrap gap-2 p-4 glass rounded-xl border border-gray-100 dark:border-gray-800">
                        {(!novel.genre?.length && !novel.style?.length) && (
                          <span className="text-sm text-gray-400">暂无标签</span>
                        )}
                        {novel.genre?.map((g: string) => (
                          <span key={g} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 border border-primary-100 dark:border-primary-800">
                            {g}
                          </span>
                        ))}
                        {novel.style?.map((s: string) => (
                          <span key={s} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    {novel.worldSettings && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                          <Database className="w-4 h-4 mr-2 text-primary-500" />
                          世界观参数
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">
                              时间背景
                            </label>
                            <div className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/5 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                              {novel.worldSettings.timeBackground || '未设定'}
                            </div>
                          </div>
                          {novel.worldSettings.powerSystem && (
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                                力量体系
                              </label>
                              <div className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/5 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                                {novel.worldSettings.powerSystem}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                             <label className="block text-xs font-medium text-gray-500 mb-1.5">
                               预估总字数
                             </label>
                             <div className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/5 rounded-lg text-sm text-gray-700 dark:text-gray-300 font-mono">
                               {novel.targetWords?.toLocaleString() || '未设定'} 字
                             </div>
                           </div>
                           <div>
                             <label className="block text-xs font-medium text-gray-500 mb-1.5">
                               单章最少字数
                             </label>
                             <div className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/5 rounded-lg text-sm text-gray-700 dark:text-gray-300 font-mono">
                               {novel.minChapterWords?.toLocaleString() || '3000'} 字
                             </div>
                           </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                        <Database className="w-4 h-4 mr-2 text-primary-500" />
                        关联知识库
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {novel.knowledgeBases?.length > 0 ? (
                          novel.knowledgeBases.map((kb: any) => (
                            <span key={kb.id} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                              {kb.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">暂无关联知识库，请前往“知识库”页添加</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        故事背景
                      </label>
                      <textarea
                        value={novel.background || ''}
                        onChange={(e) => setNovel({ ...novel, background: e.target.value })}
                        className="w-full px-4 py-3 glass rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[220px] text-base leading-relaxed resize-none"
                        placeholder="在此描述故事的核心背景、设定或创意..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Outline Tab */}
          {activeTab === 'outline' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
              {/* Left Sidebar: Version History & Structure (Placeholder for phase 2) */}
              {outlineVersions.length > 0 && (
                <div className="lg:col-span-3 space-y-6">
                  <OutlineVersionManager
                    versions={outlineVersions}
                    currentVersion={currentVersion}
                    onSelectVersion={(v) => { setCurrentVersion(v); setGeneratedOutline(v.content); }}
                    onRollback={handleRollbackClick}
                    onLock={handleLock}
                  />
                </div>
              )}

              {/* Main Content: Editor & Generation */}
              <Card className={cn(
                "p-6 md:p-8",
                outlineVersions.length > 0 ? "lg:col-span-9" : "lg:col-span-12"
              )}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">故事大纲</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {currentVersion ? `当前版本: v${currentVersion.version}` : '暂无大纲'}
                      {currentVersion?.isLocked === 1 && <span className="ml-2 text-amber-500">(已锁定)</span>}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <GenerationModeSelector 
                      onGenerate={handleGenerateOutlineStream}
                      isGenerating={isStreaming}
                      disabled={currentVersion?.isLocked === 1}
                    />
                  </div>
                </div>

                {/* Context Display */}
                {currentVersion?.generationContext && (
                  <GenerationContext context={currentVersion.generationContext} />
                )}

                <div className="relative">
                  {isStreaming && (
                    <div className="absolute top-2 right-2 flex items-center space-x-2 text-primary-500 bg-white/80 dark:bg-black/80 px-2 py-1 rounded backdrop-blur-sm z-10">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                      </span>
                      <span className="text-xs font-medium">正在生成...</span>
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    value={generatedOutline}
                    onChange={(e) => setGeneratedOutline(e.target.value)}
                    readOnly={isStreaming || currentVersion?.isLocked === 1}
                    className={cn(
                      "w-full px-5 py-4 glass rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[500px] font-mono text-sm leading-relaxed resize-y",
                      isStreaming && "opacity-90",
                      currentVersion?.isLocked === 1 && "bg-gray-50 dark:bg-gray-900/50 text-gray-500 cursor-not-allowed"
                    )}
                    placeholder={isStreaming ? "AI 正在思考并撰写大纲..." : "在此输入或生成大纲..."}
                  />
                </div>

                <div className="mt-6 flex justify-end space-x-4">
                   <Button 
                    variant="secondary" 
                    onClick={handleManualSave}
                    disabled={isStreaming || currentVersion?.isLocked === 1}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    保存修改
                  </Button>
                  <Button onClick={() => setActiveTab('chapters')} disabled={isStreaming}>
                    <Play className="w-5 h-5 mr-2" />
                    生成章节结构
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Chapters Tab */}
          {activeTab === 'chapters' && (
            <div className="animate-fadeIn">
              <ChapterGenerator
                novelId={novelId}
                volumes={novel.volumes || []}
                outline={currentVersion?.content || generatedOutline}
                onUpdate={loadNovel}
              />
            </div>
          )}

          {/* Characters Tab */}
          {activeTab === 'characters' && (
            <Card className="animate-fadeIn p-6 md:p-8">
              <CharacterManager
                novelId={novelId}
                characters={novel.characters || []}
                onUpdate={loadNovel}
              />
            </Card>
          )}

          {/* Knowledge Tab */}
          {activeTab === 'knowledge' && (
            <Card className="animate-fadeIn p-6 md:p-8">
              <KnowledgeManager
                novelId={novelId}
                knowledgeBases={novel.knowledgeBases || []}
                onUpdate={loadNovel}
              />
            </Card>
          )}
        </div>
        
        <Modal
          isOpen={showRollbackModal}
          onClose={() => setShowRollbackModal(false)}
          title="确认回滚"
        >
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-300">
              确定要回滚到版本 {versionToRollback?.version ? `v${versionToRollback.version}` : '该版本'} 吗？这将基于该版本创建一个最新的大纲版本。
            </p>
            <div className="flex justify-end space-x-3">
              <Button variant="ghost" onClick={() => setShowRollbackModal(false)}>
                取消
              </Button>
              <Button variant="default" onClick={confirmRollback}>
                确认回滚
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

export default function NovelDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">加载中...</div>}>
      <NovelDetail />
    </Suspense>
  );
}
