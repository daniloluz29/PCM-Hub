import React, { useEffect, useState } from 'react';

export const CreationSidebar = ({ isExpanded, onToggle, onSave, onLoad, onClear, onExport, edgeType, onEdgeTypeChange }) => {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className={`fluxograma-sidebar creation-sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="sidebar-header">
        {isExpanded && <h3>Blocos e Ações</h3>}
        <button onClick={onToggle} className="sidebar-toggle-btn" title={isExpanded ? 'Recolher' : 'Expandir'}>
          <i className={`bi ${isExpanded ? 'bi-chevron-left' : 'bi-chevron-right'}`}></i>
        </button>
      </div>
      
      {isExpanded ? (
        <div className="sidebar-content">
          <div className="description">Arraste os blocos para a área de desenho.</div>

          <div className="sidebar-section">
            <h4>Tipos de Bloco</h4>
            <div className="fluxograma-nodes">
              <div className="dndnode start-end" onDragStart={(event) => onDragStart(event, 'startEnd')} draggable>
                Início / Fim
              </div>
              <div className="dndnode process" onDragStart={(event) => onDragStart(event, 'process')} draggable>
                Processo
              </div>
              <div className="dndnode decision-preview" onDragStart={(event) => onDragStart(event, 'decision')} draggable>
                <div className="diamond-shape"></div>
                <span>Decisão</span>
              </div>
              <div className="dndnode custom" onDragStart={(event) => onDragStart(event, 'customTask')} draggable>
                Tarefa
              </div>
            </div>
          </div>

          <div className="sidebar-section">
            <h4>Conexões</h4>
            <div className="edge-type-selector">
              <button className={edgeType === 'default' ? 'active' : ''} onClick={() => onEdgeTypeChange('default')}>
                Padrão
              </button>
              <button className={edgeType === 'step' ? 'active' : ''} onClick={() => onEdgeTypeChange('step')}>
                Em Passos
              </button>
              <button className={edgeType === 'smoothstep' ? 'active' : ''} onClick={() => onEdgeTypeChange('smoothstep')}>
                Suave
              </button>
            </div>
          </div>

          <div className="sidebar-actions">
            <button className="action-btn save" onClick={onSave}>
              <i className="bi bi-download"></i> Salvar
            </button>
            <button className="action-btn load" onClick={onLoad}>
              <i className="bi bi-upload"></i> Carregar
            </button>
            <button className="action-btn clear" onClick={onClear}>
              <i className="bi bi-eraser-fill"></i> Limpar
            </button>
            <button className="action-btn export" onClick={onExport}>
              <i className="bi bi-image"></i> Exportar
            </button>
          </div>
        </div>
      ) : (
        <div className="sidebar-title-vertical">
          <span>Blocos e Ações</span>
        </div>
      )}
    </aside>
  );
};

export const FormattingSidebar = ({ isExpanded, onToggle, selectedNodes, onStyleChange }) => {
  const hasSelection = selectedNodes.length > 0;
  const selectedNode = hasSelection ? selectedNodes[0] : null;

  const [fill, setFill] = useState('#ffffff');
  const [border, setBorder] = useState('#000000');
  const [borderWidth, setBorderWidth] = useState(2);
  const [fontColor, setFontColor] = useState('#000000');

  useEffect(() => {
    if (selectedNode?.data?.style) {
      setFill(selectedNode.data.style.backgroundColor || '#ffffff');
      setBorder(selectedNode.data.style.borderColor || '#000000');
      setBorderWidth(selectedNode.data.style.borderWidth || 2);
      setFontColor(selectedNode.data.style.color || '#000000');
    }
  }, [selectedNode]);

  const handleStyleChange = (property, value) => {
    onStyleChange(property, value);
    // Atualiza o estado local para refletir a mudança imediatamente
    switch (property) {
      case 'backgroundColor':
        setFill(value);
        break;
      case 'borderColor':
        setBorder(value);
        break;
      case 'borderWidth':
        setBorderWidth(value);
        break;
      case 'color':
        setFontColor(value);
        break;
      default:
        break;
    }
  };

  return (
    <aside className={`fluxograma-sidebar formatting-sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="sidebar-header">
        {isExpanded && <h3>Formatação</h3>}
        <button onClick={onToggle} className="sidebar-toggle-btn" title={isExpanded ? 'Recolher' : 'Expandir'}>
          <i className={`bi ${isExpanded ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
        </button>
      </div>

      {isExpanded ? (
        <div className="sidebar-content">
          {!hasSelection ? (
            <div className="no-selection">Selecione um ou mais blocos para formatar.</div>
          ) : (
            <>
              <div className="sidebar-section">
                <h4>Estilos do Bloco</h4>
                <p className="description">Aplicado a {selectedNodes.length} bloco(s) selecionado(s).</p>
                <div className="format-option">
                  <label htmlFor="fill-color">Preenchimento</label>
                  <input type="color" id="fill-color" value={fill} onChange={(e) => handleStyleChange('backgroundColor', e.target.value)} />
                </div>
                <div className="format-option">
                  <label htmlFor="border-color">Borda</label>
                  <input type="color" id="border-color" value={border} onChange={(e) => handleStyleChange('borderColor', e.target.value)} />
                </div>
                <div className="format-option">
                  <label htmlFor="border-width">Espessura Borda</label>
                  <input type="number" id="border-width" min="1" max="20" value={borderWidth} onChange={(e) => handleStyleChange('borderWidth', parseInt(e.target.value, 10))} />
                </div>
                <div className="format-option">
                  <label htmlFor="font-color">Cor da Fonte</label>
                  <input type="color" id="font-color" value={fontColor} onChange={(e) => handleStyleChange('color', e.target.value)} />
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
         <div className="sidebar-title-vertical">
          <span>Formatação</span>
        </div>
      )}
    </aside>
  );
};

