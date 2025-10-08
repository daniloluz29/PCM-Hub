import React, { useState, useEffect, useCallback, useRef } from 'react';
import Draggable from 'react-draggable';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';
import Toast from '../../components/Toast.jsx';

const GRID_SIZE = 20;

const getDataTypeIcon = (type) => {
    const upperType = String(type || '').toUpperCase();
    if (upperType.includes('CHAR') || upperType.includes('TEXT')) return 'bi-type';
    if (upperType.includes('INT') || upperType.includes('REAL')) return 'bi-hash';
    if (upperType.includes('DATE')) return 'bi-calendar-date';
    if (upperType.includes('TIME')) return 'bi-clock-history';
    return 'bi-question-circle';
};

// ===== Subcomponentes =====

const TableCard = ({
  table,
  position,
  isSelected,
  onMouseDownCard,
  onColumnDragStart,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop,
  onPositionChange,
  onDragDeltaForSelection,
  dragInfo,
  hoveredRelationshipId,
}) => {
  const nodeRef = useRef(null);

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".table-card-header"
      position={position || { x: 100, y: 100 }} // posição default
      onDrag={(e, data) => {
        // movimento em grupo: aplica delta a todos os selecionados (controlado pelo pai)
        onDragDeltaForSelection(table.name, data.deltaX, data.deltaY);
      }}
      onStop={(e, data) => {
        // snap-to-grid ao soltar
        const snapped = {
          x: Math.round(data.x / GRID_SIZE) * GRID_SIZE,
          y: Math.round(data.y / GRID_SIZE) * GRID_SIZE,
        };
        onPositionChange(table.name, snapped);
      }}
    >
      <div
        ref={nodeRef}
        className={`table-card ${isSelected ? 'selected' : ''}`}
        data-table-name={table.name}
        style={{ zIndex: 1 }}
        onMouseDown={(e) => onMouseDownCard(e, table.name)}
      >
        <div className="table-card-header">
          <i className="bi bi-table"></i>
          <span>{table.displayName}</span>
        </div>

        <div className="table-card-body">
          {table.columns?.map((col) => {
            const isDraggingSource =
              dragInfo.start?.tableName === table.name &&
              dragInfo.start?.columnName === col.name;
            const isDragOverTarget =
              dragInfo.over?.tableName === table.name &&
              dragInfo.over?.columnName === col.name;
            const isHighlighted =
              hoveredRelationshipId &&
              ((
                hoveredRelationshipId.fromTable === table.name &&
                hoveredRelationshipId.fromColumn === col.name
              ) ||
                (
                  hoveredRelationshipId.toTable === table.name &&
                  hoveredRelationshipId.toColumn === col.name
                ));

            return (
              <div
                key={col.name}
                className={`table-column-item ${isDraggingSource ? 'dragging-source' : ''} ${isDragOverTarget ? 'drag-over-target' : ''} ${isHighlighted ? 'highlighted-by-line' : ''}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'linkMove';
                  onColumnDragStart(e, table.name, col.name);
                }}
                onDrop={(e) => onColumnDrop(e, table.name, col.name)}
                onDragOver={(e) => {
                  e.preventDefault();
                  onColumnDragOver(table.name, col.name);
                }}
                onDragLeave={onColumnDragLeave}
                data-table-name={table.name}
                data-column-name={col.name}
              >
                <i className={`bi ${getDataTypeIcon(col.type)}`}></i>
                <span>{col.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Draggable>
  );
};

const ContextMenu = ({ x, y, options, onClose }) => {
  const menuRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) onClose();
    };
    document.addEventListener('click', handleClickOutside, false); // bubbling
    return () => document.removeEventListener('click', handleClickOutside, false);
  }, [onClose]);

  return (
    <div ref={menuRef} className="context-menu-container" style={{ top: y, left: x, zIndex: 10 }}>
      {options.map((option) => (
        <div key={option.label} className={`context-menu-item ${option.className || ''}`} onClick={option.action}>
          <i className={`bi ${option.icon}`}></i>
          <span>{option.label}</span>
        </div>
      ))}
    </div>
  );
};

// ===== Componente principal =====

const RelacionamentosBI = () => {
  const [tables, setTables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [positions, setPositions] = useState({});
  const [cardDimensions, setCardDimensions] = useState({});
  const [relationships, setRelationships] = useState([]);
  const [dragInfo, setDragInfo] = useState({ start: null, over: null });
  const canvasRef = useRef(null);
  const [rerender, setRerender] = useState(0);
  const isInitialMount = useRef(true);
  const [contextMenu, setContextMenu] = useState(null);
  const [relationshipToDelete, setRelationshipToDelete] = useState(null);
  const savePositionTimeout = useRef(null);
  const saveRelationshipsTimeout = useRef(null);
  const [toastState, setToastState] = useState({ visible: false, message: '', type: 'info' });
  const [hoveredRelationshipId, setHoveredRelationshipId] = useState(null);
  const [selectedTables, setSelectedTables] = useState(new Set());

  const handleSave = useCallback(async (endpoint, payload, entityName, showToast = true) => {
    if (showToast) setToastState({ visible: true, message: `A guardar ${entityName}...`, type: 'info' });
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/bi/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error((await response.json()).message);
      if (showToast) setToastState({ visible: true, message: `${entityName.charAt(0).toUpperCase() + entityName.slice(1)} guardados com sucesso!`, type: 'success' });
    } catch (error) {
      console.error(`Erro ao salvar ${entityName}:`, error);
      if (showToast) setToastState({ visible: true, message: `Erro ao guardar ${entityName}: ${error.message}`, type: 'error' });
    }
  }, []);

  useEffect(() => {
    if (isInitialMount.current || isLoading) return;
    if (saveRelationshipsTimeout.current) clearTimeout(saveRelationshipsTimeout.current);
    saveRelationshipsTimeout.current = setTimeout(() => {
      handleSave('relationships', { relationships }, 'relacionamentos');
    }, 1000);
  }, [relationships, handleSave, isLoading]);

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        const [tablesRes, relsRes] = await Promise.all([
          fetch('http://127.0.0.1:5000/api/bi/tables'),
          fetch('http://127.0.0.1:5000/api/bi/relationships'),
        ]);
        const tablesData = await tablesRes.json();
        const relsData = await relsRes.json();

        if (tablesRes.ok) {
          const initialPositions = {};
          const tablesWithSchemas = await Promise.all(
            tablesData.map(async (table, index) => {
              const schemaRes = await fetch(`http://127.0.0.1:5000/api/bi/table-schema/${table.name}`);
              const schemaData = await schemaRes.json();
              initialPositions[table.name] = table.coords || { x: 50 + index * 40, y: 50 + index * 40 };
              return { ...table, columns: schemaData.columns || [] };
            })
          );
          setTables(tablesWithSchemas);
          setPositions(initialPositions);
          if (relsRes.ok) setRelationships(relsData);
        }
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      } finally {
        setIsLoading(false);
        isInitialMount.current = false;
      }
    };
    fetchAllData();
  }, []);

  // ---- Medição dos cards ----
  useEffect(() => {
    const observer = new ResizeObserver(() => setRerender((r) => r + 1));
    const currentRef = canvasRef.current;
    if (currentRef) {
      observer.observe(currentRef);
      const dimensions = {};
      tables.forEach((table) => {
        const cardNode = currentRef.querySelector(`.table-card[data-table-name="${table.name}"]`);
        if (cardNode) {
          dimensions[table.name] = { width: cardNode.offsetWidth, height: cardNode.offsetHeight };
        }
      });
      setCardDimensions(dimensions);
    }
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [isLoading, tables]);

  // ---- Salvar posição com debounce (1 card) ----
  const handlePositionChange = (tableName, newPos) => {
    const snapped = {
      x: Math.round(newPos.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(newPos.y / GRID_SIZE) * GRID_SIZE,
    };

    setPositions((prev) => ({ ...prev, [tableName]: snapped }));
    setRerender((r) => r + 1);

    if (savePositionTimeout.current) clearTimeout(savePositionTimeout.current);
    savePositionTimeout.current = setTimeout(() => {
      handleSave('tables/positions', { positions: { [tableName]: snapped } }, 'posição', false);
    }, 500);
  };

  // ---- Salvar posições em lote (grupo) ----
  const handlePositionsChangeBatch = (positionsDict) => {
    const snappedDict = {};
    for (const [tName, pos] of Object.entries(positionsDict)) {
      snappedDict[tName] = {
        x: Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(pos.y / GRID_SIZE) * GRID_SIZE,
      };
    }

    setPositions((prev) => ({ ...prev, ...snappedDict }));
    setRerender((r) => r + 1);

    if (savePositionTimeout.current) clearTimeout(savePositionTimeout.current);
    savePositionTimeout.current = setTimeout(() => {
      handleSave('tables/positions', { positions: snappedDict }, 'posição', false);
    }, 500);
  };

  // ---- Drag & Drop de colunas ----
  const handleColumnDragStart = (e, tableName, columnName) =>
    setDragInfo({ start: { tableName, columnName }, over: null });
  const handleColumnDragOver = (tableName, columnName) => {
    if (dragInfo.start && dragInfo.start.tableName !== tableName)
      setDragInfo((prev) => ({ ...prev, over: { tableName, columnName } }));
  };
  const handleColumnDragLeave = () => setDragInfo((prev) => ({ ...prev, over: null }));
  const handleColumnDrop = (e, targetTableName, targetColumnName) => {
    if (dragInfo.start && dragInfo.start.tableName !== targetTableName) {
      const newRelationship = {
        id: crypto.randomUUID(),
        fromTable: dragInfo.start.tableName,
        fromColumn: dragInfo.start.columnName,
        toTable: targetTableName,
        toColumn: targetColumnName,
      };

      // **CORREÇÃO DE UX**: Validação para não criar relacionamentos duplicados
      const alreadyExists = relationships.some(
        (r) =>
          (r.fromTable === newRelationship.fromTable &&
            r.fromColumn === newRelationship.fromColumn &&
            r.toTable === newRelationship.toTable &&
            r.toColumn === newRelationship.toColumn) ||
          (r.fromTable === newRelationship.toTable &&
            r.fromColumn === newRelationship.toColumn &&
            r.toTable === newRelationship.fromTable &&
            r.toColumn === newRelationship.fromColumn)
      );

      if (!alreadyExists) {
        setRelationships((prev) => [...prev, newRelationship]);
      } else {
        console.warn("Tentativa de criar um relacionamento duplicado foi ignorada.");
      }
    }
    setDragInfo({ start: null, over: null });
  };

  // ---- Menu de contexto / exclusão ----
  const handleLineContextMenu = (e, rel) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, relationship: rel });
  };
  const handleDeleteRelationship = () => {
    if (contextMenu?.relationship) {
      setRelationshipToDelete(contextMenu.relationship);
      setContextMenu(null);
    }
  };
  const handleDeleteConfirm = () => {
    if (relationshipToDelete) {
      setRelationships((prev) => prev.filter((r) => r.id !== relationshipToDelete.id));
      setRelationshipToDelete(null);
    }
  };

  // ---- Conectores (curvas) ----
  const calculateConnectorPath = useCallback(
    (fromTable, toTable) => {
      const fromPos = positions[fromTable.name];
      const toPos = positions[toTable.name];
      const fromDim = cardDimensions[fromTable.name];
      const toDim = cardDimensions[toTable.name];

      if (!fromPos || !toPos || !fromDim || !toDim) return '';

      const fromCenterX = fromPos.x + fromDim.width / 2;
      const toCenterX = toPos.x + toDim.width / 2;
      const fromCenterY = fromPos.y + fromDim.height / 2;
      const toCenterY = toPos.y + toDim.height / 2;

      let fromPoint = { x: fromCenterX, y: fromCenterY };
      let toPoint = { x: toCenterX, y: toCenterY };

      if (Math.abs(fromCenterX - toCenterX) > Math.abs(fromCenterY - toCenterY)) {
        // conectar pelos lados
        if (fromCenterX < toCenterX) {
          fromPoint.x = fromPos.x + fromDim.width;
          toPoint.x = toPos.x;
        } else {
          fromPoint.x = fromPos.x;
          toPoint.x = toPos.x + toDim.width;
        }
      } else {
        // conectar por cima/baixo
        if (fromCenterY < toCenterY) {
          fromPoint.y = fromPos.y + fromDim.height;
          toPoint.y = toPos.y;
        } else {
          fromPoint.y = fromPos.y;
          toPoint.y = toPos.y + toDim.height;
        }
      }

      const midX = (fromPoint.x + toPoint.x) / 2;
      return `M ${fromPoint.x} ${fromPoint.y} C ${midX} ${fromPoint.y}, ${midX} ${toPoint.y}, ${toPoint.x} ${toPoint.y}`;
    },
    [positions, cardDimensions]
  );

  // ===== Seleção múltipla =====
  const onMouseDownCard = (e, tableName) => {
    e.stopPropagation();
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (e.ctrlKey) {
        if (next.has(tableName)) next.delete(tableName);
        else next.add(tableName);
      } else {
        next.clear();
        next.add(tableName);
      }
      return next;
    });
  };

  const onCanvasMouseDown = (e) => {
    if (!e.ctrlKey) setSelectedTables(new Set());
  };

  const onDragDeltaForSelection = (draggedTableName, deltaX, deltaY) => {
    setPositions((prev) => {
      const group = selectedTables.size ? selectedTables : new Set([draggedTableName]);
      const next = { ...prev };
      group.forEach((tName) => {
        const p = next[tName] || { x: 0, y: 0 };
        next[tName] = { x: p.x + deltaX, y: p.y + deltaY };
      });
      return next;
    });
  };

  // Ao soltar um card, aplicamos snap e salvamos lote se houver grupo
  const finalizeGroupDragAndSave = (releasedTableName) => {
    const group = selectedTables.size ? selectedTables : new Set([releasedTableName]);
    const payload = {};
    group.forEach((tName) => {
      const pos = positions[tName];
      if (pos) {
        payload[tName] = {
          x: Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
          y: Math.round(pos.y / GRID_SIZE) * GRID_SIZE,
        };
      }
    });
    if (Object.keys(payload).length) {
      handlePositionsChangeBatch(payload);
    }
  };

  if (isLoading) return <div className="loading-placeholder">Carregando modelo de dados...</div>;

  return (
    <>
      {toastState.visible && (
          <Toast
              message={toastState.message}
              type={toastState.type}
              onClose={() => setToastState({ ...toastState, visible: false })}
          />
      )}
      <div className="relationships-container">
        <div className="relationships-canvas grid-bg" ref={canvasRef} onMouseDown={onCanvasMouseDown}>
          <svg className="relationship-lines-svg">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#34495e" />
              </marker>
            </defs>

            {relationships.map((rel) => {
              const fromTable = tables.find((t) => t.name === rel.fromTable);
              const toTable = tables.find((t) => t.name === rel.toTable);
              if (!fromTable || !toTable) return null;
              const path = calculateConnectorPath(fromTable, toTable);
              return (
                <g
                  key={rel.id}
                  className="relationship-line-group"
                  onContextMenu={(e) => handleLineContextMenu(e, rel)}
                  onMouseEnter={() => setHoveredRelationshipId(rel)}
                  onMouseLeave={() => setHoveredRelationshipId(null)}
                >
                  <path d={path} className="relationship-line-hitbox" />
                  <path d={path} className="relationship-line" />
                </g>
              );
            })}
          </svg>

          {tables.map((table) => (
            <TableCard
              key={table.name}
              table={table}
              position={positions[table.name]}
              isSelected={selectedTables.has(table.name)}
              onMouseDownCard={onMouseDownCard}
              onColumnDragStart={handleColumnDragStart}
              onColumnDragOver={handleColumnDragOver}
              onColumnDragLeave={handleColumnDragLeave}
              onColumnDrop={handleColumnDrop}
              onPositionChange={(t, pos) => {
                handlePositionChange(t, pos);
                finalizeGroupDragAndSave(t); // salva grupo inteiro com snap
              }}
              onDragDeltaForSelection={onDragDeltaForSelection}
              dragInfo={dragInfo}
              hoveredRelationshipId={hoveredRelationshipId}
            />
          ))}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          options={[
            { label: 'Excluir Relacionamento', icon: 'bi-trash-fill', className: 'delete', action: handleDeleteRelationship },
          ]}
        />
      )}

      <ModalConfirmacao
        isOpen={!!relationshipToDelete}
        onClose={() => setRelationshipToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Confirmar Exclusão"
      >
        <p>Você tem certeza que deseja excluir este relacionamento?</p>
      </ModalConfirmacao>
    </>
  );
};

export default RelacionamentosBI;

