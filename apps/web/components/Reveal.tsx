'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';

type RevealProps = { children: ReactNode; as?: ElementType; className?: string; delay?: number };

export function Reveal({ children, as: Component = 'div', className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<'visible' | 'pending' | 'revealed'>('visible');

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      setState('revealed');
      return;
    }
    setState('pending');
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setState('revealed');
      observer.disconnect();
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Component
      ref={ref}
      className={['reveal', className].filter(Boolean).join(' ')}
      data-reveal-state={state}
      style={{ '--reveal-delay': `${Math.max(0, delay)}ms` } as CSSProperties}
    >
      {children}
    </Component>
  );
}

export function RevealPageSections() {
  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

    const sections = Array.from(document.querySelectorAll<HTMLElement>('main > section, main > article, main > div'))
      .filter((element) => !element.matches('#top, .page-hero, .page-intro'));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        element.dataset.revealState = 'revealed';
        observer.unobserve(element);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

    for (const section of sections) {
      section.classList.add('reveal');
      section.dataset.revealState = 'pending';
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, []);

  return null;
}
