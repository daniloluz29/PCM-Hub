import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from '../../components/Modal.jsx';
import ModalDetalhamentoPneus from '../../components/ModalDetalhamentoPneus.jsx'; // CAMINHO CORRIGIDO

// ATUALIZADO: URL base da API
const API_BASE_URL = 'http://127.0.0.1:5000';

// ALTERADO: Recebe a nova prop setSidebarContent.
function SubAbaAnalisePneus({ currentUser, isActive, setSidebarContent }) {
    const [analiseData, setAnaliseData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Estados para o filtro
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBy, setFilterBy] = useState({ key: 'equipamento', label: 'Equipamento' });
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const filterBtnRef = useRef(null);
    
    const [ocultarSemAgregados, setOcultarSemAgregados] = useState(true);

    // NOVO: Estados para controlar o modal de detalhamento
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedEquip, setSelectedEquip] = useState(null);
    
    const filterOptions = [
        { key: 'centro_custo', label: 'Centro de Custo' },
        { key: 'equipamento', label: 'Equipamento' },
        { key: 'num_fogo', label: 'Pneu (Nº Fogo)' }
    ];

    useEffect(() => {
        const fetchAnaliseData = async () => {
            if (!isActive) return;
            setIsLoading(true);
            try {
                const response = await fetch(`${API_BASE_URL}/api/pneus/analise-geral`);
                if (!response.ok) {
                    throw new Error('Falha ao buscar dados de análise.');
                }
                const data = await response.json();
                setAnaliseData(data);
                setError(null);
            } catch (err) {
                console.error("Erro detalhado:", err);
                setError(err.message);
                setAnaliseData([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnaliseData();
    }, [isActive]);
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterBtnRef.current && !filterBtnRef.current.contains(event.target)) {
                setIsFilterDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    const filteredData = useMemo(() => {
        if (!analiseData) return [];

        const lowercasedSearchTerm = searchTerm.toLowerCase();

        return analiseData.map(grupo => {
            let filteredEquipamentos = grupo.equipamentos;

            if (ocultarSemAgregados) {
                filteredEquipamentos = filteredEquipamentos.filter(
                    equip => equip.pneus_agregados > 0
                );
            }

            if (lowercasedSearchTerm) {
                if (filterBy.key === 'equipamento') {
                    filteredEquipamentos = filteredEquipamentos.filter(equip =>
                        equip.equipamento.toLowerCase().includes(lowercasedSearchTerm)
                    );
                }
                if (filterBy.key === 'num_fogo') {
                    filteredEquipamentos = filteredEquipamentos.filter(equip =>
                        equip.numeros_fogo.some(fogo =>
                            String(fogo).toLowerCase().includes(lowercasedSearchTerm)
                        )
                    );
                }
            }
            
            return { ...grupo, equipamentos: filteredEquipamentos };
        
        }).filter(grupo => {
             if (lowercasedSearchTerm && filterBy.key === 'centro_custo') {
                return grupo.centro_custo.toLowerCase().includes(lowercasedSearchTerm);
            }
            return grupo.equipamentos.length > 0;
        });

    }, [analiseData, searchTerm, filterBy, ocultarSemAgregados]);

    useEffect(() => {
        if (isActive) {
            setSidebarContent(
                <p style={{ padding: '10px', color: '#6c757d', textAlign: 'center', fontSize: '14px' }}>
                    Nenhum filtro disponível para esta aba no momento.
                </p>
            );
        }
    }, [isActive, setSidebarContent]);

    // NOVO: Funções para abrir e fechar o modal de detalhamento
    const handleOpenDetailModal = (equip) => {
        setSelectedEquip(equip);
        setIsDetailModalOpen(true);
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalOpen(false);
        // Atraso para limpar o estado para que o conteúdo do modal não desapareça durante a animação de fechamento
        setTimeout(() => setSelectedEquip(null), 300);
    };
    
    const renderContent = () => {
        if (isLoading) {
            return <div className="loading-placeholder">Carregando análise...</div>;
        }
        if (error) {
            return <div className="error-message">Erro ao carregar dados: {error}</div>;
        }
        if (filteredData.length === 0) {
            return (
                <div className="placeholder-message">
                    <h4>Nenhum dado encontrado.</h4>
                    <p>Não há medições de pneus registradas ou os filtros não retornaram resultados.</p>
                </div>
            );
        }

        return filteredData.map(grupo => (
            <div key={grupo.centro_custo} className="analysis-group">
                <h3 className="group-title">{grupo.centro_custo}</h3>
                <div className="card-grid">
                    {grupo.equipamentos.map(equip => (
                        // ALTERADO: Adicionado onClick para abrir o modal
                        <div key={equip.equipamento} className="analysis-card" onClick={() => handleOpenDetailModal(equip)}>
                            <div className="card-header">
                                <span className="card-tag">{equip.equipamento}</span>
                            </div>
                            <div className="card-body">
                                <div className="card-img-placeholder">
                                    <i className="bi bi-truck-front-fill"></i>
                                </div>
                                <div className="card-info-content">
                                    <div className="info-item">
                                        <span className="info-label">Pneus agregados:</span>
                                        <span className="info-value">{equip.pneus_agregados}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Última medição:</span>
                                        <span className="info-value">{equip.ultima_medicao}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Status:</span>
                                        <span className="info-value status-dev">Em desenvolvimento</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ));
    };

    return (
        <div className={`sub-tab-content ${isActive ? 'active' : ''}`}>
            <div className="analysis-content-wrapper">
                <div className="table-toolbar">
                    <div className="search-controls">
                        <div className="search-bar">
                            <input 
                                type="text"
                                className="form-control"
                                placeholder={`Filtrar por ${filterBy.label}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <button className="btn-toggle-visibility" onClick={() => setOcultarSemAgregados(!ocultarSemAgregados)}>
                            <i className={`bi ${ocultarSemAgregados ? 'bi-eye-fill' : 'bi-eye-slash-fill'}`}></i>
                            <span>{ocultarSemAgregados ? 'Exibir sem agregados' : 'Ocultar sem agregados'}</span>
                        </button>
                        
                        <div className="filter-button-container" ref={filterBtnRef}>
                            <button className="btn-filter" onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}>
                                <i className="bi bi-funnel-fill"></i>
                                <span>Filtros</span>
                            </button>
                            {isFilterDropdownOpen && (
                                <div className="filter-dropdown">
                                    {filterOptions.map(opt => (
                                        <div key={opt.key} className="filter-dropdown-item" onClick={() => { setFilterBy(opt); setIsFilterDropdownOpen(false); }}>
                                            {filterBy.key === opt.key && <i className="bi bi-check-lg"></i>}
                                            <span>{opt.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="analysis-container">
                    {renderContent()}
                </div>
            </div>

            {/* NOVO: Renderização do modal de detalhamento */}
            <Modal
                isOpen={isDetailModalOpen}
                onClose={handleCloseDetailModal}
                title={`Layout do Equipamento: ${selectedEquip?.equipamento || ''}`}
                size="default" 
            >
                {/* O conteúdo do modal só é renderizado se houver um equipamento selecionado */}
                {selectedEquip && (
                    <ModalDetalhamentoPneus
                        equipamento={selectedEquip}
                        onCancel={handleCloseDetailModal}
                    />
                )}
            </Modal>
        </div>
    );
}

export default SubAbaAnalisePneus;

