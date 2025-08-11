import sqlite3
import pandas as pd
import os

# Define o nome do arquivo do banco de dados
DB_FILE = "database.db"

def importar_dados():
    """
    Busca arquivos CSV ou XLSX configurados na tabela 'importacoes_bd'
    e importa seus dados para as tabelas correspondentes no banco de dados.
    Os dados existentes nas tabelas de destino são substituídos.
    """
    print("--- Iniciando processo de importação de dados ---")
    
    # Conecta-se ao banco de dados
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        print(f"✅ Conectado ao banco de dados '{DB_FILE}'.")
    except sqlite3.Error as e:
        print(f"❌ Erro ao conectar ao banco de dados: {e}")
        return

    # Busca as configurações de importação
    cursor.execute("SELECT tabela, caminho, arquivo FROM importacoes_bd")
    configuracoes = cursor.fetchall()

    if not configuracoes:
        print("⚠️ Nenhuma configuração de importação encontrada na tabela 'importacoes_bd'.")
        conn.close()
        return

    print(f"Encontradas {len(configuracoes)} configurações de importação.")

    # Itera sobre cada configuração e tenta importar o arquivo
    for config in configuracoes:
        tabela_destino, caminho_pasta, nome_arquivo = config
        caminho_completo = os.path.join(caminho_pasta, nome_arquivo)
        
        print(f"\nProcessando: Tabela '{tabela_destino}' <--- Arquivo '{caminho_completo}'")

        # 1. Verifica se o arquivo existe
        if not os.path.exists(caminho_completo):
            print(f"  -> ⚠️ Arquivo não encontrado. Pulando.")
            continue

        # 2. Tenta ler o arquivo com o Pandas, tratando XLSX e CSV de forma diferente
        try:
            # Pega a extensão do arquivo para decidir como lê-lo
            _, file_extension = os.path.splitext(caminho_completo)

            if file_extension.lower() in ['.xlsx', '.xls']:
                # Usa read_excel para arquivos Excel
                df = pd.read_excel(caminho_completo)
            elif file_extension.lower() == '.csv':
                # Usa a lógica anterior para arquivos CSV, com fallback de encoding
                try:
                    # Tenta ler com separador ; e encoding utf-8
                    df = pd.read_csv(caminho_completo, sep=';', encoding='utf-8')
                    # Se resultar em apenas uma coluna, tenta com separador ,
                    if df.shape[1] == 1:
                         df = pd.read_csv(caminho_completo, sep=',', encoding='utf-8')
                except UnicodeDecodeError:
                    # Se utf-8 falhar, tenta com latin-1 que é comum em arquivos do Windows
                    print("  -> ℹ️ Falha ao ler CSV com UTF-8. Tentando com Latin-1...")
                    df = pd.read_csv(caminho_completo, sep=';', encoding='latin-1')
                    if df.shape[1] == 1:
                         df = pd.read_csv(caminho_completo, sep=',', encoding='latin-1')
            else:
                print(f"  -> ⚠️ Formato de arquivo '{file_extension}' não suportado. Pulando.")
                continue

            # Remove colunas que são inteiramente vazias (NaN)
            df.dropna(axis=1, how='all', inplace=True)
            
            print(f"  -> ✅ Arquivo lido com sucesso. {len(df)} linhas encontradas.")
        except Exception as e:
            print(f"  -> ❌ Erro ao ler o arquivo: {e}. Pulando.")
            continue

        # 3. Importa os dados para o banco de dados
        try:
            # O método to_sql do Pandas facilita a importação.
            # if_exists='replace' apaga a tabela se ela existir e a recria com os novos dados.
            df.to_sql(tabela_destino, conn, if_exists='replace', index=False)
            print(f"  -> ✅ Dados importados com sucesso para a tabela '{tabela_destino}'.")
        except Exception as e:
            print(f"  -> ❌ Erro ao importar dados para o banco: {e}.")

    # Fecha a conexão com o banco
    conn.close()
    print("\n--- Processo de importação finalizado ---")

if __name__ == '__main__':
    importar_dados()
