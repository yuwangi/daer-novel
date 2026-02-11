'use client';

import { useState, useEffect } from 'react';
import { Settings, Key, Zap, CheckCircle, AlertCircle, Loader2, Trash2, User, Layout, Info, Pencil, X, Eye, EyeOff, Sparkles } from 'lucide-react';
import { authClient, useSession } from '@/lib/auth-client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import Link from 'next/link';
import { BookOpen, ArrowLeft, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { aiConfigAPI } from '@/lib/api';
import Image from 'next/image';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const [formData, setFormData] = useState({
    provider: 'openai',
    model: 'gpt-4',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    temperature: 0.7,
    maxTokens: 4000,
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await aiConfigAPI.list();
      setConfigs(response.data);
    } catch (error) {
      console.error('Failed to load configs:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!formData.apiKey) {
      toast.error('请先输入 API 密钥');
      return;
    }
    
    setTestStatus('testing');
    
    // Simulate connection test
    setTimeout(() => {
      if (formData.apiKey && formData.model) {
        setTestStatus('success');
        toast.success('连接测试成功');
        setTimeout(() => setTestStatus('idle'), 3000);
      } else {
        setTestStatus('error');
        toast.error('连接失败，请检查配置');
      }
    }, 1500);
  };

  const handleSaveConfig = async () => {
    if (!formData.apiKey || !formData.model) {
      toast.error('请填写完整配置信息');
      return;
    }

    const payload = {
      provider: formData.provider,
      model: formData.model,
      apiKey: formData.apiKey,
      baseUrl: formData.baseUrl,
      parameters: {
        temperature: formData.temperature,
        maxTokens: formData.maxTokens,
      },
      isDefault: configs.length === 0 ? 1 : 0,
    };

    setLoading(true);
    try {
      if (editingId) {
        // For update, exclude isDefault to avoid resetting it (unless we want to support changing default here)
        // But for now, let's just send the fields we edit
        const { isDefault, ...updatePayload } = payload;
        await aiConfigAPI.update(editingId, updatePayload);
        toast.success('配置更新成功');
      } else {
        await aiConfigAPI.create(payload);
        toast.success('配置保存成功');
      }
      await loadConfigs();
      handleCancelEdit();
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error(editingId ? '更新失败，请重试' : '保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleEditConfig = (config: any) => {
    setEditingId(config.id);
    setFormData({
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || '',
      temperature: config.parameters?.temperature || 0.7,
      maxTokens: config.parameters?.maxTokens || 4000,
    });
    // Scroll to top of the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({
      provider: 'openai',
      model: 'gpt-4',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      temperature: 0.7,
      maxTokens: 4000,
    });
  };

  const handleDeleteConfig = async (id: string) => {
    if (confirm('确定要删除此配置吗？')) {
      try {
        await aiConfigAPI.delete(id);
        loadConfigs();
        toast.success('配置已删除');
      } catch (error) {
        toast.error('删除失败');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900/50">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-gray-100 dark:border-gray-800 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/novels" className="flex items-center space-x-2 text-gray-500 hover:text-primary-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>返回创作</span>
            </Link>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
                <Settings className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
                系统设置
              </h1>
            </div>
            <div className="w-24"></div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Tabs defaultValue="profile" className="w-full">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 flex-shrink-0">
              <Card className="p-2 sticky top-24 overflow-hidden border-border/50">
                <TabsList className="flex flex-col h-auto w-full bg-transparent p-0 space-y-1">
                  <TabsTrigger value="profile" className="w-full justify-start px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all hover:bg-muted/50">
                    <User className="w-4 h-4 mr-3" />
                    个人资料
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="w-full justify-start px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all hover:bg-muted/50">
                    <Zap className="w-4 h-4 mr-3" />
                    AI 模型配置
                  </TabsTrigger>
                  <TabsTrigger value="about" className="w-full justify-start px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all hover:bg-muted/50">
                    <Info className="w-4 h-4 mr-3" />
                    关于系统
                  </TabsTrigger>
                </TabsList>
              </Card>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Profile Tab */}
              <TabsContent value="profile">
                <Card className="p-6 md:p-8">
                  <div className="flex items-center space-x-4 mb-8">
                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center text-3xl font-bold text-primary-600 dark:text-primary-300">
                      {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {session?.user?.name || '未知用户'}
                      </h2>
                      <p className="text-gray-500 dark:text-gray-400">
                        {session?.user?.email}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        笔名
                      </label>
                      <Input value={session?.user?.name || ''} disabled />
                      <p className="text-xs text-gray-500 mt-1">笔名暂不支持修改</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        邮箱地址
                      </label>
                      <Input value={session?.user?.email || ''} disabled />
                      
                      {/* Email Verification Status */}
                      <div className="mt-2 flex items-center justify-between">
                        {session?.user?.emailVerified ? (
                          <div className="flex items-center text-green-600 dark:text-green-400 text-sm font-medium">
                            <CheckCircle className="w-4 h-4 mr-1.5" />
                            邮箱已验证
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center text-amber-600 dark:text-amber-400 text-sm font-medium">
                              <AlertCircle className="w-4 h-4 mr-1.5" />
                              邮箱未验证
                            </div>
                            <Button 
                              variant="link" 
                              size="sm" 
                              className="h-auto p-0 text-primary-600 hover:text-primary-700 font-semibold"
                              onClick={async () => {
                                try {
                                  const { error } = await authClient.sendVerificationEmail({
                                    email: session?.user?.email || '',
                                  });
                                  if (error) throw error;
                                  toast.success('验证邮件已发送，请查收');
                                } catch (err) {
                                  toast.error('发送验证邮件失败');
                                }
                              }}
                            >
                              立即验证
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                       <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => authClient.signOut()}>
                         退出登录
                       </Button>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* AI Config Tab */}
              <TabsContent value="ai">
                 <div className="space-y-6">
                    <Card className="p-6">
                      <div className="flex items-center space-x-3 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                        <Zap className="w-5 h-5 text-primary-500" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                          {editingId ? '编辑配置' : '添加新配置'}
                        </h2>
                      </div>
                      
                      <div className="grid gap-6">
                         <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                AI 提供商
                              </label>
                              <select
                                value={formData.provider}
                                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                              >
                                <option value="openai">OpenAI</option>
                                <option value="anthropic">Anthropic (Claude)</option>
                                <option value="deepseek">DeepSeek</option>
                              </select>
                            </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                 模型名称
                               </label>
                               <Input
                                 value={formData.model}
                                 onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                 placeholder="e.g. gpt-4-turbo"
                               />
                            </div>
                         </div>
                         </div>

                           <div>
                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                               API Key
                             </label>
                             <div className="relative">
                               <Input
                                  type={showApiKey ? "text" : "password"}
                                  value={formData.apiKey}
                                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                                  placeholder="sk-..."
                                  className="pr-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowApiKey(!showApiKey)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                             </div>
                           </div>
                          
                         <div>
                           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                             Base URL (Optional)
                           </label>
                           <Input
                              value={formData.baseUrl}
                              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                              placeholder="https://api.openai.com/v1"
                            />
                         </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                 Temperature
                               </label>
                               <Input
                                  type="number"
                                  step="0.1"
                                  value={formData.temperature}
                                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div>
                               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                 Max Tokens
                               </label>
                               <Input
                                  type="number"
                                  step="100"
                                  value={formData.maxTokens}
                                  onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                                />
                            </div>
                          </div>

                          <div className="flex justify-end items-center gap-3 pt-4">
                              <Button 
                                variant="ghost" 
                                onClick={handleTestConnection}
                                disabled={testStatus === 'testing'}
                              >
                                {testStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                测试连接
                              </Button>
                                {editingId && (
                                  <Button variant="outline" onClick={handleCancelEdit} disabled={loading}>
                                    <X className="w-4 h-4 mr-2" />
                                    取消
                                  </Button>
                                )}
                                <Button onClick={handleSaveConfig} disabled={loading}>
                                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                  {editingId ? '更新配置' : '保存配置'}
                                </Button>
                          </div>
                      </div>
                    </Card>

                    <div className="grid gap-4">
                      {configs.map((config) => (
                        <Card key={config.id} className="p-5 flex items-center justify-between hover:border-primary-200 transition-colors">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                <Zap className="w-5 h-5 text-gray-500" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-gray-900 dark:text-white">{config.model}</h3>
                                  {config.isDefault === 1 && <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">默认</span>}
                                </div>
                                <p className="text-sm text-gray-500">{config.provider.toUpperCase()}</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-1">
                             <Button variant="ghost" size="icon" onClick={() => handleEditConfig(config)} className="text-gray-400 hover:text-primary-500">
                               <Pencil className="w-4 h-4" />
                             </Button>
                             <Button variant="ghost" size="icon" onClick={() => handleDeleteConfig(config.id)} className="text-gray-400 hover:text-red-500">
                               <Trash2 className="w-4 h-4" />
                             </Button>
                           </div>
                        </Card>
                      ))}
                    </div>
                 </div>
              </TabsContent>

              {/* Appearance Tab */}
              <TabsContent value="appearance">
                 <Card className="p-8 text-center">
                    <div className="max-w-md mx-auto">
                       <Layout className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                       <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">界面设置即将上线</h3>
                       <p className="text-gray-500">
                         我们正在开发更多个性化选项，包括：
                       </p>
                       <ul className="mt-4 text-sm text-gray-600 dark:text-gray-400 space-y-2">
                         <li>• 深色模式/浅色模式切换</li>
                         <li>• 主题色自定义</li>
                         <li>• 阅读器字体与字号设置</li>
                       </ul>
                    </div>
                 </Card>
              </TabsContent>
              
               {/* About Tab */}
               <TabsContent value="about">
                 <Card className="overflow-hidden border-border/50">
                    <div className="relative p-8 md:p-12 overflow-hidden bg-gradient-to-br from-primary-50/50 to-violet-50/50 dark:from-primary-900/10 dark:to-violet-900/10">
                       <div className="absolute top-0 right-0 p-8 opacity-5">
                         <Image src="/logo.svg" alt="" width={256} height={256} className="rotate-12" aria-hidden="true" />
                       </div>
                       
                       <div className="relative flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                          <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-violet-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                            <div className="relative w-24 h-24 rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-xl">
                              <Image src="/logo.svg" alt="Daer Novel Logo" width={80} height={80} className="w-full h-full object-contain" />
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                             <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                               Daer Novel <span className="text-primary-600">AI</span>
                             </h2>
                             <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                               <span className="px-2.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-xs font-bold uppercase tracking-wider">
                                 v0.1.0 Beta
                               </span>
                               <span className="text-gray-400 dark:text-gray-500">•</span>
                               <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">智能网文创作助理</span>
                             </div>
                          </div>
                       </div>
                    </div>
                    
                    <div className="p-8 space-y-12">
                      <div className="max-w-3xl">
                        <h3 className="text-lg font-semibold mb-3 flex items-center">
                          <Sparkles className="w-5 h-5 mr-2 text-primary-500" />
                          项目愿景
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">
                          Daer Novel 是一个专注于长篇网络文学创作的 AI 辅助写作平台。我们利用最先进的大语言模型技术，帮助创作者突破思维壁垒、自动化繁琐的大纲规划、并保持超长篇内容的逻辑连贯性，让创意得到前所未有的释放。
                        </p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-8">
                        <section className="space-y-4">
                          <h3 className="text-lg font-semibold mb-4 border-b border-border pb-2">核心能力</h3>
                          <div className="space-y-4">
                            {[
                              { icon: Zap, title: "全自动大纲体系", desc: "从创意碎片到万字大纲的一键生成" },
                              { icon: BookOpen, title: "超强上下文连贯", desc: "基于 RAG 技术的角色与世界观关联" },
                              { icon: Layout, title: "流式章节创作", desc: "极致丝滑的实时生成体验，支持指令交互" },
                              { icon: Library, title: "多维知识引擎", desc: "深度管理千万字级别的世界观设定" }
                            ].map((feature, i) => (
                              <div key={i} className="flex items-start gap-3">
                                <div className="mt-1 p-1 bg-primary-50 dark:bg-primary-900/30 rounded text-primary-600">
                                  <feature.icon className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{feature.title}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">{feature.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>

                        <section className="space-y-4">
                          <h3 className="text-lg font-semibold mb-4 border-b border-border pb-2">技术栈</h3>
                          <div className="flex flex-wrap gap-2">
                            {[
                              "Next.js 14", "Tailwind CSS", "Drizzle ORM", 
                              "Better Auth", "PostgreSQL", "Tauri", 
                              "大模型"
                            ].map((tech) => (
                              <span key={tech} className="px-3 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400">
                                {tech}
                              </span>
                            ))}
                          </div>
                          
                          <div className="pt-4 space-y-3">
                             <div className="flex items-center justify-between text-sm">
                               <span className="text-gray-500">运行环境</span>
                               <span className="font-mono bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded text-xs select-all">Production-Ready Tauri Desktop</span>
                             </div>
                             <div className="flex items-center justify-between text-sm">
                               <span className="text-gray-500">数据库状态</span>
                               <span className="flex items-center text-green-500">
                                 <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                                 Connected
                               </span>
                             </div>
                          </div>
                        </section>
                      </div>

                      <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="text-sm text-gray-500 text-center md:text-left">
                          <p>© 2026 <span className="font-semibold text-gray-900 dark:text-gray-200">Daer Novel Team</span>. All rights reserved.</p>
                          <p className="mt-1 text-xs text-gray-400">Powered by the next generation of creative AI interfaces.</p>
                        </div>
                        <div className="flex items-center gap-4">
                           <Button variant="outline" size="sm" className="rounded-full shadow-none border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                             检查更新
                           </Button>
                        </div>
                      </div>
                    </div>
                 </Card>
               </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
