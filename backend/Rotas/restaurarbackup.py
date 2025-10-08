# backend/Rotas/restaurarbackup.py
import sqlite3
import pandas as pd
from datetime import datetime
from ..db import get_db_connection

from ..db import DATABASE_PATH
import os
BACKUP_DATABASE_PATH = os.path.join(os.path.dirname(DATABASE_PATH), 'backupdb.db')

def count_rows(conn, table_name):
    try:
        return conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    except sqlite3.Error:
        return 0

def restaurar_backup(lista_tabelas=None):
    print("--- Iniciando processo de restauração de backup ---")
    
    conn_main = None
    conn_backup = None
    
    try:
        conn_main = get_db_connection()
        conn_backup = sqlite3.connect(BACKUP_DATABASE_PATH)
        
        if not lista_tabelas:
            tabelas_raw = conn_main.execute("SELECT tabela FROM importacoes_bd").fetchall()
            tabelas_para_restaurar = [row['tabela'] for row in tabelas_raw]
        else:
            tabelas_para_restaurar = lista_tabelas

        if not tabelas_para_restaurar:
            return True, [{"tabela": "N/A", "status": "warning", "mensagem_backup": "Nenhuma tabela encontrada para restaurar.", "detalhamento": "-"}]

        results = []
        for table_name in tabelas_para_restaurar:
            result_item = {"tabela": table_name, "status": "error", "mensagem_backup": "", "detalhamento": ""}
            
            linhas_antes = count_rows(conn_main, table_name)
            
            try:
                df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn_backup)
                df.to_sql(table_name, conn_main, if_exists='replace', index=False)
                
                linhas_depois = len(df)
                diferenca = linhas_depois - linhas_antes

                # Atualiza a data de atualização para a data do backup
                cursor_backup = conn_backup.cursor()
                data_backup_raw = conn_main.execute("SELECT ultimobackup FROM importacoes_bd WHERE tabela = ?", (table_name,)).fetchone()
                if data_backup_raw and data_backup_raw['ultimobackup']:
                    data_backup = data_backup_raw['ultimobackup']
                    cursor_main = conn_main.cursor()
                    cursor_main.execute(
                        "UPDATE importacoes_bd SET dataatualizacao = ?, dataatualizacaodados = ? WHERE tabela = ?",
                        (data_backup, data_backup, table_name)
                    )
                    conn_main.commit()

                result_item['status'] = 'success'
                result_item['mensagem_backup'] = f'✅ Tabela restaurada com sucesso ({linhas_depois} linhas).'
                if diferenca > 0:
                    result_item['detalhamento'] = f'{diferenca} linhas a mais que a versão anterior.'
                elif diferenca < 0:
                    result_item['detalhamento'] = f'{abs(diferenca)} linhas a menos que a versão anterior.'
                else:
                    result_item['detalhamento'] = 'Mesmo número de linhas que a versão anterior.'


            except Exception as e:
                result_item['mensagem_backup'] = f'❌ Erro: {e}.'
                result_item['detalhamento'] = 'A restauração pode ter falhado.'

            results.append(result_item)
        
        return True, results

    except sqlite3.Error as e:
        return False, [{"tabela": "Geral", "status": "error", "mensagem_backup": f"Erro de banco de dados: {e}", "detalhamento": "-"}]
    finally:
        if conn_main: conn_main.close()
        if conn_backup: conn_backup.close()
