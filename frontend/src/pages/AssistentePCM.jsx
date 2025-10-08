import React, { useState, useEffect, useRef } from 'react';

const AssistentePCM = ({ currentUser }) => {
    // Estado para as mensagens exibidas na tela
    const [messages, setMessages] = useState([
        { id: 1, text: `Olá, ${currentUser.nome}! Sou seu assistente de PCM. Como posso ajudar hoje?`, sender: 'ia' }
    ]);
    // Estado para o histórico completo da conversa a ser enviado para a API
    const [chatHistory, setChatHistory] = useState([
        { role: 'assistant', content: `Olá, ${currentUser.nome}! Sou seu assistente de PCM. Como posso ajudar hoje?` }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessageText = input;
        const userMessageForDisplay = { id: Date.now(), text: userMessageText, sender: 'user' };
        const userMessageForApi = { role: 'user', content: userMessageText };

        // Atualiza a UI imediatamente
        setMessages(prev => [...prev, userMessageForDisplay]);
        setInput('');
        setIsLoading(true);
        
        // Prepara o histórico para a API
        const updatedHistory = [...chatHistory, userMessageForApi];
        setChatHistory(updatedHistory);

        // --- ESTRATÉGIA DE CONTEXTO: JANELA DESLIZANTE SIMPLES ---
        // Mantém as últimas 10 trocas (usuário + assistente) no histórico enviado
        const CONTEXT_WINDOW_SIZE = 20; // 10 trocas = 20 mensagens
        const historyForApi = updatedHistory.slice(-CONTEXT_WINDOW_SIZE);

        try {
            const response = await fetch('http://127.0.0.1:5000/api/assistente/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: historyForApi }) // Envia o histórico limitado
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const iaResponseText = data.response;

            const iaMessageForDisplay = { id: Date.now() + 1, text: iaResponseText, sender: 'ia' };
            const iaMessageForApi = { role: 'assistant', content: iaResponseText };

            // Atualiza a UI com a resposta da IA
            setMessages(prev => [...prev, iaMessageForDisplay]);
            // Atualiza o histórico completo com a resposta da IA
            setChatHistory(prev => [...prev, iaMessageForApi]);

        } catch (error) {
            console.error("Erro ao se comunicar com o assistente:", error);
            const errorMessage = { id: Date.now() + 1, text: "Desculpe, não consegui me conectar. Tente novamente mais tarde.", sender: 'ia' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="page-container">
            <main className="content-area" style={{ marginLeft: '5px' }}>
                <div className="page-header">
                    <h1>Assistente PCM (IA)</h1>
                    <p>Converse com a inteligência artificial para obter insights e ajuda com suas tarefas.</p>
                </div>
                <div className="card">
                    <div className="chat-container">
                        <div className="chat-messages">
                            {messages.map(msg => (
                                <div key={msg.id} className={`message-bubble ${msg.sender}`}>
                                    <div className="message-content">
                                        {msg.sender === 'ia' && <i className="bi bi-robot message-avatar"></i>}
                                        <p>{msg.text}</p>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="message-bubble ia">
                                    <div className="message-content">
                                        <i className="bi bi-robot message-avatar"></i>
                                        <div className="typing-indicator">
                                            <span></span><span></span><span></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        <form className="chat-input-form" onSubmit={handleSendMessage}>
                            <input
                                type="text"
                                className="chat-input"
                                placeholder="Digite sua mensagem..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={isLoading}
                            />
                            <button type="submit" className="send-button" disabled={isLoading || !input.trim()}>
                                <i className="bi bi-send-fill"></i>
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AssistentePCM;
