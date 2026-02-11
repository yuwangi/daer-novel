'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, ArrowLeft, Sparkles, ChevronRight, Wand2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { novelsAPI } from '@/lib/api';

const GENRES = ['玄幻', '奇幻', '都市', '仙侠', '科幻', '历史', '武侠', '游戏', '悬疑', '军事', '体育', '轻小说', '二次元', '现实', '短篇', '诸天无线'];
const STYLES = ['爽文', '热血', '轻松', '虐心', '搞笑', '治愈', '黑暗', '无敌流', '系统流', '无限流', '种田文', '凡人流', '重生', '穿越', '单女主', '多女主', '变身', '位面', '位面流', '快穿', '团宠', '马甲', '团控'];

export default function NewNovelPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    genre: [] as string[],
    style: [] as string[],
    targetWords: 200000,
    minChapterWords: 3000,
    background: '',
    worldSettings: {
      timeBackground: '',
      worldRules: [] as string[],
      powerSystem: '',
      forbiddenRules: [] as string[],
    },
  });

  const toggleSelection = (field: 'genre' | 'style', value: string) => {
    const current = formData[field];
    if (current.includes(value)) {
      setFormData({ ...formData, [field]: current.filter((v) => v !== value) });
    } else {
      setFormData({ ...formData, [field]: [...current, value] });
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await novelsAPI.create(formData);
      router.push(`/novels/detail?id=${response.data.id}`);
    } catch (error) {
      console.error('Failed to create novel:', error);
      alert('创建失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-6 md:px-8">
          <Link href="/novels" className="group flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors">
            <div className="rounded-full bg-secondary/20 p-1.5 group-hover:bg-secondary/30 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="font-medium">返回</span>
          </Link>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              创建新作品
            </h1>
          </div>
          <div className="w-20"></div> {/* Spacer for balance */}
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Progress System */}
        <div className="mb-12">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted rounded-full -z-10"></div>
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full -z-10 transition-all duration-500 ease-out"
              style={{ width: `${((step - 1) / 2) * 100}%` }}
            ></div>
            
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex flex-col items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-4 transition-all duration-300 ${
                    s <= step
                      ? 'bg-primary border-background text-primary-foreground shadow-glow scale-110'
                      : 'bg-muted border-background text-muted-foreground'
                  }`}
                >
                  {s}
                </div>
                <span className={`text-xs font-semibold uppercase tracking-wider ${
                  s <= step ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {s === 1 ? '基础设定' : s === 2 ? '世界观' : '确认创建'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Basic Info */}
        <div className={`transition-all duration-500 ${step === 1 ? 'opacity-100 translate-x-0' : 'hidden opacity-0 translate-x-10'}`}>
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-xl">
            <CardContent className="p-8 space-y-8">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">定义你的故事</h2>
                <p className="text-muted-foreground">
                  告诉 AI 你的构想，让 AI 为你构建宏大世界。
                </p>
              </div>

              <div className="grid gap-8">
                <div className="space-y-3">
                  <Label className="text-base">作品标题</Label>
                  <div className="relative">
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="输入标题或稍后使用 AI 生成"
                      className="h-14 pl-4 text-lg bg-background/50 border-input/50 focus:border-primary/50 focus:bg-background transition-all"
                    />
                    <div className="absolute right-3 top-3">
                      <Button size="sm" variant="ghost" className="h-8 text-xs text-primary bg-primary/10 hover:bg-primary/20">
                        <Sparkles className="w-3 h-3 mr-1" /> AI取名
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-base">小说类型</Label>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {GENRES.map((genre) => (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => toggleSelection('genre', genre)}
                          className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                            formData.genre.includes(genre)
                              ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105 font-semibold'
                              : 'bg-white dark:bg-muted/30 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5'
                          }`}
                        >
                          {genre}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base">风格标签</Label>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {STYLES.map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => toggleSelection('style', style)}
                          className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                            formData.style.includes(style)
                              ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105 font-semibold'
                              : 'bg-white dark:bg-muted/30 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8 p-6 bg-muted/30 rounded-2xl border border-border/50">
                  <div className="space-y-3">
                    <Label>预估总字数</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={formData.targetWords}
                        onChange={(e) => setFormData({ ...formData, targetWords: parseInt(e.target.value) })}
                        className="bg-background text-lg font-mono text-center tracking-wider"
                        min="10000"
                        step="10000"
                      />
                      <span className="text-muted-foreground font-medium w-8">字</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>单章最少字数</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={formData.minChapterWords}
                        onChange={(e) => setFormData({ ...formData, minChapterWords: parseInt(e.target.value) })}
                        className="bg-background text-lg font-mono text-center tracking-wider"
                        min="1000"
                        step="500"
                      />
                      <span className="text-muted-foreground font-medium w-8">字</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button 
                  onClick={() => setStep(2)} 
                  size="lg" 
                  className="px-8 text-base shadow-lg shadow-primary/20"
                >
                  下一步 <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step 2: Background */}
        <div className={`transition-all duration-500 ${step === 2 ? 'opacity-100 translate-x-0' : 'hidden opacity-0 translate-x-10'}`}>
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-xl">
            <CardContent className="p-8 space-y-8">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">构建世界观</h2>
                <p className="text-muted-foreground">
                  详细的设定能让 AI 生成的内容更加连贯。
                </p>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">背景设定与核心梗</Label>
                    <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10">
                      <Wand2 className="w-3 h-3 mr-1" /> AI 扩写
                    </Button>
                  </div>
                  <Textarea
                    value={formData.background}
                    onChange={(e) => setFormData({ ...formData, background: e.target.value })}
                    className="min-h-[160px] text-base leading-relaxed p-4 bg-background/50 border-input/50 focus:bg-background transition-all resize-y"
                    placeholder="描述这个世界的基本规则、主角的金手指、开局场景..."
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-base">时间背景</Label>
                    <Input
                      value={formData.worldSettings.timeBackground}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          worldSettings: { ...formData.worldSettings, timeBackground: e.target.value },
                        })
                      }
                      placeholder="例如：2077年赛博朋克..."
                      className="bg-background/50 border-input/50 focus:bg-background"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-base">力量与等级体系</Label>
                    <Input
                      value={formData.worldSettings.powerSystem}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          worldSettings: { ...formData.worldSettings, powerSystem: e.target.value },
                        })
                      }
                      placeholder="例如：黑铁 → 青铜 → 白银..."
                      className="bg-background/50 border-input/50 focus:bg-background"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)} size="lg" className="px-6">
                  上一步
                </Button>
                <Button 
                  onClick={() => setStep(3)} 
                  size="lg" 
                  className="px-8 text-base shadow-lg shadow-primary/20"
                >
                  下一步 <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step 3: Confirm */}
        <div className={`transition-all duration-500 ${step === 3 ? 'opacity-100 translate-x-0' : 'hidden opacity-0 translate-x-10'}`}>
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-xl">
            <CardContent className="p-8 space-y-8">
              <div className="text-center space-y-4 py-6">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight">准备就绪</h2>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">
                  我们将根据以上信息为您初始化小说并在后台启动 AI 辅助创作引擎。
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl bg-muted/40 border border-border/50">
                  <h3 className="font-semibold mb-4 flex items-center">
                    <BookOpen className="w-4 h-4 mr-2 text-primary" /> 
                    基础档案
                  </h3>
                   <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">书名</span>
                      <span className="font-medium">{formData.title || '待定'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">类型</span>
                      <span className="font-medium">{formData.genre.join(' + ') || '未设定'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">风格</span>
                      <span className="font-medium">{formData.style.join(' + ') || '未设定'}</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border/50 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">预估总字数</span>
                      <span className="font-medium">{formData.targetWords.toLocaleString()} 字</span>
                    </div>
                    <div className="flex justify-between">
                       <span className="text-muted-foreground">单章最少字数</span>
                       <span className="font-medium">{formData.minChapterWords.toLocaleString()} 字</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-muted/40 border border-border/50">
                   <h3 className="font-semibold mb-4 flex items-center">
                    <Sparkles className="w-4 h-4 mr-2 text-primary" /> 
                    设定概览
                  </h3>
                  <div className="space-y-3 text-sm">
                     <p className="text-muted-foreground line-clamp-3 italic">
                      &quot;{formData.background || '暂无详细设定...'}&quot;
                     </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)} size="lg" className="px-6">
                  上一步
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  size="lg" 
                  disabled={loading}
                  className="px-10 text-base shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <span className="animate-spin mr-2">⏳</span> 创建中...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      开始创作 <ChevronRight className="ml-1 w-4 h-4" />
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
