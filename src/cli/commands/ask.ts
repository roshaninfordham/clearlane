import { answerQuestion } from "../../core/answerQuestion.js";
import { PeriodSchema } from "../../schemas/common.js";

export async function runAskCommand(questionParts: string[], options: {
  route?: string;
  borough?: string;
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  out?: string;
  withEvidence?: string;
  mock?: boolean;
  json?: boolean;
}): Promise<void> {
  const question = questionParts.join(" ").trim();
  if (!question) {
    console.error("Please provide a question, for example: clearlane ask \"Why is the M15 slow weekday AM?\"");
    process.exitCode = 1;
    return;
  }
  const result = await answerQuestion({
    question,
    ...(options.route ? { route: options.route } : {}),
    ...(options.borough ? { borough: options.borough } : {}),
    period: options.period ? PeriodSchema.parse(options.period) : "weekday_am",
    ...(options.dateFrom ? { dateFrom: options.dateFrom } : {}),
    ...(options.dateTo ? { dateTo: options.dateTo } : {}),
    outDir: options.out ?? "./output",
    ...(options.withEvidence ? { evidenceDir: options.withEvidence } : {}),
    mock: Boolean(options.mock)
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.status === "needs_configuration") {
    console.log(result.summary);
    console.log(result.nextStep);
    process.exitCode = 1;
    return;
  }

  console.log(result.summary);
  console.log("");
  console.log(result.pitch);
  console.log("");
  console.log(result.answer);
  console.log("");
  console.log("Action points:");
  for (const action of result.actionPoints) {
    console.log(`- ${action.action}`);
  }
  console.log("");
  console.log(`Question report: ${result.artifacts.questionReportMd}`);
  console.log(`Question PDF: ${result.artifacts.questionReportPdf}`);
  console.log(`Question JSON: ${result.artifacts.questionAnswerJson}`);
  console.log(`Audit ledger: ${result.artifacts.auditLog}`);
}
