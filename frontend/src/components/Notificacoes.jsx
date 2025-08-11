import React, { useState } from 'react';
import ModalNotificacoesControle from './ModalNotificacoesControle.jsx';

function Notificacoes({ isOpen, notificacoes, currentUser, onNavigate, onClose, onRefresh }) {
    const [modalConfigAberto, setModalConfigAberto] = useState(false);

    if (!isOpen) {
        return null;
    }

    const unreadCount = notificacoes.filter(n => !n.lida).length;

    const handleNotificationClick = async (notif) => {
        try {
            await fetch('http://127.0.0.1:5000/api/notificacoes/marcar-como-lida', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario_id: currentUser.id, notificacao_id: notif.id })
            });
        } catch (error) {
            console.error("Erro ao marcar notificação como lida:", error);
        }

        if (notif.link) {
            onNavigate(notif.link);
        }
        
        onClose();
        onRefresh();
    };
    
    const handleMarkAllAsRead = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await fetch('http://127.0.0.1:5000/api/notificacoes/marcar-como-lida', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario_id: currentUser.id, notificacao_id: 'todas' })
            });
            onRefresh();
        } catch (error) {
            console.error("Erro ao marcar todas como lidas:", error);
        }
    };

    const timeSince = (dateString) => {
        const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " anos";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " meses";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " dias";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " horas";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutos";
        return Math.floor(seconds) + " segundos";
    };

    return (
        <>
            <div className="notifications-panel">
                <div className="notifications-header">
                    <h3>Notificações</h3>
                    <div className="header-actions">
                        {unreadCount > 0 && <a href="#" onClick={handleMarkAllAsRead} className="mark-all-read">Marcar todas como lidas</a>}
                        {currentUser.perfil_id === 'master_admin' && (
                            <button className="notification-config-btn" title="Configurar Notificações" onClick={() => setModalConfigAberto(true)}>
                                <i className="bi bi-gear-fill"></i>
                            </button>
                        )}
                    </div>
                </div>
                <div className="notifications-list">
                    {notificacoes.length > 0 ? notificacoes.map(notif => (
                        <div key={notif.id} className={`notification-item ${!notif.lida ? 'unread' : ''}`} onClick={() => handleNotificationClick(notif)}>
                            <div className="notification-icon">
                                <i className={`bi ${notif.icone}`}></i>
                            </div>
                            <div className="notification-content">
                                <p className="notification-text">{notif.texto}</p>
                                <span className="notification-time">há {timeSince(notif.data_criacao)}</span>
                            </div>
                        </div>
                    )) : (
                        <div className="no-notifications">
                            <p>Nenhuma notificação nova.</p>
                        </div>
                    )}
                </div>
            </div>
            {currentUser.perfil_id === 'master_admin' && (
                <ModalNotificacoesControle 
                    isOpen={modalConfigAberto}
                    onClose={() => setModalConfigAberto(false)}
                    currentUser={currentUser}
                />
            )}
        </>
    );
}

export default Notificacoes;
