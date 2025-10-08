import React, { useState, useEffect, useRef, useMemo } from 'react';
import html2canvas from 'html2canvas';
import DOMPurify from 'dompurify';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import Modal from '../../components/Modal.jsx';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';
import ModalAlerta from '../../components/ModalAlerta.jsx';
import ModalInstrucoesHTML from '../../components/ModalInstrucoesHTML.jsx'; // Importa o novo modal

// Função auxiliar para checar permissões
const hasPermission = (user, permission) => {
    if (!user || !user.permissoes) return false;
    if (user.perfil_id === 'master_admin') return true;
    return user.permissoes.includes(permission);
};

// Componente para o menu flutuante de compartilhamento
const ShareMenu = ({ anuncio, onSave, onCopyImage, onCopyLink }) => {
    return (
        <div className="share-menu-container">
            <div className="share-menu-item" onClick={onSave}>
                <i className="bi bi-download"></i> Salvar imagem
            </div>
            <div className="share-menu-item" onClick={onCopyImage}>
                <i className="bi bi-clipboard-check"></i> Copiar imagem
            </div>
            {anuncio.link && (
                <div className="share-menu-item" onClick={onCopyLink}>
                    <i className="bi bi-link-45deg"></i> Copiar hiperlink
                </div>
            )}
        </div>
    );
};


const TabAnuncios = ({ currentUser }) => {
    const [anuncios, setAnuncios] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [alerta, setAlerta] = useState({ aberto: false, mensagem: '' });
    
    const [modalAberto, setModalAberto] = useState(false);
    const [anuncioSelecionado, setAnuncioSelecionado] = useState(null);
    const [tipoAnuncio, setTipoAnuncio] = useState('imagem');
    const [arquivo, setArquivo] = useState(null);
    const [preview, setPreview] = useState(null);
    const [conteudoHtml, setConteudoHtml] = useState('');
    const [link, setLink] = useState('');
    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    
    const [programarAnuncio, setProgramarAnuncio] = useState(false);
    const [dataPublicacao, setDataPublicacao] = useState('');
    const [filtroData, setFiltroData] = useState({
        mes: new Date().getMonth() + 1,
        ano: new Date().getFullYear()
    });

    const [cropModalAberto, setCropModalAberto] = useState(false);
    const [imgSrc, setImgSrc] = useState('');
    const imgRef = useRef(null);
    const previewCanvasRef = useRef(null);
    const [crop, setCrop] = useState();
    const [completedCrop, setCompletedCrop] = useState(null);
    const ASPECT_RATIO = 16 / 9;

    const contentRefs = useRef(new Map());
    const shareMenuRef = useRef(null);
    const [anuncioParaExcluir, setAnuncioParaExcluir] = useState(null);
    const [openShareMenu, setOpenShareMenu] = useState(null);

    // Estado para o novo modal de instruções
    const [instrucoesModalAberto, setInstrucoesModalAberto] = useState(false);

    const validarLink = (url) => {
        if (!url) return true;
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch (e) { return false; }
    };

    const fetchAnuncios = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('http://127.0.0.1:5000/api/anuncios');
            if (!response.ok) throw new Error('Falha ao buscar anúncios');
            const data = await response.json();
            setAnuncios(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAnuncios();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (openShareMenu !== null && shareMenuRef.current && !shareMenuRef.current.contains(event.target)) {
                setOpenShareMenu(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [openShareMenu]);
    
    useEffect(() => {
        return () => {
            if (contentRefs.current) contentRefs.current.clear();
            shareMenuRef.current = null;
        };
    }, []);

    const resetForm = () => {
        setAnuncioSelecionado(null);
        setTipoAnuncio('imagem');
        setArquivo(null);
        setPreview(null);
        setConteudoHtml('');
        setLink('');
        setProgramarAnuncio(false);
        setDataPublicacao('');
        if (fileInputRef.current) fileInputRef.current.value = null;
    };

    const handleAdicionar = () => {
        resetForm();
        setModalAberto(true);
    };
    
    const getFilenameFromPath = (path) => {
        if (!path) return '';
        return path.split('/').pop();
    };

    const handleEditar = (anuncio) => {
        setAnuncioSelecionado(anuncio);
        setTipoAnuncio(anuncio.tipo);
        setConteudoHtml(anuncio.tipo === 'html' ? anuncio.conteudo : '');
        setLink(anuncio.link || '');
        if (anuncio.data_publicacao) {
            setProgramarAnuncio(true);
            setDataPublicacao(anuncio.data_publicacao.replace(' ', 'T').slice(0, 16));
        } else {
            setProgramarAnuncio(false);
            setDataPublicacao('');
        }
        if (anuncio.tipo === 'imagem') {
            const filename = getFilenameFromPath(anuncio.conteudo);
            setPreview(`http://127.0.0.1:5000/api/anuncios/images/${filename}?t=${new Date().getTime()}`);
        } else {
            setPreview(null);
        }
        setArquivo(null);
        if (fileInputRef.current) fileInputRef.current.value = null;
        setModalAberto(true);
    };
    
    const handleFileSelect = (file) => {
        if (file && file.type.startsWith('image/')) {
            setCrop(undefined);
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImgSrc(reader.result?.toString() || '');
                setCropModalAberto(true);
            });
            reader.readAsDataURL(file);
        } else {
            setAlerta({ aberto: true, mensagem: 'Por favor, selecione um arquivo de imagem válido.' });
        }
    };

    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleSalvarAnuncio = async () => {
        if (!validarLink(link)) {
            setAlerta({ aberto: true, mensagem: 'Por favor, insira um link válido (começando com http:// ou https://).' });
            return;
        }
        if (programarAnuncio && !dataPublicacao) {
            setAlerta({ aberto: true, mensagem: 'Por favor, selecione a data e hora para a publicação.' });
            return;
        }

        const formData = new FormData();
        formData.append('criado_por_id', currentUser.id);
        formData.append('tipo', tipoAnuncio);
        formData.append('link', link);
        formData.append('data_publicacao', programarAnuncio ? dataPublicacao : '');

        if (tipoAnuncio === 'imagem') {
            if (!arquivo && !anuncioSelecionado) {
                setAlerta({ aberto: true, mensagem: 'Por favor, selecione uma imagem.' });
                return;
            }
            if (arquivo) formData.append('file', arquivo);
        } else {
            if (!conteudoHtml.trim()) {
                setAlerta({ aberto: true, mensagem: 'O conteúdo HTML não pode estar vazio.' });
                return;
            }
            const safeHtml = DOMPurify.sanitize(conteudoHtml);
            formData.append('conteudo', safeHtml);
        }

        const isEditing = !!anuncioSelecionado;
        const url = isEditing ? `http://127.0.0.1:5000/api/anuncios/${anuncioSelecionado.id}` : 'http://127.0.0.1:5000/api/anuncios';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            setIsLoading(true);
            const response = await fetch(url, { method, body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Erro desconhecido');
            setAlerta({ aberto: true, mensagem: result.message });
            await fetchAnuncios();
            setModalAberto(false);
            resetForm();
        } catch (err) {
            setAlerta({ aberto: true, mensagem: `Erro: ${err.message}` });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!anuncioParaExcluir) return;
        try {
            setIsLoading(true);
            const response = await fetch(`http://127.0.0.1:5000/api/anuncios/${anuncioParaExcluir.id}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Erro desconhecido');
            setAlerta({ aberto: true, mensagem: result.message });
            fetchAnuncios();
        } catch (err) {
            setAlerta({ aberto: true, mensagem: `Erro: ${err.message}` });
        } finally {
            setIsLoading(false);
            setAnuncioParaExcluir(null);
        }
    };

    const handleSaveOrCopy = async (anuncio, action) => {
        setOpenShareMenu(null);
        const element = contentRefs.current.get(anuncio.id);
        if (!element) {
            setAlerta({ aberto: true, mensagem: 'Conteúdo do anúncio não disponível para exportar.' });
            return;
        }
        const overlay = element.querySelector('.anuncio-actions-overlay');
        if (overlay) overlay.style.visibility = 'hidden';
        try {
            const canvas = await html2canvas(element, { useCORS: true, backgroundColor: null, scale: 2 });
            if (action === 'save') {
                canvas.toBlob((blob) => {
                    if (!blob) { setAlerta({ aberto: true, mensagem: 'Erro ao gerar imagem.' }); return; }
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `anuncio_${anuncio.id}.png`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                    setAlerta({ aberto: true, mensagem: 'Download da imagem iniciado!' });
                }, 'image/png');
            } else if (action === 'copy') {
                canvas.toBlob(async (blob) => {
                    if (!blob) { setAlerta({ aberto: true, mensagem: 'Erro ao processar imagem.' }); return; }
                    try {
                        if (navigator.clipboard && window.ClipboardItem) {
                            await navigator.clipboard.write([ new ClipboardItem({ [blob.type]: blob }) ]);
                            setAlerta({ aberto: true, mensagem: 'Imagem copiada!' });
                        } else {
                            setAlerta({ aberto: true, mensagem: 'Seu navegador não suporta copiar imagens.' });
                        }
                    } catch (err) { setAlerta({ aberto: true, mensagem: 'Falha ao copiar a imagem.' }); }
                }, 'image/png');
            }
        } catch (err) {
            setAlerta({ aberto: true, mensagem: 'Não foi possível processar a imagem.' });
        } finally {
            if (overlay) overlay.style.visibility = 'visible';
        }
    };
    
    const handleCopyLink = (linkUrl) => {
        setOpenShareMenu(null);
        if (!linkUrl) { setAlerta({ aberto: true, mensagem: 'Não há link para copiar.' }); return; }
        navigator.clipboard.writeText(linkUrl).then(() => {
            setAlerta({ aberto: true, mensagem: 'Link copiado!' });
        }, () => {
            setAlerta({ aberto: true, mensagem: 'Falha ao copiar o link.' });
        });
    };
    
    const onImageLoad = (e) => {
        const { width, height } = e.currentTarget;
        const crop = centerCrop(
            makeAspectCrop({ unit: '%', width: 90 }, ASPECT_RATIO, width, height),
            width, height
        );
        setCrop(crop);
    };

    const handleCropConfirm = () => {
        if (!completedCrop || !previewCanvasRef.current || !imgRef.current) return;
        
        const image = imgRef.current;
        const canvas = previewCanvasRef.current;
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        canvas.width = Math.floor(completedCrop.width * scaleX);
        canvas.height = Math.floor(completedCrop.height * scaleY);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
            image,
            completedCrop.x * scaleX, completedCrop.y * scaleY,
            completedCrop.width * scaleX, completedCrop.height * scaleY,
            0, 0, canvas.width, canvas.height
        );

        canvas.toBlob((blob) => {
            if (!blob) { console.error('Canvas is empty'); return; }
            const croppedFile = new File([blob], 'cropped_anuncio.png', { type: 'image/png' });
            setArquivo(croppedFile);
            setPreview(URL.createObjectURL(blob));
            setCropModalAberto(false);
        }, 'image/png', 1);
    };

    const getPublicationDate = (anuncio) => new Date(anuncio.data_publicacao || anuncio.data_criacao);

    const groupedAnuncios = useMemo(() => {
        const now = new Date();
        const isAdmin = currentUser.perfil_id === 'master_admin';
        const filtered = anuncios.filter(anuncio => {
            const pubDate = getPublicationDate(anuncio);
            const isVisible = isAdmin || !anuncio.data_publicacao || pubDate <= now;
            if (!isVisible) return false;
            const matchesFilter = pubDate.getFullYear() === filtroData.ano && (pubDate.getMonth() + 1) === filtroData.mes;
            return matchesFilter;
        });

        return filtered.reduce((acc, anuncio) => {
            const dateKey = getPublicationDate(anuncio).toISOString().split('T')[0];
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(anuncio);
            return acc;
        }, {});
    }, [anuncios, filtroData, currentUser]);

    const sortedDates = Object.keys(groupedAnuncios).sort((a, b) => new Date(b) - new Date(a));
    
    const formatarDataCabecalho = (dateString) => {
        const data = new Date(dateString + 'T00:00:00');
        return new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'full',
        }).format(data);
    };

    const anosDisponiveis = [...new Set(anuncios.map(a => getPublicationDate(a).getFullYear()))].sort((a,b) => b-a);
    const mesesDisponiveis = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    return (
        <>
            <div className="admin-actions-bar">
                <div className="anuncios-filter-bar">
                    <label>Filtrar por:</label>
                    <select value={filtroData.mes} onChange={(e) => setFiltroData(prev => ({...prev, mes: parseInt(e.target.value)}))}>
                        {mesesDisponiveis.map((mes, index) => <option key={mes} value={index + 1}>{mes}</option>)}
                    </select>
                    <select value={filtroData.ano} onChange={(e) => setFiltroData(prev => ({...prev, ano: parseInt(e.target.value)}))}>
                        {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
                    </select>
                </div>

                {hasPermission(currentUser, 'comunidade_anuncios_cadastrar') && (
                    <button className="admin-button" onClick={handleAdicionar}>
                        <i className="bi bi-plus-circle-fill"></i> Adicionar Anúncio
                    </button>
                )}
            </div>

            {isLoading && <p>Carregando anúncios...</p>}
            {error && <p style={{color: 'red'}}>{error}</p>}
            
            {!isLoading && sortedDates.length === 0 && (
                <p style={{textAlign: 'center', marginTop: '40px'}}>Nenhum anúncio encontrado para este período.</p>
            )}

            {sortedDates.map(date => (
                <React.Fragment key={date}>
                    <h2 className="anuncio-date-header">{formatarDataCabecalho(date)}</h2>
                    <div className="anuncios-grid">
                        {groupedAnuncios[date].map(anuncio => {
                            const filename = anuncio.tipo === 'imagem' ? getFilenameFromPath(anuncio.conteudo) : '';
                            return (
                                <div key={anuncio.id} className="anuncio-card">
                                    {anuncio.data_publicacao && new Date(anuncio.data_publicacao) > new Date() && (
                                        <div className="anuncio-agendado-tag">
                                            <i className="bi bi-clock-fill"></i> Agendado
                                        </div>
                                    )}
                                    <div className="anuncio-card-body" ref={el => { if (el) contentRefs.current.set(anuncio.id, el); else contentRefs.current.delete(anuncio.id); }}>
                                        {anuncio.tipo === 'imagem' ? (
                                            <img src={`http://127.0.0.1:5000/api/anuncios/images/${filename}?t=${new Date().getTime()}`} alt="Anúncio" />
                                        ) : (
                                            <div className="anuncio-card-content html-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(anuncio.conteudo) }}></div>
                                        )}
                                         <div className="anuncio-actions-overlay">
                                            <div className="share-menu-wrapper" ref={el => { if (openShareMenu === anuncio.id) shareMenuRef.current = el; }}>
                                                <button className="anuncio-action-btn" onClick={() => setOpenShareMenu(openShareMenu === anuncio.id ? null : anuncio.id)}>
                                                    <i className="bi bi-share-fill"></i> Compartilhar
                                                </button>
                                                {openShareMenu === anuncio.id && (
                                                    <ShareMenu anuncio={anuncio} onSave={() => handleSaveOrCopy(anuncio, 'save')} onCopyImage={() => handleSaveOrCopy(anuncio, 'copy')} onCopyLink={() => handleCopyLink(anuncio.link)} />
                                                )}
                                            </div>
                                            {anuncio.link && (
                                                <a href={anuncio.link} target="_blank" rel="noopener noreferrer" className="anuncio-action-btn">
                                                    Saiba mais <i className="bi bi-link-45deg"></i>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div className="anuncio-card-footer">
                                       <span>Postado por {anuncio.criado_por_nome || 'Desconhecido'} em {new Date(anuncio.data_criacao).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                    <div className="anuncio-top-actions">
                                         {hasPermission(currentUser, 'comunidade_anuncios_editar') && (<button className="anuncio-icon-btn" onClick={() => handleEditar(anuncio)}><i className="bi bi-pencil-fill"></i></button>)}
                                        {hasPermission(currentUser, 'comunidade_anuncios_excluir') && (<button className="anuncio-icon-btn" onClick={() => setAnuncioParaExcluir(anuncio)}><i className="bi bi-trash"></i></button>)}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </React.Fragment>
            ))}

            <Modal isOpen={modalAberto} onClose={() => setModalAberto(false)} title={anuncioSelecionado ? "Editar Anúncio" : "Criar Novo Anúncio"} size='large'>
                <div className="anuncio-form-container">
                    <div className="radio-group"><label><input type="radio" value="imagem" checked={tipoAnuncio === 'imagem'} onChange={() => setTipoAnuncio('imagem')} />Anúncio com Imagem</label><label><input type="radio" value="html" checked={tipoAnuncio === 'html'} onChange={() => setTipoAnuncio('html')} />Anúncio com HTML</label></div>
                    {tipoAnuncio === 'imagem' ? (
                        <div>
                            <div className={`upload-area ${isDragging ? 'drag-over' : ''}`} onClick={() => fileInputRef.current && fileInputRef.current.click()} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
                                <input type="file" id="file-input" ref={fileInputRef} accept="image/*" onChange={(e) => { const f = e.target.files[0]; handleFileSelect(f); e.target.value = null; }} />
                                <p>Arraste e solte uma imagem aqui, ou <span className="browse-link">clique para selecionar</span>.</p>
                                {anuncioSelecionado && <small style={{marginTop: '10px', display: 'block'}}>Deixe em branco para manter a imagem atual.</small>}
                            </div>
                            {preview && <img src={preview} alt="Pré-visualização" className="image-preview" />}
                        </div>
                    ) : (
                        <div>
                            <div className="html-input-header">
                                <label>Cole seu código HTML abaixo:</label>
                                <button type="button" className="help-button" onClick={() => setInstrucoesModalAberto(true)}>?</button>
                            </div>
                            <textarea value={conteudoHtml} onChange={(e) => setConteudoHtml(e.target.value)} placeholder="<div>Seu anúncio aqui...</div>"></textarea>
                        </div>
                    )}
                    <div className="filter-group" style={{marginTop: '20px'}}><label>Link de "Saiba mais" (opcional):</label><input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://exemplo.com" /></div>
                    
                    <div className="filter-group" style={{marginTop: '20px'}}>
                        <label className="checkbox-label-group">
                            <input type="checkbox" checked={programarAnuncio} onChange={(e) => { setProgramarAnuncio(e.target.checked); if (!e.target.checked) setDataPublicacao(''); }} />
                            <span>Programar anúncio</span>
                        </label>
                    </div>
                    {programarAnuncio && (
                        <div className="filter-group">
                            <label>Data de Publicação:</label>
                            <input type="datetime-local" value={dataPublicacao} onChange={(e) => setDataPublicacao(e.target.value)} />
                        </div>
                    )}
                </div>
                 <div className="modal-footer" style={{ borderTop: '1px solid #eee', paddingTop: '15px', marginTop: '20px' }}> <div></div>
                    <div><button type="button" className="modal-button cancel" onClick={() => setModalAberto(false)}>Cancelar</button><button type="button" className="modal-button confirm" style={{backgroundColor: '#27ae60'}} onClick={handleSalvarAnuncio}>Salvar Anúncio</button></div>
                </div>
            </Modal>
            
            <Modal isOpen={cropModalAberto} onClose={() => setCropModalAberto(false)} title="Recortar Imagem" size="large">
                <div className="crop-modal-container">
                    <p>Ajuste a área de recorte para a melhor visualização.</p>
                    {imgSrc && (
                        <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
                            aspect={ASPECT_RATIO}
                            minWidth={200}
                        >
                            <img ref={imgRef} src={imgSrc} onLoad={onImageLoad} alt="Recortar"/>
                        </ReactCrop>
                    )}
                </div>
                <div className="modal-footer" style={{ borderTop: '1px solid #eee', paddingTop: '15px', marginTop: '20px' }}>
                     <div></div>
                    <div>
                        <button type="button" className="modal-button cancel" onClick={() => setCropModalAberto(false)}>Cancelar</button>
                        <button type="button" className="modal-button confirm" style={{backgroundColor: '#27ae60'}} onClick={handleCropConfirm}>Confirmar Recorte</button>
                    </div>
                </div>
            </Modal>
            
            <div style={{ display: 'none' }}>
                <canvas ref={previewCanvasRef} />
            </div>

            <ModalConfirmacao isOpen={!!anuncioParaExcluir} onClose={() => setAnuncioParaExcluir(null)} onConfirm={handleDeleteConfirm} title="Confirmar Exclusão">
                <p>Você tem certeza que deseja excluir este anúncio?</p>
            </ModalConfirmacao>
            
            <ModalAlerta isOpen={alerta.aberto} onClose={() => setAlerta({ aberto: false, mensagem: '' })} title="Notificação">
                <p>{alerta.mensagem}</p>
            </ModalAlerta>
            
            <ModalInstrucoesHTML isOpen={instrucoesModalAberto} onClose={() => setInstrucoesModalAberto(false)} />
        </>
    );
};

export default TabAnuncios;

