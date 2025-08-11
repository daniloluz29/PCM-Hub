import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal.jsx';
import Select from 'react-select';

// (O componente ModalFiltrosGerais permanece o mesmo da correção anterior)
const ModalFiltrosGerais = ({ isOpen, onClose, onApply, initialSelection, opcoes }) => {
    const [selecao, setSelecao] = useState(initialSelection);
    useEffect(() => { setSelecao(initialSelection); }, [initialSelection]);
    const {
        opcoesSuperintendencia, opcoesNucleo, opcoesContrato,
        opcoesEstado, opcoesControlador, opcoesGestor
    } = useMemo(() => {
        const allCcs = opcoes.lista_completa_ccs || [];
        if (allCcs.length === 0) return {
            opcoesSuperintendencia: [], opcoesNucleo: [], opcoesContrato: [],
            opcoesEstado: [], opcoesControlador: [], opcoesGestor: []
        };
        let contratosVisiveis = allCcs.filter(cc => cc.tipo && cc.tipo.toLowerCase() === 'contrato');
        if (selecao.estados?.length > 0) {
            const values = selecao.estados.map(i => i.value);
            contratosVisiveis = contratosVisiveis.filter(c => values.includes(c.estado));
        }
        if (selecao.controladores?.length > 0) {
            const values = selecao.controladores.map(i => i.value);
            contratosVisiveis = contratosVisiveis.filter(c => values.includes(c.controlador));
        }
        if (selecao.gestores?.length > 0) {
            const values = selecao.gestores.map(i => i.value);
            contratosVisiveis = contratosVisiveis.filter(c => values.includes(c.gestor));
        }
        if (selecao.superintendencias?.length > 0) {
            const superValues = selecao.superintendencias.map(s => s.value);
            const nucleosFilhos = allCcs.filter(cc => superValues.includes(cc.pai_id));
            const nucleoIds = nucleosFilhos.map(n => n.cod_cc);
            contratosVisiveis = contratosVisiveis.filter(c => nucleoIds.includes(c.pai_id));
        }
        if (selecao.nucleos?.length > 0) {
            const nucleoValues = selecao.nucleos.map(n => n.value);
            contratosVisiveis = contratosVisiveis.filter(c => nucleoValues.includes(c.pai_id));
        }
        if (selecao.contratos?.length > 0) {
            const contratoValues = selecao.contratos.map(c => c.value);
            contratosVisiveis = contratosVisiveis.filter(c => contratoValues.includes(c.cod_cc));
        }
        const nucleosIds = new Set(contratosVisiveis.map(c => c.pai_id));
        const nucleosDisponiveis = allCcs.filter(cc => nucleosIds.has(cc.cod_cc));
        const superIds = new Set(nucleosDisponiveis.map(n => n.pai_id));
        const supersDisponiveis = allCcs.filter(cc => superIds.has(cc.cod_cc));
        return {
            opcoesSuperintendencia: supersDisponiveis,
            opcoesNucleo: nucleosDisponiveis,
            opcoesContrato: contratosVisiveis,
            opcoesEstado: [...new Set(contratosVisiveis.map(c => c.estado).filter(Boolean))].sort(),
            opcoesControlador: [...new Set(contratosVisiveis.map(c => c.controlador).filter(Boolean))].sort(),
            opcoesGestor: [...new Set(contratosVisiveis.map(c => c.gestor).filter(Boolean))].sort(),
        };
    }, [selecao, opcoes.lista_completa_ccs]);
    const handleApply = () => onApply(selecao);
    const handleClear = () => {
        const cleared = {
            superintendencias: [], nucleos: [], contratos: [], estados: [], controladores: [], gestores: [],
            visao: { value: 'Contrato', label: 'Contrato' },
            exibicao: { value: 'ativos', label: 'Somente Ativos' }
        };
        setSelecao(cleared);
    };
    const handleSelectAll = (field, options) => setSelecao(prev => ({ ...prev, [field]: options }));
    const mapToOptions = (items, valueKey, labelKey) => items.map(item => ({ value: item[valueKey], label: item[labelKey] }));
    const mapSimpleOptions = (items) => items.map(item => ({ value: item, label: item }));
    const customSelectStyles = {
        valueContainer: (provided) => ({
            ...provided,
            maxHeight: '84px',
            overflowY: 'auto',
        }),
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Filtros Gerais" size="large">
            <div className="filtros-gerais-grid">
                <div className="filtro-coluna">
                    <div className="filter-group">
                        <div className="filter-label-group"><label>Superintendência</label><button onClick={() => handleSelectAll('superintendencias', mapToOptions(opcoesSuperintendencia, 'cod_cc', 'nome_cc'))}>Selecionar tudo</button></div>
                        <Select isMulti styles={customSelectStyles} options={mapToOptions(opcoesSuperintendencia, 'cod_cc', 'nome_cc')} value={selecao.superintendencias} onChange={v => setSelecao({...selecao, superintendencias: v})} />
                    </div>
                    <div className="filter-group">
                        <div className="filter-label-group"><label>Núcleo</label><button onClick={() => handleSelectAll('nucleos', mapToOptions(opcoesNucleo, 'cod_cc', 'nome_cc'))}>Selecionar tudo</button></div>
                        <Select isMulti styles={customSelectStyles} options={mapToOptions(opcoesNucleo, 'cod_cc', 'nome_cc')} value={selecao.nucleos} onChange={v => setSelecao({...selecao, nucleos: v})} />
                    </div>
                    <div className="filter-group">
                        <div className="filter-label-group"><label>Centro de Custo</label><button onClick={() => handleSelectAll('contratos', mapToOptions(opcoesContrato, 'cod_cc', 'nome_cc'))}>Selecionar tudo</button></div>
                        <Select isMulti styles={customSelectStyles} options={mapToOptions(opcoesContrato, 'cod_cc', 'nome_cc')} value={selecao.contratos} onChange={v => setSelecao({...selecao, contratos: v})} />
                    </div>
                </div>
                <div className="filtro-coluna">
                    <div className="filter-group">
                        <div className="filter-label-group"><label>Gestor</label><button onClick={() => handleSelectAll('gestores', mapSimpleOptions(opcoesGestor))}>Selecionar tudo</button></div>
                        <Select isMulti styles={customSelectStyles} options={mapSimpleOptions(opcoesGestor)} value={selecao.gestores} onChange={v => setSelecao({...selecao, gestores: v})} />
                    </div>
                    <div className="filter-group">
                        <div className="filter-label-group"><label>Estado</label><button onClick={() => handleSelectAll('estados', mapSimpleOptions(opcoesEstado))}>Selecionar tudo</button></div>
                        <Select isMulti styles={customSelectStyles} options={mapSimpleOptions(opcoesEstado)} value={selecao.estados} onChange={v => setSelecao({...selecao, estados: v})} />
                    </div>
                    <div className="filter-group">
                        <div className="filter-label-group"><label>Controlador</label><button onClick={() => handleSelectAll('controladores', mapSimpleOptions(opcoesControlador))}>Selecionar tudo</button></div>
                        <Select isMulti styles={customSelectStyles} options={mapSimpleOptions(opcoesControlador)} value={selecao.controladores} onChange={v => setSelecao({...selecao, controladores: v})} />
                    </div>
                    <div className="user-form-grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'end' }}>
                        <div className="filter-group">
                            <label>Visão</label>
                            <Select options={[{ value: 'Contrato', label: 'Contrato' }, { value: 'Núcleo', label: 'Núcleo' }, { value: 'Superintendência', label: 'Superintendência' }]} value={selecao.visao} onChange={v => setSelecao({...selecao, visao: v})} />
                        </div>
                         <div className="filter-group">
                            <div className="toggle-switch-container">
                                <label className="toggle-label">Exibição</label>
                                <div className="toggle-options">
                                    <span>Todos</span>
                                    <label className="toggle-switch">
                                        <input type="checkbox" checked={selecao.exibicao.value === 'ativos'} onChange={e => setSelecao({...selecao, exibicao: e.target.checked ? { value: 'ativos', label: 'Somente Ativos' } : { value: 'todos', label: 'Todos' }})} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                    <span>Ativos</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-footer">
                <button type="button" className="clear-filters-modal-btn" onClick={handleClear}><i className="bi bi-eraser"></i> Limpar Filtros</button>
                <div>
                    <button type="button" className="modal-button cancel" onClick={onClose}>Cancelar</button>
                    <button type="button" className="modal-button confirm" style={{backgroundColor: '#007bff'}} onClick={handleApply}>Aplicar Filtros</button>
                </div>
            </div>
        </Modal>
    );
};

const FloatingFilters = ({ onFiltersApply, currentUser }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selecaoFiltros, setSelecaoFiltros] = useState({
        superintendencias: [], nucleos: [], contratos: [],
        estados: [], controladores: [], gestores: [],
        visao: { value: 'Contrato', label: 'Contrato' },
        exibicao: { value: 'ativos', label: 'Somente Ativos' }
    });
    const [opcoesApi, setOpcoesApi] = useState({ lista_completa_ccs: [], controladores: [], estados: [], gestores: [] });

    useEffect(() => {
        const fetchOpcoes = async () => {
            try {
                const params = new URLSearchParams();
                // --- CORREÇÃO: Não envia o parâmetro para o master_admin ---
                if (currentUser && currentUser.perfil_id !== 'master_admin') {
                    params.append('user_contracts', currentUser.liberacao_dados || '');
                }
                
                const response = await fetch(`http://127.0.0.1:5000/api/filtros/opcoes?${params.toString()}`);
                const data = await response.json();
                setOpcoesApi(data);

            } catch (error) {
                console.error("Erro ao buscar opções de filtro:", error);
            }
        };
        fetchOpcoes();
    }, [currentUser]);

    const handleApply = (novaSelecao) => {
        setSelecaoFiltros(novaSelecao);
        onFiltersApply(novaSelecao);
        setIsModalOpen(false);
    };

    return (
        <>
            <div className="floating-widget floating-filters" onClick={() => setIsModalOpen(true)} title="Filtros Gerais">
                <i className="bi bi-funnel-fill"></i>
            </div>
            {isModalOpen && (
                <ModalFiltrosGerais 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onApply={handleApply}
                    initialSelection={selecaoFiltros}
                    opcoes={opcoesApi}
                />
            )}
        </>
    );
};

export default FloatingFilters;
