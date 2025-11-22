import React from 'react';
import { Twitter, Github, Linkedin, Disc } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-black text-white border-t-4 border-black">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <h2 className="font-display text-4xl font-black mb-6 tracking-tighter">CalenDeFi</h2>
            <p className="font-body text-lg text-gray-300 max-w-sm mb-6">
              The first calendar-native wallet for Cardano. Automate your financial life without giving up custody.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 border-2 border-white flex items-center justify-center hover:bg-neo-primary hover:border-neo-primary transition-colors">
                <Twitter size={20} />
              </a>
              <a href="#" className="w-10 h-10 border-2 border-white flex items-center justify-center hover:bg-neo-secondary hover:border-neo-secondary transition-colors">
                <Github size={20} />
              </a>
              <a href="#" className="w-10 h-10 border-2 border-white flex items-center justify-center hover:bg-neo-accent hover:text-black hover:border-neo-accent transition-colors">
                <Disc size={20} />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-display text-xl font-bold mb-4 text-neo-primary">Ecosystem</h3>
            <ul className="space-y-2 font-mono">
              <li><a href="#" className="hover:text-neo-recurring hover:underline">Cardano Docs</a></li>
              <li><a href="#" className="hover:text-neo-recurring hover:underline">Project Catalyst</a></li>
              <li><a href="#" className="hover:text-neo-recurring hover:underline">Governance</a></li>
              <li><a href="#" className="hover:text-neo-recurring hover:underline">Stake Pools</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-xl font-bold mb-4 text-neo-primary">Company</h3>
            <ul className="space-y-2 font-mono">
              <li><a href="#" className="hover:text-neo-recurring hover:underline">About</a></li>
              <li><a href="#" className="hover:text-neo-recurring hover:underline">Whitepaper</a></li>
              <li><a href="#" className="hover:text-neo-recurring hover:underline">Audit Report</a></li>
              <li><a href="#" className="hover:text-neo-recurring hover:underline">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t-2 border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="font-mono text-sm text-gray-400">
            © 2024 CalenDeFi. Built on Cardano.
          </div>
          <div className="font-mono text-sm text-gray-400 flex items-center gap-2">
             <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
             System Operational
          </div>
        </div>
      </div>
    </footer>
  );
};