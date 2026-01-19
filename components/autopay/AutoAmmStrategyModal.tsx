import React, { useMemo } from 'react';
import type { OptimizeYieldRecommendationDto, YieldAprItemDto, YieldProtocol } from '../../services/yieldApi';

export interface AutoAmmStrategyOption {
  protocol: YieldProtocol;
  apr: number;
  riskScore: number;
  tvl: string;
}

export interface AutoAmmStrategyModalProps {
  isOpen: boolean;
  token: string;
  recommended: OptimizeYieldRecommendationDto;
  considered: YieldAprItemDto[];
  selected: { protocol: YieldProtocol; apr: number } | null;
  onSelect: (choice: { protocol: YieldProtocol; apr: number }) => void;
  onClose: () => void;
}

function formatApr(apr: number): string {
  return `${apr.toFixed(2)}%`;
}

function riskLabel(score: number): { text: string; className: string } {
  if (score < 4) return { text: 'High', className: 'bg-red-100 text-red-700 border-red-200' };
  if (score < 7) return { text: 'Medium', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  return { text: 'Low', className: 'bg-green-100 text-green-800 border-green-200' };
}

export const AutoAmmStrategyModal: React.FC<AutoAmmStrategyModalProps> = ({
  isOpen,
  token,
  recommended,
  considered,
  selected,
  onSelect,
  onClose,
}) => {
  const options: AutoAmmStrategyOption[] = useMemo(() => {
    const uniqueByProtocol = new Map<YieldProtocol, YieldAprItemDto>();
    for (const item of considered) {
      const existing = uniqueByProtocol.get(item.protocol);
      if (!existing || item.apr > existing.apr) {
        uniqueByProtocol.set(item.protocol, item);
      }
    }
    return Array.from(uniqueByProtocol.values())
      .map((x) => ({ protocol: x.protocol, apr: x.apr, riskScore: x.riskScore, tvl: x.tvl }))
      .sort((a, b) => b.apr - a.apr);
  }, [considered]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <button
        type="button"
        aria-label="Close AutoAMM strategy picker"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div className="relative w-[min(720px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-auto glass border-[1.5px] border-white/20 p-6 shadow-soft-lg rounded-xl">
        <div className="flex items-start justify-between gap-4 mb-4 border-b border-black/10 pb-3">
          <div>
            <h3 className="font-display text-xl font-black uppercase">AutoAMM Strategy Picker</h3>
            <p className="font-mono text-xs text-gray-600 mt-1">
              Select where funds should be optimized for <span className="font-bold">{token.toUpperCase()}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 font-mono text-xs font-bold border border-black/10 rounded-lg bg-white hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="mb-4">
          <div className="font-mono text-xs font-bold text-gray-500 mb-1">RECOMMENDED BY AI</div>
          <div className="bg-white/60 border border-black/10 rounded-lg p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-neo-primary/10 border-neo-primary/20 text-neo-secondary uppercase">
                {recommended.protocol}
              </span>
              <span className="font-display font-black text-lg">{formatApr(recommended.apr)} APR</span>
              <span className="font-mono text-[10px] text-gray-500">confidence {(recommended.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-2 text-xs text-gray-700">{recommended.reasoning}</div>
          </div>
        </div>

        <div>
          <div className="font-mono text-xs font-bold text-gray-500 mb-2">AVAILABLE OPTIONS</div>
          <div className="space-y-2">
            {options.map((opt) => {
              const isRecommended = opt.protocol === recommended.protocol;
              const isSelected = selected?.protocol === opt.protocol;
              const risk = riskLabel(opt.riskScore);
              return (
                <div
                  key={opt.protocol}
                  className={`border rounded-lg p-3 bg-white/70 transition-all ${
                    isSelected ? 'border-neo-primary/60 shadow-neo-sm' : 'border-black/10'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-[220px]">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-black uppercase">{opt.protocol}</span>
                        {isRecommended && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-green-100 border-green-200 text-green-800 uppercase">
                            Recommended
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${risk.className}`}>
                          Risk: {risk.text}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-gray-600 mt-1">
                        APR <span className="font-bold">{formatApr(opt.apr)}</span> · TVL <span className="font-bold">{opt.tvl}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelect({ protocol: opt.protocol, apr: opt.apr })}
                      className={`px-4 py-2 rounded-lg font-mono font-bold text-xs border transition-colors ${
                        isSelected
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black border-black/10 hover:border-black hover:bg-black hover:text-white'
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </button>
                  </div>
                </div>
              );
            })}

            {options.length === 0 && (
              <div className="text-center font-mono text-sm text-gray-500 py-6 border border-black/10 rounded-lg bg-white/60">
                No strategies available yet. Try again in a moment.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

