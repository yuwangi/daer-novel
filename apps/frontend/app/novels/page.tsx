'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { novelsAPI } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';

export default function NovelsPage() {
  const [novels, setNovels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNovels();
  }, []);

  const loadNovels = async () => {
    try {
      const response = await novelsAPI.list();
      setNovels(response.data);
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
            <Link href="/novels/new">
              <Button>
                <Plus className="w-5 h-5 mr-2" />
                创建作品
              </Button>
            </Link>
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {novels.map((novel) => (
              <Link key={novel.id} href={`/novels/detail?id=${novel.id}`} className="group block h-full">
                <Card className="h-full hover:border-primary/50 transition-all duration-300 group-hover:-translate-y-1">
                  <div className="p-6 h-full flex flex-col">
                    <div className="mb-4 flex-1">
                      <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors line-clamp-1">
                        {novel.title || '未命名小说'}
                      </h3>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {novel.genre?.slice(0, 3).map((g: string) => (
                          <span
                            key={g}
                            className="px-2.5 py-1 text-xs font-medium rounded-md bg-primary/5 text-primary-600 dark:text-primary-400 border border-primary/10"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        {novel.background || '暂无简介...'}
                      </p>
                    </div>
                    <div className="pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                      <span>目标 {formatNumber(novel.targetWords || 0)} 字</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
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
          </div>
        )}
        </main>
      </div>
    </div>
  );
}
