'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';

// Inject minimal NProgress styles without a CSS file import
const NPROGRESS_STYLES = `
#nprogress { pointer-events: none; }
#nprogress .bar {
  background: hsl(var(--primary));
  position: fixed;
  z-index: 9999;
  top: 0; left: 0;
  width: 100%; height: 2px;
}
#nprogress .peg {
  display: block; position: absolute;
  right: 0; width: 100px; height: 100%;
  box-shadow: 0 0 10px hsl(var(--primary)), 0 0 5px hsl(var(--primary));
  opacity: 1;
  transform: rotate(3deg) translate(0px, -4px);
}
`;

NProgress.configure({ showSpinner: false, minimum: 0.15, speed: 250 });

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.done();
  }, [pathname, searchParams]);

  // Intercept link clicks to start progress bar immediately
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || target.target === '_blank') return;
      if (href.startsWith('/') || href.startsWith(window.location.origin)) {
        NProgress.start();
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <style dangerouslySetInnerHTML={{ __html: NPROGRESS_STYLES }} />
  );
}
