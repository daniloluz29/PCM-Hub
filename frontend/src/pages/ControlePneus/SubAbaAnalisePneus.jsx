import React from 'react';

function SubAbaAnalisePneus({ currentUser, isActive }) {
    return (
        <div className={`sub-tab-content ${isActive ? 'active' : ''}`}>
            <h2>Análise de Pneus</h2>
            {/* Conteúdo da aba de análise de pneus */}
        </div>
    );
}

export default SubAbaAnalisePneus;
