import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllApr, YieldAprItemDto } from '../../services/yieldApi';
import { RefreshCw, TrendingUp, AlertTriangle, Search } from 'lucide-react';

function formatApr(apr: number): string {
  return `${apr.toFixed(2)}%`;
}

function formatToken(token: string): string {
  return token.toUpperCase();
}

function formatTvl(tvl: string): string {
  // tvl is a bigint string; keep as compact display without assuming decimals
  if (tvl.length <= 6) return tvl;
  return `${tvl.slice(0, 3)}...${tvl.slice(-3)}`;
}

function formatRiskColor(score: number): string {
  if (score >= 8) return 'bg-green-400 text-black border-2 border-black';
  if (score >= 5) return 'bg-yellow-400 text-black border-2 border-black';
  return 'bg-red-400 text-white border-2 border-black';
}

export const YieldRatesPanel: React.FC = () => {
  const [query, setQuery] = useState<string>('');

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['yield', 'apr', 'all'],
    queryFn: async (): Promise<YieldAprItemDto[]> => {
      const resp = await getAllApr();
      return resp.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    const out = q.length === 0
      ? list
      : list.filter((x) => x.token.toLowerCase().includes(q) || x.protocol.toLowerCase().includes(q));
    return [...out].sort((a, b) => b.apr - a.apr);
  }, [data, query]);

  return (
    <section className="bg-white border-4 border-black shadow-neo-lg p-0 overflow-hidden">
      {/* Header Section */}
      <div className="bg-neo-primary p-6 md:p-8 border-b-4 border-black flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-white border-4 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <TrendingUp size={32} className="text-black" />
          </div>
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-black uppercase text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] text-stroke-black">
              Live Yield Rates
            </h2>
            <p className="font-mono text-sm text-black bg-white inline-block px-2 py-1 border-2 border-black mt-2 font-bold">
              /api/yield/apr/all
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative group">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter..."
              className="pl-10 pr-4 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-mono font-bold w-full sm:w-64 focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-none transition-all placeholder:text-gray-500 uppercase"
            />
          </div>

          <button
            onClick={() => void refetch()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-black text-white border-4 border-transparent hover:border-black hover:bg-white hover:text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.5)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-display font-black uppercase transition-all active:translate-y-1"
            disabled={isFetching}
          >
            <RefreshCw size={20} className={isFetching ? 'animate-spin' : ''} />
            {isFetching ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="p-6 bg-neo-bg">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 border-4 border-black bg-white shadow-neo">
            <div className="w-16 h-16 border-8 border-black border-t-neo-primary rounded-full animate-spin mb-6"></div>
            <div className="font-display text-2xl font-black uppercase">Loading Yield Data...</div>
          </div>
        )}

        {!isLoading && error && (
          <div className="bg-red-500 border-4 border-black p-8 shadow-neo text-white">
            <div className="flex items-start gap-4">
              <AlertTriangle size={48} className="text-white border-black drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]" />
              <div>
                <div className="font-display text-3xl font-black uppercase drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  Data Fetch Error
                </div>
                <div className="font-mono bg-black text-white p-4 border-2 border-white mt-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]">
                  {error instanceof Error ? error.message : 'Unknown error occurred'}
                </div>
                <div className="font-bold mt-4 font-mono">
                  Make sure `npm run dev` includes the relayer-api!
                </div>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !error && (
          <div className="overflow-x-auto border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
            <table className="min-w-full text-left border-collapse">
              <thead className="bg-black text-white">
                <tr>
                  <th className="px-6 py-4 font-display text-xl uppercase tracking-wider border-b-4 border-black border-r-2">Protocol</th>
                  <th className="px-6 py-4 font-display text-xl uppercase tracking-wider border-b-4 border-black border-r-2">Token</th>
                  <th className="px-6 py-4 font-display text-xl uppercase tracking-wider border-b-4 border-black border-r-2 text-right">APR</th>
                  <th className="px-6 py-4 font-display text-xl uppercase tracking-wider border-b-4 border-black border-r-2 text-right">TVL</th>
                  <th className="px-6 py-4 font-display text-xl uppercase tracking-wider border-b-4 border-black border-r-2 text-center">Risk</th>
                  <th className="px-6 py-4 font-display text-xl uppercase tracking-wider border-b-4 border-black">Time</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {filtered.slice(0, 50).map((row, idx) => (
                  <tr 
                    key={`${row.protocol}:${row.token}:${row.timestamp}`} 
                    className="group hover:bg-yellow-50 transition-colors border-b-2 border-black last:border-b-0"
                  >
                    <td className="px-6 py-4 border-r-2 border-black font-bold uppercase group-hover:text-neo-primary transition-colors">
                      {row.protocol}
                    </td>
                    <td className="px-6 py-4 border-r-2 border-black">
                      <span className="bg-gray-100 px-2 py-1 border border-black rounded font-bold">
                        {formatToken(row.token)}
                      </span>
                    </td>
                    <td className="px-6 py-4 border-r-2 border-black text-right">
                      <span className="text-xl font-black text-green-600 bg-green-50 px-2 py-1 border-2 border-green-600 shadow-[2px_2px_0px_0px_rgba(22,163,74,1)]">
                        {formatApr(row.apr)}
                      </span>
                    </td>
                    <td className="px-6 py-4 border-r-2 border-black text-right text-gray-600">
                      {formatTvl(row.tvl)}
                    </td>
                    <td className="px-6 py-4 border-r-2 border-black text-center">
                      <span className={`inline-block px-3 py-1 font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${formatRiskColor(row.riskScore)}`}>
                        {row.riskScore.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 font-bold">
                      {new Date(row.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-xl font-display uppercase text-gray-400 bg-gray-50">
                      No yield data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex justify-between items-center font-mono text-sm font-bold border-2 border-black bg-white p-3 shadow-neo-sm">
          <span>Showing top {Math.min(filtered.length, 50)} items</span>
          <span>Total: {filtered.length}</span>
        </div>
      </div>
    </section>
  );
};

