# backend/Rotas/permissoes.py
from flask import Blueprint, jsonify, request
from ..db import get_db_connection, build_tree
import sqlite3
# Importa a função de criar notificação
from ..Rotas.notificacoes import criar_notificacao

bp = Blueprint('permissoes', __name__, url_prefix='/api')

@bp.route('/permissoes/hierarquia', methods=['GET'])
def get_permissoes_hierarquia():
    """
    Busca as permissões do banco de dados e as retorna como uma árvore.
    """
    conn = get_db_connection()
    permissoes_data = conn.execute('SELECT id, name, pai_id FROM permissoes_totais').fetchall()
    conn.close()
    
    permissoes_list = [dict(row) for row in permissoes_data]
    
    tree = build_tree(permissoes_list, id_field='id', parent_field='pai_id')
    return jsonify({'id': 'todas_permissoes', 'name': 'Todas as Permissões', 'children': tree})

@bp.route('/permissoes/sync_master_admin', methods=['POST'])
def sync_master_admin():
    """
    Garante que o perfil 'master_admin' tenha todas as permissões disponíveis do banco.
    """
    conn = get_db_connection()
    try:
        permissoes_data = conn.execute('SELECT id FROM permissoes_totais').fetchall()
        todos_os_ids_de_permissao = [p['id'] for p in permissoes_data]
        todos_os_ids_de_permissao.append('todas_permissoes')

        conn.execute('BEGIN')
        conn.execute('DELETE FROM permissoes_perfis WHERE perfil_id = ?', ('master_admin',))
        conn.executemany(
            'INSERT INTO permissoes_perfis (perfil_id, permissao_id) VALUES (?, ?)',
            [('master_admin', p_id) for p_id in todos_os_ids_de_permissao]
        )
        conn.commit()

    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao sincronizar permissões: {e}"}), 500
    finally:
        conn.close()
        
    return jsonify({"message": "Permissões do Master Admin sincronizadas com sucesso!"})

@bp.route('/permissoes/perfil/<string:perfil_id>', methods=['GET'])
def get_permissoes_por_perfil(perfil_id):
    conn = get_db_connection()
    permissoes = conn.execute('SELECT permissao_id FROM permissoes_perfis WHERE perfil_id = ?', (perfil_id,)).fetchall()
    conn.close()
    return jsonify([p['permissao_id'] for p in permissoes])

@bp.route('/permissoes/perfil/<string:perfil_id>', methods=['PUT'])
def update_permissoes_perfil(perfil_id):
    data = request.get_json()
    permissoes_ids = data.get('permissoes', [])
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        
        autor_id = data.pop('autor_id', None)
        autor_nome = "um utilizador"
        if autor_id:
            autor = conn.execute('SELECT nome FROM usuarios WHERE id = ?', (autor_id,)).fetchone()
            if autor:
                autor_nome = autor['nome']

        perfil = conn.execute('SELECT nome, editavel FROM perfis_acesso WHERE id = ?', (perfil_id,)).fetchone()
        if perfil and perfil['editavel'] == 0:
            return jsonify({"message": "As permissões do perfil master_admin não podem ser alteradas."}), 403
        
        conn.execute('DELETE FROM permissoes_perfis WHERE perfil_id = ?', (perfil_id,))
        if permissoes_ids:
            conn.executemany(
                'INSERT INTO permissoes_perfis (perfil_id, permissao_id) VALUES (?, ?)',
                [(perfil_id, p_id) for p_id in permissoes_ids]
            )
        
        # Cria a notificação estratégica
        texto_notificacao = f"As permissões do perfil '{perfil['nome']}' foram atualizadas por {autor_nome}."
        criar_notificacao(conn, 'bi-shield-lock-fill', texto_notificacao, 'cadastros', None, None, tipo_notificacao_estrategica='edicao_permissao_perfil')
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao salvar permissões: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Permissões atualizadas com sucesso!"})

@bp.route('/perfis', methods=['POST'])
def create_perfil():
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        
        autor_id = data.pop('autor_id', None)
        autor_nome = "um utilizador"
        if autor_id:
            autor = conn.execute('SELECT nome FROM usuarios WHERE id = ?', (autor_id,)).fetchone()
            if autor:
                autor_nome = autor['nome']

        existente = conn.execute('SELECT id FROM perfis_acesso WHERE id = ? OR nome = ?', (data['id'], data['nome'])).fetchone()
        if existente:
            return jsonify({"message": "Já existe um perfil com este ID ou Nome."}), 409
        
        conn.execute(
            'INSERT INTO perfis_acesso (id, nome, descricao, editavel, hierarquia) VALUES (?, ?, ?, 1, ?)',
            (data['id'], data['nome'], data['descricao'], data['hierarquia'])
        )
        
        # Cria a notificação estratégica
        texto_notificacao = f"O novo perfil de acesso '{data['nome']}' foi criado por {autor_nome}."
        criar_notificacao(conn, 'bi-person-badge-fill', texto_notificacao, 'cadastros', None, None, tipo_notificacao_estrategica='criacao_perfil')
        
        conn.commit()
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Perfil criado com sucesso!"}), 201

@bp.route('/perfis/ordenar', methods=['PUT'])
def reorder_perfis():
    data = request.get_json()
    nova_ordem_perfis = data.get('perfis', [])
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        for perfil in nova_ordem_perfis:
            conn.execute(
                'UPDATE perfis_acesso SET hierarquia = ? WHERE id = ?',
                (perfil['hierarquia'], perfil['id'])
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao reordenar perfis: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Ordem dos perfis atualizada com sucesso!"})

@bp.route('/perfis/<string:perfil_id>', methods=['DELETE'])
def delete_perfil(perfil_id):
    autor_id = request.args.get('autor_id')
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')

        autor_nome = "um utilizador"
        if autor_id:
            autor = conn.execute('SELECT nome FROM usuarios WHERE id = ?', (autor_id,)).fetchone()
            if autor:
                autor_nome = autor['nome']

        perfil = conn.execute('SELECT nome, editavel FROM perfis_acesso WHERE id = ?', (perfil_id,)).fetchone()
        if not perfil:
            return jsonify({"message": "Perfil não encontrado."}), 404
        if perfil['editavel'] == 0:
            return jsonify({"message": "Este perfil não pode ser excluído."}), 403
        
        nome_perfil = perfil['nome']
        
        conn.execute('DELETE FROM permissoes_perfis WHERE perfil_id = ?', (perfil_id,))
        conn.execute('DELETE FROM perfis_acesso WHERE id = ?', (perfil_id,))
        
        # Cria a notificação estratégica
        texto_notificacao = f"O perfil de acesso '{nome_perfil}' foi excluído por {autor_nome}."
        criar_notificacao(conn, 'bi-person-x-fill', texto_notificacao, 'cadastros', None, None, tipo_notificacao_estrategica='exclusao_perfil')
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao excluir perfil: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Perfil excluído com sucesso!"})
