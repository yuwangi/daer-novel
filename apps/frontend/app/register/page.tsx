'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Mail, Lock, User, Sparkles, ArrowRight, CheckCircle2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { authAPI } from '@/lib/api';
import { signUp, signInWithGitHub, signInWithGoogle, signInWithLinuxDo } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { translateAuthError } from '@/lib/utils';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await signUp.email({
        email: formData.email,
        password: formData.password,
        name: formData.name,
      });

      if (error) {
        setError(translateAuthError(error));
        return;
      }

      router.push('/');
    } catch (err: any) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  const features = [
    'AI 智能大纲生成',
    '向量知识库管理',
    '人物一致性检查',
    '无限章节生成'
  ];

  return (
    <div className="min-h-screen w-full flex bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900">
      
      {/* Visual Side (Left) - Fixed layout for consistency */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary-600 items-center justify-center p-12">
        {/* Vibrant Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600 to-purple-600"></div>
        <div className="absolute top-0 right-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 brightness-100 contrast-150 mix-blend-overlay"></div>
        
        {/* Animated Shapes */}
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-orange-400 rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-pulse"></div>
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-400 rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-pulse" style={{ animationDelay: '3s' }}></div>

        {/* Content */}
        <div className="relative z-10 max-w-lg text-white">
          <Link href="/" className="inline-flex items-center space-x-3 mb-12 opacity-80 hover:opacity-100 transition-all hover:scale-105">
            <Image src="/logo.svg" alt="Daer Novel" width={32} height={32} className="brightness-0 invert" />
            <span className="text-2xl font-bold tracking-wide">Daer Novel</span>
          </Link>

          <h2 className="text-5xl font-bold mb-8 leading-tight">
            开启你的<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-200 to-pink-200">
              AI 创作纪元
            </span>
          </h2>
          
          <div className="space-y-6 mb-12">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center space-x-4 animate-slideInRight" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <CheckCircle2 className="w-5 h-5 text-green-300" />
                </div>
                <span className="text-xl text-white/90 font-medium">{feature}</span>
              </div>
            ))}
          </div>

          <div className="inline-flex items-center px-4 py-2 bg-white/10 rounded-full backdrop-blur-md border border-white/20 text-sm font-medium text-white/80">
            <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
            已有 6,000+ 作者正在创作
          </div>
        </div>
      </div>

      {/* Form Side (Right) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative">
        <div className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/50 dark:border-white/5 ring-1 ring-black/5 animate-fadeIn">
          
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center justify-center w-12 h-12 bg-purple-600 rounded-xl shadow-lg shadow-purple-500/30 mb-4 transition-transform hover:scale-110">
              <Image src="/logo.svg" alt="Daer Novel" width={24} height={24} className="brightness-0 invert" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">创建账户</h1>
          </div>

          <div className="hidden lg:block mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">开始创作</h1>
            <p className="text-gray-500 dark:text-gray-400">
              永久免费，无需信用卡
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center animate-shake">
                <Sparkles className="w-4 h-4 mr-2 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                笔名
              </label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-purple-600 transition-colors">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-400"
                  placeholder="给自己起个好听的名字"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                邮箱
              </label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-purple-600 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-400"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                密码
              </label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-purple-600 transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-400"
                  placeholder="设置一个安全密码"
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 text-base font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/30 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                  注册中...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  立即注册
                  <ArrowRight className="w-5 h-5 ml-2" />
                </span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white/80 dark:bg-slate-900/80 text-gray-500 dark:text-gray-400">
                或使用第三方注册
              </span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={signInWithGitHub}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-900 hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
              </svg>
              使用 GitHub 注册
            </button>

            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 dark:bg-white/10 dark:hover:bg-white/20 text-gray-700 dark:text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg border border-gray-200 dark:border-white/10"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              使用 Google 注册
            </button>

            <button
              type="button"
              onClick={() => {
                signInWithLinuxDo();
              }}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#ffc300] hover:bg-[#e6b000] text-black rounded-xl transition-all duration-200 shadow-md hover:shadow-lg border border-[#ffc300]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#ffc300" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#ffc300" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#ffc300" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              使用 LinuxDo 注册
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              已有账户？{' '}
              <Link href="/login" className="font-bold text-purple-600 hover:text-purple-700 transition-colors inline-flex items-center">
                立即登录
                <ChevronRight className="w-4 h-4 ml-0.5" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
