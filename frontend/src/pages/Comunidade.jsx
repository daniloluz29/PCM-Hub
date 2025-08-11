import React, { useState } from 'react';
import TabCatalogo from './Comunidade/TabCatalogo.jsx';
import TabAgenda from './Comunidade/TabAgenda.jsx';

// --- O COMPONENTE PRINCIPAL DA PÁGINA ---
function PaginaComunidade({ currentUser }) { // Recebe currentUser
    const [abaAtiva, setAbaAtiva] = useState('catalogo');
    
    return (
        <div className="page-container">
            <main className="content-area" style={{marginLeft: '2rem'}}>
                <div className="page-header">
                    <h1>Comunidade</h1>
                    <p>Conecte-se com a equipe de manutenção e fique por dentro dos eventos.</p>
                </div>
                <div className="tabs-container">
                    <button className={`tab-item ${abaAtiva === 'catalogo' ? 'active' : ''}`} onClick={() => setAbaAtiva('catalogo')}>Catálogo de Contatos</button>
                    <button className={`tab-item ${abaAtiva === 'agenda' ? 'active' : ''}`} onClick={() => setAbaAtiva('agenda')}>Agenda de Eventos</button>
                </div>
                <div className="tab-content">
                    <div className="tab-content">
                        <div style={{ display: abaAtiva === 'catalogo' ? 'block' : 'none' }}>
                            <TabCatalogo />
                        </div>
                        <div style={{ display: abaAtiva === 'agenda' ? 'block' : 'none' }}>
                            {/* Passa currentUser para a TabAgenda */}
                            <TabAgenda currentUser={currentUser} />
                        </div>
                    </div>                
                </div>
            </main>
        </div>
    );
}

export default PaginaComunidade;
