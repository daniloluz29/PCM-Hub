import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import Modal from '../../components/Modal.jsx';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';
import ModalAlerta from '../../components/ModalAlerta.jsx';

// --- Componente Principal ---
const GerenciamentoFaixas = ({ currentUser }) => {
    // Estados de dados e UI
    const [grupos, setGrupos] = useState([]);
    const [faixasPorGrupo, setFaixasPorGrupo] = useState({});
    const [grupoSelecionado, setGrupoSelecionado] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Estados para os modais
    const [modalFaixaAberto, setModalFaixaAberto] = useState(false);
    const [modalGrupoAberto, setModalGrupoAberto] = useState(false);
    const [faixaEmEdicao, setFaixaEmEdicao] = useState(null);
    const [grupoEmEdicao, setGrupoEmEdicao] = useState(null);
    const [faixaParaExcluir, setFaixaParaExcluir] = useState(null);
    const [formState, setFormState] = useState({});
    const [formErrors, setFormErrors] = useState({});
    const [alerta, setAlerta] = useState({ aberto: false, mensagem: '' });

    // Função para buscar todos os dados iniciais
    const fetchData = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('http://127.0.0.1:5000/api/faixas_grupos');
            if (!response.ok) throw new Error('Falha ao buscar grupos de faixas');
            const gruposData = await response.json();
            setGrupos(gruposData);

            if (gruposData.length > 0) {
                setGrupoSelecionado(gruposData[0].nome_grupo);
                
                const faixasPromises = gruposData.map(g => 
                    fetch(`http://127.0.0.1:5000/api/faixas/${g.id}`).then(res => res.json())
                );
                const faixasResults = await Promise.all(faixasPromises);
                
                const faixasAgrupadas = gruposData.reduce((acc, grupo, index) => {
                    acc[grupo.id] = faixasResults[index];
                    return acc;
                }, {});
                setFaixasPorGrupo(faixasAgrupadas);
            }
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleAdicionarFaixa = (grupo) => {
        setFaixaEmEdicao(null);
        setFormState({ grupo_id: grupo.id, status: '' });
        setFormErrors({});
        setModalFaixaAberto(true);
    };

    const handleEditarFaixa = (faixa) => {
        setFaixaEmEdicao(faixa);
        setFormState({ ...faixa });
        setFormErrors({});
        setModalFaixaAberto(true);
    };

    const handleEditarGrupo = (grupo) => {
        setGrupoEmEdicao(grupo);
        setFormState({ nome_exibicao: grupo.nome_exibicao });
        setFormErrors({});
        setModalGrupoAberto(true);
    };

    const handleExcluirFaixa = (faixa) => { setFaixaParaExcluir(faixa); };
    
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const validateForm = () => {
        const errors = {};
        if (!formState.nome_faixa) errors.nome_faixa = true;
        if (formState.valor_inicio === '' || formState.valor_inicio === null) errors.valor_inicio = true;
        if (formState.valor_fim === '' || formState.valor_fim === null) errors.valor_fim = true;
        if (!formState.status) errors.status = true;
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveFaixa = async () => {
        if (!validateForm()) return;
        
        const payload = {
            ...formState,
            autor_id: currentUser.id
        };

        const url = faixaEmEdicao ? `http://127.0.0.1:5000/api/faixas_definicoes/${faixaEmEdicao.id}` : 'http://127.0.0.1:5000/api/faixas_definicoes';
        const method = faixaEmEdicao ? 'PUT' : 'POST';
        try {
            const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlerta({ aberto: true, mensagem: result.message });
            fetchData();
        } catch (err) {
            setAlerta({ aberto: true, mensagem: `Erro: ${err.message}` });
        }
        setModalFaixaAberto(false);
    };

    const handleSaveGrupo = async () => {
        if (!grupoEmEdicao || !formState.nome_exibicao) {
            setFormErrors({ nome_exibicao: true });
            return;
        }
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/faixas_grupos/${grupoEmEdicao.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome_exibicao: formState.nome_exibicao }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlerta({ aberto: true, mensagem: result.message });
            fetchData();
        } catch (err) {
            setAlerta({ aberto: true, mensagem: `Erro: ${err.message}` });
        }
        setModalGrupoAberto(false);
    };

    const handleDeleteFaixaConfirm = async () => {
        if (!faixaParaExcluir) return;
        try {
            const url = `http://127.0.0.1:5000/api/faixas_definicoes/${faixaParaExcluir.id}?autor_id=${currentUser.id}`;
            const response = await fetch(url, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlerta({ aberto: true, mensagem: result.message });
            fetchData();
        } catch (err) {
            setAlerta({ aberto: true, mensagem: `Erro: ${err.message}` });
        }
        setFaixaParaExcluir(null);
    };

    const optionsGrupo = [...new Set(grupos.map(g => g.nome_grupo))].map(nome => ({ value: nome, label: nome }));

    return (
        <div className="card">
            <div className="user-edit-header">
                <div className="filter-group" style={{flexGrow: '0.05'}}>
                    <label htmlFor="group-select">Selecione um Grupo de Faixas:</label>
                    <Select id="group-select" options={optionsGrupo} value={optionsGrupo.find(opt => opt.value === grupoSelecionado)} onChange={(option) => setGrupoSelecionado(option.value)} isLoading={isLoading} placeholder="Selecione..." />
                </div>
            </div>
            <div className="faixas-card-container">
                {isLoading ? <p>Carregando...</p> : error ? <p style={{color: 'red'}}>{error}</p> : 
                grupos.filter(g => g.nome_grupo === grupoSelecionado).map(grupo => (
                    <div key={grupo.id} className="faixa-card">
                        <div className="faixa-card-header">
                            <div className="faixa-title-group">
                                <h3>
                                {grupo.nome_exibicao}
                                <span style={{ fontSize: '0.58em', color: '#888', marginLeft: '8px' }}>
                                    (ID: {grupo.id})
                                </span>
                                </h3>
                                <button onClick={() => handleEditarGrupo(grupo)} className="faixa-title-edit-btn" title="Editar Título do Grupo"><i className="bi bi-pencil-square"></i></button>
                            </div>
                            <div><button onClick={() => handleAdicionarFaixa(grupo)} className="faixa-action-btn" title="Adicionar Faixa"><i className="bi bi-plus-lg"></i></button></div>
                        </div>
                        <div className="faixa-table">
                            <div className="faixa-table-header">
                                <span>Nome da Faixa</span><span>Início</span><span>Fim</span><span>Status</span><span>Ações</span>
                            </div>
                            <ul className="faixa-table-body">
                                {(faixasPorGrupo[grupo.id] || []).map(faixa => (
                                    <li key={faixa.id}>
                                        <span>{faixa.nome_faixa}</span>
                                        <span>{faixa.valor_inicio}</span>
                                        <span>{faixa.valor_fim}</span>
                                        <span>{faixa.status}</span>
                                        <div className="faixa-table-actions">
                                            <button onClick={() => handleEditarFaixa(faixa)} title="Editar"><i className="bi bi-pencil"></i></button>
                                            <button onClick={() => handleExcluirFaixa(faixa)} title="Excluir"><i className="bi bi-trash"></i></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>
            <Modal isOpen={modalFaixaAberto} onClose={() => setModalFaixaAberto(false)} title={faixaEmEdicao ? "Editar Faixa" : "Adicionar Nova Faixa"}>
                <form onSubmit={(e) => { e.preventDefault(); handleSaveFaixa(); }}>
                    <div className="filter-group"><label>Nome da Faixa:</label><input name="nome_faixa" value={formState.nome_faixa || ''} onChange={handleFormChange} className={formErrors.nome_faixa ? 'input-error' : ''} /></div>
                    <div className="user-form-grid">
                        <div className="filter-group"><label>Valor Início:</label><input type="number" name="valor_inicio" value={formState.valor_inicio || ''} onChange={handleFormChange} className={formErrors.valor_inicio ? 'input-error' : ''} /></div>
                        <div className="filter-group"><label>Valor Fim:</label><input type="number" name="valor_fim" value={formState.valor_fim || ''} onChange={handleFormChange} className={formErrors.valor_fim ? 'input-error' : ''} /></div>
                    </div>
                    <div className="filter-group">
                        <label>Status:</label>
                        <input type="text" name="status" value={formState.status || ''} onChange={handleFormChange} className={formErrors.status ? 'input-error' : ''} />
                    </div>
                    <div className="modal-footer"> <div> </div>
                        <div><button type="button" className="modal-button cancel" onClick={() => setModalFaixaAberto(false)}>Cancelar</button><button type="submit" className="modal-button confirm" style={{backgroundColor: '#27ae60'}}>Salvar</button></div>
                    </div>
                    <div>
                        {Object.keys(formErrors).length > 0 && 
                            <p className="error-message">
                                <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: '6px' }}></i>
                                Todos os itens precisam ser preenchidos
                            </p>}
                    </div>
                </form>
            </Modal>
            <Modal isOpen={modalGrupoAberto} onClose={() => setModalGrupoAberto(false)} title="Editar Nome de Exibição do Grupo">
                <form onSubmit={(e) => { e.preventDefault(); handleSaveGrupo(); }}>
                    <div className="filter-group"><label>Nome de Exibição:</label><input name="nome_exibicao" value={formState.nome_exibicao || ''} onChange={handleFormChange} className={formErrors.nome_exibicao ? 'input-error' : ''} /></div>
                    <div className="modal-footer">
                         <div>{formErrors.nome_exibicao && <p className="error-message">O nome não pode ser vazio.</p>}</div>
                        <div><button type="button" className="modal-button cancel" onClick={() => setModalGrupoAberto(false)}>Cancelar</button><button type="submit" className="modal-button confirm" style={{backgroundColor: '#27ae60'}}>Salvar</button></div>
                    </div>
                </form>
            </Modal>
            <ModalConfirmacao isOpen={!!faixaParaExcluir} onClose={() => setFaixaParaExcluir(null)} onConfirm={handleDeleteFaixaConfirm} title="Confirmar Exclusão">
                <p>Você tem certeza que deseja excluir a faixa: <strong>{faixaParaExcluir?.nome_faixa}</strong></p>
            </ModalConfirmacao>
            <ModalAlerta isOpen={alerta.aberto} onClose={() => setAlerta({ aberto: false, mensagem: '' })} title="Operação Concluída"><p>{alerta.mensagem}</p></ModalAlerta>
        </div>
    );
};

export default GerenciamentoFaixas;
