import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../../components/Modal.jsx';
import ModalCadastroLayout from '../../components/ModalCadastroLayout.jsx';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';

// ATUALIZADO: URL base da API
const API_BASE_URL = 'http://127.0.0.1:5000';

function SubAbaConfiguracaoLayout({ currentUser, isActive }) {
    const [layouts, setLayouts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLayout, setEditingLayout] = useState(null);
    
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [layoutToDelete, setLayoutToDelete] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');

    const fetchLayouts = useCallback(async () => {
        if (!isActive) return;
        setIsLoading(true);
        try {
            // ATUALIZADO: Uso da URL base
            const response = await fetch(`${API_BASE_URL}/api/pneus/layouts`);
            if (!response.ok) {
                throw new Error('Falha ao buscar layouts. O servidor pode estar indisponível.');
            }
            const data = await response.json();
            setLayouts(data);
            setError(null);
        } catch (err) {
            console.error("Erro detalhado:", err);
            setError(err.message);
            setLayouts([]);
        } finally {
            setIsLoading(false);
        }
    }, [isActive]);

    useEffect(() => {
        fetchLayouts();
    }, [fetchLayouts]);

    const filteredLayouts = useMemo(() => {
        if (!searchTerm) {
            return layouts;
        }
        return layouts.filter(layout =>
            layout.tipo_obj.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [layouts, searchTerm]);

    const handleOpenModal = (layout = null) => {
        setEditingLayout(layout);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingLayout(null);
    };

    const handleSaveLayout = () => {
        handleCloseModal();
        fetchLayouts();
    };
    
    const promptDeleteLayout = (layout) => {
        setLayoutToDelete(layout);
        setIsConfirmModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!layoutToDelete) return;
        try {
            // ATUALIZADO: Uso da URL base
            const response = await fetch(`${API_BASE_URL}/api/pneus/layouts/${layoutToDelete.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Falha ao deletar o layout.');
            fetchLayouts();
        } catch (err) {
            alert(err.message);
        } finally {
            setIsConfirmModalOpen(false);
            setLayoutToDelete(null);
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return <p style={{ textAlign: 'center', padding: '20px' }}>Carregando layouts...</p>;
        }

        if (error) {
            return <div className="error-message" style={{ padding: '20px' }}>Ocorreu um erro ao carregar os layouts. Tente novamente mais tarde.</div>;
        }

        if (layouts.length === 0) {
            return (
                <div className="placeholder-message">
                    <div className="icon"><i className="bi bi-diagram-3"></i></div>
                    <h4>Nenhum Layout Cadastrado</h4>
                    <p>Comece cadastrando o primeiro layout de pneus para um tipo de equipamento.</p>
                    <button className="admin-button" onClick={() => handleOpenModal()}>
                        <i className="bi bi-plus-circle-fill"></i> Criar Primeiro Layout
                    </button>
                </div>
            );
        }
        
        if (filteredLayouts.length === 0) {
             return <div style={{ textAlign: 'center', padding: '40px' }}>Nenhum layout encontrado para "<strong>{searchTerm}</strong>".</div>;
        }

        return (
            <table className="layout-table">
                <thead>
                    <tr>
                        <th>Tipo de Equipamento</th>
                        <th className="actions">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredLayouts.map(layout => (
                        <tr key={layout.id}>
                            <td>{layout.tipo_obj}</td>
                            <td className="actions">
                                <button className="btn btn-secondary btn-sm" title="Editar" onClick={() => handleOpenModal(layout)}>
                                    <i className="bi bi-pencil-fill"></i>
                                </button>
                                <button className="btn btn-danger btn-sm" title="Excluir" onClick={() => promptDeleteLayout(layout)}>
                                    <i className="bi bi-trash-fill"></i>
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    if (!isActive) return null;

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Layouts Cadastrados</h2>
            </div>

            {!isLoading && !error && layouts.length > 0 && (
                <div className="table-toolbar">
                    <div className="search-container">
                        {/* ATUALIZADO: Ícone removido e placeholder melhorado */}
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Filtrar por Tipo de Equipamento..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="admin-button" onClick={() => handleOpenModal()}>
                        <i className="bi bi-plus-circle-fill"></i> Novo Layout
                    </button>
                </div>
            )}
            
            {renderContent()}

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingLayout ? "Editar Layout de Pneus" : "Novo Layout de Pneus"}
                size="xl"
            >
                <ModalCadastroLayout
                    layouts={layouts}
                    layoutInicial={editingLayout}
                    onSave={handleSaveLayout}
                    onCancel={handleCloseModal}
                />
            </Modal>

            <ModalConfirmacao
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Confirmar Exclusão"
            >
                <p>Tem certeza que deseja excluir o layout para <strong>{layoutToDelete?.tipo_obj}</strong>?</p>
                <p>Esta ação não pode ser desfeita.</p>
            </ModalConfirmacao>
        </div>
    );
}

export default SubAbaConfiguracaoLayout;

