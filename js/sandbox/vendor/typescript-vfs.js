define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createVirtualLanguageServiceHost = exports.createVirtualCompilerHost = exports.createSystem = exports.createDefaultMapFromCDN = exports.addFilesForTypesIntoFolder = exports.addAllFilesFromFolder = exports.createDefaultMapFromNodeModules = exports.knownLibFilesForCompilerOptions = exports.createVirtualTypeScriptEnvironment = void 0;
    const hasLocalStorage = typeof localStorage !== `undefined`;
    const hasProcess = typeof process !== `undefined`;
    const shouldDebug = (hasLocalStorage && localStorage.getItem("DEBUG")) || (hasProcess && process.env.DEBUG);
    const debugLog = shouldDebug ? console.log : (_message, ..._optionalParams) => "";
    /**
     * Makes a virtual copy of the TypeScript environment. This is the main API you want to be using with
     * @typescript/vfs. A lot of the other exposed functions are used by this function to get set up.
     *
     * @param sys an object which conforms to the TS Sys (a shim over read/write access to the fs)
     * @param rootFiles a list of files which are considered inside the project
     * @param ts a copy pf the TypeScript module
     * @param compilerOptions the options for this compiler run
     */
    function createVirtualTypeScriptEnvironment(sys, rootFiles, ts, compilerOptions = {}) {
        const mergedCompilerOpts = Object.assign(Object.assign({}, defaultCompilerOptions(ts)), compilerOptions);
        const { languageServiceHost, updateFile } = createVirtualLanguageServiceHost(sys, rootFiles, mergedCompilerOpts, ts);
        const languageService = ts.createLanguageService(languageServiceHost);
        const diagnostics = languageService.getCompilerOptionsDiagnostics();
        if (diagnostics.length) {
            const compilerHost = createVirtualCompilerHost(sys, compilerOptions, ts);
            throw new Error(ts.formatDiagnostics(diagnostics, compilerHost.compilerHost));
        }
        return {
            sys,
            languageService,
            getSourceFile: fileName => { var _a; return (_a = languageService.getProgram()) === null || _a === void 0 ? void 0 : _a.getSourceFile(fileName); },
            createFile: (fileName, content) => {
                updateFile(ts.createSourceFile(fileName, content, mergedCompilerOpts.target, false));
            },
            updateFile: (fileName, content, optPrevTextSpan) => {
                const prevSourceFile = languageService.getProgram().getSourceFile(fileName);
                if (!prevSourceFile) {
                    throw new Error("Did not find a source file for " + fileName);
                }
                const prevFullContents = prevSourceFile.text;
                // TODO: Validate if the default text span has a fencepost error?
                const prevTextSpan = optPrevTextSpan !== null && optPrevTextSpan !== void 0 ? optPrevTextSpan : ts.createTextSpan(0, prevFullContents.length);
                const newText = prevFullContents.slice(0, prevTextSpan.start) +
                    content +
                    prevFullContents.slice(prevTextSpan.start + prevTextSpan.length);
                const newSourceFile = ts.updateSourceFile(prevSourceFile, newText, {
                    span: prevTextSpan,
                    newLength: content.length
                });
                updateFile(newSourceFile);
            }
        };
    }
    exports.createVirtualTypeScriptEnvironment = createVirtualTypeScriptEnvironment;
    /**
     * Grab the list of lib files for a particular target, will return a bit more than necessary (by including
     * the dom) but that's OK
     *
     * @param target The compiler settings target baseline
     * @param ts A copy of the TypeScript module
     */
    exports.knownLibFilesForCompilerOptions = (compilerOptions, ts) => {
        const target = compilerOptions.target || ts.ScriptTarget.ES5;
        const lib = compilerOptions.lib || [];
        const files = [
            "lib.d.ts",
            "lib.dom.d.ts",
            "lib.dom.iterable.d.ts",
            "lib.webworker.d.ts",
            "lib.webworker.importscripts.d.ts",
            "lib.scripthost.d.ts",
            "lib.es5.d.ts",
            "lib.es6.d.ts",
            "lib.es2015.collection.d.ts",
            "lib.es2015.core.d.ts",
            "lib.es2015.d.ts",
            "lib.es2015.generator.d.ts",
            "lib.es2015.iterable.d.ts",
            "lib.es2015.promise.d.ts",
            "lib.es2015.proxy.d.ts",
            "lib.es2015.reflect.d.ts",
            "lib.es2015.symbol.d.ts",
            "lib.es2015.symbol.wellknown.d.ts",
            "lib.es2016.array.include.d.ts",
            "lib.es2016.d.ts",
            "lib.es2016.full.d.ts",
            "lib.es2017.d.ts",
            "lib.es2017.full.d.ts",
            "lib.es2017.intl.d.ts",
            "lib.es2017.object.d.ts",
            "lib.es2017.sharedmemory.d.ts",
            "lib.es2017.string.d.ts",
            "lib.es2017.typedarrays.d.ts",
            "lib.es2018.asyncgenerator.d.ts",
            "lib.es2018.asynciterable.d.ts",
            "lib.es2018.d.ts",
            "lib.es2018.full.d.ts",
            "lib.es2018.intl.d.ts",
            "lib.es2018.promise.d.ts",
            "lib.es2018.regexp.d.ts",
            "lib.es2019.array.d.ts",
            "lib.es2019.d.ts",
            "lib.es2019.full.d.ts",
            "lib.es2019.object.d.ts",
            "lib.es2019.string.d.ts",
            "lib.es2019.symbol.d.ts",
            "lib.es2020.d.ts",
            "lib.es2020.full.d.ts",
            "lib.es2020.string.d.ts",
            "lib.es2020.symbol.wellknown.d.ts",
            "lib.es2020.bigint.d.ts",
            "lib.es2020.promise.d.ts",
            "lib.es2020.intl.d.ts",
            "lib.esnext.array.d.ts",
            "lib.esnext.asynciterable.d.ts",
            "lib.esnext.bigint.d.ts",
            "lib.esnext.d.ts",
            "lib.esnext.full.d.ts",
            "lib.esnext.intl.d.ts",
            "lib.esnext.symbol.d.ts"
        ];
        const targetToCut = ts.ScriptTarget[target];
        const matches = files.filter(f => f.startsWith(`lib.${targetToCut.toLowerCase()}`));
        const targetCutIndex = files.indexOf(matches.pop());
        const getMax = (array) => array && array.length ? array.reduce((max, current) => (current > max ? current : max)) : undefined;
        // Find the index for everything in
        const indexesForCutting = lib.map(lib => {
            const matches = files.filter(f => f.startsWith(`lib.${lib.toLowerCase()}`));
            if (matches.length === 0)
                return 0;
            const cutIndex = files.indexOf(matches.pop());
            return cutIndex;
        });
        const libCutIndex = getMax(indexesForCutting) || 0;
        const finalCutIndex = Math.max(targetCutIndex, libCutIndex);
        return files.slice(0, finalCutIndex + 1);
    };
    /**
     * Sets up a Map with lib contents by grabbing the necessary files from
     * the local copy of typescript via the file system.
     */
    exports.createDefaultMapFromNodeModules = (compilerOptions) => {
        const ts = require("typescript");
        const path = require("path");
        const fs = require("fs");
        const getLib = (name) => {
            const lib = path.dirname(require.resolve("typescript"));
            return fs.readFileSync(path.join(lib, name), "utf8");
        };
        const libs = exports.knownLibFilesForCompilerOptions(compilerOptions, ts);
        const fsMap = new Map();
        libs.forEach(lib => {
            fsMap.set("/" + lib, getLib(lib));
        });
        return fsMap;
    };
    /**
     * Adds recursively files from the FS into the map based on the folder
     */
    exports.addAllFilesFromFolder = (map, workingDir) => {
        const path = require("path");
        const fs = require("fs");
        const walk = function (dir) {
            let results = [];
            const list = fs.readdirSync(dir);
            list.forEach(function (file) {
                file = path.join(dir, file);
                const stat = fs.statSync(file);
                if (stat && stat.isDirectory()) {
                    /* Recurse into a subdirectory */
                    results = results.concat(walk(file));
                }
                else {
                    /* Is a file */
                    results.push(file);
                }
            });
            return results;
        };
        const allFiles = walk(workingDir);
        allFiles.forEach(lib => {
            const fsPath = "/node_modules/@types" + lib.replace(workingDir, "");
            const content = fs.readFileSync(lib, "utf8");
            map.set(fsPath, content);
        });
    };
    /** Adds all files from node_modules/@types into the FS Map */
    exports.addFilesForTypesIntoFolder = (map) => exports.addAllFilesFromFolder(map, "node_modules/@types");
    /**
     * Create a virtual FS Map with the lib files from a particular TypeScript
     * version based on the target, Always includes dom ATM.
     *
     * @param options The compiler target, which dictates the libs to set up
     * @param version the versions of TypeScript which are supported
     * @param cache should the values be stored in local storage
     * @param ts a copy of the typescript import
     * @param lzstring an optional copy of the lz-string import
     * @param fetcher an optional replacement for the global fetch function (tests mainly)
     * @param storer an optional replacement for the localStorage global (tests mainly)
     */
    exports.createDefaultMapFromCDN = (options, version, cache, ts, lzstring, fetcher, storer) => {
        const fetchlike = fetcher || fetch;
        const storelike = storer || localStorage;
        const fsMap = new Map();
        const files = exports.knownLibFilesForCompilerOptions(options, ts);
        const prefix = `https://typescript.azureedge.net/cdn/${version}/typescript/lib/`;
        function zip(str) {
            return lzstring ? lzstring.compressToUTF16(str) : str;
        }
        function unzip(str) {
            return lzstring ? lzstring.decompressFromUTF16(str) : str;
        }
        // Map the known libs to a node fetch promise, then return the contents
        function uncached() {
            return Promise.all(files.map(lib => fetchlike(prefix + lib).then(resp => resp.text()))).then(contents => {
                contents.forEach((text, index) => fsMap.set("/" + files[index], text));
            });
        }
        // A localstorage and lzzip aware version of the lib files
        function cached() {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                // Remove anything which isn't from this version
                if (key.startsWith("ts-lib-") && !key.startsWith("ts-lib-" + version)) {
                    storelike.removeItem(key);
                }
            });
            return Promise.all(files.map(lib => {
                const cacheKey = `ts-lib-${version}-${lib}`;
                const content = storelike.getItem(cacheKey);
                if (!content) {
                    // Make the API call and store the text concent in the cache
                    return fetchlike(prefix + lib)
                        .then(resp => resp.text())
                        .then(t => {
                        storelike.setItem(cacheKey, zip(t));
                        return t;
                    });
                }
                else {
                    return Promise.resolve(unzip(content));
                }
            })).then(contents => {
                contents.forEach((text, index) => {
                    const name = "/" + files[index];
                    fsMap.set(name, text);
                });
            });
        }
        const func = cache ? cached : uncached;
        return func().then(() => fsMap);
    };
    // TODO: Add some kind of debug logger (needs to be compat with sandbox's deployment, not just via npm)
    function notImplemented(methodName) {
        throw new Error(`Method '${methodName}' is not implemented.`);
    }
    function audit(name, fn) {
        return (...args) => {
            const res = fn(...args);
            const smallres = typeof res === "string" ? res.slice(0, 80) + "..." : res;
            debugLog("> " + name, ...args);
            debugLog("< " + smallres);
            return res;
        };
    }
    /** The default compiler options if TypeScript could ever change the compiler options */
    const defaultCompilerOptions = (ts) => {
        return Object.assign(Object.assign({}, ts.getDefaultCompilerOptions()), { jsx: ts.JsxEmit.React, strict: true, esModuleInterop: true, module: ts.ModuleKind.ESNext, suppressOutputPathCheck: true, skipLibCheck: true, skipDefaultLibCheck: true, moduleResolution: ts.ModuleResolutionKind.NodeJs });
    };
    // "/DOM.d.ts" => "/lib.dom.d.ts"
    const libize = (path) => path.replace("/", "/lib.").toLowerCase();
    /**
     * Creates an in-memory System object which can be used in a TypeScript program, this
     * is what provides read/write aspects of the virtual fs
     */
    function createSystem(files) {
        return {
            args: [],
            createDirectory: () => notImplemented("createDirectory"),
            // TODO: could make a real file tree
            directoryExists: audit("directoryExists", directory => {
                return Array.from(files.keys()).some(path => path.startsWith(directory));
            }),
            exit: () => notImplemented("exit"),
            fileExists: audit("fileExists", fileName => files.has(fileName) || files.has(libize(fileName))),
            getCurrentDirectory: () => "/",
            getDirectories: () => [],
            getExecutingFilePath: () => notImplemented("getExecutingFilePath"),
            readDirectory: audit("readDirectory", directory => (directory === "/" ? Array.from(files.keys()) : [])),
            readFile: audit("readFile", fileName => files.get(fileName) || files.get(libize(fileName))),
            resolvePath: path => path,
            newLine: "\n",
            useCaseSensitiveFileNames: true,
            write: () => notImplemented("write"),
            writeFile: (fileName, contents) => {
                files.set(fileName, contents);
            }
        };
    }
    exports.createSystem = createSystem;
    /**
     * Creates an in-memory CompilerHost -which is essentially an extra wrapper to System
     * which works with TypeScript objects - returns both a compiler host, and a way to add new SourceFile
     * instances to the in-memory file system.
     */
    function createVirtualCompilerHost(sys, compilerOptions, ts) {
        const sourceFiles = new Map();
        const save = (sourceFile) => {
            sourceFiles.set(sourceFile.fileName, sourceFile);
            return sourceFile;
        };
        const vHost = {
            compilerHost: Object.assign(Object.assign({}, sys), { getCanonicalFileName: fileName => fileName, getDefaultLibFileName: () => "/" + ts.getDefaultLibFileName(compilerOptions), 
                // getDefaultLibLocation: () => '/',
                getDirectories: () => [], getNewLine: () => sys.newLine, getSourceFile: fileName => {
                    return (sourceFiles.get(fileName) ||
                        save(ts.createSourceFile(fileName, sys.readFile(fileName), compilerOptions.target || defaultCompilerOptions(ts).target, false)));
                }, useCaseSensitiveFileNames: () => sys.useCaseSensitiveFileNames }),
            updateFile: sourceFile => {
                const alreadyExists = sourceFiles.has(sourceFile.fileName);
                sys.writeFile(sourceFile.fileName, sourceFile.text);
                sourceFiles.set(sourceFile.fileName, sourceFile);
                return alreadyExists;
            }
        };
        return vHost;
    }
    exports.createVirtualCompilerHost = createVirtualCompilerHost;
    /**
     * Creates an object which can host a language service against the virtual file-system
     */
    function createVirtualLanguageServiceHost(sys, rootFiles, compilerOptions, ts) {
        const fileNames = [...rootFiles];
        const { compilerHost, updateFile } = createVirtualCompilerHost(sys, compilerOptions, ts);
        const fileVersions = new Map();
        let projectVersion = 0;
        const languageServiceHost = Object.assign(Object.assign({}, compilerHost), { getProjectVersion: () => projectVersion.toString(), getCompilationSettings: () => compilerOptions, getScriptFileNames: () => fileNames, getScriptSnapshot: fileName => {
                const contents = sys.readFile(fileName);
                if (contents) {
                    return ts.ScriptSnapshot.fromString(contents);
                }
                return;
            }, getScriptVersion: fileName => {
                return fileVersions.get(fileName) || "0";
            }, writeFile: sys.writeFile });
        const lsHost = {
            languageServiceHost,
            updateFile: sourceFile => {
                projectVersion++;
                fileVersions.set(sourceFile.fileName, projectVersion.toString());
                if (!fileNames.includes(sourceFile.fileName)) {
                    fileNames.push(sourceFile.fileName);
                }
                updateFile(sourceFile);
            }
        };
        return lsHost;
    }
    exports.createVirtualLanguageServiceHost = createVirtualLanguageServiceHost;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXNjcmlwdC12ZnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zYW5kYm94L3NyYy92ZW5kb3IvdHlwZXNjcmlwdC12ZnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztJQU9BLE1BQU0sZUFBZSxHQUFHLE9BQU8sWUFBWSxLQUFLLFdBQVcsQ0FBQTtJQUMzRCxNQUFNLFVBQVUsR0FBRyxPQUFPLE9BQU8sS0FBSyxXQUFXLENBQUE7SUFDakQsTUFBTSxXQUFXLEdBQUcsQ0FBQyxlQUFlLElBQUksWUFBWSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUE7SUFDM0csTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQWMsRUFBRSxHQUFHLGVBQXNCLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQTtJQVU5Rjs7Ozs7Ozs7T0FRRztJQUVILFNBQWdCLGtDQUFrQyxDQUNoRCxHQUFXLEVBQ1gsU0FBbUIsRUFDbkIsRUFBTSxFQUNOLGtCQUFtQyxFQUFFO1FBRXJDLE1BQU0sa0JBQWtCLG1DQUFRLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxHQUFLLGVBQWUsQ0FBRSxDQUFBO1FBRWhGLE1BQU0sRUFBRSxtQkFBbUIsRUFBRSxVQUFVLEVBQUUsR0FBRyxnQ0FBZ0MsQ0FBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLGtCQUFrQixFQUFFLEVBQUUsQ0FBQyxDQUFBO1FBQ3BILE1BQU0sZUFBZSxHQUFHLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFBO1FBQ3JFLE1BQU0sV0FBVyxHQUFHLGVBQWUsQ0FBQyw2QkFBNkIsRUFBRSxDQUFBO1FBRW5FLElBQUksV0FBVyxDQUFDLE1BQU0sRUFBRTtZQUN0QixNQUFNLFlBQVksR0FB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LCJzb3VyY2VzQ29udGVudCI6WyJ0eXBlIFN5c3RlbSA9IGltcG9ydChcInR5cGVzY3JpcHRcIikuU3lzdGVtXG50eXBlIENvbXBpbGVyT3B0aW9ucyA9IGltcG9ydChcInR5cGVzY3JpcHRcIikuQ29tcGlsZXJPcHRpb25zXG50eXBlIExhbmd1YWdlU2VydmljZUhvc3QgPSBpbXBvcnQoXCJ0eXBlc2NyaXB0XCIpLkxhbmd1YWdlU2VydmljZUhvc3RcbnR5cGUgQ29tcGlsZXJIb3N0ID0gaW1wb3J0KFwidHlwZXNjcmlwdFwiKS5Db21waWxlckhvc3RcbnR5cGUgU291cmNlRmlsZSA9IGltcG9ydChcInR5cGVzY3JpcHRcIikuU291cmNlRmlsZVxudHlwZSBUUyA9IHR5cGVvZiBpbXBvcnQoXCJ0eXBlc2NyaXB0XCIpXG5cbmNvbnN0IGhhc0xvY2FsU3RvcmFnZSA9IHR5cGVvZiBsb2NhbFN0b3JhZ2UgIT09IGB1bmRlZmluZWRgXG5jb25zdCBoYXNQcm9jZXNzID0gdHlwZW9mIHByb2Nlc3MgIT09IGB1bmRlZmluZWRgXG5jb25zdCBzaG91bGREZWJ1ZyA9IChoYXNMb2NhbFN0b3JhZ2UgJiYgbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJERUJVR1wiKSkgfHwgKGhhc1Byb2Nlc3MgJiYgcHJvY2Vzcy5lbnYuREVCVUcpXG5jb25zdCBkZWJ1Z0xvZyA9IHNob3VsZERlYnVnID8gY29uc29sZS5sb2cgOiAoX21lc3NhZ2U/OiBhbnksIC4uLl9vcHRpb25hbFBhcmFtczogYW55W10pID0+IFwiXCJcblxuZXhwb3J0IGludGVyZmFjZSBWaXJ0dWFsVHlwZVNjcmlwdEVudmlyb25tZW50IHtcbiAgc3lzOiBTeXN0ZW1cbiAgbGFuZ3VhZ2VTZXJ2aWNlOiBpbXBvcnQoXCJ0eXBlc2NyaXB0XCIpLkxhbmd1YWdlU2VydmljZVxuICBnZXRTb3VyY2VGaWxlOiAoZmlsZU5hbWU6IHN0cmluZykgPT4gaW1wb3J0KFwidHlwZXNjcmlwdFwiKS5Tb3VyY2VGaWxlIHwgdW5kZWZpbmVkXG4gIGNyZWF0ZUZpbGU6IChmaWxlTmFtZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpID0+IHZvaWRcbiAgdXBkYXRlRmlsZTogKGZpbGVOYW1lOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZywgcmVwbGFjZVRleHRTcGFuPzogaW1wb3J0KFwidHlwZXNjcmlwdFwiKS5UZXh0U3BhbikgPT4gdm9pZFxufVxuXG4vKipcbiAqIE1ha2VzIGEgdmlydHVhbCBjb3B5IG9mIHRoZSBUeXBlU2NyaXB0IGVudmlyb25tZW50LiBUaGlzIGlzIHRoZSBtYWluIEFQSSB5b3Ugd2FudCB0byBiZSB1c2luZyB3aXRoXG4gKiBAdHlwZXNjcmlwdC92ZnMuIEEgbG90IG9mIHRoZSBvdGhlciBleHBvc2VkIGZ1bmN0aW9ucyBhcmUgdXNlZCBieSB0aGlzIGZ1bmN0aW9uIHRvIGdldCBzZXQgdXAuXG4gKlxuICogQHBhcmFtIHN5cyBhbiBvYmplY3Qgd2hpY2ggY29uZm9ybXMgdG8gdGhlIFRTIFN5cyAoYSBzaGltIG92ZXIgcmVhZC93cml0ZSBhY2Nlc3MgdG8gdGhlIGZzKVxuICogQHBhcmFtIHJvb3RGaWxlcyBhIGxpc3Qgb2YgZmlsZXMgd2hpY2ggYXJlIGNvbnNpZGVyZWQgaW5zaWRlIHRoZSBwcm9qZWN0XG4gKiBAcGFyYW0gdHMgYSBjb3B5IHBmIHRoZSBUeXBlU2NyaXB0IG1vZHVsZVxuICogQHBhcmFtIGNvbXBpbGVyT3B0aW9ucyB0aGUgb3B0aW9ucyBmb3IgdGhpcyBjb21waWxlciBydW5cbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVmlydHVhbFR5cGVTY3JpcHRFbnZpcm9ubWVudChcbiAgc3lzOiBTeXN0ZW0sXG4gIHJvb3RGaWxlczogc3RyaW5nW10sXG4gIHRzOiBUUyxcbiAgY29tcGlsZXJPcHRpb25zOiBDb21waWxlck9wdGlvbnMgPSB7fVxuKTogVmlydHVhbFR5cGVTY3JpcHRFbnZpcm9ubWVudCB7XG4gIGNvbnN0IG1lcmdlZENvbXBpbGVyT3B0cyA9IHsgLi4uZGVmYXVsdENvbXBpbGVyT3B0aW9ucyh0cyksIC4uLmNvbXBpbGVyT3B0aW9ucyB9XG5cbiAgY29uc3QgeyBsYW5ndWFnZVNlcnZpY2VIb3N0LCB1cGRhdGVGaWxlIH0gPSBjcmVhdGVWaXJ0dWFsTGFuZ3VhZ2VTZXJ2aWNlSG9zdChzeXMsIHJvb3RGaWxlcywgbWVyZ2VkQ29tcGlsZXJPcHRzLCB0cylcbiAgY29uc3QgbGFuZ3VhZ2VTZXJ2aWNlID0gdHMuY3JlYXRlTGFuZ3VhZ2VTZXJ2aWNlKGxhbmd1YWdlU2VydmljZUhvc3QpXG4gIGNvbnN0IGRpYWdub3N0aWNzID0gbGFuZ3VhZ2VTZXJ2aWNlLmdldENvbXBpbGVyT3B0aW9uc0RpYWdub3N0aWNzKClcblxuICBpZiAoZGlhZ25vc3RpY3MubGVuZ3RoKSB7XG4gICAgY29uc3QgY29tcGlsZXJIb3N0ID0gY3JlYXRlVmlydHVhbENvbXBpbGVySG9zdChzeXMsIGNvbXBpbGVyT3B0aW9ucywgdHMpXG4gICAgdGhyb3cgbmV3IEVycm9yKHRzLmZvcm1hdERpYWdub3N0aWNzKGRpYWdub3N0aWNzLCBjb21waWxlckhvc3QuY29tcGlsZXJIb3N0KSlcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgc3lzLFxuICAgIGxhbmd1YWdlU2VydmljZSxcbiAgICBnZXRTb3VyY2VGaWxlOiBmaWxlTmFtZSA9PiBsYW5ndWFnZVNlcnZpY2UuZ2V0UHJvZ3JhbSgpPy5nZXRTb3VyY2VGaWxlKGZpbGVOYW1lKSxcblxuICAgIGNyZWF0ZUZpbGU6IChmaWxlTmFtZSwgY29udGVudCkgPT4ge1xuICAgICAgdXBkYXRlRmlsZSh0cy5jcmVhdGVTb3VyY2VGaWxlKGZpbGVOYW1lLCBjb250ZW50LCBtZXJnZWRDb21waWxlck9wdHMudGFyZ2V0ISwgZmFsc2UpKVxuICAgIH0sXG4gICAgdXBkYXRlRmlsZTogKGZpbGVOYW1lLCBjb250ZW50LCBvcHRQcmV2VGV4dFNwYW4pID0+IHtcbiAgICAgIGNvbnN0IHByZXZTb3VyY2VGaWxlID0gbGFuZ3VhZ2VTZXJ2aWNlLmdldFByb2dyYW0oKSEuZ2V0U291cmNlRmlsZShmaWxlTmFtZSlcbiAgICAgIGlmICghcHJldlNvdXJjZUZpbGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRGlkIG5vdCBmaW5kIGEgc291cmNlIGZpbGUgZm9yIFwiICsgZmlsZU5hbWUpXG4gICAgICB9XG4gICAgICBjb25zdCBwcmV2RnVsbENvbnRlbnRzID0gcHJldlNvdXJjZUZpbGUudGV4dFxuXG4gICAgICAvLyBUT0RPOiBWYWxpZGF0ZSBpZiB0aGUgZGVmYXVsdCB0ZXh0IHNwYW4gaGFzIGEgZmVuY2Vwb3N0IGVycm9yP1xuICAgICAgY29uc3QgcHJldlRleHRTcGFuID0gb3B0UHJldlRleHRTcGFuID8/IHRzLmNyZWF0ZVRleHRTcGFuKDAsIHByZXZGdWxsQ29udGVudHMubGVuZ3RoKVxuICAgICAgY29uc3QgbmV3VGV4dCA9XG4gICAgICAgIHByZXZGdWxsQ29udGVudHMuc2xpY2UoMCwgcHJldlRleHRTcGFuLnN0YXJ0KSArXG4gICAgICAgIGNvbnRlbnQgK1xuICAgICAgICBwcmV2RnVsbENvbnRlbnRzLnNsaWNlKHByZXZUZXh0U3Bhbi5zdGFydCArIHByZXZUZXh0U3Bhbi5sZW5ndGgpXG4gICAgICBjb25zdCBuZXdTb3VyY2VGaWxlID0gdHMudXBkYXRlU291cmNlRmlsZShwcmV2U291cmNlRmlsZSwgbmV3VGV4dCwge1xuICAgICAgICBzcGFuOiBwcmV2VGV4dFNwYW4sXG4gICAgICAgIG5ld0xlbmd0aDogY29udGVudC5sZW5ndGhcbiAgICAgIH0pXG5cbiAgICAgIHVwZGF0ZUZpbGUobmV3U291cmNlRmlsZSlcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBHcmFiIHRoZSBsaXN0IG9mIGxpYiBmaWxlcyBmb3IgYSBwYXJ0aWN1bGFyIHRhcmdldCwgd2lsbCByZXR1cm4gYSBiaXQgbW9yZSB0aGFuIG5lY2Vzc2FyeSAoYnkgaW5jbHVkaW5nXG4gKiB0aGUgZG9tKSBidXQgdGhhdCdzIE9LXG4gKlxuICogQHBhcmFtIHRhcmdldCBUaGUgY29tcGlsZXIgc2V0dGluZ3MgdGFyZ2V0IGJhc2VsaW5lXG4gKiBAcGFyYW0gdHMgQSBjb3B5IG9mIHRoZSBUeXBlU2NyaXB0IG1vZHVsZVxuICovXG5leHBvcnQgY29uc3Qga25vd25MaWJGaWxlc0ZvckNvbXBpbGVyT3B0aW9ucyA9IChjb21waWxlck9wdGlvbnM6IENvbXBpbGVyT3B0aW9ucywgdHM6IFRTKSA9PiB7XG4gIGNvbnN0IHRhcmdldCA9IGNvbXBpbGVyT3B0aW9ucy50YXJnZXQgfHwgdHMuU2NyaXB0VGFyZ2V0LkVTNVxuICBjb25zdCBsaWIgPSBjb21waWxlck9wdGlvbnMubGliIHx8IFtdXG5cbiAgY29uc3QgZmlsZXMgPSBbXG4gICAgXCJsaWIuZC50c1wiLFxuICAgIFwibGliLmRvbS5kLnRzXCIsXG4gICAgXCJsaWIuZG9tLml0ZXJhYmxlLmQudHNcIixcbiAgICBcImxpYi53ZWJ3b3JrZXIuZC50c1wiLFxuICAgIFwibGliLndlYndvcmtlci5pbXBvcnRzY3JpcHRzLmQudHNcIixcbiAgICBcImxpYi5zY3JpcHRob3N0LmQudHNcIixcbiAgICBcImxpYi5lczUuZC50c1wiLFxuICAgIFwibGliLmVzNi5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE1LmNvbGxlY3Rpb24uZC50c1wiLFxuICAgIFwibGliLmVzMjAxNS5jb3JlLmQudHNcIixcbiAgICBcImxpYi5lczIwMTUuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNS5nZW5lcmF0b3IuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNS5pdGVyYWJsZS5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE1LnByb21pc2UuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNS5wcm94eS5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE1LnJlZmxlY3QuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNS5zeW1ib2wuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNS5zeW1ib2wud2VsbGtub3duLmQudHNcIixcbiAgICBcImxpYi5lczIwMTYuYXJyYXkuaW5jbHVkZS5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE2LmQudHNcIixcbiAgICBcImxpYi5lczIwMTYuZnVsbC5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE3LmQudHNcIixcbiAgICBcImxpYi5lczIwMTcuZnVsbC5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE3LmludGwuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNy5vYmplY3QuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNy5zaGFyZWRtZW1vcnkuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNy5zdHJpbmcuZC50c1wiLFxuICAgIFwibGliLmVzMjAxNy50eXBlZGFycmF5cy5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE4LmFzeW5jZ2VuZXJhdG9yLmQudHNcIixcbiAgICBcImxpYi5lczIwMTguYXN5bmNpdGVyYWJsZS5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE4LmQudHNcIixcbiAgICBcImxpYi5lczIwMTguZnVsbC5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE4LmludGwuZC50c1wiLFxuICAgIFwibGliLmVzMjAxOC5wcm9taXNlLmQudHNcIixcbiAgICBcImxpYi5lczIwMTgucmVnZXhwLmQudHNcIixcbiAgICBcImxpYi5lczIwMTkuYXJyYXkuZC50c1wiLFxuICAgIFwibGliLmVzMjAxOS5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDE5LmZ1bGwuZC50c1wiLFxuICAgIFwibGliLmVzMjAxOS5vYmplY3QuZC50c1wiLFxuICAgIFwibGliLmVzMjAxOS5zdHJpbmcuZC50c1wiLFxuICAgIFwibGliLmVzMjAxOS5zeW1ib2wuZC50c1wiLFxuICAgIFwibGliLmVzMjAyMC5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDIwLmZ1bGwuZC50c1wiLFxuICAgIFwibGliLmVzMjAyMC5zdHJpbmcuZC50c1wiLFxuICAgIFwibGliLmVzMjAyMC5zeW1ib2wud2VsbGtub3duLmQudHNcIixcbiAgICBcImxpYi5lczIwMjAuYmlnaW50LmQudHNcIixcbiAgICBcImxpYi5lczIwMjAucHJvbWlzZS5kLnRzXCIsXG4gICAgXCJsaWIuZXMyMDIwLmludGwuZC50c1wiLFxuICAgIFwibGliLmVzbmV4dC5hcnJheS5kLnRzXCIsXG4gICAgXCJsaWIuZXNuZXh0LmFzeW5jaXRlcmFibGUuZC50c1wiLFxuICAgIFwibGliLmVzbmV4dC5iaWdpbnQuZC50c1wiLFxuICAgIFwibGliLmVzbmV4dC5kLnRzXCIsXG4gICAgXCJsaWIuZXNuZXh0LmZ1bGwuZC50c1wiLFxuICAgIFwibGliLmVzbmV4dC5pbnRsLmQudHNcIixcbiAgICBcImxpYi5lc25leHQuc3ltYm9sLmQudHNcIlxuICBdXG5cbiAgY29uc3QgdGFyZ2V0VG9DdXQgPSB0cy5TY3JpcHRUYXJnZXRbdGFyZ2V0XVxuICBjb25zdCBtYXRjaGVzID0gZmlsZXMuZmlsdGVyKGYgPT4gZi5zdGFydHNXaXRoKGBsaWIuJHt0YXJnZXRUb0N1dC50b0xvd2VyQ2FzZSgpfWApKVxuICBjb25zdCB0YXJnZXRDdXRJbmRleCA9IGZpbGVzLmluZGV4T2YobWF0Y2hlcy5wb3AoKSEpXG5cbiAgY29uc3QgZ2V0TWF4ID0gKGFycmF5OiBudW1iZXJbXSkgPT5cbiAgICBhcnJheSAmJiBhcnJheS5sZW5ndGggPyBhcnJheS5yZWR1Y2UoKG1heCwgY3VycmVudCkgPT4gKGN1cnJlbnQgPiBtYXggPyBjdXJyZW50IDogbWF4KSkgOiB1bmRlZmluZWRcblxuICAvLyBGaW5kIHRoZSBpbmRleCBmb3IgZXZlcnl0aGluZyBpblxuICBjb25zdCBpbmRleGVzRm9yQ3V0dGluZyA9IGxpYi5tYXAobGliID0+IHtcbiAgICBjb25zdCBtYXRjaGVzID0gZmlsZXMuZmlsdGVyKGYgPT4gZi5zdGFydHNXaXRoKGBsaWIuJHtsaWIudG9Mb3dlckNhc2UoKX1gKSlcbiAgICBpZiAobWF0Y2hlcy5sZW5ndGggPT09IDApIHJldHVybiAwXG5cbiAgICBjb25zdCBjdXRJbmRleCA9IGZpbGVzLmluZGV4T2YobWF0Y2hlcy5wb3AoKSEpXG4gICAgcmV0dXJuIGN1dEluZGV4XG4gIH0pXG5cbiAgY29uc3QgbGliQ3V0SW5kZXggPSBnZXRNYXgoaW5kZXhlc0ZvckN1dHRpbmcpIHx8IDBcblxuICBjb25zdCBmaW5hbEN1dEluZGV4ID0gTWF0aC5tYXgodGFyZ2V0Q3V0SW5kZXgsIGxpYkN1dEluZGV4KVxuICByZXR1cm4gZmlsZXMuc2xpY2UoMCwgZmluYWxDdXRJbmRleCArIDEpXG59XG5cbi8qKlxuICogU2V0cyB1cCBhIE1hcCB3aXRoIGxpYiBjb250ZW50cyBieSBncmFiYmluZyB0aGUgbmVjZXNzYXJ5IGZpbGVzIGZyb21cbiAqIHRoZSBsb2NhbCBjb3B5IG9mIHR5cGVzY3JpcHQgdmlhIHRoZSBmaWxlIHN5c3RlbS5cbiAqL1xuZXhwb3J0IGNvbnN0IGNyZWF0ZURlZmF1bHRNYXBGcm9tTm9kZU1vZHVsZXMgPSAoY29tcGlsZXJPcHRpb25zOiBDb21waWxlck9wdGlvbnMpID0+IHtcbiAgY29uc3QgdHMgPSByZXF1aXJlKFwidHlwZXNjcmlwdFwiKVxuICBjb25zdCBwYXRoID0gcmVxdWlyZShcInBhdGhcIilcbiAgY29uc3QgZnMgPSByZXF1aXJlKFwiZnNcIilcblxuICBjb25zdCBnZXRMaWIgPSAobmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgbGliID0gcGF0aC5kaXJuYW1lKHJlcXVpcmUucmVzb2x2ZShcInR5cGVzY3JpcHRcIikpXG4gICAgcmV0dXJuIGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4obGliLCBuYW1lKSwgXCJ1dGY4XCIpXG4gIH1cblxuICBjb25zdCBsaWJzID0ga25vd25MaWJGaWxlc0ZvckNvbXBpbGVyT3B0aW9ucyhjb21waWxlck9wdGlvbnMsIHRzKVxuICBjb25zdCBmc01hcCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KClcbiAgbGlicy5mb3JFYWNoKGxpYiA9PiB7XG4gICAgZnNNYXAuc2V0KFwiL1wiICsgbGliLCBnZXRMaWIobGliKSlcbiAgfSlcbiAgcmV0dXJuIGZzTWFwXG59XG5cbi8qKlxuICogQWRkcyByZWN1cnNpdmVseSBmaWxlcyBmcm9tIHRoZSBGUyBpbnRvIHRoZSBtYXAgYmFzZWQgb24gdGhlIGZvbGRlclxuICovXG5leHBvcnQgY29uc3QgYWRkQWxsRmlsZXNGcm9tRm9sZGVyID0gKG1hcDogTWFwPHN0cmluZywgc3RyaW5nPiwgd29ya2luZ0Rpcjogc3RyaW5nKTogdm9pZCA9PiB7XG4gIGNvbnN0IHBhdGggPSByZXF1aXJlKFwicGF0aFwiKVxuICBjb25zdCBmcyA9IHJlcXVpcmUoXCJmc1wiKVxuXG4gIGNvbnN0IHdhbGsgPSBmdW5jdGlvbihkaXI6IHN0cmluZykge1xuICAgIGxldCByZXN1bHRzOiBzdHJpbmdbXSA9IFtdXG4gICAgY29uc3QgbGlzdCA9IGZzLnJlYWRkaXJTeW5jKGRpcilcbiAgICBsaXN0LmZvckVhY2goZnVuY3Rpb24oZmlsZTogc3RyaW5nKSB7XG4gICAgICBmaWxlID0gcGF0aC5qb2luKGRpciwgZmlsZSlcbiAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhmaWxlKVxuICAgICAgaWYgKHN0YXQgJiYgc3RhdC5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgIC8qIFJlY3Vyc2UgaW50byBhIHN1YmRpcmVjdG9yeSAqL1xuICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5jb25jYXQod2FsayhmaWxlKSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8qIElzIGEgZmlsZSAqL1xuICAgICAgICByZXN1bHRzLnB1c2goZmlsZSlcbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiByZXN1bHRzXG4gIH1cblxuICBjb25zdCBhbGxGaWxlcyA9IHdhbGsod29ya2luZ0RpcilcblxuICBhbGxGaWxlcy5mb3JFYWNoKGxpYiA9PiB7XG4gICAgY29uc3QgZnNQYXRoID0gXCIvbm9kZV9tb2R1bGVzL0B0eXBlc1wiICsgbGliLnJlcGxhY2Uod29ya2luZ0RpciwgXCJcIilcbiAgICBjb25zdCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKGxpYiwgXCJ1dGY4XCIpXG4gICAgbWFwLnNldChmc1BhdGgsIGNvbnRlbnQpXG4gIH0pXG59XG5cbi8qKiBBZGRzIGFsbCBmaWxlcyBmcm9tIG5vZGVfbW9kdWxlcy9AdHlwZXMgaW50byB0aGUgRlMgTWFwICovXG5leHBvcnQgY29uc3QgYWRkRmlsZXNGb3JUeXBlc0ludG9Gb2xkZXIgPSAobWFwOiBNYXA8c3RyaW5nLCBzdHJpbmc+KSA9PlxuICBhZGRBbGxGaWxlc0Zyb21Gb2xkZXIobWFwLCBcIm5vZGVfbW9kdWxlcy9AdHlwZXNcIilcblxuLyoqXG4gKiBDcmVhdGUgYSB2aXJ0dWFsIEZTIE1hcCB3aXRoIHRoZSBsaWIgZmlsZXMgZnJvbSBhIHBhcnRpY3VsYXIgVHlwZVNjcmlwdFxuICogdmVyc2lvbiBiYXNlZCBvbiB0aGUgdGFyZ2V0LCBBbHdheXMgaW5jbHVkZXMgZG9tIEFUTS5cbiAqXG4gKiBAcGFyYW0gb3B0aW9ucyBUaGUgY29tcGlsZXIgdGFyZ2V0LCB3aGljaCBkaWN0YXRlcyB0aGUgbGlicyB0byBzZXQgdXBcbiAqIEBwYXJhbSB2ZXJzaW9uIHRoZSB2ZXJzaW9ucyBvZiBUeXBlU2NyaXB0IHdoaWNoIGFyZSBzdXBwb3J0ZWRcbiAqIEBwYXJhbSBjYWNoZSBzaG91bGQgdGhlIHZhbHVlcyBiZSBzdG9yZWQgaW4gbG9jYWwgc3RvcmFnZVxuICogQHBhcmFtIHRzIGEgY29weSBvZiB0aGUgdHlwZXNjcmlwdCBpbXBvcnRcbiAqIEBwYXJhbSBsenN0cmluZyBhbiBvcHRpb25hbCBjb3B5IG9mIHRoZSBsei1zdHJpbmcgaW1wb3J0XG4gKiBAcGFyYW0gZmV0Y2hlciBhbiBvcHRpb25hbCByZXBsYWNlbWVudCBmb3IgdGhlIGdsb2JhbCBmZXRjaCBmdW5jdGlvbiAodGVzdHMgbWFpbmx5KVxuICogQHBhcmFtIHN0b3JlciBhbiBvcHRpb25hbCByZXBsYWNlbWVudCBmb3IgdGhlIGxvY2FsU3RvcmFnZSBnbG9iYWwgKHRlc3RzIG1haW5seSlcbiAqL1xuZXhwb3J0IGNvbnN0IGNyZWF0ZURlZmF1bHRNYXBGcm9tQ0ROID0gKFxuICBvcHRpb25zOiBDb21waWxlck9wdGlvbnMsXG4gIHZlcnNpb246IHN0cmluZyxcbiAgY2FjaGU6IGJvb2xlYW4sXG4gIHRzOiBUUyxcbiAgbHpzdHJpbmc/OiB0eXBlb2YgaW1wb3J0KFwibHotc3RyaW5nXCIpLFxuICBmZXRjaGVyPzogdHlwZW9mIGZldGNoLFxuICBzdG9yZXI/OiB0eXBlb2YgbG9jYWxTdG9yYWdlXG4pID0+IHtcbiAgY29uc3QgZmV0Y2hsaWtlID0gZmV0Y2hlciB8fCBmZXRjaFxuICBjb25zdCBzdG9yZWxpa2UgPSBzdG9yZXIgfHwgbG9jYWxTdG9yYWdlXG4gIGNvbnN0IGZzTWFwID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKVxuICBjb25zdCBmaWxlcyA9IGtub3duTGliRmlsZXNGb3JDb21waWxlck9wdGlvbnMob3B0aW9ucywgdHMpXG4gIGNvbnN0IHByZWZpeCA9IGBodHRwczovL3R5cGVzY3JpcHQuYXp1cmVlZGdlLm5ldC9jZG4vJHt2ZXJzaW9ufS90eXBlc2NyaXB0L2xpYi9gXG5cbiAgZnVuY3Rpb24gemlwKHN0cjogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGx6c3RyaW5nID8gbHpzdHJpbmcuY29tcHJlc3NUb1VURjE2KHN0cikgOiBzdHJcbiAgfVxuXG4gIGZ1bmN0aW9uIHVuemlwKHN0cjogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGx6c3RyaW5nID8gbHpzdHJpbmcuZGVjb21wcmVzc0Zyb21VVEYxNihzdHIpIDogc3RyXG4gIH1cblxuICAvLyBNYXAgdGhlIGtub3duIGxpYnMgdG8gYSBub2RlIGZldGNoIHByb21pc2UsIHRoZW4gcmV0dXJuIHRoZSBjb250ZW50c1xuICBmdW5jdGlvbiB1bmNhY2hlZCgpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoZmlsZXMubWFwKGxpYiA9PiBmZXRjaGxpa2UocHJlZml4ICsgbGliKS50aGVuKHJlc3AgPT4gcmVzcC50ZXh0KCkpKSkudGhlbihjb250ZW50cyA9PiB7XG4gICAgICBjb250ZW50cy5mb3JFYWNoKCh0ZXh0LCBpbmRleCkgPT4gZnNNYXAuc2V0KFwiL1wiICsgZmlsZXNbaW5kZXhdLCB0ZXh0KSlcbiAgICB9KVxuICB9XG5cbiAgLy8gQSBsb2NhbHN0b3JhZ2UgYW5kIGx6emlwIGF3YXJlIHZlcnNpb24gb2YgdGhlIGxpYiBmaWxlc1xuICBmdW5jdGlvbiBjYWNoZWQoKSB7XG4gICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKGxvY2FsU3RvcmFnZSlcbiAgICBrZXlzLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIC8vIFJlbW92ZSBhbnl0aGluZyB3aGljaCBpc24ndCBmcm9tIHRoaXMgdmVyc2lvblxuICAgICAgaWYgKGtleS5zdGFydHNXaXRoKFwidHMtbGliLVwiKSAmJiAha2V5LnN0YXJ0c1dpdGgoXCJ0cy1saWItXCIgKyB2ZXJzaW9uKSkge1xuICAgICAgICBzdG9yZWxpa2UucmVtb3ZlSXRlbShrZXkpXG4gICAgICB9XG4gICAgfSlcblxuICAgIHJldHVybiBQcm9taXNlLmFsbChcbiAgICAgIGZpbGVzLm1hcChsaWIgPT4ge1xuICAgICAgICBjb25zdCBjYWNoZUtleSA9IGB0cy1saWItJHt2ZXJzaW9ufS0ke2xpYn1gXG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBzdG9yZWxpa2UuZ2V0SXRlbShjYWNoZUtleSlcblxuICAgICAgICBpZiAoIWNvbnRlbnQpIHtcbiAgICAgICAgICAvLyBNYWtlIHRoZSBBUEkgY2FsbCBhbmQgc3RvcmUgdGhlIHRleHQgY29uY2VudCBpbiB0aGUgY2FjaGVcbiAgICAgICAgICByZXR1cm4gZmV0Y2hsaWtlKHByZWZpeCArIGxpYilcbiAgICAgICAgICAgIC50aGVuKHJlc3AgPT4gcmVzcC50ZXh0KCkpXG4gICAgICAgICAgICAudGhlbih0ID0+IHtcbiAgICAgICAgICAgICAgc3RvcmVsaWtlLnNldEl0ZW0oY2FjaGVLZXksIHppcCh0KSlcbiAgICAgICAgICAgICAgcmV0dXJuIHRcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bnppcChjb250ZW50KSlcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICApLnRoZW4oY29udGVudHMgPT4ge1xuICAgICAgY29udGVudHMuZm9yRWFjaCgodGV4dCwgaW5kZXgpID0+IHtcbiAgICAgICAgY29uc3QgbmFtZSA9IFwiL1wiICsgZmlsZXNbaW5kZXhdXG4gICAgICAgIGZzTWFwLnNldChuYW1lLCB0ZXh0KVxuICAgICAgfSlcbiAgICB9KVxuICB9XG5cbiAgY29uc3QgZnVuYyA9IGNhY2hlID8gY2FjaGVkIDogdW5jYWNoZWRcbiAgcmV0dXJuIGZ1bmMoKS50aGVuKCgpID0+IGZzTWFwKVxufVxuXG4vLyBUT0RPOiBBZGQgc29tZSBraW5kIG9mIGRlYnVnIGxvZ2dlciAobmVlZHMgdG8gYmUgY29tcGF0IHdpdGggc2FuZGJveCdzIGRlcGxveW1lbnQsIG5vdCBqdXN0IHZpYSBucG0pXG5cbmZ1bmN0aW9uIG5vdEltcGxlbWVudGVkKG1ldGhvZE5hbWU6IHN0cmluZyk6IGFueSB7XG4gIHRocm93IG5ldyBFcnJvcihgTWV0aG9kICcke21ldGhvZE5hbWV9JyBpcyBub3QgaW1wbGVtZW50ZWQuYClcbn1cblxuZnVuY3Rpb24gYXVkaXQ8QXJnc1QgZXh0ZW5kcyBhbnlbXSwgUmV0dXJuVD4oXG4gIG5hbWU6IHN0cmluZyxcbiAgZm46ICguLi5hcmdzOiBBcmdzVCkgPT4gUmV0dXJuVFxuKTogKC4uLmFyZ3M6IEFyZ3NUKSA9PiBSZXR1cm5UIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgcmVzID0gZm4oLi4uYXJncylcblxuICAgIGNvbnN0IHNtYWxscmVzID0gdHlwZW9mIHJlcyA9PT0gXCJzdHJpbmdcIiA/IHJlcy5zbGljZSgwLCA4MCkgKyBcIi4uLlwiIDogcmVzXG4gICAgZGVidWdMb2coXCI+IFwiICsgbmFtZSwgLi4uYXJncylcbiAgICBkZWJ1Z0xvZyhcIjwgXCIgKyBzbWFsbHJlcylcblxuICAgIHJldHVybiByZXNcbiAgfVxufVxuXG4vKiogVGhlIGRlZmF1bHQgY29tcGlsZXIgb3B0aW9ucyBpZiBUeXBlU2NyaXB0IGNvdWxkIGV2ZXIgY2hhbmdlIHRoZSBjb21waWxlciBvcHRpb25zICovXG5jb25zdCBkZWZhdWx0Q29tcGlsZXJPcHRpb25zID0gKHRzOiB0eXBlb2YgaW1wb3J0KFwidHlwZXNjcmlwdFwiKSk6IENvbXBpbGVyT3B0aW9ucyA9PiB7XG4gIHJldHVybiB7XG4gICAgLi4udHMuZ2V0RGVmYXVsdENvbXBpbGVyT3B0aW9ucygpLFxuICAgIGpzeDogdHMuSnN4RW1pdC5SZWFjdCxcbiAgICBzdHJpY3Q6IHRydWUsXG4gICAgZXNNb2R1bGVJbnRlcm9wOiB0cnVlLFxuICAgIG1vZHVsZTogdHMuTW9kdWxlS2luZC5FU05leHQsXG4gICAgc3VwcHJlc3NPdXRwdXRQYXRoQ2hlY2s6IHRydWUsXG4gICAgc2tpcExpYkNoZWNrOiB0cnVlLFxuICAgIHNraXBEZWZhdWx0TGliQ2hlY2s6IHRydWUsXG4gICAgbW9kdWxlUmVzb2x1dGlvbjogdHMuTW9kdWxlUmVzb2x1dGlvbktpbmQuTm9kZUpzXG4gIH1cbn1cblxuLy8gXCIvRE9NLmQudHNcIiA9PiBcIi9saWIuZG9tLmQudHNcIlxuY29uc3QgbGliaXplID0gKHBhdGg6IHN0cmluZykgPT4gcGF0aC5yZXBsYWNlKFwiL1wiLCBcIi9saWIuXCIpLnRvTG93ZXJDYXNlKClcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGluLW1lbW9yeSBTeXN0ZW0gb2JqZWN0IHdoaWNoIGNhbiBiZSB1c2VkIGluIGEgVHlwZVNjcmlwdCBwcm9ncmFtLCB0aGlzXG4gKiBpcyB3aGF0IHByb3ZpZGVzIHJlYWQvd3JpdGUgYXNwZWN0cyBvZiB0aGUgdmlydHVhbCBmc1xuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU3lzdGVtKGZpbGVzOiBNYXA8c3RyaW5nLCBzdHJpbmc+KTogU3lzdGVtIHtcbiAgcmV0dXJuIHtcbiAgICBhcmdzOiBbXSxcbiAgICBjcmVhdGVEaXJlY3Rvcnk6ICgpID0+IG5vdEltcGxlbWVudGVkKFwiY3JlYXRlRGlyZWN0b3J5XCIpLFxuICAgIC8vIFRPRE86IGNvdWxkIG1ha2UgYSByZWFsIGZpbGUgdHJlZVxuICAgIGRpcmVjdG9yeUV4aXN0czogYXVkaXQoXCJkaXJlY3RvcnlFeGlzdHNcIiwgZGlyZWN0b3J5ID0+IHtcbiAgICAgIHJldHVybiBBcnJheS5mcm9tKGZpbGVzLmtleXMoKSkuc29tZShwYXRoID0+IHBhdGguc3RhcnRzV2l0aChkaXJlY3RvcnkpKVxuICAgIH0pLFxuICAgIGV4aXQ6ICgpID0+IG5vdEltcGxlbWVudGVkKFwiZXhpdFwiKSxcbiAgICBmaWxlRXhpc3RzOiBhdWRpdChcImZpbGVFeGlzdHNcIiwgZmlsZU5hbWUgPT4gZmlsZXMuaGFzKGZpbGVOYW1lKSB8fCBmaWxlcy5oYXMobGliaXplKGZpbGVOYW1lKSkpLFxuICAgIGdldEN1cnJlbnREaXJlY3Rvcnk6ICgpID0+IFwiL1wiLFxuICAgIGdldERpcmVjdG9yaWVzOiAoKSA9PiBbXSxcbiAgICBnZXRFeGVjdXRpbmdGaWxlUGF0aDogKCkgPT4gbm90SW1wbGVtZW50ZWQoXCJnZXRFeGVjdXRpbmdGaWxlUGF0aFwiKSxcbiAgICByZWFkRGlyZWN0b3J5OiBhdWRpdChcInJlYWREaXJlY3RvcnlcIiwgZGlyZWN0b3J5ID0+IChkaXJlY3RvcnkgPT09IFwiL1wiID8gQXJyYXkuZnJvbShmaWxlcy5rZXlzKCkpIDogW10pKSxcbiAgICByZWFkRmlsZTogYXVkaXQoXCJyZWFkRmlsZVwiLCBmaWxlTmFtZSA9PiBmaWxlcy5nZXQoZmlsZU5hbWUpIHx8IGZpbGVzLmdldChsaWJpemUoZmlsZU5hbWUpKSksXG4gICAgcmVzb2x2ZVBhdGg6IHBhdGggPT4gcGF0aCxcbiAgICBuZXdMaW5lOiBcIlxcblwiLFxuICAgIHVzZUNhc2VTZW5zaXRpdmVGaWxlTmFtZXM6IHRydWUsXG4gICAgd3JpdGU6ICgpID0+IG5vdEltcGxlbWVudGVkKFwid3JpdGVcIiksXG4gICAgd3JpdGVGaWxlOiAoZmlsZU5hbWUsIGNvbnRlbnRzKSA9PiB7XG4gICAgICBmaWxlcy5zZXQoZmlsZU5hbWUsIGNvbnRlbnRzKVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gaW4tbWVtb3J5IENvbXBpbGVySG9zdCAtd2hpY2ggaXMgZXNzZW50aWFsbHkgYW4gZXh0cmEgd3JhcHBlciB0byBTeXN0ZW1cbiAqIHdoaWNoIHdvcmtzIHdpdGggVHlwZVNjcmlwdCBvYmplY3RzIC0gcmV0dXJucyBib3RoIGEgY29tcGlsZXIgaG9zdCwgYW5kIGEgd2F5IHRvIGFkZCBuZXcgU291cmNlRmlsZVxuICogaW5zdGFuY2VzIHRvIHRoZSBpbi1tZW1vcnkgZmlsZSBzeXN0ZW0uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVWaXJ0dWFsQ29tcGlsZXJIb3N0KHN5czogU3lzdGVtLCBjb21waWxlck9wdGlvbnM6IENvbXBpbGVyT3B0aW9ucywgdHM6IFRTKSB7XG4gIGNvbnN0IHNvdXJjZUZpbGVzID0gbmV3IE1hcDxzdHJpbmcsIFNvdXJjZUZpbGU+KClcbiAgY29uc3Qgc2F2ZSA9IChzb3VyY2VGaWxlOiBTb3VyY2VGaWxlKSA9PiB7XG4gICAgc291cmNlRmlsZXMuc2V0KHNvdXJjZUZpbGUuZmlsZU5hbWUsIHNvdXJjZUZpbGUpXG4gICAgcmV0dXJuIHNvdXJjZUZpbGVcbiAgfVxuXG4gIHR5cGUgUmV0dXJuID0ge1xuICAgIGNvbXBpbGVySG9zdDogQ29tcGlsZXJIb3N0XG4gICAgdXBkYXRlRmlsZTogKHNvdXJjZUZpbGU6IFNvdXJjZUZpbGUpID0+IGJvb2xlYW5cbiAgfVxuXG4gIGNvbnN0IHZIb3N0OiBSZXR1cm4gPSB7XG4gICAgY29tcGlsZXJIb3N0OiB7XG4gICAgICAuLi5zeXMsXG4gICAgICBnZXRDYW5vbmljYWxGaWxlTmFtZTogZmlsZU5hbWUgPT4gZmlsZU5hbWUsXG4gICAgICBnZXREZWZhdWx0TGliRmlsZU5hbWU6ICgpID0+IFwiL1wiICsgdHMuZ2V0RGVmYXVsdExpYkZpbGVOYW1lKGNvbXBpbGVyT3B0aW9ucyksIC8vICcvbGliLmQudHMnLFxuICAgICAgLy8gZ2V0RGVmYXVsdExpYkxvY2F0aW9uOiAoKSA9PiAnLycsXG4gICAgICBnZXREaXJlY3RvcmllczogKCkgPT4gW10sXG4gICAgICBnZXROZXdMaW5lOiAoKSA9PiBzeXMubmV3TGluZSxcbiAgICAgIGdldFNvdXJjZUZpbGU6IGZpbGVOYW1lID0+IHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICBzb3VyY2VGaWxlcy5nZXQoZmlsZU5hbWUpIHx8XG4gICAgICAgICAgc2F2ZShcbiAgICAgICAgICAgIHRzLmNyZWF0ZVNvdXJjZUZpbGUoXG4gICAgICAgICAgICAgIGZpbGVOYW1lLFxuICAgICAgICAgICAgICBzeXMucmVhZEZpbGUoZmlsZU5hbWUpISxcbiAgICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zLnRhcmdldCB8fCBkZWZhdWx0Q29tcGlsZXJPcHRpb25zKHRzKS50YXJnZXQhLFxuICAgICAgICAgICAgICBmYWxzZVxuICAgICAgICAgICAgKVxuICAgICAgICAgIClcbiAgICAgICAgKVxuICAgICAgfSxcbiAgICAgIHVzZUNhc2VTZW5zaXRpdmVGaWxlTmFtZXM6ICgpID0+IHN5cy51c2VDYXNlU2Vuc2l0aXZlRmlsZU5hbWVzXG4gICAgfSxcbiAgICB1cGRhdGVGaWxlOiBzb3VyY2VGaWxlID0+IHtcbiAgICAgIGNvbnN0IGFscmVhZHlFeGlzdHMgPSBzb3VyY2VGaWxlcy5oYXMoc291cmNlRmlsZS5maWxlTmFtZSlcbiAgICAgIHN5cy53cml0ZUZpbGUoc291cmNlRmlsZS5maWxlTmFtZSwgc291cmNlRmlsZS50ZXh0KVxuICAgICAgc291cmNlRmlsZXMuc2V0KHNvdXJjZUZpbGUuZmlsZU5hbWUsIHNvdXJjZUZpbGUpXG4gICAgICByZXR1cm4gYWxyZWFkeUV4aXN0c1xuICAgIH1cbiAgfVxuICByZXR1cm4gdkhvc3Rcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIG9iamVjdCB3aGljaCBjYW4gaG9zdCBhIGxhbmd1YWdlIHNlcnZpY2UgYWdhaW5zdCB0aGUgdmlydHVhbCBmaWxlLXN5c3RlbVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVmlydHVhbExhbmd1YWdlU2VydmljZUhvc3QoXG4gIHN5czogU3lzdGVtLFxuICByb290RmlsZXM6IHN0cmluZ1tdLFxuICBjb21waWxlck9wdGlvbnM6IENvbXBpbGVyT3B0aW9ucyxcbiAgdHM6IFRTXG4pIHtcbiAgY29uc3QgZmlsZU5hbWVzID0gWy4uLnJvb3RGaWxlc11cbiAgY29uc3QgeyBjb21waWxlckhvc3QsIHVwZGF0ZUZpbGUgfSA9IGNyZWF0ZVZpcnR1YWxDb21waWxlckhvc3Qoc3lzLCBjb21waWxlck9wdGlvbnMsIHRzKVxuICBjb25zdCBmaWxlVmVyc2lvbnMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpXG4gIGxldCBwcm9qZWN0VmVyc2lvbiA9IDBcbiAgY29uc3QgbGFuZ3VhZ2VTZXJ2aWNlSG9zdDogTGFuZ3VhZ2VTZXJ2aWNlSG9zdCA9IHtcbiAgICAuLi5jb21waWxlckhvc3QsXG4gICAgZ2V0UHJvamVjdFZlcnNpb246ICgpID0+IHByb2plY3RWZXJzaW9uLnRvU3RyaW5nKCksXG4gICAgZ2V0Q29tcGlsYXRpb25TZXR0aW5nczogKCkgPT4gY29tcGlsZXJPcHRpb25zLFxuICAgIGdldFNjcmlwdEZpbGVOYW1lczogKCkgPT4gZmlsZU5hbWVzLFxuICAgIGdldFNjcmlwdFNuYXBzaG90OiBmaWxlTmFtZSA9PiB7XG4gICAgICBjb25zdCBjb250ZW50cyA9IHN5cy5yZWFkRmlsZShmaWxlTmFtZSlcbiAgICAgIGlmIChjb250ZW50cykge1xuICAgICAgICByZXR1cm4gdHMuU2NyaXB0U25hcHNob3QuZnJvbVN0cmluZyhjb250ZW50cylcbiAgICAgIH1cbiAgICAgIHJldHVyblxuICAgIH0sXG4gICAgZ2V0U2NyaXB0VmVyc2lvbjogZmlsZU5hbWUgPT4ge1xuICAgICAgcmV0dXJuIGZpbGVWZXJzaW9ucy5nZXQoZmlsZU5hbWUpIHx8IFwiMFwiXG4gICAgfSxcbiAgICB3cml0ZUZpbGU6IHN5cy53cml0ZUZpbGVcbiAgfVxuXG4gIHR5cGUgUmV0dXJuID0ge1xuICAgIGxhbmd1YWdlU2VydmljZUhvc3Q6IExhbmd1YWdlU2VydmljZUhvc3RcbiAgICB1cGRhdGVGaWxlOiAoc291cmNlRmlsZTogaW1wb3J0KFwidHlwZXNjcmlwdFwiKS5Tb3VyY2VGaWxlKSA9PiB2b2lkXG4gIH1cblxuICBjb25zdCBsc0hvc3Q6IFJldHVybiA9IHtcbiAgICBsYW5ndWFnZVNlcnZpY2VIb3N0LFxuICAgIHVwZGF0ZUZpbGU6IHNvdXJjZUZpbGUgPT4ge1xuICAgICAgcHJvamVjdFZlcnNpb24rK1xuICAgICAgZmlsZVZlcnNpb25zLnNldChzb3VyY2VGaWxlLmZpbGVOYW1lLCBwcm9qZWN0VmVyc2lvbi50b1N0cmluZygpKVxuICAgICAgaWYgKCFmaWxlTmFtZXMuaW5jbHVkZXMoc291cmNlRmlsZS5maWxlTmFtZSkpIHtcbiAgICAgICAgZmlsZU5hbWVzLnB1c2goc291cmNlRmlsZS5maWxlTmFtZSlcbiAgICAgIH1cbiAgICAgIHVwZGF0ZUZpbGUoc291cmNlRmlsZSlcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGxzSG9zdFxufVxuIl19