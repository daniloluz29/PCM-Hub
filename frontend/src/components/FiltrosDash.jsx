import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import { useDebounce } from 'use-debounce';

const FiltroDash = ({ filtroInfo, onRemove, onApply, isImplicit }) => {
    const [localConfig, setLocalConfig] = useState(filtroInfo.filterConfig);
    const [hasChanges, setHasChanges] = useState(false);

    const [isExpanded, setIsExpanded] = useState(false);
    const [basicSearch, setBasicSearch] = useState('');
    const [distinctValues, setDistinctValues] = useState([]);
    const [isLoadingValues, setIsLoadingValues] = useState(false);
    const [debouncedSearch] = useDebounce(basicSearch, 300);

    useEffect(() => {
        setLocalConfig(filtroInfo.filterConfig);
        setHasChanges(false); 
    }, [filtroInfo.filterConfig]);

    useEffect(() => {
        if (isExpanded && localConfig.type === 'basica') {
            const fetchDistinctValues = async () => {
                setIsLoadingValues(true);
                try {
                    if (filtroInfo.isAggregated) {
                        setDistinctValues([]);
                        return;
                    }
                    const url = `http://127.0.0.1:5000/api/bi/column-distinct-values/${filtroInfo.tableName}/${filtroInfo.columnName}?search=${encodeURIComponent(debouncedSearch)}`;
                    const response = await fetch(url);
                    const data = await response.json();
                    if (response.ok) {
                        setDistinctValues(data.values);
                    } else {
                        console.error("Erro ao buscar valores distintos:", data.message);
                    }
                } catch (error) {
                    console.error("Erro de rede:", error);
                } finally {
                    setIsLoadingValues(false);
                }
            };
            fetchDistinctValues();
        }
    }, [isExpanded, localConfig.type, filtroInfo.tableName, filtroInfo.columnName, debouncedSearch, filtroInfo.isAggregated]);
    
    const updateLocalConfig = (key, value) => {
        setLocalConfig(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };
    
    const handleApplyClick = () => {
        onApply(filtroInfo.id, localConfig);
        setHasChanges(false);
    };
    
    const handleClearFilters = () => {
        const defaultConfig = {
            type: filtroInfo.isAggregated ? 'avancada' : 'basica',
            selectedValues: [],
            advancedFilters: [],
            topN: { value: 10, direction: 'superior' },
            logicOperator: 'E'
        };
        setLocalConfig(defaultConfig);
        onApply(filtroInfo.id, defaultConfig);
    };

    const filterTypeOptions = useMemo(() => {
        const options = [
            { value: 'basica', label: 'Filtragem básica' },
            { value: 'avancada', label: 'Filtragem avançada' },
        ];
        if (filtroInfo.isAggregated) {
            options.push({ value: 'top_n', label: 'Top N' });
        }
        return filtroInfo.isAggregated ? options.slice(1) : options;
    }, [filtroInfo.isAggregated]);
    
    const advancedOptions = [
        { value: 'contem', label: 'Contém' }, { value: 'nao_contem', label: 'Não contém' },
        { value: 'igual', label: 'É igual a' }, { value: 'diferente', label: 'É diferente de' },
        { value: 'nulo', label: 'É nulo' }, { value: 'nao_nulo', label: 'Não é nulo' },
        { value: '>', label: 'É maior que' },
        { value: '<', label: 'É menor que' },
        { value: '>=', label: 'É maior ou igual a' },
        { value: '<=', label: 'É menor ou igual a' },
    ];
    
    // --- INÍCIO DA CORREÇÃO: Opções para o ComboBox do Top N ---
    const topNDirectionOptions = [
        { value: 'superior', label: 'Superior' },
        { value: 'inferior', label: 'Inferior' },
    ];
    // --- FIM DA CORREÇÃO ---

    const handleSelectValue = (value) => {
        const currentValues = localConfig.selectedValues || [];
        const newValues = currentValues.includes(value) ? currentValues.filter(v => v !== value) : [...currentValues, value];
        updateLocalConfig('selectedValues', newValues);
    };
    
    const handleSelectAll = (e) => {
        const newValues = e.target.checked ? distinctValues : [];
        updateLocalConfig('selectedValues', newValues);
    };
    
    const addAdvancedFilter = () => {
        const currentFilters = localConfig.advancedFilters || [];
        if (currentFilters.length < 2) {
            const newFilters = [...currentFilters, { id: Date.now(), condition: 'contem', value: '' }];
            updateLocalConfig('advancedFilters', newFilters);
        }
    };

    const removeAdvancedFilter = (id) => {
        const newFilters = (localConfig.advancedFilters || []).filter(f => f.id !== id);
        updateLocalConfig('advancedFilters', newFilters);
    };

    const updateAdvancedFilter = (id, field, newValue) => {
        const newFilters = (localConfig.advancedFilters || []).map(f => (f.id === id ? { ...f, [field]: newValue } : f));
        updateLocalConfig('advancedFilters', newFilters);
    };

    const selectedValues = localConfig.selectedValues || [];
    const advancedFilters = localConfig.advancedFilters || [];
    const topNConfig = localConfig.topN || { value: 10, direction: 'superior' };


    return (
        <div className={`filter-card ${isExpanded ? 'expanded' : 'collapsed'}`}>
            <div className="filter-card-header" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="filter-card-title">
                    <span className="table-name">{filtroInfo.isAggregated ? 'Agregado' : filtroInfo.tableName}/</span>
                    <span className="column-name">{filtroInfo.columnName}</span>
                </div>
                <div className="filter-card-actions">
                    <button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} title={isExpanded ? "Recolher" : "Expandir"}>
                        <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                    </button>
                    {!isImplicit && (
                        <button onClick={(e) => { e.stopPropagation(); onRemove(filtroInfo); }} title="Remover filtro">
                            <i className="bi bi-x-lg"></i>
                        </button>
                    )}
                </div>
            </div>
            {isExpanded && (
                <div className="filter-card-body">
                     <div className="filter-card-row">
                        <span className="filter-summary-text">Todos</span>
                        <button className="clear-filter-btn" title="Limpar seleção" onClick={handleClearFilters}><i className="bi bi-eraser-fill"></i></button>
                    </div>

                    <div className="filter-type-selector">
                        <label>Tipo de filtro</label>
                        <Select 
                            options={filterTypeOptions} 
                            value={filterTypeOptions.find(opt => opt.value === localConfig.type)} 
                            onChange={(selected) => updateLocalConfig('type', selected.value)} 
                            classNamePrefix="react-select" 
                        />
                    </div>

                    {localConfig.type === 'basica' && (
                        <div className="basic-filtering">
                            <input type="search" placeholder="Pesquisar..." className="filter-search-input" value={basicSearch} onChange={e => setBasicSearch(e.target.value)} />
                            <div className="filter-values-list">
                                {isLoadingValues ? <small>Carregando...</small> : (
                                    <>
                                        <label className="checkbox-label-group select-all">
                                            <input type="checkbox" onChange={handleSelectAll} checked={distinctValues.length > 0 && selectedValues.length === distinctValues.length} />
                                            <span>(Selecionar tudo)</span>
                                        </label>
                                        {distinctValues.map((item, index) => (
                                            <label key={index} className="checkbox-label-group">
                                                <input type="checkbox" checked={selectedValues.includes(item)} onChange={() => handleSelectValue(item)} />
                                                <span>{item === null || item === '' ? '(Em branco)' : item}</span>
                                            </label>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {localConfig.type === 'top_n' && (
                        <div className="top-n-filtering">
                            <div className="top-n-input-group">
                                {/* --- INÍCIO DA CORREÇÃO: Substituição por ComboBox (Select) --- */}
                                <Select
                                    className="top-n-direction-select"
                                    classNamePrefix="react-select"
                                    value={topNDirectionOptions.find(opt => opt.value === topNConfig.direction)}
                                    onChange={(selected) => updateLocalConfig('topN', { ...topNConfig, direction: selected.value })}
                                    options={topNDirectionOptions}
                                />
                                {/* --- FIM DA CORREÇÃO --- */}
                                <input style={{ width: '30px', textAlign: 'center' }}
                                    type="number"
                                    className="top-n-input"
                                    value={topNConfig.value}
                                    min="1"
                                    onChange={(e) => updateLocalConfig('topN', { ...topNConfig, value: parseInt(e.target.value, 10) || 0 })}
                                />
                                <label>itens</label>
                            </div>
                        </div>
                    )}

                    {localConfig.type === 'avancada' && (
                         <div className="advanced-filtering">
                            {advancedFilters.map((filter, index) => (
                                <React.Fragment key={filter.id}>
                                    {index > 0 && (
                                        <div className="logic-operator-row">
                                            <button className={`logic-operator-btn ${localConfig.logicOperator === 'E' ? 'active' : ''}`} onClick={() => updateLocalConfig('logicOperator', 'E')}>E</button>
                                            <button className={`logic-operator-btn ${localConfig.logicOperator === 'Ou' ? 'active' : ''}`} onClick={() => updateLocalConfig('logicOperator', 'Ou')}>Ou</button>
                                        </div>
                                    )}
                                    <div className="advanced-filter-row">
                                        <label>Mostrar itens quando o valor</label>
                                        <Select options={advancedOptions} classNamePrefix="react-select" value={advancedOptions.find(opt => opt.value === filter.condition)} onChange={selected => updateAdvancedFilter(filter.id, 'condition', selected.value)} />
                                        {!['nulo', 'nao_nulo'].includes(filter.condition) && (
                                            <input type="text" className="filter-text-input" value={filter.value} onChange={e => updateAdvancedFilter(filter.id, 'value', e.target.value)} />
                                        )}
                                        {index > 0 && (
                                            <button className="remove-filter-btn" onClick={() => removeAdvancedFilter(filter.id)}><i className="bi bi-x"></i></button>
                                        )}
                                    </div>
                                </React.Fragment>
                            ))}
                            {advancedFilters.length < 2 && (
                                <button className="add-filter-rule-btn" onClick={addAdvancedFilter}>Adicionar regra</button>
                            )}
                         </div>
                    )}
                    <div className="filter-apply-button-container">
                        <button className="apply-filter-btn" disabled={!hasChanges} onClick={handleApplyClick}>Aplicar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FiltroDash;

