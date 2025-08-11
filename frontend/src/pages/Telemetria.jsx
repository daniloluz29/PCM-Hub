import React, { useState } from 'react';

// --- COMPONENTE INTERNO PARA O CONTEÚDO DE CADA ABA ---
/**
 * Renderiza o conteúdo de uma aba, mostrando um texto genérico
 * para o fornecedor de telemetria selecionado.
 * @param {object} props - As propriedades do componente.
 * @param {string} props.nomeFornecedor - O nome do fornecedor a ser exibido.
 */
function ConteudoFornecedor({ nomeFornecedor }) {
  return (
    <div className="card">
      <h3>Dashboard de Telemetria - {nomeFornecedor}</h3>
      <p>
        Esta área será dedicada aos painéis, gráficos e KPIs específicos
        dos dados de telemetria fornecidos pela <strong>{nomeFornecedor}</strong>.
      </p>
    </div>
  );
}


// --- O COMPONENTE PRINCIPAL DA PÁGINA ---
function PaginaDiagTelemetria() {
    // Estado para controlar qual aba está atualmente ativa. O valor é a chave do fornecedor.
    const [abaAtiva, setAbaAtiva] = useState('caterpillar');

    // Objeto que mapeia as chaves dos fornecedores aos seus nomes de exibição.
    const fornecedores = {
        'caterpillar': 'Caterpillar',
        'komatsu': 'Komatsu',
        'volvo': 'Volvo',
        'john_deere': 'John Deere',
        'metso': 'Metso'
    };

    // Função para renderizar o conteúdo da aba com base no estado 'abaAtiva'.
    const renderTabContent = () => {
        const nomeDoFornecedor = fornecedores[abaAtiva] || 'Caterpillar';
        return <ConteudoFornecedor nomeFornecedor={nomeDoFornecedor} />;
    };

    return (
        <div className="page-container">
            <main className="content-area" style={{marginLeft: '2rem'}}>
                
                {/* Cabeçalho da página */}
                <div className="page-header">
                    <h1>Telemetrias</h1>
                </div>
                
                {/* Container das abas de navegação */}
                <div className="tabs-container">
                    {
                        // Mapeia o objeto de fornecedores para criar um botão para cada um.
                        Object.entries(fornecedores).map(([id, nome]) => (
                            <button 
                                key={id}
                                className={`tab-item ${abaAtiva === id ? 'active' : ''}`}
                                onClick={() => setAbaAtiva(id)}
                            >
                                {nome}
                            </button>
                        ))
                    }
                </div>

                {/* Área onde o conteúdo da aba selecionada é renderizado */}
                <div className="tab-content">
                    {renderTabContent()}
                </div>
            </main>
        </div>
    );
}

export default PaginaDiagTelemetria;
