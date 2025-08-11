import React, { useState } from 'react';

function PaginaLogin({ onLoginSuccess, onNavigateToSolicitacao }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://127.0.0.1:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, senha }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro de autenticação.');
      }
      
      // Chama a função de sucesso passando os dados do usuário e a opção "lembrar de mim"
      onLoginSuccess(data.user, rememberMe);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleNavigate = (event) => {
      event.preventDefault();
      onNavigateToSolicitacao();
  }

  return (
    <div className="login-page-container">
      <div className="bottom-right-logo">
        <img src="/images/logo tradimaq branca.png" alt="Logo Tradimaq" />
      </div>

      <div className="login-box">
        <div className="login-logo-container">
            <img src="/images/logo-pcm.png" alt="Logo PCM Hub" />
            <span>PCM Hub</span>
        </div>
        
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <i className="bi bi-person"></i>
            <input 
              type="email" 
              placeholder="Digite o seu e-mail..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="input-group">
            <i className="bi bi-lock"></i>
            <input 
              type={senhaVisivel ? "text" : "password"} 
              placeholder="Digite sua senha..."
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required 
            />
            <i 
              className={`bi ${senhaVisivel ? 'bi-eye-slash' : 'bi-eye'} eye-icon`}
              onClick={() => setSenhaVisivel(!senhaVisivel)}
            ></i>
          </div>

          {error && <p className="error-message" style={{textAlign: 'center', marginBottom: '15px'}}>{error}</p>}

          <div className="login-options">
            <label className="checkbox-label-group">
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Continuar conectado</span>
            </label>
          </div>

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="signup-link">
          Não tem uma conta? <a href="#" onClick={handleNavigate}>Solicite seu cadastro!</a>
        </div>
      </div>
    </div>
  );
}

export default PaginaLogin;
