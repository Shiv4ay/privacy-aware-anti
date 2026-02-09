import React, { useState } from 'react';
import client from '../api/index';

export default function ChatTest() {
    const [result, setResult] = useState('');

    const testConversationMemory = async () => {
        try {
            const conversationHistory = [
                { role: 'user', content: 'Tell me about John Fritz' },
                { role: 'assistant', content: 'John Fritz is a student with GPA 2.72 at Microsoft' }
            ];

            const res = await client.post('/chat', {
                query: 'what is his GPA?',
                conversation_history: conversationHistory
            });

            setResult(JSON.stringify(res.data, null, 2));
        } catch (err) {
            setResult(`Error: ${err.message}`);
        }
    };

    return (
        <div className="p-8">
            <button
                onClick={testConversationMemory}
                className="bg-blue-500 text-white px-4 py-2 rounded"
            >
                Test Conversation Memory
            </button>
            <pre className="mt-4 p-4 bg-gray-100 rounded">{result}</pre>
        </div>
    );
}
