# backend/Rotas/atualizacaodb.py
import sqlite3
import pandas as pd
import os
from datetime import datetime
from ..db import get_db_connection

def count_rows(conn, table_name):
    try:
        return conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    except sqlite3.Error:
        return 0

def atualizar_tabelas(lista_tabelas=None):
    """
    Atualiza tabelas no banco de dados a partir de arquivos de origem.
    
    Args:
        lista_tabelas (list, optional): Uma lista de nomes de tabelas para atualizar.
                                        Se None, atualiza todas as tabelas configuradas.
                                        
    Returns:
        tuple: (bool, str) indicando sucesso/falha e uma mensagem de resultado.
    """
    print("--- Iniciando processo de atualização de dados ---")
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = "SELECT tabela, caminho, arquivo FROM importacoes_bd"
        params = ()
        if lista_tabelas:
            placeholders = ','.join('?' for _ in lista_tabelas)
            query += f" WHERE tabela IN ({placeholders})"
            params = tuple(lista_tabelas)
            
        configuracoes = cursor.execute(query, params).fetchall()

        if not configuracoes:
            return True, [{"tabela": "N/A", "status": "warning", "mensagem_atualizacao": "Nenhuma configuração encontrada.", "detalhamento": "-"}]

        results = []
        for config in configuracoes:
            tabela_destino, caminho_pasta, nome_arquivo = config
            caminho_completo = os.path.join(caminho_pasta, nome_arquivo)
            
            result_item = {"tabela": tabela_destino, "status": "error", "mensagem_atualizacao": "", "detalhamento": ""}
            
            linhas_antes = count_rows(conn, tabela_destino)

            if not os.path.exists(caminho_completo):
                # CORREÇÃO: Trata "arquivo não encontrado" como um erro.
                result_item['status'] = 'error'
                result_item['mensagem_atualizacao'] = '❌ Arquivo de origem não encontrado.'
                result_item['detalhamento'] = 'Dados não atualizados.'
                results.append(result_item)
                continue

            try:
                mod_time = os.path.getmtime(caminho_completo)
                data_modificacao_arquivo = datetime.fromtimestamp(mod_time).strftime('%d/%m/%Y %H:%M:%S')

                _, ext = os.path.splitext(caminho_completo)
                df = pd.read_excel(caminho_completo) if ext.lower() in ['.xlsx', '.xls'] else pd.read_csv(caminho_completo, sep=';', encoding='utf-8')
                
                df.dropna(axis=1, how='all', inplace=True)
                df.to_sql(tabela_destino, conn, if_exists='replace', index=False)
                
                linhas_depois = len(df)
                diferenca = linhas_depois - linhas_antes
                
                data_hora_execucao = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
                cursor.execute(
                    "UPDATE importacoes_bd SET dataatualizacao = ?, dataatualizacaodados = ? WHERE tabela = ?",
                    (data_hora_execucao, data_modificacao_arquivo, tabela_destino)
                )
                conn.commit()

                result_item['status'] = 'success'
                result_item['mensagem_atualizacao'] = f'✅ Dados atualizados com sucesso ({linhas_depois} linhas).'
                if diferenca > 0:
                    result_item['detalhamento'] = f'{diferenca} linhas a mais que a versão anterior.'
                elif diferenca < 0:
                    result_item['detalhamento'] = f'{abs(diferenca)} linhas a menos que a versão anterior.'
                else:
                    result_item['detalhamento'] = 'Mesmo número de linhas que a versão anterior.'

            except Exception as e:
                result_item['mensagem_atualizacao'] = f'❌ Erro: {e}.'
                result_item['detalhamento'] = 'A operação falhou. A tabela pode estar em um estado inconsistente.'
            
            results.append(result_item)
        
        return True, results

    except sqlite3.Error as e:
        return False, [{"tabela": "Geral", "status": "error", "mensagem_atualizacao": f"Erro de banco de dados: {e}", "detalhamento": "-"}]
    finally:
        if conn:
            conn.close()
