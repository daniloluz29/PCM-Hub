import React from 'react';

/**
 * Um componente de Modal de Alerta, com um único botão "OK".
 * @param {object} props - As propriedades do componente.
 * @param {boolean} props.isOpen - Se o modal deve ou não ser exibido.
 * @param {function} props.onClose - Função a ser chamada quando o modal for fechado (pelo overlay, botão 'x' ou botão 'OK').
 * @param {string} props.title - O título a ser exibido no cabeçalho do modal.
 * @param {React.ReactNode} props.children - O conteúdo (mensagem) a ser exibido no corpo do modal.
 */
const ModalAlerta = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            {/* Adicionada a classe específica 'modal-small-content' */}
            <div className="modal-content modal-small-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title || 'Alerta'}</h3>
                    <button onClick={onClose} className="modal-close-btn">&times;</button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
                    <button onClick={onClose} className="modal-button confirm" style={{ backgroundColor: '#007bff' }}>
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalAlerta;
