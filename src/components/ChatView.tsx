import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Wifi, WifiOff, MoreVertical, Trash2, Phone } from 'lucide-react';
import type { ChatMessage, Contact, UserProfile } from '../lib/db';

interface ChatViewProps {
  profile: UserProfile;
  contact: Contact;
  messages: ChatMessage[];
  isOnline: boolean;
  isTyping: boolean;
  onSendMessage: (text: string) => void;
  onBack: () => void;
  onSendTyping: (isTyping: boolean) => void;
  onConnect: (peerId: string) => void;
  onStartCall: (peerId: string) => void;
}

export function ChatView({
  profile,
  contact,
  messages,
  isOnline,
  isTyping,
  onSendMessage,
  onBack,
  onSendTyping,
  onConnect,
  onStartCall,
}: ChatViewProps) {
  const [text, setText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
    onSendTyping(false);
  };

  const handleTextChange = (value: string) => {
    setText(value);
    onSendTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      onSendTyping(false);
    }, 2000);
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts: number) => {
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Сегодня';
    if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: ChatMessage[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const dateStr = formatDate(msg.timestamp);
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      groupedMessages.push({ date: dateStr, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-white/5 bg-slate-950/80 backdrop-blur-lg">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-300 lg:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold">
            {contact.name[0].toUpperCase()}
          </div>
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-white font-semibold text-sm truncate">{contact.name}</h2>
          <div className="flex items-center gap-1.5">
            {isTyping ? (
              <span className="text-indigo-400 text-xs animate-pulse">печатает...</span>
            ) : isOnline ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 text-xs">онлайн</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-slate-500" />
                <span className="text-slate-500 text-xs">оффлайн</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Call button */}
          <button
            onClick={() => onStartCall(contact.peerId)}
            className={`p-2 rounded-xl transition-colors ${
              isOnline
                ? 'hover:bg-emerald-500/20 text-emerald-400'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            disabled={!isOnline}
            title={isOnline ? 'Голосовой звонок' : 'Собеседник оффлайн'}
          >
            <Phone className="w-5 h-5" />
          </button>

          {!isOnline && (
            <button
              onClick={() => onConnect(contact.peerId)}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-400"
              title="Переподключиться"
            >
              <Wifi className="w-5 h-5" />
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-400"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-slate-800 rounded-xl border border-white/10 shadow-2xl overflow-hidden">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-white/5 transition-colors text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Очистить чат
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
              <Send className="w-7 h-7 text-indigo-400" />
            </div>
            <p className="text-slate-400 font-medium">Начните общение</p>
            <p className="text-slate-600 text-sm mt-1">
              {isOnline
                ? 'Отправьте первое сообщение!'
                : 'Собеседник сейчас оффлайн'}
            </p>
          </div>
        )}

        {groupedMessages.map((group) => (
          <div key={group.date}>
            <div className="flex justify-center my-4">
              <span className="px-3 py-1 rounded-full bg-white/5 text-slate-500 text-xs font-medium">
                {group.date}
              </span>
            </div>
            {group.messages.map((msg) => {
              const isMine = msg.from === profile.peerId;
              return (
                <div
                  key={msg.id}
                  className={`flex mb-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2.5 ${
                      isMine
                        ? 'bg-indigo-600 text-white rounded-2xl rounded-br-md'
                        : 'bg-white/10 text-white rounded-2xl rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.text}</p>
                    <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <span className={`text-[10px] ${isMine ? 'text-indigo-200' : 'text-slate-500'}`}>
                        {formatTime(msg.timestamp)}
                      </span>
                      {isMine && (
                        <span className="text-[10px] text-indigo-200">
                          {msg.status === 'delivered' ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start mb-2">
            <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/10">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/5 bg-slate-950/80 backdrop-blur-lg">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Сообщение..."
            className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-all disabled:opacity-30 disabled:hover:bg-indigo-600 active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
