import React, { useState, useEffect } from 'react';
import Calculadora from './Calculadora.jsx'; // Importa o novo componente

const StatusBar = () => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isCalculadoraOpen, setIsCalculadoraOpen] = useState(false); // Estado para a calculadora

    // Efeito para monitorar o estado de tela cheia
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);
    
    // Função para entrar/sair da tela cheia
    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Erro ao tentar entrar em tela cheia: ${err.message} (${err.name})`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    // Efeito para sincronizar com a tecla F11
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'F11') {
                event.preventDefault();
                toggleFullScreen();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <>
            <div className="status-bar">
                <div className="status-bar-info">
                    {/* Espaço para informações futuras */}
                </div>
                <div className="status-bar-controls">
                    {/* Botão da Calculadora */}
                    <button 
                        className="status-bar-button" 
                        onClick={() => setIsCalculadoraOpen(prev => !prev)} 
                        title="Abrir Calculadora"
                    >
                        <i className="bi bi-calculator-fill"></i>
                    </button>

                    {/* Botão de Tela Cheia */}
                    <button className="status-bar-button" onClick={toggleFullScreen} title={isFullscreen ? "Sair da Tela Cheia" : "Entrar em Tela Cheia"}>
                        {isFullscreen ? (
                            <i className="bi bi-fullscreen-exit"></i>
                        ) : (
                            <i className="bi bi-fullscreen"></i>
                        )}
                    </button>
                </div>
            </div>
            {/* Renderização condicional da Calculadora */}
            {isCalculadoraOpen && <Calculadora onClose={() => setIsCalculadoraOpen(false)} />}
        </>
    );
};

export default StatusBar;

