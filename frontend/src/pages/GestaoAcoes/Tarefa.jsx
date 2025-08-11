import React, { useState } from 'react';
import Modal from '../../components/Modal.jsx';
import Select from 'react-select';
import ModalAlerta from '../../components/ModalAlerta.jsx';

const prioridadeOptions = [ { value: 'Crítica', label: 'Crítica' }, { value: 'Alta', label: 'Alta' }, { value: 'Média', label: 'Média' }, { value: 'Baixa', label: 'Baixa' }];
const customSelectStyles = { valueContainer: (provided) => ({ ...provided, maxHeight: '75px', overflowY: 'auto', flexWrap: 'wrap' }) };

function ModalNovaTarefa({ isOpen, onClose, usuarios, onSaveSuccess }) {
    const [titulo, setTitulo] = useState('');
    const [responsaveis, setResponsaveis] = useState([]);
    const [dataEntrega, setDataEntrega] = useState('');
    const [prioridade, setPrioridade] = useState(null);
    const [descricao, setDescricao] = useState('');
    const [checklistTitle, setChecklistTitle] = useState('Sub-Tarefas');
    const [isTitleEditing, setIsTitleEditing] = useState(false);
    const [checklist, setChecklist] = useState([{ id: 1, texto: '' }]);
    const [alerta, setAlerta] = useState({ aberto: false, mensagem: '' });
    const optionsUsuarios = usuarios.map(u => ({ value: u.id, label: u.nome }));

    const handleChecklistChange = (id, texto) => setChecklist(checklist.map(item => item.id === id ? { ...item, texto } : item));
    const handleAddItem = () => setChecklist([...checklist, { id: Date.now(), texto: '' }]);
    const handleRemoverItem = (id) => checklist.length > 1 && setChecklist(checklist.filter(item => item.id !== id));
    
    const handleSave = async () => {
        // Validação para garantir que a tarefa tenha um título
        if (!titulo.trim()) {
            setAlerta({ aberto: true, mensagem: 'O título da tarefa é obrigatório.' });
            return;
        }

        const payload = {
            titulo,
            descricao,
            prioridade: prioridade ? prioridade.value : null,
            data_entrega: dataEntrega,
            responsaveis: responsaveis.map(r => r.value),
            checklistTitle,
            checklist: checklist.filter(item => item.texto.trim() !== '') // Envia apenas itens preenchidos
        };
        try {
            const response = await fetch('http://127.0.0.1:5000/api/tarefas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            onSaveSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            setAlerta({ aberto: true, mensagem: error.message });
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Criar Nova Tarefa" size="large">
                <div className="form-grid-layout" style={{ display: 'flex', gap: '20px' }}>
                    <div style={{ flex: 2 }}>
                        <div className="filter-group"><label>Título da Tarefa:*</label><input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
                        <div className="filter-group"><label>Descrição:</label><textarea rows="4" value={descricao} onChange={(e) => setDescricao(e.target.value)}></textarea></div>
                        <div className="filter-group">
                            <div className="checklist-title-container">
                                {isTitleEditing ? (<input type="text" value={checklistTitle} onChange={(e) => setChecklistTitle(e.target.value)} onBlur={() => setIsTitleEditing(false)} onKeyDown={(e) => e.key === 'Enter' && setIsTitleEditing(false)} className="checklist-title-input" autoFocus />) : (<h4 onClick={() => setIsTitleEditing(true)}>{checklistTitle}<i className="bi bi-pencil-fill edit-icon"></i></h4>)}
                            </div>
                            <div className="checklist-container">
                                <div className="checklist-items-wrapper">
                                    {checklist.map(item => (
                                        <div key={item.id} className="checklist-item">
                                            <input type="text" value={item.texto} onChange={(e) => handleChecklistChange(item.id, e.target.value)} placeholder="Adicionar item..." />
                                            <button onClick={() => handleRemoverItem(item.id)} className="remove-item-btn" disabled={checklist.length <= 1 && item.texto.trim() === ''}>&times;</button>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={handleAddItem} className="add-item-btn">+ Adicionar item</button>
                            </div>
                        </div>
                    </div>
                    <div style={{ flex: 1 }}>
                        <div className="filter-group"><label>Responsáveis:*</label><Select isMulti options={optionsUsuarios} onChange={setResponsaveis} styles={customSelectStyles} /></div>
                        <div className="filter-group"><label>Data de Entrega:*</label><input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} /></div>
                        <div className="filter-group"><label>Prioridade:*</label><Select options={prioridadeOptions} onChange={setPrioridade} /></div>
                    </div>
                </div>
                <div className="modal-footer">
                    <span></span>
                    <div>
                        <button type="button" className="modal-button cancel" onClick={onClose}>Cancelar</button>
                        <button type="button" className="modal-button confirm" onClick={handleSave}>Salvar Tarefa</button>
                    </div>
                </div>
            </Modal>
            <ModalAlerta isOpen={alerta.aberto} onClose={() => setAlerta({ aberto: false, mensagem: '' })} title="Atenção">
                <p>{alerta.mensagem}</p>
            </ModalAlerta>
        </>
    );
}

export default ModalNovaTarefa;
