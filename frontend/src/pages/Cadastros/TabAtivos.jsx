import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';
import ModalAlerta from '../../components/ModalAlerta.jsx';

// Componente recursivo para renderizar um nó de uma árvore hierárquica.
function TreeNode({ node, selection, onSelectionChange, expansion, onExpansionChange }) {
    const isChecked = selection[node.id || node.cod_cc] || false;
    const isExpanded = expansion[node.id || node.cod_cc] || false;
    const hasChildren = node.children && node.children.length > 0;

    return (
        <li>
            <div className="tree-node">
                {hasChildren ? (
                    <button className="tree-toggle-btn" onClick={() => onExpansionChange(node.id || node.cod_cc, !isExpanded)}>
                        {isExpanded ? '−' : '+'}
                    </button>
                ) : (
                    <span style={{ width: '28px' }}></span>
                )}
                <input type="checkbox" checked={isChecked} onChange={() => onSelectionChange(node.id || node.cod_cc, !isChecked)} />
                <span className="tree-node-label" onClick={() => onSelectionChange(node.id || node.cod_cc, !isChecked)}>
                    {node.name || node.nome_cc}
                </span>
            </div>
            {hasChildren && isExpanded && (
                <ul>
                    {node.children.map(childNode => (
                        <TreeNode 
                            key={childNode.id || childNode.cod_cc} 
                            node={childNode} 
                            selection={selection}
                            onSelectionChange={onSelectionChange}
                            expansion={expansion}
                            onExpansionChange={onExpansionChange}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}

// Componente que encapsula a lógica da árvore de permissões.
function ComponenteArvoreHierarquica({ data, selection, onSelectionChange, expansion, onExpansionChange }) {
    if (!data) return <p>Carregando hierarquia...</p>;
    return (
        <div className="tree-view-container">
            <ul>
                <TreeNode 
                    node={data}
                    selection={selection}
                    onSelectionChange={onSelectionChange}
                    expansion={expansion}
                    onExpansionChange={onExpansionChange}
                />
            </ul>
        </div>
    );
}

// Componente principal da aba "Usuários Ativos".
const TabAtivos = ({ usuarios, perfis, funcoes, unidades, hierarquiaAcesso, hierarquiaDados, onDataChange, currentUser }) => { // Recebe currentUser

    const [usuarioIdSelecionado, setUsuarioIdSelecionado] = useState(null);
    const [abaPermissoes, setAbaPermissoes] = useState('perfil');

    // Estados dos campos do formulário de edição
    const [nomeEdit, setNomeEdit] = useState('');
    const [emailEdit, setEmailEdit] = useState('');
    const [contatoEdit, setContatoEdit] = useState('');
    const [funcaoIdEdit, setFuncaoIdEdit] = useState(null);
    const [unidadeIdEdit, setUnidadeIdEdit] = useState(null);
    const [senhaEdit, setSenhaEdit] = useState('');
    const [roleEdit, setRoleEdit] = useState('');
    const [isAtivo, setIsAtivo] = useState(true);
    const [showPasswordTools, setShowPasswordTools] = useState(false);

    // Estados para controle de modais e árvores de permissão
    const [modalSalvarAberto, setModalSalvarAberto] = useState(false);
    const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
    const [alertaAberto, setAlertaAberto] = useState(false);
    const [alertaMensagem, setAlertaMensagem] = useState('');
    const [selectionAcesso, setSelectionAcesso] = useState({});
    const [expansionAcesso, setExpansionAcesso] = useState({ todos_acessos: true });
    const [selectionDados, setSelectionDados] = useState({});
    const [expansionDados, setExpansionDados] = useState({ todos_dados: true });

    // Validações de senha
    const validacoesSenha = {
        minLength: senhaEdit.length >= 8,
        uppercase: /[A-Z]/.test(senhaEdit),
        lowercase: /[a-z]/.test(senhaEdit),
        number: /[0-9]/.test(senhaEdit),
        specialChar: /[!@#$%^&*(),.?":{}|<>]/.test(senhaEdit),
    };
    const isSaveDisabled = senhaEdit.length > 0 && !Object.values(validacoesSenha).every(Boolean);

    const optionsUsuarios = usuarios.map(user => ({
        value: user.id,
        label: `${user.matricula} - ${user.nome} ${user.ativo ? '' : '(Inativo)'}`
    }));
    const optionsFuncoes = funcoes.map(f => ({ value: f.id, label: f.nome }));
    const optionsUnidades = unidades.map(u => ({ value: u.cod_cc, label: u.nome_cc }));

    const usuarioSelecionado = usuarios.find(u => u.id === usuarioIdSelecionado);
    
    function gerarExpansaoInicial(node) {
        const expansion = {};
        function expandAll(n) {
            const key = n.id || n.cod_cc;
            if (n.children && n.children.length > 0) {
                expansion[key] = true;
                n.children.forEach(expandAll);
            }
        }
        if (node) expandAll(node);
        return expansion;
    }

    useEffect(() => {
        if (usuarioSelecionado) {
            setNomeEdit(usuarioSelecionado.nome);
            setEmailEdit(usuarioSelecionado.email);
            setContatoEdit(usuarioSelecionado.contato || '');
            setFuncaoIdEdit(usuarioSelecionado.funcao_id);
            setUnidadeIdEdit(usuarioSelecionado.unidade_id);
            setSenhaEdit('');
            setShowPasswordTools(false);
            setIsAtivo(usuarioSelecionado.ativo === 1);
            setRoleEdit(usuarioSelecionado.perfil_id);

            const acessosArray = usuarioSelecionado.acessos ? usuarioSelecionado.acessos.split(',') : [];
            const dadosArray = usuarioSelecionado.liberacao_dados ? usuarioSelecionado.liberacao_dados.split(',') : [];
            const novaSelAcesso = {}; acessosArray.forEach(id => novaSelAcesso[id] = true);
            const novaSelDados = {}; dadosArray.forEach(id => novaSelDados[id] = true);
            setSelectionAcesso(novaSelAcesso);
            setSelectionDados(novaSelDados);
            
            setExpansionAcesso(gerarExpansaoInicial(hierarquiaAcesso));
            setExpansionDados(gerarExpansaoInicial(hierarquiaDados));
        } else {
            setNomeEdit(''); setEmailEdit(''); setContatoEdit('');
            setFuncaoIdEdit(null); setUnidadeIdEdit(null);
            setSenhaEdit(''); setRoleEdit('');
            setSelectionAcesso({}); setSelectionDados({});
        }
    }, [usuarioSelecionado, hierarquiaAcesso, hierarquiaDados]);

    const handleGerarSenha = () => {
        if (!usuarioSelecionado) return;
        const preposicoes = ['de', 'da', 'do', 'dos', 'das', "e"];
        const nomesSignificativos = usuarioSelecionado.nome.toLowerCase().split(' ').filter(p => !preposicoes.includes(p));
        const iniciais = nomesSignificativos.slice(0, 2).map(n => n[0]).join('').toUpperCase();
        const numero = Math.floor(100 + Math.random() * 900);
        const especiais = "@#$%&*";
        const simbolo = especiais[Math.floor(Math.random() * especiais.length)];
        setSenhaEdit(`${iniciais}tradi${simbolo}${numero}`);
    };

    const handleSaveConfirm = async () => {
        setModalSalvarAberto(false);
        const dados = {
            nome: nomeEdit,
            email: emailEdit,
            contato: contatoEdit,
            funcao_id: funcaoIdEdit,
            unidade_id: unidadeIdEdit,
            ativo: isAtivo ? 1 : 0,
            perfil_id: roleEdit,
            ...(senhaEdit && { senha: senhaEdit }),
            acessos: Object.keys(selectionAcesso).filter(k => selectionAcesso[k]).join(','),
            liberacao_dados: Object.keys(selectionDados).filter(k => selectionDados[k]).join(','),
            admin_id: currentUser.id // Adiciona o ID do admin que está a fazer a alteração
        };

        try {
            const res = await fetch(`http://127.0.0.1:5000/api/usuarios/${usuarioSelecionado.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            setAlertaMensagem(`Alterações para ${usuarioSelecionado.nome} foram salvas com sucesso!`);
            onDataChange();
        } catch (err) {
            setAlertaMensagem(`Erro ao salvar: ${err.message}`);
        }
        setAlertaAberto(true);
    };

    const handleDeleteConfirm = async () => {
        setModalExcluirAberto(false);
        try {
            const res = await fetch(`http://127.0.0.1:5000/api/usuarios/${usuarioSelecionado.id}`, {
                method: 'DELETE'
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            setAlertaMensagem(`Usuário "${usuarioSelecionado.nome}" excluído com sucesso!`);
            setUsuarioIdSelecionado(null);
            onDataChange();
        } catch (err) {
            setAlertaMensagem(`Erro ao excluir: ${err.message}`);
        }
        setAlertaAberto(true);
    };

    const getAllChildIds = (node) => {
        let ids = [];
        if (!node.children) return ids;
        node.children.forEach(child => {
            ids.push(child.id || child.cod_cc);
            ids = ids.concat(getAllChildIds(child));
        });
        return ids;
    };

    const handleSelectionChange = (data, selection, setSelection) => (nodeId, isSelected) => {
        const newSelection = { ...selection };
        const findNode = (node, id) => {
            if ((node.id || node.cod_cc) === id) return node;
            if (node.children) {
                for (const child of node.children) {
                    const found = findNode(child, id);
                    if (found) return found;
                }
            }
            return null;
        };
        const node = findNode(data, nodeId);
        if (!node) return;
        const childIds = getAllChildIds(node);
        [nodeId, ...childIds].forEach(id => newSelection[id] = isSelected);
        setSelection(newSelection);
    };

    const handleExpansionChange = (setExpansion) => (nodeId, isExpanded) => {
        setExpansion(prev => ({ ...prev, [nodeId]: isExpanded }));
    };

    return (
        <div className="card">
            <div className="user-edit-header">
                <div className="filter-group">
                    <label htmlFor="user-select">Selecione um Usuário para Editar:</label>
                    <Select
                        id="user-select"
                        options={optionsUsuarios}
                        isClearable
                        isSearchable
                        placeholder="Selecione ou digite para buscar..."
                        onChange={(option) => setUsuarioIdSelecionado(option ? option.value : null)}
                        value={optionsUsuarios.find(opt => opt.value === usuarioIdSelecionado)}
                    />
                </div>
                {usuarioSelecionado && (
                    <button className="save-button" onClick={() => setModalSalvarAberto(true)} disabled={isSaveDisabled}>
                        <i className="bi bi-check-circle"></i> Salvar Alterações
                    </button>
                )}
            </div>
            
            {usuarioSelecionado && (
                <>
                    <div className="user-form-grid">
                        <div className="filter-group"><label>Matrícula:</label><input type="text" value={usuarioSelecionado.matricula} readOnly /></div>
                        <div className="filter-group"><label>Nome:</label><input type="text" value={nomeEdit} onChange={(e) => setNomeEdit(e.target.value)} /></div>
                        <div className="filter-group"><label>E-mail:</label><input type="email" value={emailEdit} onChange={(e) => setEmailEdit(e.target.value)} /></div>
                        <div className="filter-group"><label>Contato:</label><input type="text" value={contatoEdit} onChange={(e) => setContatoEdit(e.target.value)} /></div>
                        <div className="filter-group"><label>Função:</label><Select options={optionsFuncoes} value={optionsFuncoes.find(opt => opt.value === funcaoIdEdit)} onChange={(option) => setFuncaoIdEdit(option ? option.value : null)} placeholder="Selecione..." /></div>
                        <div className="filter-group"><label>Unidade:</label><Select options={optionsUnidades} value={optionsUnidades.find(opt => opt.value === unidadeIdEdit)} onChange={(option) => setUnidadeIdEdit(option ? option.value : null)} placeholder="Selecione..." /></div>
                        <div className="filter-group"><label>Nova Senha:</label><input type="text" placeholder="Deixe em branco para não alterar" value={senhaEdit} onChange={(e) => setSenhaEdit(e.target.value)} onFocus={() => setShowPasswordTools(true)} /></div>
                    </div>
                    
                    {showPasswordTools && (
                        <div className="password-tools-container">
                            <div className="tooltip-container">
                                <button className="generate-password-btn" onClick={handleGerarSenha}>Gerar Senha Automática</button>
                                <span className="tooltip-text">Gera uma senha forte seguindo as regras de segurança.</span>
                            </div>
                            <ul className="password-validation-checklist">
                                <li className={validacoesSenha.minLength ? 'valid' : 'invalid'}><i className={`bi ${validacoesSenha.minLength ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i><span>Pelo menos 8 dígitos</span></li>
                                <li className={validacoesSenha.uppercase ? 'valid' : 'invalid'}><i className={`bi ${validacoesSenha.uppercase ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i><span>Uma letra maiúscula</span></li>
                                <li className={validacoesSenha.lowercase ? 'valid' : 'invalid'}><i className={`bi ${validacoesSenha.lowercase ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i><span>Uma letra minúscula</span></li>
                                <li className={validacoesSenha.number ? 'valid' : 'invalid'}><i className={`bi ${validacoesSenha.number ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i><span>Um número</span></li>
                                <li className={validacoesSenha.specialChar ? 'valid' : 'invalid'}><i className={`bi ${validacoesSenha.specialChar ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i><span>Um caractere especial</span></li>
                            </ul>
                        </div>
                    )}

                    <div className="form-actions-group">
                        <div className="filter-group">
                            <label>Usuário Ativo?</label>
                            <label className="toggle-switch"><input type="checkbox" checked={isAtivo} onChange={() => setIsAtivo(!isAtivo)} /><span className="toggle-slider"></span></label>
                        </div>
                        {currentUser.perfil_id === 'master_admin' && (
                            <button className="delete-button" onClick={() => setModalExcluirAberto(true)}><i className="bi bi-trash-fill"></i>Excluir Usuário</button>
                        )}
                    </div>
                    <hr style={{margin: '30px 0'}}/>
                    <div className="tabs-container">
                        <button className={`tab-item ${abaPermissoes === 'perfil' ? 'active' : ''}`} onClick={() => setAbaPermissoes('perfil')}>Perfil de Acesso</button>
                        <button className={`tab-item ${abaPermissoes === 'acesso' ? 'active' : ''}`} onClick={() => setAbaPermissoes('acesso')}>Permissões de Painéis</button>
                        <button className={`tab-item ${abaPermissoes === 'dados' ? 'active' : ''}`} onClick={() => setAbaPermissoes('dados')}>Visibilidade de Dados</button>
                    </div>
                    <div className="tab-content">
                        {abaPermissoes === 'perfil' && (
                            <div className="tree-view-container">
                                <h4>Selecione o nível de permissão para este usuário:</h4>
                                <ul className="role-selection-list">
                                    {perfis.map(perfil => (
                                        <li key={perfil.id} className={`role-selection-item ${roleEdit === perfil.id ? 'selected' : ''}`} onClick={() => setRoleEdit(perfil.id)}>
                                            <input type="radio" name="role-selection" value={perfil.id} checked={roleEdit === perfil.id} readOnly />
                                            <div><label>{perfil.nome}</label><p style={{margin: '0', fontSize: '14px', color: '#5f6368', fontWeight: 'normal'}}>{perfil.descricao}</p></div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {abaPermissoes === 'acesso' && <ComponenteArvoreHierarquica key="arvore_acesso" data={hierarquiaAcesso} selection={selectionAcesso} onSelectionChange={handleSelectionChange(hierarquiaAcesso, selectionAcesso, setSelectionAcesso)} expansion={expansionAcesso} onExpansionChange={handleExpansionChange(setExpansionAcesso)} />}
                        {abaPermissoes === 'dados' && <ComponenteArvoreHierarquica key="arvore_dados" data={hierarquiaDados} selection={selectionDados} onSelectionChange={handleSelectionChange(hierarquiaDados, selectionDados, setSelectionDados)} expansion={expansionDados} onExpansionChange={handleExpansionChange(setExpansionDados)} />}
                    </div>
                </>
            )}
            <ModalConfirmacao isOpen={modalSalvarAberto} onClose={() => setModalSalvarAberto(false)} onConfirm={handleSaveConfirm} title="Confirmar Alterações"><p>Deseja realmente salvar as alterações para o usuário <strong>{usuarioSelecionado?.nome}</strong>?</p></ModalConfirmacao>
            <ModalConfirmacao isOpen={modalExcluirAberto} onClose={() => setModalExcluirAberto(false)} onConfirm={handleDeleteConfirm} title="Confirmar Exclusão"><p>Esta ação é irreversível. Deseja excluir o usuário <strong>{usuarioSelecionado?.nome}</strong>?</p></ModalConfirmacao>
            <ModalAlerta isOpen={alertaAberto} onClose={() => setAlertaAberto(false)} title="Operação Concluída"><p>{alertaMensagem}</p></ModalAlerta>
        </div>
    );
};

export default TabAtivos;
