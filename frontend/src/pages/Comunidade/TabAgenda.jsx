import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "https://cdn.jsdelivr.net/npm/@fullcalendar/interaction@6.1.11/+esm";
import rrulePlugin from 'https://cdn.jsdelivr.net/npm/@fullcalendar/rrule@6.1.11/+esm';
import Select from 'react-select';
import Modal from '../../components/Modal.jsx';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';
import ModalAlerta from '../../components/ModalAlerta.jsx';

// Função auxiliar para checar permissões
const hasPermission = (user, permission) => {
    if (!user || !user.permissoes) {
        return false;
    }
    // Master admin sempre tem permissão
    if (user.perfil_id === 'master_admin') {
        return true;
    }
    return user.permissoes.includes(permission);
};


// Constantes para o formulário de recorrência
const diasSemanaOptions = [
    { value: 'SU', label: 'D' }, { value: 'MO', label: 'S' }, { value: 'TU', label: 'T' },
    { value: 'WE', label: 'Q' }, { value: 'TH', label: 'Q' }, { value: 'FR', label: 'S' },
    { value: 'SA', label: 'S' }
];
const frequenciaOptions = [
    { value: 'daily', label: 'Diariamente' },
    { value: 'weekly', label: 'Semanalmente' },
    { value: 'monthly', label: 'Mensalmente' },
];

const TabAgenda = ({ currentUser }) => {
    // Estados de dados e UI
    const [eventos, setEventos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [alvoOptions, setAlvoOptions] = useState([]);

    // Estados dos modais
    const [modalAberto, setModalAberto] = useState(false);
    const [modalDetalheAberto, setModalDetalheAberto] = useState(false);
    const [eventoSelecionado, setEventoSelecionado] = useState(null);
    const [eventoParaExcluir, setEventoParaExcluir] = useState(null);
    const [formState, setFormState] = useState({});
    const [formErrors, setFormErrors] = useState({});
    const [alerta, setAlerta] = useState({ aberto: false, mensagem: '' });

    // Estados para controlar a recorrência
    const [recorrenciaAtiva, setRecorrenciaAtiva] = useState(false);
    const [recorrencia, setRecorrencia] = useState({ freq: 'weekly', byday: [], until: '' });

    // Função para calcular a duração, necessária para eventos recorrentes com horário
    const calculateDuration = (start, end) => {
        if (!start || !end) return '00:00:00';
        const startTime = new Date(`1970-01-01T${start}`);
        const endTime = new Date(`1970-01-01T${end}`);
        const diff = endTime - startTime;
        return new Date(diff).toISOString().substr(11, 8);
    };

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('http://127.0.0.1:5000/api/eventos');
            if (!response.ok) throw new Error('Falha ao buscar eventos');
            const data = await response.json();
            const eventosFormatados = data.map(ev => {
                const eventoBase = {
                    id: ev.id,
                    title: ev.titulo,
                    allDay: !(ev.hora_inicio),
                    extendedProps: { ...ev }
                };

                // CORREÇÃO: A causa do erro é um evento recorrente no banco de dados
                // que não possui uma data de início (data_inicio). Esta verificação
                // garante que só tentaremos processar a recorrência se ambos os campos
                // 'recorrencia' e 'data_inicio' existirem.
                if (ev.recorrencia && ev.data_inicio) {
                    try {
                        const rruleData = JSON.parse(ev.recorrencia);
                        
                        // Validação extra para o formato de 'byday'
                        if (rruleData.byday && !Array.isArray(rruleData.byday)) {
                            throw new Error("'byday' precisa ser um array.");
                        }

                        eventoBase.rrule = {
                            ...rruleData,
                            dtstart: `${ev.data_inicio}T${ev.hora_inicio || '00:00:00'}`,
                        };
                        eventoBase.duration = calculateDuration(ev.hora_inicio, ev.hora_fim);
                    } catch (e) {
                        console.error(`Erro ao processar recorrência do evento ID ${ev.id}. Tratando como evento simples.`, { evento: ev, erro: e });
                        // Fallback: se a recorrência for inválida, trata como um evento normal.
                        eventoBase.start = `${ev.data_inicio}T${ev.hora_inicio || '00:00:00'}`;
                        eventoBase.end = ev.data_fim ? `${ev.data_fim}T${ev.hora_fim || '00:00:00'}` : null;
                    }
                } else {
                    // Se for recorrente mas não tiver data de início, avisa no console.
                    if (ev.recorrencia && !ev.data_inicio) {
                        console.warn(`Evento recorrente ID ${ev.id} ('${ev.titulo}') foi ignorado por não ter uma data de início.`);
                    }
                    // Lógica para eventos normais (não recorrentes).
                    eventoBase.start = ev.data_inicio ? `${ev.data_inicio}T${ev.hora_inicio || '00:00:00'}` : null;
                    eventoBase.end = ev.data_fim ? `${ev.data_fim}T${ev.hora_fim || '00:00:00'}` : null;
                }
                return eventoBase;
            });
            setEventos(eventosFormatados);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);
    
    useEffect(() => {
        const fetchAlvoOptions = async () => {
            if (!formState.visibilidade_tipo) {
                setAlvoOptions([]);
                return;
            }
            let url = '';
            if (formState.visibilidade_tipo === 'Superintendência') url = 'http://127.0.0.1:5000/api/centros_custo?tipo=Superintendência';
            else if (formState.visibilidade_tipo === 'Núcleo') url = 'http://127.0.0.1:5000/api/centros_custo?tipo=Núcleo';
            else if (formState.visibilidade_tipo === 'Contrato') url = 'http://127.0.0.1:5000/api/centros_custo?tipo=Contrato';
            else if (formState.visibilidade_tipo === 'Pessoas Específicas') url = 'http://127.0.0.1:5000/api/usuarios';
            else { setAlvoOptions([]); return; }

            try {
                const response = await fetch(url);
                const data = await response.json();
                const options = data.map(item => ({
                    value: item.id || item.cod_cc,
                    label: item.nome || item.nome_cc
                }));
                setAlvoOptions(options);
            } catch (err) {
                console.error("Erro ao buscar alvos de visibilidade:", err);
            }
        };
        fetchAlvoOptions();
    }, [formState.visibilidade_tipo]);

    useEffect(() => {
        const manageModalWideClass = () => {
            if (modalAberto && recorrenciaAtiva) {
                document.body.classList.add('modal-is-wide');
            } else {
                document.body.classList.remove('modal-is-wide');
            }
        };

        manageModalWideClass();

        return () => {
            document.body.classList.remove('modal-is-wide');
        };
    }, [modalAberto, recorrenciaAtiva]);

    const handleAdicionar = () => {
        setEventoSelecionado(null);
        setFormState({ titulo: '', descricao: '', data_inicio: '', data_fim: '', criado_por_id: currentUser.id, visibilidade_tipo: 'Todos', visibilidade_alvo: '', local: '', hora_inicio: '', hora_fim: '' });
        setFormErrors({});
        setRecorrencia({ freq: 'weekly', byday: [], until: '' });
        setRecorrenciaAtiva(false);
        setModalAberto(true);
    };

    const handleEditar = (evento) => {
        const rawEventData = evento.extendedProps;
        setEventoSelecionado(evento);
        setFormState({
            titulo: rawEventData.titulo,
            descricao: rawEventData.descricao || '',
            data_inicio: rawEventData.data_inicio,
            data_fim: rawEventData.data_fim || rawEventData.data_inicio,
            criado_por_id: rawEventData.criado_por_id,
            visibilidade_tipo: rawEventData.visibilidade_tipo || 'Todos',
            visibilidade_alvo: rawEventData.visibilidade_alvo || '',
            local: rawEventData.local || '',
            hora_inicio: rawEventData.hora_inicio || '',
            hora_fim: rawEventData.hora_fim || '',
        });
        
        if (rawEventData.recorrencia) {
            setRecorrenciaAtiva(true);
            setRecorrencia(JSON.parse(rawEventData.recorrencia));
        } else {
            setRecorrenciaAtiva(false);
            setRecorrencia({ freq: 'weekly', byday: [], until: '' });
        }

        setFormErrors({});
        setModalDetalheAberto(false);
        setModalAberto(true);
    };

    const handleExcluir = (evento) => {
        setEventoParaExcluir(evento);
        setModalDetalheAberto(false);
    };

    const handleEventClick = (clickInfo) => {
        setEventoSelecionado(clickInfo.event);
        setModalDetalheAberto(true);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        if (name === 'datetime_inicio' || name === 'datetime_fim') {
            const [date, time] = value.split('T');
            const dateFieldName = name === 'datetime_inicio' ? 'data_inicio' : 'data_fim';
            const timeFieldName = name === 'datetime_inicio' ? 'hora_inicio' : 'hora_fim';
            setFormState(prev => ({ ...prev, [dateFieldName]: date || '', [timeFieldName]: time || '' }));
        } else {
            setFormState(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleSelectChange = (name, option) => {
        const value = option ? (Array.isArray(option) ? option.map(o => o.value).join(',') : option.value) : null;
        const newState = { ...formState, [name]: value };
        if (name === 'visibilidade_tipo') {
            newState.visibilidade_alvo = '';
        }
        setFormState(newState);
    };

    const handleRecorrenciaChange = (field, value) => {
        setRecorrencia(prev => ({ ...prev, [field]: value }));
    };

    const toggleDiaSemana = (dia) => {
        const byday = recorrencia.byday.includes(dia)
            ? recorrencia.byday.filter(d => d !== dia)
            : [...recorrencia.byday, dia];
        setRecorrencia(prev => ({ ...prev, byday }));
    };

    const validateForm = () => {
        const errors = {};
        if (!formState.titulo) errors.titulo = true;
        if (!formState.descricao) errors.descricao = true;
        if (!formState.local) errors.local = true;
        if (!formState.data_inicio || !formState.hora_inicio) errors.datetime_inicio = true;
        if (!recorrenciaAtiva && (!formState.data_fim || !formState.hora_fim)) {
            errors.datetime_fim = true;
        }
        if (formState.visibilidade_tipo !== 'Todos' && !formState.visibilidade_alvo) {
            errors.visibilidade_alvo = true;
        }
        if (recorrenciaAtiva && recorrencia.freq === 'weekly' && recorrencia.byday.length === 0) {
            errors.recorrencia_byday = true;
            setAlerta({ aberto: true, mensagem: 'Para recorrência semanal, você deve selecionar pelo menos um dia da semana.' });
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };
    
    const handleSave = async () => {
        if (!validateForm()) return;

        let finalFormState = { ...formState };
        if (recorrenciaAtiva) {
            finalFormState.recorrencia = JSON.stringify(recorrencia);
            finalFormState.data_fim = null; 
            finalFormState.hora_fim = null;
        } else {
            finalFormState.recorrencia = null;
        }

        const url = eventoSelecionado ? `http://127.0.0.1:5000/api/eventos/${eventoSelecionado.id}` : 'http://127.0.0.1:5000/api/eventos';
        const method = eventoSelecionado ? 'PUT' : 'POST';
        try {
            const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finalFormState) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlerta({ aberto: true, mensagem: result.message });
            fetchData();
        } catch (err) {
            setAlerta({ aberto: true, mensagem: `Erro: ${err.message}` });
        }
        setModalAberto(false);
    };

    const handleDeleteConfirm = async () => {
        if (!eventoParaExcluir) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/eventos/${eventoParaExcluir.id}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlerta({ aberto: true, mensagem: result.message });
            fetchData();
        } catch (err) {
            setAlerta({ aberto: true, mensagem: `Erro: ${err.message}` });
        }
        setEventoParaExcluir(null);
    };
    
    const visibilidadeOptions = [
        {value: 'Todos', label: 'Todos'}, {value: 'Superintendência', label: 'Superintendência'},
        {value: 'Núcleo', label: 'Núcleo'}, {value: 'Contrato', label: 'Contrato'},
        {value: 'Pessoas Específicas', label: 'Pessoas Específicas'},
    ];

    const selectStyles = { menuList: (base) => ({ ...base, maxHeight: 85 }) };

    return (
        <>
            {hasPermission(currentUser, 'comunidade_agenda_cadastrar') && (
                <div className="admin-actions-bar">
                    <button className="admin-button" onClick={handleAdicionar}>
                        <i className="bi bi-plus-circle-fill"></i> Adicionar Evento
                    </button>
                </div>
            )}
            <div className="calendar-container">
                {isLoading ? <p>Carregando calendário...</p> : error ? <p style={{color: 'red'}}>{error}</p> :
                <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin, rrulePlugin]}
                    initialView="dayGridMonth"
                    events={eventos}
                    locale='pt-br'
                    headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' }}
                    buttonText={{ today: 'Hoje', month: 'Mês', week: 'Semana' }}
                    height="auto"
                    eventClick={handleEventClick}
                />}
            </div>

            <Modal isOpen={modalDetalheAberto} onClose={() => setModalDetalheAberto(false)} title={eventoSelecionado?.title}>
                <p>{eventoSelecionado?.extendedProps.descricao || "Este evento não possui uma descrição detalhada."}</p>
                <hr/>
                <small>Criado por: {eventoSelecionado?.extendedProps.criado_por_nome}</small><br/>
                <small>Para: {eventoSelecionado?.extendedProps.visibilidade_tipo}</small>
                
                <div className="modal-footer" style={{justifyContent: 'flex-end'}}>
                    {hasPermission(currentUser, 'comunidade_agenda_editar') && (
                        <button className="modal-button cancel" onClick={() => handleEditar(eventoSelecionado)}>Editar</button>
                    )}
                    {hasPermission(currentUser, 'comunidade_agenda_excluir') && (
                        <button className="modal-button confirm" onClick={() => handleExcluir(eventoSelecionado)}>Excluir</button>
                    )}
                </div>
            </Modal>

            <Modal 
                isOpen={modalAberto} 
                onClose={() => setModalAberto(false)} 
                title={eventoSelecionado ? "Editar Evento" : "Adicionar Novo Evento"}
            >
                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <div className={`form-grid-layout ${recorrenciaAtiva ? 'recorrencia-ativa' : ''}`}>
                        
                        <div className="form-column-left">
                            <div className="user-form-grid">
                                <div className="filter-group">
                                    <label>Título do Evento:</label>
                                    <input name="titulo" value={formState.titulo || ''} onChange={handleFormChange} className={formErrors.titulo ? 'input-error' : ''} />
                                </div>
                                <div className="filter-group">
                                    <label>Local:</label>
                                    <input name="local" value={formState.local || ''} onChange={handleFormChange} className={formErrors.local ? 'input-error' : ''} />
                                </div>
                            </div>

                            <div className="filter-group">
                                <label>Descrição:</label>
                                <textarea
                                    name="descricao"
                                    value={formState.descricao || ''}
                                    onChange={handleFormChange}
                                    rows="2"
                                    className={formErrors.descricao ? 'input-error' : ''}
                                ></textarea>
                            </div>
                            
                            <div className="user-form-grid">
                                <div className="filter-group">
                                    <label>Início:</label>
                                    <input type="datetime-local" name="datetime_inicio" value={`${formState.data_inicio || ''}T${formState.hora_inicio || ''}`} onChange={handleFormChange} className={formErrors.datetime_inicio ? 'input-error' : ''} />
                                </div>

                                <div className="filter-group">
                                    <label>Fim:</label>
                                    <input type="datetime-local" name="datetime_fim" value={`${formState.data_fim || ''}T${formState.hora_fim || ''}`} onChange={handleFormChange} className={formErrors.datetime_fim ? 'input-error' : ''} disabled={recorrenciaAtiva} />
                                    
                                    <div className="recorrencia-toggle-stacked">
                                        <label className="checkbox-label-group">
                                            <input type="checkbox" checked={recorrenciaAtiva} onChange={(e) => setRecorrenciaAtiva(e.target.checked)} />
                                            <span>Recorrente</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="user-form-grid" style={{marginTop: '15px'}}>
                                <div className="filter-group"><label>Visível para:</label><Select options={visibilidadeOptions} styles={selectStyles} value={visibilidadeOptions.find(o => o.value === formState.visibilidade_tipo)} onChange={(opt) => handleSelectChange('visibilidade_tipo', opt)} /></div>
                                <div className="filter-group"><label>Alvo específico:</label><Select options={alvoOptions} styles={selectStyles} isMulti isDisabled={formState.visibilidade_tipo === 'Todos'} value={alvoOptions.filter(o => formState.visibilidade_alvo?.split(',').includes(String(o.value)))} onChange={(opts) => handleSelectChange('visibilidade_alvo', opts)} className={formErrors.visibilidade_alvo ? 'select-error' : ''} /></div>
                            </div>
                        </div>

                        {recorrenciaAtiva && (
                            <div className="form-column-right">
                                <h4>Opções de Recorrência</h4>
                                <div className="filter-group">
                                    <label>Frequência:</label>
                                    <Select options={frequenciaOptions} value={frequenciaOptions.find(o => o.value === recorrencia.freq)} onChange={(opt) => handleRecorrenciaChange('freq', opt.value)} />
                                </div>
                                <div className="filter-group">
                                    <label>Repetir até (opcional):</label>
                                    <input type="date" value={recorrencia.until || ''} onChange={(e) => handleRecorrenciaChange('until', e.target.value)} />
                                </div>
                                
                                {recorrencia.freq === 'weekly' && (
                                    <div className="filter-group">
                                        <label>Nos dias:</label>
                                        <div className="dias-semana-group">
                                            {diasSemanaOptions.map(dia => (
                                                <button key={dia.value} type="button" className={`dia-semana-btn ${recorrencia.byday.includes(dia.value) ? 'selected' : ''}`} onClick={() => toggleDiaSemana(dia.value)}>
                                                    {dia.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="modal-footer" style={{ borderTop: '1px solid #eee', paddingTop: '15px', marginTop: '20px' }}> <div></div>
                        <div>
                            <button type="button" className="modal-button cancel" onClick={() => setModalAberto(false)}>Cancelar</button>
                            <button type="submit" className="modal-button confirm" style={{backgroundColor: '#27ae60'}}>Salvar</button>
                        </div>
                    </div>
                    {Object.keys(formErrors).length > 0 && 
                        <p className="error-message">
                            <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: '6px' }}></i>
                            Todos os itens precisam ser preenchidos
                        </p>
                    }
                </form>
            </Modal>
            
            <ModalConfirmacao isOpen={!!eventoParaExcluir} onClose={() => setEventoParaExcluir(null)} onConfirm={handleDeleteConfirm} title="Confirmar Exclusão">
                <p>Você tem certeza que deseja excluir o evento: <strong>{eventoParaExcluir?.title}</strong></p>
            </ModalConfirmacao>
            
            <ModalAlerta isOpen={alerta.aberto} onClose={() => setAlerta({ aberto: false, mensagem: '' })} title="Operação Concluída"><p>{alerta.mensagem}</p></ModalAlerta>
        </>
    );
};

export default TabAgenda;
