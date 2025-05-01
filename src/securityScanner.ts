import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { SecurityIssue, IssueSeverity } from './securityIssueTypes';

export class SecurityScanner {
  private _issues: SecurityIssue[] = [];
  private _onIssuesChanged = new vscode.EventEmitter<void>();
  private _currentScanLocation: string = '';
  private _onScanLocationChanged = new vscode.EventEmitter<string>();
  
  public readonly onIssuesChanged = this._onIssuesChanged.event;
  public readonly onScanLocationChanged = this._onScanLocationChanged.event;
  
  constructor() {}
  
  get issues(): SecurityIssue[] {
    return this._issues;
  }
  
  get currentScanLocation(): string {
    return this._currentScanLocation;
  }
  
  private updateScanLocation(location: string): void {
    this._currentScanLocation = location;
    this._onScanLocationChanged.fire(location);
  }
  
  // Scan a single file for security issues
  async scanFile(document: vscode.TextDocument): Promise<SecurityIssue[]> {
    this._issues = [];
    
    // Update scan location
    this.updateScanLocation(document.uri.fsPath);
    
    // Determine language type and select appropriate scanner
    const languageId = document.languageId;
    if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(languageId)) {
      await this.scanJavaScriptFile(document);
    } else if (['python'].includes(languageId)) {
      await this.scanPythonFile(document);
    } else if (['java'].includes(languageId)) {
      await this.scanJavaFile(document);
    } else {
      // Generic code scan using model
      await this.modelBasedCodeScan(document);
    }
    
    this._onIssuesChanged.fire();
    return this._issues;
  }
  
  // Scan entire project
  async scanProject(workspaceFolder: vscode.Uri): Promise<SecurityIssue[]> {
    this._issues = [];
    
    // Update scan location
    this.updateScanLocation(workspaceFolder.fsPath);
    
    // Detect project type
    const hasPackageJson = fs.existsSync(path.join(workspaceFolder.fsPath, 'package.json'));
    const hasPipfile = fs.existsSync(path.join(workspaceFolder.fsPath, 'requirements.txt')) || 
                       fs.existsSync(path.join(workspaceFolder.fsPath, 'Pipfile'));
    const hasPomXml = fs.existsSync(path.join(workspaceFolder.fsPath, 'pom.xml'));
    
    if (hasPackageJson) {
      await this.scanJavaScriptProject(workspaceFolder);
    } else if (hasPipfile) {
      await this.scanPythonProject(workspaceFolder);
    } else if (hasPomXml) {
      await this.scanJavaProject(workspaceFolder);
    } else {
      // Scan all supported files in the project
      await this.scanAllSupportedFiles(workspaceFolder);
    }
    
    this._onIssuesChanged.fire();
    return this._issues;
  }
  
  private async scanJavaScriptFile(document: vscode.TextDocument): Promise<void> {
    try {
      // Use ESLint with security-focused rules
      const eslintResults = await this.runEslint(document.uri.fsPath);
      this.parseEslintResults(eslintResults, document.uri);
    } catch (error) {
      console.error('Error scanning JavaScript file:', error);
      vscode.window.showErrorMessage(`Failed to scan JavaScript file: ${error}`);
    }
  }
  
  private async scanPythonFile(document: vscode.TextDocument): Promise<void> {
    try {
      // Use Bandit for Python security scanning - simulated here
      // In a real implementation, we would run Bandit and parse its output
      await this.modelBasedCodeScan(document);
    } catch (error) {
      console.error('Error scanning Python file:', error);
      vscode.window.showErrorMessage(`Failed to scan Python file: ${error}`);
    }
  }
  
  private async scanJavaFile(document: vscode.TextDocument): Promise<void> {
    try {
      // Use SpotBugs/FindSecBugs for Java - simulated here
      // In a real implementation, we would run FindSecBugs and parse its output
      await this.modelBasedCodeScan(document);
    } catch (error) {
      console.error('Error scanning Java file:', error);
      vscode.window.showErrorMessage(`Failed to scan Java file: ${error}`);
    }
  }
  
  private async scanJavaScriptProject(workspaceFolder: vscode.Uri): Promise<void> {
    try {
      // Scan the entire JS/TS project using ESLint
      const eslintResults = await this.runEslint(workspaceFolder.fsPath, true);
      this.parseEslintResults(eslintResults);
    } catch (error) {
      console.error('Error scanning JavaScript project:', error);
      vscode.window.showErrorMessage(`Failed to scan JavaScript project: ${error}`);
    }
  }
  
  private async scanPythonProject(workspaceFolder: vscode.Uri): Promise<void> {
    // Implement Python project scanning with Bandit
    await this.scanAllSupportedFiles(workspaceFolder);
  }
  
  private async scanJavaProject(workspaceFolder: vscode.Uri): Promise<void> {
    // Implement Java project scanning with SpotBugs/FindSecBugs
    await this.scanAllSupportedFiles(workspaceFolder);
  }
  
  private async scanAllSupportedFiles(workspaceFolder: vscode.Uri): Promise<void> {
    // Find all supported files and scan them
    const fileTypes = [
      '**/*.{js,ts,jsx,tsx}', 
      '**/*.{py}',
      '**/*.{java}',
      '**/*.{c,cpp,h,hpp}'
    ];
    
    for (const pattern of fileTypes) {
      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceFolder, pattern),
        '**/node_modules/**'
      );
      
      for (const file of files.slice(0, 100)) { // Limit to 100 files per type for performance
        try {
          const document = await vscode.workspace.openTextDocument(file);
          await this.modelBasedCodeScan(document);
        } catch (error) {
          console.error(`Error scanning file ${file.fsPath}:`, error);
        }
      }
    }
  }
  
  private async runEslint(filePath: string, isProject: boolean = false): Promise<string> {
    return new Promise((resolve) => {
      // Simulated ESLint output as we can't actually run the process here
      const sampleOutput = JSON.stringify([
        {
          filePath: filePath,
          messages: [
            {
              ruleId: "security/detect-non-literal-regexp",
              severity: 2,
              message: "Found non-literal argument to RegExp Constructor",
              line: 10,
              column: 15
            }
          ]
        }
      ]);
      resolve(sampleOutput);
    });
  }
  
  private parseEslintResults(results: string, fileUri?: vscode.Uri): void {
    try {
      const parsedResults = JSON.parse(results);
      
      for (const fileResult of parsedResults) {
        const uri = fileUri || vscode.Uri.file(fileResult.filePath);
        
        for (const msg of fileResult.messages) {
          if (msg.severity >= 1) { // Only add warnings and errors
            this._issues.push({
              id: `eslint-${msg.ruleId || 'unknown'}`,
              message: msg.message,
              severity: msg.severity === 2 ? IssueSeverity.High : IssueSeverity.Medium,
              location: new vscode.Location(
                uri,
                new vscode.Position(msg.line - 1, msg.column - 1)
              ),
              source: 'ESLint',
              description: `Rule: ${msg.ruleId}`,
              code: msg.ruleId || 'unknown',
              suggestions: []
            });
          }
        }
      }
    } catch (error) {
      console.error('Error parsing ESLint results:', error);
    }
  }
  
  private async modelBasedCodeScan(document: vscode.TextDocument): Promise<void> {
    // Use the model to analyze code for security issues
    try {
      // Get the document text
      const code = document.getText();
      
      // For large files, break into chunks
      const maxChunkSize = 1000; // lines
      const lines = code.split('\n');
      
      for (let i = 0; i < lines.length; i += maxChunkSize) {
        const chunk = lines.slice(i, i + maxChunkSize).join('\n');
        await this.analyzeCodeChunkWithModel(chunk, document.uri, i);
      }
    } catch (error) {
      console.error('Error in model-based code scan:', error);
    }
  }
  
  private async analyzeCodeChunkWithModel(codeChunk: string, uri: vscode.Uri, startLine: number): Promise<void> {
    try {
      // This would be the actual model invocation in a real implementation
      // For now, we'll simulate finding an issue

      // Simulate a security issue detection
      if (codeChunk.includes('eval(') || codeChunk.includes('exec(')) {
        const lineIndex = codeChunk.indexOf('eval(') !== -1 ? 
          codeChunk.indexOf('eval(') : codeChunk.indexOf('exec(');
        
        const lineNumber = this.getLineNumberFromIndex(codeChunk, lineIndex);
        
        this._issues.push({
          id: 'model-eval-exec',
          message: 'Potential code injection vulnerability detected',
          severity: IssueSeverity.High,
          location: new vscode.Location(
            uri,
            new vscode.Position(startLine + lineNumber, 0)
          ),
          source: 'AI Security Model',
          description: 'Using eval() or exec() can lead to code injection vulnerabilities if user input is not properly sanitized',
          code: 'injection-risk',
          suggestions: [
            {
              description: 'Consider using safer alternatives to eval() or exec()',
              fix: 'Replace with a safer alternative such as JSON.parse() for data parsing or a more specific function'
            }
          ]
        });
      }
    } catch (error) {
      console.error('Error analyzing code with model:', error);
    }
  }
  
  private getLineNumberFromIndex(text: string, index: number): number {
    const textBeforeIndex = text.substring(0, index);
    return (textBeforeIndex.match(/\n/g) || []).length;
  }
} 