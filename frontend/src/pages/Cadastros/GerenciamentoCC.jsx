import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import Modal from '../../components/Modal.jsx';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';
import ModalAlerta from '../../components/ModalAlerta.jsx';

// --- Listas de Opções para os novos Selects ---
const tiposCC = ['Superintendência', 'Núcleo', 'Contrato'];
const optionsTipo = tiposCC.map(t => ({ value: t, label: t }));

const estadosBrasil = [
    { sigla: 'AC', nome: 'Acre' }, { sigla: 'AL', nome: 'Alagoas' },
    { sigla: 'AP', nome: 'Amapá' }, { sigla: 'AM', nome: 'Amazonas' },
    { sigla: 'BA', nome: 'Bahia' }, { sigla: 'CE', nome: 'Ceará' },
    { sigla: 'DF', nome: 'Distrito Federal' }, { sigla: 'ES', nome: 'Espírito Santo' },
    { sigla: 'GO', nome: 'Goiás' }, { sigla: 'MA', nome: 'Maranhão' },
    { sigla: 'MT', nome: 'Mato Grosso' }, { sigla: 'MS', nome: 'Mato Grosso do Sul' },
    { sigla: 'MG', nome: 'Minas Gerais' }, { sigla: 'PA', nome: 'Pará' },
    { sigla: 'PB', nome: 'Paraíba' }, { sigla: 'PR', nome: 'Paraná' },
    { sigla: 'PE', nome: 'Pernambuco' }, { sigla: 'PI', nome: 'Piauí' },
    { sigla: 'RJ', nome: 'Rio de Janeiro' }, { sigla: 'RN', nome: 'Rio Grande do Norte' },
    { sigla: 'RS', nome: 'Rio Grande do Sul' }, { sigla: 'RO', nome: 'Rondônia' },
    { sigla: 'RR', nome: 'Roraima' }, { sigla: 'SC', nome: 'Santa Catarina' },
    { sigla: 'SP', nome: 'São Paulo' }, { sigla: 'SE', nome: 'Sergipe' },
    { sigla: 'TO', nome: 'Tocantins' }
];
const optionsEstado = estadosBrasil.map(e => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }));


// --- Componente de Nó da Árvore de CCs ---
function TreeNodeCC({ node, onEdit, onDelete, level = 0 }) {
    const [isExpanded, setIsExpanded] = useState(level < 2); 
    const hasChildren = node.children && node.children.length > 0;

    return (
        <li>
            <div className="tree-node-cc">
                <div className="tree-node-cc-label">
                    {hasChildren ? (
                        <button className="tree-toggle-btn" onClick={() => setIsExpanded(!isExpanded)}>
                            {isExpanded ? '−' : '+'}
                        </button>
                    ) : (
                        <span style={{ width: '28px', display: 'inline-block' }}></span> 
                    )}
                    {node.responde_iqd === 1 && <i className="bi bi-star-fill iqd-star"></i>}
                    <span>{node.cod_cc} - {node.nome_cc}</span>
                </div>
                <div className="tree-node-cc-actions">
                    <button onClick={() => onEdit(node)} title="Editar"><i className="bi bi-pencil"></i></button>
                    <button onClick={() => onDelete(node)} title="Excluir"><i className="bi bi-trash"></i></button>
                </div>
            </div>
            {hasChildren && isExpanded && (
                <ul>
                    {node.children.map(childNode => (
                        <TreeNodeCC 
                            key={childNode.id} 
                            node={childNode} 
                            onEdit={onEdit}
                            onDelete={onDelete}
                            level={level + 1}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}


// --- Componente Principal ---
const GerenciamentoCentrosCusto = ({ currentUser }) => {
    // Estados de dados e UI
    const [hierarquia, setHierarquia] = useState(null);
    const [listaPlana, setListaPlana] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pendentesCount, setPendentesCount] = useState(5);

    // Estados dos modais
    const [modalAberto, setModalAberto] = useState(false);
    const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
    const [alertaAberto, setAlertaAberto] = useState(false);
    const [alertaMensagem, setAlertaMensagem] = useState('');
    
    // Estados do formulário e de seleção
    const [ccEmEdicao, setCcEmEdicao] = useState(null);
    const [ccParaExcluir, setCcParaExcluir] = useState(null);
    const [formState, setFormState] = useState({});
    const [formErrors, setFormErrors] = useState({});
    const [optionsPaiFiltrado, setOptionsPaiFiltrado] = useState([]);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [hierarquiaResponse, listaPlanaResponse] = await Promise.all([
                fetch('http://127.0.0.1:5000/api/hierarquia_dados'),
                fetch('http://127.0.0.1:5000/api/centros_custo')
            ]);
            if (!hierarquiaResponse.ok) throw new Error('Falha ao buscar a hierarquia de Centros de Custo');
            if (!listaPlanaResponse.ok) throw new Error('Falha ao buscar a lista de Centros de Custo');
            const hierarquiaData = await hierarquiaResponse.json();
            const listaPlanaData = await listaPlanaResponse.json();
            setHierarquia(hierarquiaData);
            setListaPlana(listaPlanaData);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (!formState.tipo || listaPlana.length === 0) {
            setOptionsPaiFiltrado([]);
            return;
        }

        let paisValidos = [];
        const tipoSelecionado = formState.tipo.toLowerCase().trim();

        // CORREÇÃO: Normaliza a comparação dos tipos para ser mais flexível
        // com os dados do banco (ex: "Superintendencia" vs "Superintendência").
        if (tipoSelecionado === 'contrato') {
            paisValidos = listaPlana.filter(cc => cc.tipo.toLowerCase().trim().includes('núcleo') || cc.tipo.toLowerCase().trim().includes('nucleo'));
        } else if (tipoSelecionado.includes('núcleo') || tipoSelecionado.includes('nucleo')) {
            paisValidos = listaPlana.filter(cc => cc.tipo.toLowerCase().trim().includes('superintendencia'));
        }
        
        setOptionsPaiFiltrado(
            paisValidos.map(cc => ({ value: cc.cod_cc, label: `${cc.cod_cc} - ${cc.nome_cc}` }))
        );

    }, [formState.tipo, listaPlana]);


    const handleAdicionar = () => {
        setCcEmEdicao(null);
        setFormState({
            cod_cc: '', nome_cc: '', tipo: '', pai_id: null, estado: '',
            gestor: '', controlador: '', responde_iqd: 0
        });
        setFormErrors({});
        setModalAberto(true);
    };

    const handleEditar = (ccNode) => {
        const ccCompleto = listaPlana.find(item => item.id === ccNode.id);
        if (ccCompleto) {
            setCcEmEdicao(ccCompleto);
            setFormState({ ...ccCompleto });
            setFormErrors({});
            setModalAberto(true);
        } else {
            setError("Não foi possível encontrar os dados completos do Centro de Custo para edição.");
        }
    };

    const handleExcluir = (cc) => {
        setCcParaExcluir(cc);
        setModalExcluirAberto(true);
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormState(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
        }));
    };
    
    const handleSelectChange = (name, option) => {
        const value = option ? option.value : null;
        const newState = { ...formState, [name]: value };
        if (name === 'tipo') {
            newState.pai_id = null;
            if (value === 'Superintendência' || value === 'Núcleo') {
                newState.estado = null;
                newState.responde_iqd = 0;
            }
        }
        setFormState(newState);
    };

    const validateForm = () => {
        const errors = {};
        if (!formState.cod_cc) errors.cod_cc = true;
        if (!formState.nome_cc) errors.nome_cc = true;
        if (!formState.tipo) errors.tipo = true;
        if (!formState.gestor) errors.gestor = true;

        // CORREÇÃO: A validação do CC Pai agora também é flexível.
        // Ela só exige um pai se o tipo NÃO for Superintendência.
        if (!formState.tipo.toLowerCase().includes('superintendencia') && !formState.pai_id) {
            errors.pai_id = true;
        }

        if (formState.tipo === 'Contrato' && !formState.estado) {
            errors.estado = true;
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        const payload = {
            ...formState,
            autor_id: currentUser.id
        };

        const url = ccEmEdicao 
            ? `http://127.0.0.1:5000/api/centros_custo/${ccEmEdicao.id}` 
            : 'http://127.0.0.1:5000/api/centros_custo';
        const method = ccEmEdicao ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlertaMensagem(result.message);
            fetchData(); 
        } catch (error) {
            setAlertaMensagem(`Erro: ${error.message}`);
        }
        setModalAberto(false);
        setAlertaAberto(true);
    };

    const handleDeleteConfirm = async () => {
        try {
            const url = `http://127.0.0.1:5000/api/centros_custo/${ccParaExcluir.id}?autor_id=${currentUser.id}`;
            const response = await fetch(url, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlertaMensagem(result.message);
            fetchData(); 
        } catch (error) {
            setAlertaMensagem(`Erro: ${error.message}`);
        }
        setModalExcluirAberto(false);
        setAlertaAberto(true);
    };

    if (isLoading) return <p>Carregando Centros de Custo...</p>;
    if (error) return <p style={{ color: 'red' }}>Erro: {error}</p>;

    return (
        <div className="card">
            <div className="admin-actions-bar">
                <button className="admin-button pending-button">
                    <i className="bi bi-clock-history"></i>
                    <span>Pendentes</span>
                    {pendentesCount > 0 && <span className="notification-badge">{pendentesCount}</span>}
                </button>
                <button className="admin-button" onClick={handleAdicionar}>
                    <i className="bi bi-plus-circle-fill"></i> Adicionar Novo CC
                </button>
            </div>

            <div className="tree-view-container-cc">
                {hierarquia && hierarquia.children.length > 0 ? (
                    <ul>
                        {hierarquia.children.map(node => (
                             <TreeNodeCC key={node.id} node={node} onEdit={handleEditar} onDelete={handleExcluir} />
                        ))}
                    </ul>
                ) : <p>Nenhum centro de custo encontrado.</p>}
            </div>

            <Modal isOpen={modalAberto} onClose={() => setModalAberto(false)} title={ccEmEdicao ? 'Editar Centro de Custo' : 'Adicionar Novo Centro de Custo'}>
                <form onSubmit={(e) => e.preventDefault()}>
                    <div className="user-form-grid">
                        <div className="filter-group"><label>Código CC:</label><input name="cod_cc" value={formState.cod_cc || ''} onChange={handleFormChange} className={formErrors.cod_cc ? 'input-error' : ''} /></div>
                        <div className="filter-group"><label>Nome CC:</label><input name="nome_cc" value={formState.nome_cc || ''} onChange={handleFormChange} className={formErrors.nome_cc ? 'input-error' : ''} /></div>
                        <div className="filter-group"><label>Tipo:</label><Select options={optionsTipo} value={optionsTipo.find(opt => opt.value === formState.tipo)} onChange={(opt) => handleSelectChange('tipo', opt)} placeholder="Selecione..." className={formErrors.tipo ? 'select-error' : ''} /></div>
                        <div className="filter-group"><label>Estado:</label><Select options={optionsEstado} value={optionsEstado.find(opt => opt.value === formState.estado)} onChange={(opt) => handleSelectChange('estado', opt)} placeholder="Selecione..." isDisabled={formState.tipo !== 'Contrato'} className={formErrors.estado ? 'select-error' : ''} /></div>
                        <div className="filter-group"><label>Gestor:</label><input name="gestor" value={formState.gestor || ''} onChange={handleFormChange} className={formErrors.gestor ? 'input-error' : ''} /></div>
                        <div className="filter-group"><label>Controlador:</label><input name="controlador" value={formState.controlador || ''} onChange={handleFormChange} /></div>
                        <div className="filter-group full-width"><label>CC Pai:</label><Select options={optionsPaiFiltrado} value={optionsPaiFiltrado.find(opt => opt.value === formState.pai_id)} onChange={(opt) => handleSelectChange('pai_id', opt)} isClearable placeholder="Selecione se houver..." maxMenuHeight={160} isDisabled={formState.tipo === 'Superintendência'} className={formErrors.pai_id ? 'select-error' : ''} /></div>
                    </div>
                    <div className="filter-group" style={{ marginTop: '20px' }}><label className="checkbox-label-group" style={{cursor: 'pointer'}}><input type="checkbox" name="responde_iqd" checked={formState.responde_iqd === 1} onChange={handleFormChange} disabled={formState.tipo === 'Superintendência' || formState.tipo === 'Núcleo'} /><span>Responde IQD?</span></label></div>
                    <div className="modal-footer"> <div></div><div><button type="button" className="modal-button cancel" onClick={() => setModalAberto(false)}>Cancelar</button><button type="button" className="modal-button confirm" style={{backgroundColor: '#27ae60'}} onClick={handleSave}>Salvar</button></div></div>
                    <div>{Object.keys(formErrors).length > 0 && <p className="error-message"><i className="bi bi-exclamation-triangle-fill" style={{ marginRight: '6px' }}></i>Itens obrigatórios não preenchidos</p>}</div>
                </form>
            </Modal>

            <ModalConfirmacao isOpen={modalExcluirAberto} onClose={() => setModalExcluirAberto(false)} onConfirm={handleDeleteConfirm} title="Confirmar Exclusão">
                <p>Você tem certeza que deseja excluir o Centro de Custo:</p>
                <p><strong>{ccParaExcluir?.cod_cc} - {ccParaExcluir?.nome_cc}</strong></p>
                <p>Esta ação não pode ser desfeita.</p>
            </ModalConfirmacao>

            <ModalAlerta isOpen={alertaAberto} onClose={() => setAlertaAberto(false)} title="Operação Concluída">
                <p>{alertaMensagem}</p>
            </ModalAlerta>
        </div>
    );
};

export default GerenciamentoCentrosCusto;
