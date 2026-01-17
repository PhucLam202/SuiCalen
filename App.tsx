import React, { lazy, Suspense, useCallback, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Marquee } from './components/Marquee';
import { CalendarCheck } from 'lucide-react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { SuiWalletButton } from './components/SuiWalletButton';

// Lazy load heavy components for better initial performance
const Hero = lazy(() => import('./components/Hero').then(m => ({ default: m.Hero })));
const Features = lazy(() => import('./components/Features').then(m => ({ default: m.Features })));
const Pricing = lazy(() => import('./components/Pricing').then(m => ({ default: m.Pricing })));
const Footer = lazy(() => import('./components/Footer').then(m => ({ default: m.Footer })));
const AutopayDashboard = lazy(() => import('./components/autopay/Dashboard').then(m => ({ default: m.AutopayDashboard })));

// Loading placeholder component
const LoadingPlaceholder: React.FC = () => (
  <div className="min-h-screen bg-neo-bg flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-neo-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="font-body text-gray-600">Loading...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const account = useCurrentAccount();
  const [showDashboard, setShowDashboard] = useState(false);

  const handleLaunchApp = useCallback(() => {
    if (!account) {
      alert('Please connect your Sui wallet first!');
      return;
    }
    setShowDashboard(true);
    // Scroll to dashboard
    setTimeout(() => {
      document.getElementById('app')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [account]);

  return (
    <div className="min-h-screen bg-neo-bg text-black font-body selection:bg-neo-primary selection:text-white">
      <Navbar onLaunchApp={handleLaunchApp} />
      
      <main>
        {!showDashboard ? (
          <>
            <Suspense fallback={<LoadingPlaceholder />}>
              <Hero />
            </Suspense>
            <Marquee />
            <Suspense fallback={null}>
              <Features />
            </Suspense>
            
            {/* Callout Section - DAO Focused */}
            <section className="bg-neo-secondary border-y-4 border-black py-20 px-4 text-center relative" id="daos">
               {/* Abstract Background */}
               <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                  <div className="absolute top-10 left-10 w-40 h-40 border-8 border-white rounded-full"></div>
                  <div className="absolute bottom-10 right-10 w-60 h-60 border-8 border-white rotate-45"></div>
               </div>

              <div className="max-w-4xl mx-auto relative z-10">
                <h2 className="font-display text-4xl md:text-6xl font-black text-white mb-8 uppercase leading-tight">
                  Is your DAO still chasing signatures on Discord?
                </h2>
                <p className="font-mono text-black bg-neo-accent inline-block px-4 py-2 text-lg mb-8 border-2 border-black shadow-neo rotate-1">
                  "Did you sign the transaction yet?" — You, everyday.
                </p>
                <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
                  {!account ? (
                    <SuiWalletButton variant="custom" />
                  ) : (
                    <button 
                      onClick={handleLaunchApp}
                      className="bg-white text-black font-display font-bold text-xl px-8 py-4 border-2 border-black hover:bg-black hover:text-white transition-colors shadow-[8px_8px_0px_0px_#000]"
                    >
                      Launch Autopay App
                    </button>
                  )}
                </div>
              </div>
            </section>

            <Suspense fallback={null}>
              <Pricing />
            </Suspense>
          </>
        ) : (
          <Suspense fallback={<LoadingPlaceholder />}>
            <AutopayDashboard />
          </Suspense>
        )}
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>

      {/* Floating Action Button */}
      {!showDashboard && (
        <button 
          onClick={handleLaunchApp}
          className="fixed bottom-8 right-8 bg-neo-primary p-4 border-4 border-black shadow-neo-lg rounded-none hover:bg-white hover:text-black text-white transition-all hover:scale-110 z-50 group"
        >
           <CalendarCheck size={32} />
           <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-black text-white px-4 py-2 font-bold font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border-2 border-white pointer-events-none shadow-neo-sm">
              Launch App
           </div>
        </button>
      )}
    </div>
  );
};

export default App;
