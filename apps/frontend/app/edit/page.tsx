'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Save, ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

function ChapterEdit() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const novelId = searchParams.get('novelId') as string;
  const chapterId = searchParams.get('chapterId') as string;

  const [chapter, setChapter] = useState<any>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadChapter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  const loadChapter = async () => {
    // TODO: API call to load chapter
    setChapter({
      id: chapterId,
      title: '第一章 少年林凡',
      content: '清晨的阳光透过窗棂，洒在少年的脸上...',
      wordCount: 3200,
    });
    setTitle('第一章 少年林凡');
    setContent('清晨的阳光透过窗棂，洒在少年的脸上...');
  };

  const handleSave = async () => {
    setSaving(true);
    // TODO: API call to save chapter
    console.log('Saving chapter:', { title, content });
    
    setTimeout(() => {
      setSaving(false);
      alert('保存成功！');
    }, 1000);
  };

  const handleRegenerate = async () => {
    if (!confirm('确定要重新生成吗？当前内容将被覆盖。')) return;
    
    setRegenerating(true);
    // TODO: API call to regenerate chapter
    console.log('Regenerating chapter:', chapterId);
    
    setTimeout(() => {
      setRegenerating(false);
      loadChapter();
    }, 3000);
  };

  const wordCount = content.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
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
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {wordCount.toLocaleString()} 字
              </span>
              <Button
                variant="ghost"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                {regenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    重新生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    重新生成
                  </>
                )}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    保存
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Editor */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-6 py-4 text-2xl font-bold glass rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="章节标题"
          />

          {/* Content Editor */}
          <div className="glass rounded-xl p-6">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[600px] bg-transparent focus:outline-none text-gray-800 dark:text-gray-200 leading-relaxed resize-none"
              placeholder="开始写作..."
            />
          </div>

          {/* Tips */}
          <div className="glass p-4 rounded-xl">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              💡 编辑提示
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• 使用 Ctrl+S (Mac: Cmd+S) 快速保存</li>
              <li>• 点击&quot;重新生成&quot;可以让 AI 重写整章</li>
              <li>• 建议每写 1000 字保存一次</li>
              <li>• 可以手动编辑 AI 生成的内容</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChapterEditPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">加载中...</div>}>
      <ChapterEdit />
    </Suspense>
  );
}
