import sqlite3
import pandas as pd

def formatar_id_como_texto(valor):
    if pd.isnull(valor):
        return None
    
    # Se o valor for um float e representar um número inteiro...
    if isinstance(valor, float) and valor.is_integer():
        # ...converte para inteiro e depois para texto.
        return str(int(valor))
    else:
        # ...caso contrário, apenas converte o valor original para texto.
        return str(valor)

# Caminhos dos arquivos
db_path = "database.db"
excel_path = "dados_exemplo.xlsx"

# Conexão com o banco
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Lê todas as abas do Excel
sheets = pd.read_excel(excel_path, sheet_name=None)

# Mapeamento: nome da aba → regras de unicidade por coluna
tabelas_com_regra = {
    "funcoes": ["funcao"],
    "perfis_acesso": ["id"],
    "permissoes_totais": ["id"],
    "paineis": ["id"],
    "centros_custo": ["cod_cc"],
    "usuarios": ["matricula", "email"],
    "solicitacoes_cadastro": ["matricula", "email"],
    "natureza_financeira": ["id_gerencial"],
    "faixas_grupos":["id"],
}

# Ordem de inserção para respeitar chaves estrangeiras
ordem = [
    "funcoes",
    "perfis_acesso",
    "permissoes_perfis",
    "permissoes_totais",
    "centros_custo",
    "paineis",
    "usuarios",
    "solicitacoes_cadastro",
    "natureza_financeira",
    "faixas_grupos",
    "faixas_definicoes",
    "eventos",
    "chat_chamados",
    "faq",
    "tabelas",
    "grupos",
    "importacoes_bd"
]

def inserir_unico(tabela, df, chaves_unicas):
    total = 0
    for _, row in df.iterrows():
        # Constrói WHERE dinâmico
        where_clause = " OR ".join([f"{col} = ?" for col in chaves_unicas])
        valores_where = [row[col] for col in chaves_unicas]

        cursor.execute(f"SELECT 1 FROM {tabela} WHERE {where_clause}", valores_where)
        if cursor.fetchone():
            print(f"⚠️ Já existe em '{tabela}': {valores_where}")
            continue

        # Prepara os dados para INSERT
        colunas = ', '.join(row.index)
        placeholders = ', '.join(['?'] * len(row))
        valores = list(row.values)

        try:
            cursor.execute(f"INSERT INTO {tabela} ({colunas}) VALUES ({placeholders})", valores)
            total += 1
        except Exception as e:
            print(f"❌ Erro ao inserir em '{tabela}': {e}")
    
    print(f"✅ {total} registros inseridos na tabela '{tabela}'.")

# Executa a inserção em ordem correta
for tabela in ordem:
    if tabela in sheets:
        df = sheets[tabela].dropna(how="all")  # ignora linhas totalmente vazias
        
        if tabela == "centros_custo":
            df["cod_cc"] = df["cod_cc"].astype(str)
            df["pai_id"] = df["pai_id"].apply(formatar_id_como_texto)
        if tabela == "usuarios":
            df["unidade_id"] = df["unidade_id"].astype(str).str.strip()
        if tabela == "solicitacoes_cadastro":
            df["unidade_id"] = df["unidade_id"].astype(str).str.strip()
    
        if not df.empty:
            chaves = tabelas_com_regra.get(tabela)
            if chaves:
                inserir_unico(tabela, df, chaves)
            else:
                # Insere tudo direto, sem checar duplicidade
                total = 0
                for _, row in df.iterrows():
                    colunas = ', '.join(row.index)
                    placeholders = ', '.join(['?'] * len(row))
                    valores = list(row.values)
                    try:
                        cursor.execute(f"INSERT INTO {tabela} ({colunas}) VALUES ({placeholders})", valores)
                        total += 1
                    except Exception as e:
                        print(f"❌ Erro ao inserir em '{tabela}': {e}")
                print(f"✅ {total} registros inseridos na tabela '{tabela}' (sem verificação de unicidade).")
        else:
            print(f"⚠️ Aba '{tabela}' está vazia.")
    else:
        print(f"⚠️ Aba '{tabela}' não encontrada no Excel.")

# Finaliza
conn.commit()
conn.close()
print("🏁 Importação finalizada.")
