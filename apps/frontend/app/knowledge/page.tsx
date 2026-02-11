'use client';

import { useState, useEffect } from 'react';
import { Database, Search, Plus, Trash2, FileText, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { knowledgeAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

export default function KnowledgeBasePage() {
  const [knowledgeBases, setKnowledgeBases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  const fetchKnowledgeBases = async () => {
    try {
      setLoading(true);
      const res = await knowledgeAPI.listAll();
      setKnowledgeBases(res.data || []);
    } catch (error) {
      console.error('Failed to fetch KBs:', error);
      toast.error('加载知识库失败');
    } finally {
      setLoading(false);
    }
  };

  const filteredKBs = knowledgeBases.filter(kb => 
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kb.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-background flex flex-col">
      <Header />
      
      <div className="flex flex-1 container mx-auto px-4 md:px-6 py-6 gap-6">
        <Sidebar className="hidden lg:block w-64 shrink-0 rounded-2xl border bg-card/50 shadow-sm sticky top-20" />
        
        <main className="flex-1 space-y-8">
          <div className="container mx-auto py-0 px-0">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                  <Database className="w-8 h-8 mr-3 text-primary-500" />
                  知识库中心
                </h1>
                <p className="text-gray-500 mt-2">管理您的所有创作素材和设定，可在不同小说中复用。</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索知识库..."
                  className="pl-10"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
              </div>
            ) : filteredKBs.length === 0 ? (
              <div className="text-center py-20 glass rounded-2xl">
                <Database className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-xl font-medium text-gray-400">暂无匹配的知识库</p>
                <p className="text-sm text-gray-500 mt-2">在小说详情页可以创建和上传文档</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredKBs.map((kb) => (
                  <div key={kb.id} className="glass p-6 rounded-2xl shadow-xl transition-all duration-300 group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
                        <Database className="w-6 h-6 text-primary-500" />
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                        {kb.type === 'general' ? '通用' :
                         kb.type === 'worldview' ? '世界观' :
                         kb.type === 'character' ? '人物关系' :
                         kb.type === 'plot' ? '情节设定' : kb.type}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{kb.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 h-10">
                      {kb.description || '暂无描述'}
                    </p>
                    
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex items-center text-xs text-gray-400">
                        <FileText className="w-3 h-3 mr-1" />
                        {kb.documents?.length || 0} 个文档
                      </div>
                      <Link href={`/novels/detail?id=${kb.novelId}&tab=knowledge`}>
                        <Button variant="ghost" size="sm" className="group-hover:text-primary-500">
                          查看详情
                          <ArrowRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
