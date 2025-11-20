import React, { useState, useRef, useEffect } from 'react'
import client from '../api/index'
import { useAuth } from '../contexts/AuthContext'

export default function Chat() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)
  const { user } = useAuth()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const send = async () => {
    if (!message.trim() || loading) return

    const userMessage = { id: Date.now(), text: message, from: 'user', timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    setMessage('')
    setLoading(true)
    setError(null)

    try {
      const res = await client.post('/api/chat', { query: userMessage.text })
      
      const aiMessage = {
        id: Date.now() + 1,
        text: res.data?.response || res.data?.message || 'No response received',
        from: 'ai',
        timestamp: new Date(),
        contextUsed: res.data?.context_used || false
      }
      
      setMessages(prev => [...prev, aiMessage])
    } catch (err) {
      console.error('Chat error', err)
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to get response'
      setError(errorMsg)
      
      const errorMessage = {
        id: Date.now() + 1,
        text: `Error: ${errorMsg}`,
        from: 'error',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-4">Chat with Documents</h2>
      
      {/* Privacy Notice */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-800">
            <strong>Privacy Notice:</strong> Your queries are redacted for PII (emails, phones, SSNs) and logged for audit. 
            Responses are based on documents you have access to.
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 flex-1 overflow-y-auto p-4 min-h-[400px] max-h-[600px]">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">Start a conversation</p>
            <p className="text-sm">Ask questions about your documents and get AI-powered answers</p>
          </div>
        )}
        <div className="space-y-4">
          {messages.map(m => (
            <div
              key={m.id}
              className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  m.from === 'user'
                    ? 'bg-blue-600 text-white'
                    : m.from === 'error'
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{m.text}</div>
                {m.contextUsed && m.from === 'ai' && (
                  <div className="text-xs mt-2 text-gray-600 italic">
                    ✓ Based on document context
                  </div>
                )}
                <div className="text-xs mt-1 opacity-70">
                  {new Date(m.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex gap-2">
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          disabled={loading}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        />
        <button
          onClick={send}
          disabled={loading || !message.trim()}
          className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>

      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}
