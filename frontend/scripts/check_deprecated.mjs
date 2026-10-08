import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
let found = 0

for (const name of ['tsconfig.app.json', 'tsconfig.node.json']) {
  const parsed = ts.getParsedCommandLineOfConfigFile(join(root, name), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (diagnostic) => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')) } })
  const host = {
    getScriptFileNames: () => parsed.fileNames,
    getScriptVersion: () => '1',
    getScriptSnapshot: (file) => (ts.sys.fileExists(file) ? ts.ScriptSnapshot.fromString(ts.sys.readFile(file) ?? '') : undefined),
    getCurrentDirectory: () => root,
    getCompilationSettings: () => parsed.options,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  }
  const service = ts.createLanguageService(host, ts.createDocumentRegistry())
  for (const file of parsed.fileNames) {
    for (const diagnostic of service.getSuggestionDiagnostics(file).filter((item) => item.reportsDeprecated)) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0)
      console.error(`${relative(root, file)}:${line + 1}:${character + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`)
      found++
    }
  }
}

console.log(found ? `${found} deprecated API use(s)` : 'No deprecated APIs in use')
process.exit(found ? 1 : 0)
