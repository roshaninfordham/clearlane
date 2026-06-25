import { z } from "zod";
import { PeriodSchema } from "../../schemas/common.js";
import { answerQuestion } from "../../core/answerQuestion.js";

export const AnswerQuestionInputSchema = {
  question: z.string(),
  route: z.string().optional(),
  borough: z.string().optional(),
  period: PeriodSchema.default("weekday_am"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  outDir: z.string().default("./output"),
  evidenceDir: z.string().optional(),
  mock: z.boolean().default(false),
  refresh: z.boolean().default(true)
};

export async function answerQuestionTool(input: {
  question: string;
  route?: string;
  borough?: string;
  period?: z.infer<typeof PeriodSchema>;
  dateFrom?: string;
  dateTo?: string;
  outDir?: string;
  evidenceDir?: string;
  mock?: boolean;
  refresh?: boolean;
}): Promise<unknown> {
  return answerQuestion({
    question: input.question,
    ...(input.route ? { route: input.route } : {}),
    ...(input.borough ? { borough: input.borough } : {}),
    period: input.period ?? "weekday_am",
    ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
    ...(input.dateTo ? { dateTo: input.dateTo } : {}),
    outDir: input.outDir ?? "./output",
    ...(input.evidenceDir ? { evidenceDir: input.evidenceDir } : {}),
    mock: input.mock ?? false,
    refresh: input.refresh ?? true
  });
}
