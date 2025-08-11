import React from 'react';

/**
 * Um componente de Modal de Confirmação, com botões "Confirmar" e "Cancelar".
 * @param {object} props - As propriedades do componente.
 * @param {boolean} props.isOpen - Se o modal deve ou não ser exibido.
 * @param {function} props.onClose - Função a ser chamada para fechar o modal (pelo overlay, botão 'x' ou botão 'Cancelar').
 * @param {function} props.onConfirm - Função a ser chamada quando o usuário clica no botão "Confirmar".
 * @param {string} props.title - O título a ser exibido no cabeçalho do modal.
 * @param {React.ReactNode} props.children - O conteúdo (pergunta de confirmação) a ser exibido no corpo do modal.
 */
const ModalConfirmacao = ({ isOpen, onClose, onConfirm, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            {/* Adicionada a classe específica 'modal-small-content' */}
            <div className="modal-content modal-small-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title || 'Confirmação'}</h3>
                    <button onClick={onClose} className="modal-close-btn">&times;</button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                <div className="modal-footer">
                    <button onClick={onClose} className="modal-button cancel">Cancelar</button>
                    <button onClick={onConfirm} className="modal-button confirm">Confirmar</button>
                </div>
            </div>
        </div>
    );
};

export default ModalConfirmacao;
