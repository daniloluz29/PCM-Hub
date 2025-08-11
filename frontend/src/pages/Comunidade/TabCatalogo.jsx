import React, { useState, useEffect, useMemo } from 'react';

const TabCatalogo = () => {
    // Estados para os dados da API
    const [contatos, setContatos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Estados para controlar a busca e os filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [activeFilters, setActiveFilters] = useState({ funcao: [], contrato: [] });

    // Busca os dados dos contatos ao montar o componente
    useEffect(() => {
        const fetchContatos = async () => {
            try {
                setIsLoading(true);
                const response = await fetch('http://127.0.0.1:5000/api/contatos');
                if (!response.ok) throw new Error('Falha ao buscar contatos');
                const data = await response.json();
                setContatos(data);
                setError(null);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchContatos();
    }, []);

    // Lógica para filtrar e ordenar os contatos
    const filteredContacts = useMemo(() => {
        let contacts = [...contatos].sort((a, b) => a.nome.localeCompare(b.nome));
        if (searchTerm) {
            contacts = contacts.filter(c => 
                c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                (c.contrato && c.contrato.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }
        if (activeFilters.funcao.length > 0) {
            contacts = contacts.filter(c => c.funcao && activeFilters.funcao.includes(c.funcao));
        }
        if (activeFilters.contrato.length > 0) {
            contacts = contacts.filter(c => c.contrato && activeFilters.contrato.includes(c.contrato));
        }
        return contacts;
    }, [searchTerm, activeFilters, contatos]);

    // Funções para manipular os filtros
    const handleFilterChange = (category, value) => {
        const currentFilters = activeFilters[category];
        const newFilters = currentFilters.includes(value) ? currentFilters.filter(item => item !== value) : [...currentFilters, value];
        setActiveFilters({ ...activeFilters, [category]: newFilters });
    };
    const clearAllFilters = () => {
        setActiveFilters({ funcao: [], contrato: [] });
        setSearchTerm('');
    };

    // Gera as listas de opções para os filtros
    const funcoesUnicas = [...new Set(contatos.map(c => c.funcao).filter(Boolean))].sort();
    const contratosUnicos = [...new Set(contatos.map(c => c.contrato).filter(Boolean))].sort();
    const hasActiveFilters = activeFilters.funcao.length > 0 || activeFilters.contrato.length > 0;

    if (isLoading) return <p>Carregando contatos...</p>;
    if (error) return <p style={{ color: 'red' }}>Erro: {error}</p>;

    return (
        <div>
            {/* Header de Busca e Filtros */}
            <div className="search-filter-header">
                <div className="search-bar-group">
                    <i className="bi bi-search search-icon"></i>
                    <input type="text" placeholder="Buscar por nome ou contrato..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <button className={`filter-toggle-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                    <i className="bi bi-funnel-fill"></i>
                </button>
            </div>

            {/* Painel de Filtros Retrátil */}
            {showFilters && (
                <div className="filter-panel">
                    <div className="user-form-grid">
                        <div className="filter-group">
                            <h4>Função</h4>
                            <div className="filter-options-list">
                                {funcoesUnicas.map(funcao => (
                                    <div key={funcao} className="checkbox-label-group" onClick={() => handleFilterChange('funcao', funcao)}>
                                        <input type="checkbox" checked={activeFilters.funcao.includes(funcao)} readOnly />
                                        <label>{funcao}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="filter-group">
                            <h4>Contrato</h4>
                            <div className="filter-options-list">
                                {contratosUnicos.map(contrato => (
                                    <div key={contrato} className="checkbox-label-group" onClick={() => handleFilterChange('contrato', contrato)}>
                                        <input type="checkbox" checked={activeFilters.contrato.includes(contrato)} readOnly />
                                        <label>{contrato}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Pílulas de Filtros Ativos */}
            {hasActiveFilters && (
                <div className="active-filters-container">
                    <span>Filtros Ativos:</span>
                    {activeFilters.funcao.map(f => <span key={f} className="filter-pill">{f} <button onClick={() => handleFilterChange('funcao', f)}>&times;</button></span>)}
                    {activeFilters.contrato.map(c => <span key={c} className="filter-pill">{c} <button onClick={() => handleFilterChange('contrato', c)}>&times;</button></span>)}
                    <button className="clear-filters-link" onClick={clearAllFilters}>Limpar todos</button>
                </div>
            )}
            
            {/* Grid de Contatos */}
            <div className="contact-grid">
                {filteredContacts.map(contato => (
                    <div key={contato.id} className="contact-card">
                        <h3>{contato.nome}</h3>
                        <p><i className="bi bi-briefcase-fill"></i> {contato.funcao || 'Não informado'}</p>
                        <p><i className="bi bi-file-earmark-text-fill"></i> {contato.contrato || 'Não informado'}</p>
                        <hr style={{width: '100%', borderTop: '1px solid #eee', borderBottom: 'none', margin: '15px 0'}}/>
                        <p><i className="bi bi-envelope-fill"></i> {contato.email}</p>
                        <p><i className="bi bi-telephone-fill"></i> {contato.contato || 'Não informado'}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TabCatalogo;
