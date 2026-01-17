import React, { useMemo } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';

interface SuiWalletButtonProps {
  className?: string;
  showAddress?: boolean;
  variant?: 'default' | 'custom';
}

/**
 * SuiWalletButton - Wallet connect button using @mysten/dapp-kit
 * Click to open wallet selection modal
 * Displays connection status and wallet address when connected
 */
export const SuiWalletButton: React.FC<SuiWalletButtonProps> = React.memo(({ 
  className = '', 
  showAddress = false,
  variant = 'default'
}) => {
  const account = useCurrentAccount();
  const connected = !!account;
  const address = account?.address;

  const formattedAddress = useMemo(() => {
    if (!showAddress || !connected || !address) return null;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [showAddress, connected, address]);

  const AddressDisplay = useMemo(() => {
    if (!formattedAddress) return null;
    return (
      <div className="mt-2 text-xs font-mono text-gray-600 truncate max-w-[200px] bg-white/50 backdrop-blur-sm px-2 py-1 rounded border border-white/40">
        {formattedAddress}
      </div>
    );
  }, [formattedAddress]);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative group">
        {!connected && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            Powered by Sui zkLogin
          </div>
        )}
        
        <ConnectButton 
          connectText={
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                 <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center border border-gray-200 shadow-sm z-10">
                   <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="G" className="w-3 h-3" />
                 </div>
                 <div className="w-5 h-5 bg-[#1877F2] rounded-full flex items-center justify-center border border-white shadow-sm z-0">
                   <span className="text-white font-bold text-[10px]">f</span>
                 </div>
              </div>
              <span>Sign in with Google</span>
            </div> as any
          } 
          className="glass !bg-white/80 !border !border-neo-primary/30 !text-black !font-display !font-bold !rounded-lg !shadow-soft !px-4 !py-3 hover:!scale-105 hover:!shadow-soft-lg transition-all !duration-300" 
        />
      </div>
      {AddressDisplay}
    </div>
  );
});
