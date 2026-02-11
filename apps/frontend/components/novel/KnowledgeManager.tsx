'use client';

import { useState, useEffect } from 'react';
import { 
  Database, Upload, FileText, Trash2, Search, Plus, 
  ChevronRight, ArrowLeft, Info, 
  CheckCircle2, AlertCircle, Loader2, Sparkles, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { knowledgeAPI } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  type: string;
  documentCount?: number;
  documents?: any[];
}

interface Document {
  id: string;
  title: string;
  content: string;
  fileType: string;
  createdAt: string;
  similarity?: number;
}

const TYPE_LABELS: Record<string, string> = {
  general: '通用',
  worldview: '世界观',
  character: '人物关系',
  plot: '情节设定',
};

interface KnowledgeManagerProps {
  novelId: string;
  knowledgeBases: KnowledgeBase[];
  onUpdate: () => void;
}

export default function KnowledgeManager({ novelId, knowledgeBases, onUpdate }: KnowledgeManagerProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Document[] | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'general',
  });

  const [uploadData, setUploadData] = useState({
    title: '',
    file: null as File | null,
  });

  const handleCreateKB = async () => {
    if (!formData.name) {
      toast.error('请输入名称');
      return;
    }
    try {
      await knowledgeAPI.create(novelId, formData);
      setIsCreateModalOpen(false);
      setFormData({ name: '', description: '', type: 'general' });
      onUpdate();
      toast.success('知识库创建成功');
    } catch (error) {
      console.error('Failed to create KB:', error);
      toast.error('创建失败');
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedKB || !uploadData.file) return;

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', uploadData.file);
      formDataToSend.append('title', uploadData.title || uploadData.file.name);

      await knowledgeAPI.uploadDocument(novelId, selectedKB.id, formDataToSend);
      setIsUploadModalOpen(false);
      setUploadData({ title: '', file: null });
      loadDocuments(selectedKB.id);
      toast.success('文档上传成功');
      onUpdate();
    } catch (error) {
      console.error('Failed to upload document:', error);
      toast.error('上传失败');
    }
  };

  const loadDocuments = async (kbId: string) => {
    try {
      setSearchResults(null);
      setSearchQuery('');
      const res = await knowledgeAPI.getDocuments(novelId, kbId);
      setDocuments(res.data || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setDocuments([]);
    }
  };

  const handleDeleteKB = async (id: string) => {
    if (confirm('确定要删除这个知识库吗？所有文档也将被删除。')) {
      try {
        await knowledgeAPI.delete(novelId, id);
        if (selectedKB?.id === id) setSelectedKB(null);
        onUpdate();
        toast.success('知识库已删除');
      } catch (error) {
        toast.error('删除失败');
      }
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!selectedKB || !confirm('确定要删除这个文档吗？')) return;
    try {
      await knowledgeAPI.deleteDocument(novelId, selectedKB.id, docId);
      if (searchResults) {
        setSearchResults(searchResults.filter(d => d.id !== docId));
      } else {
        loadDocuments(selectedKB.id);
      }
      toast.success('文档已删除');
      onUpdate();
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const handleSearch = async () => {
    if (!selectedKB) return;
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    
    setIsSearching(true);
    try {
      const res = await knowledgeAPI.search(novelId, selectedKB.id, searchQuery);
      setSearchResults(res.data || []);
    } catch (error) {
      toast.error('搜索失败');
    } finally {
      setIsSearching(false);
    }
  };


  // Helper to get similarity badge color
  const getSimilarityColor = (score: number) => {
    if (score > 0.8) return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
    if (score > 0.5) return 'bg-amber-500/10 text-amber-600 border-amber-200';
    return 'bg-gray-500/10 text-gray-600 border-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* Upper Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/40 dark:bg-gray-900/40 p-4 rounded-2xl border border-white/20 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary-500/10 rounded-xl">
            <Database className="w-5 h-5 text-primary-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">知识库管理</h2>
            <p className="text-xs text-gray-500">构建专属创作资源，提升 AI 写作的一致性</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button size="sm" onClick={() => setIsCreateModalOpen(true)} className="rounded-xl shadow-lg shadow-primary-500/20">
            <Plus className="w-4 h-4 mr-2" />
            新建知识库
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Knowledge Base Sidebar/List */}
        <div className={cn(
          "lg:col-span-4 space-y-3 transition-all duration-300",
          selectedKB ? "hidden lg:block" : "col-span-12"
        )}>
          {knowledgeBases.length === 0 ? (
            <div className="text-center py-12 glass rounded-3xl border-dashed border-2 border-white/10">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-gray-400">尚无知识库，立即创建一个开始积累素材</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {knowledgeBases.map((kb) => (
                <motion.div
                  key={kb.id}
                  whileHover={{ y: -2, shadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "p-4 rounded-2xl border-2 transition-all duration-300 group relative overflow-hidden shadow-sm",
                    selectedKB?.id === kb.id 
                      ? "bg-primary-500 text-white border-primary-400 shadow-lg shadow-primary-500/30" 
                      : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-primary-500/50"
                  )}
                  onClick={() => {
                    setSelectedKB(kb);
                    loadDocuments(kb.id);
                  }}
                >
                  <div className="flex items-start space-x-4 relative z-10">
                    <div className={cn(
                      "p-3 rounded-xl transition-colors",
                      selectedKB?.id === kb.id ? "bg-white/20 text-white" : "bg-primary-50 text-primary-500 dark:bg-primary-900/30"
                    )}>
                      <Database className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold truncate text-sm sm:text-base">{kb.name}</h4>
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider",
                          selectedKB?.id === kb.id ? "bg-white/20" : "bg-gray-100 dark:bg-gray-700"
                        )}>
                          {TYPE_LABELS[kb.type] || kb.type}
                        </span>
                      </div>
                      <p className={cn(
                        "text-xs mt-1 line-clamp-1 opacity-70",
                        selectedKB?.id === kb.id ? "text-white/90" : "text-gray-500"
                      )}>
                        {kb.description || '无详细描述'}
                      </p>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-[10px] font-bold opacity-80">
                          <FileText className="w-3 h-3" />
                          <span>{kb.documents?.length ?? kb.documentCount ?? 0} 个文档</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteKB(kb.id);
                          }}
                          className={cn(
                            "p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100",
                            selectedKB?.id === kb.id ? "hover:bg-white/20 text-white" : "hover:bg-red-50 text-red-500"
                          )}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Subtle background decoration */}
                  {selectedKB?.id === kb.id && (
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                      <Sparkles className="w-12 h-12 rotate-12" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <AnimatePresence mode="wait">
          {selectedKB ? (
            <motion.div 
              key={selectedKB.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="lg:col-span-8 glass p-6 rounded-3xl border border-white/20 shadow-2xl space-y-6 min-h-[500px]"
            >
              {/* Detail Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => setSelectedKB(null)}
                    className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h3 className="text-xl font-bold flex items-center">
                      {selectedKB.name}
                      <Sparkles className="w-4 h-4 ml-2 text-primary-500" />
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {TYPE_LABELS[selectedKB.type] || selectedKB.type} • {documents.length} 个文档
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={() => setIsUploadModalOpen(true)} className="rounded-xl">
                  <Upload className="w-4 h-4 mr-2" />
                  上传文档
                </Button>
              </div>

              {/* Enhanced Search Bar */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none scale-110 group-focus-within:text-primary-500 transition-colors">
                  <Search className="w-4 h-4 text-gray-400 group-focus-within:text-primary-500" />
                </div>
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="语义搜索：输入问题或关键词，AI 将定位相关素材..."
                  className="pl-12 pr-24 py-6 rounded-2xl bg-gray-50/50 dark:bg-gray-900/50 border-white/10 focus:ring-primary-500 shadow-inner"
                />
                <div className="absolute inset-y-1 right-1">
                  <Button 
                    onClick={handleSearch} 
                    disabled={isSearching}
                    className="h-full px-6 rounded-xl shadow-lg"
                  >
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : '搜索'}
                  </Button>
                </div>
              </div>

              {/* Content Area */}
              <div className="space-y-4">
                {searchResults ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between px-2">
                      <h4 className="text-sm font-bold text-primary-500 flex items-center">
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI 语义匹配结果 ({searchResults.length})
                      </h4>
                      <button 
                        onClick={() => setSearchResults(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
                      >
                        清除结果 <X className="w-3 h-3 ml-1" />
                      </button>
                    </div>
                    {searchResults.length === 0 ? (
                      <div className="text-center py-10 opacity-50">
                        <AlertCircle className="w-10 h-10 mx-auto mb-2" />
                        <p className="text-sm">未找到高相关性的内容</p>
                      </div>
                    ) : (
                      searchResults.map((doc) => (
                        <motion.div
                          key={doc.id}
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="p-5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl relative group border-primary-500/50 transition-all shadow-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center space-x-3">
                                <span className={cn(
                                  "text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase",
                                  getSimilarityColor(doc.similarity || 0)
                                )}>
                                  相关度 {Math.round((doc.similarity || 0) * 100)}%
                                </span>
                                <h5 className="font-bold text-gray-900 dark:text-white truncate">{doc.title}</h5>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                                {doc.content}
                              </p>
                              <div className="flex items-center space-x-4 text-[10px] text-gray-400">
                                <span>{doc.fileType}</span>
                                <span>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '未知日期'}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="p-2 text-danger-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {/* Similarity indicator bar */}
                          <div className="absolute bottom-0 left-0 h-1 bg-primary-500/20 w-full rounded-b-2xl overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(doc.similarity || 0) * 100}%` }}
                              className="h-full bg-primary-500"
                            />
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {documents.length === 0 ? (
                      <div className="text-center py-20 opacity-30">
                        <FileText className="w-16 h-16 mx-auto mb-4" />
                        <p>该知识库暂无文档</p>
                      </div>
                    ) : (
                      documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl hover:border-primary-500 hover:shadow-md transition-all group shadow-sm"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gray-50 dark:bg-gray-700/50 rounded-xl flex items-center justify-center text-primary-500 border border-gray-100 dark:border-gray-600 shadow-inner">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white">
                                {doc.title}
                              </p>
                              <div className="flex items-center space-x-3 mt-1">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 font-bold uppercase tracking-wider">{doc.fileType}</span>
                                <span className="text-[10px] text-gray-400 font-medium">
                                  {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '未知日期'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all transform hover:scale-110"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="hidden lg:flex lg:col-span-8 h-full flex-col items-center justify-center text-center p-12 glass rounded-3xl border border-white/20 border-dashed"
            >
              <div className="w-20 h-20 bg-primary-500/10 rounded-full flex items-center justify-center mb-6">
                <Info className="w-10 h-10 text-primary-500 opacity-50" />
              </div>
              <h3 className="text-lg font-bold text-gray-400">请选择一个知识库</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-sm">
                选择后可在此管理文档内容，或使用 AI 通过语义搜索进行精准的信息召回
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal Definitions (Condensed same as original but with improved styling) */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="创建知识库">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-gray-500 mb-1">名称</label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="例如：世界观设定" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-gray-500 mb-1">描述</label>
            <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="描述用途..." />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-gray-500 mb-1">类型</label>
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full px-4 py-3 glass rounded-xl">
              <option value="general">通用</option>
              <option value="worldview">世界观</option>
              <option value="character">人物关系</option>
              <option value="plot">情节设定</option>
            </select>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleCreateKB}>创建库</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="上传文档">
        <div className="space-y-4">
          <Input value={uploadData.title} onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })} placeholder="标题（留空将使用文件名）" />
          <div className="p-8 border-2 border-dashed border-white/20 rounded-2xl text-center hover:border-primary-500/50 transition relative">
            <input type="file" accept=".txt,.md,.pdf,.docx" onChange={(e) => setUploadData({ ...uploadData, file: e.target.files?.[0] || null })} className="absolute inset-0 opacity-0 cursor-pointer" />
            <Upload className="w-10 h-10 mx-auto mb-2 text-primary-500" />
            <p className="text-sm font-medium">{uploadData.file ? uploadData.file.name : '点击或拖拽文件到此处'}</p>
            <p className="text-[10px] text-gray-500 mt-2">支持 TXT, MD, PDF, DOCX（最大 10MB）</p>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleUploadDocument} disabled={!uploadData.file}>开始上传</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
