import React, { useState } from 'react';
import TabAnuncios from './Comunidade/TabAnuncios.jsx'; // Importa o novo componente
import TabCatalogo from './Comunidade/TabCatalogo.jsx';
import TabAgenda from './Comunidade/TabAgenda.jsx';

// --- O COMPONENTE PRINCIPAL DA PÁGINA ---
function PaginaComunidade({ currentUser }) { // Recebe currentUser
    // Define 'anuncios' como a aba ativa inicial
    const [abaAtiva, setAbaAtiva] = useState('anuncios');
    
    return (
        <div className="page-container">
            <main className="content-area" style={{marginLeft: '2rem'}}>
                <div className="page-header">
                    <h1>Comunidade</h1>
                    <p>Conecte-se com a equipe de manutenção e fique por dentro dos eventos.</p>
                </div>
                <div className="tabs-container">
                    {/* Novo botão para a aba Anúncios */}
                    <button className={`tab-item ${abaAtiva === 'anuncios' ? 'active' : ''}`} onClick={() => setAbaAtiva('anuncios')}>Anúncios</button>
                    <button className={`tab-item ${abaAtiva === 'catalogo' ? 'active' : ''}`} onClick={() => setAbaAtiva('catalogo')}>Catálogo de Contatos</button>
                    <button className={`tab-item ${abaAtiva === 'agenda' ? 'active' : ''}`} onClick={() => setAbaAtiva('agenda')}>Agenda de Eventos</button>
                </div>
                <div className="tab-content">
                    {/* Lógica de renderização para a nova aba */}
                    <div style={{ display: abaAtiva === 'anuncios' ? 'block' : 'none' }}>
                        <TabAnuncios currentUser={currentUser} />
                    </div>
                    <div style={{ display: abaAtiva === 'catalogo' ? 'block' : 'none' }}>
                        <TabCatalogo />
                    </div>
                    <div style={{ display: abaAtiva === 'agenda' ? 'block' : 'none' }}>
                        <TabAgenda currentUser={currentUser} />
                    </div>
                </div>
            </main>
        </div>
    );
}

export default PaginaComunidade;
