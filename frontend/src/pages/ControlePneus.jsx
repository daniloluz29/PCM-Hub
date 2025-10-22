import React, { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import FiltrosSidebar from '../components/FiltrosSidebar.jsx';
import SubAbaAnalisePneus from './ControlePneus/SubAbaAnalisePneus.jsx';
import SubAbaConfiguracaoLayout from './ControlePneus/SubAbaConfiguracaoLayout.jsx';
import SubAbaAnaliseEstados from './ControlePneus/SubAbaAnaliseEstados.jsx';
// NOVO: Importa a nova sub-aba de histórico
import SubAbaHistoricoMedicoes from './ControlePneus/SubAbaHistoricoMedicoes.jsx';

function PaginaControlePneus({ currentUser }) {
    const [abaAtiva, setAbaAtiva] = useState('analise');
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
    const [sidebarContent, setSidebarContent] = useState(null);

    const handleClearFilters = () => {};

    const abas = {
        analise: {
            label: 'Análise de Pneus',
            icon: 'bi-truck-front-fill',
            component: <SubAbaAnalisePneus currentUser={currentUser} isActive={abaAtiva === 'analise'} setSidebarContent={setSidebarContent} />
        },
        analise_estados: {
            label: 'Análise de Estados',
            icon: 'bi-bar-chart-line-fill',
            component: <SubAbaAnaliseEstados currentUser={currentUser} isActive={abaAtiva === 'analise_estados'} setSidebarContent={setSidebarContent} />
        },
        // NOVO: Adiciona a aba de histórico
        historico: {
            label: 'Histórico de Medições',
            icon: 'bi-calendar-week-fill',
            component: <SubAbaHistoricoMedicoes currentUser={currentUser} isActive={abaAtiva === 'historico'} setSidebarContent={setSidebarContent} />
        },
        configuracao: {
            label: 'Configuração de Layouts',
            icon: 'bi-gear-wide-connected',
            component: <SubAbaConfiguracaoLayout currentUser={currentUser} isActive={abaAtiva === 'configuracao'} setSidebarContent={setSidebarContent} />
        }
    };

    return (
        <div className="page-container">
            <FiltrosSidebar
                isExpanded={isSidebarExpanded}
                onToggle={setIsSidebarExpanded}
                onClearFilters={handleClearFilters}
            >
                {sidebarContent}
            </FiltrosSidebar>

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

