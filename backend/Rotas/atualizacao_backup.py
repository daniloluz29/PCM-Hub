# backend/Rotas/atualizacao_backup.py
from flask import Blueprint, jsonify, request
from ..db import get_db_connection, DATABASE_PATH
import sqlite3
import os
from datetime import datetime
import time

from . import atualizacaodb, backup, restaurarbackup

bp = Blueprint('atualizacao_backup', __name__, url_prefix='/api/atualizacao')
BACKUP_DATABASE_PATH = os.path.join(os.path.dirname(DATABASE_PATH), 'backupdb.db')

def get_table_schema(conn, table_name):
    try:
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        return [{"name": col['name'], "type": col['type']} for col in columns]
    except sqlite3.Error:
        return []

@bp.route('/status-tabelas', methods=['GET'])
def get_status_tabelas():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT tabela, caminho, arquivo, dataatualizacao, ultimobackup, dataatualizacaodados FROM importacoes_bd")
        configuracoes = cursor.fetchall()

        if not configuracoes:
            return jsonify([])

        status_list = []
        for config in configuracoes:
            table_name = config['tabela']
            full_path = os.path.join(config['caminho'], config['arquivo'])
            
            last_updated_file = None
            if os.path.exists(full_path):
                try:
                    mod_time = os.path.getmtime(full_path)
                    last_updated_file = datetime.fromtimestamp(mod_time).strftime('%d/%m/%Y %H:%M:%S')
                except Exception:
                    last_updated_file = "Erro ao ler data"
            else:
                # CORREÇÃO: Se o arquivo não existe, mostra a última data de dados bem-sucedida
                last_updated_file = config['dataatualizacaodados'] if config['dataatualizacaodados'] else "Arquivo não encontrado"


            schema = get_table_schema(conn, table_name)

            status_list.append({
                "nome": table_name,
                "colunas": schema,
                "ultima_atualizacao_arquivo": last_updated_file,
                "data_importacao_db": config['dataatualizacao'],
                "data_atualizacao_dados": config['dataatualizacaodados'],
                "ultimo_backup_db": config['ultimobackup'],
                "caminho_arquivo": full_path
            })
        
        return jsonify(status_list)

    except sqlite3.Error as e:
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()

@bp.route('/import-settings', methods=['GET'])
def get_import_settings():
    conn = get_db_connection()
    try:
        settings = conn.execute("SELECT tabela, caminho, arquivo FROM importacoes_bd ORDER BY tabela").fetchall()
        return jsonify([dict(row) for row in settings])
    except sqlite3.Error as e:
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()

@bp.route('/import-settings', methods=['PUT'])
def update_import_settings():
    data = request.get_json()
    if not isinstance(data, list):
        return jsonify({"message": "Dados inválidos."}), 400

    conn = get_db_connection()
    try:
        existing_data = {row['arquivo']: {'dataatualizacao': row['dataatualizacao'], 'ultimobackup': row['ultimobackup'], 'dataatualizacaodados': row['dataatualizacaodados']} for row in conn.execute("SELECT arquivo, dataatualizacao, ultimobackup, dataatualizacaodados FROM importacoes_bd").fetchall()}
        conn.execute('BEGIN')
        conn.execute('DELETE FROM importacoes_bd')
        if data:
            rows_to_insert = []
            for item in data:
                arquivo = item.get('arquivo')
                dates = existing_data.get(arquivo, {'dataatualizacao': None, 'ultimobackup': None, 'dataatualizacaodados': None})
                rows_to_insert.append((
                    item.get('tabela'),
                    item.get('caminho'),
                    arquivo,
                    dates['dataatualizacao'],
                    dates['ultimobackup'],
                    dates['dataatualizacaodados']
                ))
            conn.executemany(
                'INSERT INTO importacoes_bd (tabela, caminho, arquivo, dataatualizacao, ultimobackup, dataatualizacaodados) VALUES (?, ?, ?, ?, ?, ?)',
                rows_to_insert
            )
        conn.commit()
        return jsonify({"message": "Configurações de importação salvas com sucesso!"})
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()

# --- ROTAS DE AÇÕES ---

@bp.route('/executar-atualizacao', methods=['POST'])
def executar_atualizacao():
    start_time = time.time()
    data = request.get_json()
    tabelas = data.get('tabelas')
    
    lista_para_atualizar = None if tabelas == 'all' else tabelas
    sucesso, detalhes = atualizacaodb.atualizar_tabelas(lista_para_atualizar)
    
    end_time = time.time()
    tempo_execucao = f"{end_time - start_time:.2f}s"
    erros = sum(1 for d in detalhes if d['status'] == 'error')

    response = {
        "tempo_execucao": tempo_execucao,
        "erros": erros,
        "detalhes": detalhes
    }
    
    return jsonify(response), 200 if sucesso else 500

@bp.route('/executar-backup', methods=['POST'])
def executar_backup():
    start_time = time.time()
    data = request.get_json()
    tabelas = data.get('tabelas')
    
    lista_para_backup = None if tabelas == 'all' else tabelas
    sucesso, detalhes = backup.fazer_backup(lista_para_backup)
    
    end_time = time.time()
    tempo_execucao = f"{end_time - start_time:.2f}s"
    erros = sum(1 for d in detalhes if d['status'] == 'error')
    
    # Adiciona chaves padrão para consistência no frontend
    for detail in detalhes:
        detail.setdefault('mensagem_atualizacao', 'Backup não afeta a atualização.')

    response = {
        "tempo_execucao": tempo_execucao,
        "erros": erros,
        "detalhes": detalhes
    }
    
    return jsonify(response), 200 if sucesso else 500

@bp.route('/executar-restauracao', methods=['POST'])
def executar_restauracao():
    start_time = time.time()
    data = request.get_json()
    tabelas = data.get('tabelas')
    
    lista_para_restaurar = None if tabelas == 'all' else tabelas
    sucesso, detalhes = restaurarbackup.restaurar_backup(lista_para_restaurar)
    
    end_time = time.time()
    tempo_execucao = f"{end_time - start_time:.2f}s"
    erros = sum(1 for d in detalhes if d['status'] == 'error')
    
    # Adiciona chaves padrão para consistência no frontend
    for detail in detalhes:
        detail.setdefault('mensagem_atualizacao', 'Restauração não afeta a atualização.')
        detail.setdefault('mensagem_backup', 'Restauração concluída.')

    response = {
        "tempo_execucao": tempo_execucao,
        "erros": erros,
        "detalhes": detalhes
    }

    return jsonify(response), 200 if sucesso else 500


@bp.route('/ver-backup/<string:table_name>', methods=['GET'])
def ver_backup(table_name):
    if not os.path.exists(BACKUP_DATABASE_PATH):
        return jsonify({"message": "Arquivo de backup (backupdb.db) não encontrado."}), 404
    
    conn_backup = None
    try:
        conn_backup = sqlite3.connect(BACKUP_DATABASE_PATH)
        conn_backup.row_factory = sqlite3.Row
        cursor = conn_backup.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
        if cursor.fetchone() is None:
            return jsonify({"message": f"Tabela '{table_name}' não encontrada no backup."}), 404

        cursor.execute(f'SELECT * FROM {table_name} LIMIT 0')
        column_names = [description[0] for description in cursor.description] if cursor.description else []
        data = conn_backup.execute(f'SELECT * FROM {table_name}').fetchall()
        rows = [dict(row) for row in data]
        
        return jsonify({"columns": column_names, "rows": rows})

    except sqlite3.Error as e:
        return jsonify({"message": f"Erro ao ler o banco de dados de backup: {e}"}), 500
    finally:
        if conn_backup:
            conn_backup.close()
