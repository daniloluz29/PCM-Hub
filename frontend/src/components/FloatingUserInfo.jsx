import React, { useState } from 'react';

function FloatingUserInfo({ currentUser }) {
    // Estado para controlar se o widget está recolhido ou expandido
    const [isCollapsed, setIsCollapsed] = useState(false);

    if (!currentUser) {
        return null;
    }

    // Pega as iniciais do nome para o avatar
    const getInitials = (name) => {
        if (!name) return '?';
        const names = name.split(' ');
        const initials = names.map(n => n[0]).join('');
        return initials.substring(0, 2).toUpperCase();
    };

    // Adiciona a classe 'collapsed' dinamicamente com base no estado
    const containerClasses = `floating-user-info ${isCollapsed ? 'collapsed' : ''}`;

    return (
        // A função onClick agora alterna o estado
        <div className={containerClasses} onClick={() => setIsCollapsed(!isCollapsed)}>
            <div className="avatar">
                {getInitials(currentUser.nome)}
            </div>
            <div className="user-details">
                <p className="user-name">{currentUser.nome}</p>
                <p className="user-matricula">Matrícula: {currentUser.matricula}</p>
            </div>
        </div>
    );
}

export default FloatingUserInfo;
