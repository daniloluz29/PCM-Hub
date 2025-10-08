import React, { useState, useEffect } from 'react';
import Modal from '../components/Modal.jsx';
import ModalConfirmacao from '../components/ModalConfirmacao.jsx';
import ModalAlerta from '../components/ModalAlerta.jsx';

// Função auxiliar para checar permissões
const hasPermission = (user, permission) => {
    if (!user || !user.permissoes) return false;
    if (user.perfil_id === 'master_admin') return true;
    return user.permissoes.includes(permission);
};

// Componente do formulário para adicionar/editar itens do FAQ
const FaqForm = ({ item, onSave, onCancel }) => {
    const [pergunta, setPergunta] = useState(item ? item.pergunta : '');
    const [resposta, setResposta] = useState(item ? item.resposta : '');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ ...item, pergunta, resposta });
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="filter-group">
                <label>Pergunta:</label>
                <input
                    type="text"
                    value={pergunta}
                    onChange={(e) => setPergunta(e.target.value)}
                    required
                />
            </div>
            <div className="filter-group">
                <label>Resposta:</label>
                <textarea
                    value={resposta}
                    onChange={(e) => setResposta(e.target.value)}
                    rows="5"
                    required
                ></textarea>
            </div>
            <div className="modal-footer">
                <div></div>
                <div>
                    <button type="button" className="modal-button cancel" onClick={onCancel}>Cancelar</button>
                    <button type="submit" className="modal-button confirm" style={{ backgroundColor: '#27ae60' }}>Salvar</button>
                </div>
            </div>
        </form>
    );
};

// Componente principal da página de FAQ
function PaginaFAQ({ currentUser }) {
    const [faqData, setFaqData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openId, setOpenId] = useState(null);

    // Estados para modais e ações
    const [modalAberto, setModalAberto] = useState(false);
    const [itemEmEdicao, setItemEmEdicao] = useState(null);
    const [itemParaExcluir, setItemParaExcluir] = useState(null);
    const [alerta, setAlerta] = useState({ isOpen: false, message: '' });

    // Checagem de permissões do usuário
    const canAdd = hasPermission(currentUser, 'faq_cadastrar');
    const canEdit = hasPermission(currentUser, 'faq_editar');
    const canDelete = hasPermission(currentUser, 'faq_excluir');

    // Função para buscar os dados do FAQ da API
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('http://127.0.0.1:5000/api/faq');
            if (!response.ok) throw new Error('Falha ao buscar dados do FAQ.');
            const data = await response.json();
            setFaqData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleToggle = (id) => {
        setOpenId(openId === id ? null : id);
    };

    const handleOpenModal = (item = null) => {
        setItemEmEdicao(item);
        setModalAberto(true);
    };

    const handleCloseModal = () => {
        setModalAberto(false);
        setItemEmEdicao(null);
    };

    // Função para salvar (criar ou atualizar) um item
    const handleSave = async (itemData) => {
        const isEditing = !!itemData.id;
        const url = isEditing ? `http://127.0.0.1:5000/api/faq/${itemData.id}` : 'http://127.0.0.1:5000/api/faq';
        const method = isEditing ? 'PUT' : 'POST';

        const payload = {
            pergunta: itemData.pergunta,
            resposta: itemData.resposta,
            criado_por_id: currentUser.id
        };

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            
            setAlerta({ isOpen: true, message: result.message });
            handleCloseModal();
            fetchData();
        } catch (err) {
            setAlerta({ isOpen: true, message: `Erro: ${err.message}` });
        }
    };

    const handleDelete = (item) => {
        setItemParaExcluir(item);
    };

    // Função para confirmar e executar a exclusão
    const handleDeleteConfirm = async () => {
        if (!itemParaExcluir) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/faq/${itemParaExcluir.id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            setAlerta({ isOpen: true, message: result.message });
            setItemParaExcluir(null);
            fetchData();
        } catch (err) {
            setAlerta({ isOpen: true, message: `Erro: ${err.message}` });
            setItemParaExcluir(null);
        }
    };

    return (
        <>
            <div className="page-container">
                <main className="content-area" style={{ marginLeft: '2rem' }}>
                    <div className="page-header">
                        <h1>Perguntas Frequentes</h1>
                    </div>
                    {canAdd && (
                         <div className="admin-actions-bar" style={{justifyContent: 'flex-start', marginBottom: '10px'}}>
                            <button className="admin-button" onClick={() => handleOpenModal()}>
                                <i className="bi bi-plus-circle-fill"></i> Adicionar Pergunta
                            </button>
                        </div>
                    )}

                    <div className="accordion-container">
                        {isLoading && <p>Carregando...</p>}
                        {error && <p className="error-message">{error}</p>}
                        {!isLoading && !error && faqData.map(item => (
                            <div key={item.id} className={`accordion-item ${openId === item.id ? 'active' : ''}`}>
                                <div className="accordion-question" onClick={() => handleToggle(item.id)}>
                                    <span>{item.pergunta}</span>
                                    <div className="accordion-actions">
                                        {canEdit && <button className="action-btn" title="Editar" onClick={(e) => { e.stopPropagation(); handleOpenModal(item); }}><i className="bi bi-pencil-fill"></i></button>}
                                        {canDelete && <button className="action-btn" title="Excluir" onClick={(e) => { e.stopPropagation(); handleDelete(item); }}><i className="bi bi-trash-fill"></i></button>}
                                        <span className="icon"><i className="bi bi-chevron-down"></i></span>
                                    </div>
                                </div>
                                <div className="accordion-answer">
                                    <p>{item.resposta}</p>
                                    <small>Criado por: {item.criado_por_nome || 'Sistema'}</small>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            </div>

            <Modal isOpen={modalAberto} onClose={handleCloseModal} title={itemEmEdicao ? "Editar Pergunta" : "Adicionar Nova Pergunta"}>
                <FaqForm
                    item={itemEmEdicao}
                    onSave={handleSave}
                    onCancel={handleCloseModal}
                />
            </Modal>

            <ModalConfirmacao
                isOpen={!!itemParaExcluir}
                onClose={() => setItemParaExcluir(null)}
                onConfirm={handleDeleteConfirm}
                title="Confirmar Exclusão"
            >
                <p>Você tem certeza que deseja excluir a pergunta: <strong>"{itemParaExcluir?.pergunta}"</strong>?</p>
            </ModalConfirmacao>

            <ModalAlerta
                isOpen={alerta.isOpen}
                onClose={() => setAlerta({ isOpen: false, message: '' })}
                title="Notificação"
            >
                <p>{alerta.message}</p>
            </ModalAlerta>
        </>
    );
}

export default PaginaFAQ;
