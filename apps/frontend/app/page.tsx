'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, BookOpen, Sparkles, ArrowRight, Clock } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { novelsAPI } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const [novels, setNovels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentNovels();
  }, []);

  const loadRecentNovels = async () => {
    try {
      const response = await novelsAPI.list();
      // Take top 6 recent novels
      setNovels(response.data.slice(0, 6));
    } catch (error) {
      console.error('Failed to load novels:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background flex flex-col">
      <Header />
      
      <div className="flex flex-1 container mx-auto px-4 md:px-6 py-6 gap-6">
        <Sidebar className="hidden lg:block w-64 shrink-0 rounded-2xl border bg-card/50 shadow-sm sticky top-20" />
        
        <main className="flex-1 space-y-8">
          {/* Hero Banner -  Style */}
          <section className="container px-4 md:px-6 relative z-10">
            <div className="text-center">
              <div className="relative overflow-hidden rounded-2xl bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 p-6 text-gray-900 dark:text-white shadow-lg dark:shadow-2xl ring-1 ring-gray-900/5 dark:ring-white/20 transition-all hover:scale-[1.002] hover:shadow-primary/10">
                {/* Inner Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />
                
                <div className="relative z-10 space-y-4">
                  <div className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-white/10 px-2.5 py-0.5 text-xs font-medium backdrop-blur-md border border-indigo-100 dark:border-white/20 text-indigo-600 dark:text-indigo-100">
                    <Sparkles className="mr-1 h-3 w-3 text-indigo-500 dark:text-yellow-300" />
                    多智能体矩阵已就绪
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight md:text-3xl lg:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-indigo-800 to-gray-900 dark:from-white dark:via-indigo-100 dark:to-white">
                    开始新的创作旅程
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-indigo-200/80 md:text-base ">
                    利用多智能体协作，从灵感瞬间孵化出千万字神作。
                    大纲、人设、世界观，一键生成。
                  </p>
                  
                  <div className="flex flex-wrap justify-center gap-3 pt-1">
                    <Link
                      href="/novels/new"
                      className="group inline-flex items-center justify-center rounded-lg bg-indigo-600 dark:bg-white px-5 py-2 text-sm font-medium text-white dark:text-indigo-600 transition-all hover:bg-indigo-700 dark:hover:bg-indigo-50 hover:shadow-md shadow-indigo-500/20 dark:shadow-none"
                    >
                      <Plus className="mr-1.5 h-4 w-4 transition-transform group-hover:rotate-90" />
                      新建作品
                    </Link>
                    <Link
                      href="/novels"
                      className="inline-flex items-center justify-center rounded-lg bg-white/60 dark:bg-white/5 px-5 py-2 text-sm font-medium text-gray-700 dark:text-white backdrop-blur-sm border border-gray-200/60 dark:border-white/10 transition-all hover:bg-white dark:hover:bg-white/10"
                    >
                      <BookOpen className="mr-1.5 h-4 w-4" />
                      浏览作品
                    </Link>
                  </div>
                </div>
                
                {/* Abstract Background Decoration - More subtle */}
                <div className="absolute -right-10 -top-10 z-0 h-48 w-48 rounded-full bg-indigo-500/5 dark:bg-white/5 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-10 right-10 z-0 h-40 w-40 rounded-full bg-purple-500/5 dark:bg-purple-500/10 blur-2xl animate-float pointer-events-none" />
              </div>
            </div>
          </section>

          {/* Recent Projects Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-bold text-foreground">近期项目</h2>
              </div>
              <Link href="/novels" className="text-sm font-medium text-primary hover:text-primary-700 flex items-center">
                查看全部 <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>

            {/* Projects Grid */}
            {loading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                 {[1, 2, 3].map((i) => (
                    <div key={i} className="h-48 rounded-2xl bg-card/50 animate-pulse border border-border/40" />
                 ))}
              </div>
            ) : novels.length === 0 ? (
               <div className="text-center py-12 rounded-2xl border border-dashed border-border/60 bg-card/30">
                 <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                   <BookOpen className="w-8 h-8 text-primary" />
                 </div>
                 <h3 className="text-lg font-medium mb-2">暂无作品</h3>
                 <p className="text-sm text-muted-foreground mb-6">开始创作你的第一部小说吧</p>
                 <Link href="/novels/new">
                   <Button variant="outline">立即创建</Button>
                 </Link>
               </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {novels.map((novel) => (
                  <Link key={novel.id} href={`/novels/detail?id=${novel.id}`} className="group block h-full">
                    <Card className="h-full hover:border-primary/50 transition-all duration-300 group-hover:-translate-y-1 bg-card/80 backdrop-blur-sm">
                      <div className="p-6 h-full flex flex-col">
                        <div className="mb-4 flex-1">
                          <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-1">
                            {novel.title || '未命名小说'}
                          </h3>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {novel.genre?.slice(0, 2).map((g: string) => (
                              <span
                                key={g}
                                className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-primary/5 text-primary-600 dark:text-primary-400 border border-primary/10"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed h-8">
                            {novel.background || '暂无简介...'}
                          </p>
                        </div>
                        <div className="pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatNumber(novel.targetWords || 0)} 字</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            novel.status === 'completed' ? 'bg-green-500/10 text-green-600' :
                            novel.status === 'generating' ? 'bg-blue-500/10 text-blue-600' :
                            'bg-yellow-500/10 text-yellow-600'
                          }`}>
                            {novel.status === 'completed' ? '已完成' :
                             novel.status === 'generating' ? '生成中' : '草稿'}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}

                {/* Always show "Create New" card if there are less than 6 items */}
                {novels.length < 6 && (
                    <Link href="/novels/new" className="group flex flex-col items-center justify-center rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/30 p-6 transition-all hover:border-primary/50 hover:bg-accent/50 min-h-[180px]">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm group-hover:scale-110 transition-transform">
                        <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <p className="font-medium text-muted-foreground group-hover:text-primary">创建新作品</p>
                    </Link>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
