import React, { useState, useEffect, useRef, useMemo } from 'react';
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
    if (!user || !user.permissoes) return false;
    if (user.perfil_id === 'master_admin') return true;
    return user.permissoes.includes(permission);
};

// ... (constantes de recorrência permanecem as mesmas)
const diasSemanaOptions = [
    { value: 'su', label: 'D' }, { value: 'mo', label: 'S' }, { value: 'tu', label: 'T' },
    { value: 'we', label: 'Q' }, { value: 'th', label: 'Q' }, { value: 'fr', label: 'S' },
    { value: 'sa', label: 'S' }
];
const frequenciaOptions = [
    { value: 'daily', label: 'Diariamente' }, { value: 'weekly', label: 'Semanalmente' }, { value: 'monthly', label: 'Mensalmente' },
];
const monthlyPositionOptions = [
    { value: 1, label: 'Primeiro(a)' }, { value: 2, label: 'Segundo(a)' }, { value: 3, label: 'Terceiro(a)' }, 
    { value: 4, label: 'Quarto(a)' }, { value: 5, label: 'Quinto(a)' }, { value: -1, label: 'Último(a)' }
];
const monthlyWeekdayOptions = [
    { value: 'su', label: 'Domingo' }, { value: 'mo', label: 'Segunda-feira' }, { value: 'tu', label: 'Terça-feira' }, 
    { value: 'we', label: 'Quarta-feira' }, { value: 'th', label: 'Quinta-feira' }, { value: 'fr', label: 'Sexta-feira' }, { value: 'sa', label: 'Sábado' }
];


// Função auxiliar para formatar o período do evento para exibição
const formatarPeriodo = (event) => {
    if (!event) return '';
    const { recorrencia } = event.extendedProps;
    if (recorrencia) {
        try {
            const rule = JSON.parse(recorrencia);
            let text = '';
            if (rule.freq === 'daily') text = 'Diariamente';
            if (rule.freq === 'weekly') text = 'Semanalmente';
            if (rule.freq === 'monthly') text = 'Mensalmente';
            if (rule.until) {
                text += ` até ${new Date(rule.until + 'T00:00:00').toLocaleDateString('pt-BR')}`;
            }
            return text;
        } catch { /* fallback */ }
    }

    const start = event.start;
    const end = event.end;
    const optionsDate = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const optionsTime = { hour: '2-digit', minute: '2-digit', hour12: false };

    if (event.allDay) {
        const inclusiveEnd = new Date(end);
        inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
        if (!end || start.toDateString() === inclusiveEnd.toDateString()) {
            return `Dia todo em ${start.toLocaleDateString('pt-BR', optionsDate)}`;
        }
        return `De ${start.toLocaleDateString('pt-BR', optionsDate)} a ${inclusiveEnd.toLocaleDateString('pt-BR', optionsDate)}`;
    } else if (start && end) {
        const startDateStr = start.toLocaleDateString('pt-BR', optionsDate);
        const startTimeStr = start.toLocaleTimeString('pt-BR', optionsTime);
        const endDateStr = end.toLocaleDateString('pt-BR', optionsDate);
        const endTimeStr = end.toLocaleTimeString('pt-BR', optionsTime);
        if (startDateStr === endDateStr) {
            return `${startDateStr} das ${startTimeStr} às ${endTimeStr}`;
        }
        return `De ${startDateStr} ${startTimeStr} a ${endDateStr} ${endTimeStr}`;
    }
    return 'Data inválida';
};

// --- COMPONENTE: MODAL DO MAPA (ATUALIZADO) ---
const ModalMapa = ({ isOpen, onClose, onLocationSelect, initialCoords, initialSearchText, isReadOnly = false }) => {
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const searchContainerRef = useRef(null);
    const debounceTimeout = useRef(null);

    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [selectedCoords, setSelectedCoords] = useState(null);

    useEffect(() => {
        if (isOpen) {
            const container = L.DomUtil.get('map-container');
            if (container != null) container._leaflet_id = null;

            const map = L.map('map-container').setView([-19.916681, -43.934494], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);
            mapRef.current = map;

            if (!isReadOnly) {
                map.on('click', (e) => {
                    const { lat, lng } = e.latlng;
                    updateMarkerAndCoords({ lat, lng });
                });
            }

            if (initialCoords && initialCoords.lat && initialCoords.lng) {
                const latLng = [initialCoords.lat, initialCoords.lng];
                map.setView(latLng, 16);
                markerRef.current = L.marker(latLng).addTo(map);
                setSelectedCoords(initialCoords);
            }
            if (initialSearchText) {
                setSearch(initialSearchText);
            }
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
            }
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setResults([]);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const updateMarkerAndCoords = (coords) => {
        setSelectedCoords(coords);
        if (markerRef.current) {
            markerRef.current.setLatLng([coords.lat, coords.lng]);
        } else {
            markerRef.current = L.marker([coords.lat, coords.lng]).addTo(mapRef.current);
        }
    };
    
    const fetchSearchResults = async (query) => {
        if (!query) return;
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1`);
        const data = await response.json();
        setResults(data);
    };

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearch(value);
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        if (value) {
            debounceTimeout.current = setTimeout(() => fetchSearchResults(value), 500);
        } else {
            setResults([]);
        }
    };

    const handleSelectResult = (result) => {
        const newCoords = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
        mapRef.current.setView([newCoords.lat, newCoords.lng], 17);
        updateMarkerAndCoords(newCoords);
        setResults([]);
    };

    const handleConfirm = () => {
        onLocationSelect(selectedCoords);
        onClose();
    };

    const handleOpenGoogleMaps = () => {
        if (initialCoords && initialCoords.lat && initialCoords.lng) {
            const url = `https://www.google.com/maps/search/?api=1&query=${initialCoords.lat},${initialCoords.lng}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isReadOnly ? "Visualizar Localização" : "Marcar Localização no Mapa"} size="xlplus">
            <div className="map-modal-content">
                {!isReadOnly && (
                    <div className="map-search-container" ref={searchContainerRef}>
                        <div className="map-search-form">
                            <input type="text" value={search} onChange={handleSearchChange} placeholder="Digite um endereço para pesquisar..." />
                        </div>
                        {results.length > 0 && (
                            <ul className="map-results-list">
                                {results.map(r => <li key={r.place_id} onClick={() => handleSelectResult(r)}>{r.display_name}</li>)}
                            </ul>
                        )}
                    </div>
                )}
                <div id="map-container">
                    {isReadOnly && initialCoords && (
                        <button className="google-maps-btn" onClick={handleOpenGoogleMaps}>
                            <i className="bi bi-box-arrow-up-right"></i> Abrir no Google Maps
                        </button>
                    )}
                </div>
            </div>
            {!isReadOnly && (
                <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="modal-button cancel" onClick={onClose}>Cancelar</button>
                    <button type="button" className="modal-button confirm" onClick={handleConfirm} disabled={!selectedCoords}>
                        Confirmar Localização
                    </button>
                </div>
            )}
        </Modal>
    );
};


const TabAgenda = ({ currentUser }) => {
    // ... (estados existentes)
    const [eventos, setEventos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [alvoOptions, setAlvoOptions] = useState([]);
    const [tiposEvento, setTiposEvento] = useState([]);
    const [modalAberto, setModalAberto] = useState(false);
    const [modalDetalheAberto, setModalDetalheAberto] = useState(false);
    const [eventoSelecionado, setEventoSelecionado] = useState(null);
    const [eventoParaExcluir, setEventoParaExcluir] = useState(null);
    const [formState, setFormState] = useState({});
    const [formErrors, setFormErrors] = useState({});
    const [alerta, setAlerta] = useState({ aberto: false, mensagem: '' });
    const [modalTiposAberto, setModalTiposAberto] = useState(false);
    const [linhasTipos, setLinhasTipos] = useState([]);
    const [tiposOriginais, setTiposOriginais] = useState([]);
    const [editingCellTipo, setEditingCellTipo] = useState({ rowIndex: null, colKey: null });
    const [hoveredRowTipo, setHoveredRowTipo] = useState(null);
    const [showInsertPreview, setShowInsertPreview] = useState(false);
    const [recorrenciaAtiva, setRecorrenciaAtiva] = useState(false);
    const [recorrencia, setRecorrencia] = useState({
        freq: 'weekly', until: '', byweekday: [], monthlyType: 'fixed',
        bymonthday: 1, bysetpos: 1
    });
    const [filtroTipoId, setFiltroTipoId] = useState(null);
    const [eventosVisiveis, setEventosVisiveis] = useState([]);
    const calendarRef = useRef(null);
    
    // --- ESTADOS PARA O MODAL DO MAPA ---
    const [mapModalAberto, setMapModalAberto] = useState(false);
    const [mapIsReadOnly, setMapIsReadOnly] = useState(false);
    const [mapInitialData, setMapInitialData] = useState({ coords: null, searchText: '' });


    const calculateDuration = (start, end) => {
        if (!start || !end) return '00:00:00';
        const startTime = new Date(`1970-01-01T${start}`);
        const endTime = new Date(`1970-01-01T${end}`);
        const diff = endTime - startTime;
        if (diff < 0) return '00:00:00';
        return new Date(diff).toISOString().substr(11, 8);
    };

    const fetchTiposEvento = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/tipos_eventos');
            const data = await response.json();
            setTiposEvento(data);
            const clonedData = data.map(d => ({...d}));
            setLinhasTipos(clonedData);
            setTiposOriginais(JSON.parse(JSON.stringify(clonedData)));
        } catch (error) {
            console.error("Erro ao buscar tipos de evento:", error);
            setAlerta({ aberto: true, mensagem: `Erro ao carregar tipos de evento: ${error.message}`});
        }
    };
    
    const fetchData = async () => {
        setIsLoading(true);
        try {
            let url = 'http://127.0.0.1:5000/api/eventos';
            if (filtroTipoId) {
                url += `?tipo_id=${filtroTipoId}`;
            }
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Falha ao buscar eventos');
            const data = await response.json();
            const eventosFormatados = data.map(ev => {
                const eventoBase = {
                    id: ev.id,
                    title: ev.titulo,
                    allDay: !(ev.hora_inicio),
                    extendedProps: { ...ev },
                    backgroundColor: ev.cor || '#3788d8',
                    borderColor: ev.cor || '#3788d8'
                };

                if (ev.recorrencia && ev.data_inicio) {
                    try {
                        const rruleData = JSON.parse(ev.recorrencia);
                        if (rruleData.byweekday && !Array.isArray(rruleData.byweekday)) {
                            throw new Error("'byweekday' precisa ser um array.");
                        }
                        eventoBase.rrule = {
                            ...rruleData,
                            dtstart: `${ev.data_inicio}T${ev.hora_inicio || '00:00:00'}`,
                        };
                        eventoBase.duration = calculateDuration(ev.hora_inicio, ev.hora_fim);
                    } catch (e) {
                        console.error(`Erro ao processar recorrência do evento ID ${ev.id}.`, { evento: ev, erro: e });
                        eventoBase.start = `${ev.data_inicio}T${ev.hora_inicio || '00:00:00'}`;
                        eventoBase.end = ev.data_fim ? `${ev.data_fim}T${ev.hora_fim || '00:00:00'}` : null;
                    }
                } else {
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

    useEffect(() => {
        fetchTiposEvento();
    }, []);

    useEffect(() => {
        fetchData();
    }, [filtroTipoId]);

    useEffect(() => {
        const fetchAlvoOptions = async () => {
            if (!formState.visibilidade_tipo) { setAlvoOptions([]); return; }
            let url = '';
            if (formState.visibilidade_tipo === 'Superintendência') url = 'http://127.0.0.1:5000/api/centros_custo?tipo=Superintendência';
            else if (formState.visibilidade_tipo === 'Núcleo') url = 'http://127.0.0.1:5000/api/centros_custo?tipo=Núcleo';
            else if (formState.visibilidade_tipo === 'Contrato') url = 'http://127.0.0.1:5000/api/centros_custo?tipo=Contrato';
            else if (formState.visibilidade_tipo === 'Pessoas Específicas') url = 'http://127.0.0.1:5000/api/usuarios';
            else { setAlvoOptions([]); return; }

            try {
                const response = await fetch(url);
                const data = await response.json();
                setAlvoOptions(data.map(item => ({ value: item.id || item.cod_cc, label: item.nome || item.nome_cc })));
            } catch (err) {
                console.error("Erro ao buscar alvos de visibilidade:", err);
            }
        };
        fetchAlvoOptions();
    }, [formState.visibilidade_tipo]);

    useEffect(() => {
        if (modalAberto && recorrenciaAtiva) { document.body.classList.add('modal-is-wide'); } 
        else { document.body.classList.remove('modal-is-wide'); }
        return () => { document.body.classList.remove('modal-is-wide'); };
    }, [modalAberto, recorrenciaAtiva]);
    
    const optionsFiltroTipo = [{ value: null, label: 'Todos os Tipos' }, ...tiposEvento.map(t => ({ value: t.id, label: t.tipo }))];

    // --- helpers para sincronizar a lista com a view do calendário ---
    const isEventOverlappingRange = (event, rangeStart, rangeEnd) => {
        const evStart = event.start;
        const evEnd = event.end || event.start;
        if (!evStart) return false;
        return evStart < rangeEnd && evEnd > rangeStart;
    };

    const updateVisibleFromCalendar = (calendarApi, viewStart, viewEnd) => {
        if (!calendarApi || !viewStart || !viewEnd) {
            setEventosVisiveis([]);
            return;
        }
        const all = calendarApi.getEvents() || [];
        const filtered = all.filter(ev => isEventOverlappingRange(ev, viewStart, viewEnd));
        filtered.sort((a, b) => (a.start ? +a.start : 0) - (b.start ? +b.start : 0));
        setEventosVisiveis(filtered);
    };

    const handleDatesSet = (info) => {
        const calendarApi = calendarRef.current?.getApi();
        const viewStart = info.view.activeStart;
        const viewEnd = info.view.activeEnd;
        updateVisibleFromCalendar(calendarApi, viewStart, viewEnd);
    };

    const handleEventsSet = (eventsArray) => {
        const calendarApi = calendarRef.current?.getApi();
        const viewStart = calendarApi?.view?.activeStart;
        const viewEnd = calendarApi?.view?.activeEnd;
        if (viewStart && viewEnd) {
            const filtered = eventsArray.filter(ev => isEventOverlappingRange(ev, viewStart, viewEnd));
            filtered.sort((a, b) => (a.start ? +a.start : 0) - (b.start ? +b.start : 0));
            setEventosVisiveis(filtered);
        } else {
            const arr = [...eventsArray].sort((a, b) => (a.start ? +a.start : 0) - (b.start ? +b.start : 0));
            setEventosVisiveis(arr);
        }
    };

    useEffect(() => {
        const calendarApi = calendarRef.current?.getApi();
        if (!calendarApi) return;
        const viewStart = calendarApi.view.activeStart;
        const viewEnd = calendarApi.view.activeEnd;
        updateVisibleFromCalendar(calendarApi, viewStart, viewEnd);
    }, [eventos]);

    
    const getDefaultsFromDate = (dateStr) => {
        const date = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
        const dayOfMonth = date.getDate();
        const dayOfWeekIndex = date.getDay();
        return {
            bymonthday: dayOfMonth, bysetpos: Math.ceil(dayOfMonth / 7), byweekday: [diasSemanaOptions[dayOfWeekIndex].value]
        };
    };

    const handleAdicionar = () => {
        const today = new Date().toISOString().split('T')[0];
        const defaults = getDefaultsFromDate(today);
        setEventoSelecionado(null);
        setFormState({ 
            titulo: '', descricao: '', data_inicio: today, data_fim: '', criado_por_id: currentUser.id, 
            visibilidade_tipo: 'Todos', visibilidade_alvo: '', local: '', hora_inicio: '', hora_fim: '', tipo: null,
            latitude: null, longitude: null
        });
        setFormErrors({});
        setRecorrencia({ 
            freq: 'weekly', until: '', byweekday: [], monthlyType: 'fixed', 
            bymonthday: defaults.bymonthday, bysetpos: defaults.bysetpos 
        });
        setRecorrenciaAtiva(false);
        setModalAberto(true);
    };

    const handleEditar = (evento) => {
        const rawEventData = evento.extendedProps;
        const defaults = getDefaultsFromDate(rawEventData.data_inicio);
        setEventoSelecionado(evento);
        setFormState({
            titulo: rawEventData.titulo, descricao: rawEventData.descricao || '', data_inicio: rawEventData.data_inicio,
            data_fim: rawEventData.data_fim || rawEventData.data_inicio, criado_por_id: rawEventData.criado_por_id,
            visibilidade_tipo: rawEventData.visibilidade_tipo || 'Todos', visibilidade_alvo: rawEventData.visibilidade_alvo || '',
            local: rawEventData.local || '', hora_inicio: rawEventData.hora_inicio || '', hora_fim: rawEventData.hora_fim || '',
            tipo_id: rawEventData.tipo_id,
            latitude: rawEventData.latitude, longitude: rawEventData.longitude
        });
        
        if (rawEventData.recorrencia) {
            setRecorrenciaAtiva(true);
            const rruleData = JSON.parse(rawEventData.recorrencia);
            setRecorrencia({
                freq: rruleData.freq || 'weekly', until: rruleData.until || '', byweekday: rruleData.byweekday || [],
                monthlyType: rruleData.bymonthday ? 'fixed' : 'relative', bymonthday: rruleData.bymonthday || defaults.bymonthday,
                bysetpos: rruleData.bysetpos || defaults.bysetpos,
            });
        } else {
            setRecorrenciaAtiva(false);
            setRecorrencia({ freq: 'weekly', until: '', byweekday: [], monthlyType: 'fixed', bymonthday: defaults.bymonthday, bysetpos: defaults.bysetpos });
        }
        setFormErrors({});
        setModalDetalheAberto(false);
        setModalAberto(true);
    };

    const handleExcluir = (evento) => { setEventoParaExcluir(evento); setModalDetalheAberto(false); };
    
    const handleEventClick = (eventInfo) => { 
        const eventObject = eventInfo.event || eventInfo;
        setEventoSelecionado(eventObject); 
        setModalDetalheAberto(true); 
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        if (name === 'datetime_inicio' || name === 'datetime_fim') {
            const [date, time] = value.split('T');
            const dateFieldName = name === 'datetime_inicio' ? 'data_inicio' : 'data_fim';
            const timeFieldName = name === 'datetime_inicio' ? 'hora_inicio' : 'hora_fim';
            const newState = { ...formState, [dateFieldName]: date || '', [timeFieldName]: time || '' };
            
            if (name === 'datetime_inicio' && time && !newState.hora_fim) {
                const startTime = new Date(`1970-01-01T${time}`);
                if (!isNaN(startTime.getTime())) {
                    startTime.setHours(startTime.getHours() + 1);
                    newState.hora_fim = startTime.toTimeString().split(' ')[0].substring(0, 5);
                }
            }
            if (name === 'datetime_inicio' && date) {
                const defaults = getDefaultsFromDate(date);
                setRecorrencia(prev => ({...prev, bymonthday: defaults.bymonthday, bysetpos: defaults.bysetpos, byweekday: (prev.freq === 'monthly' && prev.monthlyType === 'relative') ? defaults.byweekday : prev.byweekday }));
            }
            setFormState(newState);
        } else {
            setFormState(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleSelectChange = (name, option) => {
        const value = option ? (Array.isArray(option) ? option.map(o => o.value).join(',') : option.value) : null;
        const newState = { ...formState, [name]: value };
        if (name === 'visibilidade_tipo') newState.visibilidade_alvo = '';
        setFormState(newState);
    };

    const handleRecorrenciaChange = (field, value) => {
        setRecorrencia(prev => {
            const newState = { ...prev, [field]: value };
            if (field === 'monthlyType') {
                const defaults = getDefaultsFromDate(formState.data_inicio);
                if (value === 'fixed') {
                    newState.byweekday = []; newState.bysetpos = defaults.bysetpos; newState.bymonthday = defaults.bymonthday;
                } else {
                    newState.bymonthday = null; newState.bysetpos = defaults.bysetpos; newState.byweekday = defaults.byweekday;
                }
            }
            if (field === 'freq' && value !== 'monthly') { newState.monthlyType = 'fixed'; }
            return newState;
        });
    };

    const toggleDiaSemana = (dia) => {
        const byweekday = recorrencia.byweekday.includes(dia) ? recorrencia.byweekday.filter(d => d !== dia) : [...recorrencia.byweekday, dia];
        setRecorrencia(prev => ({ ...prev, byweekday }));
    };

    const validateForm = () => {
        const errors = {};
        if (!formState.titulo) errors.titulo = true;
        if (!formState.descricao) errors.descricao = true;
        if (!formState.local) errors.local = true;
        if (!formState.data_inicio) errors.datetime_inicio = true;
        if (!recorrenciaAtiva) {
            if (!formState.data_fim) errors.datetime_fim = true;
            if (formState.hora_inicio && !formState.hora_fim) errors.datetime_fim = true;
        }
        if (formState.visibilidade_tipo !== 'Todos' && !formState.visibilidade_alvo) errors.visibilidade_alvo = true;
        if (recorrenciaAtiva && recorrencia.freq === 'weekly' && recorrencia.byweekday.length === 0) {
            errors.recorrencia_byweekday = true;
            setAlerta({ aberto: true, mensagem: 'Para recorrência semanal, selecione pelo menos um dia.' });
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };
    
    const handleSave = async () => {
        if (!validateForm()) return;
        let finalFormState = { ...formState };
        if (recorrenciaAtiva) {
            const rrule = { freq: recorrencia.freq };
            if (recorrencia.until) rrule.until = recorrencia.until;
            if (recorrencia.freq === 'weekly') rrule.byweekday = recorrencia.byweekday;
            else if (recorrencia.freq === 'monthly') {
                if (recorrencia.monthlyType === 'fixed') rrule.bymonthday = recorrencia.bymonthday;
                else { rrule.byweekday = recorrencia.byweekday; rrule.bysetpos = recorrencia.bysetpos; }
            }
            finalFormState.recorrencia = JSON.stringify(rrule);
            finalFormState.data_fim = null;
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

    const handleAdicionarLinhaTipo = () => {
        setLinhasTipos([...linhasTipos, { id: `new_${Date.now()}`, tipo: 'Novo Tipo', cor: '#3788d8', isNew: true }]);
    };
    const handleExcluirLinhaTipo = (rowIndex) => {
        setLinhasTipos(linhasTipos.filter((_, index) => index !== rowIndex));
    };
    const handleCellChangeTipo = (e, rowIndex, colKey) => {
        const novasLinhas = [...linhasTipos];
        novasLinhas[rowIndex][colKey] = e.target.value;
        setLinhasTipos(novasLinhas);
    };
    const handleSalvarTipos = async () => {
        const to_insert = linhasTipos.filter(l => l.isNew).map(({tipo, cor}) => ({tipo, cor}));
        const to_delete = tiposOriginais.filter(orig => !linhasTipos.some(l => l.id === orig.id));
        const to_update = linhasTipos.filter(l => {
            if (l.isNew) return false;
            const original = tiposOriginais.find(o => o.id === l.id);
            return original && (original.tipo !== l.tipo || original.cor !== l.cor);
        });
        try {
            const response = await fetch('http://127.0.0.1:5000/api/tipos_eventos/batch', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ insert: to_insert, update: to_update, delete: to_delete })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlerta({ aberto: true, mensagem: result.message });
            await fetchTiposEvento(); await fetchData();
            setModalTiposAberto(false);
        } catch (err) {
            setAlerta({ aberto: true, mensagem: `Erro ao salvar tipos: ${err.message}`});
        }
    };
    
    const visibilidadeOptions = [ {value: 'Todos', label: 'Todos'}, {value: 'Superintendência', label: 'Superintendência'}, {value: 'Núcleo', label: 'Núcleo'}, {value: 'Contrato', label: 'Contrato'}, {value: 'Pessoas Específicas', label: 'Pessoas Específicas'}, ];
    const selectStyles = { menuList: (base) => ({ ...base, maxHeight: 110 }) };
    useEffect(() => { if (recorrenciaAtiva) setFormState(p => ({...p, data_fim: ''})); }, [recorrenciaAtiva]);


    return (
        <>
            <div className="agenda-controls">
                <div className="agenda-filter">
                    <Select
                        options={optionsFiltroTipo}
                        value={optionsFiltroTipo.find(o => o.value === filtroTipoId)}
                        onChange={(opt) => setFiltroTipoId(opt ? opt.value : null)}
                        placeholder="Filtrar por tipo..."
                        isClearable
                    />
                </div>
                <div className="agenda-actions">
                    {hasPermission(currentUser, 'comunidade_agenda_cadastrar') && (
                        <button className="admin-button" onClick={handleAdicionar}>
                            <i className="bi bi-plus-circle-fill"></i> Adicionar Evento
                        </button>
                    )}
                    {hasPermission(currentUser, 'comunidade_agenda_editar') && (
                        <button className="admin-button pending-button" onClick={() => { fetchTiposEvento(); setModalTiposAberto(true); }}>
                            <i className="bi bi-palette-fill"></i> Tipos de Evento
                        </button>
                    )}
                </div>
            </div>

            <div className="calendar-container">
                {isLoading ? <p>Carregando...</p> : error ? <p style={{color: 'red'}}>{error}</p> :
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, interactionPlugin, rrulePlugin]}
                    initialView="dayGridMonth"
                    events={eventos}
                    locale='pt-br'
                    headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' }}
                    buttonText={{ today: 'Hoje', month: 'Mês', week: 'Semana' }}
                    height="auto"
                    eventClick={(info) => handleEventClick(info)}
                    datesSet={handleDatesSet}
                    eventsSet={handleEventsSet}
                />}
            </div>
            
            <div className="events-list-container">
                <h3>Eventos no Período</h3>
                <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table className="simple-data-table events-list">
                        <thead>
                            <tr>
                                <th>Nome do Evento</th>
                                <th>Tipo</th>
                                <th>Período</th>
                                <th>Local</th>
                            </tr>
                        </thead>
                        <tbody>
                            {eventosVisiveis.length > 0 ? eventosVisiveis.map(evento => (
                                <tr key={`${evento.extendedProps?.id ?? evento.id}_${evento.start ? evento.start.toISOString() : evento.startStr}`} onClick={() => handleEventClick(evento)}>
                                    <td>{evento.title}</td>
                                    <td className="event-type-cell">
                                        <div className="event-color-dot" style={{ backgroundColor: evento.backgroundColor }}></div>
                                        <span>{evento.extendedProps.tipo_nome || 'Padrão'}</span>
                                    </td>
                                    <td>{formatarPeriodo(evento)}</td>
                                    <td>{evento.extendedProps.local}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center' }}>Nenhum evento para exibir neste período.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={modalDetalheAberto} onClose={() => setModalDetalheAberto(false)} title="Detalhes do Evento">
                <h4>{eventoSelecionado?.title}</h4>
                <p>{eventoSelecionado?.extendedProps.descricao || "Sem descrição."}</p>
                <hr />
                <div className="user-form-grid">
                    <div className='filter-group'><strong>Tipo:</strong> <p>{eventoSelecionado?.extendedProps.tipo_nome || 'Padrão'}</p></div>
                    <div className='filter-group'>
                        <strong>Local:</strong> 
                        <div className="location-details">
                            <p>{eventoSelecionado?.extendedProps.local}</p>
                            {eventoSelecionado?.extendedProps.latitude && (
                                <button className="map-view-button" onClick={() => {
                                    setMapIsReadOnly(true);
                                    setMapInitialData({
                                        coords: { lat: eventoSelecionado.extendedProps.latitude, lng: eventoSelecionado.extendedProps.longitude },
                                        searchText: eventoSelecionado.extendedProps.local
                                    });
                                    setMapModalAberto(true);
                                }}>
                                    <i className="bi bi-map-fill"></i> Ver no Mapa
                                </button>
                            )}
                        </div>
                    </div>
                    <div className='filter-group'><strong>Período:</strong> <p>{formatarPeriodo(eventoSelecionado)}</p></div>
                    <div className='filter-group'><strong>Visível para:</strong> <p>{eventoSelecionado?.extendedProps.visibilidade_tipo}</p></div>
                </div>
                <div style={{marginTop: '15px'}}>
                    <small>Criado por: {eventoSelecionado?.extendedProps.criado_por_nome}</small>
                </div>
                <div className="modal-footer" style={{justifyContent: 'flex-end'}}>
                    {hasPermission(currentUser, 'comunidade_agenda_editar') && (<button className="modal-button cancel" onClick={() => handleEditar(eventoSelecionado)}>Editar</button>)}
                    {hasPermission(currentUser, 'comunidade_agenda_excluir') && (<button className="modal-button confirm" onClick={() => handleExcluir(eventoSelecionado)}>Excluir</button>)}
                </div>
            </Modal>
            
            <Modal isOpen={modalAberto} onClose={() => setModalAberto(false)} title={eventoSelecionado ? "Editar Evento" : "Adicionar Novo Evento"}>
                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <div className={`form-grid-layout ${recorrenciaAtiva ? 'recorrencia-ativa' : ''}`}>
                        <div className="form-column-left">
                             <div className="user-form-grid">
                                <div className="filter-group"><label>Título:</label><input name="titulo" value={formState.titulo || ''} onChange={handleFormChange} className={formErrors.titulo ? 'input-error' : ''} /></div>
                                 <div className="filter-group">
                                    <label>Local:</label>
                                    <div className="input-with-button">
                                        <input name="local" value={formState.local || ''} onChange={handleFormChange} className={formErrors.local ? 'input-error' : ''} />
                                        <button type="button" className="map-button" onClick={() => {
                                            setMapIsReadOnly(false);
                                            setMapInitialData({
                                                coords: { lat: formState.latitude, lng: formState.longitude },
                                                searchText: formState.local
                                            });
                                            setMapModalAberto(true);
                                        }}>
                                            <i className="bi bi-pin-map-fill"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="filter-group"><label>Descrição:</label><textarea name="descricao" value={formState.descricao || ''} onChange={handleFormChange} rows="2" className={formErrors.descricao ? 'input-error' : ''}></textarea></div>
                            <div className="user-form-grid">
                                <div className="filter-group"><label>Início:</label><input type="datetime-local" name="datetime_inicio" value={`${formState.data_inicio || ''}T${formState.hora_inicio || ''}`} onChange={handleFormChange} className={formErrors.datetime_inicio ? 'input-error' : ''} /></div>
                                <div className="filter-group"><label>Fim:</label><input type="datetime-local" name="datetime_fim" value={`${formState.data_fim || formState.data_inicio || ''}T${formState.hora_fim || ''}`} onChange={handleFormChange} className={formErrors.datetime_fim ? 'input-error' : ''} disabled={recorrenciaAtiva} /><div className="recorrencia-toggle-stacked"><label className="checkbox-label-group"><input type="checkbox" checked={recorrenciaAtiva} onChange={(e) => setRecorrenciaAtiva(e.target.checked)} /><span>Recorrente</span></label></div></div>
                            </div>
                            <div className="user-form-grid" style={{marginTop: '15px'}}>
                                <div className="filter-group"><label>Tipo de Evento:</label><Select options={tiposEvento.map(t => ({ value: t.id, label: t.tipo }))} styles={selectStyles} value={tiposEvento.map(t => ({ value: t.id, label: t.tipo })).find(o => o.value === formState.tipo_id)} onChange={(opt) => handleSelectChange('tipo_id', opt)} placeholder="Padrão" isClearable /></div>
                                <div className="filter-group"><label>Visível para:</label><Select options={visibilidadeOptions} styles={selectStyles} value={visibilidadeOptions.find(o => o.value === formState.visibilidade_tipo)} onChange={(opt) => handleSelectChange('visibilidade_tipo', opt)} /></div>
                            </div>
                            <div className="user-form-grid" style={{gridTemplateColumns: '1fr'}}>
                                <div className="filter-group"><label>Alvo específico:</label><Select options={alvoOptions} styles={selectStyles} isMulti isDisabled={formState.visibilidade_tipo === 'Todos'} value={alvoOptions.filter(o => formState.visibilidade_alvo?.split(',').includes(String(o.value)))} onChange={(opts) => handleSelectChange('visibilidade_alvo', opts)} className={formErrors.visibilidade_alvo ? 'select-error' : ''} /></div>
                            </div>
                        </div>

                        {recorrenciaAtiva && ( <div className="form-column-right">
                            <h4>Opções de Recorrência</h4>
                            <div className="filter-group"><label>Frequência:</label><Select options={frequenciaOptions} styles={selectStyles} value={frequenciaOptions.find(o => o.value === recorrencia.freq)} onChange={(opt) => handleRecorrenciaChange('freq', opt.value)} /></div>
                            <div className="filter-group"><label>Repetir até (opcional):</label><input type="date" value={recorrencia.until || ''} onChange={(e) => handleRecorrenciaChange('until', e.target.value)} /></div>
                            {recorrencia.freq === 'weekly' && (<div className="filter-group"><label>Nos dias:</label><div className="dias-semana-group">{diasSemanaOptions.map(dia => (<button key={dia.value} type="button" className={`dia-semana-btn ${recorrencia.byweekday.includes(dia.value) ? 'selected' : ''}`} onClick={() => toggleDiaSemana(dia.value)}>{dia.label}</button>))}</div></div>)}
                            {recorrencia.freq === 'monthly' && (<div className="filter-group">
                                <label>Tipo de repetição:</label>
                                <div className="radio-group">
                                    <label><input type="radio" value="fixed" checked={recorrencia.monthlyType === 'fixed'} onChange={() => handleRecorrenciaChange('monthlyType', 'fixed')} />Data fixa</label>
                                    <label><input type="radio" value="relative" checked={recorrencia.monthlyType === 'relative'} onChange={() => handleRecorrenciaChange('monthlyType', 'relative')} />Data relativa</label>
                                </div>
                                {recorrencia.monthlyType === 'fixed' ? (<div className="monthly-options-container">
                                    <div className="monthly-options-grid"><span>Repetir todo dia:</span><input type="number" min="1" max="31" value={recorrencia.bymonthday || ''} onChange={e => handleRecorrenciaChange('bymonthday', parseInt(e.target.value, 10))} /></div>
                                    {recorrencia.bymonthday >= 29 && <p className="warning-message">Aviso: Meses sem o dia {recorrencia.bymonthday} serão pulados. Para garantir a recorrência, use a opção "Data Relativa" com "Último(a)".</p>}
                                </div>) : (<div className="monthly-options-container">
                                    <div className="monthly-options-grid">
                                        <div className='select-container-small'><Select options={monthlyPositionOptions} styles={selectStyles} value={monthlyPositionOptions.find(o => o.value === recorrencia.bysetpos)} onChange={opt => handleRecorrenciaChange('bysetpos', opt.value)} /></div>
                                        <div className='select-container'><Select options={monthlyWeekdayOptions} styles={selectStyles} value={monthlyWeekdayOptions.find(o => o.value === (recorrencia.byweekday ? recorrencia.byweekday[0] : null))} onChange={opt => handleRecorrenciaChange('byweekday', [opt.value])} /></div>
                                    </div>
                                    {recorrencia.bysetpos === 5 && <p className="warning-message">Aviso: Meses sem a 5ª ocorrência serão pulados. Para agendar na última ocorrência, selecione 'Último(a)'.</p>}
                                </div>)}
                            </div>)}
                        </div>)}
                    </div>
                    <div className="modal-footer" style={{ borderTop: '1px solid #eee', paddingTop: '15px', marginTop: '20px' }}> <div></div>
                        <div><button type="button" className="modal-button cancel" onClick={() => setModalAberto(false)}>Cancelar</button><button type="submit" className="modal-button confirm" style={{backgroundColor: '#27ae60'}}>Salvar</button></div>
                    </div>
                    {Object.keys(formErrors).length > 0 && <p className="error-message"><i className="bi bi-exclamation-triangle-fill" style={{ marginRight: '6px' }}></i>Todos os campos obrigatórios precisam ser preenchidos</p>}
                </form>
            </Modal>
            
            <Modal isOpen={modalTiposAberto} onClose={() => setModalTiposAberto(false)} title="Gerenciar Tipos de Evento" size="large">
                <div className="table-container editable-container" style={{ height: '50vh' }}>
                    <table className="simple-data-table editable">
                        <thead>
                            <tr><th>Tipo</th><th>Cor</th><th className="action-column"></th></tr>
                        </thead>
                        <tbody>
                            {linhasTipos.map((row, rowIndex) => (
                                <tr key={row.id} onMouseEnter={() => setHoveredRowTipo(rowIndex)} onMouseLeave={() => setHoveredRowTipo(null)}>
                                    <td onClick={() => setEditingCellTipo({ rowIndex, colKey: 'tipo' })}>
                                        {editingCellTipo.rowIndex === rowIndex && editingCellTipo.colKey === 'tipo' ? (
                                            <input type="text" value={row.tipo} onChange={(e) => handleCellChangeTipo(e, rowIndex, 'tipo')} onBlur={() => setEditingCellTipo({ rowIndex: null, colKey: null })} autoFocus />
                                        ) : row.tipo}
                                    </td>
                                    <td onClick={() => setEditingCellTipo({ rowIndex, colKey: 'cor' })}>
                                        {editingCellTipo.rowIndex === rowIndex && editingCellTipo.colKey === 'cor' ? (
                                            <input type="color" value={row.cor} onChange={(e) => handleCellChangeTipo(e, rowIndex, 'cor')} onBlur={() => setEditingCellTipo({ rowIndex: null, colKey: null })} autoFocus />
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '20px', height: '20px', backgroundColor: row.cor, border: '1px solid #ccc', borderRadius: '4px' }}></div>
                                                <span>{row.cor}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="action-column">
                                        {hoveredRowTipo === rowIndex && (
                                            <button className="delete-row-btn" onClick={() => handleExcluirLinhaTipo(rowIndex)}><i className="bi bi-trash"></i></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {showInsertPreview && <tr className="insert-preview-row"><td colSpan={3}></td></tr>}
                        </tbody>
                    </table>
                    <button className="add-row-btn" onClick={handleAdicionarLinhaTipo} onMouseEnter={() => setShowInsertPreview(true)} onMouseLeave={() => setShowInsertPreview(false)}>+</button>
                </div>
                <div className="modal-footer">
                    <div></div>
                    <div>
                        <button type="button" className="modal-button cancel" onClick={() => setModalTiposAberto(false)}>Cancelar</button>
                        <button type="button" className="modal-button confirm" style={{ backgroundColor: '#27ae60' }} onClick={handleSalvarTipos}>Salvar Alterações</button>
                    </div>
                </div>
            </Modal>

            <ModalConfirmacao isOpen={!!eventoParaExcluir} onClose={() => setEventoParaExcluir(null)} onConfirm={handleDeleteConfirm} title="Confirmar Exclusão">
                <p>Você tem certeza que deseja excluir o evento: <strong>{eventoParaExcluir?.title}</strong></p>
            </ModalConfirmacao>
            
            <ModalAlerta isOpen={alerta.aberto} onClose={() => setAlerta({ aberto: false, mensagem: '' })} title="Notificação"><p>{alerta.mensagem}</p></ModalAlerta>
        
            {/* --- Renderiza o modal do mapa --- */}
            <ModalMapa
                isOpen={mapModalAberto}
                onClose={() => setMapModalAberto(false)}
                onLocationSelect={(coords) => {
                    if (coords) {
                        setFormState(prev => ({ ...prev, latitude: coords.lat, longitude: coords.lng }));
                    }
                }}
                initialCoords={mapInitialData.coords}
                initialSearchText={mapInitialData.searchText}
                isReadOnly={mapIsReadOnly}
            />
        </>
    );
};

export default TabAgenda;
