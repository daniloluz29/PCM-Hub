# backend/Rotas/notificacoes.py
from flask import Blueprint, jsonify, request
from ..db import get_db_connection
from datetime import datetime

bp = Blueprint('notificacoes', __name__, url_prefix='/api')

def criar_notificacao(conn, icone, texto, link, tipo_destinatario, alvo_destinatario, tipo_notificacao_estrategica=None):
    """
    Função auxiliar para criar uma notificação.
    Se for uma notificação estratégica, envia para todos os master_admins,
    exceto para aqueles que desativaram explicitamente este tipo de notificação.
    """
    if tipo_notificacao_estrategica:
        # 1. Busca todos os master_admins ativos. Eles são os destinatários por defeito.
        admins = conn.execute("SELECT id FROM usuarios WHERE perfil_id = 'master_admin' AND ativo = 1").fetchall()
        todos_admin_ids = {admin['id'] for admin in admins}

        if not todos_admin_ids:
            return # Não há admins para notificar

        # 2. Busca os admins que DESATIVARAM explicitamente esta notificação.
        placeholders = ','.join('?' for _ in todos_admin_ids)
        query = f"SELECT admin_id FROM notificacoes_config WHERE tipo_notificacao = ? AND habilitado = 0 AND admin_id IN ({placeholders})"
        
        params = [tipo_notificacao_estrategica] + list(todos_admin_ids)
        
        admins_desabilitados_rows = conn.execute(query, tuple(params)).fetchall()
        admins_desabilitados_ids = {admin['admin_id'] for admin in admins_desabilitados_rows}

        # 3. A lista final de destinatários é a diferença entre todos os admins e os que desativaram.
        ids_para_notificar = todos_admin_ids - admins_desabilitados_ids

        if not ids_para_notificar:
            return # Nenhum admin quer receber esta notificação.

        # 4. Define o alvo da notificação para a lista final.
        tipo_destinatario = 'USUARIO_ESPECIFICO'
        alvo_destinatario = ','.join(map(str, ids_para_notificar))

    cursor = conn.cursor()
    
    cursor.execute(
        """
        INSERT INTO notificacoes (icone, texto, link, data_criacao, tipo_destinatario, alvo_destinatario)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (icone, texto, link, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), tipo_destinatario, alvo_destinatario)
    )
    notificacao_id = cursor.lastrowid
    
    destinatarios_ids = []
    if tipo_destinatario == 'TODOS':
        usuarios = conn.execute('SELECT id FROM usuarios WHERE ativo = 1').fetchall()
        destinatarios_ids = [u['id'] for u in usuarios]
    elif tipo_destinatario == 'PERFIL':
        usuarios = conn.execute('SELECT id FROM usuarios WHERE perfil_id = ? AND ativo = 1', (alvo_destinatario,)).fetchall()
        destinatarios_ids = [u['id'] for u in usuarios]
    elif tipo_destinatario == 'USUARIO_ESPECIFICO':
        destinatarios_ids = [int(id_str) for id_str in alvo_destinatario.split(',')]

    if notificacao_id and destinatarios_ids:
        conn.executemany(
            'INSERT INTO notificacoes_status_usuarios (notificacao_id, usuario_id) VALUES (?, ?)',
            [(notificacao_id, user_id) for user_id in destinatarios_ids]
        )
    
    return notificacao_id


@bp.route('/notificacoes/config/<int:admin_id>', methods=['GET'])
def get_notificacao_config(admin_id):
    """Busca as configurações de notificação para um master_admin."""
    conn = get_db_connection()
    configs = conn.execute('SELECT tipo_notificacao, habilitado FROM notificacoes_config WHERE admin_id = ?', (admin_id,)).fetchall()
    conn.close()
    return jsonify({config['tipo_notificacao']: bool(config['habilitado']) for config in configs})

@bp.route('/notificacoes/config', methods=['POST'])
def update_notificacao_config():
    """Atualiza as configurações de notificação para um master_admin."""
    data = request.get_json()
    admin_id = data.get('admin_id')
    configs = data.get('configs')

    if not admin_id or not configs:
        return jsonify({"message": "Dados insuficientes."}), 400

    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        for tipo, habilitado in configs.items():
            cursor = conn.execute(
                'UPDATE notificacoes_config SET habilitado = ? WHERE admin_id = ? AND tipo_notificacao = ?',
                (1 if habilitado else 0, admin_id, tipo)
            )
            if cursor.rowcount == 0:
                conn.execute(
                    'INSERT INTO notificacoes_config (admin_id, tipo_notificacao, habilitado) VALUES (?, ?, ?)',
                    (admin_id, tipo, 1 if habilitado else 0)
                )
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao salvar configurações: {e}"}), 500
    finally:
        conn.close()
    
    return jsonify({"message": "Configurações salvas com sucesso!"})


@bp.route('/notificacoes/<int:usuario_id>', methods=['GET'])
def get_notificacoes_por_usuario(usuario_id):
    """Busca todas as notificações para um usuário específico."""
    conn = get_db_connection()
    query = """
        SELECT n.id, n.icone, n.texto, n.link, n.data_criacao, s.lida
        FROM notificacoes n
        JOIN notificacoes_status_usuarios s ON n.id = s.notificacao_id
        WHERE s.usuario_id = ?
        ORDER BY n.data_criacao DESC
        LIMIT 15
    """
    notificacoes = conn.execute(query, (usuario_id,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in notificacoes])

@bp.route('/notificacoes/marcar-como-lida', methods=['POST'])
def marcar_como_lida():
    """Marca uma ou todas as notificações como lidas para um usuário."""
    data = request.get_json()
    usuario_id = data.get('usuario_id')
    notificacao_id = data.get('notificacao_id')

    if not usuario_id:
        return jsonify({"message": "ID do usuário é obrigatório."}), 400

    conn = get_db_connection()
    try:
        if notificacao_id and notificacao_id != 'todas':
            conn.execute(
                'UPDATE notificacoes_status_usuarios SET lida = 1 WHERE usuario_id = ? AND notificacao_id = ?',
                (usuario_id, notificacao_id)
            )
        else:
            conn.execute(
                'UPDATE notificacoes_status_usuarios SET lida = 1 WHERE usuario_id = ?',
                (usuario_id,)
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao atualizar notificações: {e}"}), 500
    finally:
        conn.close()

    return jsonify({"message": "Notificações atualizadas com sucesso."})
