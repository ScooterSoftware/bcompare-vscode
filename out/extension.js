"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const child_process_1 = require("child_process");
const vscode = __importStar(require("vscode"));
const fs_1 = __importDefault(require("fs"));
const simple_git_1 = require("simple-git");
const path = __importStar(require("path"));
const vsWinReg = __importStar(require("@vscode/windows-registry"));
const os = __importStar(require("node:os"));
let temporaryFiles = [];
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed 
function activate(context) {
    let leftPath = "";
    let blnLeftReadOnly = false;
    let BCPath = 'bcomp';
    const strOS = os.platform();
    let threeWayCompareAllowed = true;
    const BCLoadErrorMessage = "Error: Could not open Beyond Compare";
    const extensionName = "beyondcompareintegration";
    if (strOS === 'win32') {
        let topFolders = ['HKEY_CURRENT_USER', 'HKEY_LOCAL_MACHINE'];
        let versionNumbers = ['', ' 5', ' 4', ' 3'];
        for (var folder in topFolders) {
            if (BCPath !== 'bcomp') {
                break;
            }
            for (var version in versionNumbers) {
                if (BCPath === 'bcomp') {
                    try {
                        const bcRegistryFolder = "SOFTWARE\\Scooter Software\\Beyond Compare";
                        BCPath = vsWinReg.GetStringRegKey(topFolders[folder], bcRegistryFolder + versionNumbers[version], 'ExePath');
                        if (BCPath === undefined) {
                            BCPath = 'bcomp';
                        }
                        let strThreeWayCompareAllowed = vsWinReg.GetStringRegKey(topFolders[folder], bcRegistryFolder + versionNumbers[version], 'SupportsMerge');
                        threeWayCompareAllowed = strThreeWayCompareAllowed !== "";
                    }
                    catch {
                        threeWayCompareAllowed = false;
                    }
                }
                else {
                    break;
                }
            }
        }
    }
    console.log('Congratulations, your extension "beyondcompareintegration" is now active!');
    registerCommand('.selectLeft', (a) => {
        let success = false;
        if (a) {
            if (a.scheme === 'untitled') {
                //Error untitled
                vscode.window.showErrorMessage("Error: Can not compare to " + a.fsPath + " until it is saved");
            }
            else if (a.scheme !== "file") {
                //Error not a file
                vscode.window.showErrorMessage("Error: Can not compare that");
            }
            else {
                leftPath = a.fsPath;
                success = true;
            }
        }
        else if (!vscode.window.activeTextEditor) {
            //Error no active text editor
            vscode.window.showErrorMessage("Error: No active text editor found");
        }
        else if (vscode.window.activeTextEditor.document.isUntitled) {
            //Error untitled
            vscode.window.showErrorMessage("Error: Can not compare to " + vscode.window.activeTextEditor.document.fileName + " until it is saved");
        }
        else {
            leftPath = vscode.window.activeTextEditor.document.fileName;
            success = true;
        }
        if (success) {
            vscode.commands.executeCommand('setContext', extensionName + '.leftSelected', true);
            vscode.commands.executeCommand('setContext', extensionName + '.leftFolderSelected', false);
            blnLeftReadOnly = false;
            vscode.window.showInformationMessage("Marked \"" + path.basename(leftPath) + "\" as left file");
        }
    });
    registerCommand('.compareWithLeft', (a) => {
        let rightPath = "";
        if (a) {
            if (a.scheme === 'untitled') {
                //Error untitled
                vscode.window.showErrorMessage("Error: Can not compare to " + a.fsPath + " until it is saved");
            }
            else if (a.scheme !== "file") {
                //Error not a file
                vscode.window.showErrorMessage("Error: Can not compare that");
            }
            else {
                rightPath = a.fsPath;
            }
        }
        else if (!vscode.window.activeTextEditor) {
            //Error no active text editor
            vscode.window.showErrorMessage("Error: No active text editor found");
        }
        else if (vscode.window.activeTextEditor.document.isUntitled) {
            //Error untitled
            vscode.window.showErrorMessage("Error: Can not compare to " +
                vscode.window.activeTextEditor.document.fileName +
                " until it is saved");
        }
        else {
            rightPath = vscode.window.activeTextEditor.document.fileName;
        }
        if (rightPath !== "") {
            let option = "";
            if (blnLeftReadOnly) {
                option = "/lro";
            }
            openBC(option, leftPath, rightPath);
        }
    });
    registerCommand('.selectLeftFolder', (a) => {
        if (a) {
            leftPath = a.fsPath;
        }
        else {
            //Error-no folder
            vscode.window.showErrorMessage("Error: No folder selected");
        }
        let splitName = leftPath.split("\\");
        vscode.commands.executeCommand('setContext', extensionName + '.leftSelected', false);
        vscode.commands.executeCommand('setContext', extensionName + '.leftFolderSelected', true);
        vscode.window.showInformationMessage("Marked \"" + splitName[splitName.length - 1] + "\" as left folder");
    });
    registerCommand('.compareWithLeftFolder', (a) => {
        let rightPath = "";
        if (a) {
            rightPath = a.fsPath;
        }
        else {
            //Error-no folder
            vscode.window.showErrorMessage("Error: No folder selected");
        }
        if (rightPath !== "") {
            openBC("", leftPath, rightPath);
        }
    });
    registerCommand('.compareWithFile', (a) => {
        let options = {
            canSelectFolders: false,
            canSelectFiles: true,
            openLabel: "Compare",
            title: "Compare"
        };
        let promise = vscode.window.showOpenDialog(options);
        promise.then((file) => {
            if (file === undefined) {
                return;
            }
            openBC("", a.fsPath, file[0].fsPath);
        });
    });
    registerCommand('.compareWithFolder', (a) => {
        let options = {
            canSelectFolders: true,
            canSelectFiles: false,
            openLabel: "Compare",
            title: "Compare"
        };
        let promise = vscode.window.showOpenDialog(options);
        promise.then((folder) => {
            if (folder === undefined) {
                return;
            }
            openBC("", a.fsPath, folder[0].fsPath);
        });
    });
    registerCommand('.compareParent', (a) => {
        let success = false;
        var fullPath;
        if (a) {
            if (a.scheme === 'untitled') {
                //Error untitled
                vscode.window.showErrorMessage("Error: Can not compare to the parent of \"" + a.fsPath + "\" until it is saved");
            }
            else {
                fullPath = a.fsPath;
                success = true;
            }
        }
        else if (!vscode.window.activeTextEditor) {
            //Error no active text editor
            vscode.window.showErrorMessage("Error: No active text editor found");
        }
        else if (vscode.window.activeTextEditor.document.isUntitled) {
            //Error untitled
            vscode.window.showErrorMessage("Error: Can not compare to " +
                vscode.window.activeTextEditor.document.fileName +
                " until it is saved");
        }
        else {
            fullPath = vscode.window.activeTextEditor.document.fileName;
            success = true;
        }
        if (!success) {
            return;
        }
        let options = {
            canSelectFolders: true,
            canSelectFiles: false,
            openLabel: "Compare",
            title: "Compare"
        };
        let promise = vscode.window.showOpenDialog(options);
        promise.then((folder, path = fullPath) => {
            if (folder === undefined) {
                return;
            }
            var splitPath;
            splitPath = path.split("\\");
            let folderPath = splitPath[0];
            for (let intI = 1; intI < splitPath.length - 1; intI++) {
                folderPath += "\\" + splitPath[intI];
            }
            openBC("", folderPath, folder[0].fsPath);
        });
    });
    registerCommand('.compareWithSave', async (a) => {
        if (!a) //If not run by right clicking on an editor tab (when run from command pallate or keybinding)
         {
            if (!vscode.window.activeTextEditor) {
                vscode.window.showErrorMessage("Error: No active text editor");
                return;
            }
            else //but there is a text editor active
             {
                let fileName = vscode.window.activeTextEditor.document.fileName;
                let splitPath = fileName.split('\\');
                if (!fs_1.default.existsSync(fileName)) {
                    vscode.window.showErrorMessage("Error: \"" + splitPath[splitPath.length - 1] + "\" has no saved version to compare to");
                    return;
                }
                else //and it has a saved version
                 {
                    if (!vscode.window.activeTextEditor.document.isDirty) //If it hasn't changed, ask for confirmation
                     {
                        vscode.window.showWarningMessage("\"" + splitPath[splitPath.length - 1] +
                            '\" has not been changed since last save. Compare anyway?', "Yes", "No")
                            .then((answer, docPath = fileName, document = vscode.window.activeTextEditor?.document) => {
                            if (answer === "Yes" && document !== undefined) {
                                compareWithSaveHelper(docPath, document);
                            }
                        });
                        return;
                    }
                    compareWithSaveHelper(fileName, vscode.window.activeTextEditor.document); //If it hasn't changed, compare
                }
            }
        }
        else if (!fs_1.default.existsSync(a.fsPath)) {
            vscode.window.showErrorMessage("Error: \"" + path.basename(a.path) + "\" has no saved version to compare to");
            return;
        }
        else //If it is run by right clicking an editor tab
         {
            //There is no good way to get a list of all open tabs, so I have to cycle the user through all of them
            let maxCounter = 0;
            while (vscode.window.activeTextEditor === undefined && maxCounter < 20) //Look for a text editor to start
             {
                await vscode.commands.executeCommand("workbench.action.nextEditor");
                maxCounter++;
            }
            if (vscode.window.activeTextEditor === undefined) //If one can't be found, give up (shouldn't happen unless the user closes the editor before clicking on "yes" on the "are you sure" message)
             {
                vscode.window.showErrorMessage("Error: No open text editors found");
                return;
            }
            let startingEditor = vscode.window.activeTextEditor.document.fileName;
            var aEditor;
            await vscode.commands.executeCommand("workbench.action.nextEditor");
            while (vscode.window.activeTextEditor.document.fileName !== startingEditor) //Loop through all editors to return to the starting one
             {
                await vscode.commands.executeCommand("workbench.action.nextEditor");
                if (vscode.window.activeTextEditor.document.uri.fsPath === a.fsPath) //and look for the one that is opening "a"
                 {
                    aEditor = vscode.window.activeTextEditor.document;
                }
            }
            if (aEditor === undefined) //If unsuccessful, give up (shouldn't happen unless the user closes the editor before clicking on "yes" on the "are you sure" message)
             {
                vscode.window.showErrorMessage("Error: couldn't find that file");
                return;
            }
            if (aEditor.isDirty) {
                compareWithSaveHelper(a.fsPath, aEditor);
            }
            else {
                vscode.window.showWarningMessage("\"" + path.basename(a.path) + '\" has not been changed since last save. Compare anyway?', "Yes", "No").then(answer => {
                    if (answer === "Yes" && aEditor !== undefined) {
                        compareWithSaveHelper(a.fsPath, aEditor);
                    }
                });
                return;
            }
        }
    });
    registerCommand('.selectLeftText', async () => {
        if (vscode.window.activeTextEditor === undefined) {
            return; //This should be impossible, as this command requires an active text editor to be enabled
        }
        let selection = vscode.window.activeTextEditor.selection;
        let selectedText = vscode.window.activeTextEditor.document.getText(selection);
        let promise = await createRandomFile(selectedText);
        let tempPath = promise.fsPath;
        vscode.commands.executeCommand('setContext', extensionName + '.leftSelected', true);
        vscode.commands.executeCommand('setContext', extensionName + '.leftFolderSelected', false);
        temporaryFiles.push(tempPath);
        leftPath = fs_1.default.realpathSync(tempPath);
        blnLeftReadOnly = true;
        vscode.window.showInformationMessage("Highlighted section selected as left file");
    });
    registerCommand('.compareWithLeftText', async () => {
        if (vscode.window.activeTextEditor === undefined) {
            return; //This should be impossible, as this command requires an active text editor to be enabled
        }
        let selection = vscode.window.activeTextEditor.selection;
        let selectedText = vscode.window.activeTextEditor.document.getText(selection);
        let promise = await createRandomFile(selectedText);
        let tempPath = promise.fsPath;
        temporaryFiles.push(tempPath);
        let rightPath = fs_1.default.realpathSync(tempPath);
        let options = "/rro";
        if (blnLeftReadOnly) {
            options += " /lro";
        }
        openBC(options, leftPath, rightPath);
    });
    registerCommand('.gitCompare', async (a) => {
        switch (a.type) {
            case 1:
            case 7:
                //Can't compare - no git version
                vscode.window.showErrorMessage("Error: No version of that file found in the current branch");
                break;
            case 2:
            case 6:
                //Can't compare - no version on disk
                vscode.window.showErrorMessage("Error: No version of that file found on the disk");
                break;
            case 5:
                //Modified, compare current to version on git (head)
                let case5Head = await gitCompareHelper(a.resourceUri.fsPath, "HEAD:./");
                if (fs_1.default.existsSync(a.resourceUri.fsPath) && case5Head) {
                    openBC("/lro", case5Head, a.resourceUri.fsPath);
                }
                else {
                    vscode.window.showErrorMessage("Error: an error occurred while reading from git");
                }
                break;
            case 0:
                //Modified and staged, compare staged to verison on git (head)
                let case0Staged = await gitCompareHelper(a.resourceUri.fsPath, ":./");
                let case0Head = await gitCompareHelper(a.resourceUri.fsPath, "HEAD:./");
                if (case0Head && case0Staged) {
                    openBC("/ro", case0Staged, case0Head);
                }
                else {
                    vscode.window.showErrorMessage("Error: an error occurred while reading from git");
                }
                break;
            default:
                //Generic fail
                vscode.window.showErrorMessage("Error: Unable to compare to that");
        }
    });
    registerCommand('.openFromDiff', async () => {
        let tab = vscode.window.tabGroups.activeTabGroup.activeTab;
        let leftFilePath = "";
        let rightFilePath = "";
        if (tab === undefined) {
            //Error: no tab active
            vscode.window.showErrorMessage("Error: No active tab");
            return;
        }
        let options = "";
        if (tab.input instanceof vscode.TabInputTextDiff) {
            rightFilePath = tab.input.modified.fsPath;
            leftFilePath = tab.input.original.fsPath;
            if (tab.input.original.scheme === "git") {
                let gitFilePath = await gitCompareHelper(leftFilePath, "HEAD:./");
                if (gitFilePath) {
                    leftFilePath = gitFilePath;
                    options += " /lro";
                }
                else {
                    //Error
                    vscode.window.showErrorMessage("Error: an error occurred while reading from git");
                    return;
                }
            }
            if (tab.input.modified.scheme === "git") {
                let gitFilePath = await gitCompareHelper(rightFilePath, ":./");
                if (gitFilePath) {
                    rightFilePath = gitFilePath;
                    options += " /rro";
                }
                else {
                    //Error
                    vscode.window.showErrorMessage("Error: an error occurred while reading from git");
                    return;
                }
            }
        }
        else {
            //Error-not a diff tab
            vscode.window.showErrorMessage("Error: Current tab is not a text comparison");
            return;
        }
        openBC(options, leftFilePath, rightFilePath);
    });
    registerCommand('.compareSelected', (...a) => {
        const items = a[1];
        if (items.length === 2) {
            //Two objects for compare - make sure both are files or both are folders
            let fileLeft = items[0].fsPath;
            let fileRight = items[1].fsPath;
            if (fs_1.default.statSync(fileLeft).isFile === fs_1.default.statSync(fileRight).isFile) {
                openBC("", fileLeft, fileRight);
            }
            else {
                //Error: Can't compare files to directories
                vscode.window.showErrorMessage("Error: Can't compare files to directories");
            }
        }
        else if (items.length === 3 && threeWayCompareAllowed) {
            if (strOS !== "win32") {
                if (!isPro()) {
                    threeWayCompareAllowed = false;
                    vscode.window.showErrorMessage("Error: Can't compare that many things");
                    return;
                }
            }
            let fileLeft = items[0].fsPath;
            let fileRight = items[2].fsPath;
            let fileCenter = items[1].fsPath;
            if (fs_1.default.statSync(fileLeft).isFile === fs_1.default.statSync(fileRight).isFile && fs_1.default.statSync(fileLeft).isFile === fs_1.default.statSync(fileCenter).isFile) {
                openBC("", fileLeft, fileRight, fileCenter);
            }
            else {
                //Error: Can't compare files to directories
                vscode.window.showErrorMessage("Error: Can't compare files to directories");
            }
        }
        else {
            //Error: to many for compare
            vscode.window.showErrorMessage("Error: Can't compare that many things");
        }
    });
    registerCommand('.launchBC', () => {
        openBC("");
    });
    async function compareWithSaveHelper(filePath, editor) {
        let textContent = editor.getText();
        let promise = await createRandomFile(textContent, path.extname(filePath));
        let editPath = promise.fsPath;
        openBC("/rro", filePath, editPath);
        temporaryFiles.push(editPath);
    }
    async function gitCompareHelper(strPath, command) {
        let directory = path.dirname(strPath);
        let fileName = path.basename(strPath);
        let filePath = false;
        await (0, simple_git_1.simpleGit)(directory).outputHandler((_comand, standardOut) => {
            filePath = path.join(os.tmpdir(), rndName() + path.extname(strPath));
            const writeStream = fs_1.default.createWriteStream(filePath);
            standardOut.pipe(writeStream).on('close', () => {
                if (filePath) {
                    temporaryFiles.push(filePath);
                }
            });
        }).raw(["show", command + fileName]).catch((_error) => {
            if (filePath) {
                fs_1.default.promises.unlink(filePath);
            }
            filePath = false;
        });
        return filePath;
    }
    function bcPath() {
        if (BCPath === "bcomp") {
            return BCPath;
        }
        else {
            return "\"" + BCPath + "\"";
        }
    }
    async function openBC(options = "", ...files) {
        if (files.length > 4) //Shouldn't ever be true
         {
            //Error: too many files
            vscode.window.showErrorMessage("Error: Can't open that many files in a comparison");
            return;
        }
        let cmd = bcPath() + " ";
        for (var file in files) {
            cmd += "\"" + files[file] + "\" ";
        }
        if (strOS !== 'win32') {
            options = options.replaceAll("/", "-");
        }
        cmd += options;
        (0, child_process_1.exec)(cmd, (error, stdout, stderr) => {
            if (error !== null) {
                if (error.code !== undefined) {
                    if ((error.code >= 100 && error.code !== 101) || stderr !== '') {
                        vscode.window.showErrorMessage(BCLoadErrorMessage);
                    }
                }
            }
        });
    }
    function rndName() {
        let name = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 10; i++) {
            name += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return name;
    }
    function createRandomFile(contents = '', fileExtension = '.txt') {
        return new Promise((resolve, reject) => {
            const tmpFile = path.join(os.tmpdir(), rndName() + fileExtension);
            fs_1.default.writeFile(tmpFile, contents, (error) => {
                if (error) {
                    return reject(error);
                }
                resolve(vscode.Uri.file(tmpFile));
            });
        });
    }
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    function registerCommand(commandName, fctn) {
        let command = vscode.commands.registerCommand(extensionName + commandName, fctn);
        context.subscriptions.push(command);
    }
    function isPro() {
        let possiblePaths = [];
        if (strOS == "darwin") {
            const basePath = os.homedir() + "/Library/Application Support/Beyond Compare";
            const isProName = "/IsPro";
            possiblePaths.push(basePath + " 5" + isProName);
            possiblePaths.push(basePath + " 4" + isProName);
            possiblePaths.push(basePath + isProName);
        }
        possiblePaths[0] = os.homedir() + "/Library/Application Support/Beyond Compare/IsPro";
        for (var path in possiblePaths) {
            let pathExists = fs_1.default.existsSync(possiblePaths[path]);
            if (pathExists) {
                let bfrReturn = fs_1.default.readFileSync(possiblePaths[path]);
                if (bfrReturn[0] == 1) {
                    return true;
                }
            }
        }
        return false;
    }
}
exports.activate = activate;
// This method is called when your extension is deactivated
function deactivate() {
    temporaryFiles.forEach((file) => //Delete all temporary files created by this extension
     {
        fs_1.default.promises.unlink(file);
    });
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map