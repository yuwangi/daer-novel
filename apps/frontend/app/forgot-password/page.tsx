'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Mail, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { translateAuthError } from '@/lib/utils';
import { forgetPassword } from '@/lib/auth-client';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await forgetPassword({
        email,
        redirectTo: '/reset-password',
      });

      if (error) {
        setError(translateAuthError(error));
        return;
      }

      setSuccess(true);
      toast.success('重置链接已发送到您的邮箱');
    } catch (err: any) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900">
      {/* Visual Side (Left) - Hidden on Mobile */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary-600 items-center justify-center p-12">
        {/* Vibrant Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-indigo-600"></div>
        <div className="absolute top-0 right-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 brightness-100 contrast-150 mix-blend-overlay"></div>
        
        {/* Animated Shapes */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-400 rounded-full mix-blend-screen filter blur-[100px] opacity-30 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-400 rounded-full mix-blend-screen filter blur-[100px] opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>

        {/* Branding Content */}
        <div className="relative z-10 max-w-lg text-white">
          <Link href="/" className="inline-flex items-center space-x-3 mb-12">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-xl overflow-hidden transition-transform hover:scale-110">
              <Image src="/logo.svg" alt="Daer Novel" width={32} height={32} />
            </div>
            <span className="text-3xl font-bold tracking-tight">Daer Novel</span>
          </Link>

          <h2 className="text-5xl font-bold mb-6 leading-tight">
            找回您的<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-indigo-300">
              创作灵感
            </span>
          </h2>
          
          <p className="text-lg text-indigo-100 leading-relaxed mb-8 font-light">
            不用担心，我们都曾忘记过密码。
            输入您的邮箱，我们将把您带回故事的世界。
          </p>
        </div>
      </div>

      {/* Form Side (Right) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative">
        <div className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/50 dark:border-white/5 ring-1 ring-black/5 animate-fadeIn">
          
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-xl shadow-lg shadow-primary-500/30 mb-4">
              <BookOpen className="w-6 h-6 text-white" />
            </Link>
          </div>

          <div className="mb-10">
            <Link href="/login" className="inline-flex items-center text-sm text-gray-500 hover:text-primary-600 mb-6 transition-colors group">
              <ArrowLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" />
              返回登录
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">忘记密码？</h1>
            <p className="text-gray-500 dark:text-gray-400">
              输入您注册时的邮箱地址，我们将向您发送重置密码的链接。
            </p>
          </div>

          {success ? (
            <div className="text-center py-8 animate-fadeIn">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">邮件已发送</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8">
                我们已向 <strong>{email}</strong> 发送了重置指南。请检查您的收件箱（包括垃圾邮件文件夹）。
              </p>
              <Button 
                onClick={() => setSuccess(false)}
                variant="outline"
                className="w-full"
              >
                尝试其他邮箱
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center animate-shake">
                  <Sparkles className="w-4 h-4 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                  邮箱
                </label>
                <div className="relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-primary-600 transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-gray-900 dark:text-white placeholder:text-gray-400"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                fullWidth 
                className="py-4 text-base font-bold bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white shadow-lg shadow-primary-500/30 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                    发送中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    发送重置链接
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </span>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
