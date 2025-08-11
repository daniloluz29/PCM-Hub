from flask import Blueprint, jsonify, request
from ..db import get_db_connection
from datetime import datetime
import json

bp = Blueprint('gestao_acoes', __name__, url_prefix='/api')

# Funções de checagem de permissão atualizadas
def checar_permissao_mensagem_tarefa(conn, mensagem_id, usuario_id_sessao, permissoes_sessao=None):
    if permissoes_sessao is None:
        permissoes_sessao = []

    if 'gestao_acoes_chat_excluir' in permissoes_sessao:
        return True, "OK", 200

    cursor = conn.cursor()
    cursor.execute("SELECT * FROM ga_chat_tarefas WHERE id = ?", (mensagem_id,))
    msg = cursor.fetchone()
    if not msg: return False, "Mensagem não encontrada.", 404
    cursor.execute("SELECT MAX(ordem) FROM ga_chat_tarefas WHERE tarefa_id = ?", (msg['tarefa_id'],))
    max_ordem = cursor.fetchone()[0]
    if msg['usuario_id'] != usuario_id_sessao: return False, "Você não pode modificar a mensagem de outro usuário.", 403
    if msg['ordem'] != max_ordem: return False, "Apenas a última mensagem pode ser modificada.", 403
    return True, "OK", 200

def checar_permissao_mensagem_plano(conn, mensagem_id, usuario_id_sessao, permissoes_sessao=None):
    if permissoes_sessao is None:
        permissoes_sessao = []
        
    if 'gestao_acoes_chat_excluir' in permissoes_sessao:
        return True, "OK", 200
        
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM ga_chat_planos WHERE id = ?", (mensagem_id,))
    msg = cursor.fetchone()
    if not msg: return False, "Mensagem não encontrada.", 404
    cursor.execute("SELECT MAX(ordem) FROM ga_chat_planos WHERE plano_id = ?", (msg['plano_id'],))
    max_ordem = cursor.fetchone()[0]
    if msg['usuario_id'] != usuario_id_sessao: return False, "Você não pode modificar a mensagem de outro usuário.", 403
    if msg['ordem'] != max_ordem: return False, "Apenas a última mensagem pode ser modificada.", 403
    return True, "OK", 200

# Endpoints Principais de Gestão de Ações
@bp.route('/gestao-acoes', methods=['GET'])
def get_all_itens():
    conn = get_db_connection()
    itens = conn.execute('SELECT id, tipo, titulo, descricao, prioridade, status, data_prazo, checklist_titulo, criado_por_id, data_criacao, data_conclusao FROM ga_itens ORDER BY data_criacao DESC').fetchall()
    itens_dict = {item['id']: dict(item) for item in itens}
    for item_id in itens_dict:
        itens_dict[item_id]['responsaveis'] = []
        itens_dict[item_id]['subtasks_total'] = 0
        itens_dict[item_id]['subtasks_completed'] = 0
    responsaveis = conn.execute('SELECT r.item_id, u.id, u.nome FROM ga_responsaveis r JOIN usuarios u ON r.usuario_id = u.id').fetchall()
    preposicoes = ['de', 'da', 'do', 'dos', 'das']
    for resp in responsaveis:
        if resp['item_id'] in itens_dict:
            nomes = [nome for nome in resp['nome'].lower().split() if nome not in preposicoes]
            iniciais = (nomes[0][0] + nomes[1][0]).upper() if len(nomes) >= 2 else resp['nome'][:2].upper() if len(nomes) == 1 else '?'
            itens_dict[resp['item_id']]['responsaveis'].append({"id": resp['id'], "iniciais": iniciais, "nome": resp['nome']})
    subtasks = conn.execute("SELECT item_pai_id, COUNT(id) as total, SUM(concluido) as completed FROM ga_subitens WHERE tipo = 'Checklist' GROUP BY item_pai_id").fetchall()
    for subtask_info in subtasks:
        item_id = subtask_info['item_pai_id']
        if item_id in itens_dict:
            itens_dict[item_id]['subtasks_total'] = subtask_info['total']
            itens_dict[item_id]['subtasks_completed'] = subtask_info['completed'] or 0
    conn.close()
    return jsonify(list(itens_dict.values()))

@bp.route('/gestao-acoes/<int:id>', methods=['DELETE'])
def delete_ga_item(id):
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        conn.execute('DELETE FROM ga_responsaveis WHERE item_id = ?', (id,))
        conn.execute('DELETE FROM ga_subitens WHERE item_pai_id = ?', (id,))
        conn.execute('DELETE FROM ga_chat_tarefas WHERE tarefa_id = ?', (id,))
        conn.execute('DELETE FROM ga_chat_planos WHERE plano_id = ?', (id,))
        cursor = conn.execute('DELETE FROM ga_itens WHERE id = ?', (id,))
        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({"message": "Item não encontrado."}), 404
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao excluir item: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Item e todos os dados relacionados foram excluídos com sucesso."})

# Endpoints de Tarefas
@bp.route('/tarefas', methods=['POST'])
def create_tarefa():
    data = request.get_json()
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO ga_itens (tipo, titulo, descricao, prioridade, status, data_prazo, checklist_titulo, criado_por_id, data_criacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ('Tarefa', data['titulo'], data['descricao'], data['prioridade'], 'A Fazer', data['data_entrega'], data['checklistTitle'], 1, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        )
        item_id = cursor.lastrowid
        for resp_id in data['responsaveis']:
            conn.execute('INSERT INTO ga_responsaveis (item_id, usuario_id) VALUES (?, ?)', (item_id, resp_id))
        
        checklist = data.get('checklist', [])
        if not checklist or all(not item.get('texto', '').strip() for item in checklist):
            checklist = [{'texto': 'Conclusão da tarefa'}]

        for i, chk_item in enumerate(checklist):
            conn.execute('INSERT INTO ga_subitens (item_pai_id, tipo, titulo, ordem) VALUES (?, ?, ?, ?)', (item_id, 'Checklist', chk_item['texto'], i))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Tarefa criada com sucesso!"}), 201

@bp.route('/tarefas/<int:id>', methods=['GET'])
def get_tarefa_detalhes(id):
    conn = get_db_connection()
    item = conn.execute('SELECT * FROM ga_itens WHERE id = ? AND tipo = "Tarefa"', (id,)).fetchone()
    if not item: return jsonify({"message": "Tarefa não encontrada."}), 404
    item_dict = dict(item)
    responsaveis_db = conn.execute('SELECT u.id, u.nome FROM ga_responsaveis r JOIN usuarios u ON r.usuario_id = u.id WHERE r.item_id = ?', (id,)).fetchall()
    preposicoes = ['de', 'da', 'do', 'dos', 'das']
    responsaveis = []
    for resp in responsaveis_db:
        nomes = [nome for nome in resp['nome'].lower().split() if nome not in preposicoes]
        iniciais = (nomes[0][0] + nomes[1][0]).upper() if len(nomes) >= 2 else resp['nome'][:2].upper()
        responsaveis.append({"id": resp['id'], "nome": resp['nome'], "iniciais": iniciais})
    item_dict['responsaveis'] = responsaveis
    checklist_db = conn.execute('SELECT * FROM ga_subitens WHERE item_pai_id = ? AND tipo = "Checklist" ORDER BY ordem', (id,)).fetchall()
    item_dict['checklist'] = [dict(row) for row in checklist_db]
    conn.close()
    return jsonify(item_dict)

@bp.route('/tarefas/<int:id>', methods=['PUT'])
def update_tarefa_completa(id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        
        current_item = conn.execute('SELECT status FROM ga_itens WHERE id = ?', (id,)).fetchone()
        
        # Se um status for enviado explicitamente (ex: "Cancelado"), usa ele.
        if data.get('status'):
            novo_status = data.get('status')
            if novo_status == 'Concluído' and (not current_item or current_item['status'] != 'Concluído'):
                 conn.execute('UPDATE ga_itens SET status = ?, data_conclusao = ? WHERE id = ?', (novo_status, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), id))
            elif novo_status != 'Concluído' and current_item and current_item['status'] == 'Concluído':
                conn.execute('UPDATE ga_itens SET status = ?, data_conclusao = NULL WHERE id = ?', (novo_status, id))
            else:
                conn.execute('UPDATE ga_itens SET status = ? WHERE id = ?', (novo_status, id))

        # Atualiza outros campos
        conn.execute('UPDATE ga_itens SET titulo = ?, descricao = ?, data_prazo = ? WHERE id = ?', 
                     (data['titulo'], data['descricao'], data['data_prazo'], id))

        conn.execute('DELETE FROM ga_responsaveis WHERE item_id = ?', (id,))
        if data.get('responsaveis'):
            for resp_id in data['responsaveis']:
                conn.execute('INSERT INTO ga_responsaveis (item_id, usuario_id) VALUES (?, ?)', (id, resp_id))
        
        if data.get('deleted_checklist_ids'):
            for sub_id in data['deleted_checklist_ids']:
                conn.execute('DELETE FROM ga_subitens WHERE id = ?', (sub_id,))

        if data.get('checklist'):
            for item in data['checklist']:
                if str(item['id']).startswith('new_'):
                    conn.execute('INSERT INTO ga_subitens (item_pai_id, tipo, titulo, concluido, ordem) VALUES (?, ?, ?, ?, ?)', (id, 'Checklist', item['titulo'], item['concluido'], item['ordem']))
                else:
                    conn.execute('UPDATE ga_subitens SET titulo = ?, concluido = ?, ordem = ? WHERE id = ?', (item['titulo'], item['concluido'], item['ordem'], item['id']))

        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao atualizar tarefa: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Tarefa atualizada com sucesso!"})


# Endpoints de Planos de Ação
@bp.route('/planos-acao', methods=['POST'])
def create_plano_acao():
    data = request.get_json()
    conn = get_db_connection()
    try:
        if not data.get('objetivos') or not any(obj.get('tarefas') and any(t.get('acao', '').strip() for t in obj['tarefas']) for obj in data['objetivos']):
            return jsonify({"message": "Um plano de ação deve ter pelo menos um objetivo e uma tarefa com nome."}), 400

        cursor = conn.cursor()
        cursor.execute('INSERT INTO ga_itens (tipo, titulo, descricao, prioridade, status, data_prazo, criado_por_id, data_criacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ('Plano de Ação', data['titulo'], data['descricao'], data['prioridade'], 'A Fazer', data['prazoFinal'], 1, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        plano_id = cursor.lastrowid
        for resp_id in data['responsaveis']:
            conn.execute('INSERT INTO ga_responsaveis (item_id, usuario_id) VALUES (?, ?)', (plano_id, resp_id))
        ordem = 0
        for objetivo in data['objetivos']:
            ordem += 1
            conn.execute('INSERT INTO ga_subitens (item_pai_id, tipo, titulo, ordem) VALUES (?, ?, ?, ?)', (plano_id, 'Objetivo', objetivo['acao'], ordem))
            for tarefa in objetivo['tarefas']:
                ordem += 1
                conn.execute('INSERT INTO ga_subitens (item_pai_id, tipo, titulo, responsavel_id, prioridade, data_inicio, data_prazo, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', (plano_id, 'TarefaPlano', tarefa['acao'], tarefa.get('responsavel_id'), tarefa.get('prioridade'), tarefa.get('comeco'), tarefa.get('prazo'), ordem))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Plano de Ação criado com sucesso!"}), 201

@bp.route('/planos-acao/<int:id>', methods=['GET'])
def get_plano_acao_detalhes(id):
    conn = get_db_connection()
    item = conn.execute('SELECT * FROM ga_itens WHERE id = ? AND tipo = "Plano de Ação"', (id,)).fetchone()
    if not item: return jsonify({"message": "Plano de Ação não encontrado."}), 404
    item_dict = dict(item)
    subitens_db = conn.execute('SELECT s.*, u.nome as responsavel_nome FROM ga_subitens s LEFT JOIN usuarios u ON s.responsavel_id = u.id WHERE s.item_pai_id = ? ORDER BY s.ordem', (id,)).fetchall()
    objetivos = []
    tarefas_do_objetivo_atual = []
    for subitem in subitens_db:
        if subitem['tipo'] == 'Objetivo':
            if tarefas_do_objetivo_atual:
                objetivos[-1]['tarefas'] = tarefas_do_objetivo_atual
            tarefas_do_objetivo_atual = []
            objetivos.append(dict(subitem))
        elif subitem['tipo'] == 'TarefaPlano':
            tarefas_do_objetivo_atual.append(dict(subitem))
    if tarefas_do_objetivo_atual and objetivos:
        objetivos[-1]['tarefas'] = tarefas_do_objetivo_atual
    for obj in objetivos:
        if 'tarefas' not in obj:
            obj['tarefas'] = []
    item_dict['objetivos'] = objetivos
    conn.close()
    return jsonify(item_dict)

@bp.route('/planos-acao/<int:id>', methods=['PUT'])
def update_plano_acao(id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')

        # ATUALIZAÇÃO: Adiciona a lógica de status para o plano
        if data.get('status'):
             conn.execute('UPDATE ga_itens SET status = ? WHERE id = ?', (data.get('status'), id))
        
        conn.execute('DELETE FROM ga_subitens WHERE item_pai_id = ?', (id,))
        ordem = 0
        total_tarefas = 0
        tarefas_concluidas = 0
        for objetivo in data.get('objetivos', []):
            ordem += 1
            conn.execute('INSERT INTO ga_subitens (item_pai_id, tipo, titulo, ordem) VALUES (?, ?, ?, ?)', (id, 'Objetivo', objetivo['titulo'], ordem))
            for tarefa in objetivo.get('tarefas', []):
                total_tarefas += 1
                if tarefa.get('concluido', 0) == 1:
                    tarefas_concluidas += 1
                ordem += 1
                conn.execute('INSERT INTO ga_subitens (item_pai_id, tipo, titulo, responsavel_id, prioridade, data_inicio, data_prazo, comentarios, concluido, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', (id, 'TarefaPlano', tarefa['titulo'], tarefa.get('responsavel_id'), tarefa.get('prioridade'), tarefa.get('data_inicio'), tarefa.get('data_prazo'), tarefa.get('comentarios'), tarefa.get('concluido', 0), ordem))

        # Lógica de status dinâmico para o plano, se não for cancelado
        if data.get('status') != 'Cancelado':
            novo_status = 'A Fazer'
            if total_tarefas > 0:
                if tarefas_concluidas == total_tarefas:
                    novo_status = 'Concluído'
                elif tarefas_concluidas > 0:
                    novo_status = 'Em Andamento'
            
            conn.execute('UPDATE ga_itens SET status = ? WHERE id = ?', (novo_status, id))

        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao atualizar o Plano de Ação: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Plano de Ação atualizado com sucesso!"})

# Endpoints de Chat de Tarefas
@bp.route('/tarefas/<int:tarefa_id>/chat', methods=['GET'])
def get_tarefa_chat(tarefa_id):
    conn = get_db_connection()
    query = "SELECT gc.*, u.nome as usuario_nome FROM ga_chat_tarefas gc JOIN usuarios u ON gc.usuario_id = u.id WHERE gc.tarefa_id = ? ORDER BY gc.ordem ASC"
    mensagens = conn.execute(query, (tarefa_id,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in mensagens])

@bp.route('/tarefas/<int:tarefa_id>/chat', methods=['POST'])
def add_tarefa_chat_mensagem(tarefa_id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        usuario_id, conteudo = data.get('usuario_id'), data.get('conteudo')
        cursor = conn.cursor()
        cursor.execute("SELECT MAX(ordem) FROM ga_chat_tarefas WHERE tarefa_id = ?", (tarefa_id,))
        nova_ordem = (cursor.fetchone()[0] or 0) + 1
        conn.execute('INSERT INTO ga_chat_tarefas (tarefa_id, usuario_id, data_hora, conteudo, ordem) VALUES (?, ?, ?, ?, ?)', (tarefa_id, usuario_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), conteudo, nova_ordem))
        conn.commit()
    except Exception as e:
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Mensagem adicionada com sucesso!"}), 201

@bp.route('/tarefas/chat/mensagens/<int:id>', methods=['PUT'])
def update_tarefa_chat_mensagem(id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        permitido, msg, status_code = checar_permissao_mensagem_tarefa(conn, id, data.get('usuario_id_sessao'), data.get('permissoes'))
        if not permitido: return jsonify({"message": msg}), status_code
        conn.execute("UPDATE ga_chat_tarefas SET conteudo = ? WHERE id = ?", (data.get('conteudo'), id))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"message": "Mensagem atualizada com sucesso!"})

@bp.route('/tarefas/chat/mensagens/<int:id>', methods=['DELETE'])
def delete_tarefa_chat_mensagem(id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        permitido, msg, status_code = checar_permissao_mensagem_tarefa(conn, id, data.get('usuario_id_sessao'), data.get('permissoes'))
        if not permitido: return jsonify({"message": msg}), status_code
        conn.execute("DELETE FROM ga_chat_tarefas WHERE id = ?", (id,))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"message": "Mensagem excluída com sucesso!"})

@bp.route('/tarefas/chat/mensagens/<int:id>/reacao', methods=['POST'])
def add_or_update_tarefa_reacao(id):
    reacao = request.json.get('reacao')
    conn = get_db_connection()
    try:
        conn.execute("UPDATE ga_chat_tarefas SET reacao = ? WHERE id = ?", (reacao, id))
        conn.commit()
    except Exception as e:
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Reação atualizada."})

# Endpoints de Chat de Planos de Ação
@bp.route('/planos-acao/<int:plano_id>/chat', methods=['GET'])
def get_plano_chat(plano_id):
    conn = get_db_connection()
    query = "SELECT gc.*, u.nome as usuario_nome FROM ga_chat_planos gc JOIN usuarios u ON gc.usuario_id = u.id WHERE gc.plano_id = ? ORDER BY gc.ordem ASC"
    mensagens = conn.execute(query, (plano_id,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in mensagens])

@bp.route('/planos-acao/<int:plano_id>/chat', methods=['POST'])
def add_plano_chat_mensagem(plano_id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        usuario_id, conteudo = data.get('usuario_id'), data.get('conteudo')
        cursor = conn.cursor()
        cursor.execute("SELECT MAX(ordem) FROM ga_chat_planos WHERE plano_id = ?", (plano_id,))
        nova_ordem = (cursor.fetchone()[0] or 0) + 1
        conn.execute('INSERT INTO ga_chat_planos (plano_id, usuario_id, data_hora, conteudo, ordem) VALUES (?, ?, ?, ?, ?)', (plano_id, usuario_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), conteudo, nova_ordem))
        conn.commit()
    except Exception as e:
        return jsonify({"message": f"Erro: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Mensagem adicionada com sucesso!"}), 201

@bp.route('/planos-acao/chat/mensagens/<int:id>', methods=['PUT'])
def update_plano_chat_mensagem(id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        permitido, msg, status_code = checar_permissao_mensagem_plano(conn, id, data.get('usuario_id_sessao'), data.get('permissoes'))
        if not permitido: return jsonify({"message": msg}), status_code
        conn.execute("UPDATE ga_chat_planos SET conteudo = ? WHERE id = ?", (data.get('conteudo'), id))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"message": "Mensagem atualizada com sucesso!"})

@bp.route('/planos-acao/chat/mensagens/<int:id>', methods=['DELETE'])
def delete_plano_chat_mensagem(id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        permitido, msg, status_code = checar_permissao_mensagem_plano(conn, id, data.get('usuario_id_sessao'), data.get('permissoes'))
        if not permitido: return jsonify({"message": msg}), status_code
        conn.execute("DELETE FROM ga_chat_planos WHERE id = ?", (id,))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"message": "Mensagem excluída com sucesso!"})

@bp.route('/planos-acao/chat/mensagens/<int:id>/reacao', methods=['POST'])
def add_or_update_plano_reacao(id):
    reacao = request.json.get('reacao')
    conn = get_db_connection()
    try:
        conn.execute("UPDATE ga_chat_planos SET reacao = ? WHERE id = ?", (reacao, id))
        conn.commit()
    except Exception as e:
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Reação atualizada."})

# Endpoints de Sub-tarefas (Checklist)
@bp.route('/subtarefas', methods=['POST'])
def add_subtarefa():
    data = request.get_json()
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT MAX(ordem) FROM ga_subitens WHERE item_pai_id = ?", (data.get('item_pai_id'),))
        nova_ordem = (cursor.fetchone()[0] or 0) + 1
        cursor.execute('INSERT INTO ga_subitens (item_pai_id, tipo, titulo, ordem, concluido) VALUES (?, ?, ?, ?, ?)', (data.get('item_pai_id'), 'Checklist', data.get('titulo', 'Item'), nova_ordem, 0))
        new_id = cursor.lastrowid
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Subtarefa adicionada.", "id": new_id}), 201

@bp.route('/subtarefas/<int:id>', methods=['PUT'])
def update_subtarefa(id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        if 'titulo' in data:
            conn.execute('UPDATE ga_subitens SET titulo = ? WHERE id = ?', (data['titulo'], id))
        if 'concluido' in data:
            conn.execute('UPDATE ga_subitens SET concluido = ? WHERE id = ?', (data['concluido'], id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Subtarefa atualizada com sucesso."})

@bp.route('/subtarefas/<int:id>', methods=['DELETE'])
def delete_subtarefa(id):
    conn = get_db_connection()
    try:
        conn.execute('DELETE FROM ga_subitens WHERE id = ?', (id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Subtarefa excluída com sucesso."})
