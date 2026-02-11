'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { tasksAPI, novelsAPI } from '@/lib/api';
import { 
  Loader2, Save, ArrowLeft, CheckCircle, AlertCircle, 
  Sparkles, Settings, Type, PanelRightOpen, PanelRightClose, 
  BookOpen, Home, ChevronRight, Menu 
} from 'lucide-react';
import { toast } from 'sonner';
import { ChatPanel } from '@/components/editor/ChatPanel';
import { ChapterListSidebar } from '@/components/editor/ChapterListSidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogTrigger } from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Chapter {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  novelId: string;
  volumeId: string;
  outline?: string;
  order: number;
  volume?: {
    id: string;
    title: string;
  };
}

interface Novel {
  id: string;
  title: string;
  volumes: {
    id: string;
    title: string;
    order: number;
    chapters: any[];
  }[];
  outlineVersions?: {
    id: string;
    content: string;
    createdAt: string;
  }[];
}

type FontSize = 'sm' | 'base' | 'lg' | 'xl';
type FontFamily = 'sans' | 'serif' | 'mono';

function ChapterEditor() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const chapterId = searchParams.get('id') as string;
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [novel, setNovel] = useState<Novel | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [outline, setOutline] = useState(''); // Chapter Outline
  const [workOutline, setWorkOutline] = useState(''); // Novel Work Outline
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [lastSavedContent, setLastSavedContent] = useState('');
  
  // Side Panel State
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);

  // Settings State
  const { theme, setTheme } = useTheme();
  const [fontSize, setFontSize] = useState<FontSize>('lg');
  const [fontFamily, setFontFamily] = useState<FontFamily>('serif');

  // Modals
  const [isWorkOutlineOpen, setIsWorkOutlineOpen] = useState(false);
  const [isChapterOutlineOpen, setIsChapterOutlineOpen] = useState(false);

  const contentRef = useRef(content);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep ref in sync
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Load Settings
  useEffect(() => {
    const savedFontSize = localStorage.getItem('editor-font-size') as FontSize;
    const savedFontFamily = localStorage.getItem('editor-font-family') as FontFamily;
    
    if (savedFontSize) setFontSize(savedFontSize);
    if (savedFontFamily) setFontFamily(savedFontFamily);
  }, []);

  const updateSetting = (key: string, value: string, setter: (val: any) => void) => {
    setter(value);
    localStorage.setItem(key, value);
  };

  // Fetch Chapter and Novel
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Chapter
        const chapterRes = await tasksAPI.getChapter(chapterId);
        const chapterData = chapterRes.data;
        
        setChapter(chapterData);
        setTitle(chapterData.title);
        // Ensure content has initial indent if empty? Maybe not enforced on load, only input.
        setContent(chapterData.content || '');
        setLastSavedContent(chapterData.content || '');
        setOutline(chapterData.outline || '');

        // 2. Fetch Novel Structure
        const novelRes = await novelsAPI.get(chapterData.novelId);
        const novelData = novelRes.data;
        setNovel(novelData);

        // 3. Fetch Outline Versions (if not included in novel response, try separate endpoint)
        // Attempt to get outline from novel data if available, or fetch
        if (novelData.outlineVersions && novelData.outlineVersions.length > 0) {
           // Sort by createdAt desc
           const sorted = [...novelData.outlineVersions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
           setWorkOutline(sorted[0].content);
        } else {
           // Try fetching separate endpoint if applicable
           try {
             const outlineRes = await novelsAPI.getOutlineVersions(chapterData.novelId);
             if (outlineRes.data && outlineRes.data.length > 0) {
                const sorted = [...outlineRes.data].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setWorkOutline(sorted[0].content);
             }
           } catch (e) {
             console.warn("Failed to fetch outline versions", e);
           }
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error('加载数据失败');
        setIsLoading(false);
      }
    };
    fetchData();
  }, [chapterId]);

  // Save Logic
  const saveContent = useCallback(async (manual = false) => {
    if (!chapter) return;
    
    if (!manual && contentRef.current === lastSavedContent) {
      if (manual) toast.success('已是最新内容');
      return;
    }

    setSaveStatus('saving');
    setIsSaving(true);
    
    try {
      await tasksAPI.updateChapter(chapter.id, {
        content: contentRef.current,
        title: title 
      });
      
      setLastSavedContent(contentRef.current);
      setSaveStatus('saved');
      if (manual) toast.success('保存成功');
    } catch (error) {
      console.error('Failed to save:', error);
      setSaveStatus('error');
      if (manual) toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  }, [chapter, lastSavedContent, title]);

  // Delayed Auto-save
  useEffect(() => {
    if (content !== lastSavedContent) {
      setSaveStatus('unsaved');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => saveContent(), 2000);
    }
    return () => {
       if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [content, lastSavedContent, saveContent]);

  // Shortcuts & Indentation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveContent(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveContent]);

  // Handle Textarea KeyDown for Indentation
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      
      // Insert newline + 2 full-width spaces
      const insertion = '\n\u3000\u3000';
      const newValue = value.substring(0, start) + insertion + value.substring(end);
      
      setContent(newValue);
      
      // Move cursor
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
      }, 0);
    }
  };

  const getTextareaClass = () => {
    const base = "w-full h-full p-8 md:p-12 lg:px-24 resize-none focus:outline-none bg-transparent leading-relaxed transition-all duration-300 selection:bg-primary/20";
    const font = fontFamily === 'mono' ? 'font-mono' : fontFamily === 'sans' ? 'font-sans' : 'font-serif';
    const size = fontSize === 'sm' ? 'text-base' : fontSize === 'base' ? 'text-lg' : fontSize === 'lg' ? 'text-xl' : 'text-2xl';
    return `${base} ${font} ${size}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-muted-foreground">
        <AlertCircle className="w-10 h-10 mb-2" />
        <p>章节不存在</p>
        <Button variant="link" onClick={() => router.back()}>返回</Button>
      </div>
    );
  }

  // Find Volume Name
  const currentVolume = novel?.volumes.find(v => v.id === chapter.volumeId);

  // Prepare sorted volumes for sidebar
  const sortedVolumes = novel?.volumes
    .sort((a, b) => a.order - b.order)
    .map(v => ({
      id: v.id,
      title: v.title,
      order: v.order,
      chapters: v.chapters
        .sort((a: any, b: any) => a.order - b.order)
        .map((c: any, index: number) => ({
          id: c.id,
          title: `第${c.order || index + 1}章 ${c.title}`, // Add Chapter Prefix
          volumeId: v.id
        }))
    })) || [];

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      
      {/* 1. Left Sidebar (Chapter List) - 260px */}
      <div 
        className={cn(
          "border-r border-border bg-background/50 backdrop-blur-sm transition-all duration-300 flex flex-col relative z-20",
          isLeftSidebarOpen ? "w-[260px]" : "w-0 opacity-0 overflow-hidden"
        )}
      >
        {novel && (
          <div className="flex-1 overflow-hidden">
             <div className="h-14 border-b border-border font-semibold truncate flex items-center gap-2 px-4 shrink-0">
                <BookOpen className="w-4 h-4 text-primary" />
                {novel.title}
             </div>
             <div className="flex-1 h-[calc(100%-53px)]">
                <ChapterListSidebar 
                  novelId={novel.id} 
                  volumes={sortedVolumes} // Pass sorted volumes
                  currentChapterId={chapter.id}
                  className="border-0 bg-transparent h-full"
                />
             </div>
          </div>
        )}
      </div>

      {/* 2. Center (Editor) - Flex 1 */}
      <div className="flex-1 flex flex-col h-full relative transition-all duration-300 min-w-0 bg-background">
        
        {/* Header */}
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-10 shrink-0">
          
          {/* Left: Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-hidden">
            <Button 
               variant="ghost" 
               size="icon" 
               onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} 
               className={cn("h-8 w-8 hover:bg-accent -ml-2", isLeftSidebarOpen && "bg-accent/50")}
            >
               <Menu className="w-4 h-4" />
            </Button>

            <Link href="/" className="hover:text-foreground hover:bg-accent rounded-md p-1 transition-colors">
              <Home className="w-4 h-4" />
            </Link>
            <ChevronRight className="w-3 h-3 opacity-50" />
            
            <Link href={`/novels/detail?id=${chapter.novelId}`} className="hover:text-foreground hover:underline truncate max-w-[120px]">
              {novel?.title || '...'}
            </Link>
            <ChevronRight className="w-3 h-3 opacity-50" />
            
            <span className="truncate max-w-[100px] opacity-80">
              {currentVolume?.title || '...'}
            </span>
            <ChevronRight className="w-3 h-3 opacity-50" />

            <span className="font-medium text-foreground truncate max-w-[150px]">
              {chapter.title}
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            
            {/* Outline Dialogs */}
            <div className="flex bg-muted/30 rounded-lg p-0.5 border border-border/50 mr-2">
               <Dialog open={isWorkOutlineOpen} onOpenChange={setIsWorkOutlineOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2.5">
                      作品大纲
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>作品大纲</DialogTitle>
                    </DialogHeader>
                    <div className="min-h-[200px] text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                       {workOutline || '暂无作品大纲內容'}
                    </div>
                  </DialogContent>
               </Dialog>
               <div className="w-px bg-border/50 my-1" />
               <Dialog open={isChapterOutlineOpen} onOpenChange={setIsChapterOutlineOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2.5">
                      章节大纲
                    </Button>
                  </DialogTrigger>
                   <DialogContent className="max-w-xl">
                    <DialogHeader>
                      <DialogTitle>本章大纲</DialogTitle>
                    </DialogHeader>
                    <div className="min-h-[200px] text-sm whitespace-pre-wrap leading-relaxed">
                       {outline || '暂无章节大纲'}
                    </div>
                  </DialogContent>
               </Dialog>
            </div>

            {/* Save Status */}
            <div className="flex items-center gap-1.5 text-xs px-2 border-r border-border/50 mr-1">
              {saveStatus === 'saved' && <CheckCircle className="w-3 h-3 text-muted-foreground" />}
              {saveStatus === 'saving' && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
              {saveStatus === 'unsaved' && <span className="w-2 h-2 rounded-full bg-amber-500" />}
              {saveStatus === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
              <span className="text-muted-foreground min-w-[3rem] text-right whitespace-nowrap">
                {content.length.toLocaleString()} 字
              </span>
            </div>

            {/* Settings */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Type className="w-4 h-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>显示设置</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <div className="p-3 space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-2 flex justify-between">
                      <span>主题</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                       <button onClick={() => setTheme('light')} 
                         className={cn("text-xs border rounded py-1.5", theme === 'light' ? 'bg-primary/10 border-primary font-medium' : 'hover:bg-accent')}
                       >亮色</button>
                       <button onClick={() => setTheme('dark')}
                         className={cn("text-xs border rounded py-1.5", theme === 'dark' ? 'bg-primary/10 border-primary font-medium' : 'hover:bg-accent')}
                       >暗色</button>
                    </div>
                  </div>

                  <div>
                     <div className="text-xs text-muted-foreground mb-2">字号</div>
                     <div className="flex gap-1 justify-between text-sm">
                       {['sm', 'base', 'lg', 'xl'].map((s) => (
                         <button key={s} onClick={() => updateSetting('editor-font-size', s, setFontSize)}
                           className={cn("px-2 py-1 rounded w-full border", fontSize === s ? 'bg-primary/10 border-primary font-medium' : 'hover:bg-accent border-transparent')}
                         >{s === 'sm' ? '小' : s === 'base' ? '中' : s === 'lg' ? '大' : '超'}</button>
                       ))}
                     </div>
                  </div>
                  
                  <div>
                     <div className="text-xs text-muted-foreground mb-2">字体</div>
                     <div className="flex flex-col gap-1">
                        <button onClick={() => updateSetting('editor-font-family', 'serif', setFontFamily)}
                          className={cn("text-left px-2 py-1.5 rounded text-xs font-serif flex justify-between border", fontFamily === 'serif' ? 'bg-primary/10 border-primary' : 'hover:bg-accent border-transparent')}
                        ><span>宋体 (Serif)</span> {fontFamily === 'serif' && <CheckCircle className="w-3 h-3" />}</button>
                        <button onClick={() => updateSetting('editor-font-family', 'sans', setFontFamily)}
                          className={cn("text-left px-2 py-1.5 rounded text-xs font-sans flex justify-between border", fontFamily === 'sans' ? 'bg-primary/10 border-primary' : 'hover:bg-accent border-transparent')}
                        ><span>黑体 (Sans)</span> {fontFamily === 'sans' && <CheckCircle className="w-3 h-3" />}</button>
                     </div>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Panel Toggle */}
            <Button 
              variant={isRightPanelOpen ? "secondary" : "ghost"} 
              size="icon" 
              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
              className="h-8 w-8 hover:bg-accent"
              title={isRightPanelOpen ? "收起面板" : "展开面板"}
            >
              {isRightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </Button>
            
            {/* Main Save Button */}
            <Button size="sm" onClick={() => saveContent(true)} disabled={isSaving} className="h-8 ml-1">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span className="ml-1.5 hidden sm:inline">保存</span>
            </Button>
          </div>
        </header>

        {/* Editor Area */}
        <main className="flex-1 overflow-hidden relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder="开始你的创作..."
            className={getTextareaClass()}
            spellCheck={false}
          />
        </main>
      </div>

      {/* 3. Right Panel (AI Assistant) - 350px */}
      <div 
        className={cn(
          "h-full border-l border-border bg-background transition-all duration-300 ease-in-out flex flex-col z-20",
          isRightPanelOpen ? "w-[350px]" : "w-0 opacity-0 overflow-hidden"
        )}
      >
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header for Right Panel */}
          <div className="h-14 border-b border-border flex items-center px-4 justify-between bg-muted/10 shrink-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                 <Sparkles className="w-4 h-4 text-primary" />
                 AI 助手
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsRightPanelOpen(false)} className="h-6 w-6 opacity-50 hover:opacity-100">
                <PanelRightClose className="w-3.5 h-3.5" />
              </Button>
          </div>
          
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
             <ChatPanel 
                 novelId={chapter.novelId} 
                 currentContent={content} 
                 className="h-full border-0 shadow-none bg-transparent"
                 showHeader={false}
              />
          </div>
        </div>
      </div>

    </div>
  );
}

export default function ChapterEditorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-background text-foreground">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>}>
      <ChapterEditor />
    </Suspense>
  );
}
