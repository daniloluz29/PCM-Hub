import React, { useState, useEffect } from 'react';
import Modal from './Modal.jsx';
import ModalAlerta from './ModalAlerta.jsx';

// Define os tipos de notificações estratégicas que o admin pode controlar
const TIPOS_NOTIFICACAO = [
    { id: 'cadastro_aprovado', label: 'Novo cadastro de usuário aprovado' },
    { id: 'solicitacao_cadastro', label: 'Nova solicitação de cadastro recebida' },
    { id: 'alteracao_perfil_admin', label: 'Alteração de perfil de acesso de um usuário' },
    { id: 'cadastro_cc', label: 'Criação de novo Centro de Custo' },
    { id: 'edicao_cc', label: 'Edição de Centro de Custo' },
    { id: 'exclusao_cc', label: 'Exclusão de Centro de Custo' },
    { id: 'cadastro_nf', label: 'Criação de nova Natureza Financeira' },
    { id: 'edicao_nf', label: 'Edição de Natureza Financeira' },
    { id: 'exclusao_nf', label: 'Exclusão de Natureza Financeira' },
    { id: 'alteracao_faixas', label: 'Alteração na tabela de Faixas' },
    { id: 'criacao_perfil', label: 'Criação de novo Perfil de Acesso' },
    { id: 'edicao_permissao_perfil', label: 'Edição de permissões de um Perfil' },
    { id: 'exclusao_perfil', label: 'Exclusão de Perfil de Acesso' },
];

function ModalNotificacoesControle({ isOpen, onClose, currentUser }) {
    const [configs, setConfigs] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [alerta, setAlerta] = useState({ isOpen: false, message: '' });

    useEffect(() => {
        if (isOpen) {
            const fetchConfigs = async () => {
                setIsLoading(true);
                try {
                    const response = await fetch(`http://127.0.0.1:5000/api/notificacoes/config/${currentUser.id}`);
                    const data = await response.json();
                    setConfigs(data);
                } catch (error) {
                    console.error("Erro ao buscar configurações:", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchConfigs();
        }
    }, [isOpen, currentUser.id]);

    const handleCheckboxChange = (tipo) => {
        setConfigs(prev => ({
            ...prev,
            [tipo]: !prev[tipo]
        }));
    };

    const handleSave = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/notificacoes/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_id: currentUser.id, configs })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlerta({ isOpen: true, message: result.message });
            onClose();
        } catch (error) {
            setAlerta({ isOpen: true, message: `Erro: ${error.message}` });
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Controlo de Notificações Estratégicas">
                {isLoading ? (
                    <p>A carregar configurações...</p>
                ) : (
                    <div className="notification-config-list">
                        <p>Selecione quais notificações importantes você, como Master Admin, deseja receber:</p>
                        {TIPOS_NOTIFICACAO.map(tipo => (
                            <div key={tipo.id} className="checkbox-label-group">
                                <input
                                    type="checkbox"
                                    id={`notif-${tipo.id}`}
                                    checked={configs[tipo.id] !== false} // Marcado por defeito se não existir
                                    onChange={() => handleCheckboxChange(tipo.id)}
                                />
                                <label htmlFor={`notif-${tipo.id}`}>{tipo.label}</label>
                            </div>
                        ))}
                    </div>
                )}
                <div className="modal-footer">
                    <div></div>
                    <div>
                        <button type="button" className="modal-button cancel" onClick={onClose}>Cancelar</button>
                        <button type="button" className="modal-button confirm" onClick={handleSave} style={{ backgroundColor: '#27ae60' }}>Salvar</button>
                    </div>
                </div>
            </Modal>
            <ModalAlerta isOpen={alerta.isOpen} onClose={() => setAlerta({ isOpen: false, message: '' })} title="Notificação">
                <p>{alerta.message}</p>
            </ModalAlerta>
        </>
    );
}

export default ModalNotificacoesControle;
