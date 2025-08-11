import sqlite3
import os

# Define o nome do arquivo do banco de dados principal
DB_FILE = "database.db"

# Conecta-se ao banco de dados (será criado se não existir)
connection = sqlite3.connect(DB_FILE)
cursor = connection.cursor()

print("Conectado ao banco de dados. Criando tabelas de dados de manutenção...")

# --- Tabela de Equipamentos ---
# Armazena o cadastro mestre de todos os equipamentos.
cursor.execute('''
CREATE TABLE IF NOT EXISTS equipamentos (
    equipamento TEXT PRIMARY KEY,
    descricao_equipamento TEXT,
    grupo_id TEXT,
    cod_cc TEXT,
    cod_localizacao TEXT,
    cod_modelo TEXT,
    cod_submodelo TEXT,
    cod_fabricante TEXT,
    ano_fabricaçao INTEGER,
    cod_status_equip TEXT
)
''')
print("- Tabela 'equipamentos' criada com sucesso.")

# --- Tabela de Horímetro ---
# Registra as medições de horímetro para cada equipamento ao longo do tempo.
cursor.execute('''
CREATE TABLE IF NOT EXISTS horimetro (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipamento TEXT NOT NULL,
    data_coleta TEXT NOT NULL,
    horimetro REAL NOT NULL
)
''')
print("- Tabela 'horimetro' criada com sucesso.")

# --- Tabela de Preventivas ---
# Armazena todas as ordens de serviço de manutenção preventiva.
cursor.execute('''
CREATE TABLE IF NOT EXISTS preventivas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cod_cc TEXT,
    equipamento TEXT,
    numos TEXT UNIQUE,
    classificacao TEXT,
    sl_fluig TEXT,
    atividade_fluig TEXT,
    numrm TEXT,
    hor_emisao_os REAL,
    hor_vencimento REAL,
    hor_termino REAL,
    hor_atual REAL,
    med_horas_dia REAL,
    requisicoes_total INTEGER,
    requisicoes_pendentes INTEGER,
    datacriacao TEXT,
    datatermino TEXT,
    datavencimento TEXT,
    motivo_atraso TEXT,
    tipo TEXT
)
''')
print("- Tabela 'preventivas' criada com sucesso.")

# Tabela para Fabricantes
cursor.execute('''
CREATE TABLE IF NOT EXISTS fabricantes (
    cod_fabricante TEXT PRIMARY KEY,
    desc_fabricante TEXT
)
''')
print("- Tabela 'fabricantes' criada com sucesso.")

# Tabela para Localização
cursor.execute('''
CREATE TABLE IF NOT EXISTS localizacao (
    cod_localizacao TEXT PRIMARY KEY,
    localizacao TEXT,
    status TEXT
)
''')
print("- Tabela 'localizacao' criada com sucesso.")

# Tabela para Modelo e Submodelo
cursor.execute('''
CREATE TABLE IF NOT EXISTS modelo_submodelo (
    cod_modelo TEXT,
    modelo TEXT,
    cod_submodelo TEXT,
    submodelo TEXT,
    PRIMARY KEY (cod_modelo, cod_submodelo)
)
''')
print("- Tabela 'modelo_submodelo' criada com sucesso.")

# Tabela para Status do Equipamento
cursor.execute('''
CREATE TABLE IF NOT EXISTS status_equip (
    cod_status TEXT PRIMARY KEY,
    desc_status TEXT
)
''')
print("- Tabela 'status_equip' criada com sucesso.")

# Tabela para Tipo de Objeto
cursor.execute('''
CREATE TABLE IF NOT EXISTS tipo_obj (
    cod_tipo_obj INTEGER PRIMARY KEY,
    tipo_obj TEXT,
    horimetro TEXT
)
''')
print("- Tabela 'tipo_obj' criada com sucesso.")

# Salva as alterações (commit) e fecha a conexão
connection.commit()
connection.close()

print("\nEstrutura das tabelas de dados de manutenção criada com sucesso!")
