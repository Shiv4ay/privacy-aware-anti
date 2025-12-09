import React, { useState, useRef, useEffect } from 'react';
import client from '../api/index';
import { useAuth } from '../contexts/AuthContext';
import { Send, Bot, User, Loader2, MessageSquare, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Chat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const send = async () => {
    if (!message.trim() || loading) return;

    const userMessage = { id: Date.now(), text: message, from: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setLoading(true);

    try {
      const res = await client.post('/api/chat', { query: userMessage.text });

      const aiMessage = {
        id: Date.now() + 1,
        text: res.data?.response || res.data?.message || 'No response received',
        from: 'ai',
        timestamp: new Date(),
        contextUsed: res.data?.context_used || false
      };

      setMessages(prev => [...prev, aiMessage]);
      toast.success('Response received');
    } catch (err) {
      console.error('Chat error', err);
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to get response';
      toast.error(errorMsg);

      const errorMessage = {
        id: Date.now() + 1,
        text: `Error: ${errorMsg}`,
        from: 'error',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="min-h-screen animated-gradient-bg">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-premium-gold/10 mb-4">
            <MessageSquare className="w-8 h-8 text-premium-gold" />
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
            AI Chat Assistant
          </h1>
          <p className="text-gray-400">Powered by RAG • Context-aware responses</p>
        </div>

        {/* Privacy Notice */}
        <div className="glass-panel p-4 rounded-xl mb-6 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-400">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm text-gray-300">
              <strong className="text-white">Privacy Notice:</strong> Queries are redacted for PII and logged for audit.
              Responses are based on documents you have access to.
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="glass-panel-strong rounded-2xl overflow-hidden flex flex-col" style={{ height: '600px' }}>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                <Bot className="w-16 h-16 mb-4 text-premium-gold" />
                <p className="text-lg font-medium text-gray-300">How can I help you today?</p>
                <p className="text-sm text-gray-500 mt-2">Ask questions about your documents</p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.from === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${m.from === 'user' ? 'bg-blue-600' : m.from === 'error' ? 'bg-red-500' : 'bg-premium-gold'
                  }`}>
                  {m.from === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-black" />}
                </div>

                <div className={`max-w-[75%] rounded-2xl p-4 ${m.from === 'user'
                    ? 'bg-blue-600/20 text-blue-100 border border-blue-500/30 rounded-tr-sm'
                    : m.from === 'error'
                      ? 'bg-red-500/10 text-red-200 border border-red-500/30'
                      : 'bg-white/5 text-gray-200 border border-white/10 rounded-tl-sm'
                  }`}>
                  <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  {m.contextUsed && m.from === 'ai' && (
                    <div className="mt-2 pt-2 border-t border-white/5 text-xs text-premium-gold/70 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Based on document context
                    </div>
                  )}
                  <div className="text-xs mt-2 opacity-60">
                    {new Date(m.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 animate-fade-in">
                <div className="w-10 h-10 rounded-full bg-premium-gold flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-black" />
                </div>
                <div className="bg-white/5 rounded-2xl rounded-tl-sm p-4 border border-white/10 flex items-center gap-2">
                  <div className="w-2 h-2 bg-premium-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-premium-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-premium-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 bg-black/20 border-t border-white/5">
            <div className="flex gap-3">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask anything about your documents..."
                disabled={loading}
                className="glass-input flex-1 px-4 py-3 rounded-xl"
              />
              <button
                onClick={send}
                disabled={loading || !message.trim()}
                className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Send
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            <div className="text-center mt-3 text-xs text-gray-500">
              AI can make mistakes. Please verify important information.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
