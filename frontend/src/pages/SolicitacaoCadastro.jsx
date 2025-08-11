import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import ModalAlerta from '../components/ModalAlerta.jsx';

function PaginaSolicitacaoCadastro({ onNavigateToLogin }) {
  // Estados do formulário
  const [formState, setFormState] = useState({
      nome: '', matricula: '', emailUser: '', contato: '',
      funcao_id: null, unidade_id: null
  });

  // Estados para popular os seletores
  const [funcoes, setFuncoes] = useState([]);
  const [unidades, setUnidades] = useState([]);
  
  // Estados de controle da UI
  const [isLoading, setIsLoading] = useState(false);
  const [alerta, setAlerta] = useState({ isOpen: false, title: '', message: '' });

  const phoneRef = useRef(null);

  // Busca os dados para os seletores quando o componente é montado
  useEffect(() => {
    const fetchData = async () => {
        try {
            const [funcoesRes, unidadesRes] = await Promise.all([
                fetch('http://127.0.0.1:5000/api/funcoes'),
                fetch('http://127.0.0.1:5000/api/unidades')
            ]);
            const funcoesData = await funcoesRes.json();
            const unidadesData = await unidadesRes.json();
            setFuncoes(funcoesData.map(f => ({ value: f.id, label: f.nome })));
            setUnidades(unidadesData.map(u => ({ value: u.cod_cc, label: u.nome_cc })));
        } catch (error) {
            setAlerta({ isOpen: true, title: 'Erro de Rede', message: 'Não foi possível carregar os dados para o formulário.' });
        }
    };
    fetchData();
  }, []);

  // Inicializa a máscara de telefone
  useEffect(() => {
    if (phoneRef.current) {
      const phoneMask = IMask(phoneRef.current, {
        mask: [ { mask: '(00) 0000-0000' }, { mask: '(00) 0 0000-0000' } ]
      });
    }
  }, []);

  const handleInputChange = (e) => {
      const { name, value } = e.target;
      setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, option) => {
      setFormState(prev => ({ ...prev, [name]: option ? option.value : null }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    const payload = {
        ...formState,
        email: `${formState.emailUser}@tradimaq.com.br`
    };
    delete payload.emailUser; // Remove o campo parcial

    try {
        const response = await fetch('http://127.0.0.1:5000/api/solicitacoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message);
        }
        setAlerta({
            isOpen: true,
            title: 'Sucesso!',
            message: result.message,
            onClose: onNavigateToLogin // Navega para o login ao fechar o alerta de sucesso
        });
    } catch (error) {
        setAlerta({ isOpen: true, title: 'Erro na Solicitação', message: error.message });
    } finally {
        setIsLoading(false);
    }
  };
  
  const closeAlerta = () => {
      const callback = alerta.onClose;
      setAlerta({ isOpen: false, title: '', message: '' });
      if (callback) callback();
  };

  const customSelectStyles = { /* ... (mesmos estilos de antes) ... */ };

  return (
    <>
      <div className="login-page-container">
        <div className="bottom-right-logo">
          <img src="/images/logo tradimaq branca.png" alt="Logo Tradimaq" />
        </div>
        <div className="login-box" style={{maxWidth: '800px', width: 'auto'}}>
          <div className="login-logo-container">
              <img src="/images/logo-pcm.png" alt="Logo PCM Hub" />
              <span>PCM Hub</span>
          </div>
          <h3 style={{color: '#555', fontWeight: 'normal'}}>Solicitação de Cadastro</h3>
          <form onSubmit={handleSubmit}>
              <div className="form-grid">    
                  <div className="input-group"><i className="bi bi-person-badge"></i><input type="text" name="nome" placeholder="Nome completo..." value={formState.nome} onChange={handleInputChange} required /></div>
                  <div className="input-group"><i className="bi bi-person-vcard"></i><input type="text" name="matricula" placeholder="Matrícula..." value={formState.matricula} onChange={handleInputChange} required /></div>
                  <div className="input-group" style={{display: 'flex', alignItems: 'center'}}>
                      <i className="bi bi-envelope"></i>
                      <input type="text" name="emailUser" placeholder="usuario.nome" value={formState.emailUser} onChange={handleInputChange} required style={{borderRadius: '8px 0 0 8px'}} />
                      <span style={{padding: '15px', border: '1px solid #ddd', borderLeft: 'none', backgroundColor: '#eee', borderRadius: '0 8px 8px 0'}}>@tradimaq.com.br</span>
                  </div>
                  <div className="input-group"><i className="bi bi-telephone"></i><input ref={phoneRef} type="text" name="contato" id="phone-mask" placeholder="Contato (xx) xxxxx-xxxx" value={formState.contato} onChange={handleInputChange} required /></div>
                  <div className="input-group">
                      <i className="bi bi-briefcase"></i>
                      <Select options={funcoes} isSearchable placeholder="Selecione ou busque uma função..." onChange={(option) => handleSelectChange('funcao_id', option)} styles={customSelectStyles} menuPortalTarget={document.body} />
                  </div>
                  <div className="input-group">
                      <i className="bi bi-file-earmark-text"></i>
                      <Select options={unidades} isSearchable placeholder="Selecione ou busque um contrato..." onChange={(option) => handleSelectChange('unidade_id', option)} styles={customSelectStyles} menuPortalTarget={document.body} />
                  </div>
              </div>
              <button type="submit" className="login-btn" disabled={isLoading}>
                  {isLoading ? 'Enviando...' : 'Enviar Solicitação'}
              </button>
          </form>
          <div className="signup-link">
            Já tem uma conta? <a href="#" onClick={onNavigateToLogin}>Faça o login</a>
          </div>
        </div>
      </div>
      <ModalAlerta isOpen={alerta.isOpen} onClose={closeAlerta} title={alerta.title}>
          <p>{alerta.message}</p>
      </ModalAlerta>
    </>
  );
}

export default PaginaSolicitacaoCadastro;
