import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal.jsx';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';

const API_BASE_URL = 'http://127.0.0.1:5000';

function ModalGerenciarPosicoes({ isOpen, onClose, onSave }) {
    const [classificadas, setClassificadas] = useState([]);
    const [pendentes, setPendentes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const [editingRow, setEditingRow] = useState(null);
    // ALTERADO: Agora é um objeto para armazenar o texto de cada input pendente
    const [classificacoesPendentes, setClassificacoesPendentes] = useState({});
    
    const [itemParaExcluir, setItemParaExcluir] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!isOpen) return;
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`${API_BASE_URL}/api/pneus/posicoes`);
                if (!response.ok) throw new Error('Falha ao carregar as posições.');
                const data = await response.json();
                setClassificadas(data.classificadas);
                setPendentes(data.pendentes);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [isOpen]);

    const handleAdicionar = async (nomePosicao) => {
        const classificacao = classificacoesPendentes[nomePosicao];
        if (!classificacao) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/pneus/posicoes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome_posicao: nomePosicao, classificacao: classificacao })
            });
            if (!response.ok) throw new Error('Falha ao adicionar classificação.');
            
            // Limpa o input específico e recarrega tudo
            setClassificacoesPendentes(prev => ({ ...prev, [nomePosicao]: '' }));
            const newDataResponse = await fetch(`${API_BASE_URL}/api/pneus/posicoes`);
            const newData = await newDataResponse.json();
            setClassificadas(newData.classificadas);
            setPendentes(newData.pendentes);
            onSave();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleSalvarEdicao = async (id, classificacao) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/pneus/posicoes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classificacao: classificacao })
            });
            if (!response.ok) throw new Error('Falha ao atualizar classificação.');
            setEditingRow(null);
            
            const newDataResponse = await fetch(`${API_BASE_URL}/api/pneus/posicoes`);
            const newData = await newDataResponse.json();
            setClassificadas(newData.classificadas);
            setPendentes(newData.pendentes);
            onSave();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleExcluir = async () => {
        if (!itemParaExcluir) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/pneus/posicoes/${itemParaExcluir.id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Falha ao excluir classificação.');
            
            const newDataResponse = await fetch(`${API_BASE_URL}/api/pneus/posicoes`);
            const newData = await newDataResponse.json();
            setClassificadas(newData.classificadas);
            setPendentes(newData.pendentes);
            
            setItemParaExcluir(null);
            onSave();
        } catch (err) {
            alert(err.message);
        }
    };

    // NOVO: Handler para atualizar o estado dos inputs pendentes
    const handlePendenteChange = (nomePosicao, valor) => {
        setClassificacoesPendentes(prev => ({
            ...prev,
            [nomePosicao]: valor
        }));
    };

    const renderListaClassificadas = () => (
        <div className="posicoes-list">
            {classificadas.map(item => (
                <div key={item.id} className="posicao-item">
                    <span className="nome-posicao">{item.nome_posicao}</span>
                    {editingRow === item.id ? (
                        <input 
                            type="text"
                            defaultValue={item.classificacao}
                            onBlur={(e) => handleSalvarEdicao(item.id, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSalvarEdicao(item.id, e.target.value)}
                            autoFocus
                        />
                    ) : (
                        <span className="classificacao-posicao" onClick={() => setEditingRow(item.id)}>
                            {item.classificacao}
                        </span>
                    )}
                    <div className="posicao-actions">
                        <button onClick={() => setEditingRow(item.id)} title="Editar"><i className="bi bi-pencil-fill"></i></button>
                        <button onClick={() => setItemParaExcluir(item)} title="Excluir"><i className="bi bi-trash-fill"></i></button>
                    </div>
                </div>
            ))}
        </div>
    );
    
    const renderListaPendentes = () => (
        <div className="posicoes-list">
            {pendentes.map(nome => (
                <div key={nome} className="posicao-item pendente">
                     <span className="nome-posicao">{nome}</span>
                     <div className="add-classificacao-form">
                        <input
                            type="text"
                            placeholder="Adicionar classificação..."
                            // ALTERADO: Controla o valor pelo novo estado de objeto
                            value={classificacoesPendentes[nome] || ''}
                            onChange={(e) => handlePendenteChange(nome, e.target.value)}
                        />
                        <button onClick={() => handleAdicionar(nome)} disabled={!classificacoesPendentes[nome]}>
                            <i className="bi bi-plus-circle-fill"></i>
                        </button>
                     </div>
                </div>
            ))}
        </div>
    );

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Classificação de Posições" size="xl">
                {isLoading && <p>Carregando...</p>}
                {error && <p className="error-message">{error}</p>}
                {!isLoading && !error && (
                    <div className="gerenciar-posicoes-container">
                        <div className="posicoes-panel">
                            <h4>Posições Classificadas ({classificadas.length})</h4>
                            {classificadas.length > 0 ? renderListaClassificadas() : <p className="empty-list">Nenhuma posição classificada.</p>}
                        </div>
                        <div className="posicoes-panel">
                            <h4>Posições Pendentes ({pendentes.length})</h4>
                            {pendentes.length > 0 ? renderListaPendentes() : <p className="empty-list">Nenhuma posição pendente.</p>}
                        </div>
                    </div>
                )}
            </Modal>
            <ModalConfirmacao
                isOpen={!!itemParaExcluir}
                onClose={() => setItemParaExcluir(null)}
                onConfirm={handleExcluir}
                title="Confirmar Exclusão"
            >
                <p>Tem certeza que deseja excluir a classificação para a posição:</p>
                <p><strong>{itemParaExcluir?.nome_posicao}</strong>?</p>
            </ModalConfirmacao>
        </>
    );
}

export default ModalGerenciarPosicoes;

