import React, { useState } from 'react';
import { MessageSquare, Lock, Users, ArrowRight } from 'lucide-react';

type ChatTab = 'public' | 'private' | 'alliance';

interface ChatSystemProps {
  lastSharedSnippet?: string;
}

/**
 * ChatSystem
 * - Right sidebar with tabbed communication channels.
 * - Public, private and alliance tabs simulated by local state.
 * - Private tab includes a quick "trade request" card.
 */
const ChatSystem: React.FC<ChatSystemProps> = ({ lastSharedSnippet }) => {
  const [activeTab, setActiveTab] = useState<ChatTab>('public');
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;
    setInputValue('');
  };

  const baseTabClass =
    'flex-1 px-2 py-1 text-[11px] text-center rounded-md border border-transparent cursor-pointer';

  const renderTabs = () => (
    <div className="flex gap-2 mb-3">
      <button
        type="button"
        onClick={() => setActiveTab('public')}
        className={
          activeTab === 'public'
            ? `${baseTabClass} bg-slate-900 border-slate-700 text-slate-100`
            : `${baseTabClass} text-slate-500 hover:bg-slate-900/60`
        }
      >
        <MessageSquare size={12} className="inline mr-1" />
        Public
      </button>
      <button
        type="button"
        onClick={() => setActiveTab('private')}
        className={
          activeTab === 'private'
            ? `${baseTabClass} bg-slate-900 border-slate-700 text-slate-100`
            : `${baseTabClass} text-slate-500 hover:bg-slate-900/60`
        }
      >
        <Lock size={12} className="inline mr-1" />
        Private
      </button>
      <button
        type="button"
        onClick={() => setActiveTab('alliance')}
        className={
          activeTab === 'alliance'
            ? `${baseTabClass} bg-slate-900 border-slate-700 text-slate-100`
            : `${baseTabClass} text-slate-500 hover:bg-slate-900/60`
        }
      >
        <Users size={12} className="inline mr-1" />
        Alliance
      </button>
    </div>
  );

  const renderTradeCard = () => (
    <div className="mb-3 rounded-xl border border-emerald-600/60 bg-emerald-500/5 px-3 py-2 text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-100 font-medium">Quick trade request</span>
        <span className="text-[10px] text-emerald-300 uppercase tracking-widest">Draft</span>
      </div>
      <p className="text-[11px] text-slate-200 mb-1">
        Offer part of your surplus cash in exchange for information or alliance support.
      </p>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-200"
        onClick={() =>
          setInputValue(
            'Propose trade: I offer part of my surplus cash in exchange for intel on regional risk.',
          )
        }
      >
        Insert trade template
        <ArrowRight size={12} />
      </button>
    </div>
  );

  const renderBody = () => {
    if (activeTab === 'public') {
      return (
        <div className="flex-1 text-[11px] text-slate-400 mb-2">
          Public channel is visible to all participants.
        </div>
      );
    }
    if (activeTab === 'private') {
      return (
        <>
          {renderTradeCard()}
          {lastSharedSnippet && (
            <div className="mb-2 text-[11px] text-slate-300">
              Shared from narrative:
              <span className="block mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px]">
                {lastSharedSnippet}
              </span>
            </div>
          )}
          <div className="flex-1 text-[11px] text-slate-400 mb-2">
            Private messages are only visible to selected counterparties.
          </div>
        </>
      );
    }
    return (
      <div className="flex-1 text-[11px] text-slate-400 mb-2">
        Alliance channel is intended for coalition coordination and shared plans.
      </div>
    );
  };

  return (
    <section className="h-full flex flex-col bg-[#0a0a0b] border border-slate-800 rounded-2xl px-4 py-4">
      <div className="text-xs text-slate-300 uppercase tracking-[0.25em] mb-2">
        Communication hub
      </div>
      {renderTabs()}
      {renderBody()}
      <div className="mt-auto flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none"
        />
        <button
          type="button"
          onClick={handleSend}
          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-900 text-xs font-semibold hover:bg-slate-300"
        >
          Send
        </button>
      </div>
    </section>
  );
};

export default ChatSystem;


