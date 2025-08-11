import React, { useState, useMemo } from 'react';
import Modal from '../../components/Modal.jsx';
import Select from 'react-select';
import ModalAlerta from '../../components/ModalAlerta.jsx'; // Importar ModalAlerta

const prioridadeOptions = [ { value: 'Alta', label: 'Alta' }, { value: 'Média', label: 'Média' }, { value: 'Baixa', label: 'Baixa' }];
const prioridadeMap = { 'Alta': 3, 'Média': 2, 'Baixa': 1 };

const TabelaLinha = ({ item, tipo, usuarios = [], onDateChange, onFieldChange, comecoCalculado, prazoCalculado }) => {
    const optionsUsuarios = usuarios.map(u => ({ value: u.id, label: u.nome }));
    const compactSelectStyles = {
        control: (provided) => ({ ...provided, minHeight: '35px', height: '35px' }),
        indicatorsContainer: (provided) => ({ ...provided, height: '35px' }),
    };

    return (
        <tr>
            <td><input type="text" value={item.acao} onChange={(e) => onFieldChange(item.id, 'acao', e.target.value)} placeholder={tipo === 'objetivo' ? 'Descreva o objetivo...' : 'Descreva a tarefa...'} className={`input-acao ${tipo}`} /></td>
            <td>{tipo === 'tarefa' && <Select options={optionsUsuarios} styles={compactSelectStyles} onChange={(opt) => onFieldChange(item.id, 'responsavel_id', opt ? opt.value : null)} placeholder="Selecione..." />}</td>
            <td>{tipo === 'tarefa' && <Select options={prioridadeOptions} styles={compactSelectStyles} onChange={(opt) => onFieldChange(item.id, 'prioridade', opt ? opt.value : null)} placeholder="Selecione..." />}</td>
            <td><input type="date" value={tipo === 'objetivo' ? comecoCalculado : item.comeco} onChange={(e) => onDateChange(item.id, 'comeco', e.target.value)} disabled={tipo === 'objetivo'} /></td>
            <td><input type="date" value={tipo === 'objetivo' ? prazoCalculado : item.prazo} onChange={(e) => onDateChange(item.id, 'prazo', e.target.value)} disabled={tipo === 'objetivo'} /></td>
            <td><input type="text" value={item.comentarios || ''} onChange={(e) => onFieldChange(item.id, 'comentarios', e.target.value)} placeholder="Adicionar..." /></td>
        </tr>
    );
};

function ModalNovoPlanoDeAcao({ isOpen, onClose, usuarios = [], onSaveSuccess }) {
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState(''); 
    const [objetivos, setObjetivos] = useState([{ id: Date.now(), acao: '', tarefas: [{ id: Date.now() + 1, acao: '', comeco: '', prazo: '', responsavel_id: null, prioridade: null }] }]);
    const [alerta, setAlerta] = useState({ aberto: false, mensagem: '' }); // Estado para o alerta

    const handleFieldChange = (objId, tarefaId, field, value) => {
        setObjetivos(objetivos.map(obj => {
            if (obj.id === objId) {
                if (!tarefaId) return { ...obj, [field]: value };
                const novasTarefas = obj.tarefas.map(t => t.id === tarefaId ? { ...t, [field]: value } : t);
                return { ...obj, tarefas: novasTarefas };
            }
            return obj;
        }));
    };

    const datasCalculadas = useMemo(() => {
        const datas = {};
        objetivos.forEach(obj => {
            const datasComeco = obj.tarefas.map(t => t.comeco).filter(Boolean).map(d => new Date(d));
            const datasPrazo = obj.tarefas.map(t => t.prazo).filter(Boolean).map(d => new Date(d));
            const minDate = datasComeco.length ? new Date(Math.min(...datasComeco)) : null;
            const maxDate = datasPrazo.length ? new Date(Math.max(...datasPrazo)) : null;
            datas[obj.id] = {
                comeco: minDate ? minDate.toISOString().split('T')[0] : '',
                prazo: maxDate ? maxDate.toISOString().split('T')[0] : ''
            };
        });
        return datas;
    }, [objetivos]);

    const { responsaveisCalculados, prioridadeCalculada, prazoFinalPlano } = useMemo(() => {
        const todosResponsaveisIds = new Set();
        let maiorPrioridadeNum = 0;
        let maiorPrioridadeLabel = 'Baixa';
        const todosOsPrazos = [];

        objetivos.forEach(obj => {
            obj.tarefas.forEach(tarefa => {
                if (tarefa.responsavel_id) {
                    todosResponsaveisIds.add(tarefa.responsavel_id);
                }
                if (tarefa.prioridade && prioridadeMap[tarefa.prioridade] > maiorPrioridadeNum) {
                    maiorPrioridadeNum = prioridadeMap[tarefa.prioridade];
                    maiorPrioridadeLabel = tarefa.prioridade;
                }
            });
            const prazoObjetivo = datasCalculadas[obj.id]?.prazo;
            if (prazoObjetivo) {
                todosOsPrazos.push(new Date(prazoObjetivo));
            }
        });

        const responsaveisIds = Array.from(todosResponsaveisIds);
        const maxDate = todosOsPrazos.length ? new Date(Math.max(...todosOsPrazos)) : null;
        
        return {
            responsaveisCalculados: responsaveisIds,
            prioridadeCalculada: maiorPrioridadeNum > 0 ? maiorPrioridadeLabel : null,
            prazoFinalPlano: maxDate ? maxDate.toISOString().split('T')[0] : ''
        };
    }, [objetivos, usuarios, datasCalculadas]);

    const handleAddObjetivo = () => setObjetivos([...objetivos, { id: Date.now(), acao: '', tarefas: [{ id: Date.now() + 1, acao: '', comeco: '', prazo: '', responsavel_id: null, prioridade: null }] }]);
    const handleAddTarefa = (objetivoId) => setObjetivos(objetivos.map(obj => obj.id === objetivoId ? { ...obj, tarefas: [...obj.tarefas, { id: Date.now(), acao: '', comeco: '', prazo: '', responsavel_id: null, prioridade: null }] } : obj));
    
    const handleSave = async () => {
        // ATUALIZAÇÃO: Validação para garantir que há pelo menos um objetivo e uma tarefa com nome.
        const isInvalid = objetivos.some(obj => !obj.acao.trim() || obj.tarefas.length === 0 || obj.tarefas.some(t => !t.acao.trim()));
        if (isInvalid) {
            setAlerta({ aberto: true, mensagem: 'Todo objetivo e tarefa devem ter um nome preenchido.' });
            return;
        }

        const payload = {
            titulo,
            descricao,
            prioridade: prioridadeCalculada,
            prazoFinal: prazoFinalPlano,
            responsaveis: responsaveisCalculados,
            objetivos
        };
        try {
            const response = await fetch('http://127.0.0.1:5000/api/planos-acao', {
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
            <Modal isOpen={isOpen} onClose={onClose} title="Criar Novo Plano de Ação" size="xl">
                <div className="plano-acao-container">
                    <div className="plano-acao-header">
                        <div className="filter-group"> 
                            <label>Título do Plano de Ação:*</label>
                            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                        </div>
                    </div>
                    <div className="plano-acao-table-wrapper">
                        <table className="plano-acao-table">
                            <thead><tr><th>Ação</th><th>Responsável</th><th>Prioridade</th><th>Começo</th><th>Prazo</th><th>Comentários</th></tr></thead>
                            <tbody>
                                {objetivos.map(obj => (
                                    <React.Fragment key={obj.id}>
                                        <TabelaLinha item={obj} tipo="objetivo" onFieldChange={(objId, field, value) => handleFieldChange(objId, null, field, value)} comecoCalculado={datasCalculadas[obj.id]?.comeco} prazoCalculado={datasCalculadas[obj.id]?.prazo} />
                                        {obj.tarefas.map(tarefa => (
                                            <TabelaLinha key={tarefa.id} item={tarefa} tipo="tarefa" usuarios={usuarios} onDateChange={(tarefaId, field, value) => handleFieldChange(obj.id, tarefaId, field, value)} onFieldChange={(tarefaId, field, value) => handleFieldChange(obj.id, tarefaId, field, value)} />
                                        ))}
                                        <tr><td colSpan="6" className="add-tarefa-cell"><button onClick={() => handleAddTarefa(obj.id)} className="add-item-btn">+ Adicionar Tarefa</button></td></tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={handleAddObjetivo} className="add-objetivo-btn">+ Adicionar Objetivo</button>
                </div>
                <div className="modal-footer">
                    <span></span>
                    <div>
                        <button type="button" className="modal-button cancel" onClick={onClose}>Cancelar</button>
                        <button type="button" className="modal-button confirm" onClick={handleSave}>Salvar Plano de Ação</button>
                    </div>
                </div>
            </Modal>
            <ModalAlerta isOpen={alerta.aberto} onClose={() => setAlerta({ aberto: false, mensagem: '' })} title="Atenção">
                <p>{alerta.mensagem}</p>
            </ModalAlerta>
        </>
    );
}

export default ModalNovoPlanoDeAcao;
