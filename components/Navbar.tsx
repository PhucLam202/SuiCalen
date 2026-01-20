import React, { useState, useCallback, useMemo } from 'react';
import { Menu, X, CalendarClock } from 'lucide-react';
import { SuiWalletButton } from './SuiWalletButton';

const NAV_LINKS = [
  { name: 'Protocol', href: '#protocol' },
  { name: 'DAOs', href: '#daos' },
  { name: 'Tokenomics', href: '#pricing' },
] as const;

interface NavbarProps {
  onLaunchApp?: () => void;
}

export const Navbar: React.FC<NavbarProps> = React.memo(({ onLaunchApp }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const navLinks = useMemo(() => NAV_LINKS, []);

  return (
    <nav className="sticky top-0 z-50 bg-white border-b-4 border-black px-4 py-4 md:px-8">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-10 h-10 bg-neo-primary border-2 border-black flex items-center justify-center shadow-neo-sm">
            <CalendarClock className="w-6 h-6 text-white" />
          </div>
          <span className="font-display font-black text-2xl tracking-tighter">CalenDeFi</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="font-body font-bold text-lg hover:text-neo-primary hover:underline decoration-4 underline-offset-4 transition-all"
            >
              {link.name}
            </a>
          ))}

          {/* Calendar / Launch App Link */}
          <button
            onClick={onLaunchApp}
            className="bg-neo-accent px-4 py-2 border-2 border-black font-display font-bold uppercase hover:bg-neo-primary hover:text-white transition-all shadow-neo-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
          >
            Launch App
          </button>
        </div>

        {/* CTA */}
        <div className="hidden md:block">
          <SuiWalletButton />
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2 border-2 border-black bg-neo-warning shadow-neo-sm active:shadow-none active:translate-x-1 active:translate-y-1"
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="absolute top-[102%] left-0 w-full bg-white border-b-4 border-black p-6 flex flex-col gap-6 md:hidden shadow-neo-lg transition-all z-50">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="font-display text-2xl font-bold uppercase hover:text-neo-secondary"
              onClick={closeMenu}
            >
              {link.name}
            </a>
          ))}
          <button
            onClick={() => {
              closeMenu();
              if (onLaunchApp) onLaunchApp();
            }}
            className="font-display text-2xl font-bold uppercase hover:text-neo-secondary text-left"
          >
            Calendar App
          </button>
          <SuiWalletButton className="w-full" />
        </div>
      )}
    </nav>
  );
});
