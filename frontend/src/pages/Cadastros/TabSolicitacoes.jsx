import React, { useState } from 'react';
import Modal from '../../components/Modal.jsx';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';
import ModalAlerta from '../../components/ModalAlerta.jsx';

/**
 * Componente para a aba "Solicitações" dentro do Gerenciamento de Usuários.
 * Exibe as solicitações de cadastro pendentes e permite aprová-las ou negá-las.
 */
const TabSolicitacoes = ({ solicitacoes, funcoes, unidades, onDataChange }) => {
    const [solicitacaoAberta, setSolicitacaoAberta] = useState(null);
    const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
    const [usuarioParaCadastrar, setUsuarioParaCadastrar] = useState(null);
    const [senhaParaNovoUsuario, setSenhaParaNovoUsuario] = useState('');
    const [modalConfirmarCadastroAberto, setModalConfirmarCadastroAberto] = useState(false);
    
    // --- NOVOS ESTADOS PARA A AÇÃO DE NEGAR ---
    const [solicitacaoParaNegar, setSolicitacaoParaNegar] = useState(null);
    const [modalNegarAberto, setModalNegarAberto] = useState(false);

    const [alertaAberto, setAlertaAberto] = useState(false);
    const [alertaMensagem, setAlertaMensagem] = useState('');

    const validacoes = {
        minLength: senhaParaNovoUsuario.length >= 8,
        uppercase: /[A-Z]/.test(senhaParaNovoUsuario),
        lowercase: /[a-z]/.test(senhaParaNovoUsuario),
        number: /[0-9]/.test(senhaParaNovoUsuario),
        specialChar: /[!@#$%^&*(),.?":{}|<>]/.test(senhaParaNovoUsuario),
    };
    const isSenhaValida = Object.values(validacoes).every(Boolean);

    const handleAbrirModalSenha = (usuario) => {
        setUsuarioParaCadastrar(usuario);
        setSenhaParaNovoUsuario('');
        setModalSenhaAberto(true);
    };

    const handleGerarSenha = () => {
        if (!usuarioParaCadastrar) return;
        const preposicoes = ['de', 'da', 'do', 'dos', 'das', 'e'];
        const nomesSignificativos = usuarioParaCadastrar.nome.toLowerCase().split(' ').filter(palavra => !preposicoes.includes(palavra));
        const iniciais = nomesSignificativos.slice(0, 2).map(n => n[0]).join('').toUpperCase();
        const numeroAleatorio = Math.floor(100 + Math.random() * 900);
        const specialChars = "@#$%&*";
        const randomSpecialChar = specialChars[Math.floor(Math.random() * specialChars.length)];
        const novaSenha = `${iniciais}tradi${randomSpecialChar}${numeroAleatorio}`;
        setSenhaParaNovoUsuario(novaSenha);
    };

    const handleConfirmarCadastroClick = () => {
        if (!isSenhaValida) return;
        setModalSenhaAberto(false);
        setModalConfirmarCadastroAberto(true);
    };

    const handleCadastroFinal = async () => {
        setModalConfirmarCadastroAberto(false);
        const dadosParaCadastrar = {
            id: usuarioParaCadastrar.id,
            senha: senhaParaNovoUsuario
        };
        try {
            const response = await fetch('http://127.0.0.1:5000/api/cadastrar_solicitacao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosParaCadastrar)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlertaMensagem(result.message);
            onDataChange();
        } catch (error) {
            setAlertaMensagem(`Erro ao cadastrar: ${error.message}`);
        }
        setAlertaAberto(true);
    };
    
    // --- NOVAS FUNÇÕES PARA NEGAR A SOLICITAÇÃO ---
    const handleNegarClick = (solicitacao) => {
        setSolicitacaoParaNegar(solicitacao);
        setModalNegarAberto(true);
    };

    const handleNegarConfirm = async () => {
        if (!solicitacaoParaNegar) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/solicitacoes/${solicitacaoParaNegar.id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlertaMensagem(result.message);
            onDataChange(); // Recarrega os dados
        } catch (error) {
            setAlertaMensagem(`Erro ao negar solicitação: ${error.message}`);
        }
        setModalNegarAberto(false);
        setSolicitacaoParaNegar(null);
        setAlertaAberto(true);
    };


    return (
        <div className="card">
            {solicitacoes.map(item => {
                const funcaoObj = funcoes.find(f => f.id === item.funcao_id);
                const funcaoNome = funcaoObj ? funcaoObj.nome : 'Não informado';
                const unidadeObj = unidades.find(u => u.cod_cc === item.unidade_id);
                const unidadeNome = unidadeObj ? unidadeObj.nome_cc : 'Não informado';

                return (
                    <div key={item.id} className={`accordion-item ${solicitacaoAberta === item.id ? 'active' : ''}`}>
                        <div className="accordion-question" onClick={() => setSolicitacaoAberta(solicitacaoAberta === item.id ? null : item.id)}>
                            <span>{item.nome}</span>
                            <span className="icon"><i className="bi bi-chevron-down"></i></span>
                        </div>
                        <div className="accordion-answer">
                            <div className="solicitacao-details">
                                <p><strong>Matrícula:</strong> {item.matricula}</p>
                                <p><strong>Nome:</strong> {item.nome}</p>
                                <p><strong>E-mail:</strong> {item.email}</p>
                                <p><strong>Contato:</strong> {item.contato}</p>
                                <p><strong>Função:</strong> {funcaoNome}</p>
                                <p><strong>Unidade:</strong> {unidadeNome}</p>
                                {/* --- BOTÕES DE AÇÃO ATUALIZADOS --- */}
                                <div className="solicitacao-actions">
                                    <button className="deny-button" onClick={() => handleNegarClick(item)}>Negar</button>
                                    <button className="approve-button" onClick={() => handleAbrirModalSenha(item)}>Cadastrar Usuário</button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
            <Modal isOpen={modalSenhaAberto} onClose={() => setModalSenhaAberto(false)} title={`Cadastrar Senha para ${usuarioParaCadastrar?.nome}`}>
                <div className="filter-group">
                    <label>Defina uma senha ou gere uma automaticamente:</label>
                    <input type="text" value={senhaParaNovoUsuario} onChange={(e) => setSenhaParaNovoUsuario(e.target.value)} />
                    <div className="tooltip-container">
                        <button className="generate-password-btn" onClick={handleGerarSenha}>
                            Gerar Senha Automática
                        </button>
                        <span className="tooltip-text">
                            Iniciais dos 2 primeiros nomes (Maiús.) <br />
                            + tradi (Minús.) <br />
                            + 1 caractere especial("@#$%&*") <br />
                            + 3 números aleatórios
                        </span>
                    </div>
                </div>
                <ul className="password-validation-checklist">
                    <li className={validacoes.minLength ? 'valid' : 'invalid'}><i className={`bi ${validacoes.minLength ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i><span>Pelo menos 8 dígitos</span></li>
                    <li className={validacoes.uppercase ? 'valid' : 'invalid'}><i className={`bi ${validacoes.uppercase ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i><span>Uma letra maiúscula</span></li>
                    <li className={validacoes.lowercase ? 'valid' : 'invalid'}><i className={`bi ${validacoes.lowercase ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i><span>Uma letra minúscula</span></li>
                    <li className={validacoes.specialChar ? 'valid' : 'invalid'}><i className={`bi ${validacoes.specialChar ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i><span>Um caractere especial (@#$%&*)</span></li>
                    <li className={validacoes.number ? 'valid' : 'invalid'}><i className={`bi ${validacoes.number ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i><span>Um número</span></li>
                </ul>
                <div className="modal-footer" style={{borderTop: 'none', paddingTop: '15px'}}>
                    <button type="button" className="modal-button cancel" onClick={() => setModalSenhaAberto(false)}>Cancelar</button>
                    <button type="button" className="modal-button confirm" style={{backgroundColor: '#27ae60'}} onClick={handleConfirmarCadastroClick} disabled={!isSenhaValida}>Confirmar Senha e Cadastrar</button>
                </div>
            </Modal>
            <ModalConfirmacao isOpen={modalConfirmarCadastroAberto} onClose={() => setModalConfirmarCadastroAberto(false)} onConfirm={handleCadastroFinal} title="Confirmar Cadastro"><p>Você confirma o cadastro do usuário <strong>{usuarioParaCadastrar?.nome}</strong> com a senha definida?</p></ModalConfirmacao>
            
            {/* --- NOVO MODAL DE CONFIRMAÇÃO PARA NEGAR --- */}
            <ModalConfirmacao isOpen={modalNegarAberto} onClose={() => setModalNegarAberto(false)} onConfirm={handleNegarConfirm} title="Confirmar Negação">
                <p>Você tem certeza que deseja negar e excluir a solicitação de cadastro para <strong>{solicitacaoParaNegar?.nome}</strong>?</p>
                <p>Esta ação não pode ser desfeita.</p>
            </ModalConfirmacao>

            <ModalAlerta isOpen={alertaAberto} onClose={() => setAlertaAberto(false)} title="Operação Realizada!"><p>{alertaMensagem}</p></ModalAlerta>
        </div>
    );
};

export default TabSolicitacoes;
