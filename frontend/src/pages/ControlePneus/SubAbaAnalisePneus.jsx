import React, { useState, useEffect, useMemo, useRef } from 'react';

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
    
    // Opções do dropdown de filtro
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
    
    // useEffect para fechar o dropdown de filtro
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterBtnRef.current && !filterBtnRef.current.contains(event.target)) {
                setIsFilterDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    // Lógica de filtragem
    const filteredData = useMemo(() => {
        if (!searchTerm) {
            return analiseData;
        }

        const lowercasedFilter = searchTerm.toLowerCase();
        
        if (filterBy.key === 'centro_custo') {
            return analiseData.filter(grupo => 
                grupo.centro_custo.toLowerCase().includes(lowercasedFilter)
            );
        }

        return analiseData.map(grupo => {
            const filteredEquipamentos = grupo.equipamentos.filter(equip => {
                if (filterBy.key === 'equipamento') {
                    return equip.equipamento.toLowerCase().includes(lowercasedFilter);
                }
                if (filterBy.key === 'num_fogo') {
                    // A API agora retorna 'numeros_fogo'
                    return equip.numeros_fogo.some(fogo => 
                        String(fogo).toLowerCase().includes(lowercasedFilter)
                    );
                }
                return true;
            });
            return { ...grupo, equipamentos: filteredEquipamentos };
        }).filter(grupo => grupo.equipamentos.length > 0);

    }, [analiseData, searchTerm, filterBy]);


    // useEffect para definir o conteúdo da sidebar.
    useEffect(() => {
        if (isActive) {
            setSidebarContent(
                <p style={{ padding: '10px', color: '#6c757d', textAlign: 'center', fontSize: '14px' }}>
                    Nenhum filtro disponível para esta aba no momento.
                </p>
            );
        }
    }, [isActive, setSidebarContent]);
    
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
                        <div key={equip.equipamento} className="analysis-card">
                            <div className="card-header">
                                <span className="card-tag">{equip.equipamento}</span>
                            </div>
                            <div className="card-body">
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
                    ))}
                </div>
            </div>
        ));
    };

    return (
        <div className={`sub-tab-content ${isActive ? 'active' : ''}`}>
            {/* Barra de Busca e Filtros */}
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
                </div>
            </div>

            {/* Container de Conteúdo */}
            <div className="analysis-container">
                {renderContent()}
            </div>
        </div>
    );
}

export default SubAbaAnalisePneus;

