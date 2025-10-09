import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import EsqueletoPreview from './EsqueletoPreview.jsx';
import ModalAlerta from './ModalAlerta.jsx';

// ATUALIZADO: URL base da API
const API_BASE_URL = 'http://127.0.0.1:5000';

function ModalCadastroLayout({ layouts, layoutInicial, onSave, onCancel }) {
    const [tipoObjSelecionado, setTipoObjSelecionado] = useState(null);
    const [configuracao, setConfiguracao] = useState([]);
    const [tiposObjOptions, setTiposObjOptions] = useState([]);
    const [layoutAtivo, setLayoutAtivo] = useState(null);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');

    useEffect(() => {
        if (layoutInicial) {
            const tipoObj = { 
                value: layoutInicial.cod_tipo_obj, 
                label: `${layoutInicial.cod_tipo_obj} - ${layoutInicial.tipo_obj}` 
            };
            setTipoObjSelecionado(tipoObj);
            setConfiguracao(layoutInicial.configuracao);
            setLayoutAtivo(layoutInicial);
        } else {
            setTipoObjSelecionado(null);
            setConfiguracao([]);
            setLayoutAtivo(null);
        }
    }, [layoutInicial]);

    useEffect(() => {
        const fetchTipos = async () => {
            try {
                // ATUALIZADO: Uso da URL base
                const response = await fetch(`${API_BASE_URL}/api/pneus/tipos-equipamento`);
                if (!response.ok) throw new Error('Não foi possível carregar os tipos de equipamento.');
                const data = await response.json();
                const options = data.map(t => ({ value: t.cod_tipo_obj, label: `${t.cod_tipo_obj} - ${t.tipo_obj}` }));
                setTiposObjOptions(options);
            } catch (error) {
                console.error("Erro ao buscar tipos de equipamento:", error);
            }
        };
        fetchTipos();
    }, []);
    
    const handleTipoObjChange = (selectedOption) => {
        setTipoObjSelecionado(selectedOption);
        const layoutExistente = layouts.find(l => l.cod_tipo_obj === selectedOption.value);

        if (layoutExistente) {
            setConfiguracao(layoutExistente.configuracao);
            setLayoutAtivo(layoutExistente);
            setAlertTitle("Layout Existente");
            setAlertMessage(`Já existe um layout para ${layoutExistente.tipo_obj}. Qualquer alteração irá sobrescrever a configuração atual.`);
            setIsAlertOpen(true);
        } else {
            setConfiguracao([]);
            setLayoutAtivo(null);
        }
    };

    const adicionarNivel = (tipo, pneusPorLado = 0) => {
        const novoNivel = { tipo };
        if (tipo === 'eixo') {
            novoNivel.pneus_por_lado = pneusPorLado;
        }
        setConfiguracao([...configuracao, novoNivel]);
    };

    const removerNivel = (index) => {
        setConfiguracao(configuracao.filter((_, i) => i !== index));
    };

    const moverNivel = (index, direcao) => {
        if (direcao === 'cima' && index === 0) return;
        if (direcao === 'baixo' && index === configuracao.length - 1) return;

        const novaConfig = [...configuracao];
        const item = novaConfig[index];
        const novoIndex = direcao === 'cima' ? index - 1 : index + 1;

        novaConfig.splice(index, 1);
        novaConfig.splice(novoIndex, 0, item);

        setConfiguracao(novaConfig);
    };

    const handleSave = async () => {
        if (!tipoObjSelecionado) {
            setAlertTitle("Dados Incompletos");
            setAlertMessage("Por favor, selecione um tipo de equipamento.");
            setIsAlertOpen(true);
            return;
        }

        const isUpdating = !!(layoutAtivo && layoutAtivo.id);
        
        const payload = {
            cod_tipo_obj: tipoObjSelecionado.value,
            configuracao: configuracao,
        };

        // ATUALIZADO: Uso da URL base
        const url = isUpdating 
            ? `${API_BASE_URL}/api/pneus/layouts/${layoutAtivo.id}` 
            : `${API_BASE_URL}/api/pneus/layouts`;
        const method = isUpdating ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error('Erro ao salvar o layout.');
            onSave();
        } catch (error) {
            setAlertTitle("Erro");
            setAlertMessage(error.message);
            setIsAlertOpen(true);
        }
    };

    return (
        <>
            <ModalAlerta
                isOpen={isAlertOpen}
                onClose={() => setIsAlertOpen(false)}
                title={alertTitle}
            >
                <p>{alertMessage}</p>
            </ModalAlerta>
            
            <div className="layout-modal-container">
                <div className="layout-controls">
                    <div className="control-group">
                        <label>Tipo de Equipamento</label>
                        <Select
                            options={tiposObjOptions}
                            value={tipoObjSelecionado}
                            onChange={handleTipoObjChange}
                            placeholder="Selecione..."
                            isDisabled={!!layoutInicial} 
                        />
                    </div>

                    <div className="control-group">
                        <label>Adicionar Nível</label>
                        <div className="add-buttons">
                            <button className="btn" onClick={() => adicionarNivel('eixo', 1)}>
                                <i className="bi bi-grip-horizontal"></i> Eixo (1 Pneu)
                            </button>
                            <button className="btn" onClick={() => adicionarNivel('eixo', 2)}>
                                <i className="bi bi-grip-horizontal"></i><i className="bi bi-grip-horizontal"></i> Eixo (2 Pneus)
                            </button>
                            <button className="btn" onClick={() => adicionarNivel('espaco')}>
                                <i className="bi bi-arrows-expand"></i> Espaço
                            </button>
                        </div>
                    </div>

                    <div className="level-list">
                        {configuracao.length === 0 ? <p style={{textAlign: 'center', color: '#6c757d'}}>Adicione níveis para montar o layout.</p> :
                            configuracao.map((nivel, index) => (
                                <div key={index} className="level-item">
                                    <span>
                                        {index + 1}. {nivel.tipo === 'eixo' ? `Eixo com ${nivel.pneus_por_lado} pneu(s) por lado` : 'Espaço entre eixos'}
                                    </span>
                                    <div className="level-item-actions">
                                        <button onClick={() => moverNivel(index, 'cima')} title="Mover para Cima" disabled={index === 0}>
                                            <i className="bi bi-arrow-up-short"></i>
                                        </button>
                                        <button onClick={() => moverNivel(index, 'baixo')} title="Mover para Baixo" disabled={index === configuracao.length - 1}>
                                            <i className="bi bi-arrow-down-short"></i>
                                        </button>
                                        <button onClick={() => removerNivel(index)} title="Remover Nível">
                                            <i className="bi bi-x-lg"></i>
                                        </button>
                                    </div>
                                </div>
                            ))
                        }
                    </div>

                    <div className="modal-footer" style={{marginTop: 'auto', paddingTop: '20px'}}>
                        <button className="modal-button cancel" onClick={onCancel}>Cancelar</button>
                        <button className="modal-button confirm" onClick={handleSave}>Salvar Layout</button>
                    </div>
                </div>
                <div className="layout-preview">
                    {/* ATUALIZADO: Padding condicional no título */}
                    <h4 style={{ marginBottom: configuracao.length > 0 ? '0' : '0' }}>Pré-visualização</h4>
                    <EsqueletoPreview configuracao={configuracao} />
                </div>
            </div>
        </>
    );
}

export default ModalCadastroLayout;

