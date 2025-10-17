import React from 'react';
import Modal from '../../components/Modal.jsx';

function ModalDetalhamentoPneus({ isOpen, onClose, pneuSelecionado }) {
    if (!isOpen) return null;

    const renderConteudo = () => {
        if (!pneuSelecionado) return null;

        if (!pneuSelecionado.dados) {
            return (
                <div className="placeholder-message" style={{ padding: '20px', margin: 0, border: 'none', background: 'transparent' }}>
                    <div className="icon"><i className="bi bi-box"></i></div>
                    <h4>Posição Vazia</h4>
                    <p>Nenhum pneu agregado a esta posição no momento.</p>
                </div>
            );
        }
        
        const { dados } = pneuSelecionado;
        
        if (!dados.faixa_info) {
             return (
                <div className="info-pneu-content">
                    <div className="info-pneu-item">
                        <strong>Pneu (Nº Fogo):</strong>
                        <span>{dados.num_fogo || 'N/A'}</span>
                    </div>
                     <div className="placeholder-message" style={{padding: '20px 0'}}>
                        <div className="icon"><i className="bi-clipboard-x"></i></div>
                        <p>Este pneu ainda não possui medições registadas.</p>
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
                    <strong>Data da Medição:</strong>
                    <span>{dados.data_medicao || 'N/A'}</span>
                </div>
            </div>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Detalhes do Pneu - Posição ${pneuSelecionado?.numero || ''}`}
            size="default"
        >
            {renderConteudo()}
        </Modal>
    );
}

export default ModalDetalhamentoPneus;

