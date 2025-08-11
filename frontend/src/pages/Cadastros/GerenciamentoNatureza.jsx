import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal.jsx';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';
import ModalAlerta from '../../components/ModalAlerta.jsx';

// --- Componente Principal ---
const GerenciamentoNaturezaFinanceira = ({ currentUser }) => {
    // Estados de dados e UI
    const [naturezas, setNaturezas] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pendentesCount, setPendentesCount] = useState(3); // Simulação

    // Estados dos modais
    const [modalAberto, setModalAberto] = useState(false);
    const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
    const [alertaAberto, setAlertaAberto] = useState(false);
    const [alertaMensagem, setAlertaMensagem] = useState('');
    
    // Estados do formulário e de seleção
    const [naturezaEmEdicao, setNaturezaEmEdicao] = useState(null);
    const [naturezaParaExcluir, setNaturezaParaExcluir] = useState(null);
    const [formState, setFormState] = useState({});
    const [formErrors, setFormErrors] = useState({});
    
    const [impostoDisplay, setImpostoDisplay] = useState('');

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('http://127.0.0.1:5000/api/natureza_financeira');
            if (!response.ok) throw new Error('Falha ao buscar Naturezas Financeiras');
            const data = await response.json();
            setNaturezas(data);
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

    const handleAdicionar = () => {
        setNaturezaEmEdicao(null);
        setFormState({
            id_gerencial: '', desc_gerencial: '', id_contabil: '',
            desc_contabil: '', imposto: ''
        });
        setImpostoDisplay('');
        setFormErrors({});
        setModalAberto(true);
    };

    const handleEditar = (natureza) => {
        setNaturezaEmEdicao(natureza);
        setFormState({ ...natureza });
        setImpostoDisplay(natureza.imposto ? (natureza.imposto * 100).toString() : '');
        setFormErrors({});
        setModalAberto(true);
    };

    const handleExcluir = (natureza) => {
        setNaturezaParaExcluir(natureza);
        setModalExcluirAberto(true);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleImpostoChange = (e) => {
        const displayValue = e.target.value;
        setImpostoDisplay(displayValue);
        const decimalValue = parseFloat(displayValue) / 100;
        setFormState(prev => ({
            ...prev,
            imposto: isNaN(decimalValue) ? null : decimalValue
        }));
    };

    const validateForm = () => {
        const errors = {};
        if (!formState.id_gerencial) errors.id_gerencial = true;
        if (!formState.desc_gerencial) errors.desc_gerencial = true;
        if (!formState.id_contabil) errors.id_contabil = true;
        if (!formState.desc_contabil) errors.desc_contabil = true;
        if (formState.imposto === null || formState.imposto === '') errors.imposto = true;
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        const payload = {
            ...formState,
            autor_id: currentUser.id // Adiciona o ID do autor
        };

        const url = naturezaEmEdicao 
            ? `http://127.0.0.1:5000/api/natureza_financeira/${naturezaEmEdicao.id_gerencial}` 
            : 'http://127.0.0.1:5000/api/natureza_financeira';
        const method = naturezaEmEdicao ? 'PUT' : 'POST';

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
            const url = `http://127.0.0.1:5000/api/natureza_financeira/${naturezaParaExcluir.id_gerencial}?autor_id=${currentUser.id}`;
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

    if (isLoading) return <p>Carregando Naturezas Financeiras...</p>;
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
                    <i className="bi bi-plus-circle-fill"></i> Nova Natureza
                </button>
            </div>

            <div className="list-container">
                <div className="list-header-financeira">
                    <span>ID Gerencial</span>
                    <span>Descrição Gerencial</span>
                    <span>ID Contábil</span>
                    <span>Descrição Contábil</span>
                    <span>Imposto</span>
                    <span>Ações</span>
                </div>
                <ul className="list-body-financeira">
                    {naturezas.map(item => (
                        <li key={item.id_gerencial} className="list-item-financeira">
                            <span>{item.id_gerencial}</span>
                            <span>{item.desc_gerencial}</span>
                            <span>{item.id_contabil}</span>
                            <span>{item.desc_contabil}</span>
                            <span>{`${(item.imposto * 100).toFixed(2)} %`}</span>
                            <div className="list-item-actions">
                                <button onClick={() => handleEditar(item)} title="Editar"><i className="bi bi-pencil"></i></button>
                                <button onClick={() => handleExcluir(item)} title="Excluir"><i className="bi bi-trash"></i></button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <Modal isOpen={modalAberto} onClose={() => setModalAberto(false)} title={naturezaEmEdicao ? "Editar Natureza Financeira" : "Nova Natureza Financeira"}>
                <form onSubmit={(e) => e.preventDefault()}>
                    <div className="user-form-grid">
                        <div className="filter-group"><label>ID Gerencial:</label><input name="id_gerencial" value={formState.id_gerencial || ''} onChange={handleFormChange} className={formErrors.id_gerencial ? 'input-error' : ''} disabled={!!naturezaEmEdicao} /></div>
                        <div className="filter-group"><label>Descrição Gerencial:</label><input name="desc_gerencial" value={formState.desc_gerencial || ''} onChange={handleFormChange} className={formErrors.desc_gerencial ? 'input-error' : ''} /></div>
                        <div className="filter-group"><label>ID Contábil:</label><input name="id_contabil" value={formState.id_contabil || ''} onChange={handleFormChange} className={formErrors.id_contabil ? 'input-error' : ''} /></div>
                        <div className="filter-group"><label>Descrição Contábil:</label><input name="desc_contabil" value={formState.desc_contabil || ''} onChange={handleFormChange} className={formErrors.desc_contabil ? 'input-error' : ''} /></div>
                        <div className="filter-group full-width">
                            <label>Imposto (%):</label>
                            <input 
                                type="number" 
                                step="0.01" 
                                name="imposto" 
                                value={impostoDisplay} 
                                onChange={handleImpostoChange} 
                                className={formErrors.imposto ? 'input-error' : ''} 
                                placeholder="Ex: 9.25"
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <div>
                            {Object.keys(formErrors).length > 0 && <p className="error-message">Todos os campos são obrigatórios.</p>}
                        </div>
                        <div>
                            <button type="button" className="modal-button cancel" onClick={() => setModalAberto(false)}>Cancelar</button>
                            <button type="button" className="modal-button confirm" style={{backgroundColor: '#27ae60'}} onClick={handleSave}>Salvar</button>
                        </div>
                    </div>
                </form>
            </Modal>

            <ModalConfirmacao isOpen={modalExcluirAberto} onClose={() => setModalExcluirAberto(false)} onConfirm={handleDeleteConfirm} title="Confirmar Exclusão">
                <p>Você tem certeza que deseja excluir a Natureza Financeira:</p>
                <p><strong>{naturezaParaExcluir?.id_gerencial} - {naturezaParaExcluir?.desc_gerencial}</strong></p>
            </ModalConfirmacao>

            <ModalAlerta isOpen={alertaAberto} onClose={() => setAlertaAberto(false)} title="Operação Concluída">
                <p>{alertaMensagem}</p>
            </ModalAlerta>
        </div>
    );
};

export default GerenciamentoNaturezaFinanceira;
