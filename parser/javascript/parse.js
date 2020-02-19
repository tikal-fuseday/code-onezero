#!/usr/local/bin/node

const parser = require('@babel/parser');
const fs = require('fs');
const path = require('path');
const argv = require('yargs').argv;
const axios = require('axios'); 
const toCSV = require('objects-to-csv');
const targetFile = argv.file;
const targetFolder = argv.folder;

const cache = {
    repos: {},
    tags: {},
    files: {}
};

const baseUrl = "https://tikal-code-wiki.herokuapp.com";


const acceptedTypes = ['FunctionDeclaration', 'ClassMethod', 'ClassDeclaration', 'ArrowFunctionDeclaration'];
const filesToScan = [];
const results = [];

let currentFile;

if (!targetFile && !targetFolder) {
    console.error('No file or folder specified. Usage: --file _FILENAME_ || --folder _FOLDER_');
    process.exit(-1);
}

if (targetFolder) {
    const visitFolder = targetFolder => {
        const files = fs.readdirSync(targetFolder);
        files.forEach(file => {
            const isDir = fs.lstatSync(path.resolve(targetFolder, file)).isDirectory();
            if (isDir) {
                visitFolder(path.resolve(targetFolder, file));
            } else {
                if (path.extname(file) === '.js') {
                    filesToScan.push(path.resolve(targetFolder, file));
                }
            }
        })
    }
    visitFolder(targetFolder);
} else if (targetFile) {
    filesToScan.push(path.resolve(targetFile));
}



function visit(node, parentComments, parent) {
    if (!node) {
        return;
    }
    if (acceptedTypes.indexOf(node.type) >= 0) {
        let data;
        if (node.type === 'ClassMethod') {
            data = node.key;
        } else {
            data = node.id;
        }
        const metadata = {
            file: currentFile,
            repo: 'angular.js',
            line: data.loc.start.line,
            name: data.name,
            type: node.type,
            tags: [],
            intents: [],
            comment: ''
        }
        if (node.leadingComments) {
            const tags = node.leadingComments[0].value.match(/(@coz\ )(.*)*/gm);
            if (tags) {
                const tagList = tags[0].split(' ').filter(x => !!x);
                metadata.tags = tagList.slice(1);
            }
            metadata.comment = node.leadingComments[0].value;
        }
        results.push(metadata);
    }
    if (Array.isArray(node)) {
        node.forEach(node => visit(node, node.leadingComments || parentComments, parent));
    } else if (typeof node === 'object') {
        Object.keys(node).forEach(key => {
            visit(node[key], node.leadingComments || parentComments, node.name || parent);
        })
    }

}

async function getOrCreateRepo(reponame) {
    if (cache.repos[reponame]) {
        return cache.repos[reponame];
    }
    let existingRepo = await axios.get(baseUrl + '/repos?repo_name=eq.' + reponame);
    if (existingRepo.data && existingRepo.data.length === 0) {
        console.log('Creating new repo...', reponame);
        existingRepo = await axios.post(baseUrl + '/repos', {
            repo_name: reponame,
            repo_url: reponame
        });
        return await getOrCreateRepo(reponame);
    }
    cache.repos[reponame] = existingRepo.data[0];
    return existingRepo.data[0];
}

async function getOrCreateFile(fileName, repo) {
    if (cache.files[fileName]) {
        return cache.files[fileName];
    }
    let existingFile = await axios.get(baseUrl + '/files?file_name=eq.' + fileName);
    if (existingFile.data && existingFile.data.length === 0) {
        console.log('Creating new file...', fileName);
        await axios.post(baseUrl + '/files', {
            file_name: fileName,
            file_path: fileName,
            repo_id: repo.id
        });
        return await getOrCreateFile(fileName);
    }
    cache.files[fileName] = existingFile.data[0];
    return existingFile.data[0];
}

async function getOrCreateTag(tagName) {
    if (cache.tags[tagName]) {
        return cache.tags[tagName];
    }
    let existingTag = await axios.get(baseUrl + '/tags?tag_name=eq.' + tagName);
    if (existingTag.data && existingTag.data.length === 0) {
        console.log('Creating new tag...', tagName);
        await axios.post(baseUrl + '/tags', {
            tag_name: tagName
        });
        return await getOrCreateTag(tagName);
    }
    cache.tags[tagName] = existingTag.data[0];
    return existingTag.data[0];
}

async function sendResults() {
    for (const data of results) {
        try {
            const { tags } = data;
            const repo = await getOrCreateRepo(data.repo || 'unknown');
            const file = await getOrCreateFile(data.file, repo);
            for (const tag of tags) {
                await getOrCreateTag(tag);
            }
            const response = await axios.post(baseUrl + '/entities', {
                entity_type: data.type,
                entity_name: data.name,
                line_number: data.line,
                file_id: file.id,
                entity_comment: data.comment,
                raw_data: '' //JSON.stringify(data)
            });
            const id = parseInt(response.headers.location.split('.').slice(-1));
            console.log('entity_id', id);
            for (const tagName of tags) {
                const tagData = cache.tags[tagName];
                await axios.post(baseUrl + '/entities_tags', {
                    entity_id: id,
                    tag_id: tagData.id
                });
            }
        } catch (err) {
            console.log(data);
            console.log(err);
            process.exit(-1);
        }
    }
}

if (argv.csv) {
    for (const file of filesToScan) {
        const code = fs.readFileSync(file).toString();
        try {
            currentFile = file;
            const result = parser.parse(code, {
                sourceType: "unambiguous",
                classProperties: true
            });
            visit(result);
        } catch (err) {}
    }
    const CSV = new toCSV(results);
    CSV.toDisk('./pach.csv');
} else {
    console.log('Scanning', filesToScan.length, 'files');
    for (const file of filesToScan) {
        const code = fs.readFileSync(file).toString();
        try {
            currentFile = file;
            const result = parser.parse(code, {
                sourceType: "unambiguous",
                classProperties: true
            });
            visit(result);
        } catch (err) {
            console.warn('Could not parse', file);
        }
    }
    sendResults();
}