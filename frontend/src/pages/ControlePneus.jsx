import React, { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
// NOVO: Importa o componente da sidebar de filtros.
import FiltrosSidebar from '../components/FiltrosSidebar.jsx';
// Caminhos atualizados para os novos componentes na subpasta
import SubAbaAnalisePneus from './ControlePneus/SubAbaAnalisePneus.jsx';
import SubAbaConfiguracaoLayout from './ControlePneus/SubAbaConfiguracaoLayout.jsx';

function PaginaControlePneus({ currentUser }) {
    const [abaAtiva, setAbaAtiva] = React.useState('analise'); // Mudei para 'configuracao' para vermos a nova tela primeiro
    // NOVO: Adiciona os estados para controlar a sidebar.
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
    const [sidebarContent, setSidebarContent] = useState(null);

    // NOVO: Função para limpar filtros (atualmente sem ação, para manter o padrão).
    const handleClearFilters = () => {
        // Futuramente, esta função poderá resetar estados de filtros das sub-abas.
    };

    const abas = {
        analise: {
            label: 'Análise de Pneus',
            icon: 'bi-truck-front-fill',
            // ALTERADO: Passa a função para definir o conteúdo da sidebar.
            component: <SubAbaAnalisePneus currentUser={currentUser} isActive={abaAtiva === 'analise'} setSidebarContent={setSidebarContent} />
        },
        configuracao: {
            label: 'Configuração de Layouts',
            icon: 'bi-gear-wide-connected',
            // ALTERADO: Passa a função para definir o conteúdo da sidebar.
            component: <SubAbaConfiguracaoLayout currentUser={currentUser} isActive={abaAtiva === 'configuracao'} setSidebarContent={setSidebarContent} />
        }
    };

    return (
        <div className="page-container">
            {/* NOVO: Adiciona a sidebar de filtros ao layout da página. */}
            <FiltrosSidebar
                isExpanded={isSidebarExpanded}
                onToggle={setIsSidebarExpanded}
                onClearFilters={handleClearFilters}
            >
                {sidebarContent}
            </FiltrosSidebar>

            {/* ALTERADO: A classe do 'main' agora é dinâmica com base no estado da sidebar. */}
            <main className={`content-area ${isSidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
                <PageHeader 
                    icon="bi-truck"
                    title="Controle de Pneus"
                    subtitle="Análise de medições e configuração de layouts de equipamentos."
                />
                
                <div className="segmented-control-container">
                    {Object.keys(abas).map(key => (
                        <button 
                            key={key}
                            className={`segmented-control-button ${abaAtiva === key ? 'active' : ''}`}
                            onClick={() => setAbaAtiva(key)}
                        >
                            <i className={`bi ${abas[key].icon}`}></i>
                            <span>{abas[key].label}</span>
                        </button>
                    ))}
                </div>

                <div className="sub-tab-content">
                    {Object.keys(abas).map(key => (
                        <div key={key} style={{ display: abaAtiva === key ? 'block' : 'none' }}>
                            {abas[key].component}
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}

export default PaginaControlePneus;

