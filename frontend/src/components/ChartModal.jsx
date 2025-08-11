import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';

/**
 * Modal para exibir um gráfico em "Modo Foto" e permitir a cópia como imagem.
 * @param {object} props
 * @param {boolean} props.isOpen - Se o modal está aberto.
 * @param {function} props.onClose - Função para fechar o modal.
 * @param {string} props.chartTitle - O título do gráfico.
 * @param {React.ReactNode} props.children - O componente de gráfico a ser renderizado.
 */
const ChartModal = ({ isOpen, onClose, chartTitle, children }) => {
    if (!isOpen) return null;
    
    const chartContainerRef = useRef(null);
    const [copyStatus, setCopyStatus] = useState('Copiar Imagem');

    const handleCopyChart = () => {
        if (chartContainerRef.current) {
            setCopyStatus('Copiando...');
            html2canvas(chartContainerRef.current, { backgroundColor: '#ffffff', scale: 2 }).then(canvas => {
                canvas.toBlob(blob => {
                    if (typeof ClipboardItem === "undefined") {
                         setCopyStatus('API indisponível');
                         console.error("A API ClipboardItem não está disponível neste navegador.");
                         setTimeout(() => { setCopyStatus('Copiar Imagem'); }, 2000);
                         return;
                    }
                    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                        .then(() => {
                            setCopyStatus('Copiado!');
                            setTimeout(() => { setCopyStatus('Copiar Imagem'); onClose(); }, 1500);
                        })
                        .catch(err => {
                            setCopyStatus('Falhou!');
                            console.error("Erro ao copiar para a área de transferência:", err);
                        });
                });
            });
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content chart-modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header"><h3>{chartTitle}</h3><button onClick={onClose} className="modal-close-btn">&times;</button></div>
                <div className="chart-modal-body" ref={chartContainerRef}>
                    <div style={{ width: '100%', height: '400px' }}>
                        {children}
                    </div>
                </div>
                <div className="modal-footer chart-modal-footer">
                    <button onClick={handleCopyChart} className="modal-button confirm"><i className="bi bi-clipboard-check"></i> {copyStatus}</button>
                </div>
            </div>
        </div>
    );
};

export default ChartModal;
