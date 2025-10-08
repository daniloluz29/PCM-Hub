import React, { useState, useEffect, useRef } from 'react';

// --- Subcomponentes de UI ---
const FormatSection = ({ title, children, isExpanded, onToggle }) => (
    <div className="layout-panel-section">
        <div className="layout-panel-section-header" onClick={onToggle}>
            <i className={`bi bi-chevron-${isExpanded ? 'down' : 'right'}`}></i>
            <h5 className="layout-panel-section-title">{title}</h5>
        </div>
        {isExpanded && <div className="layout-panel-section-content">{children}</div>}
    </div>
);
const ToggleSwitch = ({ label, checked, onChange }) => ( <div className="layout-control-group"> <label>{label}</label> <label className="switch"> <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /> <span className="slider round"></span> </label> </div> );
const ColorInput = ({ value, onChange }) => ( <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} /> );
const NumberInput = ({ label, value, onChange, min, max, step, placeholder }) => ( <div className="layout-control-group"><label>{label}</label><input type="number" value={value ?? ''} onChange={e => onChange(parseFloat(e.target.value))} min={min} max={max} step={step} placeholder={placeholder} /></div> );
const TextInput = ({ label, value, onChange, placeholder }) => ( <div className="layout-control-group text-input-group"> <label>{label}</label> <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} /> </div> );
const SelectInput = ({ label, value, onChange, options }) => ( <div className="layout-control-group"> <label>{label}</label> <select value={value} onChange={e => onChange(e.target.value)}> {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> );
const FontFormatGroup = ({ label, value = {}, onChange }) => { const handleValueChange = (key, val) => { onChange({ ...value, [key]: val }); }; return ( <div className="font-format-group"> <div className="font-format-row"> <label>{label}</label> <div className="font-format-controls"> <button className={`font-style-btn ${value.bold ? 'active' : ''}`} onClick={() => handleValueChange('bold', !value.bold)} title="Negrito"> N </button> <NumberInput value={value.fontSize} onChange={v => handleValueChange('fontSize', v)} min={8} max={48} /> <ColorInput value={value.color} onChange={v => handleValueChange('color', v)} /> </div> </div> </div> ); };


// --- Componente Principal ---
const LayoutPanelPopover = ({ visual, onClose, onApplyFormat, position, canvasRef, allColumns }) => {
    // Se não houver um visual selecionado (por exemplo, em uma célula vazia),
    // não renderiza o popover para evitar erros.
    if (!visual) {
        return null;
    }
    
    const popoverRef = useRef(null);
    const [adjustedPosition, setAdjustedPosition] = useState({ x: -9999, y: -9999 });
    const [expandedSections, setExpandedSections] = useState({});
    // --- INÍCIO DA CORREÇÃO ---
    const [formatOptions, setFormatOptions] = useState(visual.format || {});
    const [selectedColumn, setSelectedColumn] = useState('all');
    
    // Sincroniza o estado interno com as props do visual quando elas mudam.
    useEffect(() => {
        setFormatOptions(visual.format || {});
    }, [visual]);
    // --- FIM DA CORREÇÃO ---

    useEffect(() => {
        const handleMouseDown = (event) => {
            // Se o clique for fora do popover E também fora de qualquer modal, fecha.
            if (popoverRef.current && !popoverRef.current.contains(event.target) && !event.target.closest('.modal-overlay')) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [onClose]);

    useEffect(() => {
        if (popoverRef.current && canvasRef.current) {
            const popoverRect = popoverRef.current.getBoundingClientRect(); const canvasRect = canvasRef.current.getBoundingClientRect();
            let newTop = position.y, newLeft = position.x;
            if (position.y + popoverRect.height > canvasRect.bottom) newTop = canvasRect.bottom - popoverRect.height - 10;
            if (position.y < canvasRect.top) newTop = canvasRect.top + 10;
            if (position.x + popoverRect.width > canvasRect.right) newLeft = position.x - popoverRect.width - 30;
            setAdjustedPosition({ x: newLeft, y: newTop });
        }
    }, [position, expandedSections, canvasRef]);

    const handleFormatChange = (path, value) => {
        setFormatOptions(prev => {
            const newOptions = JSON.parse(JSON.stringify(prev));
            let current = newOptions;
            for (let i = 0; i < path.length - 1; i++) {
                current[path[i]] = current[path[i]] || {};
                current = current[path[i]];
            }
            current[path[path.length - 1]] = value;
            return newOptions;
        });
    };
    
    const handleApply = () => { onApplyFormat(formatOptions); onClose(); };
    const toggleSection = (sectionName) => { setExpandedSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] })); };
    
    const renderGeneralOptions = () => ( <FormatSection title="Geral" isExpanded={!!expandedSections['general']} onToggle={() => toggleSection('general')}> <ToggleSwitch label="Título" checked={formatOptions.title?.show ?? true} onChange={v => handleFormatChange(['title', 'show'], v)} /> {formatOptions.title?.show !== false && ( <> <TextInput label="Texto" value={formatOptions.title?.text} onChange={v => handleFormatChange(['title', 'text'], v)} placeholder={visual.name} /> <FontFormatGroup label="Fonte" value={formatOptions.title?.font} onChange={v => handleFormatChange(['title', 'font'], v)} /> </> )} <div className="layout-control-group"> <label>Cor do Fundo</label> <ColorInput value={formatOptions.background?.color} onChange={v => handleFormatChange(['background', 'color'], v)} /> </div> </FormatSection> );
    const renderDataLabelOptions = () => ( <FormatSection title="Rótulos de Dados" isExpanded={!!expandedSections['dataLabels']} onToggle={() => toggleSection('dataLabels')}> <ToggleSwitch label="Exibir" checked={formatOptions.dataLabels?.show ?? false} onChange={v => handleFormatChange(['dataLabels', 'show'], v)} /> {formatOptions.dataLabels?.show && ( <> <FontFormatGroup label="Fonte" value={formatOptions.dataLabels?.font} onChange={v => handleFormatChange(['dataLabels', 'font'], v)} /> <NumberInput label="Casas Decimais" value={formatOptions.dataLabels?.decimals} onChange={v => handleFormatChange(['dataLabels', 'decimals'], v)} min={0} max={5} step={1} /> <SelectInput label="Posição" value={formatOptions.dataLabels?.position} onChange={v => handleFormatChange(['dataLabels', 'position'], v)} options={[ { value: 'end', label: 'Externo / Topo' }, { value: 'center', label: 'Centro' }, { value: 'start', label: 'Base / Inferior' }, ]} /> </> )} </FormatSection> );
    const renderAxisOptions = (axisKey, axisLabel) => ( <FormatSection title={`Eixo ${axisLabel}`} isExpanded={!!expandedSections[axisKey]} onToggle={() => toggleSection(axisKey)}> <ToggleSwitch label="Exibir Eixo" checked={formatOptions[axisKey]?.show ?? true} onChange={v => handleFormatChange([axisKey, 'show'], v)} /> {formatOptions[axisKey]?.show !== false && ( <> <ToggleSwitch label="Exibir Título do Eixo" checked={formatOptions[axisKey]?.showTitle ?? true} onChange={v => handleFormatChange([axisKey, 'showTitle'], v)} /> <FontFormatGroup label="Fonte" value={formatOptions[axisKey]?.font} onChange={v => handleFormatChange([axisKey, 'font'], v)} /> </> )} </FormatSection> );
    
    const renderTableOptions = () => {
        const columnOptions = [ { value: 'all', label: 'Todas' }, ...(visual.columns?.map(c => ({ value: c.displayName || c.columnName, label: c.displayName || c.columnName })) || []) ];
        
        return (
            <>
                <FormatSection title="Total" isExpanded={!!expandedSections['total']} onToggle={() => toggleSection('total')}> <ToggleSwitch label="Exibir Total" checked={formatOptions.total?.show ?? false} onChange={v => handleFormatChange(['total', 'show'], v)} /> </FormatSection>
                <FormatSection title="Coluna" isExpanded={!!expandedSections['column']} onToggle={() => toggleSection('column')}>
                    <SelectInput label="Formatar Coluna" value={selectedColumn} onChange={setSelectedColumn} options={columnOptions} />
                    <div className="column-format-subgroup">
                        <h6>Cabeçalho</h6>
                        <FontFormatGroup label="Fonte" value={formatOptions.columnSettings?.[selectedColumn]?.header?.font} onChange={v => handleFormatChange(['columnSettings', selectedColumn, 'header', 'font'], v)} />
                        <div className="layout-control-group"> <label>Cor do Fundo</label> <ColorInput value={formatOptions.columnSettings?.[selectedColumn]?.header?.backgroundColor} onChange={v => handleFormatChange(['columnSettings', selectedColumn, 'header', 'backgroundColor'], v)} /> </div>
                    </div>
                    <div className="column-format-subgroup">
                        <h6>Corpo</h6>
                         <SelectInput label="Alinhamento" value={formatOptions.columnSettings?.[selectedColumn]?.values?.align} onChange={v => handleFormatChange(['columnSettings', selectedColumn, 'values', 'align'], v)} options={[ { value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Direita' }, ]} />
                         <div className="layout-control-group">
                            <label>Cor da Fonte</label>
                            <ColorInput value={formatOptions.columnSettings?.[selectedColumn]?.values?.font?.color} onChange={v => handleFormatChange(['columnSettings', selectedColumn, 'values', 'font', 'color'], v)} />
                        </div>
                    </div>
                </FormatSection>
            </>
        );
    };

    const renderChartOptions = () => {
        switch(visual.id) {
            case 'table': case 'matrix': return renderTableOptions();
            case 'bar-chart': case 'column-chart': case 'line-chart': return ( <> {renderAxisOptions('xAxis', 'X')} {renderAxisOptions('yAxis', 'Y')} <FormatSection title="Legenda" isExpanded={!!expandedSections['legend']} onToggle={() => toggleSection('legend')}> <ToggleSwitch label="Exibir Legenda" checked={formatOptions.legend?.show ?? true} onChange={v => handleFormatChange(['legend', 'show'], v)} /> </FormatSection> <FormatSection title="Linhas de Grade" isExpanded={!!expandedSections['grid']} onToggle={() => toggleSection('grid')}> <ToggleSwitch label="Exibir" checked={formatOptions.grid?.show ?? true} onChange={v => handleFormatChange(['grid', 'show'], v)} /> </FormatSection> <FormatSection title="Cores dos Dados" isExpanded={!!expandedSections['dataColors']} onToggle={() => toggleSection('dataColors')}> <div className="layout-control-group"> <label>Cor Padrão</label> <ColorInput value={formatOptions.dataColors?.defaultColor} onChange={v => handleFormatChange(['dataColors', 'defaultColor'], v)} /> </div> </FormatSection> {renderDataLabelOptions()} </> );
            case 'pie-chart': return ( <FormatSection title="Legenda" isExpanded={!!expandedSections['legend']} onToggle={() => toggleSection('legend')}> <ToggleSwitch label="Exibir" checked={formatOptions.legend?.show ?? true} onChange={v => handleFormatChange(['legend', 'show'], v)} /> </FormatSection> );
            case 'gauge-chart': return ( <FormatSection title="Medidor" isExpanded={!!expandedSections['gauge']} onToggle={() => toggleSection('gauge')}> <div className="layout-control-group"> <label>Cor do Valor</label> <ColorInput value={formatOptions.gauge?.valueColor} onChange={v => handleFormatChange(['gauge', 'valueColor'], v)} /> </div> <div className="layout-control-group"> <label>Cor de Fundo</label> <ColorInput value={formatOptions.gauge?.backgroundColor} onChange={v => handleFormatChange(['gauge', 'backgroundColor'], v)} /> </div> <NumberInput label="Valor Mínimo (Manual)" value={formatOptions.gauge?.min} onChange={v => handleFormatChange(['gauge', 'min'], v)} placeholder="Auto" /> <NumberInput label="Valor Máximo (Manual)" value={formatOptions.gauge?.max} onChange={v => handleFormatChange(['gauge', 'max'], v)} placeholder="Auto" /> </FormatSection> );
            case 'card': return ( <> <FormatSection title="Rótulo de Dados" isExpanded={!!expandedSections['cardLabel']} onToggle={() => toggleSection('cardLabel')}> <ToggleSwitch label="Exibir" checked={formatOptions.cardLabel?.show ?? true} onChange={v => handleFormatChange(['cardLabel', 'show'], v)} /> </FormatSection> <FormatSection title="Valor" isExpanded={!!expandedSections['dataLabels']} onToggle={() => toggleSection('dataLabels')}> <FontFormatGroup label="Fonte" value={formatOptions.dataLabels?.font} onChange={v => handleFormatChange(['dataLabels', 'font'], v)} /> <NumberInput label="Casas Decimais" value={formatOptions.dataLabels?.decimals} onChange={v => handleFormatChange(['dataLabels', 'decimals'], v)} min={0} max={5} step={1} /> </FormatSection> </> );
            default: return null;
        }
    };
    
    return (
        <div className="layout-panel-popover" ref={popoverRef} style={{ top: adjustedPosition.y, left: adjustedPosition.x }}>
            <div className="layout-panel-header"> <h6>Formatar Visual</h6> <button onClick={onClose} className="close-btn" title="Fechar"><i className="bi bi-x-lg"></i></button> </div>
            <div className="layout-panel-body"> {renderGeneralOptions()} {renderChartOptions()} </div>
            <div className="layout-panel-footer"> <button className="modal-button cancel" onClick={onClose}>Cancelar</button> <button className="modal-button confirm" onClick={handleApply}>Aplicar</button> </div>
        </div>
    );
};

export default LayoutPanelPopover;

