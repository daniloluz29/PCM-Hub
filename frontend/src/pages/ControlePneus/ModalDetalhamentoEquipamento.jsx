import React, { useState, useEffect } from 'react';
import EsqueletoPreview from './EsqueletoPreview.jsx';
// NOVO: Importa o novo modal de detalhamento de pneus
import ModalDetalhamentoPneus from './ModalDetalhamentoPneus.jsx';

const API_BASE_URL = 'http://127.0.0.1:5000';

// ALTERADO: O nome do componente foi atualizado
function ModalDetalhamentoEquipamento({ equipamento, onCancel }) {
    const [detalhesData, setDetalhesData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // ALTERADO: A lógica do modal de info foi movida para o novo componente
    const [isPneuModalOpen, setIsPneuModalOpen] = useState(false);
    const [selectedPneu, setSelectedPneu] = useState(null);

    useEffect(() => {
        if (!equipamento || !equipamento.equipamento) {
            setDetalhesData(null);
            setIsLoading(false);
            return;
        }

        const fetchDetalhes = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`${API_BASE_URL}/api/pneus/inspecoes/${equipamento.equipamento}`);
                if (!response.ok) {
                    if (response.status === 404) throw new Error('Nenhum layout de pneus encontrado para este tipo de equipamento.');
                    throw new Error('Falha ao buscar os detalhes do equipamento.');
                }
                const data = await response.json();
                setDetalhesData(data);
            } catch (err) {
                setError(err.message);
                setDetalhesData(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetalhes();
    }, [equipamento]);

    const handlePneuClick = (pneu) => {
        setSelectedPneu(pneu);
        setIsPneuModalOpen(true);
    };
    
    const renderContent = () => {
        if (isLoading) {
            return <div style={{ textAlign: 'center', padding: '50px' }}>Carregando layout...</div>;
        }

        if (error) {
            return (
                <div className="placeholder-message error-placeholder" style={{ padding: '30px' }}>
                    <div className="icon"><i className="bi bi-diagram-3-fill"></i></div>
                    <h4>Layout não Encontrado</h4>
                    <p>Não foi possível carregar o layout para o equipamento <strong>{equipamento?.equipamento || 'desconhecido'}</strong>.</p>
                    
                    {equipamento?.tipo_obj ? (
                        <p style={{marginTop: '10px'}}>
                            Tipo de objeto: <strong>{equipamento.tipo_obj}</strong>
                        </p>
                    ) : (
                         <p style={{marginTop: '10px', fontSize: '12px', color: '#6c757d'}}>
                            (Não foi possível identificar o tipo de objeto.)
                        </p>
                    )}

                    <p style={{ fontSize: '12px', color: '#6c757d', marginTop: '15px' }}>
                        Causa: {error}
                    </p>
                    <p style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                        Verifique na aba "Configuração de Layouts" se existe um layout para este tipo de equipamento.
                    </p>
                </div>
            );
        }

        if (!detalhesData || !detalhesData.layout) {
            return <div style={{ textAlign: 'center', padding: '50px' }}>Não foi possível carregar o layout.</div>;
        }

        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <EsqueletoPreview 
                    configuracao={detalhesData.layout}
                    inspecao={detalhesData.ultima_inspecao}
                    onPneuClick={handlePneuClick}
                />
            </div>
        );
    };

    return (
        <>
            <div className="detalhamento-pneus-container">
                {renderContent()}
            </div>
            
            {/* ALTERADO: Agora chama o novo componente de modal */}
            <ModalDetalhamentoPneus
                isOpen={isPneuModalOpen}
                onClose={() => setIsPneuModalOpen(false)}
                pneuSelecionado={selectedPneu}
            />
        </>
    );
}

// ALTERADO: O nome do componente exportado foi atualizado
export default ModalDetalhamentoEquipamento;
