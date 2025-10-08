const prompt = require('prompt-sync')();
const { execSync } = require('child_process');

// Caminho do Git Portable
const git = '"C:\\Users\\Danilo.azevedo\\PortableGit\\cmd\\git.exe"';

// Perguntar a mensagem do commit
const message = prompt('Digite a mensagem do commit: ');

// Entrar na pasta do projeto (se necessário)
// process.chdir("C:\\Users\\Danilo.azevedo\\OneDrive\\Área de Trabalho\\Dados\\Manutenção\\Dashboard Manutenção\\PCM-Hub");

// Adicionar todos os arquivos
execSync(`${git} add .`, { stdio: 'inherit' });

// Commit
execSync(`${git} commit -m "${message}"`, { stdio: 'inherit' });

// Push
execSync(`${git} push`, { stdio: 'inherit' });

console.log('✅ Push concluído!');
