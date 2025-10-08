import React, { useEffect } from 'react';

const Toast = ({ message, type = 'info', onClose, duration = 5000 }) => {
    
    // Efeito para fechar o toast automaticamente após a duração definida
    useEffect(() => {
        // Não auto-fecha se a duração for 0 ou se for uma mensagem 'info' (ex: "Salvando...")
        if (duration === 0 || type === 'info') {
            return;
        }

        const timer = setTimeout(() => {
            onClose();
        }, duration);

        // Limpa o timer se o componente for desmontado
        return () => clearTimeout(timer);
    }, [onClose, duration, type]);

    const ICONS = {
        success: 'bi-check-circle-fill',
        error: 'bi-x-circle-fill',
        info: 'bi-info-circle-fill',
    };

    const iconClass = ICONS[type] || ICONS['info'];

    return (
        <div className={`toast-container ${type}`}>
            <i className={`bi ${iconClass} toast-icon`}></i>
            <div className="toast-message">{message}</div>
            <button onClick={onClose} className="toast-close-btn">&times;</button>
        </div>
    );
};

export default Toast;
