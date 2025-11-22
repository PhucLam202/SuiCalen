import React from 'react';
import { CalendarClock, ShieldCheck, Users, RefreshCcw, Zap, Coins } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

const features = [
  {
    title: 'Event = Transaction',
    desc: 'Create an event "Pay 500 ADA to @alice". We parse the title, resolve the handle, and build the transaction for you to sign.',
    icon: <CalendarClock size={32} />,
    color: 'bg-white',
    span: 'md:col-span-2'
  },
  {
    title: 'RSVP = Multi-Sig',
    desc: 'Invite your DAO members as guests. The transaction only executes once enough RSVPs (signatures) are collected. No more chasing people on Discord.',
    icon: <Users size={32} />,
    color: 'bg-neo-accent',
    span: 'md:col-span-1'
  },
  {
    title: 'Recurring Payroll',
    desc: 'Set it to "Repeat Monthly". The smart contract handles the vesting and release automatically. Color-coded Blue.',
    icon: <RefreshCcw size={32} />,
    color: 'bg-neo-recurring',
    textColor: 'text-white',
    span: 'md:col-span-1'
  },
  {
    title: 'Token Swaps',
    desc: 'Schedule market moves. "Swap ADA for MIN at 3:00 PM". Executes via DEX aggregators. Color-coded Green.',
    icon: <Zap size={32} />,
    color: 'bg-neo-oneoff',
    span: 'md:col-span-1'
  },
  {
    title: 'Non-Custodial',
    desc: 'Your keys, your crypto. We never touch your funds. We just orchestrate the metadata and validity intervals.',
    icon: <ShieldCheck size={32} />,
    color: 'bg-neo-secondary',
    textColor: 'text-white',
    span: 'md:col-span-1'
  }
];

export const Features: React.FC = () => {
  return (
    <section className="py-32 bg-neo-bg px-4 relative" id="protocol">
      {/* Background patterns */}
      <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-black/5 to-transparent"></div>

      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
              <h2 className="text-5xl md:text-7xl font-display font-black uppercase tracking-tighter leading-none">
                The <span className="text-neo-primary">Calendar</span> <br/> 
                Native <span className="bg-black text-white px-2">Wallet</span>
              </h2>
              <p className="font-body text-xl font-bold max-w-md text-right border-r-4 border-neo-primary pr-4">
                DeFi is currently "Real-Time Only". We fix the Time Gap by bringing scheduling to the blockchain.
              </p>
            </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <ScrollReveal key={idx} delay={idx * 100} animation="pop" className={`${feature.span}`}>
              <div className={`h-full p-8 border-4 border-black shadow-neo hover:shadow-neo-lg transition-all duration-300 hover:-translate-y-2 group ${feature.color} ${feature.textColor || 'text-black'}`}>
                <div className="flex flex-col justify-between h-full gap-6">
                  <div className="w-16 h-16 bg-white border-2 border-black flex items-center justify-center shadow-neo-sm text-black group-hover:rotate-12 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-bold mb-4 uppercase">{feature.title}</h3>
                    <p className="font-body text-lg font-medium opacity-90 leading-relaxed border-l-2 border-current pl-3">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
          
          {/* Callout Box */}
          <ScrollReveal delay={500} className="md:col-span-3">
             <div className="bg-black text-white p-8 border-4 border-neo-primary border-dashed flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-4">
                   <div className="p-4 bg-neo-primary rounded-full animate-pulse">
                      <Coins size={32} />
                   </div>
                   <div>
                     <h3 className="font-display text-2xl font-bold">Staking Automation?</h3>
                     <p className="font-mono text-gray-400">Re-delegate at epoch boundaries automatically. Coming soon (Purple Events).</p>
                   </div>
                </div>
                <button className="px-8 py-3 bg-white text-black font-display font-bold uppercase border-2 border-transparent hover:border-white hover:bg-black hover:text-white transition-all">
                   Join Waitlist
                </button>
             </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
};