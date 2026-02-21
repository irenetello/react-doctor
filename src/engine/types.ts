export type Severity = "INFO" | "WARN" | "ERROR";

export type Issue = {
  id: string;
  severity: Severity;
  message: string;
  filePath: string;
  line?: number;
  ruleId: string;
};

export type RuleContext = {
  rootPath: string;
  maxFileLines: number;
};

export type Rule = {
  id: string;
  title: string;
  run: (ctx: RuleContext, files: ScannedFile[]) => Promise<Issue[]>;
};

export type ScannedFile = {
  path: string;
  relPath: string;
  content: string;
  lines: string[];
};