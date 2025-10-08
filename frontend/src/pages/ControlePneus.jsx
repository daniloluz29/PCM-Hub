import React, { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
// Caminhos atualizados para os novos componentes na subpasta
import SubAbaAnalisePneus from './ControlePneus/SubAbaAnalisePneus.jsx';
import SubAbaConfiguracaoLayout from './ControlePneus/SubAbaConfiguracaoLayout.jsx';

function PaginaControlePneus({ currentUser }) {
    const [abaAtiva, setAbaAtiva] = React.useState('configuracao'); // Mudei para 'configuracao' para vermos a nova tela primeiro

    const abas = {
        analise: {
            label: 'Análise de Pneus',
            icon: 'bi-truck-front-fill',
            component: <SubAbaAnalisePneus currentUser={currentUser} isActive={abaAtiva === 'analise'} />
        },
        configuracao: {
            label: 'Configuração de Layouts',
            icon: 'bi-gear-wide-connected',
            component: <SubAbaConfiguracaoLayout currentUser={currentUser} isActive={abaAtiva === 'configuracao'} />
        }
    };

    return (
        <div className="page-container">
            <main className="content-area sidebar-collapsed">
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
