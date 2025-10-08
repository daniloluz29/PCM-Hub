import React, { useState, useCallback, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';

// Helper para construir o estilo da forma a partir dos dados do nó
const buildShapeStyle = (data = {}) => {
  const style = data.style || {};
  return {
    backgroundColor: style.backgroundColor || '#ffffff',
    borderColor: style.borderColor || '#000000',
    borderWidth: style.borderWidth ? `${style.borderWidth}px` : '2px',
    color: style.color || '#000000',
  };
};

// Componente para edição de texto inline
const InlineEditor = ({ value, onSave, onCancel, isTextarea = false, style }) => {
  const [text, setText] = useState(value);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isTextarea) {
      e.preventDefault();
      onSave(text);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };
  
  const handleBlur = () => {
      onSave(text);
  };

  const commonProps = {
    value: text,
    onChange: (e) => setText(e.target.value),
    onKeyDown: handleKeyDown,
    onBlur: handleBlur,
    autoFocus: true,
    style: {
      width: '100%',
      height: '100%',
      resize: 'none',
      border: 'none',
      padding: '5px',
      margin: 0,
      textAlign: 'center',
      background: 'transparent',
      fontFamily: 'inherit',
      fontSize: 'inherit',
      color: 'inherit',
      boxSizing: 'border-box',
      ...style,
    },
    onClick: (e) => e.stopPropagation(),
  };

  return isTextarea ? <textarea {...commonProps} /> : <input type="text" {...commonProps} />;
};


// Componente base para encapsular a lógica de edição
const EditableNodeWrapper = ({ id, data, onUpdate, children }) => {
    const [isEditing, setIsEditing] = useState(false);

    const handleSave = useCallback((newLabel) => {
        if (onUpdate) {
            onUpdate(id, { ...data, label: newLabel });
        }
        setIsEditing(false);
    }, [id, data, onUpdate]);

    const handleCancel = useCallback(() => {
        setIsEditing(false);
    }, []);
    
    useEffect(() => {
        if (data.label && data.label.match(/^(Início \/ Fim|Processo)$/)) {
            setIsEditing(true);
        }
    }, [data.label]);


    return (
        <div onDoubleClick={() => setIsEditing(true)} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isEditing ? (
                <InlineEditor
                    value={data.label}
                    onSave={handleSave}
                    onCancel={handleCancel}
                />
            ) : (
                children
            )}
        </div>
    );
};


export const StartEndNode = (props) => {
  // CORREÇÃO: Pega width e height das props de nível superior
  const { id, data, selected, onUpdate, isConnectable, width, height } = props;
  const shapeStyle = buildShapeStyle(data);

  return (
    // CORREÇÃO: Aplica width e height ao contêiner principal
    <div className="flow-node" style={{ width, height }}>
      <NodeResizer isVisible={selected} minWidth={100} minHeight={50} />
      <Handle className="custom-handle" type="source" position={Position.Top} id="top-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Top} id="top-t" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="source" position={Position.Right} id="right-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Right} id="right-t" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="source" position={Position.Bottom} id="bottom-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Bottom} id="bottom-t" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="source" position={Position.Left} id="left-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Left} id="left-t" isConnectable={isConnectable} />

      <div className="node-shape start-end-shape" style={shapeStyle}>
        <EditableNodeWrapper id={id} data={data} onUpdate={onUpdate}>
          {data.label}
        </EditableNodeWrapper>
      </div>
    </div>
  );
};

export const ProcessNode = (props) => {
  const { id, data, selected, onUpdate, isConnectable, width, height } = props;
  const shapeStyle = buildShapeStyle(data);

  return (
    <div className="flow-node" style={{ width, height }}>
      <NodeResizer isVisible={selected} minWidth={100} minHeight={50} />
      <Handle className="custom-handle" type="source" position={Position.Top} id="top-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Top} id="top-t" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="source" position={Position.Right} id="right-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Right} id="right-t" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="source" position={Position.Bottom} id="bottom-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Bottom} id="bottom-t" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="source" position={Position.Left} id="left-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Left} id="left-t" isConnectable={isConnectable} />

      <div className="node-shape process-shape" style={shapeStyle}>
         <EditableNodeWrapper id={id} data={data} onUpdate={onUpdate}>
            {data.label}
        </EditableNodeWrapper>
      </div>
    </div>
  );
};

export const DecisionNode = (props) => {
  const { id, data, selected, onUpdate, isConnectable, width, height } = props;
  const shapeStyle = buildShapeStyle(data);

  return (
    <div className="flow-node decision-node" style={{ width, height }}>
      <NodeResizer isVisible={selected} minWidth={100} minHeight={100} keepAspectRatio />
      <Handle className="custom-handle" type="source" position={Position.Top} id="top-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Top} id="top-t" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="source" position={Position.Right} id="right-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Right} id="right-t" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="source" position={Position.Bottom} id="bottom-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Bottom} id="bottom-t" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="source" position={Position.Left} id="left-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Left} id="left-t" isConnectable={isConnectable} />

      <div className="node-shape decision-shape" style={shapeStyle}>
        <div className="decision-content-wrapper">
            <EditableNodeWrapper id={id} data={data} onUpdate={onUpdate}>
                {data.label}
            </EditableNodeWrapper>
        </div>
      </div>
    </div>
  );
};

export const CustomTaskNode = (props) => {
  const { id, data, selected, onUpdate, isConnectable, width, height } = props;
  const [editingPart, setEditingPart] = useState(null);
  const shapeStyle = buildShapeStyle(data);
  
  const headerStyle = {
    backgroundColor: shapeStyle.borderColor,
    color: '#ffffff',
  };

  const updateTextLocal = (part, newText) => {
    if (onUpdate) {
        onUpdate(id, { ...data, [part]: newText });
    }
    setEditingPart(null);
  };
  
  useEffect(() => {
    if (data.title === 'Título da Tarefa') {
      setEditingPart('title');
    }
  }, [data.title]);


  return (
    <div className="flow-node" style={{ width, height }}>
      <NodeResizer isVisible={selected} minWidth={120} minHeight={100} />
      <Handle className="custom-handle" type="source" position={Position.Top} id="top-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Top} id="top-t" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="source" position={Position.Right} id="right-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Right} id="right-t" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="source" position={Position.Bottom} id="bottom-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Bottom} id="bottom-t" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="source" position={Position.Left} id="left-s" isConnectable={isConnectable} />
      <Handle className="custom-handle" type="target" position={Position.Left} id="left-t" isConnectable={isConnectable} />

      <div className="node-shape custom-task-shape" style={shapeStyle}>
        <div className="custom-task-header" style={headerStyle} onDoubleClick={() => setEditingPart('title')}>
          {editingPart === 'title' ? (
            <InlineEditor value={data.title} onSave={(text) => updateTextLocal('title', text)} onCancel={() => setEditingPart(null)} style={{ color: headerStyle.color }}/>
          ) : (
            data.title
          )}
        </div>
        <div className="custom-task-body" onDoubleClick={() => setEditingPart('body')} style={{color: shapeStyle.color}}>
          {editingPart === 'body' ? (
            <InlineEditor value={data.body} onSave={(text) => updateTextLocal('body', text)} onCancel={() => setEditingPart(null)} isTextarea={true} />
          ) : (
            data.body
          )}
        </div>
      </div>
    </div>
  );
};

