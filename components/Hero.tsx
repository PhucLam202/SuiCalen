import React from 'react';
import { NeoButton } from './NeoButton';
import { ArrowRight, Wallet, RefreshCw, Users, CheckCircle2 } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

export const Hero: React.FC = () => {
  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-neo-bg flex flex-col items-center pt-20 pb-10">
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ 
             backgroundImage: 'linear-gradient(#000 2px, transparent 2px), linear-gradient(90deg, #000 2px, transparent 2px)', 
             backgroundSize: '40px 40px' 
           }}>
      </div>

      <div className="container mx-auto px-4 z-10 grid lg:grid-cols-2 gap-12 items-center">
        
        {/* Left Content */}
        <div className="flex flex-col gap-8 text-center lg:text-left relative z-20">
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 bg-neo-warning border-2 border-black px-4 py-2 mb-4 shadow-neo-sm -rotate-2">
              <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
              <span className="font-mono font-bold text-sm">CARDANO MAINNET LIVE</span>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-black leading-[0.9] tracking-tighter text-black">
              SCHEDULE <br />
              PAYMENTS LIKE <br />
              <span className="bg-neo-primary text-white px-4 italic transform -skew-x-6 inline-block shadow-neo">MEETINGS</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={400}>
            <p className="font-body text-xl font-medium text-gray-800 max-w-xl mx-auto lg:mx-0 border-l-4 border-black pl-6 py-2">
              Turn Google Calendar into a non-custodial interface for Cardano. 
              Approve transactions like RSVPs. No more missed mints or manual payroll.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={600} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center">
            <NeoButton size="lg" variant="black">
              Start Scheduling <ArrowRight className="w-5 h-5" />
            </NeoButton>
            <NeoButton size="lg" variant="secondary" className="bg-white !text-black border-2">
              Read Whitepaper
            </NeoButton>
          </ScrollReveal>
        </div>

        {/* Right Visual (Interactive Calendar Transaction) */}
        <ScrollReveal animation="slide-right" delay={400} className="relative mt-10 lg:mt-0 group perspective-1000">
           
           {/* Decorative Floating Elements */}
           <div className="absolute -top-20 -right-10 w-48 h-48 bg-neo-accent rounded-full border-4 border-black z-0 animate-float opacity-80"></div>
           <div className="absolute bottom-10 -left-16 w-32 h-32 bg-neo-secondary rounded-full border-4 border-black z-0 animate-float-delayed opacity-80"></div>

           {/* Main Card */}
           <div className="relative z-10 bg-white border-4 border-black p-0 shadow-neo-lg transform rotate-2 transition-transform hover:rotate-0 duration-500 max-w-md mx-auto">
              
              {/* Fake Browser Header */}
              <div className="bg-black text-white p-3 flex justify-between items-center border-b-4 border-black">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 border border-white"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500 border border-white"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500 border border-white"></div>
                </div>
                <div className="font-mono text-xs tracking-widest">calendar.google.com</div>
                <div className="w-4"></div>
              </div>

              <div className="p-6">
                {/* Event Title / Transaction */}
                <div className="mb-6">
                  <label className="text-xs font-mono font-bold text-gray-500 mb-1 block">EVENT TITLE</label>
                  <div className="font-display text-2xl font-black border-b-4 border-neo-primary pb-2 flex items-center justify-between">
                    <span>Pay 500 $ADA</span>
                    <span className="text-sm bg-neo-primary text-white px-2 py-1 rounded-sm font-mono">DRAFT</span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                   <div className="bg-neo-bg p-3 border-2 border-black">
                     <div className="text-xs font-mono text-gray-500 mb-1">RECIPIENT</div>
                     <div className="font-bold flex items-center gap-2">
                       <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full border border-black"></div>
                       @alice.ada
                     </div>
                   </div>
                   <div className="bg-neo-bg p-3 border-2 border-black">
                     <div className="text-xs font-mono text-gray-500 mb-1">EXECUTION TIME</div>
                     <div className="font-bold">May 21, 10:00 AM</div>
                   </div>
                </div>

                {/* Multi-Sig Guests */}
                <div className="border-t-2 border-dashed border-gray-400 pt-4 mb-4">
                  <div className="text-xs font-mono font-bold text-gray-500 mb-3">GUESTS (MULTI-SIG SIGNERS)</div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between group/guest hover:bg-neo-bg p-2 transition-colors cursor-pointer">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-black rounded-full border-2 border-black flex items-center justify-center text-white text-xs">YO</div>
                         <div>
                           <div className="font-bold text-sm">You (Proposer)</div>
                           <div className="text-xs text-green-600 font-mono font-bold">SIGNED ✅</div>
                         </div>
                       </div>
                    </div>

                    <div className="flex items-center justify-between group/guest hover:bg-neo-bg p-2 transition-colors cursor-pointer">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-neo-secondary rounded-full border-2 border-black flex items-center justify-center text-white text-xs">TR</div>
                         <div>
                           <div className="font-bold text-sm">Treasury DAO</div>
                           <div className="text-xs text-orange-500 font-mono font-bold animate-pulse">WAITING FOR RSVP...</div>
                         </div>
                       </div>
                       <button className="text-xs bg-black text-white px-2 py-1 font-mono hover:bg-gray-800">
                         Nudge
                       </button>
                    </div>
                  </div>
                </div>

                {/* Transaction Details (New Section) */}
                <div className="bg-gray-50 border-2 border-black p-3 mb-6" data-cy='transaction-details'>
                  <div className="flex justify-between items-center mb-2 border-b border-gray-300 pb-2">
                    <span className="font-mono text-[10px] font-bold text-gray-500 tracking-wider">NETWORK FEE</span>
                    <span className="font-mono text-xs font-bold text-black">0.174 ADA</span>
                  </div>
                  
                  <div className="flex justify-between items-center mb-2 border-b border-gray-300 pb-2">
                    <span className="font-mono text-[10px] font-bold text-gray-500 tracking-wider">VALIDITY INTERVAL</span>
                    <span className="font-mono text-[10px] font-bold bg-neo-warning px-1 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Slot 84920 - 89200</span>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] font-bold text-gray-500 tracking-wider block mb-1">METADATA (674)</span>
                    <div className="font-mono text-[10px] bg-white border border-gray-300 p-1.5 text-gray-600 break-all shadow-[inset_1px_1px_4px_rgba(0,0,0,0.05)]">
                      {`{"msg": ["Payroll: May 2024"]}`}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button className="flex-1 bg-neo-primary border-2 border-black text-white font-bold py-2 shadow-neo-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all">
                    Save Event
                  </button>
                </div>
              </div>
           </div>

           {/* Stickers / Annotations */}
           <div className="absolute top-1/2 -right-12 bg-neo-warning border-4 border-black px-3 py-2 font-display font-bold text-lg rotate-12 shadow-neo z-20">
             Valid @ Slot 84920
           </div>
        </ScrollReveal>
      </div>
    </section>
  );
};