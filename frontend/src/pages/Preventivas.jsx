import React, { useState } from 'react';
import FiltrosSidebar from '../components/FiltrosSidebar.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SubAbaAderencia from './Preventivas/SubAbaAderencia.jsx';
import SubAbaAntecipacao from './Preventivas/SubAbaAntecipacao.jsx';
import SubAbaPendentesAtraso from './Preventivas/SubAbaPendentesAtraso.jsx';
import SubAbaPendentesDia from './Preventivas/SubAbaPendentesDia.jsx';

function PaginaOrdensPreventivas({ globalFilters, currentUser }) {
    const [abaAtiva, setAbaAtiva] = useState('aderencia');
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
    const [sidebarContent, setSidebarContent] = useState(null);
    const [clearFiltersTrigger, setClearFiltersTrigger] = useState(0);

    const handleClearFilters = () => {
        setClearFiltersTrigger(c => c + 1);
    };

    const abas = {
        aderencia: {
            label: 'Aderência',
            icon: 'bi-check-circle-fill',
            component: <SubAbaAderencia setSidebarContent={setSidebarContent} globalFilters={globalFilters} currentUser={currentUser} clearFiltersTrigger={clearFiltersTrigger} isActive={abaAtiva === 'aderencia'} />
        },
        antecipacao: {
            label: 'Antecipação',
            icon: 'bi-skip-end-circle-fill',
            component: <SubAbaAntecipacao setSidebarContent={setSidebarContent} globalFilters={globalFilters} currentUser={currentUser} clearFiltersTrigger={clearFiltersTrigger} isActive={abaAtiva === 'antecipacao'} />
        },
        pendentes_atraso: {
            label: 'Pendentes (Em atraso)',
            icon: 'bi-exclamation-triangle-fill',
            component: <SubAbaPendentesAtraso setSidebarContent={setSidebarContent} globalFilters={globalFilters} currentUser={currentUser} clearFiltersTrigger={clearFiltersTrigger} isActive={abaAtiva === 'pendentes_atraso'} />
        },
        pendentes_dia: {
            label: 'Pendentes (Em dia)',
            icon: 'bi-clock-history',
            component: <SubAbaPendentesDia setSidebarContent={setSidebarContent} globalFilters={globalFilters} currentUser={currentUser} clearFiltersTrigger={clearFiltersTrigger} isActive={abaAtiva === 'pendentes_dia'} />
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
                    icon="bi-shield-check"
                    title="Análise de Manutenção Preventiva"
                    subtitle="Acompanhe os principais indicadores e o desempenho do seu plano."
                />
                
                <div className="segmented-control-container">
                    {Object.keys(abas).map(key => {
                        const label = abas[key].label;
                        const match = label.match(/(.+)\s\((.+)\)/);
                        let buttonLabel;

                        if (match) {
                            buttonLabel = (
                                <span className="button-text-container">
                                    <span className="button-text-main">{match[1]}</span>
                                    <span className="button-text-highlight">{match[2]}</span>
                                </span>
                            );
                        } else {
                            buttonLabel = <span>{label}</span>;
                        }

                        return (
                            <button 
                                key={key}
                                className={`segmented-control-button ${abaAtiva === key ? 'active' : ''}`}
                                onClick={() => setAbaAtiva(key)}
                            >
                                <i className={`bi ${abas[key].icon}`}></i>
                                {buttonLabel}
                            </button>
                        );
                    })}
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

export default PaginaOrdensPreventivas;

