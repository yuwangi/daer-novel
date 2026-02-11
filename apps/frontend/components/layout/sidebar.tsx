'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button'; // Assuming button exists, if not I'll use raw generic styles or create it.
// Actually I don't see a button component in the listed files, so I will likely need to create one or use standard HTML.
// Checking previous file list... `apps/frontend/api.ts` exists. Layout exists. 
// I will use standard standard Tailwind classes for now to be safe.

import { 
  LayoutDashboard, 
  BookOpen, 
  Library, 
  Settings, 
  PenTool,
  Sparkles
} from 'lucide-react';

const sidebarItems = [
  {
    title: '概览',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: '藏书阁',
    href: '/novels',
    icon: BookOpen,
  },
  {
    title: '知识库',
    href: '/knowledge',
    icon: Library,
  },
  {
    title: '系统设置',
    href: '/settings',
    icon: Sparkles,
  },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <div className={cn("pb-12  w-64 border-r bg-background/50 backdrop-blur-xl hidden md:block", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight text-gradient">
            创作中心
          </h2>
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-all duration-200",
                  pathname === item.href 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.title}
              </Link>
            ))}
          </div>
        </div>
        
       
      </div>
    </div>
  );
}
