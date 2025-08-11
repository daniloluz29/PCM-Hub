import React, { useState } from 'react';
import FiltrosSidebar from '../components/FiltrosSidebar.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SubAbaRealizadas from './Preventivas/SubAbaRealizadas.jsx';
import SubAbaPendentes from './Preventivas/SubAbaPendentes.jsx';

function PaginaOrdensPreventivas({ globalFilters, currentUser }) {
    const [abaAtiva, setAbaAtiva] = useState('realizadas');
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
    const [sidebarContent, setSidebarContent] = useState(null);
    const [clearFiltersTrigger, setClearFiltersTrigger] = useState(0);

    const handleClearFilters = () => {
        setClearFiltersTrigger(c => c + 1);
    };

    return (
        <div className="page-container">
            <FiltrosSidebar 
                isExpanded={isSidebarExpanded} 
                onToggle={setIsSidebarExpanded}
                onClearFilters={handleClearFilters} // CORREÇÃO: Passando a prop para o componente filho
            >
                {sidebarContent}
            </FiltrosSidebar>

            <main className={`content-area ${isSidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
                <PageHeader 
                    icon="bi-shield-check"
                    title="Análise de Manutenção Preventiva"
                    subtitle="Acompanhe os principais indicadores e o desempenho do seu plano."
                />
                
                <div className="segmented-control-container">
                    <button 
                        className={`segmented-control-button ${abaAtiva === 'realizadas' ? 'active' : ''}`}
                        onClick={() => setAbaAtiva('realizadas')}
                    >
                        <i className="bi bi-check-circle-fill"></i>
                        <span>Realizadas</span>
                    </button>
                    <button 
                        className={`segmented-control-button ${abaAtiva === 'pendentes' ? 'active' : ''}`}
                        onClick={() => setAbaAtiva('pendentes')}
                    >
                        <i className="bi bi-clock-history"></i>
                        <span>Pendentes</span>
                    </button>
                </div>

                <div className="sub-tab-content">
                    {/* ATUALIZAÇÃO: Adicionada a prop 'isActive' para cada sub-aba */}
                    <div style={{ display: abaAtiva === 'realizadas' ? 'block' : 'none' }}>
                        <SubAbaRealizadas 
                            setSidebarContent={setSidebarContent} 
                            globalFilters={globalFilters} 
                            currentUser={currentUser} 
                            clearFiltersTrigger={clearFiltersTrigger} 
                            isActive={abaAtiva === 'realizadas'}
                        />
                    </div>
                    <div style={{ display: abaAtiva === 'pendentes' ? 'block' : 'none' }}>
                        <SubAbaPendentes 
                            setSidebarContent={setSidebarContent} 
                            globalFilters={globalFilters} 
                            currentUser={currentUser} 
                            clearFiltersTrigger={clearFiltersTrigger} 
                            isActive={abaAtiva === 'pendentes'}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}

export default PaginaOrdensPreventivas;
