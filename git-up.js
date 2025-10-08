const prompt = require('prompt-sync')();
const { execSync } = require('child_process');

// Caminho do Git Portable
const git = '"C:\\Users\\Danilo.azevedo\\PortableGit\\cmd\\git.exe"';

// Entrar na pasta do projeto (ajuste se necessário)
process.chdir("C:\\Users\\Danilo.azevedo\\OneDrive\\Área de Trabalho\\Dados\\Manutenção\\Dashboard Manutenção\\PCM-Hub");

// Mostrar status antes de commitar
console.log("Arquivos que serão commitados:");
execSync(`${git} status -s`, { stdio: 'inherit' });

// Perguntar se quer continuar
const confirm = prompt('Deseja continuar e commitar estes arquivos? (s/n): ');
if (confirm.toLowerCase() !== 's') {
    console.log('Commit cancelado.');
    process.exit(0);
}

// Perguntar a mensagem do commit
const message = prompt('Digite a mensagem do commit: ');

// Adicionar todos os arquivos
execSync(`${git} add .`, { stdio: 'inherit' });

// Criar commit
execSync(`${git} commit -m "${message}"`, { stdio: 'inherit' });

// Push
execSync(`${git} push`, { stdio: 'inherit' });

console.log('✅ Push concluído!');
