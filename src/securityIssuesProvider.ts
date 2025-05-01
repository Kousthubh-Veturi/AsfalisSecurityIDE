import * as vscode from 'vscode';
import { SecurityScanner } from './securityScanner';
import { SecurityIssue, IssueSeverity } from './securityIssueTypes';

export class SecurityIssuesProvider implements vscode.TreeDataProvider<SecurityIssueItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SecurityIssueItem | undefined | null | void> = new vscode.EventEmitter<SecurityIssueItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<SecurityIssueItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private securityScanner: SecurityScanner) {
    // Subscribe to the scanner's issues changed event
    this.securityScanner.onIssuesChanged(() => {
      this.refresh();
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SecurityIssueItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SecurityIssueItem): Promise<SecurityIssueItem[]> {
    if (element) {
      // Return children of a specific security issue (e.g., suggestions)
      return Promise.resolve([]);
    } else {
      // Return top-level issues
      const issues = this.securityScanner.issues;
      return Promise.resolve(this.getSecurityIssueItems(issues));
    }
  }

  private getSecurityIssueItems(issues: SecurityIssue[]): SecurityIssueItem[] {
    if (issues.length === 0) {
      return [new SecurityIssueItem(
        'No security issues found',
        'success',
        vscode.TreeItemCollapsibleState.None,
        {
          command: '',
          title: '',
          arguments: []
        }
      )];
    }

    return issues.map(issue => {
      const item = new SecurityIssueItem(
        `${issue.message} (${issue.source})`,
        this.getSeverityIcon(issue.severity),
        vscode.TreeItemCollapsibleState.Collapsed,
        {
          command: 'security-scan-chat.showIssueDetails',
          title: 'Show Issue Details',
          arguments: [issue]
        }
      );

      item.description = `${issue.location.uri.path.split('/').pop()}:${issue.location.range.start.line + 1}`;
      item.tooltip = new vscode.MarkdownString(`**${issue.message}**\n\n${issue.description}\n\nIn file: ${issue.location.uri.path}\nLine: ${issue.location.range.start.line + 1}`);
      item.contextValue = 'securityIssue';
      
      return item;
    });
  }

  private getSeverityIcon(severity: IssueSeverity): string {
    switch (severity) {
      case IssueSeverity.Critical:
        return 'critical';
      case IssueSeverity.High:
        return 'error';
      case IssueSeverity.Medium:
        return 'warning';
      case IssueSeverity.Low:
        return 'info';
      default:
        return 'info';
    }
  }
}

export class SecurityIssueItem extends vscode.TreeItem {
  description?: string;
  tooltip?: string | vscode.MarkdownString;
  contextValue?: string;

  constructor(
    public readonly label: string,
    public readonly iconId: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);

    this.iconPath = new vscode.ThemeIcon(iconId);
  }
}

export class IssueDetailsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'securityIssueDetails';
  
  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    // Initial empty content
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview, null);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((message: any) => {
      switch (message.command) {
        case 'fixIssue':
          vscode.commands.executeCommand('security-scan-chat.fixIssue', message.issueId);
          break;
      }
    });
  }

  public updateContent(issue: SecurityIssue | null) {
    const activeView = vscode.window.activeWebviewViewProvider;
    if (activeView && activeView === this) {
      const webviewView = vscode.window.visibleWebviewPanels.find(
        panel => panel.viewType === IssueDetailsProvider.viewType
      );
      
      if (webviewView) {
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview, issue);
      }
    }
  }

  private getHtmlForWebview(_webview: vscode.Webview, issue: SecurityIssue | null): string {
    if (!issue) {
      return `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Security Issue Details</title>
        </head>
        <body>
          <p>Select a security issue to view details</p>
        </body>
        </html>`;
    }

    let suggestionsHtml = '';
    if (issue.suggestions && issue.suggestions.length > 0) {
      suggestionsHtml = `
        <h3>Suggested Fixes:</h3>
        <ul>
          ${issue.suggestions.map(suggestion => `
            <li>
              <p><strong>${suggestion.description}</strong></p>
              <pre><code>${suggestion.fix}</code></pre>
            </li>
          `).join('')}
        </ul>
      `;
    }

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Security Issue Details</title>
        <style>
          body {
            padding: 10px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
          }
          h2 {
            margin-top: 0;
            color: var(--vscode-editor-foreground);
          }
          .severity {
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: bold;
            display: inline-block;
          }
          .severity.high {
            background-color: #f14c4c;
            color: white;
          }
          .severity.medium {
            background-color: #ffa500;
            color: white;
          }
          .severity.low {
            background-color: #ffcc00;
            color: black;
          }
          pre {
            background-color: var(--vscode-editor-background);
            padding: 8px;
            border-radius: 3px;
            overflow: auto;
          }
          button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            margin-top: 10px;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
        </style>
      </head>
      <body>
        <h2>${issue.message}</h2>
        <p>
          <span class="severity ${this.getSeverityClass(issue.severity)}">
            ${IssueSeverity[issue.severity]}
          </span>
          <span> | ${issue.source}</span>
        </p>
        <h3>Description:</h3>
        <p>${issue.description}</p>
        <h3>Location:</h3>
        <p>File: ${issue.location.uri.path}</p>
        <p>Line: ${issue.location.range.start.line + 1}, Column: ${issue.location.range.start.character + 1}</p>
        ${suggestionsHtml}
        <button id="goToLocation">Go to Location</button>
        <script>
          const vscode = acquireVsCodeApi();
          document.getElementById('goToLocation').addEventListener('click', () => {
            vscode.postMessage({
              command: 'goToLocation',
              issueId: '${issue.id}'
            });
          });
        </script>
      </body>
      </html>`;
  }

  private getSeverityClass(severity: IssueSeverity): string {
    switch (severity) {
      case IssueSeverity.Critical:
      case IssueSeverity.High:
        return 'high';
      case IssueSeverity.Medium:
        return 'medium';
      case IssueSeverity.Low:
        return 'low';
      default:
        return 'low';
    }
  }
} 