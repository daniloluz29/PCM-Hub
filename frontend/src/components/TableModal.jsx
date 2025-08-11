import React, { useState, useMemo, useRef, useEffect } from 'react';
import {DataGrid} from 'react-data-grid';
import * as XLSX from 'xlsx';
import AdvancedSortModal from './AdvancedSortModal.jsx';

// Constante para representar valores vazios no filtro
const EMPTY_VALUE_LABEL = '(Vazios)';

// Componente para o menu de contexto de filtro (sem alterações)
const FilterContextMenu = ({ columnKey, columnName, allValues, appliedFilters, onApplyFilter, onSort, onClearFilter, onClearAllFilters, onClose }) => {
    const [filterValues, setFilterValues] = useState(appliedFilters[columnKey] || []);
    const [searchTerm, setSearchTerm] = useState('');
    const menuRef = useRef(null);

    const filteredOptions = useMemo(() => {
        return allValues.filter(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()));
    }, [allValues, searchTerm]);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setFilterValues(allValues);
        } else {
            setFilterValues([]);
        }
    };

    const handleValueChange = (value) => {
        setFilterValues(prev => 
            prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
        );
    };

    const handleApply = () => {
        onApplyFilter(columnKey, filterValues);
        onClose();
    };
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    return (
        <div className="filter-context-menu" ref={menuRef}>
            <div className="filter-context-section sort-section">
                <button onClick={() => onSort(columnKey, 'ASC')}><i className="bi bi-sort-alpha-down"></i> Classificar de A a Z</button>
                <button onClick={() => onSort(columnKey, 'DESC')}><i className="bi bi-sort-alpha-up"></i> Classificar de Z a A</button>
            </div>
            <div className="filter-context-section clear-filter-section">
                <button onClick={() => onClearFilter(columnKey)} disabled={!appliedFilters[columnKey] || appliedFilters[columnKey].length === 0}>
                    <i className="bi bi-eraser"></i> Limpar Filtro de "{columnName}"
                </button>
                 <button onClick={onClearAllFilters} disabled={Object.keys(appliedFilters).length === 0}>
                    <i className="bi bi-eraser-fill"></i> Limpar Todos os Filtros
                </button>
            </div>
            <div className="filter-context-section">
                <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="filter-search-input"
                />
            </div>
            <div className="filter-context-section filter-values-list">
                <label>
                    <input
                        type="checkbox"
                        checked={filterValues.length === allValues.length && allValues.length > 0}
                        onChange={handleSelectAll}
                    />
                    <span>(Selecionar Tudo)</span>
                </label>
                {filteredOptions.map((value, index) => (
                    <label key={index} title={String(value)}>
                        <input
                            type="checkbox"
                            checked={filterValues.includes(value)}
                            onChange={() => handleValueChange(value)}
                        />
                        <span>{String(value)}</span>
                    </label>
                ))}
            </div>
            <div className="filter-context-footer">
                <button className="context-btn-primary" onClick={handleApply}>OK</button>
                <button className="context-btn-secondary" onClick={onClose}>Cancelar</button>
            </div>
        </div>
    );
};


const TableModal = ({ isOpen, onClose, title, columns: initialColumns, rows: initialRows }) => {
    const [sortColumns, setSortColumns] = useState([]);
    const [filters, setFilters] = useState({});
    const [contextMenu, setContextMenu] = useState(null);
    const [isSortModalOpen, setIsSortModalOpen] = useState(false);
    
    const gridRef = useRef(null);
    const modalContentRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setSortColumns([]);
            setFilters({});
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const filteredAndSortedRows = useMemo(() => {
        if (!isOpen) return [];

        let filteredRows = [...initialRows];

        Object.entries(filters).forEach(([key, values]) => {
            if (Array.isArray(values) && values.length > 0) {
                const hasEmptyFilter = values.includes(EMPTY_VALUE_LABEL);
                const otherValues = values.filter(v => v !== EMPTY_VALUE_LABEL);

                filteredRows = filteredRows.filter(row => {
                    const rowValue = row[key];
                    const isRowEmpty = rowValue === null || rowValue === undefined || rowValue === '';
                    
                    if (isRowEmpty) return hasEmptyFilter;
                    if (otherValues.length > 0) return otherValues.includes(rowValue);
                    return hasEmptyFilter && otherValues.length === 0 ? false : true;
                });
            }
        });

        if (sortColumns.length > 0) {
            const columnTypes = new Map(initialColumns.map(c => [c.key, c.type]));
            
            const sortedRows = [...filteredRows];
            sortedRows.sort((a, b) => {
                for (const sort of sortColumns) {
                    const columnKey = sort.columnKey;
                    const columnType = columnTypes.get(columnKey) || 'text';
                    const direction = sort.direction === 'ASC' ? 1 : -1;

                    let aValue = a[columnKey];
                    let bValue = b[columnKey];

                    if (aValue === null || aValue === undefined || aValue === '') return 1;
                    if (bValue === null || bValue === undefined || bValue === '') return -1;
                    
                    // ATUALIZAÇÃO: Lógica de ordenação para o tipo 'datenum'
                    if (columnType === 'datenum') {
                        const parse = (val) => {
                            const str = String(val);
                            if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
                                const [day, month, year] = str.split('/');
                                const date = new Date(`${year}-${month}-${day}`);
                                if (!isNaN(date.getTime())) return { type: 1, value: date }; // Type 1 for dates
                            }
                            const num = parseFloat(str.replace(',', '.'));
                            if (!isNaN(num)) return { type: 2, value: num }; // Type 2 for numbers
                            return { type: 3, value: str }; // Type 3 for other strings
                        };

                        const parsedA = parse(aValue);
                        const parsedB = parse(bValue);

                        // Compara primeiro pelo tipo (datas < números < strings)
                        if (parsedA.type !== parsedB.type) {
                            return (parsedA.type - parsedB.type) * direction;
                        }

                        // Se o tipo for o mesmo, compara pelo valor
                        if (parsedA.value > parsedB.value) return direction;
                        if (parsedA.value < parsedB.value) return -direction;

                        continue; // Se forem iguais, passa para o próximo nível de sort
                    }

                    if (columnType === 'date' && typeof aValue === 'string' && typeof bValue === 'string') {
                        const dateA = aValue.split('/').reverse().join('-');
                        const dateB = bValue.split('/').reverse().join('-');
                        aValue = new Date(dateA);
                        bValue = new Date(dateB);
                    } else if (columnType === 'numeric') {
                        aValue = parseFloat(String(aValue).replace(',', '.'));
                        bValue = parseFloat(String(bValue).replace(',', '.'));
                    }

                    if (aValue > bValue) return direction;
                    if (aValue < bValue) return -direction;
                }
                return 0;
            });
            return sortedRows;
        }

        return filteredRows;
    }, [isOpen, initialRows, filters, sortColumns, initialColumns]);
    
    const cascadingOptions = useMemo(() => {
        const options = {};
        for (const column of initialColumns) {
            const otherFilters = { ...filters };
            delete otherFilters[column.key];

            let availableRows = [...initialRows];
            Object.entries(otherFilters).forEach(([key, values]) => {
                if (Array.isArray(values) && values.length > 0) {
                     const hasEmptyFilter = values.includes(EMPTY_VALUE_LABEL);
                     const otherValues = values.filter(v => v !== EMPTY_VALUE_LABEL);

                     availableRows = availableRows.filter(row => {
                         const rowValue = row[key];
                         const isRowEmpty = rowValue === null || rowValue === undefined || rowValue === '';
                         if (isRowEmpty) return hasEmptyFilter;
                         if (otherValues.length > 0) return otherValues.includes(rowValue);
                         return hasEmptyFilter && otherValues.length === 0 ? false : true;
                     });
                }
            });
            
            const uniqueValues = [...new Set(availableRows.map(r => {
                const val = r[column.key];
                return (val === null || val === undefined || val === '') ? EMPTY_VALUE_LABEL : val;
            }))].sort();
            
            options[column.key] = uniqueValues;
        }
        return options;
    }, [initialColumns, initialRows, filters]);

    const handleFilterIconClick = (event, columnKey) => {
        event.stopPropagation();
        const { top, left, height, width } = event.currentTarget.getBoundingClientRect();
        const menuWidth = 250;
        
        const modalRect = modalContentRef.current.getBoundingClientRect();
        let x = left;
        if (left + menuWidth > modalRect.right) {
            x = left + width - menuWidth;
        }

        setContextMenu({
            key: columnKey,
            x: x,
            y: top + height,
        });
    };

    const columnsWithFilterIcon = useMemo(() => {
        return initialColumns.map(col => ({
            ...col,
            headerCellClass: 'header-cell-with-filter-button',
            renderHeaderCell: (props) => {
                const isFiltered = filters[props.column.key] && filters[props.column.key].length > 0;
                return (
                    <>
                        {props.column.name}
                        <button 
                            className={`filter-icon-btn ${isFiltered ? 'active' : ''}`}
                            onClick={(e) => handleFilterIconClick(e, props.column.key)}
                        >
                            <i className="bi bi-funnel-fill"></i>
                        </button>
                    </>
                )
            }
        }));
    }, [initialColumns, filters]);

    if (!isOpen) return null;

    const handleExport = () => {
        const worksheet = XLSX.utils.json_to_sheet(filteredAndSortedRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
        XLSX.writeFile(workbook, `${title.replace(/ /g, '_')}.xlsx`);
    };

    const handleSort = (columnKey, direction) => {
        setSortColumns([{ columnKey, direction }]);
        setContextMenu(null);
    };
    
    const handleAdvancedSort = (newSortColumns) => {
        setSortColumns(newSortColumns);
        setIsSortModalOpen(false);
    };

    const handleApplyFilter = (columnKey, values) => {
        setFilters(prev => ({ ...prev, [columnKey]: values }));
    };
    
    const handleClearColumnFilter = (columnKey) => {
        setFilters(prev => {
            const newFilters = { ...prev };
            delete newFilters[columnKey];
            return newFilters;
        });
        setContextMenu(null);
    };

    const handleClearAllFilters = () => {
        setFilters({});
        setContextMenu(null);
    };

    const handleClearSorts = () => {
        setSortColumns([]);
    };

    const isSortActive = sortColumns.length > 0;

    return (
        <>
            <div className="modal-overlay" onClick={onClose}>
                <div ref={modalContentRef} className="modal-content table-modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>{title}</h3>
                        <button onClick={onClose} className="modal-close-btn">&times;</button>
                    </div>
                    <div className="table-modal-body">
                        <DataGrid
                            ref={gridRef}
                            columns={columnsWithFilterIcon}
                            rows={filteredAndSortedRows}
                            className="rdg-light"
                            style={{ height: '100%' }}
                            sortColumns={sortColumns}
                            onSortColumnsChange={setSortColumns}
                        />
                        {contextMenu && (
                            <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 2100 }}>
                                <FilterContextMenu
                                    columnKey={contextMenu.key}
                                    columnName={initialColumns.find(c => c.key === contextMenu.key).name}
                                    allValues={cascadingOptions[contextMenu.key]}
                                    appliedFilters={filters}
                                    onApplyFilter={handleApplyFilter}
                                    onSort={handleSort}
                                    onClearFilter={handleClearColumnFilter}
                                    onClearAllFilters={handleClearAllFilters}
                                    onClose={() => setContextMenu(null)}
                                />
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <div className="advanced-sort-wrapper">
                            <button onClick={() => setIsSortModalOpen(true)} className={`modal-button secondary advanced-sort-btn ${isSortActive ? 'active' : ''}`}>
                                <i className="bi bi-sort-down"></i> Classificação Avançada
                            </button>
                            {isSortActive && (
                                <button onClick={handleClearSorts} className="clear-sort-btn" title="Limpar Classificação">
                                    <i className="bi bi-x-lg"></i>
                                </button>
                            )}
                        </div>
                        <button onClick={handleExport} className="modal-button confirm">
                            <i className="bi bi-file-earmark-excel-fill"></i> Exportar para Excel
                        </button>
                    </div>
                </div>
            </div>
            <AdvancedSortModal
                isOpen={isSortModalOpen}
                onClose={() => setIsSortModalOpen(false)}
                columns={initialColumns}
                onApplySort={handleAdvancedSort}
                currentSorts={sortColumns}
                onClearSorts={handleClearSorts}
            />
        </>
    );
};

export default TableModal;
