import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import * as child_process from 'child_process';
import * as os from 'os';

const execPromise = util.promisify(child_process.exec);

export class ModelService {
  private modelPath: string;
  private llamaPath: string;
  private isModelLoaded: boolean = true; // Always consider the model loaded in demo mode
  private _onModelStatusChanged = new vscode.EventEmitter<boolean>();
  
  public readonly onModelStatusChanged = this._onModelStatusChanged.event;
  
  constructor(context: vscode.ExtensionContext) {
    // Find the path to the model and the llama executable
    const rootPath = path.resolve(context.extensionPath, '..', '..');
    this.modelPath = path.join(rootPath, 'models', 'codellama-7b.Q4_K_M.gguf');
    this.llamaPath = path.join(rootPath, 'models', 'llama');
    
    // Demo mode - don't validate paths
    this._onModelStatusChanged.fire(true);
  }
  
  private validatePaths() {
    // Skip validation in demo mode
    return true;
  }
  
  public async loadModel(): Promise<boolean> {
    // Always return success in demo mode
    this._onModelStatusChanged.fire(true);
    return true;
  }
  
  public async analyzeCodeWithModel(code: string, prompt: string = 'Analyze the following code for security vulnerabilities:'): Promise<string> {
    // Skip actual model execution and return simulated results
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time
    
    const results = [];
    
    // Look for common security issues
    if (code.includes('eval(')) {
      results.push({
        type: 'security_vulnerability',
        title: 'Code Injection Risk',
        severity: 'Critical',
        message: 'Using eval() can lead to code injection vulnerabilities if user input is not properly sanitized',
        line: code.split('\n').findIndex(line => line.includes('eval(')) + 1,
        recommendation: 'Consider using safer alternatives like JSON.parse() for data parsing'
      });
    }
    
    if (code.includes('innerHTML')) {
      results.push({
        type: 'security_vulnerability',
        title: 'Cross-Site Scripting (XSS) Risk',
        severity: 'High',
        message: 'Using innerHTML with unsanitized input can lead to XSS attacks',
        line: code.split('\n').findIndex(line => line.includes('innerHTML')) + 1,
        recommendation: 'Use textContent instead, or sanitize input with a library like DOMPurify'
      });
    }
    
    if (code.includes('http://')) {
      results.push({
        type: 'security_vulnerability',
        title: 'Insecure HTTP Usage',
        severity: 'Medium',
        message: 'Using non-encrypted HTTP connections can expose data to eavesdropping',
        line: code.split('\n').findIndex(line => line.includes('http://')) + 1,
        recommendation: 'Use HTTPS instead of HTTP for all external connections'
      });
    }
    
    if (code.toLowerCase().includes('password') && !code.includes('password_hash')) {
      results.push({
        type: 'security_vulnerability',
        title: 'Insecure Password Handling',
        severity: 'High',
        message: 'Passwords should be properly hashed and salted before storage',
        line: code.split('\n').findIndex(line => line.toLowerCase().includes('password')) + 1,
        recommendation: 'Use a secure hashing algorithm like bcrypt or Argon2 to hash passwords'
      });
    }
    
    if (code.includes('sql') && code.includes('${') || code.includes("'+") || code.includes("' +")) {
      results.push({
        type: 'security_vulnerability',
        title: 'SQL Injection Risk',
        severity: 'Critical',
        message: 'String concatenation in SQL queries can lead to SQL injection vulnerabilities',
        line: code.split('\n').findIndex(line => line.includes('sql') && (line.includes('${') || line.includes("'+") || line.includes("' +"))) + 1,
        recommendation: 'Use parameterized queries or prepared statements instead of string concatenation'
      });
    }
    
    const resultText = results.length > 0
      ? `Found ${results.length} security issues:\n\n` + 
        results.map(r => `${r.severity} - ${r.title} (Line ${r.line}): ${r.message}\nRecommendation: ${r.recommendation}`).join('\n\n')
      : 'No obvious security issues found in the provided code sample';
      
    return resultText;
  }
} 