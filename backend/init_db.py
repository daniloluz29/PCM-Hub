import sqlite3
import os
from datetime import datetime

DB_FILE = "database.db"
# Apaga o banco de dados antigo para garantir uma criação limpa, se ele existir.
if os.path.exists(DB_FILE):
    os.remove(DB_FILE)
    print(f"Banco de dados antigo '{DB_FILE}' removido para uma nova criação.")

connection = sqlite3.connect(DB_FILE)
cursor = connection.cursor()
print("Conectado ao banco de dados. Criando novas tabelas...")

cursor.execute("""
CREATE TABLE IF NOT EXISTS perfis_acesso (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT,
    editavel INTEGER NOT NULL DEFAULT 1,
    hierarquia INTEGER NOT NULL DEFAULT 99
);
""")
print("Tabela 'perfis_acesso' criada.")

cursor.execute("""
CREATE TABLE IF NOT EXISTS permissoes_perfis (
    perfil_id TEXT NOT NULL,
    permissao_id TEXT NOT NULL,
    PRIMARY KEY (perfil_id, permissao_id),
    FOREIGN KEY (perfil_id) REFERENCES perfis_acesso (id) ON DELETE CASCADE
);
""")
print("Tabela 'permissoes_perfis' criada.")

cursor.execute("""
CREATE TABLE IF NOT EXISTS permissoes_totais (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pai_id TEXT
);
""")
print("Tabela 'permissoes_totais' criada.")


cursor.execute('''
CREATE TABLE IF NOT EXISTS paineis (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    pai_id TEXT,
    FOREIGN KEY (pai_id) REFERENCES paineis (id)
)
''')
print("- Tabela 'paineis' (Hierarquia de Acesso) criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS centros_custo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cod_cc TEXT,
    nome_cc TEXT NOT NULL,
    tipo TEXT NOT NULL,
    pai_id TEXT,
    estado TEXT,
    gestor TEXT,
    controlador TEXT,
    responde_iqd INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1,
    FOREIGN KEY (pai_id) REFERENCES centros_custo (cod_cc)
)
''')
print("- Tabela 'centros_custo' (Hierarquia de Dados) criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS funcoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    funcao TEXT NOT NULL UNIQUE
)
''')
print("- Tabela 'funcoes' criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS natureza_financeira (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_gerencial TEXT,
    desc_gerencial TEXT,
    id_contabil TEXT,
    desc_contabil TEXT,
    imposto REAL
)
''')
print("- Tabela 'natureza_financeira' criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    matricula TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    contato TEXT,
    funcao_id INTEGER,
    unidade_id TEXT,
    senha_hash TEXT NOT NULL,
    ativo INTEGER DEFAULT 1,
    perfil_id TEXT DEFAULT 'user',
    acessos TEXT,
    liberacao_dados TEXT,
    FOREIGN KEY (perfil_id) REFERENCES perfis_acesso (id),
    FOREIGN KEY (unidade_id) REFERENCES centros_custo (cod_cc),
    FOREIGN KEY (funcao_id) REFERENCES funcoes (id)
)
''')
print("- Tabela 'usuarios' atualizada com chave estrangeira para 'funcoes'.")


cursor.execute('''
CREATE TABLE IF NOT EXISTS solicitacoes_cadastro (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    matricula TEXT NOT NULL,
    email TEXT NOT NULL,
    contato TEXT,
    funcao_id INTEGER,
    unidade_id TEXT,
    data_solicitacao TEXT,
    FOREIGN KEY (funcao_id) REFERENCES funcoes (id),
    FOREIGN KEY (unidade_id) REFERENCES centros_custo (cod_cc)
)
''')
print("- Tabela 'solicitacoes_cadastro' com estrutura correta verificada/criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS faixas_grupos (
    id TEXT PRIMARY KEY,
    nome_grupo TEXT NOT NULL,
    nome_exibicao TEXT NOT NULL
)
''')
print("- Tabela 'faixas_grupos' criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS faixas_definicoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo_id TEXT NOT NULL,
    nome_faixa TEXT NOT NULL,
    valor_inicio REAL NOT NULL,
    valor_fim REAL NOT NULL,
    status TEXT NOT NULL,
    FOREIGN KEY (grupo_id) REFERENCES faixas_grupos (id)
)
''')
print("- Tabela 'faixas_valores' criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_inicio TEXT NOT NULL,
    data_fim TEXT,
    criado_por_id INTEGER,
    visibilidade_tipo TEXT,
    visibilidade_alvo TEXT,
    local TEXT,
    hora_inicio TEXT,
    hora_fim TEXT,
    recorrencia TEXT,
    FOREIGN KEY (criado_por_id) REFERENCES usuarios (id)
)
''')
print("- Tabela 'eventos' atualizada com recorrência.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS chamados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT,
    solucao TEXT,
    status TEXT NOT NULL,
    categoria TEXT,
    prioridade TEXT,
    solicitante_id INTEGER NOT NULL,
    responsavel_id INTEGER,
    data_abertura TEXT NOT NULL,
    data_fechamento TEXT,
    FOREIGN KEY (solicitante_id) REFERENCES usuarios (id),
    FOREIGN KEY (responsavel_id) REFERENCES usuarios (id)
)
''')
print("- Tabela 'chamados' atualizada com o campo 'solucao'.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS chat_chamados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chamado_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    data_hora TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    ordem INTEGER NOT NULL,
    reacao TEXT,
    FOREIGN KEY (chamado_id) REFERENCES chamados (id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
)
''')
print("- Tabela 'chat_chamados' atualizada com o campo 'reacao'.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS chamado_anexos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chamado_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    nome_arquivo TEXT NOT NULL,
    tamanho_arquivo REAL,
    tipo_arquivo TEXT,
    data_upload TEXT NOT NULL,
    caminho_arquivo TEXT, -- Em um sistema real, aqui iria o caminho para o arquivo no servidor
    FOREIGN KEY (chamado_id) REFERENCES chamados (id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
);
''')
print("- Tabela 'chamado_anexos' criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS ga_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL, -- 'Tarefa' ou 'Plano de Ação'
    titulo TEXT NOT NULL,
    descricao TEXT,
    criado_por_id INTEGER,
    data_criacao TEXT NOT NULL,
    prioridade TEXT,
    status TEXT NOT NULL,
    data_prazo TEXT,
    checklist_titulo TEXT,
    data_conclusao TEXT,
    FOREIGN KEY (criado_por_id) REFERENCES usuarios (id)
)
''')
print("- Tabela 'ga_itens' criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS ga_responsaveis (
    item_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    FOREIGN KEY (item_id) REFERENCES ga_itens (id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
    PRIMARY KEY (item_id, usuario_id)
)
''')
print("- Tabela 'ga_responsaveis' criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS ga_subitens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_pai_id INTEGER NOT NULL, -- ID do item em ga_itens
    tipo TEXT NOT NULL, -- 'Checklist', 'Objetivo' ou 'TarefaPlano'
    titulo TEXT NOT NULL,
    responsavel_id INTEGER,
    prioridade TEXT,
    data_inicio TEXT,
    data_prazo TEXT,
    status TEXT,
    comentarios TEXT,
    ordem INTEGER,
    concluido INTEGER DEFAULT 0, -- 0 para não, 1 para sim
    FOREIGN KEY (item_pai_id) REFERENCES ga_itens (id),
    FOREIGN KEY (responsavel_id) REFERENCES usuarios (id)
)
''')
print("- Tabela 'ga_subitens' criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS faq (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pergunta TEXT NOT NULL,
    resposta TEXT NOT NULL,
    criado_por_id INTEGER,
    data_criacao TEXT,
    FOREIGN KEY (criado_por_id) REFERENCES usuarios (id)
)
''')
print("- Tabela 'faq' criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS ga_chat_tarefas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tarefa_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    data_hora TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    ordem INTEGER,
    reacao TEXT,
    FOREIGN KEY (tarefa_id) REFERENCES ga_itens (id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
);
''')
print("- Tabela 'ga_chat_tarefas' criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS ga_chat_planos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plano_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    data_hora TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    ordem INTEGER,
    reacao TEXT,
    FOREIGN KEY (plano_id) REFERENCES ga_itens (id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
);
''')
print("- Tabela 'ga_chat_planos' criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS notificacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    icone TEXT,
    texto TEXT NOT NULL,
    link TEXT,
    data_criacao TEXT NOT NULL,
    tipo_destinatario TEXT NOT NULL, -- 'TODOS', 'PERFIL', 'USUARIO_ESPECIFICO'
    alvo_destinatario TEXT -- 'normal_admin' ou '1,5,12'
)
''')
print("- Tabela 'notificacoes' criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS notificacoes_status_usuarios (
    notificacao_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    lida INTEGER DEFAULT 0, -- 0 para não lida, 1 para lida
    PRIMARY KEY (notificacao_id, usuario_id),
    FOREIGN KEY (notificacao_id) REFERENCES notificacoes (id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
)
''')
print("- Tabela 'notificacoes_status_usuarios' criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS notificacoes_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    tipo_notificacao TEXT NOT NULL UNIQUE, -- Ex: 'alteracao_perfil'
    habilitado INTEGER DEFAULT 1, -- 1 para habilitado, 0 para desabilitado
    FOREIGN KEY (admin_id) REFERENCES usuarios (id)
)
''')
print("- Tabela 'notificacoes_config' criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS tabelas (
    id TEXT PRIMARY KEY,
    tabela TEXT NOT NULL
)
''')
print("- Tabela 'tabelas' (de apoio) criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS grupos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo_id TEXT UNIQUE,
    horimetro INTEGER,
    proprietario TEXT,
    classificacao TEXT,
    categoria TEXT
)
''')
print("- Tabela 'grupos' criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS importacoes_bd (
    tabela TEXT NOT NULL,
    caminho TEXT NOT NULL,
    arquivo TEXT NOT NULL PRIMARY KEY
)
''')
print("- Tabela 'importacoes_bd' para controle de importações criada.")

cursor.execute('''
CREATE TABLE IF NOT EXISTS calendario (
    data TEXT PRIMARY KEY,
    dia INTEGER,
    diasemana TEXT,
    diaano INTEGER,
    mesext TEXT,
    mes INTEGER,
    bimestre INTEGER,
    trimestre INTEGER,
    quadrimestre INTEGER,
    semestre INTEGER,
    ano INTEGER,
    semanames INTEGER,
    semanaano INTEGER
)
''')
print("- Tabela 'calendario' criada.")

connection.commit()
connection.close()
print("\nEstrutura do banco de dados criada e populada com sucesso!")
