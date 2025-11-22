import React, { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  animation?: 'fade-up' | 'slide-left' | 'slide-right' | 'pop';
  delay?: number;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({ 
  children, 
  className = "", 
  animation = 'fade-up',
  delay = 0
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 } 
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, []);

  const getAnimationClass = () => {
    if (isVisible) {
      switch (animation) {
        case 'fade-up': return 'opacity-100 translate-y-0';
        case 'slide-left': return 'opacity-100 translate-x-0';
        case 'slide-right': return 'opacity-100 translate-x-0';
        case 'pop': return 'opacity-100 scale-100';
        default: return 'opacity-100 translate-y-0';
      }
    } else {
      switch (animation) {
        case 'fade-up': return 'opacity-0 translate-y-16';
        case 'slide-left': return 'opacity-0 -translate-x-16';
        case 'slide-right': return 'opacity-0 translate-x-16';
        case 'pop': return 'opacity-0 scale-90';
        default: return 'opacity-0 translate-y-16';
      }
    }
  };

  return (
    <div 
      ref={ref} 
      className={`transform transition-all duration-[1200ms] ease-out-expo ${getAnimationClass()} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};