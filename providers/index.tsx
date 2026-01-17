import React from 'react';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { networkConfig } from './SuiProvider';
import '@mysten/dapp-kit/dist/index.css';

interface SuiAppProviderProps {
  children: React.ReactNode;
}

const queryClient = new QueryClient();

export const SuiAppProvider: React.FC<SuiAppProviderProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
};
