import React from 'react';

interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'black';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const NeoButton: React.FC<NeoButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false,
  className = '',
  ...props 
}) => {
  const baseStyles = "font-display font-bold uppercase tracking-wider border-2 border-black transition-all duration-200 ease-in-out active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-neo-primary text-white hover:bg-red-600 shadow-neo",
    secondary: "bg-neo-secondary text-white hover:bg-blue-700 shadow-neo",
    accent: "bg-neo-accent text-black hover:bg-lime-300 shadow-neo",
    black: "bg-black text-white hover:bg-gray-900 shadow-neo",
  };

  const sizes = {
    sm: "px-4 py-2 text-xs shadow-neo-sm",
    md: "px-6 py-3 text-sm shadow-neo",
    lg: "px-8 py-4 text-lg shadow-neo-lg border-4",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};