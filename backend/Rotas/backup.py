# backend/Rotas/backup.py
import sqlite3
import pandas as pd
from datetime import datetime
from ..db import get_db_connection, DATABASE_PATH
import os

BACKUP_DATABASE_PATH = os.path.join(os.path.dirname(DATABASE_PATH), 'backupdb.db')

def count_rows(conn, table_name):
    try:
        return conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    except sqlite3.Error:
        return 0

def fazer_backup(lista_tabelas=None):
    print("--- Iniciando processo de backup ---")
    
    conn_main = None
    conn_backup = None
    
    try:
        conn_main = get_db_connection()
        conn_backup = sqlite3.connect(BACKUP_DATABASE_PATH)
        
        if not lista_tabelas:
            tabelas_raw = conn_main.execute("SELECT tabela FROM importacoes_bd").fetchall()
            tabelas_para_backup = [row['tabela'] for row in tabelas_raw]
        else:
            tabelas_para_backup = lista_tabelas

        if not tabelas_para_backup:
            return True, [{"tabela": "N/A", "status": "warning", "mensagem_backup": "Nenhuma tabela encontrada para backup.", "detalhamento": "-"}]

        results = []
        for table_name in tabelas_para_backup:
            result_item = {"tabela": table_name, "status": "error", "mensagem_backup": "", "detalhamento": ""}
            
            linhas_antes_backup = count_rows(conn_backup, table_name)

            try:
                df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn_main)
                df.to_sql(table_name, conn_backup, if_exists='replace', index=False)
                
                linhas_depois_backup = len(df)
                diferenca = linhas_depois_backup - linhas_antes_backup
                
                data_hora_atual = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
                cursor_main = conn_main.cursor()
                cursor_main.execute("UPDATE importacoes_bd SET ultimobackup = ? WHERE tabela = ?", (data_hora_atual, table_name))
                conn_main.commit()
                
                result_item['status'] = 'success'
                result_item['mensagem_backup'] = f'✅ Backup realizado com sucesso ({linhas_depois_backup} linhas).'
                if diferenca != 0:
                     result_item['detalhamento'] = f'Backup atualizado.'
                else:
                     result_item['detalhamento'] = 'Backup já estava sincronizado.'


            except Exception as e:
                result_item['mensagem_backup'] = f'❌ Erro: {e}.'
                result_item['detalhamento'] = 'O backup pode ter falhado.'
            
            results.append(result_item)
        
        return True, results

    except sqlite3.Error as e:
        return False, [{"tabela": "Geral", "status": "error", "mensagem_backup": f"Erro de banco de dados: {e}", "detalhamento": "-"}]
    finally:
        if conn_main: conn_main.close()
        if conn_backup: conn_backup.close()
