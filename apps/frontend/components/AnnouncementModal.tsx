'use client';

import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogClose 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageSquare, Lightbulb, Bug, Share2, Info, X } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import Image from 'next/image';

export function AnnouncementModal() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!session) return;

    const dismissedForever = localStorage.getItem('announcement-dismissed-forever');
    const dismissedToday = localStorage.getItem('announcement-dismissed-today');
    const today = new Date().toDateString();

    if (dismissedForever === 'true') return;
    if (dismissedToday === today) return;

    // Show after a short delay to ensure layout is ready
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, [session]);

  const handleDismissToday = () => {
    localStorage.setItem('announcement-dismissed-today', new Date().toDateString());
    setIsOpen(false);
  };

  const handleDismissForever = () => {
    localStorage.setItem('announcement-dismissed-forever', 'true');
    setIsOpen(false);
  };

  if (!session) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-primary-50 to-violet-50 dark:from-primary-950/30 dark:to-violet-950/30 p-8 text-center relative">
          <DialogTitle className="text-2xl md:text-3xl font-bold text-primary-900 dark:text-primary-100 flex items-center justify-center gap-3">
            <span role="img" aria-label="party">🎉</span> 欢迎使用 Daer Novel 创作助手
          </DialogTitle>
        </div>

        <div className="p-8 space-y-8">
          {/* Welcome Message & Features */}
          <div className="space-y-6">
            <p className="text-center text-lg font-medium text-gray-700 dark:text-gray-300">
              <span role="img" aria-label="hand">👋</span> 欢迎加入我们的交流群！在这里你可以：
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
              <li className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <span className="text-sm">与其他创作者交流心得</span>
              </li>
              <li className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <span className="text-sm">获取最新功能更新和技巧</span>
              </li>
              <li className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600">
                  <Bug className="w-4 h-4" />
                </div>
                <span className="text-sm">反馈问题和建议</span>
              </li>
              <li className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
                  <Share2 className="w-4 h-4" />
                </div>
                <span className="text-sm">分享创作经验和灵感</span>
              </li>
            </ul>
          </div>

          {/* QR Codes Section */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-8 text-center space-y-6">
             <h4 className="font-bold text-gray-900 dark:text-gray-100">扫描下方二维码加入交流群：</h4>
             <div className="flex flex-col sm:flex-row justify-center items-center gap-12">
                <div className="space-y-4">
                   <p className="text-sm font-semibold text-gray-500">微信交流群</p>
                   <div className="relative w-40 h-40 bg-white p-2 rounded-xl shadow-md mx-auto group">
                      {/* Using a placeholder for now as requested */}
                      <div className="w-full h-full bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200">
                         <Image 
                           src="/qun.png" 
                           alt="wx QR" 
                           fill 
                           className="object-contain p-1" 
                           onError={(e) => {
                             // Fallback if image not found
                             (e.target as any).style.display = 'none';
                           }}
                         />
                         <span className="text-[10px] text-gray-400 px-4 text-center group-hover:hidden">请将图片放在 public/qq-qr.png</span>
                      </div>
                   </div>
                </div>
                <div className="space-y-4">
                   <p className="text-sm font-semibold text-gray-500">微信</p>
                   <div className="relative w-40 h-40 bg-white p-2 rounded-xl shadow-md mx-auto group">
                      <div className="w-full h-full bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200">
                        <Image 
                           src="/my.png" 
                           alt="WeChat QR" 
                           fill 
                           className="object-contain p-1" 
                           onError={(e) => {
                             (e.target as any).style.display = 'none';
                           }}
                         />
                         <span className="text-[10px] text-gray-400 px-4 text-center group-hover:hidden">请将图片放在 public/wechat-qr.png</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* Tip Section */}
          <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4 flex items-start gap-3">
             <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
             <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                提示：选择“今日内不再展示”当天不再显示，选择“永不再展示”将永久隐藏此公告。您之后的个人资料页或帮助文档中也可以找到群组信息。
             </p>
          </div>

          {/* Footer Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
             <Button 
               className="flex-1 h-12 rounded-xl shadow-lg shadow-primary/20"
               onClick={handleDismissForever}
             >
               永不再展示
             </Button>
              <Button 
               variant="outline" 
               className="flex-1 h-12 rounded-xl text-gray-500 hover:text-gray-900"
               onClick={handleDismissToday}
             >
               今日内不再展示
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
