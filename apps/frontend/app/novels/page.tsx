'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { BookOpen, Plus, Upload, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { novelsAPI } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';

export default function NovelsPage() {
  const { data, isLoading, mutate } = useSWR('/api/novels', () =>
    novelsAPI.list().then((r) => r.data)
  );
  const novels: any[] = data ?? [];
  const loading = isLoading;

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`确定要删除小说《${title}》吗？此操作不可撤销。`)) {
      try {
        await novelsAPI.delete(id);
        mutate(); // refresh from cache
      } catch (error) {
        alert('删除失败');
      }
    }
  };

  const [importing, setImporting] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      
      if (ext === 'json') {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const content = JSON.parse(event.target?.result as string);
            const shouldInitialize = confirm('是否要使用 AI 初始化小说内容（生成大纲、章节以及人设卡）？');
            
        await novelsAPI.import({ ...content, initialize: !!shouldInitialize });
            alert('导入成功！');
            mutate();
          } catch (err) {
            alert('导入失败：文件格式不正确');
          } finally {
            setImporting(false);
          }
        };
        reader.readAsText(file);
      } else if (ext === 'txt' || ext === 'epub') {
        const formData = new FormData();
        formData.append('file', file);
        
        await novelsAPI.import(formData);
        alert('导入成功！AI 正在后台初始化小说内容，请稍后刷新。');
        mutate();
        setImporting(false);
      } else {
        alert('不支持的文件格式');
        setImporting(false);
      }
    } catch (err) {
      console.error('Import error:', err);
      alert('导入失败');
      setImporting(false);
    }
  };

  return (
    <div className="bg-background flex flex-col">
      <Header />

      <div className="flex flex-1 container mx-auto px-4 md:px-6 py-6 gap-6">
        <Sidebar className="hidden lg:block w-64 shrink-0 rounded-2xl border bg-card/50 shadow-sm sticky top-20" />

        <main className="flex-1 space-y-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                <BookOpen className="w-8 h-8 mr-3 text-primary-500" />
                藏书阁
              </h1>
              <p className="text-gray-500 mt-2">
                管理您的所有创作作品，共 {novels.length} 部作品
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <input
                  type="file"
                  accept=".json,.txt,.epub"
                  onChange={handleImport}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={importing}
                />
                <Button variant="outline" disabled={importing}>
                  {importing ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 mr-2" />
                  )}
                  导入小说
                </Button>
              </div>
              <Link href="/novels/new">
                <Button>
                  <Plus className="w-5 h-5 mr-2" />
                  创建作品
                </Button>
              </Link>
            </div>
          </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-shimmer h-48 bg-card/50" />
            ))}
          </div>
        ) : novels.length === 0 ? (
          <div className="text-center py-20 bg-card/50 rounded-3xl border border-dashed border-border/50">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              还没有小说
            </h3>
            <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
              开始创作你的第一部 AI 小说吧！多智能体将协助你完成从大纲到正文的所有工作。
            </p>
            <Link href="/novels/new">
              <Button size="lg" className="shadow-lg shadow-primary/20">
                <Plus className="w-5 h-5 mr-2" />
                创建小说
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {novels.map((novel) => (
              <Link key={novel.id} href={`/novels/detail?id=${novel.id}`} className="group block">
                <Card className="overflow-hidden hover:border-primary/50 transition-all duration-500 group-hover:shadow-xl flex h-72 group-hover:-translate-y-1 bg-card/60 backdrop-blur-sm">
                  {/* Novel Cover Area - Expanded View */}
                  <div className="w-44 h-full bg-muted relative overflow-hidden shrink-0 border-r border-border/50">
                    {novel.coverUrl ? (
                      <img 
                        src={novel.coverUrl.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'}${novel.coverUrl}` : novel.coverUrl} 
                        alt={novel.title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/10 to-primary/5 select-none text-center">
                        <BookOpen className="w-14 h-14 text-primary/20 mb-3" />
                        <span className="text-xs font-bold text-primary/40 line-clamp-2 px-2">
                          {novel.title || '未命名'}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-7 flex-1 flex flex-col min-w-0">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-2xl font-black text-foreground group-hover:text-primary transition-colors line-clamp-1 flex-1 leading-tight tracking-tight">
                          {novel.title || '未命名小说'}
                        </h3>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 -mt-1 -mr-1"
                          onClick={(e) => handleDelete(e, novel.id, novel.title)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {novel.genre?.slice(0, 3).map((g: string) => (
                          <span
                            key={g}
                            className="px-3 py-1 text-xs font-bold rounded-lg bg-primary/10 text-primary border border-primary/20"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed font-medium">
                        {novel.background || '暂无简介。这部由 AI 协助创作的小说正在构建中，精彩内容即将开启...'}
                      </p>
                    </div>
                    <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-1">目标字数</span>
                          <span className="font-bold text-foreground/80 text-sm">{formatNumber(novel.targetWords || 0)}</span>
                        </div>
                        <span className="w-px h-8 bg-border/60" />
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-1">开始创作</span>
                          <span className="font-bold text-foreground/80 text-sm">{new Date(novel.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                        novel.status === 'completed' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                        novel.status === 'generating' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                        'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                      }`}>
                        {novel.status === 'completed' ? '已完成' :
                         novel.status === 'generating' ? '生成中' : '草稿'}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
        </main>
      </div>
    </div>
  );
}
