'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import useSWR from 'swr';

import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { BookOpen, ArrowLeft, Settings, FileText, Users, Database, Sparkles, Play, Loader2, Save, Download, Upload, FileJson, Book, Beaker, Plus, Trash2, Wand2, Bookmark, Clock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import GenerationContext from '@/components/novel/GenerationContext';
import GenerationModeSelector from '@/components/novel/GenerationModeSelector';
import OutlineVersionManager from '@/components/novel/OutlineVersionManager';
import { novelsAPI, tasksAPI, sandboxAPI } from '@/lib/api';

// Lazy-load heavy tab components — only downloaded when the tab is opened
const TabSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-muted/50" />)}
  </div>
);
const ChapterGenerator  = dynamic(() => import('@/components/novel/ChapterGenerator'),  { loading: () => <TabSkeleton /> });
const KnowledgeManager  = dynamic(() => import('@/components/novel/KnowledgeManager'),  { loading: () => <TabSkeleton /> });
const CharacterManager  = dynamic(() => import('@/components/novel/CharacterManager'),  { loading: () => <TabSkeleton /> });
const PlotThreadManager = dynamic(() => import('@/components/novel/PlotThreadManager'), { loading: () => <TabSkeleton /> });
const TimelineManager   = dynamic(() => import('@/components/novel/TimelineManager'),   { loading: () => <TabSkeleton /> });


function NovelDetail() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const novelId = searchParams.get('id') as string;
  
  const [activeTab, setActiveTab] = useState('settings');

  // Fetch novel via SWR — cached so revisiting the page is instant
  const { data: novelData, isLoading: loading, mutate: mutateNovel } = useSWR(
    novelId ? `/api/novels/${novelId}` : null,
    () => novelsAPI.get(novelId).then((r) => r.data),
    { onError: () => router.push('/novels') }
  );

  // Local edits overlay SWR data so fields remain editable without round trips
  const [localNovel, setLocalNovel] = useState<any>(null);
  const displayNovel = localNovel ?? novelData;

  // Outline generation
  const [outlineVersions, setOutlineVersions] = useState<any[]>([]);
  const [currentVersion, setCurrentVersion] = useState<any>(null);
  const [generatedOutline, setGeneratedOutline] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [versionToRollback, setVersionToRollback] = useState<any>(null);

  // Style Mimicry state
  const [styleSample, setStyleSample] = useState('');
  const [isExtractingStyle, setIsExtractingStyle] = useState(false);

  // Plot Sandbox state
  const [sandboxes, setSandboxes] = useState<any[]>([]);
  const [activeSandbox, setActiveSandbox] = useState<any>(null);
  const [sandboxTitle, setSandboxTitle] = useState('');
  const [sandboxPremise, setSandboxPremise] = useState('');
  const [isCreatingSandbox, setIsCreatingSandbox] = useState(false);
  const [isGeneratingSandbox, setIsGeneratingSandbox] = useState(false);
  
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
          title: displayNovel?.title,
          genre: displayNovel?.genre,
          targetWords: displayNovel?.targetWords,
          worldSettings: !!displayNovel?.worldSettings,
          knowledgeBases: displayNovel?.knowledgeBases?.map((k: any) => k.name) || [],
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
        writingStyleRules: novel.writingStyleRules,
      });
      toast.success('基础设定已保存');
    } catch (error) {
      console.error('Failed to update novel:', error);
      toast.error('保存失败');
    }
  };

  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('cover', file);

    setIsUploadingCover(true);
    try {
    const res = await novelsAPI.updateCover(novelId, formData);
      mutateNovel(); // revalidate from server

      toast.success('封面上传成功');
    } catch (error) {
      console.error('Cover upload failed:', error);
      toast.error('封面上传失败');
    } finally {
      setIsUploadingCover(false);
    }
  };
  // keep localNovel in sync when SWR data changes (e.g. after mutate)
  useEffect(() => { if (novelData) setLocalNovel(null); }, [novelData]);


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

  // Load versions when tab stays on outline or chapters
  useEffect(() => {
    if ((activeTab === 'outline' || activeTab === 'chapters') && novelId) {
      loadOutlineVersions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, novelId]);

  // Load sandboxes when sandbox tab is opened
  useEffect(() => {
    if (activeTab === 'sandbox' && novelId) {
      sandboxAPI.list(novelId).then(res => {
        setSandboxes(res.data.sandboxes || []);
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, novelId]);


  if (!displayNovel && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!displayNovel) return null;

  // Alias so the existing JSX below doesn't need to change
  const novel = displayNovel;
  const setNovel = (val: any) =>
    setLocalNovel(typeof val === 'function' ? val(displayNovel) : val);

  const tabs = [
    { id: 'settings', label: '基础设定', icon: Settings },
    { id: 'outline', label: '大纲', icon: FileText },
    { id: 'chapters', label: '章节', icon: BookOpen },
    { id: 'characters', label: '人物卡', icon: Users },
    { id: 'threads', label: '伏笔追踪', icon: Bookmark },
    { id: 'timeline', label: '时间线', icon: Clock },
    { id: 'knowledge', label: '知识库', icon: Database },
    { id: 'style', label: '文风设定', icon: Sparkles },
    { id: 'sandbox', label: '推演沙盒', icon: Beaker },
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
            <div className="flex items-center justify-end space-x-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    导出
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={async () => {
                    try {
                      const res = await novelsAPI.export(novelId, 'json');
                      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `${novel.title || 'novel'}_export.json`;
                      link.click();
                      URL.revokeObjectURL(url);
                      toast.success('JSON 导出成功');
                    } catch (err) {
                      toast.error('导出失败');
                    }
                  }}>
                    <FileJson className="w-4 h-4 mr-2" />
                    项目备份 (JSON)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    try {
                      const res = await novelsAPI.export(novelId, 'txt');
                      const blob = new Blob([res.data], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `${novel.title || 'novel'}.txt`;
                      link.click();
                      URL.revokeObjectURL(url);
                      toast.success('TXT 导出成功');
                    } catch (err) {
                      toast.error('导出失败');
                    }
                  }}>
                    <FileText className="w-4 h-4 mr-2" />
                    纯文本 (TXT)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    try {
                      const res = await novelsAPI.export(novelId, 'epub');
                      const blob = new Blob([res.data], { type: 'application/epub+zip' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `${novel.title || 'novel'}.epub`;
                      link.click();
                      URL.revokeObjectURL(url);
                      toast.success('EPUB 导出成功');
                    } catch (err) {
                      toast.error('导出失败');
                    }
                  }}>
                    <Book className="w-4 h-4 mr-2" />
                    电子书 (EPUB)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
        <div className="flex space-x-2 mb-8 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'glass hover:bg-primary-100 dark:hover:bg-primary-900 border border-transparent dark:border-gray-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
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
                        小说封面
                      </label>
                      <div className="flex items-start space-x-6">
                        <div className="relative group w-32 aspect-[3/4] rounded-xl overflow-hidden bg-muted border-2 border-dashed border-border flex items-center justify-center shrink-0">
                          {novel.coverUrl ? (
                            <>
                              <img 
                                src={novel.coverUrl.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'}${novel.coverUrl}` : novel.coverUrl} 
                                alt="Cover" 
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Upload className="w-6 h-6 text-white" />
                              </div>
                            </>
                          ) : (
                            <Upload className="w-8 h-8 text-muted-foreground/40" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleCoverUpload}
                            disabled={isUploadingCover}
                            className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                          />
                          {isUploadingCover && (
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-20">
                              <Loader2 className="w-6 h-6 animate-spin text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            支持 JPG、PNG 格式，建议比例 3:4。<br />
                            点击左侧区域或下方按钮上传封面。
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs relative overflow-hidden"
                            disabled={isUploadingCover}
                          >
                            <Upload className="w-3.5 h-3.5 mr-1.5" />
                            {novel.coverUrl ? '更换封面' : '上传封面'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleCoverUpload}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        故事背景
                      </label>
                      <textarea
                        value={novel.background || ''}
                        onChange={(e) => setNovel({ ...novel, background: e.target.value })}
                        className="w-full px-4 py-3 glass rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[160px] text-base leading-relaxed resize-none"
                        placeholder="在此描述故事的核心背景、设定 or 创意..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Style Tab */}
          {activeTab === 'style' && (
            <Card className="animate-fadeIn p-6 md:p-8 space-y-8">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                    <Sparkles className="w-6 h-6 mr-2 text-primary-500" />
                    文风设定 (Style Mimicry)
                  </h2>
                  <p className="text-sm text-gray-500 mt-2">
                    提取您的特色写作风格，并自动应用到未来的 AI 生成中。
                  </p>
                </div>
                <Button variant="default" onClick={handleUpdateNovel}>保存修改</Button>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Extraction Area */}
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    1. 粘贴作品正文用于提取 (500-1000字)
                  </label>
                  <textarea
                    value={styleSample}
                    onChange={(e) => setStyleSample(e.target.value)}
                    placeholder="请复制一段最能代表您当前写作风格的小说正文段落。AI 将对词汇习惯、句式长短、叙述节奏等进行解构提取..."
                    className="w-full px-4 py-3 glass rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[300px] text-sm leading-relaxed resize-y"
                  />
                  <div className="flex justify-end">
                    <Button 
                      onClick={async () => {
                        if (!styleSample || styleSample.length < 50) {
                          toast.error('样本文本太短，请至少提供50字以上');
                          return;
                        }
                        setIsExtractingStyle(true);
                        try {
                          const res = await novelsAPI.extractStyle(novelId, styleSample);
                          setNovel({ ...novel, writingStyleRules: res.data.writingStyleRules });
                          toast.success('文风提取成功！');
                        } catch (error: any) {
                          toast.error(error.response?.data?.error || '提取失败');
                        } finally {
                          setIsExtractingStyle(false);
                        }
                      }}
                      disabled={isExtractingStyle || !styleSample}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {isExtractingStyle ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      {isExtractingStyle ? '正在提取...' : '开始提取文风'}
                    </Button>
                  </div>
                </div>

                {/* Rules Display Area */}
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    2. AI 提取结果 (将用于指导未来生成)
                  </label>
                  <textarea
                    value={novel.writingStyleRules || ''}
                    onChange={(e) => setNovel({ ...novel, writingStyleRules: e.target.value })}
                    placeholder="AI 提取出的文风规则将展示在这里，您也可以手动修改或添加更多规则指导。格式建议为 JSON 或纯文本指令。"
                    className="w-full px-4 py-3 glass rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[350px] font-mono text-xs leading-relaxed resize-y bg-purple-50/30 dark:bg-purple-900/10"
                  />
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
                onUpdate={mutateNovel}
              />
            </div>
          )}

          {/* Characters Tab */}
          {activeTab === 'characters' && (
            <Card className="animate-fadeIn p-6 md:p-8">
              <CharacterManager
                novelId={novelId}
                characters={novel.characters || []}
                onUpdate={mutateNovel}
              />
            </Card>
          )}

          {/* Plot Threads Tab */}
          {activeTab === 'threads' && (
            <Card className="animate-fadeIn p-6 md:p-8">
              <PlotThreadManager novelId={novelId} />
            </Card>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <Card className="animate-fadeIn p-6 md:p-8">
              <TimelineManager novelId={novelId} />
            </Card>
          )}

          {/* Knowledge Tab */}
          {activeTab === 'knowledge' && (
            <Card className="animate-fadeIn p-6 md:p-8">
              <KnowledgeManager
                novelId={novelId}
                knowledgeBases={novel.knowledgeBases || []}
                onUpdate={mutateNovel}
              />
            </Card>
          )}

          {/* Plot Sandbox Tab */}
          {activeTab === 'sandbox' && (
            <div className="animate-fadeIn grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sidebar: Sandbox List */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Beaker className="w-4 h-4 text-primary-500" />
                    推演列表
                  </h3>
                  <Button size="sm" variant="ghost" onClick={() => {
                    setActiveSandbox(null);
                    setSandboxTitle('');
                    setSandboxPremise('');
                    setIsCreatingSandbox(true);
                  }}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Create new sandbox form */}
                {isCreatingSandbox && (
                  <div className="space-y-2 p-3 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-950/30">
                    <input
                      className="w-full px-3 py-1.5 text-sm glass rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="沙盒名称（如：如果主角失败了）"
                      value={sandboxTitle}
                      onChange={(e) => setSandboxTitle(e.target.value)}
                    />
                    <textarea
                      className="w-full px-3 py-1.5 text-sm glass rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[80px] resize-none"
                      placeholder="前提假设：描述一个「如果...会怎样」的情节节点"
                      value={sandboxPremise}
                      onChange={(e) => setSandboxPremise(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={async () => {
                        if (!sandboxTitle.trim() || !sandboxPremise.trim()) {
                          toast.error('请填写名称和前提假设');
                          return;
                        }
                        try {
                          const res = await sandboxAPI.create(novelId, { title: sandboxTitle, premise: sandboxPremise });
                          const newSandbox = res.data.sandbox;
                          setSandboxes(prev => [...prev, newSandbox]);
                          setActiveSandbox(newSandbox);
                          setSandboxTitle('');
                          setSandboxPremise('');
                          setIsCreatingSandbox(false);
                          toast.success('推演沙盒创建成功');
                        } catch {
                          toast.error('创建失败');
                        }
                      }}>创建</Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsCreatingSandbox(false)}>取消</Button>
                    </div>
                  </div>
                )}

                {/* Sandbox list */}
                <div className="space-y-1">
                  {sandboxes.length === 0 && !isCreatingSandbox && (
                    <p className="text-sm text-gray-400 text-center py-4">暂无推演，点击 + 新建</p>
                  )}
                  {sandboxes.map(sb => (
                    <button
                      key={sb.id}
                      onClick={() => setActiveSandbox(sb)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg text-sm transition-all',
                        activeSandbox?.id === sb.id
                          ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-medium'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      )}
                    >
                      {sb.title}
                    </button>
                  ))}
                </div>
              </Card>

              {/* Main area: Active Sandbox */}
              <Card className="lg:col-span-2 p-6 space-y-5">
                {!activeSandbox ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400">
                    <Beaker className="w-12 h-12 mb-3 opacity-40" />
                    <p className="text-sm">选择一个推演沙盒，或点击左侧 + 新建</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">{activeSandbox.title}</h3>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        if (!confirm('确定删除这个推演沙盒？')) return;
                        try {
                          await sandboxAPI.delete(activeSandbox.id);
                          setSandboxes(prev => prev.filter(s => s.id !== activeSandbox.id));
                          setActiveSandbox(null);
                          toast.success('已删除');
                        } catch {
                          toast.error('删除失败');
                        }
                      }} className="text-red-500 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-1">前提假设</label>
                      <textarea
                        value={activeSandbox.premise}
                        onChange={(e) => setActiveSandbox((prev: any) => ({ ...prev, premise: e.target.value }))}
                        onBlur={async () => {
                          try { await sandboxAPI.update(activeSandbox.id, { premise: activeSandbox.premise }); } catch {}
                        }}
                        className="w-full px-4 py-3 glass rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none min-h-[80px] text-sm"
                        placeholder="描述假设前提…"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={async () => {
                          setIsGeneratingSandbox(true);
                          try {
                            // Save premise first
                            await sandboxAPI.update(activeSandbox.id, { premise: activeSandbox.premise });
                            const res = await sandboxAPI.generate(activeSandbox.id);
                            const updated = res.data.sandbox;
                            setActiveSandbox(updated);
                            setSandboxes(prev => prev.map(s => s.id === updated.id ? updated : s));
                            toast.success('推演生成完成！');
                          } catch (err: any) {
                            toast.error(err?.response?.data?.error || '推演生成失败');
                          } finally {
                            setIsGeneratingSandbox(false);
                          }
                        }}
                        disabled={isGeneratingSandbox}
                      >
                        {isGeneratingSandbox ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />推演中...</>
                        ) : (
                          <><Wand2 className="w-4 h-4 mr-2" />推演剧情</>
                        )}
                      </Button>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-1">推演结果</label>
                      <textarea
                        value={activeSandbox.content || ''}
                        onChange={(e) => setActiveSandbox((prev: any) => ({ ...prev, content: e.target.value }))}
                        onBlur={async () => {
                          try { await sandboxAPI.update(activeSandbox.id, { content: activeSandbox.content }); } catch {}
                        }}
                        className="w-full px-4 py-3 glass rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y min-h-[300px] text-sm leading-relaxed font-mono"
                        placeholder="AI 将在这里生成推演结果，您也可以手动编辑…"
                      />
                    </div>
                  </>
                )}
              </Card>
            </div>
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
