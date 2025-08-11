import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';

// Definindo os diferentes conjuntos de opções de classificação
const textSortOptions = [
    { value: 'ASC', label: 'De A a Z' },
    { value: 'DESC', label: 'De Z a A' }
];

const numericSortOptions = [
    { value: 'ASC', label: 'Menor para Maior' },
    { value: 'DESC', label: 'Maior para Menor' }
];

const AdvancedSortModal = ({ isOpen, onClose, columns, onApplySort, currentSorts, onClearSorts }) => {
    const [sortLevels, setSortLevels] = useState([]);
    const [selectedLevelIndex, setSelectedLevelIndex] = useState(null);

    useEffect(() => {
        if (isOpen) {
            if (currentSorts.length === 0) {
                setSortLevels([{ id: Date.now(), columnKey: '', direction: 'ASC' }]);
                setSelectedLevelIndex(0);
            } else {
                const levelsWithIds = currentSorts.map((level, i) => ({
                    ...level,
                    id: level.id || Date.now() + i
                }));
                setSortLevels(levelsWithIds);
                setSelectedLevelIndex(0);
            }
        }
    }, [isOpen, currentSorts]);

    const isSortActive = useMemo(() => currentSorts.length > 0, [currentSorts]);

    const handleAddLevel = () => {
        setSortLevels(prev => [...prev, { id: Date.now(), columnKey: '', direction: 'ASC' }]);
    };

    const handleRemoveLevel = () => {
        if (selectedLevelIndex === null || sortLevels.length <= 1) return;
        const newLevels = sortLevels.filter((_, i) => i !== selectedLevelIndex);
        setSortLevels(newLevels);
        setSelectedLevelIndex(Math.max(0, selectedLevelIndex - 1));
    };
    
    const handleMoveLevel = (direction) => {
        if (selectedLevelIndex === null) return;
        const newIndex = direction === 'up' ? selectedLevelIndex - 1 : selectedLevelIndex + 1;

        if (newIndex < 0 || newIndex >= sortLevels.length) return;

        const newLevels = [...sortLevels];
        [newLevels[selectedLevelIndex], newLevels[newIndex]] = [newLevels[newIndex], newLevels[selectedLevelIndex]];
        setSortLevels(newLevels);
        setSelectedLevelIndex(newIndex);
    };

    const handleLevelChange = (index, field, value) => {
        const newLevels = [...sortLevels];
        newLevels[index][field] = value;

        if (field === 'columnKey') {
            newLevels[index]['direction'] = 'ASC';
        }
        
        setSortLevels(newLevels);
    };

    const handleApply = () => {
        const validLevels = sortLevels.filter(level => level.columnKey);
        onApplySort(validLevels);
    };

    const handleClear = () => {
        setSortLevels([{ id: Date.now(), columnKey: '', direction: 'ASC' }]);
        setSelectedLevelIndex(0);
        onClearSorts();
    };

    if (!isOpen) return null;

    const columnOptions = columns.map(col => ({ value: col.key, label: col.name }));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content sort-modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Classificar</h3>
                    <button onClick={onClose} className="modal-close-btn">&times;</button>
                </div>
                <div className="sort-modal-toolbar">
                    <button onClick={handleAddLevel}><i className="bi bi-plus-lg"></i> Adicionar Nível</button>
                    <button onClick={handleRemoveLevel} disabled={sortLevels.length <= 1 || selectedLevelIndex === null}><i className="bi bi-x-lg"></i> Excluir Nível</button>
                    <button onClick={() => handleMoveLevel('up')} disabled={selectedLevelIndex === null || selectedLevelIndex === 0}><i className="bi bi-arrow-up"></i></button>
                    <button onClick={() => handleMoveLevel('down')} disabled={selectedLevelIndex === null || selectedLevelIndex >= sortLevels.length - 1}><i className="bi bi-arrow-down"></i></button>
                    <button onClick={handleClear} className="clear-sort-btn-modal" disabled={!isSortActive}><i className="bi bi-eraser-fill"></i> Limpar Classificação</button>
                </div>
                <div className="sort-modal-body">
                    <div className="sort-header-grid">
                        <span /> 
                        <span>Coluna</span>
                        <span>Ordem</span>
                    </div>
                    {sortLevels.map((level, index) => {
                        const selectedColumn = columns.find(c => c.key === level.columnKey);
                        const columnType = selectedColumn ? selectedColumn.type : 'text';
                        
                        // ATUALIZAÇÃO: Adicionado 'datenum' à condição
                        const orderOptions = (['numeric', 'date', 'datenum'].includes(columnType))
                            ? numericSortOptions
                            : textSortOptions;

                        return (
                            <div 
                                key={level.id} 
                                className={`sort-level-grid ${selectedLevelIndex === index ? 'selected' : ''}`}
                            >
                                <div className="checkbox-cell">
                                    <input
                                        type="radio"
                                        name="sort-level-selection"
                                        checked={selectedLevelIndex === index}
                                        onChange={() => setSelectedLevelIndex(index)}
                                        title={`Selecionar nível ${index + 1}`}
                                    />
                                </div>
                                <Select
                                    options={columnOptions}
                                    value={columnOptions.find(opt => opt.value === level.columnKey)}
                                    onChange={opt => handleLevelChange(index, 'columnKey', opt ? opt.value : '')}
                                    placeholder="Classificar por"
                                />
                                <Select
                                    options={orderOptions}
                                    value={orderOptions.find(opt => opt.value === level.direction)}
                                    onChange={opt => handleLevelChange(index, 'direction', opt ? opt.value : 'ASC')}
                                />
                            </div>
                        );
                    })}
                </div>
                <div className="modal-footer">
                    <button onClick={handleApply} className="modal-button confirm">OK</button>
                    <button onClick={onClose} className="modal-button">Cancelar</button>
                </div>
            </div>
        </div>
    );
};

export default AdvancedSortModal;
