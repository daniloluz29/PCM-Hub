from flask import Blueprint, jsonify, request
from ..db import get_db_connection
from datetime import datetime

bp = Blueprint('chamados', __name__, url_prefix='/api')

def checar_permissao_mensagem(conn, mensagem_id, usuario_id_sessao):
    """
    Função auxiliar para verificar se um usuário tem permissão para
    editar ou excluir uma mensagem de chat de chamado.
    A regra de negócio é: apenas o autor da última mensagem pode alterá-la.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM chat_chamados WHERE id = ?", (mensagem_id,))
    msg = cursor.fetchone()
    if not msg:
        return False, "Mensagem não encontrada.", 404

    cursor.execute("SELECT MAX(ordem) FROM chat_chamados WHERE chamado_id = ?", (msg['chamado_id'],))
    max_ordem = cursor.fetchone()[0]

    if msg['usuario_id'] != usuario_id_sessao:
        return False, "Você não pode modificar a mensagem de outro utilizador.", 403
    if msg['ordem'] != max_ordem:
        return False, "Apenas a última mensagem pode ser modificada.", 403
    
    return True, "OK", 200

# --- Endpoints de Chamados ---

@bp.route('/chamados', methods=['GET'])
def get_chamados():
    """Busca todos os chamados, juntando os nomes do solicitante e responsável."""
    conn = get_db_connection()
    query = """
        SELECT c.*, solicitante.nome as solicitante_nome, responsavel.nome as responsavel_nome
        FROM chamados c
        LEFT JOIN usuarios solicitante ON c.solicitante_id = solicitante.id
        LEFT JOIN usuarios responsavel ON c.responsavel_id = responsavel.id
        ORDER BY c.data_abertura DESC;
    """
    chamados = conn.execute(query).fetchall()
    conn.close()
    return jsonify([dict(row) for row in chamados])

@bp.route('/chamados', methods=['POST'])
def create_chamado():
    """Cria um novo chamado."""
    data = request.get_json()
    conn = get_db_connection()
    try:
        required_fields = ['titulo', 'categoria', 'prioridade', 'solicitante_id', 'responsavel_id']
        if not all(field in data for field in required_fields):
            return jsonify({"message": "Erro: Campos obrigatórios não preenchidos."}), 400

        conn.execute(
            'INSERT INTO chamados (titulo, descricao, status, categoria, prioridade, solicitante_id, responsavel_id, data_abertura) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            (data['titulo'], data.get('descricao', ''), 'Pendente', data['categoria'], data['prioridade'], data['solicitante_id'], data['responsavel_id'], datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        )
        conn.commit()
    except Exception as e:
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Chamado aberto e atribuído com sucesso!"}), 201

@bp.route('/chamados/<int:id>', methods=['PUT'])
def update_chamado(id):
    """
    Atualiza um chamado existente de forma dinâmica.
    Aceita os campos: titulo, descricao, categoria, status, responsavel_id, solucao.
    """
    data = request.get_json()
    conn = get_db_connection()
    try:
        fields_to_update = []
        values = []
        
        updatable_fields = ['titulo', 'descricao', 'categoria', 'status', 'responsavel_id', 'solucao']
        
        for field in updatable_fields:
            if field in data:
                fields_to_update.append(f"{field} = ?")
                values.append(data[field])
        
        if not fields_to_update:
            return jsonify({"message": "Nenhum campo válido para atualizar."}), 400

        if data.get('status') == 'Concluído':
            fields_to_update.append("data_fechamento = ?")
            values.append(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

        values.append(id)
        query = f"UPDATE chamados SET {', '.join(fields_to_update)} WHERE id = ?"
        
        conn.execute(query, tuple(values))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro inesperado ao atualizar chamado: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": f"Chamado #{id} atualizado com sucesso!"})

# NOVA ROTA: Excluir um chamado
@bp.route('/chamados/<int:id>', methods=['DELETE'])
def delete_chamado(id):
    """Exclui um chamado e todos os seus dados relacionados (chat, anexos, etc.)."""
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        # Exclui mensagens do chat associadas ao chamado
        conn.execute('DELETE FROM chat_chamados WHERE chamado_id = ?', (id,))
        # (Opcional) Adicionar aqui a lógica para excluir anexos do sistema de arquivos
        
        # Exclui o chamado principal
        cursor = conn.execute('DELETE FROM chamados WHERE id = ?', (id,))
        
        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({"message": "Chamado não encontrado."}), 404
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao excluir o chamado: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": f"Chamado #{id} e seus dados foram excluídos com sucesso."})


# --- Endpoints do Chat de Chamados ---

@bp.route('/chamados/<int:chamado_id>/chat', methods=['GET'])
def get_chat_mensagens(chamado_id):
    """Busca todas as mensagens de um chamado específico."""
    conn = get_db_connection()
    query = "SELECT cc.*, u.nome as usuario_nome FROM chat_chamados cc JOIN usuarios u ON cc.usuario_id = u.id WHERE cc.chamado_id = ? ORDER BY cc.ordem ASC"
    mensagens = conn.execute(query, (chamado_id,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in mensagens])

@bp.route('/chamados/<int:chamado_id>/chat', methods=['POST'])
def add_chat_mensagem(chamado_id):
    """Adiciona uma nova mensagem ao chat de um chamado."""
    data = request.get_json()
    conn = get_db_connection()
    try:
        usuario_id, conteudo = data.get('usuario_id'), data.get('conteudo')
        if not all([usuario_id, conteudo]):
            return jsonify({"message": "ID do utilizador e conteúdo são obrigatórios."}), 400

        cursor = conn.cursor()
        cursor.execute("SELECT MAX(ordem) FROM chat_chamados WHERE chamado_id = ?", (chamado_id,))
        nova_ordem = (cursor.fetchone()[0] or 0) + 1

        conn.execute('INSERT INTO chat_chamados (chamado_id, usuario_id, data_hora, conteudo, ordem) VALUES (?, ?, ?, ?, ?)',
            (chamado_id, usuario_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), conteudo, nova_ordem))
        conn.commit()
    except Exception as e:
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Mensagem adicionada com sucesso!"}), 201

@bp.route('/chat/mensagens/<int:id>', methods=['PUT'])
def update_chat_mensagem(id):
    """Atualiza o conteúdo de uma mensagem."""
    data = request.get_json()
    usuario_id_sessao = data.get('usuario_id_sessao') 
    novo_conteudo = data.get('conteudo')
    if not novo_conteudo: 
        return jsonify({"message": "Conteúdo não pode ser vazio."}), 400

    conn = get_db_connection()
    try:
        permitido, msg, status_code = checar_permissao_mensagem(conn, id, usuario_id_sessao)
        if not permitido: 
            return jsonify({"message": msg}), status_code
        
        conn.execute("UPDATE chat_chamados SET conteudo = ? WHERE id = ?", (novo_conteudo, id))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"message": "Mensagem atualizada com sucesso!"})

@bp.route('/chat/mensagens/<int:id>', methods=['DELETE'])
def delete_chat_mensagem(id):
    """Exclui uma mensagem."""
    data = request.get_json()
    usuario_id_sessao = data.get('usuario_id_sessao')
    conn = get_db_connection()
    try:
        permitido, msg, status_code = checar_permissao_mensagem(conn, id, usuario_id_sessao)
        if not permitido: 
            return jsonify({"message": msg}), status_code
        
        conn.execute("DELETE FROM chat_chamados WHERE id = ?", (id,))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"message": "Mensagem excluída com sucesso!"})

@bp.route('/chat/mensagens/<int:id>/reacao', methods=['POST'])
def add_or_update_reacao(id):
    """Adiciona ou remove uma reação de uma mensagem."""
    reacao = request.json.get('reacao')
    conn = get_db_connection()
    try:
        conn.execute("UPDATE chat_chamados SET reacao = ? WHERE id = ?", (reacao, id))
        conn.commit()
    except Exception as e:
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Reação atualizada."})

# --- ENDPOINTS PARA ANEXOS (SIMULAÇÃO) ---

@bp.route('/chamados/<int:chamado_id>/anexos', methods=['GET'])
def get_anexos(chamado_id):
    mock_anexos = [
        { "id": 1, "nome_arquivo": "log_de_erro.txt", "tamanho_arquivo": 2, "tipo_arquivo": "text", "data_upload": "2025-07-24 10:00:00" },
        { "id": 2, "nome_arquivo": "print_tela_azul.png", "tamanho_arquivo": 128, "tipo_arquivo": "image", "data_upload": "2025-07-24 10:05:00" },
        { "id": 3, "nome_arquivo": "relatorio_incidente.pdf", "tamanho_arquivo": 45, "tipo_arquivo": "pdf", "data_upload": "2025-07-24 10:10:00" }
    ]
    return jsonify(mock_anexos)

@bp.route('/chamados/<int:chamado_id>/anexos', methods=['POST'])
def upload_anexo(chamado_id):
    return jsonify({"message": "Arquivo anexado com sucesso (simulação)!"}), 201

@bp.route('/anexos/<int:anexo_id>', methods=['DELETE'])
def delete_anexo(anexo_id):
    return jsonify({"message": f"Anexo #{anexo_id} excluído com sucesso (simulação)!"}), 200
