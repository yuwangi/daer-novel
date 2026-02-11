'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Folder, 
  Plus, 
  Search,
  MoreVertical 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Chapter {
  id: string;
  title: string;
  volumeId: string;
}

interface Volume {
  id: string;
  title: string;
  chapters: Chapter[];
}

interface ChapterListSidebarProps {
  novelId: string;
  volumes: Volume[];
  currentChapterId: string;
  className?: string;
  onCreateChapter?: (volumeId: string) => void;
}

export function ChapterListSidebar({ 
  novelId, 
  volumes, 
  currentChapterId, 
  className,
  onCreateChapter 
}: ChapterListSidebarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVolumes, setExpandedVolumes] = useState<Record<string, boolean>>(
    volumes.reduce((acc, vol) => ({ ...acc, [vol.id]: true }), {})
  );

  const toggleVolume = (volumeId: string) => {
    setExpandedVolumes(prev => ({
      ...prev,
      [volumeId]: !prev[volumeId]
    }));
  };

  const filteredVolumes = useMemo(() => {
    if (!searchQuery.trim()) return volumes;
    
    return volumes.map(vol => ({
      ...vol,
      chapters: vol.chapters.filter(ch => 
        ch.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(vol => vol.chapters.length > 0 || vol.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [volumes, searchQuery]);

  return (
    <div className={cn("flex flex-col h-full border-r border-border bg-background/50 backdrop-blur-xl", className)}>
      {/* Search Header */}
      <div className="p-4 border-b border-border space-y-4">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索章节..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 bg-background/50"
          />
        </div>
      </div>

      {/* Chapter List */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {filteredVolumes.map(volume => (
            <div key={volume.id} className="space-y-1">
              {/* Volume Header */}
              <div 
                className="flex items-center justify-between px-2 py-1.5 hover:bg-accent/50 rounded-md cursor-pointer group"
                onClick={() => toggleVolume(volume.id)}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {expandedVolumes[volume.id] ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <Folder className="h-4 w-4 text-primary/70 shrink-0" />
                  <span className="text-sm font-medium truncate select-none">{volume.title}</span>
                </div>
                
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateChapter?.(volume.id);
                    }}
                    title="新建章节"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Chapters */}
              {expandedVolumes[volume.id] && (
                <div className="ml-4 pl-2 border-l border-border/50 space-y-0.5">
                  {volume.chapters.map(chapter => (
                    <div
                      key={chapter.id}
                      onClick={() => router.push(`/chapters/edit?id=${chapter.id}`)}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
                         chapter.id === currentChapterId 
                           ? "bg-primary/10 text-primary font-medium" 
                           : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{chapter.title}</span>
                    </div>
                  ))}
                  {volume.chapters.length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground/50 italic select-none">
                      暂无章节
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {filteredVolumes.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              未找到相关章节
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
