// Fluxograma.jsx
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '@reactflow/node-resizer/dist/style.css';
import { toPng } from 'html-to-image';

import { CreationSidebar, FormattingSidebar } from '../components/FlowSidebars.jsx';
import ModalConfirmacao from '../components/ModalConfirmacao.jsx';

import {
  StartEndNode,
  ProcessNode,
  DecisionNode,
  CustomTaskNode,
} from '../components/CustomNodes.jsx';

let id = 0;
const getId = () => `dndnode_${id++}`;

const PaginaFluxograma = () => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedElements, setSelectedElements] = useState([]);
  const [edgeType, setEdgeType] = useState('default');
  const [isClearModalOpen, setClearModalOpen] = useState(false);

  const [isCreationSidebarExpanded, setCreationSidebarExpanded] = useState(true);
  const [isFormattingSidebarExpanded, setFormattingSidebarExpanded] = useState(true);

  const updateNodeData = useCallback((nodeId, newData) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, ...newData },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const nodeTypes = useMemo(() => ({
    startEnd: (props) => <StartEndNode {...props} onUpdate={updateNodeData} />,
    process: (props) => <ProcessNode {...props} onUpdate={updateNodeData} />,
    decision: (props) => <DecisionNode {...props} onUpdate={updateNodeData} />,
    customTask: (props) => <CustomTaskNode {...props} onUpdate={updateNodeData} />,
  }), [updateNodeData]);

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge({ ...params, type: edgeType, animated: true, style: { strokeWidth: 2 } }, eds)
      ),
    [setEdges, edgeType]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const nodeId = getId();

      const defaultStyle = {
        backgroundColor: '#ffffff',
        borderColor: '#000000',
        borderWidth: 2,
        color: '#000000',
      };

      let newNodeData = {};
      let newNodeType = type;
      let nodeSize = { width: 150, height: 50 }; // Tamanho padrão

      switch (type) {
        case 'startEnd':
          newNodeData = {
            label: 'Início / Fim',
            style: { ...defaultStyle, backgroundColor: '#d4edda', borderColor: '#155724', color: '#155724' },
          };
          break;
        case 'decision':
          nodeSize = { width: 100, height: 100 }; // Tamanho para o losango
          newNodeData = {
            label: 'Decisão',
            style: { ...defaultStyle, backgroundColor: '#fff3cd', borderColor: '#856404', color: '#856404' },
          };
          break;
        case 'customTask':
          nodeSize = { width: 180, height: 120 }; // Tamanho maior para a tarefa
          newNodeData = {
            title: 'Título da Tarefa',
            body: 'Descrição...',
            style: { ...defaultStyle, backgroundColor: '#f8f9fa', borderColor: '#adb5bd', color: '#343a40' },
          };
          break;
        default:
          newNodeType = 'process';
          newNodeData = {
            label: 'Processo',
            style: { ...defaultStyle, backgroundColor: '#cce5ff', borderColor: '#004085', color: '#004085' },
          };
      }

      const newNode = {
        id: nodeId,
        type: newNodeType,
        position,
        data: newNodeData,
        width: nodeSize.width,   // CORREÇÃO: Adiciona largura inicial
        height: nodeSize.height, // CORREÇÃO: Adiciona altura inicial
        style: {
          backgroundColor: newNodeData.style?.backgroundColor ?? defaultStyle.backgroundColor,
          border: `${newNodeData.style?.borderWidth ?? defaultStyle.borderWidth}px solid ${newNodeData.style?.borderColor ?? defaultStyle.borderColor}`,
          color: newNodeData.style?.color ?? defaultStyle.color,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onSelectionChange = useCallback(({ nodes: selNodes = [], edges: selEdges = [] }) => {
    setSelectedElements([...selNodes, ...selEdges]);
  }, []);

  const onKeyDown = useCallback(
    (event) => {
      const tag = event.target?.tagName?.toLowerCase?.();
      if (tag === 'input' || tag === 'textarea') return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedElements.length > 0) {
          const nodeIdsToDelete = selectedElements.filter((el) => el.position).map((n) => n.id);
          const edgeIdsToDelete = selectedElements.filter((el) => el.source).map((e) => e.id);

          setNodes((nds) => nds.filter((n) => !nodeIdsToDelete.includes(n.id)));
          setEdges((eds) => eds.filter((e) => !edgeIdsToDelete.includes(e.id)));
        }
      }
    },
    [selectedElements, setNodes, setEdges]
  );

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);

  const updateNodeStyleProperties = useCallback(
    (property, value) => {
      const selectedNodeIds = selectedElements.filter((el) => el.position).map((n) => n.id);
      if (selectedNodeIds.length === 0) return;

      setNodes((nds) =>
        nds.map((node) => {
          if (!selectedNodeIds.includes(node.id)) return node;

          const existingDataStyle = (node.data && node.data.style) ? { ...node.data.style } : {};
          const newDataStyle = { ...existingDataStyle, [property]: value };

          const borderWidth = Number(newDataStyle.borderWidth) || 0;
          const borderColor = newDataStyle.borderColor || existingDataStyle.borderColor || (node.style && node.style.border ? (node.style.border.split(' ').pop() || '#000') : '#000');
          const backgroundColor = newDataStyle.backgroundColor || existingDataStyle.backgroundColor || node.style?.backgroundColor || '#ffffff';
          const color = newDataStyle.color || existingDataStyle.color || node.style?.color || '#000000';

          const newNodeStyle = {
            ...node.style,
            backgroundColor,
            border: `${borderWidth}px solid ${borderColor}`,
            color,
          };

          return {
            ...node,
            data: {
              ...node.data,
              style: newDataStyle,
            },
            style: newNodeStyle,
          };
        })
      );
    },
    [selectedElements, setNodes]
  );

  const handleExport = () => {
    if (reactFlowWrapper.current) {
      const viewport = reactFlowWrapper.current.querySelector('.react-flow__viewport');
      if (!viewport) {
        console.error('Viewport não encontrado para exportar.');
        return;
      }

      toPng(viewport, { backgroundColor: '#f8f9fa' })
        .then((dataUrl) => {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = 'fluxograma.png';
          a.click();
        })
        .catch((err) => console.error('Ocorreu um erro ao exportar a imagem.', err));
    }
  };

  const fileInputRef = useRef(null);
  const onSave = useCallback(() => {
    const flow = reactFlowInstance ? reactFlowInstance.toObject() : { nodes, edges };
    const blob = new Blob([JSON.stringify(flow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fluxograma.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [reactFlowInstance, nodes, edges]);

  const onLoad = () => fileInputRef.current && fileInputRef.current.click();

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const flow = JSON.parse(e.target.result);
          if (flow) {
            const normalizedNodes = (flow.nodes || []).map((n) => {
              const dataStyle = (n.data && n.data.style) ? n.data.style : {};
              const borderWidth = Number(dataStyle.borderWidth) || 0;
              const borderColor = dataStyle.borderColor || '#000';
              const bg = dataStyle.backgroundColor || (n.style && n.style.backgroundColor) || '#ffffff';
              const color = dataStyle.color || (n.style && n.style.color) || '#000000';
              return {
                ...n,
                data: { ...n.data, style: dataStyle },
                style: {
                  ...n.style,
                  backgroundColor: bg,
                  border: `${borderWidth}px solid ${borderColor}`,
                  color,
                },
              };
            });

            setNodes(normalizedNodes);
            setEdges(flow.edges || []);
            if (reactFlowInstance && flow.viewport && reactFlowInstance.setViewport) {
              const { x = 0, y = 0, zoom = 1 } = flow.viewport || {};
              reactFlowInstance.setViewport({ x, y, zoom });
            }
          }
        } catch (error) {
          console.error('Erro ao carregar o arquivo JSON:', error);
          alert('Não foi possível carregar o arquivo. Verifique se é um JSON válido.');
        }
      };
      reader.readAsText(file);
      event.target.value = null;
    } else {
      alert('Por favor selecione um arquivo JSON.');
    }
  };
  
  const handleConfirmClear = () => {
    setNodes([]);
    setEdges([]);
    setClearModalOpen(false);
  };

  const onClear = () => {
    setClearModalOpen(true);
  };

  return (
    <div className="page-container fluxograma-page-container">
      <main className="content-area">
        <div className="fluxograma-editor-wrapper">
          <CreationSidebar
            isExpanded={isCreationSidebarExpanded}
            onToggle={() => setCreationSidebarExpanded((v) => !v)}
            onSave={onSave}
            onLoad={onLoad}
            onClear={onClear}
            onExport={handleExport}
            edgeType={edgeType}
            onEdgeTypeChange={setEdgeType}
          />

          <div className="reactflow-wrapper" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onSelectionChange={onSelectionChange}
              nodeTypes={nodeTypes}
              fitView
              deleteKeyCode={null}
            >
              <Controls />
              <MiniMap />
              <Background variant="dots" gap={12} size={1} />
            </ReactFlow>
          </div>

          <FormattingSidebar
            isExpanded={isFormattingSidebarExpanded}
            onToggle={() => setFormattingSidebarExpanded((v) => !v)}
            selectedNodes={selectedElements.filter((el) => el.position)}
            onStyleChange={updateNodeStyleProperties}
          />

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept="application/json"
          />
        </div>
      </main>

      <ModalConfirmacao
        isOpen={isClearModalOpen}
        onClose={() => setClearModalOpen(false)}
        onConfirm={handleConfirmClear}
        title="Limpar Fluxograma"
      >
        <p>Você tem certeza que deseja apagar todo o fluxograma? Esta ação não pode ser desfeita.</p>
      </ModalConfirmacao>
    </div>
  );
};

const FlowWithProvider = () => (
  <ReactFlowProvider>
    <PaginaFluxograma />
  </ReactFlowProvider>
);

export default FlowWithProvider;

