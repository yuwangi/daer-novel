import type { Metadata } from 'next';
// Remove Google Font import to avoid build issues in environments with restricted access
// import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { AnnouncementModal } from '@/components/AnnouncementModal';

// const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Daer Novel - AI 小说生成平台',
  description: '面向长篇网文创作的多智能体 AI 协作平台',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers attribute="class" defaultTheme="system" enableSystem>
          <div className=" bg-background text-foreground selection:bg-primary-100 selection:text-primary-900 dark:selection:bg-primary-900 dark:selection:text-primary-100">
            {children}
          </div>
          <AnnouncementModal />
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  );
}
