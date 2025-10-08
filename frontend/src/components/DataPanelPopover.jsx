import React, { useState, useEffect, useRef } from 'react';

// --- Subcomponentes de UI para o painel ---

const AggregationPopover = ({ options, selected, onSelect, onClose, position }) => {
    const popoverRef = useRef(null);
    useEffect(() => {
        const handleMouseDown = (event) => {
            if (popoverRef.current && popoverRef.current.contains(event.target)) {
                return;
            }
            if (event.target.closest('.aggregation-btn')) {
                return;
            }
            
            onClose();
        };

        const timerId = setTimeout(() => {
            document.addEventListener('mousedown', handleMouseDown);
        }, 0);

        return () => {
            clearTimeout(timerId);
            document.removeEventListener('mousedown', handleMouseDown);
        };
    }, [onClose]);

    const adjustedPosition = { ...position };
    if (popoverRef.current) {
        const popoverRect = popoverRef.current.getBoundingClientRect();
        if (adjustedPosition.y + popoverRect.height > window.innerHeight) {
            adjustedPosition.y -= (popoverRect.height + 35); 
        }
    }

    return (
        <div className="aggregation-popover" style={{ top: adjustedPosition.y, left: adjustedPosition.x }} ref={popoverRef}>
            {options.map(opt => (
                <div 
                    key={opt.value} 
                    className={`aggregation-popover-item ${selected === opt.value ? 'selected' : ''}`}
                    onClick={() => { onSelect(opt.value); onClose(); }}
                >
                    {opt.label}
                </div>
            ))}
        </div>
    );
};

const DataFieldItem = ({ 
    item, index, field, onRemove, onAggregationClick, showAggregation, onDisplayNameChange, 
    onDragStart, onDrop, onDragEnter, onDragLeave, isDragOver 
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [alias, setAlias] = useState(item.displayName || item.columnName);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const handleBlur = () => {
        setIsEditing(false);
        if (alias.trim() === '') {
            setAlias(item.columnName);
            onDisplayNameChange(item.columnName);
        } else {
            onDisplayNameChange(alias);
        }
    };
    
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleBlur();
        } else if (e.key === 'Escape') {
            setAlias(item.displayName);
            setIsEditing(false);
        }
    };

    return (
        <div 
            className={`data-field-item ${isDragOver ? 'drag-over-item' : ''}`}
            draggable
            onDragStart={(e) => onDragStart(e, field, index)}
            onDrop={(e) => onDrop(e, field, index)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={(e) => { e.preventDefault(); onDragEnter(index); }}
            onDragLeave={onDragLeave}
        >
            <div className="data-field-item-content" onDoubleClick={() => setIsEditing(true)}>
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={alias}
                        onChange={(e) => setAlias(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className="data-field-alias-input"
                    />
                ) : (
                    <span className="data-field-item-text" title={`${item.tableName}/${item.columnName}`}>
                        {showAggregation && item.aggregation !== 'none' && <span className="aggregation">{item.aggregationLabel} de </span>}
                        {item.displayName}
                    </span>
                )}
            </div>
            {showAggregation && (
                <button className="aggregation-btn" onClick={onAggregationClick} title="Alterar agregação">
                    <i className="bi bi-chevron-down"></i>
                </button>
            )}
            <button className="remove-field-btn" onClick={onRemove} title="Remover campo">
                <i className="bi bi-x-lg"></i>
            </button>
        </div>
    );
};

const DropZone = ({ title, field, fieldData, allowMultiple, aggregatable, dragOverZone, handlers, onAggregationClick, onDisplayNameChange, dragOverIndex }) => {
    const showDropZone = allowMultiple || !fieldData;
    const items = allowMultiple ? (fieldData || []) : (fieldData ? [fieldData] : []);

    return (
        <div className="data-panel-section">
            <h5>{title}</h5>
            <div className={`data-panel-dropzone-container ${allowMultiple ? 'multiple' : 'single'}`}>
                {items.map((item, index) => (
                    <DataFieldItem
                        key={`${item.tableName}-${item.columnName}-${index}`}
                        item={item}
                        index={index}
                        field={field}
                        onRemove={() => handlers.onRemoveColumn(field, allowMultiple ? index : undefined)}
                        onAggregationClick={(e) => onAggregationClick(e, field, allowMultiple ? index : undefined)}
                        showAggregation={aggregatable}
                        onDisplayNameChange={(newAlias) => onDisplayNameChange(field, newAlias, allowMultiple ? index : undefined)}
                        onDragStart={handlers.onDragStartInternal}
                        onDrop={handlers.onDropOnItem}
                        onDragEnter={handlers.onDragEnterItem}
                        onDragLeave={handlers.onDragLeaveItem}
                        isDragOver={dragOverIndex === index}
                    />
                ))}
                {showDropZone && (
                    <div
                        className={`data-panel-dropzone ${dragOverZone === field ? 'drag-over' : ''}`}
                        onDragOver={(e) => handlers.onDragOver(e, field)}
                        onDragLeave={handlers.onDragLeave}
                        onDrop={(e) => handlers.onDropOnZone(e, field)}
                    >
                        <div className="data-panel-dropzone-placeholder">+ Adicionar dados</div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---

const DataPanelPopover = ({ 
    position, visual, allColumns, onClose, onDrop, onRemoveColumn, onAggregationChange, onDisplayNameChange, 
    onReorderItem, onReplaceItem, canvasRef 
}) => {
    // Se não houver um visual selecionado (por exemplo, em uma célula vazia),
    // não renderiza o popover para evitar erros.
    if (!visual) {
        return null;
    }

    const popoverRef = useRef(null);
    const [dragOverZone, setDragOverZone] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [aggregationPopover, setAggregationPopover] = useState(null);
    const [adjustedPosition, setAdjustedPosition] = useState({ x: -9999, y: -9999 });

    const fieldConfig = {
        'card': [{ field: 'value', title: 'Valor', allowMultiple: false, aggregatable: true }],
        'bar-chart': [
            { field: 'yAxis', title: 'Eixo Y (Categorias)', allowMultiple: false, aggregatable: false }, 
            { field: 'xAxis', title: 'Eixo X (Valores)', allowMultiple: true, aggregatable: true }
        ],
        'column-chart': [
            { field: 'xAxis', title: 'Eixo X (Categorias)', allowMultiple: false, aggregatable: false }, 
            { field: 'columnValues', title: 'Valores de Coluna', allowMultiple: true, aggregatable: true }
        ],
        'line-chart': [
            { field: 'xAxis', title: 'Eixo X (Categorias)', allowMultiple: false, aggregatable: false }, 
            { field: 'yAxis', title: 'Eixo Y (Valores)', allowMultiple: true, aggregatable: true }
        ],
        'pie-chart': [
            { field: 'legend', title: 'Legenda (Categorias)', allowMultiple: false, aggregatable: false }, 
            { field: 'values', title: 'Valores', allowMultiple: false, aggregatable: true }
        ],
        'gauge-chart': [
            { field: 'value', title: 'Valor', allowMultiple: false, aggregatable: true }, 
            { field: 'minValue', title: 'Valor Mínimo', allowMultiple: false, aggregatable: true }, 
            { field: 'maxValue', title: 'Valor Máximo', allowMultiple: false, aggregatable: true }
        ],
        'table': [{ field: 'columns', title: 'Colunas', allowMultiple: true, aggregatable: true }],
        'matrix': [
            { field: 'rows', title: 'Linhas', allowMultiple: false, aggregatable: false }, 
            { field: 'columns', title: 'Colunas', allowMultiple: false, aggregatable: false }, 
            { field: 'values', title: 'Valores', allowMultiple: false, aggregatable: true }
        ],
    };

    // --- INÍCIO DA CORREÇÃO ---
    useEffect(() => {
        const handleMouseDown = (event) => {
            // Fecha o painel apenas se o clique ocorrer FORA dele E também FORA do popover de agregação.
            if (popoverRef.current && 
                !popoverRef.current.contains(event.target) && 
                !event.target.closest('.aggregation-popover')) 
            {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleMouseDown);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
        };
    }, [onClose]);
    // --- FIM DA CORREÇÃO ---

    useEffect(() => {
        if (popoverRef.current && canvasRef.current) {
            const popoverRect = popoverRef.current.getBoundingClientRect();
            const canvasRect = canvasRef.current.getBoundingClientRect();
            
            let newTop = position.y;
            let newLeft = position.x;

            if (position.y + popoverRect.height > canvasRect.bottom) newTop = canvasRect.bottom - popoverRect.height - 10;
            if (position.y < canvasRect.top) newTop = canvasRect.top + 10;
            if (position.x + popoverRect.width > canvasRect.right) newLeft = position.x - popoverRect.width - 30;

            setAdjustedPosition({ x: newLeft, y: newTop });
        }
    }, [position, canvasRef]);

    const getAggregationOptions = (visualType, columnType) => {
        const isNumeric = columnType && (columnType.toUpperCase().includes('INT') || columnType.toUpperCase().includes('REAL') || columnType.toUpperCase().includes('FLOAT') || columnType.toUpperCase().includes('DOUBLE'));
        const isChart = ['bar-chart', 'column-chart', 'line-chart', 'pie-chart', 'gauge-chart'].includes(visualType);

        const numericAgg = [{ value: 'sum', label: 'Soma' }, { value: 'average', label: 'Média' }, { value: 'min', label: 'Mínimo' }, { value: 'max', label: 'Máximo' }, { value: 'count', label: 'Contagem' }, { value: 'countd', label: 'Contagem (distinta)' }];
        const fullTextAgg = [{ value: 'first', label: 'Primeiro' }, { value: 'last', label: 'Último' }, { value: 'count', label: 'Contagem' }, { value: 'countd', label: 'Contagem (distinta)' }];
        const chartTextAgg = [{ value: 'count', label: 'Contagem' }, { value: 'countd', label: 'Contagem (distinta)' }];

        if (visualType === 'table' || visualType === 'matrix') return [{ value: 'none', label: 'Não resumir' }, ...(isNumeric ? numericAgg : fullTextAgg)];
        if (isNumeric) return numericAgg;
        if (isChart) return chartTextAgg;
        return fullTextAgg;
    };
    
    const handleAggregationClick = (e, field, index) => {
        e.stopPropagation();
        e.preventDefault();

        const rect = e.currentTarget.getBoundingClientRect();
        const fieldData = Array.isArray(visual[field]) ? visual[field][index] : visual[field];
        if (!fieldData) return;
        
        const table = allColumns[fieldData.tableName];
        const column = table ? table.find(c => c.name === fieldData.columnName) : null;
        const options = getAggregationOptions(visual.id, column ? column.type : 'TEXT');
        
        setAggregationPopover({ field, index, options, position: { x: rect.left, y: rect.bottom + 2 } });
    };

    const aggregationLabels = { sum: 'Soma', average: 'Média', min: 'Mínimo', max: 'Máximo', count: 'Contagem', countd: 'Contagem (distinta)', none: 'Não resumir', first: 'Primeiro', last: 'Último' };

    const handlers = {
        onDragOver: (e, field) => { e.preventDefault(); setDragOverZone(field); },
        onDragLeave: () => setDragOverZone(null),
        onDropOnZone: (e, field) => {
            setDragOverZone(null);
            const cfg = fieldConfig[visual.id].find(f => f.field === field);
            onDrop(e, field, cfg.allowMultiple, cfg.aggregatable);
        },
        onDragStartInternal: (e, field, index) => {
            e.dataTransfer.setData("application/json", JSON.stringify({ source: 'internal', field, index }));
        },
        onDropOnItem: (e, targetField, targetIndex) => {
            e.stopPropagation();
            setDragOverIndex(null);
            const droppedData = JSON.parse(e.dataTransfer.getData("application/json"));
            
            if (droppedData.source === 'internal') {
                if (droppedData.field === targetField) {
                    onReorderItem(targetField, droppedData.index, targetIndex);
                }
            } else { 
                onReplaceItem(targetField, targetIndex, droppedData);
            }
        },
        onDragEnterItem: (index) => setDragOverIndex(index),
        onDragLeaveItem: () => setDragOverIndex(null),
        onRemoveColumn: onRemoveColumn
    };

    const currentFields = fieldConfig[visual.id] || [];
    const visualWithLabels = { ...visual };
    currentFields.forEach(({ field }) => {
        if (visualWithLabels[field]) {
            const items = Array.isArray(visualWithLabels[field]) ? visualWithLabels[field] : [visualWithLabels[field]];
            const updatedItems = items.map(item => ({ ...item, aggregationLabel: aggregationLabels[item.aggregation] || '' }));
            visualWithLabels[field] = Array.isArray(visualWithLabels[field]) ? updatedItems : updatedItems[0];
        }
    });

    return (
        <>
            <div className="data-panel-popover" ref={popoverRef} style={{ top: adjustedPosition.y, left: adjustedPosition.x }}>
                <div className="data-panel-header">
                    <h6>Dados do Visual</h6>
                    <button onClick={onClose} className="close-btn" title="Fechar"><i className="bi bi-x-lg"></i></button>
                </div>
                <div className="data-panel-body">
                    {currentFields.map(config => (
                        <DropZone
                            key={config.field}
                            {...config}
                            fieldData={visualWithLabels[config.field]}
                            dragOverZone={dragOverZone}
                            handlers={handlers}
                            onAggregationClick={handleAggregationClick}
                            onDisplayNameChange={onDisplayNameChange}
                            dragOverIndex={dragOverIndex}
                        />
                    ))}
                </div>
            </div>
            {aggregationPopover && (
                 <AggregationPopover
                    options={aggregationPopover.options}
                    selected={
                        typeof aggregationPopover.index === 'number' && Array.isArray(visual[aggregationPopover.field])
                        ? visual[aggregationPopover.field][aggregationPopover.index]?.aggregation
                        : visual[aggregationPopover.field]?.aggregation
                    }
                    onSelect={(agg) => onAggregationChange(aggregationPopover.field, agg, aggregationPopover.index)}
                    onClose={() => setAggregationPopover(null)}
                    position={aggregationPopover.position}
                />
            )}
        </>
    );
};

export default DataPanelPopover;

