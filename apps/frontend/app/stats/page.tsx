"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { novelsAPI } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Target,
  BookOpen,
  TrendingUp,
  Award,
  Pencil,
  Check,
  X as XIcon,
  Trophy,
  Zap,
  Flame,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ---- Types ----
interface Chapter {
  id: string;
  title: string;
  wordCount: number | null;
  order: number;
  status: string;
  updatedAt: string;
}

interface Volume {
  id: string;
  title: string;
  order: number;
  chapters: Chapter[];
}

interface Novel {
  id: string;
  title: string;
  targetWords: number | null;
  volumes: Volume[];
  updatedAt: string;
}

// ---- Helpers ----
const getTodayKey = () => new Date().toISOString().split("T")[0];

const getStoredGoal = (): number => {
  if (typeof window === "undefined") return 2000;
  return parseInt(localStorage.getItem("daily-word-goal") || "2000", 10);
};

const isToday = (dateString: string): boolean => {
  const today = new Date();
  const date = new Date(dateString);
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

// ---- Component ----
export default function StatsPage() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Daily goal state
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("2000");

  // Load data function - Optimized: uses single API call instead of N+1 requests
  const loadData = useCallback(async (showToast = false) => {
    if (showToast) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      // Use the optimized endpoint that returns all novels with volumes/chapters in one request
      const res = await novelsAPI.listWithDetails();
      setNovels(res.data || []);

      if (showToast) {
        toast.success("数据已刷新");
      }
    } catch (e) {
      console.error("Failed to load novels", e);
      if (showToast) {
        toast.error("刷新失败");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    setDailyGoal(getStoredGoal());
    setGoalInput(String(getStoredGoal()));
    loadData();
  }, [loadData]);

  // Refresh data when page becomes visible (user switches back to this tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadData]);

  const saveGoal = () => {
    const parsed = parseInt(goalInput, 10);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("请输入有效的字数目标");
      return;
    }
    setDailyGoal(parsed);
    localStorage.setItem("daily-word-goal", String(parsed));
    toast.success("每日目标已更新");
    setEditingGoal(false);
  };

  // ---- Aggregated Stats ----
  const allChapters = novels.flatMap(
    (n) => n.volumes?.flatMap((v) => v.chapters) || [],
  );
  const totalWords = allChapters.reduce(
    (sum, c) => sum + (c.wordCount || 0),
    0,
  );
  const totalChapters = allChapters.length;
  const completedChapters = allChapters.filter(
    (c) => c.status === "completed",
  ).length;
  const totalNovels = novels.length;

  // Calculate today's words from database (chapters updated today)
  const todayWords = useMemo(() => {
    return allChapters.reduce((sum, chapter) => {
      if (chapter.updatedAt && isToday(chapter.updatedAt)) {
        return sum + (chapter.wordCount || 0);
      }
      return sum;
    }, 0);
  }, [allChapters]);

  const goalProgress = Math.min(
    100,
    Math.round((todayWords / dailyGoal) * 100),
  );

  // Best chapter (highest word count)
  const bestChapter = allChapters.reduce<Chapter | null>((best, c) => {
    if (!best) return c;
    return (c.wordCount || 0) > (best.wordCount || 0) ? c : best;
  }, null);

  return (
    <div className="bg-background flex flex-col min-h-screen">
      <Header />
      <div className="flex flex-1 container mx-auto px-4 md:px-6 py-6 gap-6">
        <Sidebar className="hidden lg:block w-64 shrink-0 rounded-2xl border bg-card/50 shadow-sm sticky top-20 h-[calc(100vh-8rem)]" />

        <main className="flex-1 space-y-8">
          <div className="space-y-6 max-w-5xl">
            {/* Page title */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                  <BarChart3 className="w-8 h-8 mr-3 text-primary-500" />
                  写作统计
                </h1>
                <p className="text-gray-500 mt-2">
                  跟踪您的创作进度与写作目标，保持更新动力
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData(true)}
                disabled={isRefreshing || isLoading}
              >
                <RefreshCw
                  className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")}
                />
                刷新
              </Button>
            </div>

            {/* === Top stat cards === */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<BookOpen className="w-5 h-5 text-primary" />}
                label="创作总字数"
                value={totalWords.toLocaleString()}
                suffix="字"
                color="primary"
              />
              <StatCard
                icon={<Pencil className="w-5 h-5 text-violet-500" />}
                label="作品总数"
                value={String(totalNovels)}
                suffix="部"
                color="violet"
              />
              <StatCard
                icon={<Check className="w-5 h-5 text-green-500" />}
                label="已完成章节"
                value={`${completedChapters} / ${totalChapters}`}
                suffix=""
                color="green"
              />
              <StatCard
                icon={<Award className="w-5 h-5 text-amber-500" />}
                label="最长章节"
                value={(bestChapter?.wordCount || 0).toLocaleString()}
                suffix="字"
                color="amber"
              />
            </div>

            {/* === Daily Goal === */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-lg">今日写作目标</h2>
                </div>
                {!editingGoal ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => {
                      setGoalInput(String(dailyGoal));
                      setEditingGoal(true);
                    }}
                  >
                    修改目标
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      className="w-24 text-sm border border-border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveGoal();
                        if (e.key === "Escape") setEditingGoal(false);
                      }}
                      autoFocus
                    />
                    <Button size="sm" className="h-7 px-2" onClick={saveGoal}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setEditingGoal(false)}
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    今日已写{" "}
                    <strong className="text-foreground">
                      {todayWords.toLocaleString()}
                    </strong>{" "}
                    字
                  </span>
                  <span>
                    目标{" "}
                    <strong className="text-foreground">
                      {dailyGoal.toLocaleString()}
                    </strong>{" "}
                    字
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      goalProgress >= 100 ? "bg-green-500" : "bg-primary",
                    )}
                    style={{ width: `${goalProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={cn(
                      "font-medium",
                      goalProgress >= 100 ? "text-green-500" : "text-primary",
                    )}
                  >
                    {goalProgress >= 100 ? (
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5" />
                        目标达成！
                      </span>
                    ) : (
                      `${goalProgress}% · 还差 ${(dailyGoal - todayWords).toLocaleString()} 字`
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    注：字数来自今日更新的章节
                  </span>
                </div>
              </div>
            </div>

            {/* === Per-Novel Progress === */}
            {!isLoading && novels.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-lg">各作品进度</h2>
                </div>
                <div className="space-y-4">
                  {novels.map((novel) => {
                    const chapters =
                      novel.volumes?.flatMap((v) => v.chapters) || [];
                    const words = chapters.reduce(
                      (s, c) => s + (c.wordCount || 0),
                      0,
                    );
                    const target = novel.targetWords || 100000;
                    const percent = Math.min(
                      100,
                      Math.round((words / target) * 100),
                    );
                    const completedChs = chapters.filter(
                      (c) => c.status === "completed",
                    ).length;

                    return (
                      <div key={novel.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate max-w-[200px]">
                            {novel.title || "未命名作品"}
                          </span>
                          <span className="text-muted-foreground shrink-0 ml-2">
                            {words.toLocaleString()} / {target.toLocaleString()}{" "}
                            字 · {percent}%
                          </span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all duration-700"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>
                            {chapters.length} 章节 · {completedChs} 已完成
                          </span>
                          <span>{novel.volumes?.length || 0} 卷</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* === Chapter word count chart (bar chart via CSS) === */}
            {!isLoading && allChapters.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-lg">章节字数分布</h2>
                  <span className="text-xs text-muted-foreground ml-auto">
                    最近 30 章
                  </span>
                </div>
                <ChapterBarChart chapters={allChapters.slice(-30)} />
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3" />
                加载统计数据...
              </div>
            )}

            {!isLoading && novels.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                <BookOpen className="w-12 h-12 opacity-20" />
                <p>还没有任何作品，快去创作吧！</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ---- Sub-component: Stat Card ----
function StatCard({
  icon,
  label,
  value,
  suffix,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2 hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold">
        {value}
        {suffix && (
          <span className="text-base font-normal text-muted-foreground ml-1">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// ---- Sub-component: Chapter Bar Chart (pure CSS) ----
function ChapterBarChart({ chapters }: { chapters: Chapter[] }) {
  if (chapters.length === 0) return null;
  const maxWords = Math.max(...chapters.map((c) => c.wordCount || 0), 1);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-1 h-32 min-w-max px-1">
        {chapters.map((ch, i) => {
          const words = ch.wordCount || 0;
          const pct = Math.max(2, Math.round((words / maxWords) * 100));
          const isCompleted = ch.status === "completed";
          return (
            <div
              key={ch.id}
              className="flex flex-col items-center gap-1 group relative"
              style={{ minWidth: 20 }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-10">
                <div className="bg-popover border border-border rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                  <div className="font-medium">{ch.title}</div>
                  <div className="text-muted-foreground">
                    {words.toLocaleString()} 字
                  </div>
                </div>
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-border" />
              </div>
              {/* Bar */}
              <div
                className={cn(
                  "w-4 rounded-t transition-all duration-300",
                  isCompleted ? "bg-primary" : "bg-primary/30",
                )}
                style={{ height: `${pct}%` }}
              />
              {/* Chapter number */}
              <span className="text-[9px] text-muted-foreground">
                {ch.order || i + 1}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground pt-2 border-t border-border">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-primary inline-block" />
          已完成
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-primary/30 inline-block" />
          其他状态
        </span>
        <span className="ml-auto">最高 {maxWords.toLocaleString()} 字/章</span>
      </div>
    </div>
  );
}
