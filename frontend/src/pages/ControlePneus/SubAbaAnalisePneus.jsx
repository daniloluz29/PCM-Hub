import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from '../../components/Modal.jsx';
import ModalDetalhamentoEquipamentos from './ModalDetalhamentoEquipamento.jsx';
import MiniEsqueletoPreview from './MiniEsqueletoPreview.jsx';
import StatusEquipamento from './StatusEquipamento.jsx';

const API_BASE_URL = 'http://127.0.0.1:5000';

// NOVO: Lista de todos os status possíveis para os botões de filtro
const ALL_STATUSES = [
    "OK",
    "Sem medições recentes",
    "Faltando medição",
    "Pneus com alto desgaste",
    "Faltando agregação",
    "Sem layout cadastrado"
];

function SubAbaAnalisePneus({ currentUser, isActive, setSidebarContent }) {
    const [analiseData, setAnaliseData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBy, setFilterBy] = useState({ key: 'equipamento', label: 'Equipamento' });
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const filterBtnRef = useRef(null);
    const [ocultarSemAgregados, setOcultarSemAgregados] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEquip, setSelectedEquip] = useState(null);
    // NOVO: Estado para os filtros de status
    const [statusFilters, setStatusFilters] = useState([]);

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
                    const errorData = await response.json().catch(() => ({})); 
                    const errorMessage = errorData.details || 'Falha ao buscar dados de análise.';
                    throw new Error(errorMessage);
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
    
    // NOVO: Handler para clicar nos botões de filtro de status
    const handleStatusFilterClick = (status) => {
        setStatusFilters(prevFilters => {
            if (prevFilters.includes(status)) {
                return prevFilters.filter(s => s !== status); // Remove o status
            } else {
                return [...prevFilters, status]; // Adiciona o status
            }
        });
    };

    const filteredData = useMemo(() => {
        let data = analiseData;

        if (ocultarSemAgregados) {
            data = data.map(grupo => ({
                ...grupo,
                equipamentos: grupo.equipamentos.filter(equip => equip.pneus_agregados > 0)
            })).filter(grupo => grupo.equipamentos.length > 0);
        }

        // NOVO: Lógica de filtro por status
        if (statusFilters.length > 0) {
            data = data.map(grupo => ({
                ...grupo,
                equipamentos: grupo.equipamentos.filter(equip => {
                    // Verifica se o status do equipamento contém algum dos filtros selecionados
                    return statusFilters.some(filterStatus => equip.status?.includes(filterStatus));
                })
            })).filter(grupo => grupo.equipamentos.length > 0);
        }

        if (!searchTerm) {
            return data;
        }

        const lowercasedFilter = searchTerm.toLowerCase();
        
        if (filterBy.key === 'centro_custo') {
            return data.filter(grupo => 
                grupo.centro_custo.toLowerCase().includes(lowercasedFilter)
            );
        }

        return data.map(grupo => {
            const filteredEquipamentos = grupo.equipamentos.filter(equip => {
                if (filterBy.key === 'equipamento') {
                    return equip.equipamento.toLowerCase().includes(lowercasedFilter);
                }
                if (filterBy.key === 'num_fogo') {
                    // Esta lógica precisa ser implementada se necessário
                    return true;
                }
                return true;
            });
            return { ...grupo, equipamentos: filteredEquipamentos };
        }).filter(grupo => grupo.equipamentos.length > 0);

    }, [analiseData, searchTerm, filterBy, ocultarSemAgregados, statusFilters]);


    useEffect(() => {
        if (isActive) {
            setSidebarContent(
                <p style={{ padding: '10px', color: '#6c757d', textAlign: 'center', fontSize: '14px' }}>
                    Nenhum filtro disponível para esta aba no momento.
                </p>
            );
        }
    }, [isActive, setSidebarContent]);

    const handleCardClick = (equipamento) => {
        setSelectedEquip(equipamento);
        setIsModalOpen(true);
    };
    
    const renderContent = () => {
        if (isLoading) {
            return <div className="loading-placeholder">Carregando análise...</div>;
        }
        if (error) {
            return <div className="error-message">Erro ao carregar dados: {error}</div>;
        }
        if (filteredData.length === 0) {
            return <div className="placeholder-message"><h4>Nenhum dado encontrado.</h4><p>Não há medições de pneus registradas ou os filtros não retornaram resultados.</p></div>;
        }

        return filteredData.map(grupo => (
            <div key={grupo.centro_custo} className="analysis-group">
                <h3 className="group-title">{grupo.centro_custo}</h3>
                <div className="card-grid">
                    {grupo.equipamentos.map(equip => (
                        <div key={equip.equipamento} className="analysis-card" onClick={() => handleCardClick(equip)}>
                            <div className="card-header">
                                <span className="card-tag">{equip.equipamento}</span>
                            </div>
                            <div className="card-body">
                                <div className="card-preview-container">
                                    <MiniEsqueletoPreview 
                                        configuracao={equip.configuracao} 
                                        inspecao={equip.ultima_inspecao} 
                                    />
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
                                        <StatusEquipamento status={equip.status} />
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
                        <button className="btn-filter" onClick={() => setOcultarSemAgregados(!ocultarSemAgregados)}>
                            {ocultarSemAgregados ? <i className="bi bi-eye-slash-fill"></i> : <i className="bi bi-eye-fill"></i>}
                            <span>{ocultarSemAgregados ? 'Exibir sem agregados' : 'Ocultar sem agregados'}</span>
                        </button>
                    </div>
                </div>
                 {/* NOVO: Barra de filtro de status */}
                <div className="status-filter-bar">
                    <span className="filter-label">Status:</span>
                    <div className="filter-buttons">
                        {ALL_STATUSES.map(status => (
                            <button
                                key={status}
                                className={`status-filter-button ${statusFilters.includes(status) ? 'selected' : ''}`}
                                onClick={() => handleStatusFilterClick(status)}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="analysis-container">
                    {renderContent()}
                </div>
            </div>
            
            <Modal 
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedEquip(null);
                }}
                title={`Layout do Equipamento: ${selectedEquip?.equipamento || ''}`}
                size="default"
            >
                {selectedEquip && <ModalDetalhamentoEquipamentos equipamento={selectedEquip} onCancel={() => setIsModalOpen(false)} />}
            </Modal>
        </div>
    );
}

export default SubAbaAnalisePneus;

