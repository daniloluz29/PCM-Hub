import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../../components/Modal.jsx';
import ModalCadastroLayout from '../../components/ModalCadastroLayout.jsx';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';
import EsqueletoPreview from '../../components/EsqueletoPreview.jsx'; // NOVO: Import para o modal de prévia

// ATUALIZADO: URL base da API
const API_BASE_URL = 'http://127.0.0.1:5000';

// ALTERADO: Recebe a nova prop setSidebarContent.
function SubAbaConfiguracaoLayout({ currentUser, isActive, setSidebarContent }) {
    const [layouts, setLayouts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLayout, setEditingLayout] = useState(null);
    
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [layoutToDelete, setLayoutToDelete] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');

    // NOVO: Estados para o menu de contexto
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, selectedLayout: null });
    
    // NOVO: Estados para o modal de pré-visualização
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [previewLayout, setPreviewLayout] = useState(null);

    // NOVO: useEffect para fechar o menu de contexto ao clicar em qualquer lugar
    useEffect(() => {
        const handleClick = () => setContextMenu({ ...contextMenu, visible: false });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [contextMenu]);


    // NOVO: useEffect para definir o conteúdo da sidebar quando a aba estiver ativa.
    useEffect(() => {
        if (isActive) {
            setSidebarContent(
                <>
                    {/* Futuramente, o conteúdo dos filtros para esta aba será inserido aqui. */}
                    <p style={{ padding: '10px', color: '#6c757d', textAlign: 'center', fontSize: '14px' }}>
                        Nenhum filtro disponível para esta aba no momento.
                    </p>
                </>
            );
        }
    }, [isActive, setSidebarContent]);

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

    const handleOpenModal = (layout = null, isCopy = false) => {
        // NOVO: Se for uma cópia, passa o layout com um sinalizador
        if (isCopy && layout) {
             setEditingLayout({ ...layout, isCopy: true });
        } else {
            setEditingLayout(layout);
        }
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
    
    // NOVO: Funções para o menu de contexto
    const handleContextMenu = (event, layout) => {
        event.preventDefault();
        setContextMenu({
            visible: true,
            x: event.pageX,
            y: event.pageY,
            selectedLayout: layout,
        });
    };

    const handlePreview = () => {
        if (contextMenu.selectedLayout) {
            setPreviewLayout(contextMenu.selectedLayout);
            setIsPreviewModalOpen(true);
        }
    };

    const handleCopy = () => {
        if (contextMenu.selectedLayout) {
            handleOpenModal(contextMenu.selectedLayout, true);
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
                        // ALTERADO: Adiciona o evento onContextMenu na linha da tabela
                        <tr key={layout.id} onContextMenu={(e) => handleContextMenu(e, layout)}>
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

            {/* NOVO: Renderização condicional do menu de contexto */}
            {contextMenu.visible && (
                <div 
                    className="context-menu-container" 
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <div className="context-menu-item" onClick={handlePreview}>
                        <i className="bi bi-eye-fill"></i> Ver Prévia
                    </div>
                    <div className="context-menu-item" onClick={handleCopy}>
                        <i className="bi bi-copy"></i> Criar uma Cópia
                    </div>
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingLayout ? (editingLayout.isCopy ? "Criar Cópia do Layout" : "Editar Layout de Pneus") : "Novo Layout de Pneus"}
                size="xl"
            >
                <ModalCadastroLayout
                    layouts={layouts}
                    layoutInicial={editingLayout}
                    onSave={handleSaveLayout}
                    onCancel={handleCloseModal}
                />
            </Modal>

            {/* NOVO: Modal para a pré-visualização do layout */}
            <Modal
                isOpen={isPreviewModalOpen}
                onClose={() => setIsPreviewModalOpen(false)}
                title={`Prévia do Layout: ${previewLayout?.tipo_obj || ''}`}
                size="default"
            >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    {previewLayout && <EsqueletoPreview configuracao={previewLayout.configuracao} />}
                </div>
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

