const fs = require("fs");
const path = require("path");

function getMissContent(source, target) {
    if (typeof source !== "object") {return;}
    let res;
    for (const key in source) {
        if (!target[key]) {
            if (!res) {res = {};}
            res[key] = source[key];
        }
        if (typeof target[key] === "object") {
            const childRes = getMissContent(source[key], target[key]);
            if (childRes) {
                if (!res) {res = {};}
                res[key] = childRes;
            }
        }
    }
    return res;
}

function setMissContent(source, additional) {
    function merge(source, target) {
        for (const key in target) {
            if (!source[key]) {
                source[key] = target[key];
                continue;
            }
            if (typeof source[key] === "object") {
                merge(source[key], target[key]);
            }
        }
    }
    merge(source, additional);
}

function getLangStat(absDir, lang) {
    const filePath = path.join(absDir, `${lang}.json`);
    const dirPath = path.join(absDir, lang);
    const isFile = fs.existsSync(filePath);
    const isDir = fs.existsSync(dirPath);
    return {
        isFile,
        isDir,
        filePath,
        dirPath,
    };
}

function getLanguageContent(absDir, lang) {
    const { filePath, isFile, dirPath, isDir } = getLangStat(absDir, lang);
    if (isFile) {
        const langContent = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        return langContent;
    }

    if (isDir) {
        const files = fs.readdirSync(dirPath);
        const res = {};
        files.forEach((file) => {
            if (!file.endsWith(".json")) {return;}
            const filePath = path.join(dirPath, file);
            const nameSpace = file.replace(".json", "");
            res[nameSpace] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        });
        return res;
    }
    return {};
}

function setLanguageContent(absDir, lang, isDir, langContent) {
    if (isDir) {
        const dirPath = path.join(absDir, lang);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
        }
        Object.keys(langContent).forEach((nameSpace) => {
            const file = nameSpace + ".json";
            const filePath = path.join(dirPath, file);
            fs.writeFileSync(
                filePath,
                JSON.stringify(langContent[nameSpace], null, 2),
                "utf8"
            );
        });
    } else {
        fs.writeFileSync(
            path.join(absDir, `${lang}.json`),
            JSON.stringify(langContent, null, 2),
            "utf8"
        );
    }
}

module.exports = {
    getMissContent,
    setMissContent,
    getLanguageContent,
    getLangStat,
    setLanguageContent,
};
