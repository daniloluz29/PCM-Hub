# backend/Rotas/auth.py
from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash
from ..db import get_db_connection

bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@bp.route('/login', methods=['POST'])
def login():
    """
    Autentica um usuário e retorna seus dados junto com sua lista de permissões.
    """
    data = request.get_json()
    email = data.get('email')
    senha = data.get('senha')

    if not email or not senha:
        return jsonify({"message": "E-mail e senha são obrigatórios."}), 400

    conn = get_db_connection()
    # A query já está correta, selecionando todos os campos necessários.
    user_row = conn.execute('SELECT id, nome, email, matricula, contato, funcao_id, unidade_id, senha_hash, ativo, perfil_id, acessos, liberacao_dados FROM usuarios WHERE email = ?', (email,)).fetchone()

    if user_row is None:
        conn.close()
        return jsonify({"message": "Usuário inexistente, solicite seu cadastro."}), 404

    if user_row['ativo'] == 0:
        conn.close()
        return jsonify({"message": "Este usuário está inativo."}), 403

    if not check_password_hash(user_row['senha_hash'], senha):
        conn.close()
        return jsonify({"message": "Senha incorreta."}), 401

    # Se a autenticação for bem-sucedida, busca as permissões do perfil
    user_data = dict(user_row)
    del user_data['senha_hash']
    
    # Regra especial para o Master Admin: concede todas as permissões existentes
    if user_data['perfil_id'] == 'master_admin':
        todas_permissoes_rows = conn.execute('SELECT id FROM permissoes_totais').fetchall()
        permissoes = [p['id'] for p in todas_permissoes_rows]
        permissoes.append('todas_permissoes') # Adiciona o nó raiz
    else:
        # Para outros perfis, busca as permissões específicas da tabela de junção
        permissoes_rows = conn.execute(
            'SELECT permissao_id FROM permissoes_perfis WHERE perfil_id = ?',
            (user_data['perfil_id'],)
        ).fetchall()
        permissoes = [p['permissao_id'] for p in permissoes_rows]

    conn.close()
    
    # Adiciona a lista de permissões ao objeto do usuário
    user_data['permissoes'] = permissoes
    
    # user_data já contém 'acessos' e 'liberacao_dados' da query inicial.
    
    return jsonify({
        "message": "Login bem-sucedido!",
        "user": user_data
    }), 200
