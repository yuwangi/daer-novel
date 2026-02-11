'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BookOpen, ArrowLeft, Settings, ChevronLeft, ChevronRight, Type, Moon, Sun, Monitor } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

function ChapterRead() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const novelId = searchParams.get('novelId') as string;
  const chapterId = searchParams.get('chapterId') as string;

  const [chapter, setChapter] = useState<any>(null);
  const [novel, setNovel] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadChapter = async () => {
    // TODO: API call to load chapter
    setChapter({
      id: chapterId,
      title: '第一章 少年林凡',
      content: `
        清晨的阳光透过窗棂，洒在少年的脸上。

        林凡缓缓睁开双眼，望着熟悉的茅草屋顶，心中涌起一股难以言说的情绪。

        "又是新的一天。"他轻声自语，翻身下床。

        作为青云村最普通的少年，林凡从小就知道，修仙之路对他来说遥不可及。村里的孩子们都曾被仙门测试过灵根，而他，却是那个被判定为"无灵根"的废材。

        但林凡从未放弃。

        他相信，只要足够努力，总有一天能够改变命运。

        推开木门，清新的空气扑面而来。远处的青云山脉在晨雾中若隐若现，那里，正是仙门所在之地。

        "总有一天，我会站在那山巅之上。"林凡握紧拳头，眼中闪过一丝坚定。

        就在这时，天空突然传来一声巨响...
      `.trim(),
      wordCount: 3200,
      order: 1,
    });
    setNovel({
      id: novelId,
      title: '修仙传',
    });
    setLoading(false);
  };

  useEffect(() => {
    loadChapter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-white/20">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/novels/detail?id=${novelId}`}
              className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-primary-500"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回</span>
            </Link>
            <div className="flex items-center space-x-3">
              <BookOpen className="w-6 h-6 text-primary-500" />
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                {novel?.title}
              </h1>
            </div>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Chapter Title */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {chapter.title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {chapter.wordCount.toLocaleString()} 字
            </p>
          </div>

          {/* Chapter Content */}
          <div className="glass p-8 md:p-12 rounded-2xl">
            <div className="prose prose-lg dark:prose-invert max-w-none">
              {chapter.content.split('\n\n').map((paragraph: string, i: number) => (
                <p key={i} className="mb-6 leading-relaxed text-gray-800 dark:text-gray-200">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-12">
            <Button variant="secondary">
              <ChevronLeft className="w-5 h-5 mr-2" />
              上一章
            </Button>
            <Link href={`/novels/detail?id=${novelId}`}>
              <Button variant="ghost">目录</Button>
            </Link>
            <Button variant="secondary">
              下一章
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChapterReadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">加载中...</div>}>
      <ChapterRead />
    </Suspense>
  );
}
