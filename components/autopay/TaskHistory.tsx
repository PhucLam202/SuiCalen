import React from 'react';
import { useTaskEvents } from '../../hooks/useTaskEvents';
import { Clock, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react';

export const TaskHistory: React.FC = () => {
  const { events, loading } = useTaskEvents();

  if (loading && events.length === 0) {
    return <div className="font-mono animate-pulse text-center p-8">Loading history...</div>;
  }

  if (events.length === 0) {
    return (
      <div className="bg-white border-4 border-black p-8 shadow-neo-lg w-full text-center">
        <p className="font-mono text-gray-500">No activity history found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border-4 border-black p-8 shadow-neo-lg w-full">
      <h2 className="font-display text-3xl font-black uppercase mb-8 border-b-4 border-black pb-2">
        Activity History
      </h2>

      <div className="space-y-6 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-1 before:bg-black">
        {events.map((event, idx) => (
          <div key={`${event.id?.txDigest || 'tx'}-${event.id?.eventSeq || idx}`} className="flex gap-6 relative">
            <div className={`w-10 h-10 rounded-none border-2 border-black flex items-center justify-center shrink-0 z-10 ${getEventBg(event.type)}`}>
              {getEventIcon(event.type)}
            </div>
            
            <div className="bg-gray-50 border-2 border-black p-4 flex-grow shadow-neo-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="font-display font-bold uppercase text-sm px-2 py-0.5 border border-black bg-white">
                  {event.type.split('::').pop()}
                </span>
                <span className="font-mono text-xs text-gray-500">
                  {new Date(parseInt(event.timestampMs)).toLocaleString()}
                </span>
              </div>
              
              <div className="font-mono text-sm mb-4">
                {formatEventData(event)}
              </div>

              <a 
                href={`https://suiscan.xyz/testnet/tx/${event.id.txDigest}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-mono font-bold underline hover:text-neo-primary"
              >
                View on Explorer <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const getEventIcon = (type: string) => {
  if (type.endsWith('TaskCreated')) return <Clock size={20} />;
  if (type.endsWith('TaskExecuted')) return <CheckCircle size={20} />;
  if (type.endsWith('TaskCancelled')) return <XCircle size={20} />;
  return <AlertCircle size={20} />;
};

const getEventBg = (type: string) => {
  if (type.endsWith('TaskCreated')) return 'bg-blue-400';
  if (type.endsWith('TaskExecuted')) return 'bg-green-400';
  if (type.endsWith('TaskCancelled')) return 'bg-red-400';
  return 'bg-yellow-400';
};

const formatEventData = (event: any) => {
  const data = event.parsedJson;
  const type = event.type;
  
  if (type.endsWith('TaskCreated')) {
    return (
      <div className="space-y-1">
        <p>Created new task to pay <span className="font-bold">{data.amount / 1e9} SUI</span></p>
        <p className="text-xs text-gray-600">Recipient: {data.recipient.slice(0, 10)}...</p>
      </div>
    );
  }
  
  if (type.endsWith('TaskExecuted')) {
    return (
      <div className="space-y-1">
        <p>Successfully executed payment of <span className="font-bold text-green-600">{data.amount / 1e9} SUI</span></p>
        <p className="text-xs text-gray-600">Relayer: {data.executor.slice(0, 10)}...</p>
        {data.relayer_fee_paid && (
          <p className="text-xs text-gray-600">Fee Paid: <span className="font-bold">{data.relayer_fee_paid / 1e9} SUI</span></p>
        )}
      </div>
    );
  }

  if (type.endsWith('TaskCancelled')) {
    return <p>Task cancelled by owner.</p>;
  }

  return <p>Event: {type.split('::').pop()}</p>;
};
