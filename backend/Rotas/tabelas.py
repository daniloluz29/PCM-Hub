# backend/Rotas/tabelas.py
from flask import Blueprint, jsonify, request
from ..db import get_db_connection
import sqlite3
import re
from datetime import date, timedelta
import math

bp = Blueprint('tabelas', __name__, url_prefix='/api')

# --- LISTA DE TABELAS PROTEGIDAS ---
# Tabelas essenciais para o funcionamento do sistema que não podem ser alteradas/excluídas via UI.
CORE_TABLES = [
    'usuarios', 'perfis_acesso', 'permissoes_perfis', 'permissoes_totais', 
    'centros_custo', 'preventivas', 'chamados', 'solicitacoes_cadastro',
    'eventos', 'ga_itens', 'ga_responsaveis', 'ga_subitens', 'notificacoes',
    'notificacoes_status_usuarios', 'tabelas', 'importacoes_bd', 'calendario'
]

# --- FUNÇÃO DINÂMICA PARA BUSCAR TABELAS EDITÁVEIS ---
def get_allowed_tables():
    """Busca no banco de dados a lista de tabelas de apoio que são editáveis."""
    conn = get_db_connection()
    tabelas_db = conn.execute("SELECT id FROM tabelas WHERE id != 'calendario'").fetchall()
    conn.close()
    return [row['id'] for row in tabelas_db]

# --- ROTA PARA GERAR O CALENDÁRIO ---
@bp.route('/tabelas/calendario/gerar', methods=['POST'])
def gerar_calendario():
    # ... (código existente sem alterações)
    data = request.get_json()
    start_date_str = data.get('data_inicio')
    end_date_str = data.get('data_fim')
    if not start_date_str or not end_date_str: return jsonify({"message": "Data de início e fim são obrigatórias."}), 400
    try:
        start_date = date.fromisoformat(start_date_str)
        end_date = date.fromisoformat(end_date_str)
    except ValueError:
        return jsonify({"message": "Formato de data inválido. Use AAAA-MM-DD."}), 400
    dias_semana = ["Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira", "Sábado", "Domingo"]
    meses_extenso = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
    calendario_data = []
    current_date = start_date
    while current_date <= end_date:
        semana_do_ano = current_date.isocalendar()[1]
        primeiro_dia_mes = current_date.replace(day=1)
        primeira_semana_mes = primeiro_dia_mes.isocalendar()[1]
        semana_do_mes = semana_do_ano - primeira_semana_mes + 1
        if semana_do_ano < primeira_semana_mes: semana_do_mes = semana_do_ano + 52 - primeira_semana_mes + 1
        calendario_data.append({
            "data": current_date.strftime("%Y-%m-%d"), "dia": current_date.day, "diasemana": dias_semana[current_date.weekday()],
            "diaano": current_date.timetuple().tm_yday, "mesext": meses_extenso[current_date.month - 1], "mes": current_date.month,
            "bimestre": math.ceil(current_date.month / 2), "trimestre": math.ceil(current_date.month / 3),
            "quadrimestre": math.ceil(current_date.month / 4), "semestre": math.ceil(current_date.month / 6),
            "ano": current_date.year, "semanames": semana_do_mes, "semanaano": semana_do_ano
        })
        current_date += timedelta(days=1)
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        conn.execute('DELETE FROM calendario')
        if calendario_data:
            cursor = conn.cursor()
            cursor.executemany("INSERT INTO calendario VALUES (:data, :dia, :diasemana, :diaano, :mesext, :mes, :bimestre, :trimestre, :quadrimestre, :semestre, :ano, :semanames, :semanaano)", calendario_data)
        conn.commit()
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": f"Calendário gerado com sucesso com {len(calendario_data)} dias!"}), 200

# --- ROTAS EXISTENTES ---
@bp.route('/tabelas', methods=['GET'])
def get_lista_tabelas():
    # ... (código existente sem alterações)
    conn = get_db_connection()
    tabelas = conn.execute('SELECT id, tabela FROM tabelas ORDER BY tabela ASC').fetchall()
    conn.close()
    return jsonify([dict(row) for row in tabelas])


@bp.route('/tabelas/<string:table_name>', methods=['GET'])
def get_tabela_data(table_name):
    # ... (código existente sem alterações)
    allowed_tables = get_allowed_tables()
    if table_name not in allowed_tables and table_name != 'calendario': return jsonify({"message": "Acesso não permitido a esta tabela."}), 403
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(f'SELECT * FROM {table_name} LIMIT 0')
        column_names = [description[0] for description in cursor.description] if cursor.description else []
        order_by_clause = "ORDER BY data" if table_name == 'calendario' else ""
        data = conn.execute(f'SELECT * FROM {table_name} {order_by_clause}').fetchall()
        rows = [dict(row) for row in data]
        pk_info = None
        table_info = conn.execute(f'PRAGMA table_info({table_name})').fetchall()
        for column in table_info:
            if column['pk'] > 0:
                pk_info = { "name": column['name'], "type": column['type'] }
                break
        return jsonify({"columns": column_names, "rows": rows, "pk_info": pk_info})
    except sqlite3.Error as e:
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()

@bp.route('/tabelas/<string:table_name>', methods=['PUT'])
def update_tabela_data(table_name):
    # ... (código existente sem alterações)
    allowed_tables = get_allowed_tables()
    if table_name not in allowed_tables: return jsonify({"message": "Acesso não permitido para alterar esta tabela."}), 403
    data = request.get_json()
    if not isinstance(data, list): return jsonify({"message": "Dados inválidos. É esperada uma lista de objetos."}), 400
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        conn.execute(f'DELETE FROM {table_name}')
        if data:
            columns = data[0].keys()
            cols_str = ', '.join(columns)
            placeholders = ', '.join(['?'] * len(columns))
            rows_to_insert = [tuple(item.get(col) for col in columns) for item in data]
            conn.executemany(f'INSERT INTO {table_name} ({cols_str}) VALUES ({placeholders})', rows_to_insert)
        conn.commit()
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": f"Tabela '{table_name}' atualizada com sucesso!"})


# --- ROTAS DE GERENCIAMENTO DE BANCO DE DADOS ---

@bp.route('/db/all-tables', methods=['GET'])
def get_all_db_tables():
    # ... (código existente sem alterações)
    conn = get_db_connection()
    try:
        tables_db = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC").fetchall()
        tables_list = [{"value": row['name'], "label": row['name']} for row in tables_db]
        return jsonify(tables_list)
    except sqlite3.Error as e:
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()

@bp.route('/tabelas/<string:table_name>/Query', methods=['GET'])
def get_table_Query(table_name):
    # ... (código existente sem alterações)
    conn = get_db_connection()
    try:
        Query = conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?", (table_name,)).fetchone()
        if Query and Query['sql']:
            return jsonify({"Query": Query['sql']})
        else:
            return jsonify({"message": "Tabela não encontrada ou sem Query definido."}), 404
    except sqlite3.Error as e:
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()

@bp.route('/tabelas/criar', methods=['POST'])
def create_new_table():
    # ... (código existente sem alterações)
    data = request.get_json()
    table_id, table_display_name, query = data.get('id'), data.get('tabela'), data.get('query')
    if not all([table_id, table_display_name, query]): return jsonify({"message": "ID, Nome de Exibição e Query são obrigatórios."}), 400
    if not query.strip().upper().startswith('CREATE TABLE'): return jsonify({"message": "A query deve ser um comando 'CREATE TABLE'."}), 400
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        conn.execute(query)
        conn.execute("INSERT INTO tabelas (id, tabela) VALUES (?, ?)", (table_id, table_display_name))
        conn.commit()
        return jsonify({"message": f"Tabela '{table_id}' criada e registrada com sucesso!"}), 201
    except sqlite3.Error as e:
        conn.rollback()
        if "already exists" in str(e): return jsonify({"message": f"Erro: A tabela '{table_id}' já existe."}), 409
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()

@bp.route('/tabelas/<string:table_name>/alter-safe', methods=['PUT'])
def alter_table_Query_safely(table_name):
    """
    Recria uma tabela com um novo Query, preservando os dados existentes
    em colunas com o mesmo nome.
    """
    if table_name in CORE_TABLES:
        return jsonify({"message": "Esta é uma tabela principal do sistema e não pode ser alterada."}), 403

    data = request.get_json()
    new_query = data.get('query')

    if not new_query or not new_query.strip().upper().startswith('CREATE TABLE'):
        return jsonify({"message": "A query fornecida é inválida."}), 400
    
    conn = get_db_connection()
    try:
        # 1. Obter Query antigo e colunas
        old_cols_info = conn.execute(f'PRAGMA table_info({table_name})').fetchall()
        old_cols = [col['name'] for col in old_cols_info]

        # 2. Iniciar transação e renomear tabela antiga
        conn.execute('BEGIN')
        temp_table_name = f"_temp_backup_{table_name}"
        conn.execute(f'ALTER TABLE {table_name} RENAME TO {temp_table_name}')

        # 3. Criar nova tabela com o novo Query
        conn.execute(new_query)

        # 4. Obter colunas da nova tabela e encontrar as comuns
        new_cols_info = conn.execute(f'PRAGMA table_info({table_name})').fetchall()
        new_cols = [col['name'] for col in new_cols_info]
        common_cols = [col for col in old_cols if col in new_cols]
        common_cols_str = ', '.join(f'"{col}"' for col in common_cols)

        # 5. Copiar dados das colunas comuns
        if common_cols:
            conn.execute(f'INSERT INTO {table_name} ({common_cols_str}) SELECT {common_cols_str} FROM {temp_table_name}')

        # 6. Excluir tabela de backup
        conn.execute(f'DROP TABLE {temp_table_name}')
        
        conn.commit()
        return jsonify({"message": f"Query da tabela '{table_name}' atualizado com sucesso. Os dados foram preservados."}), 200

    except sqlite3.Error as e:
        conn.rollback()
        # Tenta restaurar o backup em caso de erro
        try:
            conn.execute(f'DROP TABLE IF EXISTS {table_name}')
            conn.execute(f'ALTER TABLE {temp_table_name} RENAME TO {table_name}')
            conn.commit()
        except sqlite3.Error as restore_e:
            print(f"ERRO CRÍTICO ao restaurar backup da tabela {table_name}: {restore_e}")
        return jsonify({"message": f"Erro no banco de dados ao alterar Query: {e}"}), 500
    finally:
        conn.close()

@bp.route('/tabelas/<string:table_name>', methods=['DELETE'])
def delete_table(table_name):
    """Exclui uma tabela do banco de dados e do registro."""
    if table_name in CORE_TABLES:
        return jsonify({"message": "Esta é uma tabela principal do sistema e não pode ser excluída."}), 403

    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        conn.execute(f'DROP TABLE IF EXISTS {table_name}')
        conn.execute("DELETE FROM tabelas WHERE id = ?", (table_name,))
        conn.commit()
        return jsonify({"message": f"Tabela '{table_name}' foi excluída com sucesso."}), 200
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"message": f"Erro no banco de dados ao excluir tabela: {e}"}), 500
    finally:
        conn.close()

# NOVO ENDPOINT PARA PRÉ-VISUALIZAÇÃO DE DADOS
@bp.route('/tabelas/<string:table_name>/preview', methods=['GET'])
def get_table_preview(table_name):
    """Retorna as 5 primeiras linhas de uma tabela para pré-visualização."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(f'SELECT * FROM {table_name} LIMIT 10')
        column_names = [description[0] for description in cursor.description] if cursor.description else []
        rows = cursor.fetchall()
        
        return jsonify({
            "columns": column_names,
            "rows": [dict(row) for row in rows]
        })
    except sqlite3.Error as e:
        return jsonify({"message": f"Erro ao buscar prévia: {e}"}), 500
    finally:
        conn.close()

# NOVO: ENDPOINT PARA DETALHES DA TABELA (PK, NOT NULL)
@bp.route('/tabelas/<string:table_name>/details', methods=['GET'])
def get_table_details(table_name):
    """Retorna detalhes das colunas de uma tabela, incluindo PK e NOT NULL."""
    conn = get_db_connection()
    try:
        table_info = conn.execute(f'PRAGMA table_info({table_name})').fetchall()
        if not table_info:
            return jsonify({"message": "Tabela não encontrada."}), 404
        
        details = [
            {"name": col['name'], "type": col['type'], "notnull": bool(col['notnull']), "pk": bool(col['pk'])}
            for col in table_info
        ]
        return jsonify(details)
    except sqlite3.Error as e:
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()

# ATUALIZADO: Endpoint para inserção com verificação customizada de duplicatas
@bp.route('/tabelas/<string:table_name>/insert-data-custom', methods=['POST'])
def insert_table_data_custom(table_name):
    """Insere dados em uma tabela, ignorando linhas que já existem com base em colunas customizadas."""
    if table_name in CORE_TABLES:
        return jsonify({"message": "Não é permitido inserir dados em tabelas do sistema por esta interface."}), 403
        
    request_data = request.get_json()
    data = request_data.get('data')
    check_columns = request_data.get('check_columns')
    check_mode = request_data.get('check_mode', 'AND') # Padrão para 'AND'

    if not all([isinstance(data, list), data, check_columns]):
        return jsonify({"message": "Payload inválido. É esperada uma lista de registros e as colunas de verificação."}), 400

    conn = get_db_connection()
    try:
        table_info = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
        table_columns = [col['name'] for col in table_info]
        
        conn.execute('BEGIN')
        cursor = conn.cursor()
        inserted_count = 0
        
        for row in data:
            # 1. Constrói a query de verificação de duplicata
            where_clause = f" {check_mode} ".join([f'"{col}" = ?' for col in check_columns])
            params = [row.get(col) for col in check_columns]
            
            cursor.execute(f"SELECT 1 FROM {table_name} WHERE {where_clause} LIMIT 1", tuple(params))
            exists = cursor.fetchone()
            
            # 2. Se não existir, insere
            if not exists:
                valid_row = {key: value for key, value in row.items() if key in table_columns}
                cols_str = ', '.join(f'"{k}"' for k in valid_row.keys())
                placeholders = ', '.join(['?'] * len(valid_row))
                
                cursor.execute(f"INSERT INTO {table_name} ({cols_str}) VALUES ({placeholders})", tuple(valid_row.values()))
                inserted_count += 1
        
        conn.commit()
        
        return jsonify({
            "message": f"Operação concluída. {inserted_count} novas linhas inseridas. {len(data) - inserted_count} linhas foram ignoradas por já existirem."
        }), 200

    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()
