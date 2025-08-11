from flask import Blueprint, jsonify, request
from ..db import get_db_connection
from werkzeug.security import generate_password_hash
# Importa a função de criar notificação do outro módulo
from ..Rotas.notificacoes import criar_notificacao

bp = Blueprint('usuarios', __name__, url_prefix='/api/usuarios')

@bp.route('', methods=['GET'])
def get_usuarios():
    conn = get_db_connection()
    usuarios = conn.execute('SELECT * FROM usuarios ORDER BY nome ASC').fetchall()
    conn.close()
    return jsonify([dict(row) for row in usuarios])

@bp.route('/<int:id>', methods=['PUT'])
def update_usuario(id):
    data = request.get_json()
    conn = get_db_connection()
    
    try:
        conn.execute("BEGIN")

        # Pega o ID do administrador que está a fazer a alteração e o remove do payload principal
        admin_id = data.pop('admin_id', None)
        admin_nome = "um administrador"
        if admin_id:
            admin = conn.execute('SELECT nome FROM usuarios WHERE id = ?', (admin_id,)).fetchone()
            if admin:
                admin_nome = admin['nome']

        # Busca os dados antigos do usuário para comparação
        usuario_antigo = conn.execute('SELECT * FROM usuarios WHERE id = ?', (id,)).fetchone()
        if not usuario_antigo:
            return jsonify({"message": "Usuário não encontrado."}), 404

        # --- LÓGICA DE NOTIFICAÇÃO ---
        info_pessoal_alterada = (
            usuario_antigo['nome'] != data['nome'] or
            usuario_antigo['email'] != data['email'] or
            usuario_antigo['contato'] != data['contato']
        )
        permissoes_alteradas = (
            usuario_antigo['perfil_id'] != data['perfil_id'] or
            usuario_antigo['acessos'] != data['acessos'] or
            usuario_antigo['liberacao_dados'] != data['liberacao_dados']
        )

        # Cria a notificação de atualização de perfil, se aplicável
        if info_pessoal_alterada:
            texto_notificacao = f"Seus dados de perfil foram atualizados por {admin_nome}. Faça login novamente para aplicar as alterações."
            criar_notificacao(conn, 'bi-person-lines-fill', texto_notificacao, 'perfil', 'USUARIO_ESPECIFICO', str(id))

        # Cria a notificação de alteração de permissões, se aplicável
        if permissoes_alteradas:
            texto_notificacao = f"As suas permissões de acesso foram atualizadas por {admin_nome}. Faça login novamente para aplicar as alterações."
            criar_notificacao(conn, 'bi-shield-check', texto_notificacao, 'perfil', 'USUARIO_ESPECIFICO', str(id))
        
        # --- LÓGICA DE ATUALIZAÇÃO DO USUÁRIO ---
        if 'senha' in data and data['senha']:
            senha_hashed = generate_password_hash(data['senha'])
            conn.execute('UPDATE usuarios SET nome=?, email=?, contato=?, funcao_id=?, unidade_id=?, ativo=?, perfil_id=?, acessos=?, liberacao_dados=?, senha_hash=? WHERE id=?',
                         (data['nome'], data['email'], data['contato'], data['funcao_id'], data['unidade_id'], data['ativo'], data['perfil_id'], data['acessos'], data['liberacao_dados'], senha_hashed, id))
        else:
            conn.execute('UPDATE usuarios SET nome=?, email=?, contato=?, funcao_id=?, unidade_id=?, ativo=?, perfil_id=?, acessos=?, liberacao_dados=? WHERE id=?',
                         (data['nome'], data['email'], data['contato'], data['funcao_id'], data['unidade_id'], data['ativo'], data['perfil_id'], data['acessos'], data['liberacao_dados'], id))
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao atualizar usuário: {e}"}), 500
    finally:
        conn.close()
        
    return jsonify({"message": "Usuário atualizado com sucesso!"})

@bp.route('/<int:id>', methods=['DELETE'])
def delete_usuario(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM usuarios WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Usuário excluído com sucesso!"})
