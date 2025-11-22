import React from 'react';

export const Marquee: React.FC = () => {
  const text = "CARDANO NATIVE • NON-CUSTODIAL • MULTI-SIG RSVPS • AUTOMATED PAYROLL • ON-CHAIN SCHEDULING • ";
  
  return (
    <div className="relative w-full overflow-hidden bg-neo-bg py-14 z-20">
      {/* 
        Rotated Wrapper 
        w-[110%] and -ml-[5%] ensures the strip extends beyond the viewport edges when rotated.
        -rotate-2 gives the slanted look.
        The transform on this parent creates a coordinate system, so the children's translateX 
        animation will move along the rotated axis perfectly.
      */}
      <div className="w-[110%] -ml-[5%] bg-black border-y-4 border-black py-6 transform -rotate-2 shadow-neo-lg flex items-center">
        
        {/* First copy of text */}
        <div className="animate-marquee whitespace-nowrap shrink-0">
          <span className="text-4xl md:text-6xl font-display font-black text-white px-4 tracking-tighter">{text.repeat(2)}</span>
        </div>

        {/* Second copy for seamless infinite loop */}
        <div className="animate-marquee whitespace-nowrap shrink-0">
          <span className="text-4xl md:text-6xl font-display font-black text-white px-4 tracking-tighter">{text.repeat(2)}</span>
        </div>

      </div>
    </div>
  );
};