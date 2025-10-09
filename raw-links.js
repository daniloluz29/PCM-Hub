const fs = require('fs');
const path = require('path');

// Configure seu usuário e repositório
const githubUser = 'daniloluz29';
const githubRepo = 'PCM-Hub';
const branch = 'main'; // ou master, se for o caso

const projectDir = path.resolve(__dirname); // raiz do projeto

function getFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (file === '.git') return; // ignorar pasta .git
            getFiles(filePath, fileList);
        } else {
            fileList.push(path.relative(projectDir, filePath).replace(/\\/g, '/'));
        }
    });
    return fileList;
}

const allFiles = getFiles(projectDir);

// Gerar links raw
const rawLinks = allFiles.map(file => 
    `https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${branch}/${file}`
);

console.log('🔗 Links raw de todos os arquivos:');
rawLinks.forEach(link => console.log(link));
