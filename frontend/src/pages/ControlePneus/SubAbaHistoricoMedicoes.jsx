import React, { useState, useEffect } from 'react';
// Importa o componente Modal padrão
import Modal from '../../components/Modal.jsx';
// Importa os componentes de conteúdo dos modais
import ModalDetalhamentoEquipamento from './ModalDetalhamentoEquipamento.jsx';
import ModalDetalhamentoPneus from './ModalDetalhamentoPneus.jsx';

const API_BASE_URL = 'http://127.0.0.1:5000';

function SubAbaHistoricoMedicoes({ isActive }) {
    const [historicoData, setHistoricoData] = useState({ meses: [], dados: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Estado para o menu de contexto
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, selectedRow: null });
    // Estados para os modais de detalhamento
    const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
    const [isPneuModalOpen, setIsPneuModalOpen] = useState(false);
    // NOVO: Estado para armazenar os dados da linha selecionada para os modais
    const [modalData, setModalData] = useState(null);


    // Hook para fechar o menu de contexto
    useEffect(() => {
        const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, selectedRow: null });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    useEffect(() => {
        const fetchHistorico = async () => {
            if (!isActive) return;
            setIsLoading(true);
            try {
                const response = await fetch(`${API_BASE_URL}/api/pneus/historico-medicoes`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.details || 'Falha ao buscar histórico de medições.');
                }
                const data = await response.json();
                setHistoricoData(data);
                setError(null);
            } catch (err) {
                setError(err.message);
                setHistoricoData({ meses: [], dados: [] });
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistorico();
    }, [isActive]);

    // Handler para o clique com o botão direito na tabela
    const handleContextMenu = (event, row) => {
        event.preventDefault();
        setContextMenu({
            visible: true,
            x: event.pageX,
            y: event.pageY,
            selectedRow: row // Armazena a linha inteira selecionada
        });
    };

    // Handlers para abrir os modais
    const handleOpenEquipModal = () => {
        if (contextMenu.selectedRow) {
            setModalData(contextMenu.selectedRow); // Armazena os dados da linha
            setIsEquipModalOpen(true);
            setContextMenu({ visible: false, x:0, y:0, selectedRow: null }); // Fecha o menu
        }
    };

    const handleOpenPneuModal = () => {
        if (contextMenu.selectedRow) {
            setModalData(contextMenu.selectedRow); // Armazena os dados da linha
            setIsPneuModalOpen(true);
            setContextMenu({ visible: false, x:0, y:0, selectedRow: null }); // Fecha o menu
        }
    };

    // Função para fechar e limpar dados do modal
    const closeEquipModal = () => {
        setIsEquipModalOpen(false);
        setModalData(null);
    };
    const closePneuModal = () => {
        setIsPneuModalOpen(false);
        setModalData(null);
    };


    const renderCelulasMedicao = (linha) => {
        let celulas = [];
        historicoData.meses.forEach(mes => {
            for (let semana = 1; semana <= mes.num_semanas; semana++) {
                const chave = `${mes.mes}-${semana}`;
                const contagem = linha.medicoes[chave] || 0;
                const statusIcon = contagem > 0
                    ? <div className="status-circle green" title={`${contagem} medição(ões)`}></div>
                    : <div className="status-circle red" title="Nenhuma medição"></div>;

                celulas.push(<td key={chave} className="history-cell">{statusIcon}</td>);
            }
        });
        return celulas;
    };

    if (isLoading) return <p>Carregando histórico...</p>;
    if (error) return <div className="error-message">Erro ao carregar dados: {error}</div>;

    return (
        <div className="card" style={{ width: '1380px'}}>
            <h2>Histórico de Medições por Semana</h2>
            <div className="history-table-wrapper">
                <table className="history-table">
                    <thead>
                        <tr>
                            <th className="sticky-col">Equipamento</th>
                            <th className="sticky-col col2">Nº Fogo</th>
                            {historicoData.meses.map(mes => (
                                <th key={mes.mes} colSpan={mes.num_semanas} className="month-header">
                                    {mes.mes}
                                </th>
                            ))}
                        </tr>
                        <tr>
                            <th className="sticky-col"></th>
                            <th className="sticky-col col2"></th>
                            {historicoData.meses.map(mes => (
                                Array.from({ length: mes.num_semanas }, (_, i) => i + 1).map(semana => (
                                    <th key={`${mes.mes}-${semana}`} className="week-header">{semana}</th>
                                ))
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {historicoData.dados.map((linha, index) => (
                            // Adiciona o handler onContextMenu a cada linha (tr)
                            <tr
                                key={`${linha.equipamento}-${linha.num_fogo}-${index}`}
                                onContextMenu={(e) => handleContextMenu(e, linha)}
                            >
                                <td className="sticky-col">{linha.equipamento}</td>
                                <td className="sticky-col col2">{linha.num_fogo}</td>
                                {renderCelulasMedicao(linha)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {historicoData.dados.length === 0 && !isLoading && (
                <p style={{ textAlign: 'center', padding: '20px' }}>Nenhum histórico de medição encontrado.</p>
            )}

            {/* Renderiza o menu de contexto */}
            {contextMenu.visible && (
                <div className="context-menu-container" style={{ top: contextMenu.y, left: contextMenu.x }}>
                    <div className="context-menu-item" onClick={handleOpenEquipModal}>
                        <i className="bi bi-truck"></i> Detalhamento do Equipamento
                    </div>
                    <div className="context-menu-item" onClick={handleOpenPneuModal}>
                        <i className="bi bi-gear-wide-connected"></i> Detalhamento do Pneu
                    </div>
                </div>
            )}

           {/* Modal de Equipamento */}
           <Modal
                isOpen={isEquipModalOpen}
                onClose={closeEquipModal} // Usa a nova função de fechar
                title={`Layout do Equipamento: ${modalData?.equipamento || ''}`}
                size="default"
            >
                {/* Renderiza o conteúdo APENAS se modalData existir */}
                {modalData && (
                    <ModalDetalhamentoEquipamento
                        equipamento={{ equipamento: modalData.equipamento }}
                        onCancel={closeEquipModal}
                    />
                )}
            </Modal>

            {/* Modal de Pneu */}
            <Modal
                isOpen={isPneuModalOpen}
                onClose={closePneuModal} // Usa a nova função de fechar
                 // O título será definido dinamicamente dentro do ModalDetalhamentoPneus
                size="xl"
            >
                 {/* Renderiza o conteúdo APENAS se modalData existir */}
                 {modalData && (
                     <ModalDetalhamentoPneus
                        pneuSelecionado={{
                            numero: '', // Não temos a posição nesta tabela
                            // Passa apenas o num_fogo, o modal buscará o resto
                            dados: { num_fogo: modalData.num_fogo }
                        }}
                        isOpen={isPneuModalOpen} // Passa isOpen para lógica interna
                        onClose={closePneuModal}
                    />
                 )}
            </Modal>
        </div>
    );
}

export default SubAbaHistoricoMedicoes;

