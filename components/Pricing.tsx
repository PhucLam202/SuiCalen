import React from 'react';
import { Check } from 'lucide-react';
import { NeoButton } from './NeoButton';
import { ScrollReveal } from './ScrollReveal';

const plans = [
  {
    name: 'Retail',
    price: '0 SUI',
    features: ['Standard Transactions', 'Basic Calendar Sync', 'Manual Signing', 'Community Support'],
    color: 'bg-white',
  },
  {
    name: 'Power User',
    price: '50 SUI',
    features: ['Recurring Payments (Blue)', 'Token Swaps (Green)', 'Unlimited Automations', 'Priority Node Access', 'Email Notifications'],
    color: 'bg-neo-oneoff',
    highlight: true,
  },
  {
    name: 'DAO / Team',
    price: 'Custom',
    features: ['Multi-Sig RSVPs', 'Treasury Management', 'Role Based Access', 'Audit History', 'Dedicated Support'],
    color: 'bg-neo-primary',
    textColor: 'text-white',
    btnVariant: 'black',
  },
];

export const Pricing: React.FC = () => {
  return (
    <section className="py-24 bg-neo-bg px-4 relative border-t-4 border-black" id="pricing">
      <div className="absolute top-0 left-0 w-full h-full opacity-5"
        style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-7xl font-display font-black mb-6 uppercase">
            Platform <span className="text-transparent bg-clip-text bg-gradient-to-r from-neo-primary to-neo-secondary">Fees</span>
          </h2>
          <p className="font-body text-xl max-w-2xl mx-auto">
            Pay per transaction or subscribe for advanced automation features.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          {plans.map((plan, idx) => (
            <ScrollReveal key={idx} delay={idx * 150} className={`${plan.highlight ? '-mt-4 md:-mt-8' : ''}`}>
              <div className={`
                relative p-8 border-4 border-black flex flex-col gap-6
                ${plan.color} 
                ${plan.textColor || 'text-black'}
                ${plan.highlight ? 'shadow-neo-lg z-10 scale-105' : 'shadow-neo'}
              `}>
                {plan.highlight && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black text-white border-2 border-white font-bold px-4 py-1 font-mono text-sm uppercase shadow-neo">
                    Best Value
                  </div>
                )}

                <div>
                  <h3 className="font-display text-2xl font-bold uppercase">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-black font-display">{plan.price}</span>
                    <span className="font-mono text-sm opacity-75">/yr</span>
                  </div>
                </div>

                <ul className="flex-1 space-y-4">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-center gap-3 font-bold font-body">
                      <div className="w-6 h-6 border-2 border-black bg-white text-black flex items-center justify-center flex-shrink-0">
                        <Check size={14} strokeWidth={4} />
                      </div>
                      {feat}
                    </li>
                  ))}
                </ul>

                <NeoButton
                  fullWidth
                  variant={plan.btnVariant as any || (plan.highlight ? 'black' : 'primary')}
                >
                  Select Plan
                </NeoButton>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};