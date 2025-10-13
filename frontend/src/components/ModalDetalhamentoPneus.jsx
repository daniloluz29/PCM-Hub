import React, { useState, useEffect } from 'react';
import EsqueletoPreview from './EsqueletoPreview.jsx';
import Modal from './Modal.jsx';

const API_BASE_URL = 'http://127.0.0.1:5000';

function ModalDetalhamentoPneus({ equipamento, onCancel }) {
    const [detalhesData, setDetalhesData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
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
        setIsInfoModalOpen(true);
    };

    const renderInfoModalContent = () => {
        if (!selectedPneu) return null;

        if (!selectedPneu.dados) {
            return (
                <div className="placeholder-message" style={{ padding: '20px', margin: 0, border: 'none', background: 'transparent' }}>
                    <div className="icon"><i className="bi bi-box"></i></div>
                    <h4>Posição Vazia</h4>
                    <p>Nenhum pneu agregado a esta posição no momento.</p>
                </div>
            );
        }
        
        const { dados } = selectedPneu;
        
        if (!dados.faixa_info) {
             return (
                <div className="info-pneu-content">
                    <div className="info-pneu-item">
                        <strong>Pneu (Nº Fogo):</strong>
                        <span>{dados.num_fogo || 'N/A'}</span>
                    </div>
                     <div className="placeholder-message" style={{padding: '20px 0'}}>
                        <div className="icon"><i className="bi bi-rulers"></i></div>
                        <p>Este pneu ainda não possui medições registradas.</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="info-pneu-content">
                <div className="info-pneu-item">
                    <strong>Pneu (Nº Fogo):</strong>
                    <span>{dados.num_fogo || 'N/A'}</span>
                </div>
                <div className="info-pneu-item">
                    <strong>Última Medição:</strong>
                    <span>{dados.medicao != null ? `${dados.medicao} mm` : 'N/A'}</span>
                </div>
                <div className="info-pneu-item">
                    <strong>Faixa:</strong>
                    <span>{dados.faixa_info.nome_faixa}</span>
                </div>
                <div className="info-pneu-item">
                    <strong>Status:</strong>
                    <span>{dados.faixa_info.status}</span>
                </div>
                <div className="info-pneu-item">
                    <strong>Cor:</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{dados.faixa_info.cor}</span>
                        <div className="color-swatch" style={{ backgroundColor: dados.faixa_info.cor }}></div>
                    </div>
                </div>
                 <div className="info-pneu-item">
                    <strong>Data da Medição:</strong>
                    <span>{dados.data_medicao || 'N/A'}</span>
                </div>
            </div>
        );
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
            
            <Modal
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
                title={`Detalhes do Pneu - Posição ${selectedPneu?.numero || ''}`}
                size="default"
            >
                {renderInfoModalContent()}
            </Modal>
        </>
    );
}

export default ModalDetalhamentoPneus;

