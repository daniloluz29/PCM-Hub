# backend/Rotas/tabelas.py
from flask import Blueprint, jsonify, request
from ..db import get_db_connection, DATABASE_PATH
import sqlite3
import re
from datetime import date, datetime, timedelta
import os
import math
import time
import pandas as pd # Importar pandas para as novas funções

bp = Blueprint('tabelas', __name__, url_prefix='/api')
BACKUP_DATABASE_PATH = os.path.join(os.path.dirname(DATABASE_PATH), 'backupdb.db')

# --- FUNÇÕES AUXILIARES ---
def get_core_tables():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='core_tables'")
        if cursor.fetchone() is None:
            cursor.execute('''
                CREATE TABLE core_tables (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tabela TEXT NOT NULL UNIQUE
                )
            ''')
            conn.commit()
            return []
        core_tables_db = conn.execute("SELECT tabela FROM core_tables").fetchall()
        return [row['tabela'] for row in core_tables_db]
    finally:
        conn.close()

def get_allowed_tables():
    conn = get_db_connection()
    tabelas_db = conn.execute("SELECT id FROM tabelas WHERE id != 'calendario'").fetchall()
    conn.close()
    return [row['id'] for row in tabelas_db]

# --- ROTAS DE TABELAS DE APOIO ---
@bp.route('/tabelas/calendario/gerar', methods=['POST'])
def gerar_calendario():
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

@bp.route('/tabelas', methods=['GET'])
def get_lista_tabelas():
    conn = get_db_connection()
    tabelas = conn.execute('SELECT id, tabela FROM tabelas ORDER BY tabela ASC').fetchall()
    conn.close()
    return jsonify([dict(row) for row in tabelas])

@bp.route('/tabelas/<string:table_name>', methods=['GET'])
def get_tabela_data(table_name):
    allowed_tables = get_allowed_tables()
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
    allowed_tables = get_allowed_tables()
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
    conn = get_db_connection()
    try:
        tables_db = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC").fetchall()
        tables_list = [{"value": row['name'], "label": row['name']} for row in tables_db]
        return jsonify(tables_list)
    except sqlite3.Error as e:
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()
        
@bp.route('/db/core-tables', methods=['GET'])
def get_core_tables_management():
    conn = get_db_connection()
    try:
        all_tables_raw = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC").fetchall()
        all_tables = [row['name'] for row in all_tables_raw]
        core_tables = get_core_tables()
        return jsonify({ "all_tables": all_tables, "core_tables": core_tables })
    except sqlite3.Error as e:
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()

@bp.route('/db/core-tables', methods=['POST'])
def update_core_tables():
    data = request.get_json()
    core_tables_list = data.get('core_tables', [])
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        conn.execute('DELETE FROM core_tables')
        if core_tables_list:
            rows_to_insert = [(table_name,) for table_name in core_tables_list]
            conn.executemany("INSERT INTO core_tables (tabela) VALUES (?)", rows_to_insert)
        conn.commit()
        return jsonify({"message": "Lista de tabelas críticas atualizada com sucesso!"}), 200
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()

@bp.route('/tabelas/<string:table_name>/Query', methods=['GET'])
def get_table_Query(table_name):
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
    data = request.get_json()
    table_id, table_display_name, query, is_editable = data.get('id'), data.get('tabela'), data.get('query'), data.get('isEditable')
    
    if not table_id or not query:
        return jsonify({"message": "ID da tabela e Query são obrigatórios."}), 400
    if is_editable and not table_display_name:
        return jsonify({"message": "Nome de Exibição é obrigatório para tabelas editáveis."}), 400
    if not query.strip().upper().startswith('CREATE TABLE'):
        return jsonify({"message": "A query deve ser um comando 'CREATE TABLE'."}), 400
        
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        conn.execute(query)
        if is_editable:
            conn.execute("INSERT INTO tabelas (id, tabela) VALUES (?, ?)", (table_id, table_display_name))
        conn.commit()
        return jsonify({"message": f"Tabela '{table_id}' criada com sucesso!"}), 201
    except sqlite3.Error as e:
        conn.rollback()
        if "already exists" in str(e): return jsonify({"message": f"Erro: A tabela '{table_id}' já existe."}), 409
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()

@bp.route('/tabelas/<string:table_name>/alter-safe', methods=['PUT'])
def alter_table_Query_safely(table_name):
    if table_name in get_core_tables():
        return jsonify({"message": "Esta é uma tabela crítica do sistema e não pode ser alterada."}), 403
    data = request.get_json()
    new_query = data.get('query')
    if not new_query or not new_query.strip().upper().startswith('CREATE TABLE'):
        return jsonify({"message": "A query fornecida é inválida."}), 400
    conn = get_db_connection()
    try:
        old_cols_info = conn.execute(f'PRAGMA table_info({table_name})').fetchall()
        old_cols = [col['name'] for col in old_cols_info]
        conn.execute('BEGIN')
        temp_table_name = f"_temp_backup_{table_name}"
        conn.execute(f'ALTER TABLE {table_name} RENAME TO {temp_table_name}')
        conn.execute(new_query)
        new_cols_info = conn.execute(f'PRAGMA table_info({table_name})').fetchall()
        new_cols = [col['name'] for col in new_cols_info]
        common_cols = [col for col in old_cols if col in new_cols]
        common_cols_str = ', '.join(f'"{col}"' for col in common_cols)
        if common_cols:
            conn.execute(f'INSERT INTO {table_name} ({common_cols_str}) SELECT {common_cols_str} FROM {temp_table_name}')
        conn.execute(f'DROP TABLE {temp_table_name}')
        conn.commit()
        return jsonify({"message": f"Query da tabela '{table_name}' atualizado com sucesso. Os dados foram preservados."}), 200
    except sqlite3.Error as e:
        conn.rollback()
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
    if table_name in get_core_tables():
        return jsonify({"message": "Esta é uma tabela crítica do sistema e não pode ser excluída."}), 403
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

@bp.route('/tabelas/<string:table_name>/preview', methods=['GET'])
def get_table_preview(table_name):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(f'SELECT * FROM {table_name} LIMIT 10')
        column_names = [description[0] for description in cursor.description] if cursor.description else []
        rows = cursor.fetchall()
        return jsonify({ "columns": column_names, "rows": [dict(row) for row in rows] })
    except sqlite3.Error as e:
        return jsonify({"message": f"Erro ao buscar prévia: {e}"}), 500
    finally:
        conn.close()

@bp.route('/tabelas/<string:table_name>/details', methods=['GET'])
def get_table_details(table_name):
    conn = get_db_connection()
    try:
        table_info = conn.execute(f'PRAGMA table_info({table_name})').fetchall()
        if not table_info:
            return jsonify({"message": "Tabela não encontrada."}), 404
        details = [ {"name": col['name'], "type": col['type'], "notnull": bool(col['notnull']), "pk": bool(col['pk'])} for col in table_info ]
        return jsonify(details)
    except sqlite3.Error as e:
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()

@bp.route('/tabelas/<string:table_name>/insert-data-custom', methods=['POST'])
def insert_table_data_custom(table_name):
    request_data = request.get_json()
    data, check_columns, check_mode, import_mode = request_data.get('data'), request_data.get('check_columns'), request_data.get('check_mode', 'AND'), request_data.get('import_mode', 'append')
    if not isinstance(data, list) or not data:
        return jsonify({"message": "Payload inválido. A lista de 'data' é obrigatória."}), 400
    if import_mode == 'append' and not check_columns:
        return jsonify({"message": "Payload inválido. 'check_columns' é obrigatório para o modo 'Incluir dados'."}), 400
    conn = get_db_connection()
    try:
        table_info = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
        table_columns = [col['name'] for col in table_info]
        conn.execute('BEGIN')
        cursor = conn.cursor()
        if import_mode == 'replace':
            cursor.execute(f'DELETE FROM {table_name}')
        inserted_count, ignored_count = 0, 0
        for row in data:
            exists = False
            if import_mode == 'append':
                where_clause = f" {check_mode} ".join([f'"{col}" = ?' for col in check_columns])
                params = [row.get(col) for col in check_columns]
                cursor.execute(f"SELECT 1 FROM {table_name} WHERE {where_clause} LIMIT 1", tuple(params))
                exists = cursor.fetchone()
            if not exists:
                valid_row = {key: value for key, value in row.items() if key in table_columns}
                cols_str = ', '.join(f'"{k}"' for k in valid_row.keys())
                placeholders = ', '.join(['?'] * len(valid_row))
                cursor.execute(f"INSERT INTO {table_name} ({cols_str}) VALUES ({placeholders})", tuple(valid_row.values()))
                inserted_count += 1
            else:
                ignored_count += 1
        conn.commit()
        message = f"Operação concluída. {inserted_count} novas linhas inseridas."
        if ignored_count > 0: message += f" {ignored_count} linhas foram ignoradas por já existirem."
        return jsonify({"message": message}), 200
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()
        
@bp.route('/db/table-data/<string:table_name>', methods=['GET'])
def get_any_table_data(table_name):
    if not re.match(r'^[a-zA-Z0-9_]+$', table_name):
        return jsonify({"message": "Nome de tabela inválido."}), 400
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
        if cursor.fetchone() is None:
            return jsonify({"message": f"Tabela '{table_name}' não encontrada."}), 404
        cursor.execute(f'SELECT * FROM {table_name} LIMIT 0')
        column_names = [description[0] for description in cursor.description] if cursor.description else []
        data = conn.execute(f'SELECT * FROM {table_name}').fetchall()
        rows = [dict(row) for row in data]
        return jsonify({"columns": column_names, "rows": rows})
    except sqlite3.Error as e:
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()

@bp.route('/db/backup-status', methods=['GET'])
def get_backup_status():
    conn_main = None
    conn_backup = None
    try:
        conn_main = get_db_connection()
        import_tables_raw = conn_main.execute("SELECT tabela FROM importacoes_bd").fetchall()
        import_tables = [row['tabela'] for row in import_tables_raw]
        all_tables_raw = conn_main.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()
        tables_to_check = [row['name'] for row in all_tables_raw if row['name'] not in import_tables]
        
        backup_dates = {}
        backup_tables_info = {}

        if os.path.exists(BACKUP_DATABASE_PATH):
            conn_backup = sqlite3.connect(BACKUP_DATABASE_PATH)
            conn_backup.row_factory = sqlite3.Row
            backup_cursor = conn_backup.cursor()
            
            # Garante que a tabela de log exista no backup
            backup_cursor.execute('''
                CREATE TABLE IF NOT EXISTS backup_log (
                    tabela TEXT PRIMARY KEY,
                    data_backup TEXT NOT NULL
                )
            ''')
            
            # Pega as datas de backup individuais
            logs = backup_cursor.execute("SELECT tabela, data_backup FROM backup_log").fetchall()
            for log in logs:
                backup_dates[log['tabela']] = log['data_backup']

            # Pega a contagem de linhas
            for table_name in tables_to_check:
                try:
                    count = backup_cursor.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                    backup_tables_info[table_name] = count
                except sqlite3.Error:
                    backup_tables_info[table_name] = 0
            conn_backup.close()

        status_list = []
        main_cursor = conn_main.cursor()
        for table_name in sorted(tables_to_check):
            try:
                main_count = main_cursor.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                status_list.append({
                    "tabela": table_name,
                    "ultimo_backup": backup_dates.get(table_name), # Usa a data individual
                    "linhas_backup": backup_tables_info.get(table_name, 0),
                    "linhas_db": main_count
                })
            except sqlite3.Error:
                continue
        return jsonify(status_list)
    except sqlite3.Error as e:
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        if conn_main: conn_main.close()
        if conn_backup: conn_backup.close()

# --- NOVAS ROTAS DE BACKUP/RESTAURAÇÃO PARA TABELAS DO SISTEMA ---

def _execute_system_backup_restore(action, tables):
    start_time = time.time()
    conn_main = None
    conn_backup = None
    results = []
    
    try:
        conn_main = get_db_connection()
        if not os.path.exists(BACKUP_DATABASE_PATH) and action == 'restore':
            raise FileNotFoundError("Arquivo de backup (backupdb.db) não encontrado.")
        conn_backup = sqlite3.connect(BACKUP_DATABASE_PATH)
        backup_cursor = conn_backup.cursor()
        
        # Garante que a tabela de log exista
        backup_cursor.execute('''
            CREATE TABLE IF NOT EXISTS backup_log (
                tabela TEXT PRIMARY KEY,
                data_backup TEXT NOT NULL
            )
        ''')

        for table_name in tables:
            result_item = {"tabela": table_name, "status": "error", "mensagem_backup": "", "detalhamento": ""}
            try:
                if action == 'backup':
                    df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn_main)
                    df.to_sql(table_name, conn_backup, if_exists='replace', index=False)
                    
                    # Salva a data individual do backup
                    backup_timestamp = datetime.now().isoformat()
                    backup_cursor.execute(
                        "INSERT OR REPLACE INTO backup_log (tabela, data_backup) VALUES (?, ?)",
                        (table_name, backup_timestamp)
                    )
                    
                    result_item['status'] = 'success'
                    result_item['mensagem_backup'] = f'Backup de {table_name} realizado com sucesso.'
                    result_item['detalhamento'] = f'{len(df)} linhas salvas.'
                elif action == 'restore':
                    df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn_backup)
                    df.to_sql(table_name, conn_main, if_exists='replace', index=False)
                    result_item['status'] = 'success'
                    result_item['mensagem_backup'] = f'Tabela {table_name} restaurada com sucesso.'
                    result_item['detalhamento'] = f'{len(df)} linhas restauradas.'
            except Exception as e:
                result_item['mensagem_backup'] = f'Erro ao processar {table_name}: {e}'
            results.append(result_item)
        
        conn_backup.commit()
        conn_main.commit()

    except Exception as e:
        results.append({"tabela": "Geral", "status": "error", "mensagem_backup": f"Erro geral na operação: {e}", "detalhamento": "-"})
    finally:
        if conn_main: conn_main.close()
        if conn_backup: conn_backup.close()

    end_time = time.time()
    tempo_execucao = f"{end_time - start_time:.2f}s"
    erros = sum(1 for d in results if d['status'] == 'error')
    
    return {
        "tempo_execucao": tempo_execucao,
        "erros": erros,
        "detalhes": results
    }

@bp.route('/db/executar-backup-sistema', methods=['POST'])
def executar_backup_sistema():
    data = request.get_json()
    tabelas = data.get('tabelas')
    if not tabelas:
        return jsonify({"message": "Nenhuma tabela selecionada para backup."}), 400
    
    result = _execute_system_backup_restore('backup', tabelas)
    return jsonify(result)

@bp.route('/db/executar-restauracao-sistema', methods=['POST'])
def executar_restauracao_sistema():
    data = request.get_json()
    tabelas = data.get('tabelas')
    if not tabelas:
        return jsonify({"message": "Nenhuma tabela selecionada para restauração."}), 400
        
    result = _execute_system_backup_restore('restore', tabelas)
    return jsonify(result)
