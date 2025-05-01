import * as vscode from 'vscode';

export enum IssueSeverity {
  Low = 0,
  Medium = 1,
  High = 2,
  Critical = 3
}

export interface SecuritySuggestion {
  description: string;
  fix: string;
}

export interface SecurityIssue {
  id: string;
  message: string;
  severity: IssueSeverity;
  location: vscode.Location;
  source: string;
  description: string;
  code: string;
  suggestions: SecuritySuggestion[];
} 