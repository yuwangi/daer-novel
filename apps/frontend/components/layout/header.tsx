'use client';

import Link from 'next/link';
import Image from 'next/image';
import { LogOut } from 'lucide-react';
import { ThemeToggle } from '../ui/theme-toggle';
import { useSession, signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

export function Header() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className=" flex h-14 items-center gap-4 px-6 md:px-8">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2 transition-transform hover:scale-105">
            <Image src="/logo.svg" alt="Daer Novel" width={32} height={32} />
            <span className="hidden font-bold sm:inline-block text-gradient text-lg">
              Daer Novel
            </span>
          </Link>
        </div>
        
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Search place holder */}
          </div>
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            
            {session ? (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-sm text-muted-foreground mr-2 hidden sm:inline-block">
                  {session.user.name}
                </span>
                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors"
                  title="登出"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                登录
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
